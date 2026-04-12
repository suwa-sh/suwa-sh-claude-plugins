# 書籍情報を編集する - フロントエンド仕様

## 変更概要

司書ポータルに蔵書編集画面を実装する。既存書籍情報のプリフィルと更新機能を提供する。

## 画面仕様

### 蔵書編集画面

- **URL**: /admin/books/:id/edit
- **アクセス権**: 司書ロール
- **ポータル**: admin

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| タイトル入力 | フォーム | Input (default) | 既存値プリフィル。必須 |
| 著者入力 | フォーム | Input (default) | 既存値プリフィル。必須 |
| ISBN入力 | フォーム | Input (default) | 既存値プリフィル。必須 |
| 出版社入力 | フォーム | Input (default) | 既存値プリフィル。必須 |
| ジャンル選択 | プルダウン | Input (default) + select | 既存値選択済み |
| 資料種別選択 | ラジオ | Input (default) + radio | 既存値選択済み |
| 配架場所入力 | フォーム | Input (default) | 資料種別が紙書籍の場合のみ |
| 更新ボタン | ボタン | Button (default, size: md) | フォーム送信 |
| キャンセルボタン | ボタン | Button (outline, size: md) | 蔵書管理画面に戻る |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | #FFFFFF |
| アクセント | var(--portal-primary) | #334155 (admin) |

#### UIロジック

- **状態管理**: 画面表示時に GET /api/v1/books/:id でデータ取得し、フォームにプリフィル
- **バリデーション**: 登録画面と同一のクライアントサイドバリデーション
- **ローディング**: 初期データ取得時は Skeleton UI、更新送信時はボタン disabled + Spinner
- **エラーハンドリング**: 404 の場合「書籍が見つかりません」画面を表示

#### 操作フロー

1. 蔵書管理画面の書籍行で「編集」ボタンクリック → 蔵書編集画面に遷移
2. 既存データがフォームにプリフィルされる
3. 変更したいフィールドを編集
4. 「更新」ボタンクリック → PUT /api/v1/books/:id 送信
5. 成功（200）→ 「書籍情報を更新しました」表示 → 蔵書管理画面にリダイレクト

## コンポーネント設計

### BookEditForm

- **ベースコンポーネント**: Input, Button
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | bookId | string | Yes | 書籍ID |
  | initialData | BookResponse | Yes | 初期データ |
  | onSubmit | (data: UpdateBookRequest) => Promise<void> | Yes | 送信ハンドラ |
- **状態**: title, author, isbn, publisher, genre, materialType, location, errors, isLoading
- **イベント**: onSubmit, onChange

## ティア完了条件（BDD）

```gherkin
Feature: 書籍情報を編集する - フロントエンド

  Scenario: 既存データのプリフィル表示
    Given 司書「山田花子」がログイン済み
    And ISBN「978-4-10-101001-2」の書籍「吾輩は猫である」が存在する
    When /admin/books/{bookId}/edit にアクセスする
    Then タイトル欄に「吾輩は猫である」がプリフィルされている
    And 著者欄に「夏目漱石」がプリフィルされている
```
