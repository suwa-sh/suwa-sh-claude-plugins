# 書籍詳細を参照する - Backend API仕様

## 変更概要

蔵書コンテキスト（BC-001）モジュールの書籍取得 API `GET /api/v1/books/{bookId}` を、利用者経路（公開 API Gateway、匿名可）からも到達可能にし、応答に予約待ち人数 `waitingCount` を追加する。
`waitingCount` は予約コンテキスト（BC-004）の公開インタフェース（countActiveReservations）経由で取得する（LR-003）。書籍詳細は Cache-Aside で KVS に保持する（LP-017）。
レスポンスは経路によらず「書籍を編集する」で定義した単一スキーマ `BookDetailResponse`（waitingCount 必須、version は司書経路のみ返却）を返す。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 書籍詳細取得（書籍取得と共有）

- **メソッド**: GET
- **パス**: `/api/v1/books/{bookId}`
- **認証**: Bearer（司書 / 利用者）。公開経路は匿名 GET を許可（SP-003）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{bookId}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| bookId | string (path) | Yes | 書籍 ID |
| X-Trace-Id | string (header) | No | trace_id |

#### レスポンス

`200 OK` — `BookDetailResponse`（「書籍を編集する」の BookDetailResponse 定義を参照）

| フィールド | 型 | 説明 |
|-----------|---|------|
| bookId | string | 書籍 ID |
| title | string | タイトル |
| author | string | 著者 |
| isbn | string \| null | ISBN |
| publisher | string \| null | 出版社 |
| genreId | string | ジャンル ID |
| genreName | string | ジャンル名 |
| mediaType | string | `PAPER` / `ELECTRONIC` |
| status | string | `AVAILABLE` / `ON_LOAN` / `RESERVED`（在庫状況判定） |
| waitingCount | integer | 予約待ち人数（予約の状態が予約中・通知済みの件数） |
| version | integer | 楽観ロック用バージョン（司書経路のみ。公開経路では省略） |
| registeredAt | string (date-time) | 登録日時 |
| updatedAt | string (date-time) | 更新日時 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | bookId が形式不正 | `{ status: 400, code: "VALIDATION_ERROR" }` |
| 401 | 館内経路でトークン無し / 期限切れ | `{ status: 401, code: "UNAUTHENTICATED" }` |
| 404 | bookId が存在しない（削除済み含む） | `{ status: 404, code: "BOOK_NOT_FOUND" }` |
| 429 | 公開経路のレート制限超過 | `{ status: 429, code: "RATE_LIMITED" }` |

## 非同期イベント（該当する場合）

該当なし（参照系 UC）。

## データモデル変更

### books（E-001 書籍 スナップショット）

参照のみ。定義は「書籍を登録する」を参照。

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR(32) | PK | 参照 |
| title / author / isbn / publisher / genre_id / media_type / current_status / updated_at | - | 詳細表示 | 参照 |

### genres（E-002 ジャンル）

参照のみ（JOIN で genre_name 取得）。

### reservations（E-007 予約。BC-004 所有。参照のみ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR(32) | 対象書籍 ID | 参照（COUNT 条件） |
| current_status | VARCHAR(16) | 予約の状態（RESERVED = 予約中 / NOTIFIED = 通知済み / CANCELLED = 取消 / CLOSED = 終了） | 参照（COUNT 条件） |

テーブル定義の正本は予約 UC（予約を登録する）。本 UC は予約 BC の公開 IF 経由で件数のみ取得し、予約テーブルを直接参照しない。

## ビジネスルール

- 在庫状況判定: `current_status` をそのまま返す。CTA の切替は画面側で行う
- 媒体種別判定: `ELECTRONIC` の書籍も詳細を返す（画面側で予約導線を出さない）
- 予約待ち人数: 予約コンテキストの公開 IF `countActiveReservations(bookId)` で予約の状態が「予約中」「通知済み」の件数を取得する（LR-003: 他 BC の repository を直接参照しない）。取消・終了は含めない（条件: 予約順位決定）
- 公開経路の応答は `version` を省略する（更新 API は公開経路に存在しないため）。個人情報は含まない（予約者の情報は返さない）
- Cache-Aside（LP-017）: キー `cache:books:detail:{bookId}`、TTL 60 秒。書籍の編集・削除・状態遷移、および対象書籍の予約登録・取消時に無効化する
- 監査ログ対象外（書籍は個人情報を含まない）。アクセスログのみ
- DB アクセスはパラメータ化クエリ必須（LR-013）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍詳細を参照する - Backend API

  Scenario: 在庫ありの書籍詳細を匿名で取得する
    Given books に「B-0001 吾輩は猫である」（AVAILABLE、PAPER、genre_id G-001）が存在する
    And reservations に「B-0001」の予約は存在しない
    When GET /api/v1/books/B-0001 を公開経路に匿名で送信する
    Then HTTP 200 が返り、status が "AVAILABLE"、genreName が「文学」、waitingCount が 0 である
    And レスポンスに version は含まれない

  Scenario: 予約待ちの書籍は予約中・通知済みの件数を waitingCount として返す
    Given books に「B-0003」（RESERVED）が存在する
    And reservations に「B-0003」の予約が RESERVED 2 件、NOTIFIED 1 件、CANCELLED 1 件存在する
    When GET /api/v1/books/B-0003 を送信する
    Then HTTP 200 が返り、waitingCount が 3 である

  Scenario: 司書経路では version を含めて返す
    Given books に「B-0001」（version 2）が存在する
    And 司書「佐藤花子」のアクセストークンを保持している
    When GET /api/v1/books/B-0001 を館内経路に送信する
    Then HTTP 200 が返り、version が 2 である

  Scenario: 2 回目の取得はキャッシュから返す
    Given GET /api/v1/books/B-0001 を送信し HTTP 200 を受け取っている
    When 60 秒以内に GET /api/v1/books/B-0001 を再送する
    Then HTTP 200 が返り、KVS「cache:books:detail:B-0001」がヒットし RDB への SELECT は実行されない

  Scenario: 存在しない書籍は 404 を返す
    Given books に「B-9999」は存在しない
    When GET /api/v1/books/B-9999 を公開経路に送信する
    Then HTTP 404 と problem+json（code: BOOK_NOT_FOUND）が返る
```
