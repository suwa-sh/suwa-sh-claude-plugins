# 書籍を返却する - バックエンドAPI仕様

## 変更概要

書籍返却 API を実装する。返却日設定・状態遷移をトランザクション内で処理し、予約がある場合は通知キューにメッセージを送信する。

## API 仕様

### 返却 API

- **メソッド**: PUT
- **パス**: /api/v1/loans/{id}/return
- **認証**: OAuth2/OIDC (利用者ロール、自身の貸出のみ)
- **冪等性**: X-Idempotency-Key ヘッダ必須

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| id | string | 貸出ID |
| book_title | string | 書籍タイトル |
| return_date | string | 返却日（ISO 8601） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 404 | 貸出が存在しない | RFC 7807: detail="貸出が見つかりません" |
| 403 | 他人の貸出 | RFC 7807: detail="自身の貸出のみ返却できます" |
| 409 | 既に返却済み | RFC 7807: detail="この貸出は既に返却済みです" |

## データモデル変更

### loans テーブル

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| return_date | DATE | 返却日を現在日に設定 | 更新 |
| is_overdue | BOOLEAN | false に更新 | 更新 |

### books テーブル

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| status | VARCHAR(20) | 'on_loan'/'overdue' to 'available' | 更新 |

## ビジネスルール

- 自身の貸出のみ返却可能（user_id チェック）
- 既に返却済み（return_date IS NOT NULL）の場合は 409
- 返却時に予約受付中の予約があれば、予約通知キューにメッセージを送信
- 延滞中の書籍も返却可能（延滞フラグを解除）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を返却する - バックエンドAPI

  Scenario: 正常な返却
    Given 利用者 user_id="user-001" の貸出 loan_id="loan-001" が存在する
    When PUT /api/v1/loans/loan-001/return を送信する
    Then HTTP 200 が返却される
    And loans テーブルの loan_id="loan-001" の return_date が本日に設定されている
    And books テーブルの該当書籍の status が "available" に更新されている

  Scenario: 予約あり書籍の返却で通知送信
    Given 貸出 loan_id="loan-001"（書籍 book_id="abc-123"）が存在する
    And 書籍 book_id="abc-123" に予約受付中の予約がある
    When PUT /api/v1/loans/loan-001/return を送信する
    Then HTTP 200 が返却される
    And reservation-notification-queue にメッセージが送信される
```
