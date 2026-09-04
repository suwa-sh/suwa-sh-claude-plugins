# リマインド対象を抽出する - ワーカー仕様

## 変更概要

日次 CronJob「日次リマインド抽出バッチ」を tier-worker に追加する。ジョブハンドラ（presentation）が対象日を決めて usecase を呼び、共有モジュール（tier-backend-api の domain / repository / gateway）でリマインド対象を判定し、通知レコード（送信待ち）の作成と `ReminderMailRequested` の MQ 発行を行う。メール送信は行わない。

## イベント処理仕様

### ReminderExtractionJob（日次リマインド抽出バッチ）

- **トリガー**: スケジュール（日次。夜間〜早朝の 8 時間枠内、バックアップ時間帯 1 時〜4 時と計画停止枠 8 時〜9 時を避ける。arch SP-019）
- **入力チャネル**: なし（CronJob）
- **出力チャネル**: `notifications.reminder-mail-requested`（ReminderMailRequested を publish）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notifications.reminder-mail-requested` を参照

#### 処理フロー

1. ジョブ実行 ID を採番し trace_id として採用する（LP-019）。対象日 asOf = 実行日（引数で上書き可。再実行用）
2. 既処理照合: 対象日 asOf を KVS `lock:job:reminder-extraction:{asOf}` で照合し、完了済みなら（ジョブ実行 ID が異なっても）正常終了として読み飛ばす（LR-014）。完了時に同キーへ「完了フラグ + 完了させたジョブ実行 ID + 件数サマリ」を書き込む。通知レコードの重複作成防止は notifications の一意制約（target_loan_id × notification_type × requested_on）が担い、本照合は再実行スキップ用途である
3. 開始サマリログを INFO で出力する（LP-020）
4. usecase `ExtractReminderTargets(asOf, chunkSize=1000)` を呼ぶ
   1. asOf 時点で有効なリマインド日数を取得する（無ければ `REMIND_DAYS_NOT_FOUND` で異常終了）
   2. `LoanRepository.findLoansForReminder(asOf, remindDays, cursor, chunkSize)` でチャンク抽出する（LR-018）
   3. 各貸出に `ReminderPolicy.isTarget(loan, asOf)` を適用し、対象なら通知レコード（通知種別 = リマインド、送信結果 = 送信待ち、requested_on = asOf、送信先 = 利用者の現在のメールアドレス、件名 / 本文 = リマインドテンプレート）を INSERT する
   4. チャンク単位で COMMIT する（LP-022）
   5. コミット後に通知 ID ごとに `ReminderMailRequested` を publish する（MessageId = 通知 ID。LP-029 相当の冪等発行）
5. 終了サマリログ（対象件数 / 作成件数 / 既存スキップ件数 / 失敗チャンク数 / 処理時間）とメトリクスを出力する（SP-021）
6. 失敗チャンクが 1 件以上あれば異常終了コードで終了する（再実行で未処理分のみ処理される）

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| リマインド日数の有効世代なし（REMIND_DAYS_NOT_FOUND） | No | No | ジョブを異常終了し、アラート対象とする。運用が設定を登録後に再実行する |
| RDB 一時障害（チャンク内） | Yes（チャンク単位で最大 3 回、指数バックオフ） | No | 上限超過はチャンク失敗として記録し次チャンクへ進む（LR-015）。ジョブは異常終了コードで終了し再実行で回収する |
| 通知レコードの一意制約違反 | No | No | 既処理として読み飛ばし、既存スキップ件数に計上する（SR-013） |
| MQ 発行失敗 | Yes（gateway で最大 3 回） | No | 上限超過は WARN の劣化兆候ログを出力し、通知レコードは送信待ちのまま残す。次回実行時に「送信待ちかつ未発行」の通知を再発行する（再発行は MessageId = 通知 ID で冪等） |
| SIGTERM 受信（スポット中断） | Yes（次回スケジュールで再実行） | No | 処理中チャンクをロールバックして終了する（SP-030）。再実行時は通知レコードで既処理を判定する |

## データモデル変更

### notifications（情報: 通知）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_id | VARCHAR(26) | 通知 ID（ULID。MQ の MessageId と一致） | 追加（本 UC で INSERT） |
| notification_type | VARCHAR(16) | 通知種別 enum: RETURN_NOTICE（返却通知）・REMINDER（リマインド）・OVERDUE_NOTICE（督促）。本 UC は REMINDER | 追加 |
| send_result | VARCHAR(16) | 送信結果 enum: PENDING（送信待ち）・SUCCEEDED（成功）・FAILED（失敗）。本 UC は PENDING で作成。arch E-008 の enum（成功・失敗）に PENDING（送信待ち）を追加 | 変更 |
| requested_on | DATE | 送信予定日（バッチの対象日 asOf）。重複送信防止キーの一部 | 追加 |
| target_loan_id | VARCHAR(26) | 対象貸出 ID | 追加 |
| user_number | VARCHAR(20) | 送信先利用者番号 | 追加 |
| recipient_email | VARCHAR(254) | 送信先メールアドレス（作成時点の値のコピー） | 追加 |
| subject / body | VARCHAR(200) / TEXT | 件名 / 本文（テンプレートから生成） | 追加 |
| sent_at | TIMESTAMP | 送信日時（送信待ちの間は NULL。arch E-008 の nullable=false を緩和） | 変更 |
| UNIQUE(target_loan_id, notification_type, requested_on) | — | 重複送信防止の一意キー（SR-013） | 追加 |

## ビジネスルール

- 条件「リマインド対象判定」: 貸出の状態が「貸出中」で未返却、かつ返却期限までの残日数がリマインド日数以内（0 以上）の貸出のみ対象とする。延滞（残日数が負）は対象外（督促の責務）
- リマインド日数は asOf 時点の有効世代（valid_from <= asOf AND (valid_to IS NULL OR valid_to >= asOf)）を使う（SR-012 / LR-008）。domain は自らパラメータを取得しない
- 抽出と送信を分離する。本ジョブは通知レコード（送信待ち）の作成と MQ 発行までを責務とし、メール送信は UC「リマインドを送信する」が行う（LP-022）
- 同一貸出 × リマインド × 同一対象日の通知レコードは 1 件のみ。再実行・多重起動でも重複作成しない（SR-013 / SR-014）
- 1 回あたり〜10 万件を 8 時間枠内で処理する（NFR B.1.1.4 / B.2.2.1）。チャンクサイズ 1,000 件、全件をメモリに載せない
- 件ごとの逐次ログは出力しない。サマリログとメトリクスのみ（LP-020）。ログに氏名・メールアドレス・本文を出力しない

## ティア完了条件（BDD）

```gherkin
Feature: リマインド対象を抽出する - ワーカー

  Scenario: 対象貸出から通知レコードを作成し MQ に発行する
    Given リマインド日数の有効値が 3 日である
    And 貸出「L-1001」（利用者「U-0001」、返却期限 2026-09-05、貸出中）が存在する
    When ReminderExtractionJob が対象日 2026-09-03 で起動する
    Then notifications に notification_type=REMINDER, send_result=PENDING, target_loan_id=L-1001, requested_on=2026-09-03 の行が 1 件 INSERT される
    And MQ チャネル "notifications.reminder-mail-requested" に MessageId=通知 ID のメッセージが 1 件発行される
    And 終了サマリログに {targetCount: 1, createdCount: 1, skippedCount: 0, failedChunks: 0} が出力される

  Scenario: 既処理のジョブ実行を読み飛ばす
    Given 対象日 2026-09-03 が完了済みとして KVS キー "lock:job:reminder-extraction:2026-09-03" に記録されている
    When 別のジョブ実行 ID「job-20260903-99」で ReminderExtractionJob が同じ対象日に対して再起動する
    Then usecase は呼ばれず正常終了する
    And INFO ログ「already processed」が出力される

  Scenario: チャンク失敗時に次チャンクへ進む
    Given 貸出中の貸出が 2,500 件存在しチャンクサイズが 1,000 件である
    And 2 チャンク目の INSERT で RDB 接続エラーが 3 回連続で発生する
    When ReminderExtractionJob が起動する
    Then 1 チャンク目と 3 チャンク目の通知レコードは作成される
    And 終了サマリログに failedChunks: 1 が出力され終了コードは 1 である
```
