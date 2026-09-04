# 延滞を判定する - Backend API仕様

## 変更概要

本 UC はタイマー起動のため外部公開 API は追加しない。tier-worker の日次延滞判定バッチが呼ぶ内部ユースケース `DetectOverdueLoans` と、貸出 BC / 通知 BC の共有モジュール（domain `Loan.markOverdue` / `OverduePolicy`、repository、gateway）を Backend API 側のコードベースに追加する（arch SP-014 モジュラモノリス、LP-026 domain の共有）。

## API 仕様

外部公開 API なし（本 UC はタイマー UC）。延滞の参照は UC「延滞一覧を参照する」の `GET /api/v1/loans?status=OVERDUE` が担う。

### 内部ユースケース: DetectOverdueLoans

- **呼び出し元**: tier-worker `OverdueDetectionJob`
- **入力**: `DetectOverdueLoansCommand { asOf: date, chunkSize: int (既定 1000), traceId: string }`
- **出力**: `DetectOverdueLoansResult { targetCount, transitionedCount, createdCount, skippedCount, conflictCount, failedChunks }`
- **所属 BC**: 貸出コンテキスト（BC-003）が判定と状態遷移を、通知コンテキスト（BC-005）が通知レコード作成を担当。BC 間は公開インタフェース経由（LR-016）

#### リポジトリインタフェース（共有）

| メソッド | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `LoanRepository.findLoansForOverdue(asOf, cursor, chunkSize)` | date, string?, int | Loan[] + nextCursor | current_status = ON_LOAN かつ due_date < asOf を loan_id 昇順でチャンク取得（LR-018） |
| `LoanRepository.save(loan)` | Loan | void | loan_events INSERT + loans UPDATE（version 条件付き）。競合は `OptimisticLockConflict` をスロー（LP-013 / LR-008） |
| `UserRepository.findByNumber(userNumber)` | string | User | 送信先メールアドレスのコピー用（BC-002 の公開インタフェース） |
| `NotificationRepository.saveIfAbsent(notification)` | Notification | created: boolean | UNIQUE(target_loan_id, notification_type, requested_on) 違反時は false |
| `NotificationMessagePublisher.publishOverdueNoticeRequested(notification)` | Notification | void | MessageId = notification_id で発行（冪等） |

#### ドメインメソッド

| メソッド | 説明 |
|---------|------|
| `OverduePolicy.isOverdue(loan, asOf)` | 条件「延滞判定」: loan.status = 貸出中 かつ asOf > loan.dueDate |
| `Loan.markOverdue(asOf)` | 貸出中 → 延滞 の遷移。貸出中以外なら `IllegalLoanTransition`（LP-010 / LR-005）。`LoanOverdueEvent` を返す |
| `Loan.overdueDays(asOf)` | asOf − dueDate（督促本文用） |

## 非同期イベント

### OverdueNoticeRequested

- **チャネル**: `notifications.overdue-notice-requested`
- **方向**: publish（本 UC が発行。subscribe は UC「督促を送信する」）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notifications.overdue-notice-requested` を参照

| フィールド | 型 | 説明 |
|-----------|---|------|
| notificationId | string | 通知 ID（MessageId と同値） |
| notificationType | string | 固定値 `OVERDUE_NOTICE` |
| targetLoanId | string | 対象貸出 ID |
| userNumber | string | 送信先利用者番号 |
| requestedOn | string(date) | 送信予定日（バッチ対象日） |
| traceId | string | ジョブ実行 ID |

メッセージには氏名・メールアドレス・本文を含めない（送信時に通知レコードから読む）。スキーマ構造は `ReminderMailRequested` と同一。

## データモデル変更

### loans（情報: 貸出）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR(16) | 貸出の状態 enum: ON_LOAN（貸出中）・OVERDUE（延滞）・RETURNED（返却済み）。本 UC が ON_LOAN → OVERDUE に更新 | 変更なし |
| due_date | DATE | 返却期限。抽出条件 | 変更なし |
| version | INT | 楽観ロック用バージョン | 変更なし |
| updated_at | TIMESTAMP | スナップショット更新日時 | 変更なし |

### loan_events（情報: 貸出。履歴）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_event_id | VARCHAR(26) | イベント ID（PK） | 追加 |
| loan_id | VARCHAR(26) | 貸出 ID（loans への参照） | 追加 |
| event_type | VARCHAR(16) | enum: REGISTERED・OVERDUE・RETURNED。本 UC は `OVERDUE` | 追加 |
| occurred_at | TIMESTAMP | 発生日時 | 追加 |
| actor_user_number | VARCHAR(40) | 司書の利用者番号 または `system:{jobRunId}` | 追加 |
| from_status / to_status | VARCHAR(16) | 遷移前後の状態 | 追加 |
| INDEX(loan_id, occurred_at) | — | 貸出履歴の参照 | 追加 |

### notifications（情報: 通知）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_type / send_result / requested_on / target_loan_id / user_number / recipient_email / subject / body / sent_at | — | UC「リマインド対象を抽出する」で定義済み。本 UC は notification_type = OVERDUE_NOTICE（督促）、send_result = PENDING（送信待ち）で INSERT | 変更なし |

## ビジネスルール

- 条件「延滞判定」は domain `OverduePolicy` と `Loan.markOverdue` に一箇所だけ実装し、worker と API で二重実装しない（LP-026）
- 状態遷移は集約 root 経由（LR-006）。遷移表は状態.tsv「貸出の状態: 貸出中 → 延滞（延滞を判定する）」と 1:1（LP-010）
- 遷移の保存は楽観ロック（LP-013）。競合は usecase に `OptimisticLockConflict` として伝え、当該貸出をスキップする
- 通知レコードは送信待ちで作成し、送信結果の反映は UC「督促を送信する」の責務（LP-024）
- MQ 発行はトランザクションコミット後に行い、MessageId = 通知 ID で冪等にする（LP-014）
- 監査ログ: 貸出中 → 延滞 の遷移を actor = system（ジョブ実行 ID 付き）・貸出 ID・遷移前後の状態で記録する（LP-023）。氏名・連絡先は記録しない
- 延滞への遷移で書籍の状態は変えない（書籍は貸出中のまま）

## ティア完了条件（BDD）

```gherkin
Feature: 延滞を判定する - Backend API（共有モジュール）

  Scenario: OverduePolicy が期限超過の貸出を延滞と判定する
    Given 貸出「L-2001」が貸出中で返却期限が 2026-09-02 である
    When OverduePolicy.isOverdue(loan, asOf=2026-09-03) を評価する
    Then 結果は true である

  Scenario: OverduePolicy が返却期限当日の貸出を延滞と判定しない
    Given 貸出「L-2002」が貸出中で返却期限が 2026-09-03 である
    When OverduePolicy.isOverdue(loan, asOf=2026-09-03) を評価する
    Then 結果は false である

  Scenario: Loan.markOverdue が貸出中から延滞に遷移させる
    Given 貸出「L-2001」の状態が貸出中である
    When loan.markOverdue(asOf=2026-09-03) を呼ぶ
    Then loan.status が 延滞 になり LoanOverdueEvent{loanId: "L-2001", from: 貸出中, to: 延滞} が返る

  Scenario: Loan.markOverdue が返却済みからの遷移を拒否する
    Given 貸出「L-2005」の状態が返却済みである
    When loan.markOverdue(asOf=2026-09-03) を呼ぶ
    Then IllegalLoanTransition 例外がスローされる

  Scenario: LoanRepository.save が楽観ロック競合を検知する
    Given loans の L-2003 の version が 3 で、メモリ上の Loan の version が 2 である
    When LoanRepository.save(loan) を呼ぶ
    Then OptimisticLockConflict 例外がスローされ loans の行は更新されない
```
