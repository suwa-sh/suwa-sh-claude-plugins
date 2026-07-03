# 書籍を登録する - フロントエンド仕様

## 変更概要

司書ポータルに蔵書登録画面を実装する。書籍情報の入力フォームと登録完了表示を提供する。

## 画面仕様

### 蔵書登録画面

- **URL**: /admin/books/new
- **アクセス権**: 司書ロール
- **ポータル**: admin

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| タイトル入力 | フォーム | Input (default) | 書籍タイトル。必須 |
| 著者入力 | フォーム | Input (default) | 著者名。必須 |
| ISBN入力 | フォーム | Input (default) | ISBN-13形式。必須 |
| 出版社入力 | フォーム | Input (default) | 出版社名。必須 |
| ジャンル選択 | プルダウン | Input (default) + select | 書籍ジャンル7種。必須 |
| 資料種別選択 | ラジオ | Input (default) + radio | 紙書籍/電子書籍。デフォルト: 紙書籍 |
| 配架場所入力 | フォーム | Input (default) | 棚番号。資料種別が紙書籍の場合のみ表示。必須 |
| 登録ボタン | ボタン | Button (default, size: md) | フォーム送信 |
| キャンセルボタン | ボタン | Button (outline, size: md) | 蔵書管理画面に戻る |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | #FFFFFF |
| アクセント | var(--portal-primary) | #334155 (admin) |
| 入力欄高さ | var(--component-input-height) | 2.5rem |
| ボタン高さ | var(--component-button-height-md) | 2.5rem |
| カード角丸 | var(--component-card-radius) | 0.75rem |

#### UIロジック

- **状態管理**: React useState で BookForm state を管理。資料種別の切替で配架場所の表示/非表示を制御
- **バリデーション**: 送信前にクライアントサイドバリデーション（必須チェック、ISBN-13 正規表現 `/^978-\d{1,5}-\d{1,7}-\d{1,7}-\d$/`）
- **ローディング**: 登録ボタンクリック後は Button を disabled + Spinner 表示。Skeleton UI は不要（フォーム画面のため）
- **エラーハンドリング**: バリデーションエラーは Input (error variant) でフィールド直下に表示。API エラーは画面上部にエラーバナー（RFC 7807 の detail フィールドを表示）

#### 操作フロー

1. 司書が蔵書管理画面の「新規登録」ボタンをクリック → 蔵書登録画面に遷移
2. 資料種別を選択（デフォルト: 紙書籍）
3. 書籍情報を入力（タイトル、著者、ISBN、出版社、ジャンル、配架場所）
4. 「登録」ボタンをクリック → クライアントバリデーション実行
5. バリデーション OK → POST /api/v1/books 送信
6. 成功（201）→ 「書籍を登録しました」完了メッセージ表示 → 3秒後に蔵書管理画面にリダイレクト
7. 失敗（400/500）→ エラーメッセージ表示

## コンポーネント設計

### BookRegistrationForm

- **ベースコンポーネント**: Input, Button
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | onSubmit | (data: CreateBookRequest) => Promise<void> | Yes | フォーム送信ハンドラ |
  | isLoading | boolean | No | 送信中フラグ |
- **状態**: title, author, isbn, publisher, genre, materialType, location, errors
- **イベント**: onSubmit（フォーム送信）、onChange（入力値変更）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を登録する - フロントエンド

  Scenario: 蔵書登録フォームの表示
    Given 司書「山田花子」が司書ポータルにログイン済み
    When /admin/books/new にアクセスする
    Then 蔵書登録フォームが表示される
    And 資料種別のデフォルト値が「紙書籍」である
    And 配架場所の入力欄が表示されている

  Scenario: 電子書籍選択時の配架場所非表示
    Given 蔵書登録画面が表示されている
    When 資料種別で「電子書籍」を選択する
    Then 配架場所の入力欄が非表示になる

  Scenario: クライアントバリデーションエラー
    Given 蔵書登録画面が表示されている
    When タイトルを空のまま登録ボタンをクリックする
    Then タイトル入力欄が error スタイルになる
    And 「タイトルは必須です」メッセージが表示される
```
