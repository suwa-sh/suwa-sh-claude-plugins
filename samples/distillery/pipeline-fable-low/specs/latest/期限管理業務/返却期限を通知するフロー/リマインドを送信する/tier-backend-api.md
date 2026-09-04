# リマインドを送信する - Backend API仕様

## 変更概要

本 UC はタイマー（MQ コンシューマ）起動のため外部公開 API は追加しない。tier-worker の `ReminderMailConsumer` が呼ぶ内部ユースケース `SendReminderMail` と、通知 BC / 貸出 BC の共有モジュール（domain `Notification` の送信結果遷移、`ReminderPolicy.isStillTarget`、repository、gateway）を Backend API 側のコードベースに追加する（arch SP-014 モジュラモノリス、LP-026 domain の共有）。メール配信サービスへの送信は tier-external-integration の ACL アダプタ（`MailDeliveryAdapter`）を通知 BC のゲートウェイ実装として同梱する（CLP-014）。

## API 仕様

外部公開 API なし（本 UC はタイマー UC）。送信結果の参照は UC「延滞一覧を参照する」の `GET /api/v1/loans/{loanId}/notifications` が担う。

### 内部ユースケース: SendReminderMail

- **呼び出し元**: tier-worker `ReminderMailConsumer`（および日次リマインド送信バッチの再発行スイープ）
- **入力**: `SendReminderMailCommand { notificationId: string, traceId: string }`
- **出力**: `SendReminderMailResult { outcome: SENT | FAILED | SKIPPED | ALREADY_PROCESSED | NOT_FOUND, externalMessageId?: string }`。一時失敗は `RetryableDeliveryError` をスロー
- **所属 BC**: 通知コンテキスト（BC-005）が送信と送信結果の反映を、貸出コンテキスト（BC-003）が対象貸出の状態確認を担当。BC 間は公開インタフェース経由（LR-016）

#### リポジトリ / ゲートウェイインタフェース（共有）

| メソッド | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `NotificationRepository.findById(notificationId)` | string | Notification \| null | 通知レコードの取得 |
| `LoanRepository.findById(loanId)` | string | Loan \| null | 対象貸出の状態確認（BC-003 の公開インタフェース） |
| `BookRepository.findById(bookId)` | string | Book \| null | 本文の書籍タイトル（BC-001 の公開インタフェース） |
| `NotificationRepository.updateSendResultIfPending(notification)` | Notification | updated: boolean | `WHERE send_result='PENDING'` の条件付き UPDATE。更新件数 0 は false |
| `NotificationRepository.findPendingUnpublished(type, asOf)` | string, date | Notification[] | 送信待ちかつ requested_on <= asOf の通知（再発行スイープ用） |
| `MailDeliveryAdapter.send(request)` | {notificationId, recipientEmail, subject, body, idempotencyKey} | {result: SUCCESS \| TEMPORARY_FAILURE \| PERMANENT_FAILURE, externalMessageId?, reasonCode?} | tier-external-integration の ACL アダプタ。Retry + Circuit Breaker + Timeout（LP-040）。例外は結果型に変換して返す（LR-029） |

#### ドメインメソッド

| メソッド | 説明 |
|---------|------|
| `ReminderPolicy.isStillTarget(loan)` | 送信直前の再確認: loan.status = 貸出中 のとき true |
| `Notification.markSent(sentAt, externalMessageId)` | 送信待ち → 成功。送信待ち以外からは `IllegalNotificationTransition` |
| `Notification.markFailed(reasonCode)` | 送信待ち → 失敗（failure_reason を設定） |
| `Notification.markSkipped()` | 送信待ち → スキップ（対象貸出が貸出中でない） |

## 非同期イベント

### ReminderMailRequested

- **チャネル**: `notifications.reminder-mail-requested`
- **方向**: subscribe（本 UC が消費。publish は UC「リマインド対象を抽出する」）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notifications.reminder-mail-requested` を参照

| フィールド | 型 | 説明 |
|-----------|---|------|
| notificationId | string | 通知 ID（MessageId と同値） |
| notificationType | string | 固定値 `REMINDER` |
| targetLoanId | string | 対象貸出 ID |
| userNumber | string | 送信先利用者番号 |
| requestedOn | string(date) | 送信予定日 |
| traceId | string | ジョブ実行 ID |

再配信上限超過時の退避先: `notifications.reminder-mail-requested.dlq`（`ReminderMailRequestedDead`。ペイロードは同一、退避ヘッダ 4 項目を付与）。

## データモデル変更

### notifications（情報: 通知）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| send_result | VARCHAR(16) | 送信結果 enum: PENDING（送信待ち）・SUCCEEDED（成功）・FAILED（失敗）・SKIPPED（スキップ）。SKIPPED を追加（抽出後に対象外へ遷移した場合） | 変更 |
| sent_at | TIMESTAMP | 送信日時（成功時に設定） | 変更なし |
| failure_reason | VARCHAR(200) | 失敗理由コード（INVALID_RECIPIENT / REJECTED / AUTH_ERROR / EXHAUSTED 等）。個人情報を含めない | 追加 |
| external_message_id | VARCHAR(100) | メール配信サービスの外部メッセージ ID（成功時） | 追加 |
| INDEX(send_result, notification_type, requested_on) | — | 送信待ちの再発行スイープ | 追加 |

### loans / books

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loans.current_status / due_date | — | 送信直前の再確認と本文の残日数 | 変更なし |
| books.title | — | 本文の書籍名 | 変更なし |

## ビジネスルール

- 送信対象は通知種別「リマインド」かつ送信結果「送信待ち」の通知レコードのみ。送信直前に条件「リマインド対象判定」の貸出の状態 = 貸出中 を `ReminderPolicy.isStillTarget` で再確認する（LP-026: 判定ルールは domain に一箇所）
- 送信結果の遷移（PENDING → SUCCEEDED / FAILED / SKIPPED）は集約 root `Notification` のメソッド経由でのみ行い（LR-006）、永続化は `WHERE send_result='PENDING'` の条件付き UPDATE で二重反映を防ぐ
- 一時失敗は例外（`RetryableDeliveryError`）として worker に伝え再配信させる。恒久失敗（4xx・宛先不正・認証エラー）は再試行せず失敗として記録する（SR-018 / LR-028）
- ACL アダプタへの送信は通知 ID を冪等キーとして渡す（LR-019）。メール配信サービスの固有モデルは通知 BC の語彙（送信要求 / 送信結果）に翻訳し、domain へ持ち込まない（SP-027）
- 監査ログ: 通知レコードの更新はデータ更新として actor = system（MessageId / ジョブ実行 ID 付き）で記録する（LP-023 相当）。件名・本文・送信先はログに出力しない（CLR-006）
- 日次リマインド送信バッチ（`ReminderSendSweepJob`）は、抽出バッチの MQ 発行失敗で「送信待ちかつ未発行」のまま残った通知を `findPendingUnpublished(REMINDER, asOf)` で拾い、MessageId = 通知 ID で再発行する（既発行分は MQ 側の重複排除と KVS の既処理照合で読み飛ばされる）

## ティア完了条件（BDD）

```gherkin
Feature: リマインドを送信する - Backend API（共有モジュール）

  Scenario: ReminderPolicy が貸出中の貸出を送信対象と判定する
    Given 貸出「L-1001」の状態が貸出中である
    When ReminderPolicy.isStillTarget(loan) を評価する
    Then 結果は true である

  Scenario: ReminderPolicy が返却済みの貸出を送信対象外と判定する
    Given 貸出「L-1002」の状態が返却済みである
    When ReminderPolicy.isStillTarget(loan) を評価する
    Then 結果は false である

  Scenario: Notification.markSent が送信待ちから成功に遷移させる
    Given 通知「01J7R1」の送信結果が送信待ちである
    When notification.markSent(sentAt=2026-09-03T01:00:00Z, externalMessageId="ext-001") を呼ぶ
    Then notification.sendResult が SUCCEEDED、sentAt と externalMessageId が設定される

  Scenario: 送信待ち以外への markSent は拒否される
    Given 通知「01J7R1」の送信結果が成功である
    When notification.markSent(...) を呼ぶ
    Then IllegalNotificationTransition 例外がスローされる

  Scenario: 条件付き UPDATE が既処理を検知する
    Given notifications の 01J7R1 の send_result が SUCCEEDED である
    When NotificationRepository.updateSendResultIfPending に 01J7R1（失敗）を渡す
    Then 戻り値は false で行は更新されない

  Scenario: MailDeliveryAdapter が 5xx を一時失敗に翻訳する
    Given メール配信サービスが HTTP 503 を返す
    When MailDeliveryAdapter.send(idempotencyKey="01J7R3") を呼ぶ
    Then 結果は {result: TEMPORARY_FAILURE} で例外はスローされない
    And 依存関係ログに HTTP ステータス 503 が記録され、送信先・本文は含まれない
```
