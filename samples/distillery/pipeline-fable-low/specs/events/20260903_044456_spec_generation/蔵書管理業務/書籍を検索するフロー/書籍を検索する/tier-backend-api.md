# 書籍を検索する - Backend API仕様

## 変更概要

蔵書コンテキスト（BC-001）モジュールの書籍一覧取得 API `GET /api/v1/books` を、利用者経路（公開 API Gateway）からも到達可能な検索 API として提供する。
エンドポイント・スキーマは「書籍一覧を参照する」と同一で、本 UC では検索条件種別ストラテジー（書籍検索条件判定）、正規化つき部分一致、Cache-Aside（KVS）、公開経路のレート制限対応を確定する。
`GET /api/v1/genres` はジャンル選択肢として両経路から利用する。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 書籍検索（書籍一覧取得と共有）

- **メソッド**: GET
- **パス**: `/api/v1/books`
- **認証**: Bearer（IdP 発行アクセストークン）。公開経路は未認証（匿名）でも GET を許可する（SP-003: 公開機能の限定 = 検索は公開機能）。館内経路は司書区分必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| searchType | string (query) | No | 検索条件種別: `keyword` / `title` / `author` / `isbn` / `genre`。既定 `keyword` |
| q | string (query) | 条件付き | 検索文字列（1〜100 文字）。searchType が `genre` 以外のとき必須（一覧参照として全件を返す場合は省略可 = 司書経路のみ） |
| genreId | string (query) | 条件付き | ジャンル ID。searchType が `genre` のとき必須。他の searchType では追加の絞り込み条件 |
| status | string (query) | No | `AVAILABLE` / `ON_LOAN` / `RESERVED`。館内経路の窓口検索で使用（公開経路でも受理する） |
| page | integer (query) | No | 1 以上。既定 1 |
| pageSize | integer (query) | No | 1〜100。既定 20 |
| X-Trace-Id | string (header) | No | trace_id |

#### レスポンス

`200 OK` — `BookPageResponse`（「書籍一覧を参照する」と同一）

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | BookSummary[] | 書籍一覧（更新日時降順） |
| items[].bookId / title / author / isbn / publisher | string | 書籍属性 |
| items[].genreId / genreName | string | ジャンル |
| items[].mediaType | string | `PAPER` / `ELECTRONIC` |
| items[].status | string | `AVAILABLE` / `ON_LOAN` / `RESERVED`（在庫状況判定） |
| items[].updatedAt | string (date-time) | 更新日時 |
| page / pageSize / totalCount | integer | ページング情報 |

#### エラーレスポンス

`application/problem+json`（RFC 9457）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | searchType が genre 以外で q 欠落（公開経路）、q が 100 文字超、searchType=genre で genreId 欠落、page < 1、pageSize 範囲外、enum 外 | `{ status: 400, code: "VALIDATION_ERROR", errors: [{ field, message }] }` |
| 401 | 館内経路でトークン無し / 期限切れ | `{ status: 401, code: "UNAUTHENTICATED" }` |
| 403 | 利用者区分「利用者」から館内経路へアクセス | `{ status: 403, code: "FORBIDDEN" }` |
| 429 | 公開経路のレート制限超過（API Gateway SP-010） | `{ status: 429, code: "RATE_LIMITED" }` + `Retry-After` |

### ジャンル一覧取得

「書籍一覧を参照する」の `GET /api/v1/genres` を利用する（公開経路でも匿名 GET を許可）。
エラーは同 UC の定義に従う（429 `RATE_LIMITED` + `Retry-After` のみ）。

## 非同期イベント（該当する場合）

該当なし（参照系 UC）。

## データモデル変更

### books（E-001 書籍 スナップショット）

参照のみ。検索用正規化列は「書籍を登録する」で定義済み。

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| title_normalized | VARCHAR(200) | タイトル正規化列（keyword / title 照合） | 参照 |
| author_normalized | VARCHAR(200) | 著者正規化列（keyword / author 照合） | 参照 |
| publisher_normalized | VARCHAR(200) | 出版社正規化列（keyword 照合） | 参照 |
| isbn | VARCHAR(13) | ISBN（ハイフンなしの正規形で保存済み。keyword / isbn 照合の対象） | 参照 |
| genre_id | VARCHAR(32) | ジャンル絞り込み | 参照 |
| current_status | VARCHAR(16) | 在庫状況絞り込み・表示 | 参照 |
| updated_at | TIMESTAMP | 並び順 | 参照 |

### genres（E-002 ジャンル）

参照のみ（JOIN で genre_name 取得）。

## ビジネスルール

- 書籍検索条件判定（ストラテジー: LP-012）:
  - `keyword`: `title_normalized LIKE %q%` OR `author_normalized LIKE %q%` OR `publisher_normalized LIKE %q%` OR `isbn LIKE %q%`
  - `title` / `author`: 該当正規化列の部分一致
  - `isbn`: q のハイフンを除去し `isbn LIKE %q%`（部分一致。isbn 列はハイフンなしの正規形で保存されているため関数変換は不要で `idx_books_isbn` が効く）
  - `genre`: `genre_id = genreId`（q は無視）
  - 追加の `genreId` / `status` は AND で結合する
- 正規化: q は NFKC 正規化 → 小文字化 → 前後空白除去（_inference 8: 大文字小文字・全角半角を正規化した部分一致）。LIKE のワイルドカード文字（% _）はエスケープする
- 在庫状況判定: `current_status` をそのまま返す。集計や導出は行わない
- 並び順は `updated_at DESC, book_id ASC` 固定
- Cache-Aside（LP-017）: キー `cache:books:list:{sha256(正準化クエリ)}`、TTL 60 秒。ヒット率低下は WARN ログ。書籍の登録・編集・削除・状態遷移時に `cache:books:*` を無効化する
- 公開経路: 匿名アクセスを許可し、API Gateway でレート制限（SP-010）と WAF（SP-008）を適用する。応答に個人情報は含まれない（書籍のみ）
- 電子書籍（`ELECTRONIC`）も検索結果に含める（登録のみ可能な書籍として表示。予約可否は予約 UC の domain で判定）
- 監査ログ対象外（書籍は個人情報を含まない）。アクセスログのみ
- DB アクセスはパラメータ化クエリ必須（LR-013）。検索条件種別ごとのクエリ切替も同様

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を検索する - Backend API

  Scenario: キーワードでタイトル・著者・出版社・ISBN を横断検索する
    Given books に「吾輩は猫である / 夏目漱石 / 新潮社」「猫の事務所 / 宮沢賢治 / 岩波書店」「坊っちゃん / 夏目漱石 / 新潮社」が存在する
    When GET /api/v1/books?searchType=keyword&q=猫 を公開経路に匿名で送信する
    Then HTTP 200 が返り、items が 2 件で「吾輩は猫である」「猫の事務所」を含む
    And totalCount が 2 である

  Scenario: 著者で正規化つき部分一致検索する
    Given books に著者「夏目漱石」の書籍が 3 件、著者「太宰治」の書籍が 2 件存在する
    When GET /api/v1/books?searchType=author&q=夏目 を送信する
    Then HTTP 200 が返り、items が 3 件、すべての author が「夏目漱石」である

  Scenario: ISBN はハイフンの有無を問わず一致する
    Given books に isbn「9784101010011」（登録時にハイフン除去済み）の書籍が存在する
    When GET /api/v1/books?searchType=isbn&q=9784101010011 を送信する
    Then HTTP 200 が返り、items が 1 件である

  Scenario: ジャンルで検索する
    Given books に genre_id「G-007」（児童書）の書籍が 5 件存在する
    When GET /api/v1/books?searchType=genre&genreId=G-007 を送信する
    Then HTTP 200 が返り、items が 5 件、すべての genreName が「児童書」である

  Scenario: 全角・大文字の検索文字列を正規化して一致させる
    Given books にタイトル「ＮＥＫＯの本」の書籍が存在する
    When GET /api/v1/books?searchType=title&q=NEKO を送信する
    Then HTTP 200 が返り、items に「ＮＥＫＯの本」が含まれる

  Scenario: 同一条件の 2 回目はキャッシュから返す
    Given GET /api/v1/books?searchType=keyword&q=猫 を送信し HTTP 200 を受け取っている
    When 60 秒以内に同一クエリを再送する
    Then HTTP 200 が返り、KVS「cache:books:list:{queryHash}」がヒットし RDB への SELECT は実行されない

  Scenario: 公開経路で q を省略すると 400 を返す
    Given 匿名で公開経路にアクセスしている
    When GET /api/v1/books?searchType=keyword を送信する
    Then HTTP 400 と problem+json（code: VALIDATION_ERROR, errors[0].field: "q"）が返る
```
