# 人気書籍ランキングを参照する - Backend API仕様

## 変更概要

運営分析コンテキスト（BC-006）に読み取り API `GET /api/v1/reports/popular-books` を追加する。集計テーブル loan_statistics（arch E-009）の書籍別貸出回数を期間で合算し、domain `BookRanking` で順位を付与して上位 N 件を返す。書籍属性は蔵書コンテキスト（BC-001）の公開インタフェース経由で取得する（LR-003）。結果は KVS に Cache-Aside（TTL 10 分）で保持する。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 人気書籍ランキング取得

- **メソッド**: GET
- **パス**: `/api/v1/reports/popular-books`
- **認証**: Bearer（IdP 発行アクセストークン）。利用者区分 = 司書 のみ許可（LP-003 / SP-016）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reports/popular-books.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| periodType | string (query) | Yes | 集計期間種別 enum: `DAY`（日）/ `MONTH`（月）/ `YEAR`（年） |
| from | string (query, date) | Yes | 集計対象期間 開始日（YYYY-MM-DD） |
| to | string (query, date) | Yes | 集計対象期間 終了日（YYYY-MM-DD）。from <= to |
| limit | integer (query) | No | 上位件数。既定 20、上限 100 |

期間上限: `DAY` 366 日 / `MONTH` 36 か月 / `YEAR` 10 年。`MONTH` / `YEAR` は月初・年初 / 月末・年末に丸める。

#### レスポンス

`PopularBooksResponse`

| フィールド | 型 | 説明 |
|-----------|---|------|
| periodType | string | 要求した集計期間種別 |
| from | string (date) | 丸め後の開始日 |
| to | string (date) | 丸め後の終了日 |
| totalLoans | integer | 期間内の貸出件数合計（LIMIT 前の全書籍） |
| items | array | 順位付き書籍一覧（順位昇順、同順位は書籍 ID 昇順） |
| items[].ranking | integer | 順位（同数は同順位、次順位は件数分飛ぶ） |
| items[].bookId | string | 書籍 ID |
| items[].title | string | タイトル（削除済み書籍は「削除済み書籍」） |
| items[].author | string | 著者 |
| items[].genreName | string | ジャンル名 |
| items[].loanCount | integer | 期間内の貸出回数 |
| aggregatedAt | string (date-time) | 集計テーブルの最終集計日時 |

#### エラーレスポンス

`application/problem+json`（RFC 9457）+ 業務エラーコード

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | periodType が enum 外、日付形式不正、from > to、limit が 1〜100 外 | `{code: "VALIDATION_ERROR", errors[{field, reason}]}` |
| 400 | periodType ごとの期間上限を超過 | `{code: "INVALID_PERIOD_RANGE"}` |
| 401 | トークン未提示 / 無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が司書でない | `{code: "FORBIDDEN"}`（監査ログに deny を記録） |

## 非同期イベント（該当する場合）

なし。

## データモデル変更

### loan_statistics（情報: 貸出統計）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR(26) | 書籍 ID。本 UC の GROUP BY キー | 変更なし（UC「期間別貸出統計を参照する」で定義） |
| loan_count | INT | 書籍ごとの貸出回数（集計期間内）。本 UC の SUM 対象 | 変更なし |
| ranking | INT | 集計時点の順位（集計期間種別ごとの区切り単位）。本 UC は複数区切りの合算で再計算するため参照しない | 変更なし |
| INDEX(period_type, period_start, book_id) | — | 期間範囲 × 書籍の合算 | 変更なし（UNIQUE 定義済み） |

### books / genres（情報: 書籍 / ジャンル）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| books.title / author / genre_id | VARCHAR | ランキング行の表示属性 | 変更なし |
| genres.genre_name | VARCHAR(32) | ジャンル名 | 変更なし |

## ビジネスルール

- 条件「人気書籍ランキング判定」: 貸出回数を書籍ごとに集計し多い順に並べて順位を付与する。順位付与は domain `BookRanking.rank` に一箇所だけ実装する。同数は同順位（競技順位方式: 1, 1, 3）、同順位内の並びは書籍 ID 昇順で安定させる
- 条件「集計期間判定」: 集計期間種別と期間から対象の集計区切りを決める（domain `AggregationPeriod`。UC「期間別貸出統計を参照する」と共有）
- 集計の正本は loan_statistics。未集計の区切り（当日・当月）は本 UC では補完しない（ランキングは日単位の鮮度で足りる。次回集計後に反映）
- 削除済み書籍の貸出回数はランキングに残す（貸出統計の履歴性を保つ）。タイトルは「削除済み書籍」と表示する
- 結果は KVS `cache:report:popular-books:{periodType}:{from}:{to}:{limit}` に TTL 10 分でキャッシュする（LP-017）
- 司書のみ利用可。認可判定結果をデータアクセス監査ログに記録する（SR-010）。応答 10 秒以内（NFR B.2.1.3）

## ティア完了条件（BDD）

```gherkin
Feature: 人気書籍ランキングを参照する - Backend API

  Scenario: 期間内の貸出回数順に上位を返す
    Given 司書「S-0001」のアクセストークンを持つ
    And loan_statistics に period_type=MONTH で 2026-01〜2026-06 の行があり、book_id 別の loan_count 合算が B-001=42, B-002=35, B-003=28 である
    When GET /api/v1/reports/popular-books?periodType=MONTH&from=2026-01-01&to=2026-06-30&limit=20 を呼ぶ
    Then HTTP 200 で items[0] が {ranking: 1, bookId: "B-001", loanCount: 42}、items[1] が {ranking: 2, bookId: "B-002", loanCount: 35} である
    And totalLoans が 105 である

  Scenario: 同数は同順位で次順位を飛ばす
    Given 司書「S-0001」のアクセストークンを持つ
    And 期間内の loan_count 合算が B-001=30, B-002=30, B-003=28 である
    When GET /api/v1/reports/popular-books?periodType=MONTH&from=2026-01-01&to=2026-06-30 を呼ぶ
    Then items の ranking が [1, 1, 3] で、同順位内は bookId 昇順（B-001, B-002）である

  Scenario: limit の上限を超えると 400 を返す
    Given 司書「S-0001」のアクセストークンを持つ
    When GET /api/v1/reports/popular-books?periodType=MONTH&from=2026-01-01&to=2026-06-30&limit=101 を呼ぶ
    Then HTTP 400 と problem+json {code: "VALIDATION_ERROR", errors[0].field: "limit"} が返る

  Scenario: 利用者区分が利用者なら 403 を返す
    Given 利用者「U-0001」（利用者区分: 利用者）のアクセストークンを持つ
    When GET /api/v1/reports/popular-books?periodType=MONTH&from=2026-01-01&to=2026-06-30 を呼ぶ
    Then HTTP 403 と problem+json {code: "FORBIDDEN"} が返る
```
