# 督促を送信する - ワーカー仕様

## 変更概要

MQ コンシューマ「日次督促送信バッチ」（`OverdueNoticeConsumer`）を tier-worker に追加する。`notifications.overdue-notice-requested` を購読し、通知レコード（督促・送信待ち）を読み出して tier-external-integration の ACL アダプタ経由でメール配信サービスへ送信し、送信結果を通知レコードに反映する。Competing Consumers として水平スケール可能にする（arch SP-020）。`ReminderMailConsumer`（UC「リマインドを送信する」）と同じ基底ハンドラを共有し、通知種別と再確認ポリシーだけを差し替える。

## イベント処理仕様

### OverdueNoticeConsumer（日次督促送信バッチ）

- **トリガー**: MQ メッセージ受信（`OverdueNoticeRequested`。日次延滞判定バッチが発行）
- **入力チャネル**: `notifications.overdue-notice-requested`
- **出力チャネル**: なし（再配信上限超過時のみ `notifications.overdue-notice-requested.dlq` へ退避）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notifications.overdue-notice-requested` を参照

#### 処理フロー

1. メッセージをデシリアライズし、MessageId（= 通知 ID）と属性 traceId（ジョブ実行 ID）を trace_id として採用する（LP-019）
2. 既処理照合: KVS `lock:notification:{notificationId}` を照合し、存在すれば ACK して終了する（LR-014）
3. usecase `SendOverdueNotice(notificationId)` を呼ぶ
   1. `NotificationRepository.findById` で通知レコードを取得する。存在しなければ `NOTIFICATION_NOT_FOUND` を WARN ログに出して ACK する（判定側ロールバック後の残留メッセージ）
   2. 送信結果が「送信待ち」以外なら既処理として終了する
   3. `LoanRepository.findById(targetLoanId)` で貸出を取得し `OverduePolicy.isStillOverdue(loan)`（貸出の状態 = 延滞）を評価する。対象外（返却済み）なら送信結果を「スキップ」に更新して終了する
   4. `MailDeliveryAdapter.send(通知ID, 送信先, 件名, 本文, idempotencyKey=通知ID)` を呼ぶ（LP-027 / LR-019）
   5. 結果型に応じて通知レコードを更新する: 成功 → send_result=SUCCEEDED, sent_at=now, external_message_id / 恒久失敗 → send_result=FAILED, failure_reason / 一時失敗 → 例外（RetryableDeliveryError）
   6. 更新は `WHERE send_result='PENDING'` の条件付き UPDATE で行い、更新件数 0 は他コンシューマの既処理として扱う
4. usecase の結果を ACK / NACK に変換する（LR-015）。NACK は可視性タイムアウト + 指数バックオフで再配信し、再配信回数が 5 を超えたら DLQ（`notifications.overdue-notice-requested.dlq`）に `OverdueNoticeRequestedDead` として退避し、退避ヘッダ 4 項目（`attemptCount`（初回退避は 6）/ `lastFailureReason` / `lastFailedAt` / `originalChannel`）を付与したうえで send_result=FAILED（failure_reason=EXHAUSTED）に更新する
5. 成功 / 失敗 / スキップ件数をメトリクスに加算する。件ごとの逐次ログは出力しない（CLR-005）。キュー深度・DLQ 到達は WARN の劣化ログ（LP-021）

### OverdueNoticeSweepJob（日次督促送信バッチの再発行スイープ）

- **トリガー**: スケジュール（日次。日次延滞判定バッチの完了後）
- **入力チャネル**: なし（CronJob）
- **出力チャネル**: `notifications.overdue-notice-requested`
- **処理**: `NotificationRepository.findPendingUnpublished(OVERDUE_NOTICE, asOf)` で「送信待ちかつ requested_on <= asOf」の通知を取得し、MessageId = 通知 ID で `OverdueNoticeRequested` を再発行する。延滞判定バッチの MQ 発行失敗（3 回リトライ超過）で残った通知を回収する。既発行分は MQ の重複排除と KVS の既処理照合で読み飛ばされる

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| 通知レコード未存在（NOTIFICATION_NOT_FOUND） | No | No | WARN ログを出して ACK（残留メッセージ） |
| 送信結果が送信待ち以外 | No | No | 既処理として ACK（SR-013） |
| 一時失敗（メール配信サービス 5xx / タイムアウト / サーキットブレーカー Open） | Yes（最大 5 回、30s→60s→120s→240s→480s + Jitter） | Yes（上限超過） | 上限超過は DLQ に退避し send_result=FAILED（EXHAUSTED）、WARN「MAIL_DELIVERY_EXHAUSTED」（SP-020 / SP-028） |
| 恒久失敗（4xx・宛先不正・認証エラー） | No | No | send_result=FAILED（INVALID_RECIPIENT / REJECTED / AUTH_ERROR）として ACK（SR-018 / LR-028）。認証エラーは ERROR ログでアラート対象 |
| RDB 一時障害（通知レコード更新） | Yes（gateway で最大 3 回） | Yes（上限超過） | 送信成功後の更新失敗は再配信で条件付き UPDATE が再実行される。メール側は冪等キーで二重送信されない |
| SIGTERM 受信（スポット中断） | Yes（可視性タイムアウト解放で再配信） | No | 処理中メッセージは NACK して終了する（SP-030） |

## データモデル変更

### notifications（情報: 通知）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| send_result | VARCHAR(16) | 送信結果 enum: PENDING（送信待ち）・SUCCEEDED（成功）・FAILED（失敗）・SKIPPED（スキップ）（UC「リマインドを送信する」で SKIPPED を追加済み）。本 UC が PENDING → SUCCEEDED / FAILED / SKIPPED に更新する | 変更なし |
| sent_at | TIMESTAMP | 送信日時（成功時に設定） | 変更なし |
| failure_reason | VARCHAR(200) | 失敗理由コード（UC「リマインドを送信する」で追加済み） | 変更なし |
| external_message_id | VARCHAR(100) | 外部メッセージ ID（同上） | 変更なし |

## ビジネスルール

- 送信対象は通知種別「督促」かつ送信結果「送信待ち」の通知レコードのみ。送信直前に条件「延滞判定」の貸出の状態 = 延滞 を再確認し、返却済みへ遷移していれば送信しない（スキップ）
- 同一通知は 1 回のみ送信する。MessageId = 通知 ID の重複検知（KVS）、送信結果の条件付き UPDATE、ACL への冪等キー = 通知 ID の 3 段で二重送信を防ぐ（SR-013 / LR-019）
- 一時失敗のみ再試行する。4xx 系は再試行せず失敗として記録する（SR-018）
- 送信先メールアドレス・件名・本文をログに出力しない。通知 ID・貸出 ID・利用者番号のみで識別する（CLR-006）
- 送信結果（成功 / 失敗 + 理由コード）は司書が延滞・督促状況画面（UC「延滞一覧を参照する」）で確認できる（LP-024）。失敗の再送は画面からは行わず、運用手順（DLQ の手動再処理）で行う

## ティア完了条件（BDD）

```gherkin
Feature: 督促を送信する - ワーカー

  Scenario: 送信待ち通知を送信して成功を反映する
    Given notifications に notification_id=01J7O1, notification_type=OVERDUE_NOTICE, send_result=PENDING の行が存在する
    And loans の loan_id=L-2001 の current_status が OVERDUE である
    And メール配信サービスが HTTP 202 と外部メッセージ ID「ext-101」を返す
    When OverdueNoticeConsumer が MessageId=01J7O1 のメッセージを受信する
    Then MailDeliveryAdapter.send が idempotencyKey=01J7O1 で 1 回呼ばれる
    And notifications の 01J7O1 が send_result=SUCCEEDED, external_message_id=ext-101, sent_at=非 NULL に更新される
    And メッセージは ACK される

  Scenario: 返却済みの貸出への督促をスキップする
    Given notifications に notification_id=01J7O2, notification_type=OVERDUE_NOTICE, send_result=PENDING の行が存在する
    And loans の loan_id=L-2002 の current_status が RETURNED である
    When OverdueNoticeConsumer が MessageId=01J7O2 のメッセージを受信する
    Then MailDeliveryAdapter.send は呼ばれない
    And notifications の 01J7O2 が send_result=SKIPPED に更新されメッセージは ACK される

  Scenario: 一時失敗を再配信し上限超過で DLQ に退避する
    Given notifications に notification_id=01J7O3, send_result=PENDING の行が存在する
    And MailDeliveryAdapter.send が一時失敗（TEMPORARY_FAILURE）を返し続ける
    When OverdueNoticeConsumer が MessageId=01J7O3 のメッセージを 6 回受信する
    Then 5 回目までは NACK され再配信間隔は 30s, 60s, 120s, 240s, 480s（+Jitter）である
    And 6 回目にメッセージは OverdueNoticeRequestedDead として notifications.overdue-notice-requested.dlq へ退避される
    And 退避メッセージのヘッダは attemptCount=6, lastFailureReason=TEMPORARY_FAILURE, originalChannel=notifications.overdue-notice-requested を持ち lastFailedAt が設定されている
    And notifications の 01J7O3 が send_result=FAILED, failure_reason=EXHAUSTED に更新される

  Scenario: 再発行スイープが未発行の送信待ち通知を発行する
    Given notifications に notification_type=OVERDUE_NOTICE, send_result=PENDING, requested_on=2026-09-03 の行が 2 件あり MQ に未発行である
    When OverdueNoticeSweepJob が対象日 2026-09-03 で起動する
    Then notifications.overdue-notice-requested に MessageId=各通知 ID のメッセージが 2 件発行される
```
