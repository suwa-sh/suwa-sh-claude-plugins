# 書籍を編集する - Backend API仕様

## 変更概要

蔵書コンテキスト（BC-001）モジュールに書籍取得 API `GET /api/v1/books/{bookId}` と書籍更新 API `PUT /api/v1/books/{bookId}` を追加する。
更新は楽観ロック（version）で同時更新を制御し、`books` UPDATE と `book_events` INSERT（属性変更）を 1 トランザクションで実行する。書籍の状態は変更しない。
`GET /api/v1/books/{bookId}` は「書籍詳細を参照する」UC（利用者経路）と共有し、司書経路では version を含む全属性を返す。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 書籍取得

- **メソッド**: GET
- **パス**: `/api/v1/books/{bookId}`
- **認証**: Bearer（司書 / 利用者）または未認証（匿名）。館内経路・公開経路の双方から到達可（公開経路は匿名 GET を許可。SP-003）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{bookId}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| bookId | string (path) | Yes | 書籍 ID |

#### レスポンス

`200 OK` — `BookDetailResponse`（本 UC が正本。「書籍を登録する」「書籍詳細を参照する」と共有）

| フィールド | 型 | 説明 |
|-----------|---|------|
| bookId | string | 書籍 ID |
| title / author / isbn / publisher | string | 書籍属性 |
| genreId / genreName | string | ジャンル |
| mediaType | string | `PAPER` / `ELECTRONIC` |
| status | string | `AVAILABLE` / `ON_LOAN` / `RESERVED` |
| waitingCount | integer | 予約待ち人数（予約状態が RESERVED / NOTIFIED の件数。登録直後は 0） |
| version | integer | 楽観ロック用バージョン（司書経路のみ返却） |
| registeredAt / updatedAt | string (date-time) | 登録日時 / 更新日時 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | bookId が形式不正 | `{ status: 400, code: "VALIDATION_ERROR" }` |
| 401 | トークン無し / 期限切れ | `{ status: 401, code: "UNAUTHENTICATED" }` |
| 404 | bookId が存在しない（削除済み含む） | `{ status: 404, code: "BOOK_NOT_FOUND" }` |
| 429 | 公開経路のレート制限超過（API Gateway SP-010） | `{ status: 429, code: "RATE_LIMITED" }` + `Retry-After` |

### 書籍更新

- **メソッド**: PUT
- **パス**: `/api/v1/books/{bookId}`
- **認証**: Bearer。API Gateway で利用者区分=司書の粗粒度 RBAC（館内経路のみ）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{bookId}.put` を参照

#### リクエスト

Content-Type: `application/json` — `UpdateBookRequest`。ヘッダ `Idempotency-Key`（必須）、`X-Trace-Id`（任意）。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| bookId | string (path) | Yes | 書籍 ID |
| title | string | Yes | タイトル（1〜200 文字） |
| author | string | Yes | 著者（1〜200 文字） |
| isbn | string | No | ISBN（ハイフンなしの 10 桁（末尾のみ `X` 可）/ 13 桁。ハイフン付き入力はフロントエンドが送信前に除去する）。null で消去 |
| publisher | string | No | 出版社（最大 200 文字）。null で消去 |
| genreId | string | Yes | ジャンル ID |
| mediaType | string | Yes | `PAPER` / `ELECTRONIC` |
| version | integer | Yes | 取得時の version（楽観ロック） |

#### レスポンス

`200 OK` — `BookDetailResponse`（version は +1、updatedAt は更新日時）

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | JSON 構文不正、Idempotency-Key 欠落 | `{ status: 400, code: "BAD_REQUEST" }` |
| 401 | トークン無し / 期限切れ | `{ status: 401, code: "UNAUTHENTICATED" }` |
| 403 | 利用者区分が司書でない | `{ status: 403, code: "FORBIDDEN" }` |
| 404 | bookId が存在しない | `{ status: 404, code: "BOOK_NOT_FOUND" }` |
| 409 | version が現在値と不一致 | `{ status: 409, code: "OPTIMISTIC_LOCK_CONFLICT", detail: "現在の version は n" }` |
| 409 | 貸出中・予約待ちの書籍を ELECTRONIC に変更 | `{ status: 409, code: "MEDIA_TYPE_CHANGE_NOT_ALLOWED" }` |
| 422 | 必須欠落・文字数超過・isbn 形式不正・enum 外 | `{ status: 422, code: "VALIDATION_ERROR", errors: [{ field, message }] }` |
| 422 | genreId が存在しない | `{ status: 422, code: "GENRE_NOT_FOUND", errors: [{ field: "genreId" }] }` |

## 非同期イベント（該当する場合）

該当なし。

## データモデル変更

### books（E-001 書籍 スナップショット）

定義は「書籍を登録する」を参照。本 UC は以下のカラムを更新する。

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| title / author / isbn / publisher / genre_id / media_type | - | 入力値で更新 | 更新 |
| title_normalized / author_normalized / publisher_normalized | VARCHAR(200) | 正規化列を再導出 | 更新 |
| version | INT | version + 1（WHERE version = :expected） | 更新 |
| updated_at | TIMESTAMP | 現在日時 | 更新 |
| current_status | VARCHAR(16) | 変更しない | 参照 |

### book_events（E-001 履歴側）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| event_type | VARCHAR(20) | 「UPDATED」を追加 | 追加（値） |
| payload | JSON | 変更前後の属性差分 | 参照 |

### genres（E-002 ジャンル）

参照のみ（存在確認）。

## ビジネスルール

- 楽観ロック: `UPDATE books ... WHERE book_id = ? AND version = ?` の更新件数が 0 の場合は競合例外とし 409 `OPTIMISTIC_LOCK_CONFLICT` を返す（LP-013）。競合は WARN ログに対象 book_id を含めて出力する（LP-018）
- 媒体種別判定: 状態が「在庫あり」の書籍のみ紙 ⇄ 電子の変更を受理する。貸出中・予約待ちの書籍を `ELECTRONIC` に変更する要求はドメイン例外（409 `MEDIA_TYPE_CHANGE_NOT_ALLOWED`）。電子 → 紙は状態を問わず受理する
- 状態不変: 本 UC は `current_status` を変更しない。`Book.updateAttributes()` は属性のみを更新し、状態遷移メソッドを呼ばない（LR-006）
- ジャンル存在判定: genreId は genres に存在すること。存在しない場合は 422 `GENRE_NOT_FOUND`
- 永続化: `bookRepository.save(book, expectedVersion)` は `book_events` INSERT（event_type=UPDATED、payload に変更前後差分）と `books` UPDATE を同一トランザクションで実行する（LR-008）
- 冪等性: `Idempotency-Key` を受け付け、同一キーの再送は最初の応答を返す（LR-002）
- キャッシュ: 更新後に `cache:books:*` と `cache:books:detail:{bookId}` を無効化する（LP-017）
- 監査ログ対象外（書籍は個人情報を含まない）。アクセスログのみ
- DB アクセスはパラメータ化クエリ必須（LR-013）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を編集する - Backend API

  Scenario: 書籍を取得する
    Given books に「B-0001 吾輩は猫である」（version 1、AVAILABLE）が存在する
    And 司書「佐藤花子」のアクセストークンを保持している
    When GET /api/v1/books/B-0001 を送信する
    Then HTTP 200 が返り、bookId が "B-0001"、version が 1、status が "AVAILABLE" である

  Scenario: version が一致する更新は成功し version が加算される
    Given books に「B-0001」（version 1）が存在する
    When PUT /api/v1/books/B-0001 を {title: "吾輩は猫である（新版）", author: "夏目漱石", genreId: "G-001", mediaType: "PAPER", version: 1} で送信する
    Then HTTP 200 が返り、title が「吾輩は猫である（新版）」、version が 2 である
    And book_events に event_type「UPDATED」の 1 行が追加される

  Scenario: version が不一致の更新は 409 を返す
    Given books に「B-0001」（version 2）が存在する
    When PUT /api/v1/books/B-0001 を version 1 で送信する
    Then HTTP 409 と problem+json（code: OPTIMISTIC_LOCK_CONFLICT）が返る
    And books の title と version は変化しない

  Scenario: 貸出中の書籍を電子に変更すると 409 を返す
    Given books に「B-0002」（current_status ON_LOAN、media_type PAPER、version 3）が存在する
    When PUT /api/v1/books/B-0002 を mediaType「ELECTRONIC」、version 3 で送信する
    Then HTTP 409 と problem+json（code: MEDIA_TYPE_CHANGE_NOT_ALLOWED）が返る

  Scenario: 存在しない書籍の更新は 404 を返す
    Given 司書「佐藤花子」のアクセストークンを保持している
    When PUT /api/v1/books/B-9999 を有効なボディで送信する
    Then HTTP 404 と problem+json（code: BOOK_NOT_FOUND）が返る
```
