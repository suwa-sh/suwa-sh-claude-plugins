# 書籍を編集する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルに書籍編集画面（/staff/books/:bookId/edit）を追加する。
初期表示で GET /api/v1/books/{bookId} を呼び BookForm（edit）と BookStatusBadge に反映し、保存時に PUT /api/v1/books/{bookId}（version と冪等キー付き）を呼ぶ。
409（OPTIMISTIC_LOCK_CONFLICT）の再読み込み導線、404 の不在表示、完了後の蔵書一覧画面への遷移（履歴 replace + Alert success）を実装する。

## 画面仕様

### 書籍編集画面

- **URL**: `/staff/books/:bookId/edit`（クエリ: 戻り先の一覧条件 `page`, `searchType`, `q`, `genreId`, `status` を引き継ぐ）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff / staff-collapsed） | サイドバー「蔵書管理 > 蔵書一覧」をアクティブ表示 |
| ページ見出し「書籍を編集」+ 書籍 ID | テキスト | - | 見出し横に現在の状態バッジ |
| 現在の状態 | バッジ | BookStatusBadge（dot） | 在庫あり / 貸出中 / 予約待ち（ux-design: 状態を確認しながら修正） |
| 入力フォーム | フォーム | BookForm（edit） | タイトル / 著者 / ISBN / 出版社 / ジャンル / 媒体種別。中央寄せ 8col |
| ジャンル | フォーム | Select（default / error） | GET /api/v1/genres の選択肢 |
| 媒体種別 | フォーム | ToggleGroup（single, sm） | 貸出中・予約待ちのときは「電子」を disabled にし注記を表示 |
| 保存ボタン | ボタン | Button（default） | submitting 中は disabled + Spinner（sm） |
| 戻るボタン | ボタン | Button（ghost） | 蔵書一覧画面へ戻る（クエリ引き継ぎ） |
| 読み込み中 | プレースホルダ | Skeleton（line × 6） | GET 応答まで |
| 競合 | 通知 | Alert（warning） | 「他の司書が更新しました。再読み込みしてください」+ 再読み込みボタン |
| 不在 | 空状態 | EmptyState（with-action） | 「書籍が見つかりません」+「蔵書一覧へ戻る」 |
| 検証エラー / 送信失敗 | 通知 | Alert（destructive） | 422 フィールドエラー / 500 再試行 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（staff primary） | var(--primary) | var(--color-slate-700)（dark: var(--color-slate-400)） |
| 状態バッジ 在庫あり / 貸出中 / 予約待ち | var(--success) / var(--info) / var(--pending) | green / blue / orange 系 |
| 競合通知 | var(--warning) / var(--warning-light) | amber 系 |
| 入力エラー | var(--destructive) / var(--destructive-light) | red 系 |
| フォーカスリング | var(--ring) | var(--primary) |

#### UIロジック

- **状態管理**: 画面内状態（CLP-012）。`BookEditState = { book: BookDetailResponse | null, version, form, errors, submitting, loading, loadError, conflict }`。画面遷移で破棄
- **バリデーション**: 登録画面と同じ（title / author 必須 1〜200 文字、isbn 任意（入力のハイフンを送信前に除去し 10 桁（末尾のみ `X` 可）/ 13 桁を検証）、publisher 任意 200 文字以内、genreId 必須）。API の 422 `errors[].field` をフィールドエラーへ反映
- **ローディング**: 初期 GET 中は Skeleton。送信中は全入力とボタンを disabled（SR-005）
- **エラーハンドリング**: 404 → EmptyState、409 OPTIMISTIC_LOCK_CONFLICT → Alert（warning）+ 再読み込み（GET を再実行し form を最新値で上書き）、409 MEDIA_TYPE_CHANGE_NOT_ALLOWED → 媒体種別欄にエラー、401 → 再認証、403 → 権限エラー、その他 → Alert（destructive）+ 再試行。ログにトークン・入力値を出さない（CLR-009）
- **完了時**: 蔵書一覧画面へ `?notice=updated` と引き継いだ条件を付けて遷移し、履歴を replace

#### 操作フロー

1. 蔵書一覧画面の行内「編集」から遷移する（戻り先の検索条件・ページ番号はクエリで保持）
2. GET /api/v1/books/{bookId} と GET /api/v1/genres の応答で BookForm（edit）を初期化し、BookStatusBadge に状態を表示する
3. 司書が項目を修正する。blur ごとにインライン検証する
4. 「保存」押下で送信時検証し、api client `updateBook` を呼ぶ（PUT、version と Idempotency-Key 付与）
5. 200 応答で蔵書一覧画面（`?notice=updated`）へ遷移し Alert（success）「書籍を更新しました」を表示する
6. 409 応答は競合として再読み込み導線を表示する。「戻る」は一覧へ戻る

## コンポーネント設計

### BookEditPage

- **ベースコンポーネント**: PortalShell（staff）+ BookForm（edit）+ BookStatusBadge + Alert + Skeleton + EmptyState
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | bookId | string | Yes | ルートパラメータ |
  | returnQuery | { page?: number; searchType?: string; q?: string; genreId?: string; status?: string } | No | 蔵書一覧画面へ戻るときに引き継ぐクエリ |
- **状態**: `book`, `version`, `form`, `errors`, `submitting`, `loading`, `loadError`, `conflict`
- **イベント**: onSubmit(form)、onReload、onCancel

### BookForm（edit variant の UC 固有設定）

- **ベースコンポーネント**: BookForm（variant: edit）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initial | { title; author; isbn?; publisher?; genreId; mediaType } | Yes | GET 応答から初期化 |
  | mode | 'edit' | Yes | 編集モード（送信ボタン文言「保存」） |
  | genres | { genreId: string; genreName: string }[] | Yes | ジャンル選択肢 |
  | mediaTypeLocked | boolean | No | 状態が貸出中・予約待ちのとき true（「電子」を disabled） |
  | onSubmit | (values) => void | Yes | 検証通過時 |
  | submitting | boolean | Yes | 送信中 |
  | errors | Record<field, string> | No | API 422 / 409 のフィールドエラー |
- **状態**: 入力値と検証結果
- **イベント**: onChange(field, value), onSubmit(values)

### BookStatusBadge（既存ドメインコンポーネントの利用）

- **ベースコンポーネント**: BookStatusBadge
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | state | '在庫あり' \| '貸出中' \| '予約待ち' | Yes | BookDetailResponse.status を文言に変換 |
  | dot | boolean | No | true |
- **状態**: なし
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を編集する - 司書向けフロントエンド

  Scenario: 現在値と状態バッジを初期表示して保存する
    Given 司書「佐藤花子」が司書ポータルにログイン済み
    And GET /api/v1/books/B-0001 が {title: "吾輩は猫である", status: "AVAILABLE", version: 1} を返すようモックされている
    When 書籍編集画面（/staff/books/B-0001/edit?page=2）を開き、タイトルを「吾輩は猫である（新版）」に変更して「保存」を押す
    Then BookStatusBadge「在庫あり」が表示されている
    And PUT /api/v1/books/B-0001 が version 1 と Idempotency-Key 付きで呼ばれる
    And URL が「/staff/books?page=2&notice=updated」に置換（replace）される

  Scenario: 貸出中の書籍では媒体種別「電子」が選択できない
    Given GET /api/v1/books/B-0002 が {status: "ON_LOAN", mediaType: "PAPER"} を返すようモックされている
    When 書籍編集画面（/staff/books/B-0002/edit）を開く
    Then BookStatusBadge「貸出中」が表示される
    And 媒体種別 ToggleGroup の「電子」が disabled で注記「貸出中・予約待ちの書籍は媒体種別を変更できません」が表示される

  Scenario: 409 競合時に再読み込み導線を表示する
    Given 司書が書籍「B-0001」の編集画面を開いている
    And PUT /api/v1/books/B-0001 が HTTP 409（code: OPTIMISTIC_LOCK_CONFLICT）を返すようモックされている
    When 「保存」を押す
    Then Alert（warning）「他の司書が更新しました。再読み込みしてください」と「再読み込み」ボタンが表示される
    And 「再読み込み」を押すと GET /api/v1/books/B-0001 が再度呼ばれ form が最新値で上書きされる

  Scenario: 存在しない書籍は不在メッセージを表示する
    Given GET /api/v1/books/B-9999 が HTTP 404（code: BOOK_NOT_FOUND）を返すようモックされている
    When 書籍編集画面（/staff/books/B-9999/edit）を開く
    Then EmptyState「書籍が見つかりません」と「蔵書一覧へ戻る」ボタンが表示される
    And BookForm は表示されない
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-書籍編集）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'books'、activeItem = 'bookList' |
| EntityFormPage | `@/components/common/EntityFormPage` | mode = 'edit'、title = 「書籍を編集」（subtitle = bookId）、status = BookStatusBadge（dot）、loading = state.loading、loadError = state.loadError（404 → EmptyState with-action「蔵書一覧へ戻る」）、submitError = state.submitError（422 → fieldErrors、409 OPTIMISTIC_LOCK_CONFLICT → 競合 Alert + 再読み込み、409 MEDIA_TYPE_CHANGE_NOT_ALLOWED → fieldErrors.mediaType）、submitting = state.submitting、onReload = onReload、onCancel = onCancel、children = ({ fieldErrors }) => BookForm（edit, mediaTypeLocked, errors = fieldErrors） |
| PageHeader | `@/components/common/PageHeader` | EntityFormPage 内部で利用（status スロットに BookStatusBadge） |
| AsyncStateView | `@/components/common/AsyncStateView` | EntityFormPage 内部で利用（skeleton = { variant: 'line', count: 6 }） |
| ErrorAlert | `@/components/common/ErrorAlert` | EntityFormPage 内部で利用。audience = 'staff'（conflict → warning + onReload） |
| SubmitButton | `@/components/common/SubmitButton` | label = 「保存」、submitting = state.submitting |
| BackLink | `@/components/common/BackLink` | label = 「蔵書一覧へ戻る」、to = '/staff/books'、returnQuery = props.returnQuery |
| NoticeAlert（発行） | `@/components/common/NoticeAlert` | 表示は蔵書一覧側。本 UC は `notice=updated` を発行する |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useNoticeNavigation | 200 応答後に `/staff/books` + returnQuery + `notice=updated` を組み立てて replace 遷移 |
| useIdempotencyKey | PUT /api/v1/books/{bookId} の Idempotency-Key 生成（正本の利用 UC 数には未計上） |
