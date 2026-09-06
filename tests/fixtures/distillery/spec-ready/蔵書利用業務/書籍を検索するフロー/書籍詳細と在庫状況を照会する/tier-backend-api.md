# 書籍詳細と在庫状況を照会する - バックエンド API 仕様

## 変更概要

バックエンド API（tier-backend-api）の蔵書コンテキスト（BC-001）に、書籍 1 件の書誌情報と在庫状況を返す照会エンドポイントを追加する。書籍状態から在庫状況区分を導出し、予約待ち件数と次の行動の案内を併せて返す。予約件数は予約コンテキスト（BC-004）の公開インターフェース経由で取得する。

## API 仕様

### 書籍在庫状況照会 API

- **メソッド**: GET
- **パス**: `/api/v1/books/{book_id}/availability`
- **認証**: IdP 発行トークン（Bearer）。利用者ロール・司書ロールのいずれも利用できる
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{book_id}/availability.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id（パス） | string | Yes | 照会対象の書籍ID |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| book | BookSummary | 書誌情報（book_id / title / author / isbn / publisher / genre / material_type / book_status ほか） |
| availability | string | 在庫状況区分（在庫あり/貸出中/予約待ち。書籍状態から導出する） |
| reservation_count | integer | 予約状態が「予約中」「取置き中」の予約件数 |
| reservable | boolean | 予約導線を出してよいか（書籍状態が「貸出中」「予約待ち」のとき true） |
| guidance | string | 次の行動の案内文（在庫あり: 「予約せずにそのまま借りられます」など） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 404 | book_id に一致する書籍が存在しない（除籍済みを含む） | `{"code":"BOOK_NOT_FOUND","message":"対象の書籍が見つかりません"}` |
| 500 | データストア障害 | `{"code":"INTERNAL_ERROR","message":"在庫状況を取得できませんでした"}` |

## 非同期イベント（該当する場合）

なし（照会系 UC のためイベントは発行しない）。

## データモデル変更

### books（情報: 書籍 / エンティティ E-001 / 集約 AG-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（PK）。照会キー | 変更なし（参照のみ） |
| title / author / isbn / publisher / genre / material_type | VARCHAR | 書誌情報として返す | 変更なし（参照のみ） |
| book_status | VARCHAR | 書籍状態。在庫状況区分と reservable の導出元 | 変更なし（参照のみ） |

### reservations（情報: 予約 / エンティティ E-005 / 集約 AG-004）※参照のみ

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 対象書籍ID | 変更なし（参照のみ） |
| reservation_status | VARCHAR | 予約状態。「予約中」「取置き中」の件数を数える | 変更なし（参照のみ） |

必要なインデックス:

- `PRIMARY KEY (book_id)`（books） — 1 件取得の主キーアクセス
- `(book_id, reservation_status)`（reservations） — 予約待ち件数の集計

## ビジネスルール

- 在庫状況区分は書籍状態（在庫あり／貸出中／予約待ち）をそのまま用いる（書籍検索条件）
- `reservable` は書籍状態が「貸出中」「予約待ち」のとき true とする。「在庫あり」の書籍への予約申込は受け付けないため false とし、`guidance` で予約せずに借りられる旨を肯定形で案内する（予約可否条件の表示上の反映。実際の予約受付判定は「予約を登録する」UC が担う）
- 予約件数は予約状態が「予約中」「取置き中」の予約のみを数える（「貸出済み」「キャンセル」は除外する）
- 予約件数の取得は予約コンテキスト（BC-004）の公開インターフェース（ReservationQueryPort）経由で行い、reservations テーブルへ蔵書コンテキストから直接アクセスしない（arch「モジュール間の直接データアクセス禁止」）
- 個人情報を返さない: 予約者・貸出者の氏名や利用者番号はレスポンスへ含めない（個人情報参照可否条件、NFR E.1.2.1）
- 参照のみで書籍状態・予約状態を変更しない
- レスポンスタイム目標 5 秒以内（NFR B.2.1.1）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍詳細と在庫状況を照会する - バックエンド API

  Scenario: 在庫ありの書籍で予約不可として返す
    Given books の book_id「BK-001」の book_status が「在庫あり」で、reservations に有効な予約がない
    When 利用者ロールのトークンで GET /api/v1/books/BK-001/availability を実行する
    Then HTTP 200 が返り、availability が「在庫あり」、reservable が false、reservation_count が 0 になる

  Scenario: 貸出中の書籍で予約可能として返す
    Given books の book_id「BK-002」の book_status が「貸出中」で、reservations に予約状態「予約中」が 2 件ある
    When 利用者ロールのトークンで GET /api/v1/books/BK-002/availability を実行する
    Then HTTP 200 が返り、availability が「貸出中」、reservable が true、reservation_count が 2 になる

  Scenario: キャンセル済みの予約を件数に含めない
    Given books の book_id「BK-003」に reservations の予約状態「キャンセル」が 3 件、「予約中」が 1 件ある
    When 利用者ロールのトークンで GET /api/v1/books/BK-003/availability を実行する
    Then HTTP 200 が返り、reservation_count が 1 になる

  Scenario: 存在しない書籍の照会を拒否する
    Given books に book_id「BK-999」が存在しない
    When 利用者ロールのトークンで GET /api/v1/books/BK-999/availability を実行する
    Then HTTP 404 が返り、code が「BOOK_NOT_FOUND」になる
```
