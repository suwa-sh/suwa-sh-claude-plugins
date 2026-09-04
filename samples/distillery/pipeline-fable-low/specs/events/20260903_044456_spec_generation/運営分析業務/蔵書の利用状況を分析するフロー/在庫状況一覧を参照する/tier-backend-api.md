# 在庫状況一覧を参照する - Backend API仕様

## 変更概要

運営分析コンテキスト（BC-006）に読み取り API `GET /api/v1/reports/inventory` を追加する。蔵書コンテキスト（BC-001）の公開インタフェース経由で books の状態別件数と絞り込み一覧（ページネーション）を取得する（LR-003）。状態別件数は KVS に Cache-Aside（TTL 60 秒）で保持し、貸出・返却・予約取消の状態遷移時に無効化する（LP-017）。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 在庫状況一覧取得

- **メソッド**: GET
- **パス**: `/api/v1/reports/inventory`
- **認証**: Bearer（IdP 発行アクセストークン）。利用者区分 = 司書 のみ許可（LP-003 / SP-016）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reports/inventory.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| status | string (query) | No | 書籍の状態 enum: `AVAILABLE`（在庫あり）/ `ON_LOAN`（貸出中）/ `RESERVED`（予約待ち）。未指定はすべて |
| genreId | string (query) | No | ジャンル ID。未指定はすべて |
| page | integer (query) | No | ページ番号（1 始まり）。既定 1 |
| pageSize | integer (query) | No | 1 ページの件数。既定 20、上限 100 |

#### レスポンス

`InventoryResponse`

| フィールド | 型 | 説明 |
|-----------|---|------|
| summary.available | integer | 在庫ありの冊数（絞り込みに依らず全体） |
| summary.onLoan | integer | 貸出中の冊数 |
| summary.reserved | integer | 予約待ちの冊数 |
| summary.total | integer | 登録書籍の総数 |
| items | array | ページ内の書籍（タイトル昇順、同名は書籍 ID 昇順） |
| items[].bookId | string | 書籍 ID |
| items[].title | string | タイトル |
| items[].author | string | 著者 |
| items[].isbn | string | ISBN |
| items[].publisher | string | 出版社 |
| items[].genreId | string | ジャンル ID |
| items[].genreName | string | ジャンル名 |
| items[].mediaType | string | 媒体種別 enum: `PAPER`（紙）/ `ELECTRONIC`（電子） |
| items[].status | string | 書籍の状態 enum: `AVAILABLE`（在庫あり）/ `ON_LOAN`（貸出中）/ `RESERVED`（予約待ち） |
| page | integer | 要求ページ |
| pageSize | integer | 要求件数 |
| totalCount | integer | 絞り込み条件に一致する総件数 |

#### エラーレスポンス

`application/problem+json`（RFC 9457）+ 業務エラーコード

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | status が enum 外、page < 1、pageSize が 1〜100 外、genreId 形式不正 | `{code: "VALIDATION_ERROR", errors[{field, reason}]}` |
| 401 | トークン未提示 / 無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が司書でない | `{code: "FORBIDDEN"}`（監査ログに deny を記録） |

## 非同期イベント（該当する場合）

なし。

## データモデル変更

### books（情報: 書籍）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR(26) | 書籍 ID（PK） | 変更なし |
| title / author / isbn / publisher | VARCHAR | 表示属性 | 変更なし |
| genre_id | VARCHAR(26) | ジャンル ID（genres への参照）。絞り込み条件 | 変更なし |
| media_type | VARCHAR(8) | 媒体種別 enum: PAPER（紙）・ELECTRONIC（電子） | 変更なし |
| current_status | VARCHAR(16) | 書籍の状態 enum: AVAILABLE（在庫あり）・ON_LOAN（貸出中）・RESERVED（予約待ち）。件数集計と絞り込み条件 | 変更なし |
| INDEX(current_status, genre_id, title) | — | 状態 × ジャンルの絞り込みとタイトル順ページング | 追加 |

### genres（情報: ジャンル）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| genre_id / genre_name | VARCHAR | ジャンル名の表示 | 変更なし |

## ビジネスルール

- 条件「在庫状況判定」: 書籍の状態（在庫あり・貸出中・予約待ち）をそのまま在庫状況として返す。状態の解釈は domain `Book.inventoryStatus()` に閉じ、presentation で再判定しない
- 状態別件数（summary）は絞り込み条件に依らず全体を返す。KVS `cache:report:inventory-summary` に TTL 60 秒でキャッシュし、貸出登録・返却登録・予約取消・書籍登録/削除の状態遷移時に無効化する（LP-017）
- 一覧はページネーション必須（page / pageSize 既定 20 上限 100、totalCount を返す。arch SP-002）。並びはタイトル昇順・書籍 ID 昇順で安定させる
- 削除済み書籍は含めない
- 司書のみ利用可。認可判定結果をデータアクセス監査ログに記録する（SR-010）。応答 10 秒以内（NFR B.2.1.3）。DB アクセスはパラメータ化クエリ（LR-013）

## ティア完了条件（BDD）

```gherkin
Feature: 在庫状況一覧を参照する - Backend API

  Scenario: 状態別件数と 1 ページ目を返す
    Given 司書「S-0001」のアクセストークンを持つ
    And books に current_status が AVAILABLE（在庫あり）120 件、ON_LOAN（貸出中）45 件、RESERVED（予約待ち）8 件ある
    When GET /api/v1/reports/inventory?page=1&pageSize=20 を呼ぶ
    Then HTTP 200 で summary が {available: 120, onLoan: 45, reserved: 8, total: 173} である
    And items が 20 件・totalCount が 173 で、items はタイトル昇順である

  Scenario: 状態とジャンルで絞り込む
    Given 司書「S-0001」のアクセストークンを持つ
    And books に current_status=ON_LOAN かつ genre_id=G-01 の行が 12 件ある
    When GET /api/v1/reports/inventory?status=ON_LOAN&genreId=G-01&page=1&pageSize=20 を呼ぶ
    Then items が 12 件で全件 status=ON_LOAN・genreId=G-01、totalCount が 12 である
    And summary は絞り込みに依らず全体の件数である

  Scenario: pageSize の上限を超えると 400 を返す
    Given 司書「S-0001」のアクセストークンを持つ
    When GET /api/v1/reports/inventory?pageSize=101 を呼ぶ
    Then HTTP 400 と problem+json {code: "VALIDATION_ERROR", errors[0].field: "pageSize"} が返る

  Scenario: 貸出登録で summary キャッシュが無効化される
    Given KVS に cache:report:inventory-summary が存在する
    When 書籍「B-001」の貸出登録（在庫あり → 貸出中）がコミットされる
    Then cache:report:inventory-summary は削除され、次回の GET /api/v1/reports/inventory で再集計される
```
