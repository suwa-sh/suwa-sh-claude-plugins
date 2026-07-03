# 書籍を返却する - フロントエンド仕様

## 変更概要

利用者ポータルに返却手続き画面を実装する。未返却の貸出一覧から返却操作を行う。

## 画面仕様

### 返却手続き画面

- **URL**: /loans/return
- **アクセス権**: 利用者ロール
- **ポータル**: user

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| 未返却貸出一覧 | テーブル | LoanRecord (default/overdue) | 未返却の貸出一覧。延滞中はoverdue variant |
| 返却ボタン | ボタン | Button (default, size: sm) | 各貸出行に配置 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| アクセント | var(--portal-primary) | #2563EB (user) |
| 延滞色 | var(--semantic-destructive) | #DC2626 |

#### UIロジック

- **状態管理**: GET /api/v1/users/me/loans?status=active で未返却貸出一覧取得
- **バリデーション**: なし（返却は常に可能）
- **ローディング**: 一覧取得時は Skeleton UI、返却処理時はボタン disabled + Spinner
- **エラーハンドリング**: 404 の場合「貸出が見つかりません」

#### 操作フロー

1. 利用者がマイページまたはナビから返却手続き画面にアクセス
2. 未返却の貸出一覧が表示される（LoanRecord コンポーネント）
3. 返却したい貸出の「返却する」ボタンをクリック
4. PUT /api/v1/loans/:id/return 送信
5. 成功 to 「返却が完了しました」表示、一覧再取得

## コンポーネント設計

### ReturnLoanList

- **ベースコンポーネント**: LoanRecord, Button
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | LoanResponse[] | Yes | 未返却貸出一覧 |
  | onReturn | (loanId: string) => Promise<void> | Yes | 返却ハンドラ |
- **状態**: processingLoanId (返却処理中の貸出ID)
- **イベント**: onReturn

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を返却する - フロントエンド

  Scenario: 未返却貸出一覧の表示
    Given 利用者「田中太郎」がログイン済み
    And 書籍「吾輩は猫である」を貸出中（返却期限: 2026-04-26）
    When /loans/return にアクセスする
    Then LoanRecord に「吾輩は猫である」が表示される
    And 返却期限「2026-04-26」が表示される
    And 「返却する」ボタンが有効である

  Scenario: 延滞貸出のハイライト表示
    Given 書籍「こころ」が延滞中（返却期限: 2026-04-01）
    When 返却手続き画面を表示する
    Then LoanRecord が overdue variant で表示される
    And 延滞日数が赤色で表示される
```
