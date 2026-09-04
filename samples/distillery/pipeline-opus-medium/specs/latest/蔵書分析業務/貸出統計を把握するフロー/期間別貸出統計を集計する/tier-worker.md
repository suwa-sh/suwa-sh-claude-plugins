# 期間別貸出統計を集計する - バックエンドワーカー仕様

## 変更概要

`report.aggregation.requested` を消費し、`report_type` が `期間別貸出統計` / `人気書籍ランキング` のメッセージについて期間内の貸出を集計するコンシューマを追加する。貸出件数の推移・書籍別貸出回数ランキング・利用者区分別／ジャンル別内訳を集計明細へ書き込み、統計レポート状態を「作成済み」または「実績なし」へ遷移させる。

## イベント処理仕様

### LoanStatsReportAggregationConsumer

- **トリガー**: `report.aggregation.requested` への `LoanStatsReportAggregationRequested` メッセージ到着（`report_type` が `期間別貸出統計` / `人気書籍ランキング` のもののみ処理する）
- **入力チャネル**: `report.aggregation.requested`
- **出力チャネル**: なし（結果は RDB の `statistical_reports` に永続化する）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.report.aggregation.requested` を参照
- **ペイロードスキーマ**: `ReportAggregationRequestedPayload`（AsyncAPI `components.schemas.ReportAggregationRequestedPayload.title` と同名。契約生成の型名の正本であり、業務的意味が変わらない限り改名しない）
- **ヘッダースキーマ**: `MessageHeaders`（全非同期メッセージ共通のヘッダー）

#### 処理フロー

1. メッセージをデシリアライズし、`message_id` で重複消費を検知する（arch SR-018）。処理済みならスキップする
2. `trace_id` を引き継ぎ、新しい span を開始する（arch SR-019）
3. `report_id` で統計レポートを取得し、`report_status='集計中'` であることを確認する。それ以外なら ACK してスキップする
4. `SELECT loan_id, book_id, user_no, loan_date, loan_status FROM loans WHERE loan_date BETWEEN :period_start AND :period_end` で対象貸出を取得する
5. 対象貸出が 0 件なら統計レポート状態を「実績なし」に設定して 11 へ進む
6. 集計期間区分（日次／月次／年次）の粒度で `loan_date` を丸め、期間ごとの貸出件数を時間順に並べる。貸出が 0 件の期間も 0 件の枠として出力する
7. `book_id` ごとに貸出回数を集計して降順に並べ、上位 20 件を人気書籍ランキングとする。同数は `book_id` の昇順で安定化する
8. 期間内貸出の DISTINCT `book_id` 全件について `SELECT book_id, title, author, genre FROM books WHERE book_id IN (:period_book_ids)` で書誌情報とジャンルを取得する（ジャンル別内訳は期間内貸出全件を対象とするため全件取得する。人気書籍ランキングの表示は取得結果のうち上位 20 件に絞る）
9. 期間内貸出の DISTINCT `user_no` について `SELECT user_no, user_category FROM users WHERE user_no IN (:period_user_nos)` で利用者区分を取得する（利用者区分別内訳の集計軸。件数のみを集計し利用者番号は集計明細に保存しない）
10. 返却済み件数・利用者数（COUNT DISTINCT user_no）・1 利用者あたり貸出件数・利用者区分別内訳・ジャンル別内訳を算出し、統計レポート状態を「作成済み」に設定する
11. `UPDATE statistical_reports SET detail=..., report_status=..., aggregated_at=...` で結果を保存する
12. ジョブ結果（COMPLETED / FAILED）と処理件数を構造化ログへ INFO 出力する（arch LP-017）

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| RDB 一時障害（接続断・タイムアウト） | Yes | Yes | 指数バックオフで再試行し、上限超過時は DLQ へ退避する（arch SR-020） |
| 対象レポート未存在（report_id 不整合） | No | No | ERROR ログを出力して ACK する。再試行しても回復しないため |
| 統計レポート状態が「集計中」でない | No | No | 重複消費とみなし INFO ログを出して ACK する（arch SR-018） |
| メッセージのデシリアライズ失敗（ポイズンピル） | No | Yes | ERROR ログを出力して DLQ へ退避する（arch LP-017） |
| ランキング対象書籍が books に存在しない（除籍済み） | No | No | 該当行のタイトル・著者を「（除籍済み）」として集計明細に含め、WARN ログを出力する |
| 集計処理時間の増加・キュー滞留 | - | - | 劣化兆候として WARN ログを出力する（arch SR-021 / NFR B.2.2.1 バッチ 8 時間以内） |

## データモデル変更

### statistical_reports（統計レポート / E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| detail | TEXT | 集計明細（JSON）。`total_loans` / `returned_count` / `distinct_users` / `loans_per_user` / `trend[]` / `ranking[]` / `user_category_counts` / `genre_counts` を格納する | 変更 |
| report_status | VARCHAR | 集計中 → 作成済み（実績あり）／実績なし（期間内貸出 0 件） | 変更 |
| aggregated_at | TIMESTAMP | 集計完了時刻で更新する | 変更 |

### loans（貸出 / E-004）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID。件数集計の対象 | 参照のみ |
| book_id | VARCHAR | 書籍ID。書籍別貸出回数の集計軸 | 参照のみ |
| user_no | VARCHAR | 利用者番号。利用者数と利用者区分別内訳の集計に使う（集計明細には保存しない） | 参照のみ |
| loan_date | DATE | 貸出日。期間絞り込みと推移の時系列軸 | 参照のみ |
| loan_status | VARCHAR | 貸出状態。返却済み件数の判定に使う | 参照のみ |

### books（書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id / title / author / genre | VARCHAR | 期間内貸出の DISTINCT book_id 全件について、ランキングの書誌情報とジャンル別内訳に使う | 参照のみ |

### users（利用者 / E-002）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_no | VARCHAR | 利用者番号。loans.user_no との突合キー | 参照のみ |
| user_category | VARCHAR | 利用者区分。利用者区分別内訳の集計軸（集計明細には件数のみ保存する） | 参照のみ |

蔵書分析コンテキスト（BC-006）は貸出・書籍・利用者を読み取り専用に参照し、更新しない。

## ビジネスルール

- 貸出統計集計条件（条件.tsv）: 指定された集計期間区分と期間に含まれる貸出記録を対象に貸出件数と書籍別貸出回数を集計する。対象期間に貸出実績が存在しない場合は実績なしとして扱う
- 集計対象は `loan_date` が集計期間に含まれる貸出であり、貸出状態（貸出中／延滞／返却済み）は問わない。返却済み件数は内訳として別途集計する
- 人気書籍ランキングは上位 20 件までとする（明細表の読み取りを目的とするため）
- 時系列の推移は必ず時間順に固定し、欠損期間も 0 件の枠として出力する（data-visualization の連続の原則）
- 集計明細に利用者番号・氏名・連絡先を保存しない。利用者区分別内訳は件数のみを保持する（arch SR-006 / NFR E.1.2.1）
- 集計は貸出実績のスナップショットであり、集計後の貸出登録・返却で再集計しない（統計レポートは event_snapshot）
- 中断許容インフラ上で実行されるため、中断時は再配信で安全に再実行できること（arch SP-032 / SR-018）

## ティア完了条件（BDD）

```gherkin
Feature: 期間別貸出統計を集計する - バックエンドワーカー

  Scenario: 期間内の貸出件数とランキングを集計して作成済みにする
    Given statistical_reports に report_id "RPT-1001" が report_status "集計中"・period_type "月次"・期間 2026-08-01〜2026-08-31 で存在する
    And loans に当該期間の貸出が 240 件登録されている
    When report.aggregation.requested から report_id "RPT-1001" のメッセージを消費する
    Then detail の total_loans が 240 になり、ranking に上位 20 件が貸出回数の降順で格納される
    And report_status が "作成済み" になる

  Scenario: 貸出0件の期間も0として推移に含める
    Given period_type "日次"・期間 2026-08-01〜2026-08-07 で 2026-08-03 の貸出が 0 件である
    When 集計メッセージを消費する
    Then detail の trend に 7 要素が時間順で並び、2026-08-03 の値が 0 になる

  Scenario: 期間内に貸出実績がないとき実績なしにする
    Given statistical_reports に report_id "RPT-1002" が report_status "集計中" で存在する
    And 対象期間の loans が 0 件である
    When 集計メッセージを消費する
    Then report_status が "実績なし" になり、detail の total_loans が 0 になる

  Scenario: 同一メッセージの重複消費を検知してスキップする
    Given message_id "msg-1001" が処理済みとして記録されている
    When 同じ message_id "msg-1001" のメッセージを再度消費する
    Then 集計は再実行されず、statistical_reports は更新されない

  Scenario: 集計明細に個人情報を保存しない
    Given 対象期間の貸出 240 件に利用者番号が含まれている
    When 集計メッセージを消費する
    Then detail の user_category_counts は件数のみを保持し、利用者番号・氏名・連絡先を含まない
```
