# 予約を登録する - バックエンド API 仕様

## 変更概要

予約コンテキスト（BC-004）に予約登録エンドポイントを追加する。予約可否条件・重複予約禁止条件を domain 層で判定し、予約順位決定条件に従って予約順位を採番して予約状態「予約中」の予約を登録する。冪等キーによる二重登録防止を usecase 層で行う。

## API 仕様

### 予約登録 API

- **メソッド**: POST
- **パス**: `/api/v1/reservations`
- **認証**: Bearer トークン（IdP 発行。API Gateway でトークン検証と粗粒度 RBAC。役割=利用者）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reservations.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id | string | Yes | 予約対象の書籍ID（body） |
| X-Idempotency-Key | string | Yes | 冪等キー（UUID。header。arch SR-002） |

利用者番号（user_no）はリクエストボディでは受け取らず、認証コンテキストから解決する（条件「個人情報参照可否条件」/ arch CLR-003）。

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| reservation_id | string | 予約ID |
| book_id | string | 予約対象の書籍ID |
| book_title | string | 書籍タイトル |
| user_no | string | 予約申込者の利用者番号（本人のみ） |
| applied_at | string(date-time) | 予約申込日時 |
| priority | integer | 予約順位 |
| reservation_status | string | 予約状態（予約中） |
| total_reservations | integer | 対象書籍の有効予約件数 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | book_id が未指定または形式不正 | `{"code":"INVALID_REQUEST","message":"書籍IDを指定してください"}` |
| 401 | トークン未提示・失効 | `{"code":"UNAUTHENTICATED","message":"ログインが必要です"}` |
| 404 | 指定した書籍が存在しない | `{"code":"BOOK_NOT_FOUND","message":"対象の書籍が見つかりません"}` |
| 409 | 予約可否条件に違反（書籍状態が「在庫あり」） | `{"code":"RESERVATION_NOT_ALLOWED","message":"この本は予約せずにそのまま借りられます"}` |
| 409 | 予約可否条件に違反（書籍状態が「予約待ち」） | `{"code":"RESERVATION_NOT_ALLOWED_ON_HOLD","message":"この本は取置き中のため予約を受け付けられません"}` |
| 409 | 重複予約禁止条件に違反（同一利用者の「予約中」「取置き中」予約が存在） | `{"code":"DUPLICATE_RESERVATION","message":"この本はすでに予約済みです"}` |

同一 `X-Idempotency-Key` の再送は、初回登録結果と同じ 201 レスポンスを返す（新規登録は行わない）。

## 非同期イベント（該当する場合）

この UC では非同期イベントを発行しない。取置き案内の発行は UC「取置き通知メールを送信する」の責務とする。

## データモデル変更

### reservations（情報: 予約 / E-005）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id | VARCHAR | 予約ID（主キー） | 追加（INSERT 対象） |
| book_id | VARCHAR | 予約対象の書籍ID | 追加（INSERT 対象） |
| user_no | VARCHAR | 予約申込者の利用者番号 | 追加（INSERT 対象） |
| applied_at | TIMESTAMP | 予約申込日時。予約順位の昇順ソートキー | 追加（INSERT 対象） |
| priority | INT | 予約順位 | 追加（INSERT 対象） |
| reservation_status | VARCHAR | 予約状態。本 UC では「予約中」を設定 | 追加（INSERT 対象） |
| hold_expires_at | TIMESTAMP | 取置き期限。本 UC では NULL | 追加（NULL のまま） |

### books（情報: 書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID | 参照のみ |
| book_status | VARCHAR | 書籍状態。予約可否条件の判定に参照する | 参照のみ（更新しない） |

書籍状態は蔵書コンテキスト（BC-001）が唯一の更新責任を持つため、本 UC では更新しない。

### users（情報: 利用者 / E-002）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_status | VARCHAR | 利用者状態。「登録済み」から「取引進行中」へ更新（既に取引進行中なら変更なし） | 変更（UPDATE） |
| updated_at | TIMESTAMP | 最終更新日時 | 変更（UPDATE） |

## ビジネスルール

- 予約可否条件: 書籍状態が「貸出中」の書籍に対してのみ予約を受け付ける。「在庫あり」の書籍への予約申込は受け付けず、予約せずに貸出できる旨を案内する
- 重複予約禁止条件: 同一利用者が同一書籍に対して予約状態が「予約中」または「取置き中」の予約を既に持つ場合、再度の申込を受け付けない
- 予約順位決定条件: 同一書籍への予約は申込日時の昇順で順位を付与する。予約状態が「貸出済み」「キャンセル」の予約は順位対象から除外する
- 予約順位の採番と登録は単一トランザクションで行い、同一書籍への同時申込でも順位が重複しないよう `(book_id, reservation_status)` の集計と INSERT を直列化する
- 予約申込者は認証コンテキストの利用者番号に固定し、他利用者の代理登録は受け付けない（条件「個人情報参照可否条件」）
- 個人情報（氏名・メールアドレス）はレスポンスに含めない（NFR E.1.2.1 / E.6.1.1）

## ティア完了条件（BDD）

```gherkin
Feature: 予約を登録する - バックエンド API

  Scenario: 貸出中の書籍への予約登録が 201 を返す
    Given 書籍 B-0001 の book_status が「貸出中」
    And 書籍 B-0001 に reservation_status が「予約中」の予約が 2 件存在する
    And 利用者番号 U-0001 のアクセストークンを保持している
    When POST /api/v1/reservations に {"book_id":"B-0001"} を送信する
    Then HTTP 201 が返る
    And レスポンスの reservation_status が「予約中」で priority が 3 である
    And reservations に 1 件 INSERT される

  Scenario: 在庫ありの書籍への予約登録が 409 を返す
    Given 書籍 B-0003 の book_status が「在庫あり」
    When POST /api/v1/reservations に {"book_id":"B-0003"} を送信する
    Then HTTP 409 が返り code が RESERVATION_NOT_ALLOWED である
    And reservations に INSERT されない

  Scenario: 重複予約が 409 を返す
    Given 利用者番号 U-0001 が書籍 B-0001 に reservation_status「予約中」の予約を持つ
    When POST /api/v1/reservations に {"book_id":"B-0001"} を送信する
    Then HTTP 409 が返り code が DUPLICATE_RESERVATION である
    And reservations の件数は変わらない

  Scenario: 同一冪等キーの再送で二重登録されない
    Given X-Idempotency-Key「11111111-1111-1111-1111-111111111111」で書籍 B-0001 の予約登録が成功している
    When 同じ X-Idempotency-Key で POST /api/v1/reservations に {"book_id":"B-0001"} を再送する
    Then HTTP 201 が返り初回と同一の reservation_id が返る
    And reservations の件数は 1 件のままである
```
