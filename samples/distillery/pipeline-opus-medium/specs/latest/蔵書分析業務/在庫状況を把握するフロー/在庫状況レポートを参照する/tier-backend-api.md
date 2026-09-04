# 在庫状況レポートを参照する - バックエンド API 仕様

## 変更概要

蔵書分析コンテキスト（BC-006）に在庫状況レポートの参照エンドポイントを追加する。集計済みの統計レポート 1 件を読み取り、書籍状態別件数・ジャンル別件数・稼働率・書籍一覧（ページング）を返す。集計は行わず、既存の集計明細を復元して返すだけの読み取り専用処理とする（arch SP-018）。

## API 仕様

### 最新の在庫状況レポート参照

- **メソッド**: GET
- **パス**: `/api/v1/reports/inventory/latest`
- **認証**: IdP 発行のアクセストークン（Bearer）。司書ロール必須（arch SR-005 / NFR E.5.2.1 RBAC）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reports/inventory/latest.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| status_filter | string(query) | No | 明細の絞り込みに使う書籍状態（`在庫あり` / `貸出中` / `予約待ち`） |
| page | integer(query) | No | ページ番号（既定 1、1 以上） |
| per_page | integer(query) | No | 1 ページ件数（既定 20、最大 100） |

### 指定した在庫状況レポート参照

- **メソッド**: GET
- **パス**: `/api/v1/reports/inventory/{reportId}`
- **認証**: 同上
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reports/inventory/{reportId}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| reportId | string(path) | Yes | 統計レポートID |
| status_filter | string(query) | No | 明細の絞り込みに使う書籍状態 |
| page | integer(query) | No | ページ番号（既定 1） |
| per_page | integer(query) | No | 1 ページ件数（既定 20、最大 100） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| report_id | string | 統計レポートID |
| report_type | string | レポート種別（`在庫状況`） |
| period_type | string | 集計期間区分 |
| period_start | string(date) | 集計開始日 |
| period_end | string(date) | 集計終了日 |
| aggregated_at | string(date-time) | 集計日時 |
| report_status | string | 統計レポート状態（集計中／作成済み／実績なし） |
| summary.total_books | integer | 蔵書総数 |
| summary.utilization_rate | number | 稼働率（貸出中 ÷ 蔵書総数） |
| summary.total_books_delta | integer | 前回集計比の件数差 |
| status_counts[].book_status | string | 書籍状態（在庫あり／貸出中／予約待ち） |
| status_counts[].count | integer | 区分ごとの件数 |
| status_counts[].delta | integer | 前回集計比の件数差 |
| genre_counts[].genre | string | ジャンル（8 区分） |
| genre_counts[].count | integer | ジャンルごとの件数 |
| books[].book_id | string | 書籍ID |
| books[].title | string | タイトル |
| books[].author | string | 著者 |
| books[].genre | string | ジャンル |
| books[].book_status | string | 書籍状態 |
| pagination.page | integer | 現在ページ |
| pagination.per_page | integer | 1 ページ件数 |
| pagination.total | integer | 絞り込み後の総件数 |
| pagination.total_pages | integer | 総ページ数 |

`report_status` が `集計中` の場合、`summary` / `status_counts` / `genre_counts` / `books` は空で返す。`実績なし` の場合は件数 0 の要約のみを返す。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `status_filter` が書籍状態の許容値でない | `{"code":"INVALID_STATUS_FILTER","message":"書籍状態は 在庫あり / 貸出中 / 予約待ち のいずれかを指定してください"}` |
| 400 | `page` が 1 未満、または `per_page` が 100 超 | `{"code":"INVALID_PAGINATION","message":"ページ指定が不正です"}` |
| 401 | アクセストークンが無効または失効 | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 司書ロールを持たない | `{"code":"FORBIDDEN","message":"この操作には司書の権限が必要です"}` |
| 404 | レポート種別「在庫状況」の統計レポートが存在しない / reportId が存在しない | `{"code":"REPORT_NOT_FOUND","message":"まだ集計されていません。集計を実行してください"}` |

## 非同期イベント（該当する場合）

本 UC は参照系であり、非同期イベントの発行・購読を行わない。

## データモデル変更

### statistical_reports（統計レポート / E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| report_id | VARCHAR | レポートID。参照キー | 参照のみ |
| report_type | VARCHAR | レポート種別。`在庫状況` で絞り込む | 参照のみ |
| period_type / period_start / period_end | VARCHAR / DATE / DATE | 集計条件の再掲に使う | 参照のみ |
| aggregated_at | TIMESTAMP | 最新レポート特定のソートキー | 参照のみ |
| detail | TEXT | 集計明細（JSON）。復元して応答へ展開する | 参照のみ |
| report_status | VARCHAR | 表示切替の判定に使う | 参照のみ |

本 UC はテーブル定義を変更せず、書き込みも行わない。

## ビジネスルール

- 在庫状況集計条件（条件.tsv）: 書籍状態（在庫あり／貸出中／予約待ち）の区分ごとの件数と書籍一覧を参照対象とする
- `latest` は `report_type='在庫状況'` の `aggregated_at` 降順 1 件を返す
- 前回集計比は、同一 `report_type` かつ `aggregated_at` が対象レポートより前の直近 1 件の集計明細との差分で算出する。前回が存在しない場合は `delta` を返さない
- ジャンル別件数はバリエーション「ジャンル」の 8 区分すべてを返す（件数 0 の区分も含める）
- 明細のページングは既定 20 件/頁とする（NFR B.2.1.1 レスポンスタイム 5 秒以内）
- 蔵書分析コンテキスト（BC-006）は読み取り専用であり、書籍・貸出の更新を行わない
- 本 UC は利用者情報を返さないため、レスポンスとログのいずれにも個人情報を含めない（arch SP-023 / SR-006）

## ティア完了条件（BDD）

```gherkin
Feature: 在庫状況レポートを参照する - バックエンド API

  Scenario: 最新の作成済みレポートを返す
    Given statistical_reports に report_type "在庫状況"・report_status "作成済み" のレポートが aggregated_at 降順で存在する
    When GET /api/v1/reports/inventory/latest?page=1&per_page=20 を実行する
    Then HTTP 200 が返り、summary.total_books と status_counts 3 区分と books 20 件が含まれる

  Scenario: 書籍状態で明細を絞り込む
    Given 最新の在庫状況レポートの集計明細に 貸出中 30 件が含まれている
    When GET /api/v1/reports/inventory/latest?status_filter=貸出中 を実行する
    Then HTTP 200 が返り、pagination.total が 30 になり、books の book_status がすべて "貸出中" である

  Scenario: レポートが存在しないとき404を返す
    Given statistical_reports に report_type "在庫状況" の行が存在しない
    When GET /api/v1/reports/inventory/latest を実行する
    Then HTTP 404 と code "REPORT_NOT_FOUND" が返る

  Scenario: 不正な絞り込み条件は400を返す
    Given 司書ロールのアクセストークンを保持している
    When GET /api/v1/reports/inventory/latest?status_filter=返却済み を実行する
    Then HTTP 400 と code "INVALID_STATUS_FILTER" が返る

  Scenario: 集計中のレポートは明細を返さない
    Given 最新の在庫状況レポートの report_status が "集計中" である
    When GET /api/v1/reports/inventory/latest を実行する
    Then HTTP 200 が返り、report_status が "集計中" で status_counts と books が空配列である
```
