# 書籍を登録する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルの蔵書管理グループに書籍登録画面（/staff/books/new）を追加する。
BookForm（create）による入力・インライン検証、POST /api/v1/books の呼び出し（冪等キー付き）、完了後の蔵書一覧画面への遷移（履歴 replace + Alert success）を実装する。
ジャンル選択肢は既存の GET /api/v1/genres を利用する。

## 画面仕様

### 書籍登録画面

- **URL**: `/staff/books/new`（クエリ: 戻り先の一覧条件 `page`, `searchType`, `q`, `genreId`, `status` を引き継ぐ）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff / staff-collapsed） | サイドバー「蔵書管理 > 蔵書一覧」をアクティブ表示 |
| ページ見出し「書籍を登録」 | テキスト | - | 見出し直下に Alert 領域 |
| 入力フォーム | フォーム | BookForm（create） | タイトル / 著者 / ISBN / 出版社 / ジャンル / 媒体種別。中央寄せ 8col |
| タイトル・著者・ISBN・出版社 | フォーム | Input（default / error） | 必須項目にはラベルに「必須」を併記 |
| ジャンル | フォーム | Select（default / error） | GET /api/v1/genres の選択肢（8 値） |
| 媒体種別 | フォーム | ToggleGroup（single, sm） | 「紙」「電子」。初期値「紙」。「電子」選択時に注記「電子書籍は登録のみ可能です（貸出・予約不可）」 |
| 登録ボタン | ボタン | Button（default） | submitting 中は disabled + Spinner（sm） |
| 戻るボタン | ボタン | Button（ghost） | 蔵書一覧画面へ戻る（クエリ引き継ぎ） |
| 検証エラー | 通知 | Alert（destructive） | API 422 時に「入力内容を確認してください」+ フィールド別エラー |
| 送信失敗 | 通知 | Alert（destructive） | 500 / ネットワーク断で「登録できませんでした」+ 再試行 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| 文字色 | var(--foreground) | var(--color-gray-900)（dark: var(--color-gray-50)） |
| アクセント（staff primary） | var(--primary) | var(--color-slate-700)（#334155、dark: var(--color-slate-400)） |
| 入力エラー | var(--destructive) / var(--destructive-light) | red 系 |
| 完了通知 | var(--success) / var(--success-light) | green 系 |
| フォーカスリング | var(--ring) | var(--primary) |

#### UIロジック

- **状態管理**: 画面内状態（CLP-012）。`BookCreateState = { form: {title, author, isbn, publisher, genreId, mediaType}, errors: Record<field, string>, submitting, genres: Genre[], submitError }`。永続化しない
- **バリデーション**（補助。最終判定は API: LP-029 相当）: title 必須 1〜200 文字、author 必須 1〜200 文字、isbn 任意（入力のハイフンを送信前に除去し、10 桁（末尾のみ `X` 可）または 13 桁であることを検証。API へはハイフンなしで送信する）、publisher 任意 200 文字以内、genreId 必須、mediaType は `PAPER` / `ELECTRONIC`。blur 時と送信時に検証し、Input（error）で表示
- **ローディング**: 初期表示でジャンル選択肢を取得（Select を disabled）。送信中は `submitting = true` で全入力とボタンを disabled（LR-021 相当 / SR-005）
- **エラーハンドリング**: api client の統一エラー型を受け取り、422 → `errors[].field` をフィールドエラーへ反映（GENRE_NOT_FOUND はジャンル欄）、401 → 再認証、403 → Alert「この操作を行う権限がありません」、その他 → Alert（destructive）+ 再試行。コンソールにトークン・入力値を出力しない（CLR-009）
- **完了時**: 蔵書一覧画面へ `?notice=created` と引き継いだ一覧条件を付けて遷移し、履歴を replace する（ux-design「ページ間の遷移ルール」）

#### 操作フロー

1. 司書が蔵書一覧画面の「書籍を登録」ボタン、またはサイドバーから書籍登録画面を開く
2. view が GET /api/v1/genres でジャンル選択肢を取得し BookForm（create）を表示する（媒体種別は「紙」初期選択）
3. 司書が項目を入力する。blur ごとにインライン検証する
4. 「登録」押下で送信時検証し、通過したら api client `createBook` を呼ぶ（POST /api/v1/books、Idempotency-Key 付与）
5. 201 応答で蔵書一覧画面（`?notice=created`）へ遷移し Alert（success）「書籍を登録しました」を表示する
6. 422 応答はフィールドエラーとして表示し、同一画面で再入力できる

## コンポーネント設計

### BookCreatePage

- **ベースコンポーネント**: PortalShell（staff）+ BookForm（create）+ Alert + Button
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | returnQuery | { page?: number; searchType?: string; q?: string; genreId?: string; status?: string } | No | 蔵書一覧画面へ戻るときに引き継ぐクエリ |
- **状態**: `form`, `errors`, `submitting`, `genres`, `submitError`
- **イベント**: onSubmit(form)、onCancel（一覧へ戻る）

### BookForm（create variant の UC 固有設定）

- **ベースコンポーネント**: BookForm（variant: create）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initial | { title: string; author: string; isbn?: string; publisher?: string; genreId?: string; mediaType: 'PAPER' \| 'ELECTRONIC' } | Yes | 初期値（空 + mediaType: 'PAPER'） |
  | mode | 'create' | Yes | 登録モード（送信ボタン文言「登録」） |
  | genres | { genreId: string; genreName: string }[] | Yes | ジャンル選択肢 |
  | onSubmit | (values) => void | Yes | 検証通過時に呼ばれる |
  | submitting | boolean | Yes | true のとき全入力とボタンを disabled |
  | errors | Record<'title' \| 'author' \| 'isbn' \| 'publisher' \| 'genreId' \| 'mediaType', string> | No | API 422 のフィールドエラー |
- **状態**: 入力値と blur 済みフィールドの検証結果
- **イベント**: onChange(field, value), onSubmit(values)

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を登録する - 司書向けフロントエンド

  Scenario: ジャンル選択肢を取得してフォームを表示する
    Given 司書「佐藤花子」が司書ポータルにログイン済み
    And GET /api/v1/genres が 8 件を返すようモックされている
    When 書籍登録画面（/staff/books/new）を開く
    Then BookForm（create）のジャンル Select に「文学」「その他」を含む 8 件が表示される
    And 媒体種別 ToggleGroup は「紙」が選択されている

  Scenario: 有効な入力で POST が冪等キー付きで呼ばれ、一覧へ遷移する
    Given 書籍登録画面（/staff/books/new?page=2）を表示している
    And POST /api/v1/books が HTTP 201 を返すようモックされている
    When タイトル「吾輩は猫である」、著者「夏目漱石」、ジャンル「文学」を入力して「登録」を押す
    Then POST /api/v1/books が Idempotency-Key ヘッダ付きで 1 回呼ばれる
    And URL が「/staff/books?page=2&notice=created」に置換（replace）される

  Scenario: ISBN 形式不正はインライン検証で止まる
    Given 書籍登録画面（/staff/books/new）を表示している
    When ISBN に「abc-123」を入力してフォーカスを外す
    Then ISBN 欄に Input（error）「ISBN は 10 桁（末尾のみ X 可）または 13 桁の数字で入力してください（ハイフンは自動で除去します）」が表示される
    And 「登録」を押しても POST /api/v1/books は呼び出されない

  Scenario: API の 422 をフィールドエラーとして表示する
    Given 書籍登録画面（/staff/books/new）で有効な値を入力している
    And POST /api/v1/books が HTTP 422（errors: [{field: "genreId", message: "ジャンルが見つかりません"}]）を返すようモックされている
    When 「登録」を押す
    Then ジャンル Select が error 表示になり「ジャンルが見つかりません」が表示される
    And Alert（destructive）「入力内容を確認してください」が表示される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-書籍登録）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'books'、activeItem = 'bookList' |
| EntityFormPage | `@/components/common/EntityFormPage` | mode = 'create'、title = 「書籍を登録」、submitError = state.submitError（422 → fieldErrors、その他 → Alert + 再試行）、submitting = state.submitting、onCancel = onCancel（蔵書一覧へ returnQuery 引き継ぎ）、children = ({ fieldErrors }) => BookForm（create, errors = fieldErrors, genres = state.genres） |
| PageHeader | `@/components/common/PageHeader` | EntityFormPage 内部で利用（title = 「書籍を登録」） |
| ErrorAlert | `@/components/common/ErrorAlert` | EntityFormPage 内部で利用。audience = 'staff'（403 → 「この操作を行う権限がありません」） |
| SubmitButton | `@/components/common/SubmitButton` | label = 「登録」、submitting = state.submitting、variant = 'default' |
| BackLink | `@/components/common/BackLink` | label = 「蔵書一覧へ戻る」、to = '/staff/books'、returnQuery = props.returnQuery |
| NoticeAlert（発行） | `@/components/common/NoticeAlert` | 表示は蔵書一覧側。本 UC は useNoticeNavigation で `notice=created` を発行する |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useNoticeNavigation | 201 応答後に `/staff/books` + returnQuery + `notice=created` を組み立てて replace 遷移 |
| useIdempotencyKey | POST /api/v1/books の Idempotency-Key 生成（再試行で同一キーを再送。正本の利用 UC 数には未計上） |
