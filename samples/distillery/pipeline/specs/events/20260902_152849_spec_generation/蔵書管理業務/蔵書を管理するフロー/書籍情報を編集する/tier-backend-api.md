# 書籍情報を編集する - バックエンド API 仕様

## 変更概要

バックエンド API（tier-backend-api）の蔵書コンテキスト（BC-001）に、書籍 1 件の取得エンドポイントと書誌情報の更新エンドポイントを追加する。更新は楽観ロック（version）で競合を検出し、資料種別利用可否条件をドメイン層で強制する。書籍状態は本 UC では変更しない。

## API 仕様

### 書籍取得 API（編集用の現行値取得）

- **メソッド**: GET
- **パス**: `/api/v1/books/{book_id}`
- **認証**: IdP 発行トークン（Bearer）。司書ロールのみ
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{book_id}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id（パス） | string | Yes | 対象の書籍ID |

#### レスポンス

BookResponse（`book_id`, `title`, `author`, `isbn`, `publisher`, `genre`, `material_type`, `book_status`, `registered_at`, `updated_at`, `version`）を返す。`version` は楽観ロック用の更新世代番号。

### 書籍更新 API

- **メソッド**: PUT
- **パス**: `/api/v1/books/{book_id}`
- **認証**: IdP 発行トークン（Bearer）。司書ロールのみ
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{book_id}.put` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id（パス） | string | Yes | 対象の書籍ID |
| X-Idempotency-Key（ヘッダ） | string(uuid) | Yes | 二重送信防止の冪等キー |
| title | string | Yes | タイトル（255 文字以内） |
| author | string | Yes | 著者（255 文字以内） |
| isbn | string | No | ISBN（13 桁または 10 桁） |
| publisher | string | Yes | 出版社（255 文字以内） |
| genre | string | Yes | ジャンル（バリエーション「ジャンル」の値） |
| material_type | string | Yes | 資料種別（「紙書籍」のみ有効） |
| version | integer | Yes | 取得時の version（楽観ロック） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| book_id | string | 書籍ID |
| title / author / isbn / publisher / genre / material_type | string | 更新後の書誌情報 |
| book_status | string | 書籍状態（本 UC では変更されない） |
| registered_at | string(date-time) | 登録日時（変更しない） |
| updated_at | string(date-time) | 更新日時（更新時刻） |
| version | integer | 更新後の version（+1） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | 必須項目の欠落、文字数超過、ISBN 形式不正、genre / material_type がバリエーション外 | `{"code":"INVALID_PARAMETER","message":"入力内容を確認してください","details":[...]}` |
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作の権限がありません"}` |
| 404 | book_id に一致する書籍が存在しない | `{"code":"BOOK_NOT_FOUND","message":"対象の書籍が見つかりません"}` |
| 409 | version が一致しない（他の司書が先に更新） | `{"code":"CONFLICT","message":"他の担当者が更新しました。最新の内容を読み込んで操作し直してください"}` |
| 422 | 資料種別利用可否条件の違反（material_type が「電子書籍」） | `{"code":"MATERIAL_TYPE_NOT_SUPPORTED","message":"電子書籍は現在未対応です。紙書籍のみ登録できます"}` |
| 500 | データストア障害 | `{"code":"INTERNAL_ERROR","message":"書籍情報を更新できませんでした"}` |

## 非同期イベント（該当する場合）

なし（書誌情報の訂正は同期処理で完結し、通知も外部連携も伴わない）。

## データモデル変更

### books（情報: 書籍 / エンティティ E-001 / 集約 AG-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（PK） | 変更なし（WHERE 条件） |
| title | VARCHAR(255) | タイトル | 変更（UPDATE 対象） |
| author | VARCHAR(255) | 著者 | 変更（UPDATE 対象） |
| isbn | VARCHAR(20) NULL | ISBN | 変更（UPDATE 対象） |
| publisher | VARCHAR(255) | 出版社 | 変更（UPDATE 対象） |
| genre | VARCHAR | ジャンル | 変更（UPDATE 対象） |
| material_type | VARCHAR | 資料種別 | 変更（UPDATE 対象。「紙書籍」のみ） |
| book_status | VARCHAR | 書籍状態 | 変更なし（本 UC では更新しない） |
| registered_at | TIMESTAMP | 登録日時 | 変更なし |
| updated_at | TIMESTAMP | 更新日時 | 変更（更新時刻を設定） |
| version | INTEGER | 楽観ロック用の更新世代番号（arch リポジトリ層ルール「楽観ロックによる競合制御」に基づく） | 変更（+1） |

必要なインデックス:

- `PRIMARY KEY (book_id)` — 1 件取得・更新の主アクセスパターン（追加インデックス不要）

## ビジネスルール

- 資料種別利用可否条件: `material_type` が「紙書籍」のときのみ更新する。「電子書籍」への変更は 422 で拒否する。判定はドメイン層（`Book.updateBibliography`）で強制する
- 書籍状態（book_status）は本 UC で変更しない。書籍状態の遷移は貸出・返却・予約系 UC が担う
- 書籍ID・登録日時は変更できない（リクエストから受け取っても無視する）
- 楽観ロック: `UPDATE ... WHERE book_id = ? AND version = ?` で更新件数が 0 のときは 409 を返す。ゲートウェイ層で楽観ロック競合ログを出力する
- 冪等キー検証: 同一 `X-Idempotency-Key` の再送は更新処理を再実行せず、初回結果を返す
- 監査ログ: ユースケース層で「誰が」「どの書籍の」「どの項目を」更新したかを構造化ログに出力する

## ティア完了条件（BDD）

```gherkin
Feature: 書籍情報を編集する - バックエンド API

  Scenario: 著者を訂正して更新する
    Given books に book_id「BK-001」（author=「夏目 漱右」, version=1, book_status=在庫あり）が存在する
    When 司書ロールのトークンで PUT /api/v1/books/BK-001 に author「夏目漱石」と version=1 を送る
    Then HTTP 200 が返り、author が「夏目漱石」、version が 2、book_status が「在庫あり」のままになる

  Scenario: 存在しない書籍の更新を拒否する
    Given books に book_id「BK-999」が存在しない
    When 司書ロールのトークンで PUT /api/v1/books/BK-999 を送る
    Then HTTP 404 が返り、code が「BOOK_NOT_FOUND」になる

  Scenario: version 不一致で更新を拒否する
    Given books の book_id「BK-001」の version が 2 に更新されている
    When 司書ロールのトークンで PUT /api/v1/books/BK-001 に version=1 を送る
    Then HTTP 409 が返り、code が「CONFLICT」になり、books は更新されない

  Scenario: 資料種別を電子書籍へ変更する更新を拒否する
    Given books に book_id「BK-001」（material_type=紙書籍, version=1）が存在する
    When 司書ロールのトークンで PUT /api/v1/books/BK-001 に material_type「電子書籍」を送る
    Then HTTP 422 が返り、code が「MATERIAL_TYPE_NOT_SUPPORTED」になり、books は更新されない
```
