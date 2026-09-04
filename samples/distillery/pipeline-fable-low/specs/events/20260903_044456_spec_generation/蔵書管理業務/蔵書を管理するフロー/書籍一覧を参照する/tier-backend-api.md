# 書籍一覧を参照する - Backend API仕様

## 変更概要

蔵書コンテキスト（BC-001）モジュールに書籍一覧取得 API `GET /api/v1/books` を追加する。
offset ページネーション（page / pageSize、既定 20、上限 100）と、検索条件種別・ジャンル・在庫状況による絞り込みを提供する。
本 API は「書籍を検索する」UC と同一エンドポイントを共有し、司書経路（館内）では全属性を返す。
ジャンル選択肢のための `GET /api/v1/genres` を併せて提供する。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 書籍一覧取得

- **メソッド**: GET
- **パス**: `/api/v1/books`
- **認証**: Bearer（IdP 発行アクセストークン）。API Gateway で利用者区分クレームを検証。館内経路（司書）/ 公開経路（利用者）の双方から到達可。公開経路は未認証（匿名）でも GET を許可（SP-003）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| page | integer (query) | No | ページ番号。1 以上。既定 1 |
| pageSize | integer (query) | No | 1 ページ件数。1〜100。既定 20 |
| searchType | string (query) | No | 検索条件種別: `keyword` / `title` / `author` / `isbn` / `genre`。既定 `keyword`。`q` 指定時に有効 |
| q | string (query) | No | 検索文字列。1〜100 文字。大文字小文字・全角半角を正規化して部分一致 |
| genreId | string (query) | No | ジャンル ID による絞り込み（searchType=genre の場合はこちらを使用） |
| status | string (query) | No | 書籍の状態: `AVAILABLE`（在庫あり）/ `ON_LOAN`（貸出中）/ `RESERVED`（予約待ち） |
| X-Trace-Id | string (header) | No | trace_id。無ければ Gateway / presentation で生成 |

#### レスポンス

`200 OK` / `application/json` — `BookPageResponse`

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | BookSummary[] | 書籍一覧（更新日時降順） |
| items[].bookId | string | 書籍 ID |
| items[].title | string | タイトル |
| items[].author | string | 著者 |
| items[].isbn | string \| null | ISBN |
| items[].publisher | string \| null | 出版社 |
| items[].genreId | string | ジャンル ID |
| items[].genreName | string | ジャンル名 |
| items[].mediaType | string | 媒体種別: `PAPER` / `ELECTRONIC` |
| items[].status | string | 書籍の状態: `AVAILABLE` / `ON_LOAN` / `RESERVED` |
| items[].updatedAt | string (date-time) | 更新日時 |
| page | integer | 現在ページ |
| pageSize | integer | ページ件数 |
| totalCount | integer | 絞り込み条件に一致する総件数 |

#### エラーレスポンス

`application/problem+json`（RFC 9457）。`code` に業務エラーコードを含める。

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | page < 1、pageSize が 1〜100 の範囲外、searchType / status が enum 外、q が 100 文字超 | `{ type, title: "Bad Request", status: 400, code: "VALIDATION_ERROR", errors: [{ field, message }] }` |
| 401 | トークン無し / 期限切れ | `{ status: 401, code: "UNAUTHENTICATED" }` |
| 403 | 利用者区分「利用者」から館内経路へアクセス | `{ status: 403, code: "FORBIDDEN" }` |
| 429 | 公開経路のレート制限超過（API Gateway SP-010） | `{ status: 429, code: "RATE_LIMITED" }` + `Retry-After` |

### ジャンル一覧取得

- **メソッド**: GET
- **パス**: `/api/v1/genres`
- **認証**: Bearer（司書 / 利用者）または未認証（匿名）。公開経路は匿名 GET を許可（SP-003）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/genres.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| （なし） | - | - | - |

#### レスポンス

`200 OK` — `GenreListResponse`

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | Genre[] | ジャンル一覧（genre_id 昇順） |
| items[].genreId | string | ジャンル ID |
| items[].genreName | string | ジャンル名（文学 / 社会科学 / 自然科学 / 技術 / 芸術 / 歴史 / 児童書 / その他） |
| items[].description | string \| null | 説明 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 429 | 公開経路のレート制限超過（API Gateway SP-010） | `{ status: 429, code: "RATE_LIMITED" }` + `Retry-After` |

## 非同期イベント（該当する場合）

該当なし（参照系 UC）。

## データモデル変更

### books（E-001 書籍 スナップショット）

参照のみ。新規カラム変更なし（テーブル定義は「書籍を登録する」UC で作成）。

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR(32) | 書籍 ID（PK） | 参照 |
| title | VARCHAR(200) | タイトル | 参照（照合対象） |
| author | VARCHAR(200) | 著者 | 参照（照合対象） |
| isbn | VARCHAR(17) | ISBN | 参照（照合対象） |
| publisher | VARCHAR(200) | 出版社 | 参照（キーワード照合対象） |
| genre_id | VARCHAR(32) | ジャンル ID（FK genres） | 参照（絞り込み） |
| media_type | VARCHAR(16) | 媒体種別（PAPER / ELECTRONIC） | 参照 |
| current_status | VARCHAR(16) | 書籍の状態（AVAILABLE / ON_LOAN / RESERVED） | 参照（絞り込み） |
| updated_at | TIMESTAMP | 更新日時（並び順） | 参照 |

### genres（E-002 ジャンル）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| genre_id | VARCHAR(32) | ジャンル ID（PK） | 参照 |
| genre_name | VARCHAR(50) | ジャンル名 | 参照 |
| description | TEXT | 説明 | 参照 |

## ビジネスルール

- 在庫状況判定: `current_status` を `AVAILABLE` / `ON_LOAN` / `RESERVED` としてそのまま返す。集計や導出は行わない
- 媒体種別判定: 媒体種別「電子」の書籍も一覧に含める（登録のみ可能な書籍として表示対象）
- 書籍検索条件判定: `q` 指定時、`searchType` に応じて照合属性を切り替える（ストラテジー: LP-012）。`keyword` はタイトル・著者・出版社・ISBN の OR 部分一致。`genre` は `genreId` 一致
- 照合は大文字小文字・全角半角を正規化した部分一致（_inference 8）。DB アクセスはパラメータ化クエリ必須（SR-011 / LR-013）
- 並び順は `updated_at DESC, book_id ASC` 固定
- 参照結果は KVS に Cache-Aside で保持してよい（LP-017）。キー `cache:books:list:{hash(query)}`、TTL 60 秒。書籍の登録・編集・削除・状態遷移時に `cache:books:*` を無効化する
- 監査ログ対象外（書籍は個人情報を含まない。LP-006 の対象は利用者・貸出・予約・通知）。アクセスログのみ出力

## ティア完了条件（BDD）

```gherkin
Feature: 書籍一覧を参照する - Backend API

  Scenario: 既定ページングで一覧を返す
    Given books に 45 件の書籍が存在する
    And 司書「佐藤花子」のアクセストークンを保持している
    When GET /api/v1/books を送信する
    Then HTTP 200 が返る
    And items が 20 件、page が 1、pageSize が 20、totalCount が 45 である
    And items は updatedAt の降順である

  Scenario: 状態で絞り込む
    Given books に current_status=ON_LOAN の書籍が 3 件、AVAILABLE が 10 件存在する
    When GET /api/v1/books?status=ON_LOAN を送信する
    Then HTTP 200 が返り、items が 3 件、すべての status が "ON_LOAN" である

  Scenario: タイトルで正規化つき部分一致検索する
    Given books にタイトル「吾輩は猫である」「ＮＥＫＯの本」の書籍が存在する
    When GET /api/v1/books?searchType=title&q=neko を送信する
    Then HTTP 200 が返り、items に「ＮＥＫＯの本」が含まれる
    And items に「吾輩は猫である」は含まれない

  Scenario: pageSize の上限超過は 400 を返す
    Given 司書「佐藤花子」のアクセストークンを保持している
    When GET /api/v1/books?pageSize=101 を送信する
    Then HTTP 400 と problem+json（code: VALIDATION_ERROR, errors[0].field: "pageSize"）が返る

  Scenario: ジャンル一覧を返す
    Given genres に 8 件のジャンルが存在する
    When GET /api/v1/genres を送信する
    Then HTTP 200 が返り、items が 8 件で genreName に「文学」「その他」が含まれる
```
