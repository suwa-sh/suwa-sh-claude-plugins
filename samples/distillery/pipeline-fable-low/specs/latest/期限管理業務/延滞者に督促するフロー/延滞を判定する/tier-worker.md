# 延滞を判定する - ワーカー仕様

## 変更概要

日次 CronJob「日次延滞判定バッチ」（`OverdueDetectionJob`）を tier-worker に追加する。ジョブハンドラ（presentation）が対象日を決めて usecase を呼び、共有モジュール（tier-backend-api の domain / repository / gateway）で延滞を判定して貸出の状態を「延滞」に遷移させ、通知レコード（督促・送信待ち）の作成と `OverdueNoticeRequested` の MQ 発行を行う。メール送信は行わない。構造は UC「リマインド対象を抽出する」の `ReminderExtractionJob` と揃える。

## イベント処理仕様

### OverdueDetectionJob（日次延滞判定バッチ）

- **トリガー**: スケジュール（日次。夜間〜早朝の 8 時間枠内、バックアップ時間帯 1 時〜4 時と計画停止枠 8 時〜9 時を避ける。日次リマインド抽出バッチの後に起動する。arch SP-019）
- **入力チャネル**: なし（CronJob）
- **出力チャネル**: `notifications.overdue-notice-requested`（OverdueNoticeRequested を publish）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notifications.overdue-notice-requested` を参照

#### 処理フロー

1. ジョブ実行 ID を採番し trace_id として採用する（LP-019）。対象日 asOf = 実行日（引数で上書き可。再実行用）
2. 既処理照合: 対象日 asOf を KVS `lock:job:overdue-detection:{asOf}` で照合し、完了済みなら（ジョブ実行 ID が異なっても）正常終了として読み飛ばす（LR-014）。完了時に同キーへ「完了フラグ + 完了させたジョブ実行 ID + 件数サマリ」を書き込む。通知レコードの重複作成防止は notifications の一意制約（target_loan_id × notification_type × requested_on）が担い、本照合は再実行スキップ用途である
3. 開始サマリログを INFO で出力する（LP-020）
4. usecase `DetectOverdueLoans(asOf, chunkSize=1000)` を呼ぶ
   1. `LoanRepository.findLoansForOverdue(asOf, cursor, chunkSize)` でチャンク抽出する（current_status = ON_LOAN かつ due_date < asOf。LR-018）
   2. 各貸出に `OverduePolicy.isOverdue(loan, asOf)` を適用し、延滞なら `loan.markOverdue(asOf)` で 貸出中 → 延滞 に遷移させ `LoanRepository.save` で永続化する（loan_events INSERT + loans UPDATE、楽観ロック。LR-008 / LP-013）
   3. 遷移を監査ログに記録する（actor = system + ジョブ実行 ID、貸出 ID、貸出中 → 延滞。LP-023）
   4. 通知レコード（通知種別 = 督促、送信結果 = 送信待ち、requested_on = asOf、送信先 = 利用者の現在のメールアドレス、件名 / 本文 = 督促テンプレート）を `NotificationRepository.saveIfAbsent` で INSERT する
   5. チャンク単位で COMMIT する（LP-022）
   6. コミット後に通知 ID ごとに `OverdueNoticeRequested` を publish する（MessageId = 通知 ID。LP-014）
5. 終了サマリログ（対象件数 / 遷移件数 / 通知作成件数 / 既存スキップ件数 / 競合スキップ件数 / 失敗チャンク数 / 処理時間）とメトリクスを出力し、KVS に完了を記録する（SP-021）
6. 失敗チャンクが 1 件以上あれば異常終了コードで終了する（再実行で未処理分のみ処理される）

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| 楽観ロック競合（返却登録と同時） | No | No | 当該貸出をスキップし競合スキップ件数に計上、WARN ログ（LP-018）。次回実行時は返却済みのため抽出されない |
| RDB 一時障害（チャンク内） | Yes（チャンク単位で最大 3 回、指数バックオフ） | No | 上限超過はチャンク失敗として記録し次チャンクへ進む（LR-015）。ジョブは異常終了コードで終了し再実行で回収する |
| 通知レコードの一意制約違反 | No | No | 既処理として読み飛ばし、既存スキップ件数に計上する（SR-013） |
| MQ 発行失敗 | Yes（gateway で最大 3 回） | No | 上限超過は WARN の劣化兆候ログを出力し、通知レコードは送信待ちのまま残す。UC「督促を送信する」の日次送信バッチが「送信待ちかつ未発行」の通知を再発行する（MessageId = 通知 ID で冪等） |
| SIGTERM 受信（スポット中断） | Yes（次回スケジュールで再実行） | No | 処理中チャンクをロールバックして終了する（SP-030）。再実行時は貸出の状態と通知レコードで既処理を判定する |

## データモデル変更

### loans（情報: 貸出）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR(16) | 貸出の状態。本 UC が ON_LOAN（貸出中）→ OVERDUE（延滞）に UPDATE する | 変更なし（値の遷移を追加） |
| version | INT | 楽観ロック。UPDATE 時に +1 | 変更なし |
| INDEX(current_status, due_date) | — | 貸出中 × 返却期限超過の日次走査（UC「リマインド対象を抽出する」で追加済み） | 変更なし |

### loan_events（情報: 貸出。event_snapshot の履歴側）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_event_id | VARCHAR(26) | イベント ID（PK、ULID） | 追加 |
| loan_id | VARCHAR(26) | 貸出 ID | 追加 |
| event_type | VARCHAR(16) | イベント種別。本 UC は `OVERDUE`（延滞） | 追加（値） |
| occurred_at | TIMESTAMP | 発生日時（asOf の判定時刻） | 追加 |
| actor_user_number | VARCHAR(40) | 実行者。本 UC は `system:{jobRunId}` | 追加 |
| from_status / to_status | VARCHAR(16) | 貸出中 / 延滞 | 追加 |

### notifications（情報: 通知）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_type | VARCHAR(16) | 本 UC は OVERDUE_NOTICE（督促）で作成 | 変更なし |
| send_result | VARCHAR(16) | 本 UC は PENDING（送信待ち）で作成 | 変更なし |
| requested_on / target_loan_id / user_number / recipient_email / subject / body | — | UC「リマインド対象を抽出する」と同じ列定義。件名 / 本文は督促テンプレート（書籍名・返却期限・延滞日数） | 変更なし |
| UNIQUE(target_loan_id, notification_type, requested_on) | — | 重複送信防止（SR-013） | 変更なし |

## ビジネスルール

- 条件「延滞判定」: 貸出の状態が「貸出中」で未返却、かつ対象日 asOf が返却期限を超過（asOf > 返却期限）している貸出を延滞とし、貸出の状態を「延滞」に遷移させて通知種別「督促」の送信対象とする。返却期限当日は延滞ではない
- 遷移は集約 root `Loan.markOverdue` 経由でのみ行う（LR-006）。貸出中以外からの遷移はドメイン例外（LP-010）
- 判定ルールは domain `OverduePolicy` に一箇所だけ実装し、worker と API で二重実装しない（LP-026）
- 督促は延滞への遷移時に 1 回作成する。継続延滞への再督促の周期は RDRA に定義が無いため本 UC では行わない（todo に確認事項として登録）
- 抽出・遷移・通知作成と送信を分離する。本ジョブはメール送信を行わない（LP-022）
- 同一貸出 × 督促 × 同一対象日の通知レコードは 1 件のみ。再実行・多重起動でも重複作成しない（SR-013 / SR-014）
- 1 回あたり〜10 万件を 8 時間枠内で処理する（NFR B.1.1.4 / B.2.2.1）。チャンクサイズ 1,000 件、全件をメモリに載せない
- 件ごとの逐次ログは出力しない。サマリログとメトリクスのみ（LP-020）。ログに氏名・メールアドレス・本文を出力しない（CLR-006）

## ティア完了条件（BDD）

```gherkin
Feature: 延滞を判定する - ワーカー

  Scenario: 期限超過の貸出を延滞に遷移させ通知レコードを作成し MQ に発行する
    Given loans に loan_id=L-2001, user_number=U-0001, due_date=2026-09-02, current_status=ON_LOAN, version=3 の行が存在する
    When OverdueDetectionJob が対象日 2026-09-03 で起動する
    Then loans の L-2001 が current_status=OVERDUE, version=4 に更新され loan_events に event_type=OVERDUE の行が 1 件 INSERT される
    And notifications に notification_type=OVERDUE_NOTICE, send_result=PENDING, target_loan_id=L-2001, requested_on=2026-09-03 の行が 1 件 INSERT される
    And MQ チャネル "notifications.overdue-notice-requested" に MessageId=通知 ID のメッセージが 1 件発行される
    And 終了サマリログに {targetCount: 1, transitionedCount: 1, createdCount: 1, skippedCount: 0, conflictCount: 0, failedChunks: 0} が出力される

  Scenario: 既処理のジョブ実行を読み飛ばす
    Given 対象日 2026-09-03 が完了済みとして KVS キー "lock:job:overdue-detection:2026-09-03" に記録されている
    When 別のジョブ実行 ID「job-20260903-99」で OverdueDetectionJob が同じ対象日に対して再起動する
    Then usecase は呼ばれず正常終了する
    And INFO ログ「already processed」が出力される

  Scenario: 楽観ロック競合の貸出をスキップして続行する
    Given loans に current_status=ON_LOAN, due_date=2026-09-01 の L-2003（version=2）と L-2004（version=1）が存在する
    And L-2003 は抽出後に返却登録で version=3, current_status=RETURNED に更新される
    When OverdueDetectionJob が対象日 2026-09-03 で起動する
    Then L-2003 は競合スキップされ WARN ログ「optimistic lock conflict」が出力される
    And L-2004 は延滞に遷移し通知レコードが作成される
    And 終了サマリログに conflictCount: 1 が出力され終了コードは 0 である
```
