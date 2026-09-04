# 書籍を登録する - Backend API仕様

## 変更概要

蔵書コンテキスト（BC-001）モジュールに書籍登録 API `POST /api/v1/books` を追加する。
書籍集約（AG-001）の生成、ジャンル存在確認、`books`（スナップショット）と `book_events`（履歴）への 1 トランザクション INSERT、参照キャッシュの無効化を行う。
本 UC で `books` / `book_events` テーブルを新規作成する（他の蔵書 UC はこの定義を参照する）。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 書籍登録

- **メソッド**: POST
- **パス**: `/api/v1/books`
- **認証**: Bearer（IdP 発行アクセストークン）。API Gateway で利用者区分=司書の粗粒度 RBAC（館内経路のみ）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books.post` を参照

#### リクエスト

Content-Type: `application/json` — `CreateBookRequest`。ヘッダ `Idempotency-Key`（必須。同一キーの再送は最初の結果を返す: LR-002）、`X-Trace-Id`（任意）。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| title | string | Yes | タイトル（1〜200 文字） |
| author | string | Yes | 著者（1〜200 文字） |
| isbn | string | No | ISBN（ハイフンなしの 10 桁（末尾のみ `X` 可）または 13 桁の数字。最大 13 文字。openapi の `pattern: ^(?:\\d{9}[\\dX]|\\d{13})$` と同一。ハイフン付き入力はフロントエンドが送信前に除去する） |
| publisher | string | No | 出版社（最大 200 文字） |
| genreId | string | Yes | ジャンル ID（genres に存在すること） |
| mediaType | string | No | 媒体種別: `PAPER` / `ELECTRONIC`。省略時 `PAPER` |

#### レスポンス

`201 Created` / `application/json` — `BookDetailResponse`。`Location: /api/v1/books/{bookId}`

| フィールド | 型 | 説明 |
|-----------|---|------|
| bookId | string | 採番された書籍 ID |
| title | string | タイトル |
| author | string | 著者 |
| isbn | string \| null | ISBN |
| publisher | string \| null | 出版社 |
| genreId | string | ジャンル ID |
| genreName | string | ジャンル名 |
| mediaType | string | `PAPER` / `ELECTRONIC` |
| status | string | 書籍の状態。登録直後は `AVAILABLE` |
| waitingCount | integer | 予約待ち人数（予約状態が RESERVED / NOTIFIED の件数。登録直後は 0） |
| version | integer | 楽観ロック用バージョン（司書経路のみ返却。登録直後は 1） |
| registeredAt | string (date-time) | 登録日時（登録イベントの occurred_at） |
| updatedAt | string (date-time) | 更新日時 |

#### エラーレスポンス

`application/problem+json`（RFC 9457）。`type`, `title`, `status`, `detail`, `code`, `traceId` を含む。

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | JSON 構文不正、Idempotency-Key 欠落 | `{ status: 400, code: "BAD_REQUEST" }` |
| 401 | トークン無し / 期限切れ | `{ status: 401, code: "UNAUTHENTICATED" }` |
| 403 | 利用者区分が司書でない | `{ status: 403, code: "FORBIDDEN" }` |
| 422 | title / author / genreId 欠落、文字数超過、isbn 形式不正、mediaType が enum 外 | `{ status: 422, code: "VALIDATION_ERROR", errors: [{ field, message }] }` |
| 422 | genreId が genres に存在しない | `{ status: 422, code: "GENRE_NOT_FOUND", errors: [{ field: "genreId", message }] }` |

## 非同期イベント（該当する場合）

該当なし（書籍登録は通知を発行しない）。

## データモデル変更

### books（E-001 書籍 スナップショット）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR(32) | 書籍 ID（PK。ULID 等で採番） | 追加 |
| title | VARCHAR(200) | タイトル | 追加 |
| author | VARCHAR(200) | 著者 | 追加 |
| isbn | VARCHAR(13) NULL | ISBN（ハイフンを除去した正規形で保存する。表示もこの値を用いる） | 追加 |
| publisher | VARCHAR(200) NULL | 出版社 | 追加 |
| genre_id | VARCHAR(32) | ジャンル ID（FK genres.genre_id） | 追加 |
| media_type | VARCHAR(16) | 媒体種別（PAPER / ELECTRONIC） | 追加 |
| current_status | VARCHAR(16) | 書籍の状態（AVAILABLE / ON_LOAN / RESERVED）。登録時 AVAILABLE | 追加 |
| title_normalized | VARCHAR(200) | 検索用正規化タイトル（小文字化・全角半角統一。書籍検索条件判定に使用） | 追加 |
| author_normalized | VARCHAR(200) | 検索用正規化著者 | 追加 |
| publisher_normalized | VARCHAR(200) NULL | 検索用正規化出版社 | 追加 |
| version | INT | 楽観ロック用バージョン（登録時 1） | 追加 |
| updated_at | TIMESTAMP | スナップショット最終更新日時 | 追加 |

### book_events（E-001 event_snapshot の履歴側）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| event_id | VARCHAR(36) | イベント ID（PK。UUID） | 追加 |
| book_id | VARCHAR(32) | 対象書籍 ID | 追加 |
| event_type | VARCHAR(20) | REGISTERED / UPDATED / LOANED / RETURNED / CANCELLED / DELETED | 追加 |
| payload | JSON | 変更後属性（title, author, isbn, publisher, genre_id, media_type）と遷移前後の状態 | 追加 |
| occurred_at | TIMESTAMP | 発生日時（登録日・更新日の正本） | 追加 |
| actor_user_number | VARCHAR(20) | 操作した司書の利用者番号 | 追加 |

### genres（E-002 ジャンル）

参照のみ（存在確認）。定義は「書籍一覧を参照する」を参照。

## ビジネスルール

- 媒体種別判定: `PAPER` / `ELECTRONIC` のいずれも登録を受理する。`ELECTRONIC` は登録のみ可能で、貸出・予約の対象外（判定は貸出 / 予約 UC 側の domain で行う）。省略時は `PAPER`
- 状態遷移: `Book.register()` は状態を「在庫あり（AVAILABLE）」で生成する（状態.tsv「（初期）→ 在庫あり」。LP-010）。他の初期状態は許可しない
- ジャンル存在判定: `genreId` は genres に存在すること。存在しない場合は 422 `GENRE_NOT_FOUND`
- ISBN の一意性は強制しない（移行時に重複・欠損の名寄せが想定されるため: E-001 isbn の注記）。ISBN は形式検証のみ
- 永続化: `bookRepository.save(book)` は `book_events` INSERT（event_type=REGISTERED）と `books` INSERT を同一トランザクションで実行する（LR-008）。`registeredAt` は登録イベントの occurred_at
- 正規化列（title_normalized / author_normalized / publisher_normalized）は INSERT 時に gateway が導出する（NFKC 正規化 + 小文字化）
- 冪等性: `Idempotency-Key` を受け付け、同一キーの再送は最初の 201 応答を返す（LR-002）
- キャッシュ: 登録後に `cache:books:*` を無効化する（LP-017）
- 監査ログ: 書籍は個人情報を含まないため LP-006 の監査ログ対象外。アクセスログのみ出力
- DB アクセスはパラメータ化クエリ必須（SR-011 / LR-013）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を登録する - Backend API

  Scenario: 必須項目のみで登録すると在庫ありの書籍が作成される
    Given genres に「G-001 文学」が存在する
    And 司書「佐藤花子」のアクセストークンを保持している
    When POST /api/v1/books を {title: "こころ", author: "夏目漱石", genreId: "G-001"} と Idempotency-Key「idem-001」で送信する
    Then HTTP 201 と Location「/api/v1/books/{bookId}」が返る
    And レスポンスの status が "AVAILABLE"、mediaType が "PAPER"、version が 1 である
    And books に 1 行、book_events に event_type「REGISTERED」の 1 行が作成される

  Scenario: 同一冪等キーの再送は同じ結果を返し二重登録しない
    Given POST /api/v1/books を Idempotency-Key「idem-002」で送信し HTTP 201（bookId: B-0001）を受け取っている
    When 同一ボディを Idempotency-Key「idem-002」で再送する
    Then HTTP 201 と同じ bookId「B-0001」が返る
    And books の件数は増えない

  Scenario: 存在しないジャンルは 422 を返す
    Given 司書「佐藤花子」のアクセストークンを保持している
    When POST /api/v1/books を genreId「G-999」で送信する
    Then HTTP 422 と problem+json（code: GENRE_NOT_FOUND, errors[0].field: "genreId"）が返る
    And books に行は追加されない

  Scenario: ISBN 形式不正は 422 を返す
    Given 司書「佐藤花子」のアクセストークンを保持している
    When POST /api/v1/books を isbn「abc-123」で送信する
    Then HTTP 422 と problem+json（code: VALIDATION_ERROR, errors[0].field: "isbn"）が返る

  Scenario: 利用者区分が利用者のトークンは 403 を返す
    Given 利用者「田中太郎」（利用者区分: 利用者）のアクセストークンを保持している
    When POST /api/v1/books を送信する
    Then HTTP 403 と problem+json（code: FORBIDDEN）が返る
```
