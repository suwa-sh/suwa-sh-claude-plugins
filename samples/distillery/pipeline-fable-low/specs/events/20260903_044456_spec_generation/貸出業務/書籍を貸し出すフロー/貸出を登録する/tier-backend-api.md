# 貸出を登録する - Backend API仕様

## 変更概要

貸出コンテキスト（BC-003）に貸出可否照会 API と貸出登録 API を追加する。貸出登録は単一トランザクションで貸出の作成・書籍の状態遷移・（予約待ち経由の場合）予約の終了と順位繰り上げを行い、冪等キーで二重登録を防ぐ。返却期限は現行世代の貸出期間から算出する。

## API 仕様

### 貸出可否照会

- **メソッド**: GET
- **パス**: `/api/v1/loans/eligibility`
- **認証**: Bearer（IdP 発行トークン）、利用者区分「司書」必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans/eligibility.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| userNumber | string (query) | Yes | 利用者番号 |
| bookId | string (query) | Yes | 書籍 ID |

#### レスポンス（200 `LoanEligibilityResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| allowed | boolean | 貸出可否 |
| reasonCode | string | 否のときの業務エラーコード（`BOOK_NOT_AVAILABLE` / `RESERVATION_PRIORITY_MISMATCH` / `MEDIA_TYPE_NOT_LOANABLE`）。可のとき null |
| reasonMessage | string | 否の根拠（利用者向け文言） |
| dueDate | string (date) | 可のときの返却期限（本日 + 貸出期間） |
| loanDays | integer | 適用する貸出期間（日数） |
| book | BookSummary | bookId, title, author, mediaType, status |
| user | UserSummary | userNumber, name |
| reservation | ReservationSummary | 予約待ち書籍のとき、当該利用者の予約（reservationId, queuePosition, status）。無ければ null |

#### エラーレスポンス（`application/problem+json`）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | userNumber / bookId が欠落または形式不正 | `{code: "VALIDATION_ERROR", errors: [{field, message}]}` |
| 401 | トークン無し・無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が司書でない | `{code: "FORBIDDEN"}` |
| 404 | 書籍が存在しない | `{code: "BOOK_NOT_FOUND"}` |
| 404 | 利用者が存在しない | `{code: "USER_NOT_FOUND"}` |

### 貸出登録

- **メソッド**: POST
- **パス**: `/api/v1/loans`
- **認証**: Bearer、利用者区分「司書」必須。`Idempotency-Key` ヘッダ必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans.post` を参照

#### リクエスト（`CreateLoanRequest`）

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| Idempotency-Key | string (header, UUID) | Yes | 冪等キー。同一キーの再送は初回結果を返す |
| userNumber | string | Yes | 貸出先の利用者番号 |
| bookId | string | Yes | 書籍 ID |

#### レスポンス（201 `LoanResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| loanId | string | 貸出 ID |
| bookId | string | 書籍 ID |
| userNumber | string | 利用者番号 |
| loanedOn | string (date) | 貸出日（当日） |
| dueDate | string (date) | 返却期限 |
| status | string | 貸出の状態（`ON_LOAN` = 貸出中） |
| recordedBy | string | 記録した司書の利用者番号 |
| bookStatus | string | 遷移後の書籍の状態（`ON_LOAN` = 貸出中） |
| book | BookSummary | 書籍要約 |
| user | UserSummary | 利用者要約 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | 必須欠落 / 形式不正 / Idempotency-Key 欠落 | `{code: "VALIDATION_ERROR"}` |
| 401 / 403 | 未認証 / 司書以外 | `{code: "UNAUTHENTICATED"}` / `{code: "FORBIDDEN"}` |
| 404 | 書籍または利用者が存在しない | `{code: "BOOK_NOT_FOUND"}` / `{code: "USER_NOT_FOUND"}` |
| 409 | 書籍の状態が「貸出中」 | `{code: "BOOK_NOT_AVAILABLE", detail: "この書籍は貸出中です"}` |
| 409 | 書籍が「予約待ち」で利用者が予約順位 1 位でない | `{code: "RESERVATION_PRIORITY_MISMATCH", detail: "この書籍は予約順位 1 位の利用者のみ貸出できます"}` |
| 409 | 媒体種別が「電子」 | `{code: "MEDIA_TYPE_NOT_LOANABLE", detail: "電子書籍は貸出の対象外です"}` |
| 409 | 同一 Idempotency-Key で異なるリクエスト本文 | `{code: "IDEMPOTENCY_KEY_CONFLICT"}` |
| 409 | 楽観ロック競合（books.version 不一致） | `{code: "CONCURRENT_UPDATE"}`（クライアントは判定からやり直す） |
| 500 | 現行世代の貸出期間が未設定 | `{code: "LOAN_PERIOD_NOT_CONFIGURED"}` |

## データモデル変更

### loans（貸出 E-004）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出 ID（PK、ULID） | 追加 |
| book_id | VARCHAR | 書籍 ID（FK books） | 追加 |
| user_number | VARCHAR | 利用者番号（FK users） | 追加 |
| loaned_on | DATE | 貸出日 | 追加 |
| due_date | DATE | 返却期限 | 追加 |
| current_status | VARCHAR | 貸出の状態（ON_LOAN（貸出中）・OVERDUE（延滞）・返却済み） | 追加 |
| recorded_by | VARCHAR | 記録した司書の利用者番号（FK users） | 追加 |
| version | INT | 楽観ロック | 追加 |
| updated_at | TIMESTAMP | 更新日時 | 追加 |

### loan_events（貸出イベント。E-004 event_snapshot のイベント側）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_event_id | VARCHAR | PK | 追加 |
| loan_id | VARCHAR | 貸出 ID | 追加 |
| event_type | VARCHAR | REGISTERED・OVERDUE・RETURNED | 追加 |
| occurred_at | TIMESTAMP | 発生日時 | 追加 |
| actor_user_number | VARCHAR | 操作者（司書 / タイマー） | 追加 |
| idempotency_key | VARCHAR | 冪等キー（登録イベントのみ、UNIQUE） | 追加 |

### books（書籍 E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR | AVAILABLE（在庫あり） / RESERVED（予約待ち） → ON_LOAN（貸出中） に更新 | 変更 |
| version | INT | 楽観ロックで +1 | 変更 |

### book_events（書籍イベント）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_event_id | VARCHAR | PK | 追加 |
| book_id | VARCHAR | 書籍 ID | 追加 |
| event_type | VARCHAR | REGISTERED・LOANED・RETURNED・CANCELLED・DELETED | 追加 |
| occurred_at | TIMESTAMP | 発生日時 | 追加 |
| related_id | VARCHAR | 関連 ID（loan_id 等） | 追加 |

### reservations（予約 E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR | NOTIFIED（通知済み） → CLOSED（終了） に更新（RESERVED（予約待ち）書籍の貸出時） | 変更 |
| queue_position | INT | 後続予約を -1 で繰り上げ | 変更 |

## ビジネスルール

- 貸出可否判定: 書籍の状態が「在庫あり」かつ利用者が登録済みなら可。「貸出中」は不可。「予約待ち」は当該書籍の予約順位 1 位（状態が通知済みまたは予約中）の利用者に限り可
- 媒体種別判定: 媒体種別「紙」のみ貸出対象。「電子」は登録のみ可能で貸出不可
- 返却期限算出: `due_date = loaned_on + loan_days`。`loan_days` は `loan_periods` の `valid_to IS NULL` かつ `valid_from <= loaned_on` の現行世代を使う。現行世代が無い場合は 500（`LOAN_PERIOD_NOT_CONFIGURED`）で登録しない
- 状態遷移はすべて同一トランザクション内で行う（貸出 INSERT、書籍 UPDATE、予約 UPDATE、イベント INSERT）。書籍行は `SELECT ... FOR UPDATE` で確保し、`version` で楽観ロックする
- 予約待ち書籍を順位 1 位の利用者に貸し出した場合、その予約を「終了」に遷移させ、後続の予約中・通知済みの予約順位を 1 ずつ繰り上げる（条件: 予約順位決定）
- 「終了」への UPDATE は `WHERE reservation_id = ? AND version = ?` の楽観ロックで行い、更新件数 0 は `CONCURRENT_UPDATE` に変換する
- 繰り上げの更新順序: 部分一意インデックス `uq_reservations_book_id_queue_position` と衝突しないよう、対象行を `queue_position` 昇順に 1 行ずつ更新する（一括 UPDATE にしない）。各行の UPDATE では `version = version + 1` と `updated_at` も更新する
- 冪等性: `Idempotency-Key` を `loan_events.idempotency_key` に保存し、同一キーの再送は保存済みの貸出を 201 で返す
- 認可: プレゼンテーション層はトークンの利用者区分クレームが「司書」であることを検証し、`recorded_by` に司書の利用者番号を設定する
- 監査ログ: ユースケース層でデータ更新（E-004 / E-001 / E-007）を記録する。ログに氏名・連絡先を出力しない

## ティア完了条件（BDD）

```gherkin
Feature: 貸出を登録する - Backend API

  Scenario: 在庫ありの書籍の貸出を登録する
    Given 利用者「U-000123」が登録済みで書籍「B-000456」（紙）が「在庫あり」
    And 現行の貸出期間が 14 日で本日が 2026-09-03
    When 司書トークンで POST /api/v1/loans {userNumber: "U-000123", bookId: "B-000456"} を Idempotency-Key "k-1" 付きで送る
    Then HTTP 201 で status "ON_LOAN"、loanedOn "2026-09-03"、dueDate "2026-09-17"、bookStatus "ON_LOAN" が返る
    And loans に 1 件、loan_events に登録イベントが 1 件記録される
    And books.current_status が "ON_LOAN" になる

  Scenario: 貸出可否照会で貸出中の書籍は否を返す
    Given 書籍「B-000456」が「貸出中」
    When 司書トークンで GET /api/v1/loans/eligibility?userNumber=U-000123&bookId=B-000456 を送る
    Then HTTP 200 で allowed false、reasonCode "BOOK_NOT_AVAILABLE" が返る

  Scenario: 予約待ちの書籍を順位 1 位以外に登録すると 409 を返す
    Given 書籍「B-000789」が「予約待ち」で利用者「U-000200」の予約が順位 1
    When 司書トークンで POST /api/v1/loans {userNumber: "U-000300", bookId: "B-000789"} を送る
    Then HTTP 409 で problem+json の code "RESERVATION_PRIORITY_MISMATCH" が返る
    And loans は追加されない

  Scenario: 予約待ちの書籍を順位 1 位の利用者に登録すると予約が終了し順位が繰り上がる
    Given 書籍「B-000789」が「予約待ち」で「U-000200」の予約が順位 1（通知済み）、「U-000300」の予約が順位 2（予約中）
    When 司書トークンで POST /api/v1/loans {userNumber: "U-000200", bookId: "B-000789"} を送る
    Then HTTP 201 が返り「U-000200」の予約の current_status が "CLOSED" になる
    And 「U-000300」の予約の queue_position が 1 になる

  Scenario: 電子書籍は 409 を返す
    Given 書籍「B-000900」の媒体種別が「電子」
    When 司書トークンで POST /api/v1/loans {userNumber: "U-000123", bookId: "B-000900"} を送る
    Then HTTP 409 で code "MEDIA_TYPE_NOT_LOANABLE" が返る

  Scenario: 利用者区分が利用者のトークンでは 403 を返す
    Given 利用者区分「利用者」のトークンを持つ
    When POST /api/v1/loans {userNumber: "U-000123", bookId: "B-000456"} を送る
    Then HTTP 403 で code "FORBIDDEN" が返る

  Scenario: 同一 Idempotency-Key の再送は同じ結果を返す
    Given Idempotency-Key "k-1" で POST /api/v1/loans が HTTP 201 loanId "L-0001" を返済み
    When 同じ本文と Idempotency-Key "k-1" で POST /api/v1/loans を再送する
    Then HTTP 201 で loanId "L-0001" が返り loans は 1 件のままである
```
