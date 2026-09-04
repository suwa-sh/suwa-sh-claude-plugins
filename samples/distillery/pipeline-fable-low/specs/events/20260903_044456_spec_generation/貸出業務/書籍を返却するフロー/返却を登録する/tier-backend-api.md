# 返却を登録する - Backend API仕様

## 変更概要

貸出コンテキスト（BC-003）に返却対象照会 API と返却登録 API を追加する。返却登録は単一トランザクションで貸出の返却済み遷移・書籍の状態遷移（在庫あり / 予約待ち）・イベント記録を行い、冪等キーで二重登録を防ぐ。予約の状態変更と返却通知の送信は行わない（UC「返却通知を送信する」の責務）。

## API 仕様

### 返却対象照会

- **メソッド**: GET
- **パス**: `/api/v1/returns/lookup`
- **認証**: Bearer（IdP 発行トークン）、利用者区分「司書」必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/returns/lookup.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| bookId | string (query) | Yes | 書籍 ID |

#### レスポンス（200 `ReturnLookupResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| loan | LoanSummary | 貸出中または延滞の貸出（loanId, userNumber, loanedOn, dueDate, status） |
| book | BookSummary | bookId, title, author, mediaType, status（`ON_LOAN` = 貸出中） |
| user | UserSummary | 貸出先利用者（userNumber, name） |
| nextBookStatus | string | 返却後に遷移する書籍の状態（`AVAILABLE`（在庫あり） / `RESERVED`（予約待ち）） |
| reservationCount | integer | 状態「予約中」の予約件数 |
| overdueDays | integer | 延滞日数（返却期限超過分。未超過は 0） |

#### エラーレスポンス（`application/problem+json`）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | bookId が欠落または形式不正 | `{code: "VALIDATION_ERROR", errors: [{field, message}]}` |
| 401 | トークン無し・無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が司書でない | `{code: "FORBIDDEN"}` |
| 404 | 書籍が存在しない | `{code: "BOOK_NOT_FOUND"}` |
| 409 | 書籍の状態が「貸出中」でない（貸出中の貸出が無い） | `{code: "BOOK_NOT_ON_LOAN", detail: "この書籍は貸出中ではありません"}` |

### 返却登録

- **メソッド**: POST
- **パス**: `/api/v1/loans/{loanId}/return`
- **認証**: Bearer、利用者区分「司書」必須。`Idempotency-Key` ヘッダ必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans/{loanId}/return.post` を参照

#### リクエスト（`ReturnLoanRequest`）

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| loanId | string (path) | Yes | 返却する貸出 ID |
| Idempotency-Key | string (header, UUID) | Yes | 冪等キー。同一キーの再送は初回結果を返す |
| （本文） | object | No | 本文なし（空 JSON を許容） |

#### レスポンス（200 `ReturnResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| loanId | string | 貸出 ID |
| bookId | string | 書籍 ID |
| userNumber | string | 利用者番号 |
| returnedOn | string (date) | 返却日（当日） |
| status | string | 貸出の状態（`RETURNED` = 返却済み） |
| bookStatus | string | 遷移後の書籍の状態（`AVAILABLE`（在庫あり） / `RESERVED`（予約待ち）） |
| hasReservation | boolean | 予約中の予約があるか（true なら返却通知の送信対象） |
| reservationCount | integer | 予約中の予約件数 |
| nextReservation | ReservationSummary | 予約順位 1 位の予約（reservationId, queuePosition, status）。無ければ null |
| book | BookSummary | 書籍要約 |
| user | UserSummary | 利用者要約 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | Idempotency-Key 欠落 / loanId 形式不正 | `{code: "VALIDATION_ERROR"}` |
| 401 / 403 | 未認証 / 司書以外 | `{code: "UNAUTHENTICATED"}` / `{code: "FORBIDDEN"}` |
| 404 | 貸出が存在しない | `{code: "LOAN_NOT_FOUND"}` |
| 409 | 貸出の状態が「返却済み」 | `{code: "LOAN_ALREADY_RETURNED", detail: "この貸出は返却済みです"}` |
| 409 | 同一 Idempotency-Key で異なるリクエスト | `{code: "IDEMPOTENCY_KEY_CONFLICT"}` |
| 409 | 楽観ロック競合（loans / books の version 不一致） | `{code: "CONCURRENT_UPDATE"}`（クライアントは照会からやり直す） |

## データモデル変更

### loans（貸出 E-004）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR | ON_LOAN（貸出中） / OVERDUE（延滞） → RETURNED（返却済み） に更新 | 変更 |
| version | INT | 楽観ロックで +1 | 変更 |
| updated_at | TIMESTAMP | 更新日時 | 変更 |

### loan_events（貸出イベント）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出 ID | 追加（本 UC で INSERT） |
| event_type | VARCHAR | `RETURNED` | 追加 |
| occurred_at | TIMESTAMP | 返却日時（返却日はこの日付で導出） | 追加 |
| actor_user_number | VARCHAR | 記録した司書の利用者番号 | 追加 |
| idempotency_key | VARCHAR | 冪等キー（UNIQUE） | 追加 |

### books（書籍 E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR | ON_LOAN（貸出中） → AVAILABLE（在庫あり） / RESERVED（予約待ち） に更新 | 変更 |
| version | INT | 楽観ロックで +1 | 変更 |

### book_events（書籍イベント）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍 ID | 追加（本 UC で INSERT） |
| event_type | VARCHAR | `RETURNED` | 追加 |
| occurred_at | TIMESTAMP | 発生日時 | 追加 |
| related_id | VARCHAR | loan_id | 追加 |

### reservations（予約 E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR | `RESERVED`（予約中） の件数と順位 1 位を参照する（更新しない） | 参照のみ |

## ビジネスルール

- 返却後の書籍状態判定: 対象書籍に状態「予約中」の予約が 1 件以上あれば書籍を「予約待ち」、0 件なら「在庫あり」に遷移させる。貸出の状態は「貸出中」「延滞」のいずれからも「返却済み」に遷移させる
- 返却対象の特定: `loans WHERE book_id = ? AND current_status IN ('ON_LOAN','OVERDUE')` は書籍ごとに高々 1 件。0 件なら `BOOK_NOT_ON_LOAN`
- 返却日は返却イベント（loan_events.event_type = 'RETURNED'）の occurred_at の日付で管理し、loans にカラムを追加しない（arch E-004）
- 状態遷移はすべて同一トランザクション内で行う（loans UPDATE、loan_events INSERT、books UPDATE、book_events INSERT。LP-005 / SP-018）。貸出行と書籍行は `SELECT ... FOR UPDATE` で確保し、`version` で楽観ロックする（LP-013）
- 予約の状態（予約中 → 通知済み）と通知レコードの作成は本 UC では行わない。`hasReservation = true` を返し、司書が UC「返却通知を送信する」で確定する
- 返却により書籍の状態が変わるため、参照系キャッシュ（書籍詳細・在庫状況）の当該書籍を無効化する（LP-017）
- 冪等性: `Idempotency-Key` を `loan_events.idempotency_key` に保存し、同一キーの再送は保存済みの返却結果を 200 で返す（LR-002）
- 認可: プレゼンテーション層はトークンの利用者区分クレームが「司書」であることを検証する（LP-003）
- 監査ログ: ユースケース層でデータ更新（E-004 / E-001）を記録する（LP-006 / SR-010）。ログに氏名・連絡先を出力しない

## ティア完了条件（BDD）

```gherkin
Feature: 返却を登録する - Backend API

  Scenario: 予約のない貸出の返却を登録する
    Given 書籍「B-000456」が「貸出中」で貸出「L-0001」（U-000123）が「貸出中」
    And 書籍「B-000456」に予約中の予約が無く本日が 2026-09-10
    When 司書トークンで POST /api/v1/loans/L-0001/return を Idempotency-Key "r-1" 付きで送る
    Then HTTP 200 で status "RETURNED"、returnedOn "2026-09-10"、bookStatus "AVAILABLE"、hasReservation false が返る
    And loans.current_status が "RETURNED"、books.current_status が "AVAILABLE" になる
    And loan_events に返却イベント、book_events に返却イベントが 1 件ずつ記録される

  Scenario: 予約のある貸出の返却で書籍を予約待ちにする
    Given 書籍「B-000789」が「貸出中」で貸出「L-0002」が「貸出中」
    And 「U-000200」の予約が順位 1（予約中）、「U-000300」の予約が順位 2（予約中）
    When 司書トークンで POST /api/v1/loans/L-0002/return を送る
    Then HTTP 200 で bookStatus "RESERVED"、hasReservation true、reservationCount 2、nextReservation.queuePosition 1 が返る
    And reservations の current_status は変更されない

  Scenario: 返却対象照会で貸出中でない書籍は 409 を返す
    Given 書籍「B-000456」が「在庫あり」
    When 司書トークンで GET /api/v1/returns/lookup?bookId=B-000456 を送る
    Then HTTP 409 で problem+json の code "BOOK_NOT_ON_LOAN" が返る

  Scenario: 返却済みの貸出は 409 を返す
    Given 貸出「L-0001」が「返却済み」
    When 司書トークンで POST /api/v1/loans/L-0001/return を送る
    Then HTTP 409 で code "LOAN_ALREADY_RETURNED" が返る

  Scenario: 利用者区分が利用者のトークンでは 403 を返す
    Given 利用者区分「利用者」のトークンを持つ
    When POST /api/v1/loans/L-0001/return を送る
    Then HTTP 403 で code "FORBIDDEN" が返る

  Scenario: 同一 Idempotency-Key の再送は同じ結果を返す
    Given Idempotency-Key "r-1" で POST /api/v1/loans/L-0001/return が HTTP 200 を返済み
    When 同じ Idempotency-Key "r-1" で再送する
    Then HTTP 200 で同一の returnedOn が返り loan_events の返却イベントは 1 件のままである
```
