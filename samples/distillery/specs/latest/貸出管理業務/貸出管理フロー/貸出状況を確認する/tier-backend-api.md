# 貸出状況を確認する - バックエンドAPI仕様

## 変更概要

貸出一覧取得 API を実装する。ページネーション付きで全貸出を返却する。

## API 仕様

### 貸出一覧取得 API

- **メソッド**: GET
- **パス**: /api/v1/loans
- **認証**: OAuth2/OIDC (司書ロール必須)

#### リクエスト（クエリパラメータ）

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| page | integer | No | ページ番号（デフォルト: 1） |
| per_page | integer | No | 1ページあたり件数（デフォルト: 20、最大: 100） |
| status | string | No | フィルター（active/overdue/all。デフォルト: active） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | LoanListItem[] | 貸出一覧 |
| total | integer | 全件数 |
| page | integer | 現在ページ |
| per_page | integer | 1ページあたり件数 |

#### LoanListItem

| フィールド | 型 | 説明 |
|-----------|---|------|
| id | string | 貸出ID |
| book_title | string | 書籍タイトル |
| borrower_name | string | 利用者名 |
| loan_date | string | 貸出日 |
| due_date | string | 返却期限 |
| is_overdue | boolean | 延滞フラグ |

## データモデル変更

なし（参照のみ）

## ビジネスルール

- 司書ロールのみアクセス可能
- 未返却（return_date IS NULL）の貸出を返却期限の昇順で表示
- 延滞フラグ（is_overdue=true）の貸出を優先表示

## ティア完了条件（BDD）

```gherkin
Feature: 貸出状況を確認する - バックエンドAPI

  Scenario: 貸出一覧の取得
    Given 未返却の貸出が25件存在する
    When GET /api/v1/loans?page=1&per_page=20 を送信する
    Then HTTP 200 が返却される
    And レスポンスの items が 20件
    And レスポンスの total が 25

  Scenario: 延滞フィルター
    Given 貸出中10件、延滞中5件の貸出が存在する
    When GET /api/v1/loans?status=overdue を送信する
    Then HTTP 200 が返却される
    And レスポンスの items が全て is_overdue=true
```
