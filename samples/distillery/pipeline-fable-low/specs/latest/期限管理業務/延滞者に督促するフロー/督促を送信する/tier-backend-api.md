# 督促を送信する - Backend API仕様

## 変更概要

本 UC はタイマー（MQ コンシューマ）起動のため外部公開 API は追加しない。tier-worker の `OverdueNoticeConsumer` が呼ぶ内部ユースケース `SendOverdueNotice` と、通知 BC / 貸出 BC の共有モジュール（domain `Notification` の送信結果遷移、`OverduePolicy.isStillOverdue`、repository、gateway）を Backend API 側のコードベースに追加する（arch SP-014、LP-026）。`SendReminderMail`（UC「リマインドを送信する」）と同じ送信ユースケース基底を共有し、通知種別・テンプレート・再確認ポリシーをストラテジーで切り替える（LP-012）。

## API 仕様

外部公開 API なし（本 UC はタイマー UC）。送信結果の参照は UC「延滞一覧を参照する」の `GET /api/v1/loans?status=OVERDUE&include=latestNotice` と `GET /api/v1/loans/{loanId}/notifications` が担う。

### 内部ユースケース: SendOverdueNotice

- **呼び出し元**: tier-worker `OverdueNoticeConsumer`（および `OverdueNoticeSweepJob` の再発行）
- **入力**: `SendOverdueNoticeCommand { notificationId: string, traceId: string }`
- **出力**: `SendOverdueNoticeResult { outcome: SENT | FAILED | SKIPPED | ALREADY_PROCESSED | NOT_FOUND, externalMessageId?: string }`。一時失敗は `RetryableDeliveryError` をスロー
- **所属 BC**: 通知コンテキスト（BC-005）が送信と送信結果の反映を、貸出コンテキスト（BC-003）が対象貸出の状態確認を担当。BC 間は公開インタフェース経由（LR-016）

#### リポジトリ / ゲートウェイインタフェース（共有）

| メソッド | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `NotificationRepository.findById(notificationId)` | string | Notification \| null | 通知レコードの取得 |
| `LoanRepository.findById(loanId)` | string | Loan \| null | 対象貸出の状態確認（BC-003 の公開インタフェース） |
| `BookRepository.findById(bookId)` | string | Book \| null | 本文の書籍タイトル（BC-001 の公開インタフェース） |
| `NotificationRepository.updateSendResultIfPending(notification)` | Notification | updated: boolean | `WHERE send_result='PENDING'` の条件付き UPDATE |
| `NotificationRepository.findPendingUnpublished(type, asOf)` | string, date | Notification[] | 送信待ちかつ requested_on <= asOf の通知（再発行スイープ用） |
| `NotificationMessagePublisher.publishOverdueNoticeRequested(notification)` | Notification | void | 再発行（MessageId = 通知 ID。冪等） |
| `MailDeliveryAdapter.send(request)` | {notificationId, recipientEmail, subject, body, idempotencyKey} | {result: SUCCESS \| TEMPORARY_FAILURE \| PERMANENT_FAILURE, externalMessageId?, reasonCode?} | tier-external-integration の ACL アダプタ（LP-040 / LR-029） |

#### ドメインメソッド

| メソッド | 説明 |
|---------|------|
| `OverduePolicy.isStillOverdue(loan)` | 送信直前の再確認: loan.status = 延滞 のとき true |
| `Notification.markSent(sentAt, externalMessageId)` / `markFailed(reasonCode)` / `markSkipped()` | 送信待ち → 成功 / 失敗 / スキップ。送信待ち以外からは `IllegalNotificationTransition`（UC「リマインドを送信する」と共有） |

## 非同期イベント

### OverdueNoticeRequested

- **チャネル**: `notifications.overdue-notice-requested`
- **方向**: subscribe（本 UC が消費。publish は UC「延滞を判定する」。再発行スイープでは本 UC も publish する）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notifications.overdue-notice-requested` を参照

| フィールド | 型 | 説明 |
|-----------|---|------|
| notificationId | string | 通知 ID（MessageId と同値） |
| notificationType | string | 固定値 `OVERDUE_NOTICE` |
| targetLoanId | string | 対象貸出 ID |
| userNumber | string | 送信先利用者番号 |
| requestedOn | string(date) | 送信予定日 |
| traceId | string | ジョブ実行 ID |

再配信上限超過時の退避先: `notifications.overdue-notice-requested.dlq`（`OverdueNoticeRequestedDead`。ペイロードは同一、退避ヘッダ 4 項目を付与）。

## データモデル変更

### notifications（情報: 通知）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| send_result / sent_at / failure_reason / external_message_id | — | UC「リマインドを送信する」で定義済み。本 UC は notification_type = OVERDUE_NOTICE（督促）の行を PENDING → SUCCEEDED / FAILED / SKIPPED に更新する | 変更なし |
| INDEX(send_result, notification_type, requested_on) | — | 送信待ちの再発行スイープ（同上で追加済み） | 変更なし |

### loans / books

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loans.current_status / due_date | — | 送信直前の再確認と本文の延滞日数 | 変更なし |
| books.title | — | 本文の書籍名 | 変更なし |

## ビジネスルール

- 送信対象は通知種別「督促」かつ送信結果「送信待ち」の通知レコードのみ。送信直前に条件「延滞判定」の貸出の状態 = 延滞 を `OverduePolicy.isStillOverdue` で再確認する（LP-026）
- 送信結果の遷移は集約 root `Notification` のメソッド経由（LR-006）。永続化は条件付き UPDATE で二重反映を防ぐ
- 一時失敗は `RetryableDeliveryError` として worker に伝え再配信させる。恒久失敗は再試行せず失敗として記録する（SR-018 / LR-028）
- ACL アダプタへの送信は通知 ID を冪等キーとして渡す（LR-019）。メール配信サービスの固有モデルを domain へ持ち込まない（SP-027）
- 監査ログ: 通知レコードの更新はデータ更新として actor = system（MessageId / ジョブ実行 ID 付き）で記録する。件名・本文・送信先はログに出力しない（CLR-006）
- 督促テンプレートは書籍名・返却期限・延滞日数（送信日 − 返却期限）を含める。テンプレートの文言は運用で確定する（設定データ化）

## ティア完了条件（BDD）

```gherkin
Feature: 督促を送信する - Backend API（共有モジュール）

  Scenario: OverduePolicy が延滞の貸出を送信対象と判定する
    Given 貸出「L-2001」の状態が延滞である
    When OverduePolicy.isStillOverdue(loan) を評価する
    Then 結果は true である

  Scenario: OverduePolicy が返却済みの貸出を送信対象外と判定する
    Given 貸出「L-2002」の状態が返却済みである
    When OverduePolicy.isStillOverdue(loan) を評価する
    Then 結果は false である

  Scenario: Notification.markFailed が送信待ちから失敗に遷移させる
    Given 通知「01J7O4」の送信結果が送信待ちである
    When notification.markFailed(reasonCode="INVALID_RECIPIENT") を呼ぶ
    Then notification.sendResult が FAILED、failureReason が "INVALID_RECIPIENT" になる

  Scenario: 条件付き UPDATE が既処理を検知する
    Given notifications の 01J7O1 の send_result が SUCCEEDED である
    When NotificationRepository.updateSendResultIfPending に 01J7O1（失敗）を渡す
    Then 戻り値は false で行は更新されない

  Scenario: findPendingUnpublished が送信待ちの督促を返す
    Given notifications に notification_type=OVERDUE_NOTICE, send_result=PENDING, requested_on=2026-09-02 の行が 2 件、send_result=SUCCEEDED の行が 1 件ある
    When NotificationRepository.findPendingUnpublished(督促, asOf=2026-09-03) を呼ぶ
    Then 送信待ちの 2 件のみが返る
```
