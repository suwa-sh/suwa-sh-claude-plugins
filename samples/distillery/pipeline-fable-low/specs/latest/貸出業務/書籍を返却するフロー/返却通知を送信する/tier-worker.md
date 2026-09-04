# 返却通知を送信する - ワーカー仕様

## 変更概要

tier-worker に MQ コンシューマ「ReturnNoticeConsumer」を追加する。`notifications.return-notice-requested` を購読し、通知レコード（返却通知・送信待ち）をメール配信サービスへ tier-external-integration の ACL アダプタ経由で送信し、送信結果（成功 / 失敗）と送信日時を通知レコードに反映する（arch SP-020 / LP-024 / LP-027 / LR-019）。予約の状態は変更しない（Backend API で通知済みに遷移済み）。

## イベント処理仕様

### ReturnNoticeConsumer（返却通知メール配信）

- **トリガー**: MQ メッセージ `ReturnNoticeRequested` の受信
- **入力チャネル**: `notifications.return-notice-requested`（Competing Consumers。MessageId = 通知 ID）
- **出力チャネル**: なし（DLQ: `notifications.return-notice-requested.dlq`）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notifications.return-notice-requested` を参照

#### 処理フロー

1. メッセージの MessageId（= 通知 ID）と traceId を受け取り、trace_id として採用する（LP-019）
2. 既処理照合: `notifications WHERE notification_id = ?` を取得し、`send_result` が `SUCCEEDED`（成功） または `FAILED`（失敗） なら既処理として ACK し読み飛ばす（LR-014）。レコードが無ければ WARN を出力して DLQ へ退避する（`ReturnNoticeRequested` はコミット後発行のため通常は発生しない。発生時はコミットのロールバック後に発行された等の異常として扱い、運用が調査する）
3. usecase `SendReturnNoticeMail(notificationId)` を呼ぶ
   1. 通知レコード（送信先メールアドレス・件名・本文）を取得する
   2. `MailDeliveryAdapter.send({idempotencyKey: notificationId, to: recipient_email, subject, body})` を呼ぶ（LP-027。Timeout + Retry（指数バックオフ + Jitter、最大 3 回）+ Circuit Breaker。SP-028）
   3. 結果を通知レコードに反映する（LP-024）: 成功 → `send_result = SUCCEEDED, sent_at = 現在時刻`。恒久失敗（4xx: 宛先不正・認証エラー）→ `send_result = FAILED, sent_at = 現在時刻`。一時失敗（5xx / タイムアウト / Circuit Open）→ 更新せず NACK（再配信）
   4. 監査ログ（バッチ起因のデータ更新: E-008）を記録する（LP-023）
4. 成功 / 恒久失敗は ACK。一時失敗は NACK し、MQ の再配信回数が上限（5 回）を超えたら DLQ（`notifications.return-notice-requested.dlq`）に `ReturnNoticeRequestedDead` として退避し、退避ヘッダ 4 項目（`attemptCount`（初回退避は 6）/ `lastFailureReason` / `lastFailedAt` / `originalChannel`）を付与したうえで `send_result = FAILED` に更新する（SP-020）
5. 送信件数・失敗件数・Circuit Breaker の状態をメトリクスとして出力する（SP-021 / SP-029）

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| 通知レコードが存在しない | No | Yes | コミット後発行のため通常は発生しない。発生時は WARN を出力して DLQ へ退避し、運用がロールバック後発行等の異常を調査する |
| 既に 成功 / 失敗 | No | No | 既処理として ACK（重複配信の吸収。SR-013） |
| メール配信サービスの 4xx（宛先不正・認証エラー） | No | No | 送信失敗として記録し ACK。司書が NotificationLogTable / 延滞一覧で確認する（SR-018） |
| メール配信サービスの 5xx / タイムアウト | Yes（アダプタ内 最大 3 回、指数バックオフ + Jitter） | Yes（MQ 再配信 5 回超過） | 上限超過は DLQ へ退避し `send_result = FAILED`。手動再処理で再送する |
| Circuit Breaker Open | Yes（NACK して再配信） | Yes（同上） | 継続障害中は送信を試みず通知を保留する。Open 状態をアラート対象とする |
| RDB 一時障害（結果反映） | Yes（NACK して再配信） | Yes（同上） | 送信は成功しているため、再配信時は冪等キー = 通知 ID でアダプタが二重送信を防ぐ（LR-019） |
| SIGTERM 受信 | Yes（未 ACK メッセージは再配信） | No | 処理中のメッセージを NACK して終了する（SP-030） |

### ReturnNoticeSweepJob（返却通知の再発行スイープ）

- **トリガー**: スケジュール（日次）
- **入力チャネル**: なし（CronJob）
- **出力チャネル**: `notifications.return-notice-requested`
- **処理**: `NotificationRepository.findPendingUnpublished(RETURN_NOTICE, asOf)` で「`send_result = PENDING` かつ `requested_on <= asOf`」の通知を取得し、MessageId = 通知 ID で `ReturnNoticeRequested` を再発行する。Backend API のコミット後 MQ 発行に失敗して送信待ちのまま残った通知（tier-backend-api の「再発行バッチ」の実体）を回収する。既発行分は MQ の重複排除と本ワーカーの既処理照合で読み飛ばされる。使用インデックスは `idx_notifications_send_result_notification_type_requested_on`

## データモデル変更

### notifications（通知 E-008）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| send_result | VARCHAR(16) | PENDING（送信待ち） → SUCCEEDED（成功） / FAILED（失敗） に更新 | 変更（本 UC で UPDATE） |
| sent_at | TIMESTAMP | 送信完了（または恒久失敗確定）日時 | 変更 |

## ビジネスルール

- 送信対象は `send_result = PENDING` の通知レコードのみ。既に成功 / 失敗の通知は再送しない（SR-013）
- 外部送信は通知 ID を冪等キーとしてアダプタに渡し、再試行・再配信で同一通知が二重送信されないようにする（LR-019 / SR-018）
- 4xx 系エラーは再試行せず送信失敗として記録する。再試行は 5xx / タイムアウトのみ（SR-018）
- 予約の状態・書籍の状態は変更しない。送信失敗でも予約は「通知済み」のまま残し、司書が画面で失敗を確認して手動対応する（LP-024）
- ログに氏名・メールアドレス・件名・本文を出力しない。通知 ID・送信結果・所要時間のみ出力する
- メッセージ処理は ACK 単位で完結させ、ワーカーは水平スケール可能なステートレス構成とする（SP-020）

## ティア完了条件（BDD）

```gherkin
Feature: 返却通知を送信する - ワーカー

  Scenario: 送信待ちの返却通知をメール送信して成功を記録する
    Given notifications に notification_id=N-0001, notification_type=RETURN_NOTICE, recipient_email=u200@example.com, send_result=PENDING の行がある
    And メール配信サービスが送信成功を返す
    When ReturnNoticeConsumer が MessageId=N-0001 の ReturnNoticeRequested を受信する
    Then MailDeliveryAdapter が冪等キー "N-0001" で 1 回呼ばれる
    And notifications「N-0001」の send_result が "SUCCEEDED"、sent_at が設定される
    And メッセージが ACK される

  Scenario: 重複配信されたメッセージを読み飛ばす
    Given notifications「N-0001」の send_result が "SUCCEEDED" である
    When ReturnNoticeConsumer が MessageId=N-0001 のメッセージを再受信する
    Then MailDeliveryAdapter は呼ばれずメッセージが ACK される
    And INFO ログ「already processed」が出力される

  Scenario: 宛先不正は再試行せず失敗を記録する
    Given notifications「N-0002」が send_result "PENDING" である
    And メール配信サービスが 4xx（宛先不正）を返す
    When ReturnNoticeConsumer が MessageId=N-0002 のメッセージを受信する
    Then MailDeliveryAdapter の呼び出しは 1 回で再試行されない
    And notifications「N-0002」の send_result が "FAILED" になりメッセージが ACK される

  Scenario: 一時障害は再配信し上限超過で DLQ に退避する
    Given notifications「N-0003」が send_result "PENDING" である
    And メール配信サービスがタイムアウトし続ける
    When ReturnNoticeConsumer が MessageId=N-0003 のメッセージを 6 回受信する
    Then 5 回目までは NACK され 6 回目でメッセージは ReturnNoticeRequestedDead として DLQ "notifications.return-notice-requested.dlq" に退避される
    And 退避メッセージのヘッダは attemptCount=6, lastFailureReason=TEMPORARY_FAILURE, originalChannel=notifications.return-notice-requested を持ち lastFailedAt が設定されている
    And notifications「N-0003」の send_result が "FAILED" になる
```
