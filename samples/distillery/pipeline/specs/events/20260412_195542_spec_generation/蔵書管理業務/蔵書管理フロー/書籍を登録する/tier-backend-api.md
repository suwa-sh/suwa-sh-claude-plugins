# 書籍を登録する - バックエンドAPI仕様

## 変更概要

書籍の新規登録 API エンドポイントを実装する。書籍情報を受け取り、「在庫あり」状態で永続化する。

## API 仕様

### 書籍登録 API

- **メソッド**: POST
- **パス**: /api/v1/books
- **認証**: OAuth2/OIDC (司書ロール必須)
- **冪等性**: X-Idempotency-Key ヘッダ任意（状態変更を伴うが新規作成のため冪等キーはオプション）
- **OpenAPI**: openapi.yaml の `paths./api/v1/books.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| title | string | Yes | 書籍タイトル。1-500文字 |
| author | string | Yes | 著者名。1-200文字 |
| isbn | string | Yes | ISBN-13形式 |
| publisher | string | Yes | 出版社名。1-200文字 |
| genre | string | Yes | 書籍ジャンル（文学/理工/児童書/社会科学/自然科学/芸術/その他） |
| material_type | string | Yes | 資料種別（紙書籍/電子書籍） |
| location | string | No | 配架場所。資料種別が紙書籍の場合は必須 |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| id | string | 書籍ID（UUID） |
| title | string | タイトル |
| author | string | 著者 |
| isbn | string | ISBN |
| publisher | string | 出版社 |
| genre | string | ジャンル |
| material_type | string | 資料種別 |
| location | string | 配架場所 |
| status | string | 貸出状態（"available"） |
| created_at | string | 登録日時（ISO 8601） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | 必須項目未入力、ISBN形式不正 | RFC 7807 Problem Details: title="Validation Error", detail="タイトルは必須です" |
| 401 | 未認証 | RFC 7807: title="Unauthorized" |
| 403 | 司書ロールなし | RFC 7807: title="Forbidden", detail="司書権限が必要です" |
| 409 | ISBN重複 | RFC 7807: title="Conflict", detail="ISBN 978-4-10-101001-2 は既に登録されています" |

## データモデル変更

### books テーブル

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| id | UUID | 書籍ID（PK） | 新規 |
| title | VARCHAR(500) | タイトル | 新規 |
| author | VARCHAR(200) | 著者 | 新規 |
| isbn | VARCHAR(17) | ISBN-13 | 新規 |
| publisher | VARCHAR(200) | 出版社 | 新規 |
| genre | VARCHAR(50) | ジャンル | 新規 |
| material_type | VARCHAR(20) | 資料種別 | 新規 |
| location | VARCHAR(100) | 配架場所 | 新規 |
| status | VARCHAR(20) | 貸出状態 | 新規 |
| created_at | TIMESTAMP | 登録日時 | 新規 |
| updated_at | TIMESTAMP | 更新日時 | 新規 |

## ビジネスルール

- 書籍登録時の初期状態は「在庫あり」（書籍貸出状態の初期遷移）
- ISBN-13 はシステム内で一意。重複登録は 409 Conflict を返す
- 資料種別が「紙書籍」の場合、配架場所は必須
- 資料種別が「電子書籍」の場合、配架場所は null を許容

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を登録する - バックエンドAPI

  Scenario: 正常な書籍登録
    Given 司書ロールのアクセストークンが有効
    When POST /api/v1/books に以下のリクエストを送信する
      | title | 吾輩は猫である |
      | author | 夏目漱石 |
      | isbn | 978-4-10-101001-2 |
      | publisher | 新潮社 |
      | genre | 文学 |
      | material_type | 紙書籍 |
      | location | A棟2階 |
    Then HTTP 201 が返却される
    And レスポンスの status が "available" である
    And books テーブルに isbn="978-4-10-101001-2" のレコードが存在する

  Scenario: ISBN重複時の登録拒否
    Given isbn="978-4-10-101001-2" の書籍が既に登録済み
    When POST /api/v1/books に isbn="978-4-10-101001-2" を含むリクエストを送信する
    Then HTTP 409 が返却される
    And レスポンスの type が "https://librashelf.example.com/problems/conflict" である
```
