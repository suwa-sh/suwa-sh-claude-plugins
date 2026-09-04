# 自分の予約順位を照会する - バックエンド API 仕様

## 変更概要

予約コンテキスト（BC-004）に、本人の予約 1 件の予約順位を返す照会エンドポイントを追加する。個人情報参照可否条件を満たすため、認証コンテキストの利用者番号と一致する予約のみを対象とし、不一致の場合は存在を秘匿して 404 を返す。

## API 仕様

### 自分の予約順位照会 API

- **メソッド**: GET
- **パス**: `/api/v1/me/reservations/{reservation_id}/rank`
- **認証**: Bearer トークン（IdP 発行。API Gateway でトークン検証と粗粒度 RBAC。役割=利用者）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/reservations/{reservation_id}/rank.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| reservation_id | string | Yes | 照会対象の予約ID（path） |

利用者番号は認証コンテキストから解決し、リクエストでは受け取らない（条件「個人情報参照可否条件」/ arch CLR-003）。

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| reservation_id | string | 予約ID |
| book_id | string | 予約対象の書籍ID |
| book_title | string | 書籍タイトル |
| book_author | string | 著者 |
| book_genre | string | ジャンル |
| book_material_type | string | 資料種別 |
| book_status | string | 書籍状態 |
| reservation_status | string | 予約状態（予約中 / 取置き中 / 貸出済み / キャンセル） |
| priority | integer | 予約順位。予約状態が「貸出済み」「キャンセル」の場合は null |
| waiting_ahead | integer | 自分より前に待っている人数（予約順位 - 1）。順位対象外の場合は null |
| total_reservations | integer | 対象書籍の有効予約件数 |
| applied_at | string(date-time) | 予約申込日時 |
| hold_expires_at | string(date-time) | 取置き期限。予約状態が「取置き中」のときのみ設定 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | reservation_id の形式不正 | `{"code":"INVALID_REQUEST","message":"予約IDの形式が不正です"}` |
| 401 | トークン未提示・失効 | `{"code":"UNAUTHENTICATED","message":"ログインが必要です"}` |
| 404 | 予約が存在しない、または本人の予約でない | `{"code":"RESERVATION_NOT_FOUND","message":"対象の予約が見つかりません"}` |

他利用者の予約に対しては 403 ではなく 404 を返し、予約 ID の存在有無を秘匿する（NFR E.1.2.1）。

## 非同期イベント（該当する場合）

この UC では非同期イベントを発行しない。

## データモデル変更

### reservations（情報: 予約 / E-005）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id | VARCHAR | 予約ID | 参照のみ |
| user_no | VARCHAR | 本人限定参照の判定に使用 | 参照のみ |
| priority | INT | 予約順位 | 参照のみ |
| reservation_status | VARCHAR | 予約状態 | 参照のみ |
| applied_at | TIMESTAMP | 予約申込日時 | 参照のみ |
| hold_expires_at | TIMESTAMP | 取置き期限 | 参照のみ |

### books（情報: 書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id / title / author / genre / material_type / book_status | VARCHAR | 予約対象書籍の表示項目 | 参照のみ |

本 UC は参照のみで、テーブルの更新は行わない。

## ビジネスルール

- 個人情報参照可否条件: 予約状況の照会は、ログイン中の利用者本人に紐づく予約のみを対象とする。他利用者の予約は 404 として扱う
- 予約順位決定条件: 予約状態が「貸出済み」「キャンセル」の予約は順位対象外とし、`priority` と `waiting_ahead` を null で返す
- `waiting_ahead` は `priority - 1` で算出する
- `total_reservations` は同一 `book_id` で予約状態が「予約中」「取置き中」の件数とする
- レスポンスに他利用者の氏名・メールアドレス・利用者番号を含めない（NFR E.1.2.1 / E.6.1.1）
- 有効予約件数は書籍単位で変動が緩やかなため、KVS の参照キャッシュ（TTL 60 秒）を許容する。予約登録・取消時はキャッシュを破棄する（NFR B.2.1.1 レスポンス 5 秒以内）

## ティア完了条件（BDD）

```gherkin
Feature: 自分の予約順位を照会する - バックエンド API

  Scenario: 本人の予約中の予約で順位が返る
    Given 予約 R-0007 は user_no が U-0001 で reservation_status が「予約中」・priority が 3 である
    And 書籍 B-0001 の有効予約が 5 件存在する
    And 利用者番号 U-0001 のアクセストークンを保持している
    When GET /api/v1/me/reservations/R-0007/rank を送信する
    Then HTTP 200 が返る
    And priority が 3、waiting_ahead が 2、total_reservations が 5 である

  Scenario: 取置き中の予約で取置き期限が返る
    Given 予約 R-0100 は user_no が U-0002 で reservation_status が「取置き中」・hold_expires_at が 2026-09-09T23:59:59+09:00 である
    And 利用者番号 U-0002 のアクセストークンを保持している
    When GET /api/v1/me/reservations/R-0100/rank を送信する
    Then HTTP 200 が返り reservation_status が「取置き中」である
    And hold_expires_at が 2026-09-09T23:59:59+09:00 で返る

  Scenario: 他利用者の予約は 404 になる
    Given 予約 R-0500 は user_no が U-0002 の予約である
    And 利用者番号 U-0001 のアクセストークンを保持している
    When GET /api/v1/me/reservations/R-0500/rank を送信する
    Then HTTP 404 が返り code が RESERVATION_NOT_FOUND である
    And レスポンスに他利用者の情報は含まれない

  Scenario: キャンセル済みの予約は順位が null で返る
    Given 予約 R-0300 は user_no が U-0001 で reservation_status が「キャンセル」である
    When GET /api/v1/me/reservations/R-0300/rank を送信する
    Then HTTP 200 が返り reservation_status が「キャンセル」である
    And priority と waiting_ahead が null である
```
