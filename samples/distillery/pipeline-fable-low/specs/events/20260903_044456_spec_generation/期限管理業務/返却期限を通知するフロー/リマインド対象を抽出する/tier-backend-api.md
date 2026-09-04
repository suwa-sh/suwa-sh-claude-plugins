# リマインド対象を抽出する - Backend API仕様

## 変更概要

本 UC はタイマー起動のため外部公開 API は追加しない。tier-worker の日次リマインド抽出バッチが呼ぶ内部ユースケース `ExtractReminderTargets` と、貸出 BC / 通知 BC の共有モジュール（domain / repository / gateway）を Backend API 側のコードベースに追加する（arch SP-014 モジュラモノリス、LP-026 domain の共有）。

## API 仕様

外部公開 API なし（本 UC はタイマー UC）。

### 内部ユースケース: ExtractReminderTargets

- **呼び出し元**: tier-worker `ReminderExtractionJob`
- **入力**: `ExtractReminderTargetsCommand { asOf: date, chunkSize: int (既定 1000), traceId: string }`
- **出力**: `ExtractReminderTargetsResult { targetCount, createdCount, skippedCount, failedChunks }`
- **所属 BC**: 貸出コンテキスト（BC-003）が抽出を、通知コンテキスト（BC-005）が通知レコード作成を担当。BC 間は公開インタフェース経由（LR-016）

#### リポジトリインタフェース（共有）

| メソッド | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `RemindDaysRepository.findEffective(asOf)` | date | RemindDays \| null | asOf 時点の有効世代（valid_from <= asOf AND (valid_to IS NULL OR valid_to >= asOf)） |
| `LoanRepository.findLoansForReminder(asOf, remindDays, cursor, chunkSize)` | date, int, string?, int | Loan[] + nextCursor | current_status = ON_LOAN かつ asOf <= due_date <= asOf + remindDays を loan_id 昇順でチャンク取得（LR-018） |
| `NotificationRepository.saveIfAbsent(notification)` | Notification | created: boolean | UNIQUE(target_loan_id, notification_type, requested_on) 違反時は false を返す |
| `NotificationMessagePublisher.publishReminderMailRequested(notification)` | Notification | void | MessageId = notification_id で発行（冪等） |

## 非同期イベント

### ReminderMailRequested

- **チャネル**: `notifications.reminder-mail-requested`
- **方向**: publish（本 UC が発行。subscribe は UC「リマインドを送信する」）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notifications.reminder-mail-requested` を参照

| フィールド | 型 | 説明 |
|-----------|---|------|
| notificationId | string | 通知 ID（MessageId と同値） |
| notificationType | string | 固定値 `REMINDER` |
| targetLoanId | string | 対象貸出 ID |
| userNumber | string | 送信先利用者番号 |
| requestedOn | string(date) | 送信予定日（バッチ対象日） |
| traceId | string | ジョブ実行 ID |

メッセージには氏名・メールアドレス・本文を含めない（送信時に通知レコードから読む）。

## データモデル変更

### notifications（情報: 通知）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_id | VARCHAR(26) | 通知 ID（PK） | 追加 |
| user_number | VARCHAR(20) | 利用者番号（users への参照） | 追加 |
| notification_type | VARCHAR(16) | 通知種別 enum: RETURN_NOTICE（返却通知）・REMINDER（リマインド）・OVERDUE_NOTICE（督促） | 追加 |
| recipient_email | VARCHAR(254) | 送信先メールアドレス（作成時点のコピー。保管時暗号化対象） | 追加 |
| subject | VARCHAR(200) | 件名 | 追加 |
| body | TEXT | 本文（保管時暗号化対象） | 追加 |
| requested_on | DATE | 送信予定日 | 追加 |
| sent_at | TIMESTAMP | 送信日時（NULL = 未送信） | 追加 |
| send_result | VARCHAR(16) | 送信結果 enum: PENDING（送信待ち）・SUCCEEDED（成功）・FAILED（失敗） | 追加 |
| target_loan_id | VARCHAR(26) | 対象貸出 ID（loans への参照。返却通知では NULL） | 追加 |
| target_reservation_id | VARCHAR(26) | 対象予約 ID（返却通知のみ。本 UC は NULL） | 追加 |
| UNIQUE(target_loan_id, notification_type, requested_on) | — | 重複送信防止（SR-013） | 追加 |

### loans（情報: 貸出）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR(16) | 貸出の状態 enum: ON_LOAN（貸出中）・OVERDUE（延滞）・RETURNED（返却済み）。本 UC は参照のみ | 変更なし |
| due_date | DATE | 返却期限。本 UC の抽出条件 | 変更なし |
| INDEX(current_status, due_date) | — | 貸出中 × 返却期限範囲の日次走査（〜10 万件） | 追加 |

### remind_days_settings（情報: リマインド日数）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| remind_days_id | VARCHAR(26) | 世代 ID（PK） | 変更なし |
| remind_days | INT | リマインド日数 | 変更なし |
| valid_from / valid_to | DATE / DATE | 適用期間（現行世代は valid_to NULL） | 変更なし |

## ビジネスルール

- 条件「リマインド対象判定」は domain `ReminderPolicy` に一箇所だけ実装し、worker と API で二重実装しない（LP-026）
- 業務パラメータ（リマインド日数）は usecase が repository から asOf 時点の有効値を取得して domain に渡す（LR-008）
- 通知レコードは送信待ちで作成し、送信結果の反映はワーカー（UC「リマインドを送信する」）の責務（LP-011 相当）
- MQ 発行はトランザクションコミット後に行い、MessageId = 通知 ID で冪等にする（LP-029）
- 監査ログ: 本 UC は状態遷移を伴わないため監査ログは不要。通知レコード作成はデータ更新として actor = system（ジョブ実行 ID 付き）で記録する（LP-023）

## ティア完了条件（BDD）

```gherkin
Feature: リマインド対象を抽出する - Backend API（共有モジュール）

  Scenario: ReminderPolicy が残日数以内の貸出を対象と判定する
    Given リマインド日数が 3 日である
    And 貸出「L-1001」が貸出中で返却期限が 2026-09-06 である
    When ReminderPolicy.isTarget(loan, asOf=2026-09-03) を評価する
    Then 結果は true である

  Scenario: ReminderPolicy が延滞の貸出を対象外と判定する
    Given リマインド日数が 3 日である
    And 貸出「L-1003」が貸出中で返却期限が 2026-09-01 である
    When ReminderPolicy.isTarget(loan, asOf=2026-09-03) を評価する
    Then 結果は false である

  Scenario: 同一キーの通知レコードは作成されない
    Given notifications に target_loan_id=L-1001, notification_type=REMINDER, requested_on=2026-09-03 の行が存在する
    When NotificationRepository.saveIfAbsent に同一キーの通知を渡す
    Then 戻り値は false で行数は増えない

  Scenario: ReminderMailRequested を通知 ID を MessageId として発行する
    Given 通知 ID「01J7…AB」の送信待ち通知レコードが存在する
    When NotificationMessagePublisher.publishReminderMailRequested を呼ぶ
    Then チャネル "notifications.reminder-mail-requested" に MessageId="01J7…AB" のメッセージが 1 件発行される
```
