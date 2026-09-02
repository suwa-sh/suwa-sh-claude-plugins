# 貸出統計レポートを参照する - バックエンド API 仕様

## 変更概要

蔵書分析コンテキスト（BC-006）に貸出統計レポートの参照エンドポイントを追加する。集計済みの統計レポート 1 件を読み取り、期間内貸出件数・推移・人気書籍ランキング・利用者区分別／ジャンル別内訳を返す。前回集計との前期比（% Change）も算出する。集計は行わない読み取り専用処理とする（arch SP-018）。

## API 仕様

### 最新の貸出統計レポート参照

- **メソッド**: GET
- **パス**: `/api/v1/reports/loans/latest`
- **認証**: IdP 発行のアクセストークン（Bearer）。司書ロール必須（arch SR-005 / NFR E.5.2.1 RBAC）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reports/loans/latest.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| report_type | string(query) | No | レポート種別（`期間別貸出統計` / `人気書籍ランキング`）。既定は `期間別貸出統計` |
| page | integer(query) | No | ランキングのページ番号（既定 1、1 以上） |
| per_page | integer(query) | No | 1 ページ件数（既定 20、最大 100） |

### 指定した貸出統計レポート参照

- **メソッド**: GET
- **パス**: `/api/v1/reports/loans/{reportId}`
- **認証**: 同上
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reports/loans/{reportId}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| reportId | string(path) | Yes | 統計レポートID |
| page | integer(query) | No | ランキングのページ番号（既定 1） |
| per_page | integer(query) | No | 1 ページ件数（既定 20、最大 100） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| report_id | string | 統計レポートID |
| report_type | string | レポート種別（`期間別貸出統計` / `人気書籍ランキング`） |
| period_type | string | 集計期間区分（日次／月次／年次） |
| period_start | string(date) | 集計開始日 |
| period_end | string(date) | 集計終了日 |
| aggregated_at | string(date-time) | 集計日時 |
| report_status | string | 統計レポート状態（集計中／作成済み／実績なし） |
| summary.total_loans | integer | 期間内貸出件数 |
| summary.total_loans_delta_rate | number | 前期比（％）。前回レポートが無い場合は返さない |
| summary.returned_count | integer | 返却済み件数 |
| summary.distinct_users | integer | 利用者数（実数のみ。個人情報は含まない） |
| summary.loans_per_user | number | 1 利用者あたり貸出件数 |
| trend[].period_label | string | 期間ラベル（集計期間区分の粒度。時間順） |
| trend[].loan_count | integer | 当該期間の貸出件数（欠損期間は 0） |
| ranking[].rank | integer | 順位（貸出回数の降順。同数は同順位） |
| ranking[].book_id | string | 書籍ID |
| ranking[].title | string | タイトル |
| ranking[].author | string | 著者 |
| ranking[].genre | string | ジャンル |
| ranking[].loan_count | integer | 書籍別貸出回数 |
| breakdowns.user_category[].label | string | 利用者区分（一般／学生／団体） |
| breakdowns.user_category[].count | integer | 区分ごとの貸出件数 |
| breakdowns.genre[].label | string | ジャンル（8 区分） |
| breakdowns.genre[].count | integer | 区分ごとの貸出件数 |
| pagination.page / per_page / total / total_pages | integer | ランキングのページング情報 |

`report_status` が `集計中` の場合、`summary` / `trend` / `ranking` / `breakdowns` は空で返す。`実績なし` の場合は件数 0 の要約のみを返す。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `report_type` が `期間別貸出統計` / `人気書籍ランキング` 以外 | `{"code":"INVALID_REPORT_TYPE","message":"レポート種別は 期間別貸出統計 または 人気書籍ランキング を指定してください"}` |
| 400 | `page` が 1 未満、または `per_page` が 100 超 | `{"code":"INVALID_PAGINATION","message":"ページ指定が不正です"}` |
| 401 | アクセストークンが無効または失効 | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 司書ロールを持たない | `{"code":"FORBIDDEN","message":"この操作には司書の権限が必要です"}` |
| 404 | 対象レポート種別の統計レポートが存在しない / reportId が存在しない | `{"code":"REPORT_NOT_FOUND","message":"まだ集計されていません。集計を実行してください"}` |

## 非同期イベント（該当する場合）

本 UC は参照系であり、非同期イベントの発行・購読を行わない。

## データモデル変更

### statistical_reports（統計レポート / E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| report_id | VARCHAR | レポートID。参照キー | 参照のみ |
| report_type | VARCHAR | レポート種別。`期間別貸出統計` / `人気書籍ランキング` で絞り込む | 参照のみ |
| period_type / period_start / period_end | VARCHAR / DATE / DATE | 集計条件の再掲と推移の粒度判定に使う | 参照のみ |
| aggregated_at | TIMESTAMP | 最新レポート特定と前回レポート特定のソートキー | 参照のみ |
| detail | TEXT | 集計明細（JSON）。復元して応答へ展開する | 参照のみ |
| report_status | VARCHAR | 表示切替の判定に使う | 参照のみ |

本 UC はテーブル定義を変更せず、書き込みも行わない。

## ビジネスルール

- 貸出統計集計条件（条件.tsv）: 集計期間区分と期間に対応する貸出件数と書籍別貸出回数を参照対象とする
- `latest` は指定レポート種別の `aggregated_at` 降順 1 件を返す
- 前期比は、同一 `report_type` かつ `aggregated_at` が対象レポートより前の直近 1 件との比較で算出する。前回が存在しない、または前回の `total_loans` が 0 の場合は返さない
- ランキングは貸出回数の降順で 1 起点の順位を付与し、同数は同順位として次順位を飛ばす
- 推移（`trend`）は集計明細に保存された時間順の並びをそのまま返す。並び替えを行わない
- 利用者区分別内訳は件数のみを返す。利用者番号・氏名・連絡先はレスポンスにもログにも含めない（arch SR-006 / SP-023 / NFR E.1.2.1）
- 蔵書分析コンテキスト（BC-006）は読み取り専用であり、貸出・書籍の更新を行わない
- ランキングのページングは既定 20 件/頁とする（NFR B.2.1.1 レスポンスタイム 5 秒以内）

## ティア完了条件（BDD）

```gherkin
Feature: 貸出統計レポートを参照する - バックエンド API

  Scenario: 最新の作成済みレポートを返す
    Given statistical_reports に report_type "期間別貸出統計"・report_status "作成済み" のレポートが存在する
    When GET /api/v1/reports/loans/latest?page=1&per_page=20 を実行する
    Then HTTP 200 が返り、summary.total_loans と trend と ranking 20 件が含まれる

  Scenario: 前期比を算出して返す
    Given 今回のレポートの total_loans が 240、前回のレポートの total_loans が 214 である
    When GET /api/v1/reports/loans/latest を実行する
    Then HTTP 200 が返り、summary.total_loans_delta_rate が 12.1 になる

  Scenario: 前回レポートがない場合は前期比を返さない
    Given report_type "期間別貸出統計" の統計レポートが 1 件のみ存在する
    When GET /api/v1/reports/loans/latest を実行する
    Then HTTP 200 が返り、summary に total_loans_delta_rate が含まれない

  Scenario: レポート種別が不正なとき400を返す
    Given 司書ロールのアクセストークンを保持している
    When GET /api/v1/reports/loans/latest?report_type=在庫状況 を実行する
    Then HTTP 400 と code "INVALID_REPORT_TYPE" が返る

  Scenario: レポートが存在しないとき404を返す
    Given statistical_reports に report_type "期間別貸出統計" の行が存在しない
    When GET /api/v1/reports/loans/latest を実行する
    Then HTTP 404 と code "REPORT_NOT_FOUND" が返る

  Scenario: 実績なしのレポートは件数0の要約のみを返す
    Given 最新の貸出統計レポートの report_status が "実績なし" である
    When GET /api/v1/reports/loans/latest を実行する
    Then HTTP 200 が返り、summary.total_loans が 0 で trend と ranking が空配列である
```
