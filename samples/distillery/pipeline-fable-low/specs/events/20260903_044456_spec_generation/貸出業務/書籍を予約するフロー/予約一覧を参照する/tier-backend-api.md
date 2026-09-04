# 予約一覧を参照する - Backend API仕様

## 変更概要

予約コンテキスト（BC-004）に書籍別予約一覧 API を追加する。司書区分限定の読み取り API で、有効予約（予約中・通知済み）を予約順位順に返し、`includeClosed` で取消・終了を含める。offset ページネーション（page / pageSize 既定 20、上限 100）と totalCount を返す（_inference 確認項目 4）。

## API 仕様

### 書籍別予約一覧

- **メソッド**: GET
- **パス**: `/api/v1/books/{bookId}/reservations`
- **認証**: Bearer（IdP 発行トークン）、利用者区分「司書」必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{bookId}/reservations.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| bookId | string (path) | Yes | 書籍 ID |
| includeClosed | boolean (query) | No | 取消・終了した予約を含めるか（既定 false） |
| page | integer (query) | No | ページ番号（1 始まり。既定 1） |
| pageSize | integer (query) | No | 1 ページ件数（既定 20、上限 100） |

#### レスポンス（200 `BookReservationPageResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| book | BookSummary | bookId, title, author, mediaType, status |
| items | ReservationListItem[] | reservationId, queuePosition, userNumber, userName, acceptedAt, status, notifiedAt, cancelledAt |
| page | integer | ページ番号 |
| pageSize | integer | 1 ページ件数 |
| totalCount | integer | 条件に合致する予約の総件数 |
| waitingCount | integer | 有効予約（予約中・通知済み）の件数（includeClosed に依らない） |

#### エラーレスポンス（`application/problem+json`）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | page < 1 / pageSize が 1〜100 の範囲外 / bookId 形式不正 | `{code: "VALIDATION_ERROR", errors: [{field, message}]}` |
| 401 | トークン無し・無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が司書でない | `{code: "FORBIDDEN"}` |
| 404 | 書籍が存在しない | `{code: "BOOK_NOT_FOUND"}` |

## データモデル変更

### reservations（予約 E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id / current_status / queue_position / accepted_at / user_number | — | 一覧の取得条件と表示項目（参照のみ） | 参照のみ |

### reservation_events（予約イベント）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id / event_type / occurred_at | — | 通知日時（event_type = 'NOTIFIED'）・取消日時（event_type = 'CANCELLED'）の導出（参照のみ） | 参照のみ |

### books（書籍 E-001）/ users（利用者 E-003）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| books.title / author / media_type / current_status | — | 書籍要約（参照のみ） | 参照のみ |
| users.user_number / name | — | 利用者列の氏名（参照のみ。連絡先は返さない） | 参照のみ |

## ビジネスルール

- 既定（`includeClosed = false`）は予約の状態が「予約中」「通知済み」の予約のみを予約順位昇順で返す
- `includeClosed = true` のときは有効予約を順位昇順で先に、取消・終了の予約を受付日時降順で後に並べる。取消・終了の queuePosition は最終順位（参考値）
- `waitingCount` は常に有効予約の件数を返す（司書が待ち人数を即答するため）
- ページネーションは offset 方式。`pageSize` 既定 20、上限 100。`totalCount` を返す（SP-002 / SP-006）
- 氏名は返すが連絡先（メールアドレス・電話番号・住所）は返さない。連絡先が必要な場合は窓口利用状況照会画面（UC「利用者の利用状況を参照する」）を使う（NFR E.1.2.1）
- 認可: 司書区分のみ（LP-003）。利用者の自分の予約は `/api/v1/me/reservations`（UC「予約状況を参照する」）で参照する
- 監査ログ: ユースケース層でデータ参照（E-007 / E-003）を記録する（SR-010）。ログに氏名を出力しない
- 参照系のため KVS キャッシュの対象にしてよい（LP-017）が、予約の状態遷移（登録・通知・取消・終了）で当該書籍のキャッシュを無効化する

## ティア完了条件（BDD）

```gherkin
Feature: 予約一覧を参照する - Backend API

  Scenario: 有効な予約を順位順に返す
    Given 書籍「B-000789」に「U-000200」の予約が順位 1（通知済み）、「U-000300」の予約が順位 2（予約中）、「U-000400」の予約（取消）がある
    When 司書トークンで GET /api/v1/books/B-000789/reservations を送る
    Then HTTP 200 で items が 2 件、items[0].queuePosition 1、items[0].status "NOTIFIED"、items[1].queuePosition 2 が返る
    And totalCount 2、waitingCount 2、page 1、pageSize 20 が返る
    And items に email / phone / address は含まれない

  Scenario: 取消・終了を含めて返す
    Given 書籍「B-000789」に有効予約 2 件と取消 1 件がある
    When 司書トークンで GET /api/v1/books/B-000789/reservations?includeClosed=true を送る
    Then HTTP 200 で items が 3 件、items[2].status "CANCELLED"、totalCount 3、waitingCount 2 が返る

  Scenario: 存在しない書籍は 404 を返す
    Given 書籍「B-999999」が存在しない
    When 司書トークンで GET /api/v1/books/B-999999/reservations を送る
    Then HTTP 404 で problem+json の code "BOOK_NOT_FOUND" が返る

  Scenario: pageSize の上限を超えると 400 を返す
    Given 書籍「B-000789」が存在する
    When 司書トークンで GET /api/v1/books/B-000789/reservations?pageSize=101 を送る
    Then HTTP 400 で code "VALIDATION_ERROR" と errors[0].field "pageSize" が返る

  Scenario: 利用者区分が利用者のトークンでは 403 を返す
    Given 利用者区分「利用者」のトークンを持つ
    When GET /api/v1/books/B-000789/reservations を送る
    Then HTTP 403 で code "FORBIDDEN" が返る
```
