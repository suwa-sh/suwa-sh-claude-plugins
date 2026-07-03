# 書籍を貸出する - フロントエンド仕様

## 変更概要

利用者ポータルに貸出手続き画面を実装する。書籍情報の確認と貸出申請機能を提供する。

## 画面仕様

### 貸出手続き画面

- **URL**: /loans/new?book_id={book_id}
- **アクセス権**: 利用者ロール
- **ポータル**: user

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| 書籍情報カード | 表示 | BookCard (detailed) | 書籍の詳細情報表示 |
| 貸出状態バッジ | 表示 | BookLoanStatusBadge (available) | 在庫あり表示 |
| 返却期限表示 | テキスト | - | 「返却期限: YYYY/MM/DD」 |
| 貸出するボタン | ボタン | Button (default, size: lg) | 貸出申請 |
| 戻るボタン | ボタン | Button (outline, size: md) | 検索画面に戻る |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| アクセント | var(--portal-primary) | #2563EB (user) |
| 成功色 | var(--semantic-success) | #16A34A |

#### UIロジック

- **状態管理**: book_id をクエリパラメータから取得、書籍情報を GET /api/v1/books/:id で取得
- **バリデーション**: 書籍の status が "available" でない場合は貸出ボタンを disabled
- **ローディング**: 書籍情報取得時は Skeleton UI、貸出申請時はボタン disabled + Spinner
- **エラーハンドリング**: 409 の場合「この書籍は現在貸出できません」エラーバナー

#### 操作フロー

1. 蔵書検索画面から書籍の「貸出する」リンクをクリック → 貸出手続き画面に遷移
2. 書籍情報と予定返却期限（今日 + 14日）が表示される
3. 「貸出する」ボタンクリック → POST /api/v1/loans 送信
4. 成功 → 「貸出が完了しました。返却期限: YYYY/MM/DD」表示
5. 失敗 → エラーメッセージ表示

## コンポーネント設計

### LoanConfirmation

- **ベースコンポーネント**: BookCard, BookLoanStatusBadge, Button
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | book | BookResponse | Yes | 書籍情報 |
  | onLoan | () => Promise<void> | Yes | 貸出実行ハンドラ |
  | isLoading | boolean | No | 処理中フラグ |
- **状態**: isCompleted, loanResult (LoanResponse)
- **イベント**: onLoan

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を貸出する - フロントエンド

  Scenario: 貸出手続き画面の表示
    Given 利用者「田中太郎」がログイン済み
    And 「在庫あり」の書籍「吾輩は猫である」が存在する
    When /loans/new?book_id={bookId} にアクセスする
    Then BookCard に「吾輩は猫である」の情報が表示される
    And BookLoanStatusBadge が「在庫あり」(available) を表示する
    And 「貸出する」ボタンが有効である

  Scenario: 貸出完了後の表示
    Given 貸出手続き画面が表示されている
    When 「貸出する」ボタンをクリックする
    And API が HTTP 201 を返す
    Then 「貸出が完了しました。返却期限: 2026-04-26」が表示される
```
