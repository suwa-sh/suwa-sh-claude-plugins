# 予約状況を参照する - Backend API仕様

## 変更概要

予約コンテキスト（BC-004）に本人限定の予約一覧 API（`/api/v1/me/reservations`）を追加する。検索条件の利用者番号はトークンから取り出して固定し、クエリで他人の番号を指定できない（SP-016 / LP-007）。書籍ごとの待ち人数、通知日時・取消日時、取消可否を含めて返し、offset ページネーション（既定 20、上限 100）に対応する。

## API 仕様

### 自分の予約一覧

- **メソッド**: GET
- **パス**: `/api/v1/me/reservations`
- **認証**: Bearer（IdP 発行トークン）、利用者区分「利用者」必須（司書は 403。司書は `/api/v1/users/{userNumber}/usage` または `/api/v1/books/{bookId}/reservations` を使う）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/reservations.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| includeClosed | boolean (query) | No | 取消・終了した予約を含めるか（既定 false） |
| page | integer (query) | No | ページ番号（1 始まり。既定 1） |
| pageSize | integer (query) | No | 1 ページ件数（既定 20、上限 100） |

#### レスポンス（200 `MyReservationPageResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | MyReservationItem[] | reservationId, book(BookSummary), acceptedAt, queuePosition, totalWaiting, status, notifiedAt, cancelledAt, canCancel |
| page | integer | ページ番号 |
| pageSize | integer | 1 ページ件数 |
| totalCount | integer | 条件に合致する予約の総件数 |
| activeCount | integer | 本人の有効予約（予約中・通知済み）件数（includeClosed に依らない） |

`MyReservationItem.totalWaiting`: 当該書籍の有効予約件数。`canCancel`: 状態が予約中 / 通知済み。`notifiedAt` / `cancelledAt` は該当イベントがあるときのみ。

#### エラーレスポンス（`application/problem+json`）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | page < 1 / pageSize が 1〜100 の範囲外 / クエリに userNumber が含まれる | `{code: "VALIDATION_ERROR", errors: [{field, message}]}` |
| 401 | トークン無し・無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が「利用者」でない | `{code: "FORBIDDEN"}` |
| 429 | 公開経路のレート制限超過（API Gateway SP-010） | `{code: "RATE_LIMITED"}` + `Retry-After` |

## データモデル変更

### reservations（予約 E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_number / current_status / queue_position / accepted_at / book_id | — | 本人の予約の取得条件と表示項目、書籍ごとの有効予約件数（参照のみ） | 参照のみ |

### reservation_events（予約イベント）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id / event_type / occurred_at | — | 通知日時（event_type = 'NOTIFIED'）・取消日時（event_type = 'CANCELLED'）の導出（参照のみ） | 参照のみ |

### books（書籍 E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| title / author / media_type / current_status | — | 書籍要約（参照のみ） | 参照のみ |

## ビジネスルール

- 利用状況閲覧範囲判定: 検索条件の利用者番号はトークンの利用者番号に固定する。クエリで利用者番号を受け取らず、含まれていれば 400。利用者区分「司書」は 403
- 既定（`includeClosed = false`）は予約の状態が「予約中」「通知済み」のみ。並び順は通知済みを先頭、次に予約中を受付日時降順。`includeClosed = true` のときは取消・終了を末尾に受付日時降順で続ける
- `totalWaiting` は書籍ごとの有効予約件数（予約中・通知済み）。`queuePosition` と合わせて「N 人中 M 番目」を表示できるようにする
- `canCancel` は状態が「予約中」「通知済み」のとき true。実際の取消は UC「予約を取り消す」の `POST /api/v1/reservations/{reservationId}/cancel` で行い、そこで再度本人限定判定と状態検証を行う
- 通知日時・取消日時は予約イベント（通知 / 取消）の occurred_at で導出する（arch E-007）
- ページネーションは offset 方式。`pageSize` 既定 20、上限 100。`totalCount` を返す（SP-002）
- 応答に氏名・連絡先を含めない（本人分のみのため不要）。監査ログにデータ参照（E-007、本人）を記録する（SR-010）
- 参照系のため KVS キャッシュの対象にしてよい（LP-017）が、予約の状態遷移（登録・通知・取消・終了）で当該利用者のキャッシュを無効化する

## ティア完了条件（BDD）

```gherkin
Feature: 予約状況を参照する - Backend API

  Scenario: 本人の有効な予約を待ち人数つきで返す
    Given 利用者「U-000123」の予約「R-0003」（書籍「B-000789」）が順位 3（予約中）で書籍「B-000789」の有効予約が 3 件
    And 利用者「U-000123」の予約「R-0001」（書籍「B-000456」）が順位 1（通知済み、通知イベント 2026-09-10 09:00）
    And 利用者「U-000300」の予約「R-0002」が存在する
    When 利用者「U-000123」のトークンで GET /api/v1/me/reservations を送る
    Then HTTP 200 で items が 2 件（R-0001, R-0003 の順）、totalCount 2、activeCount 2 が返る
    And items[0].status "NOTIFIED"、notifiedAt "2026-09-10T09:00:00+09:00"、canCancel true が返る
    And items[1].queuePosition 3、totalWaiting 3、canCancel true が返る
    And items に「R-0002」は含まれない

  Scenario: 取消・終了を含めて返す
    Given 利用者「U-000123」の予約「R-0004」が「取消」（取消イベント 2026-09-05 12:00）
    When 利用者「U-000123」のトークンで GET /api/v1/me/reservations?includeClosed=true を送る
    Then HTTP 200 で items に R-0004 が status "CANCELLED"、cancelledAt "2026-09-05T12:00:00+09:00"、canCancel false で含まれる

  Scenario: クエリで他人の利用者番号を指定すると 400 を返す
    Given 利用者「U-000123」のトークンを持つ
    When GET /api/v1/me/reservations?userNumber=U-000300 を送る
    Then HTTP 400 で problem+json の code "VALIDATION_ERROR" と errors[0].field "userNumber" が返る

  Scenario: 司書トークンでは 403 を返す
    Given 利用者区分「司書」のトークンを持つ
    When GET /api/v1/me/reservations を送る
    Then HTTP 403 で code "FORBIDDEN" が返る

  Scenario: 予約がなければ空の一覧を返す
    Given 利用者「U-000500」に予約が無い
    When 利用者「U-000500」のトークンで GET /api/v1/me/reservations を送る
    Then HTTP 200 で items が 0 件、totalCount 0、activeCount 0 が返る
```
