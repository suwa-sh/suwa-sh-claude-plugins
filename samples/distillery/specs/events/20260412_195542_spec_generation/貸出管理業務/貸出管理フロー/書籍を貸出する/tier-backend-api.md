# 書籍を貸出する - バックエンドAPI仕様

## 変更概要

書籍貸出 API を実装する。貸出可否判定・貸出期限計算・状態遷移をトランザクション内で処理する。

## API 仕様

### 貸出作成 API

- **メソッド**: POST
- **パス**: /api/v1/loans
- **認証**: OAuth2/OIDC (利用者ロール)
- **冪等性**: X-Idempotency-Key ヘッダ必須（状態変更を伴う操作）

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id | string | Yes | 貸出対象の書籍ID |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| id | string | 貸出ID |
| book_id | string | 書籍ID |
| book_title | string | 書籍タイトル |
| user_id | string | 利用者ID |
| loan_date | string | 貸出日（ISO 8601） |
| due_date | string | 返却期限（ISO 8601） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | book_id未指定 | RFC 7807: detail="book_idは必須です" |
| 404 | 書籍が存在しない | RFC 7807: detail="書籍が見つかりません" |
| 409 | 在庫なし/予約あり | RFC 7807: detail="この書籍は現在貸出できません" |
| 409 | 冪等キー重複 | RFC 7807: detail="このリクエストは既に処理済みです" |

## データモデル変更

### loans テーブル

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| id | UUID | 貸出ID（PK） | 新規 |
| book_id | UUID | 書籍ID（FK → books.id） | 新規 |
| user_id | UUID | 利用者ID（FK → users.id） | 新規 |
| loan_date | DATE | 貸出日 | 新規 |
| due_date | DATE | 返却期限 | 新規 |
| return_date | DATE | 返却日（NULL=未返却） | 新規 |
| is_overdue | BOOLEAN | 延滞フラグ | 新規 |
| idempotency_key | VARCHAR(36) | 冪等キー（UNIQUE） | 新規 |
| created_at | TIMESTAMP | 作成日時 | 新規 |

### books テーブル

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| status | VARCHAR(20) | 'available' → 'on_loan' | 更新 |

## ビジネスルール

- **貸出可否判定ルール**: 書籍の status が "available" かつ、その書籍に対する予約受付中の予約がない場合に貸出可能。ただし予約者本人（予約確保済）の場合は貸出可能
- **貸出期限ルール**: 貸出日 + 14日を返却期限として設定
- 貸出と書籍状態更新は同一トランザクション内で実行
- 冪等キーは KVS で重複チェック後、RDB の UNIQUE 制約で二重防止

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を貸出する - バックエンドAPI

  Scenario: 正常な貸出
    Given 「在庫あり」で予約なしの書籍 book_id="abc-123" が存在する
    And 利用者 user_id="user-001" のアクセストークンが有効
    When POST /api/v1/loans に book_id="abc-123" を送信する
    Then HTTP 201 が返却される
    And レスポンスの due_date が「2026-04-26」である
    And books テーブルの id="abc-123" の status が "on_loan" に更新されている
    And loans テーブルに book_id="abc-123", user_id="user-001" のレコードが作成されている

  Scenario: 冪等キー重複での二重貸出防止
    Given 冪等キー "key-001" で貸出が完了済み
    When 同じ冪等キー "key-001" で POST /api/v1/loans を送信する
    Then HTTP 409 が返却される
    And 新しい貸出レコードは作成されない
```
