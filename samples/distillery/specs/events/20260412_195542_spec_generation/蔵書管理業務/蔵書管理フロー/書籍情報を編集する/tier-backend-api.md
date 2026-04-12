# 書籍情報を編集する - バックエンドAPI仕様

## 変更概要

書籍情報の更新 API と取得 API を実装する。

## API 仕様

### 書籍取得 API

- **メソッド**: GET
- **パス**: /api/v1/books/{id}
- **認証**: OAuth2/OIDC (司書ロール必須)

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| id | string | 書籍ID |
| title | string | タイトル |
| author | string | 著者 |
| isbn | string | ISBN |
| publisher | string | 出版社 |
| genre | string | ジャンル |
| material_type | string | 資料種別 |
| location | string | 配架場所 |
| status | string | 貸出状態 |
| created_at | string | 登録日時 |
| updated_at | string | 更新日時 |

### 書籍更新 API

- **メソッド**: PUT
- **パス**: /api/v1/books/{id}
- **認証**: OAuth2/OIDC (司書ロール必須)

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| title | string | Yes | 書籍タイトル |
| author | string | Yes | 著者名 |
| isbn | string | Yes | ISBN-13形式 |
| publisher | string | Yes | 出版社名 |
| genre | string | Yes | 書籍ジャンル |
| material_type | string | Yes | 資料種別 |
| location | string | No | 配架場所 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | バリデーションエラー | RFC 7807 Problem Details |
| 404 | 書籍が存在しない | RFC 7807: detail="書籍が見つかりません" |
| 409 | ISBN重複 | RFC 7807: detail="このISBNは既に登録されています" |

## データモデル変更

### books テーブル

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| updated_at | TIMESTAMP | 更新日時を現在時刻に更新 | 更新 |

## ビジネスルール

- 編集は書籍貸出状態に影響しない（状態遷移なし）
- ISBN の一意制約は他の書籍との重複チェック（自身は除く）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍情報を編集する - バックエンドAPI

  Scenario: 書籍情報の取得
    Given id="abc-123" の書籍が存在する
    When GET /api/v1/books/abc-123 を送信する
    Then HTTP 200 が返却される
    And レスポンスの title が「吾輩は猫である」である

  Scenario: 書籍情報の更新
    Given id="abc-123" の書籍が存在する
    When PUT /api/v1/books/abc-123 に author="夏目 漱石" を含むリクエストを送信する
    Then HTTP 200 が返却される
    And books テーブルの id="abc-123" の author が「夏目 漱石」に更新されている
```
