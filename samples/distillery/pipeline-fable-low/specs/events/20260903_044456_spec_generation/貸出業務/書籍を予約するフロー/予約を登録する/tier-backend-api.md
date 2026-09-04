# 予約を登録する - Backend API仕様

## 変更概要

予約コンテキスト（BC-004）に予約可否照会 API と予約登録 API を追加する。予約登録は書籍行をロックして予約順位を採番し、単一トランザクションで予約の作成とイベント記録を行う。予約主体はトークンの利用者番号で確定し（SP-016 / LP-003）、冪等キーで二重登録を防ぐ。

## API 仕様

### 予約可否照会

- **メソッド**: GET
- **パス**: `/api/v1/books/{bookId}/reservation-eligibility`
- **認証**: Bearer（IdP 発行トークン）、利用者区分「利用者」（司書も照会可）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{bookId}/reservation-eligibility.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| bookId | string (path) | Yes | 書籍 ID |

#### レスポンス（200 `ReservationEligibilityResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| allowed | boolean | 予約可否 |
| reasonCode | string | 否のときの業務エラーコード（`BOOK_AVAILABLE_NOT_RESERVABLE` / `RESERVATION_ALREADY_EXISTS` / `MEDIA_TYPE_NOT_RESERVABLE`）。可のとき null |
| reasonMessage | string | 否の根拠（利用者向け文言） |
| waitingCount | integer | 当該書籍の有効予約（予約中・通知済み）件数 |
| expectedQueuePosition | integer | 可のとき付与見込みの予約順位（waitingCount + 1） |
| book | BookSummary | bookId, title, author, mediaType, status |
| existingReservation | ReservationSummary | 自分の有効予約が既にあるときその要約。無ければ null |

#### エラーレスポンス（`application/problem+json`）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | bookId 形式不正 | `{code: "VALIDATION_ERROR"}` |
| 401 | トークン無し・無効 | `{code: "UNAUTHENTICATED"}` |
| 404 | 書籍が存在しない | `{code: "BOOK_NOT_FOUND"}` |
| 429 | 公開経路のレート制限超過（API Gateway SP-010） | `{code: "RATE_LIMITED"}` + `Retry-After` |

### 予約登録

- **メソッド**: POST
- **パス**: `/api/v1/reservations`
- **認証**: Bearer、利用者区分「利用者」必須（予約主体 = トークンの利用者番号）。`Idempotency-Key` ヘッダ必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reservations.post` を参照

#### リクエスト（`CreateReservationRequest`）

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| Idempotency-Key | string (header, UUID) | Yes | 冪等キー。同一キーの再送は初回結果を返す |
| bookId | string | Yes | 予約する書籍 ID |

#### レスポンス（201 `ReservationResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| reservationId | string | 予約 ID |
| bookId | string | 書籍 ID |
| userNumber | string | 予約した利用者番号（トークン由来） |
| acceptedAt | string (date-time) | 受付日時 |
| queuePosition | integer | 予約順位 |
| waitingCount | integer | 登録後の有効予約件数（自分を含む） |
| status | string | 予約の状態（`RESERVED` = 予約中） |
| book | BookSummary | 書籍要約 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | bookId 欠落 / 形式不正 / Idempotency-Key 欠落 / 本文に userNumber が含まれる | `{code: "VALIDATION_ERROR"}` |
| 401 | 未認証 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が「利用者」でない（司書は予約主体になれない） | `{code: "FORBIDDEN"}` |
| 404 | 書籍が存在しない | `{code: "BOOK_NOT_FOUND"}` |
| 409 | 書籍の状態が「在庫あり」 | `{code: "BOOK_AVAILABLE_NOT_RESERVABLE", detail: "この書籍は在庫があります"}` |
| 409 | 同じ書籍に自分の有効予約が既にある | `{code: "RESERVATION_ALREADY_EXISTS", detail: "この書籍はすでに予約済みです"}` |
| 409 | 媒体種別が「電子」 | `{code: "MEDIA_TYPE_NOT_RESERVABLE", detail: "電子書籍は予約の対象外です"}` |
| 409 | 同一 Idempotency-Key で異なるリクエスト本文 | `{code: "IDEMPOTENCY_KEY_CONFLICT"}` |
| 409 | 順位採番の一意制約違反（同時申込） | `{code: "CONCURRENT_UPDATE"}`（クライアントは照会からやり直す） |
| 429 | 公開経路のレート制限超過（API Gateway SP-010） | `{code: "RATE_LIMITED"}` + `Retry-After` |

## データモデル変更

### reservations（予約 E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id | VARCHAR | 予約 ID（PK、ULID） | 追加（本 UC で INSERT） |
| book_id | VARCHAR | 書籍 ID（FK books） | 追加 |
| user_number | VARCHAR | 利用者番号（FK users。トークン由来） | 追加 |
| accepted_at | TIMESTAMP | 受付日時（予約順位の決定基準） | 追加 |
| queue_position | INT | 予約順位（同一書籍の有効予約内で一意） | 追加 |
| current_status | VARCHAR | 予約の状態（RESERVED（予約中）・NOTIFIED（通知済み）・CANCELLED（取消）・終了）。本 UC は `RESERVED`（予約中） | 追加 |
| version | INT | 楽観ロック | 追加 |
| updated_at | TIMESTAMP | 更新日時 | 追加 |
| UNIQUE(book_id, queue_position) WHERE current_status IN ('RESERVED','NOTIFIED') | — | 有効予約内の順位一意（部分一意インデックス。RDB が非対応なら採番を書籍行ロックで直列化） | 追加 |

### reservation_events（予約イベント）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_event_id | VARCHAR | PK | 追加 |
| reservation_id | VARCHAR | 予約 ID | 追加 |
| event_type | VARCHAR | `RESERVED`（他: NOTIFIED・CANCELLED・CLOSED） | 追加 |
| occurred_at | TIMESTAMP | 発生日時（= accepted_at） | 追加 |
| actor_user_number | VARCHAR | 操作者（利用者本人） | 追加 |
| idempotency_key | VARCHAR | 冪等キー（登録イベントのみ、UNIQUE） | 追加 |

### books（書籍 E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR | 予約可否判定に参照（ON_LOAN（貸出中） / RESERVED（予約待ち）のみ可）。更新しない | 参照のみ |

## ビジネスルール

- 予約可否判定: 書籍の状態が「貸出中」または「予約待ち」の場合のみ受け付ける。「在庫あり」は `BOOK_AVAILABLE_NOT_RESERVABLE`
- 媒体種別判定: 媒体種別「紙」のみ予約対象。「電子」は `MEDIA_TYPE_NOT_RESERVABLE`
- 予約順位決定: 受付日時の早い順に順位を付与する。`queue_position = MAX(有効予約の queue_position) + 1`（有効予約 = 予約中・通知済み。取消・終了は対象外）。採番は書籍行を `SELECT ... FOR UPDATE` で確保して直列化する
- 同一利用者の重複予約禁止: 同じ書籍に自分の有効予約があれば `RESERVATION_ALREADY_EXISTS`
- 予約主体はトークンの利用者番号のみ。本文の userNumber は受け付けず、司書トークンでは 403（RDRA アクター: 利用者が予約する）
- 書籍の状態は変更しない（貸出中のまま。返却登録時に「予約待ち」へ遷移する）
- 状態変更はすべて同一トランザクション内で行う（reservations INSERT、reservation_events INSERT。LP-005）
- 冪等性: `Idempotency-Key` を `reservation_events.idempotency_key` に保存し、同一キーの再送は保存済みの予約を 201 で返す（LR-002）
- 予約により書籍詳細の待ち人数が変わるため、参照系キャッシュの当該書籍を無効化する（LP-017）
- 監査ログ: ユースケース層でデータ更新（E-007）を記録する（LP-006 / SR-010）。ログに氏名・連絡先を出力しない

## ティア完了条件（BDD）

```gherkin
Feature: 予約を登録する - Backend API

  Scenario: 貸出中の書籍に予約を登録する
    Given 書籍「B-000789」（紙）が「貸出中」で有効な予約が無い
    And 利用者「U-000123」のトークンを持つ
    When POST /api/v1/reservations {bookId: "B-000789"} を Idempotency-Key "rs-1" 付きで送る
    Then HTTP 201 で userNumber "U-000123"、queuePosition 1、status "RESERVED" が返る
    And reservations に 1 件、reservation_events に登録イベントが 1 件記録される
    And books.current_status は "ON_LOAN" のままである

  Scenario: 予約待ちの書籍に予約すると末尾の順位が付与される
    Given 書籍「B-000789」が「予約待ち」で「U-000200」の予約が順位 1（通知済み）、「U-000300」の予約が順位 2（予約中）
    And 利用者「U-000123」のトークンを持つ
    When POST /api/v1/reservations {bookId: "B-000789"} を送る
    Then HTTP 201 で queuePosition 3、waitingCount 3 が返る

  Scenario: 予約可否照会で在庫ありの書籍は否を返す
    Given 書籍「B-000456」が「在庫あり」
    When 利用者トークンで GET /api/v1/books/B-000456/reservation-eligibility を送る
    Then HTTP 200 で allowed false、reasonCode "BOOK_AVAILABLE_NOT_RESERVABLE" が返る

  Scenario: 在庫ありの書籍への予約登録は 409 を返す
    Given 書籍「B-000456」が「在庫あり」
    When 利用者トークンで POST /api/v1/reservations {bookId: "B-000456"} を送る
    Then HTTP 409 で problem+json の code "BOOK_AVAILABLE_NOT_RESERVABLE" が返り reservations は追加されない

  Scenario: 同じ書籍への二重予約は 409 を返す
    Given 書籍「B-000789」に利用者「U-000123」の予約が「予約中」で存在する
    When 利用者「U-000123」のトークンで別の Idempotency-Key "rs-2" で POST /api/v1/reservations {bookId: "B-000789"} を送る
    Then HTTP 409 で code "RESERVATION_ALREADY_EXISTS" が返る

  Scenario: 司書トークンでは 403 を返す
    Given 利用者区分「司書」のトークンを持つ
    When POST /api/v1/reservations {bookId: "B-000789"} を送る
    Then HTTP 403 で code "FORBIDDEN" が返る

  Scenario: 同一 Idempotency-Key の再送は同じ結果を返す
    Given Idempotency-Key "rs-1" で POST /api/v1/reservations が HTTP 201 reservationId "R-0001" を返済み
    When 同じ本文と Idempotency-Key "rs-1" で再送する
    Then HTTP 201 で reservationId "R-0001" が返り reservations は 1 件のままである
```
