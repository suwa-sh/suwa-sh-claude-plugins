# 書籍一覧を参照する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルの蔵書管理グループに蔵書一覧画面（/staff/books）を追加する。
BookSearchFilter（staff）による絞り込み、BookTable（manage）による一覧表示と行内操作（編集 / 削除 / 予約状況）、Pagination（20 件/頁）を実装する。
GET /api/v1/books の呼び出しと HTTP エラーの正規化を api client に追加する。

## 画面仕様

### 蔵書一覧画面

- **URL**: `/staff/books`（クエリ: `page`, `searchType`, `q`, `genreId`, `status`）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff / staff-collapsed） | サイドバー「蔵書管理 > 蔵書一覧」をアクティブ表示 |
| ページ見出し「蔵書一覧」+「書籍を登録」 | テキスト + ボタン | Button（default） | 押下で書籍登録画面（/staff/books/new）へ遷移 |
| 絞り込み条件 | フォーム | BookSearchFilter（staff） | 検索条件種別（ToggleGroup）+ 入力 + ジャンル（Select）+ 在庫状況（ToggleGroup） |
| 書籍一覧 | テーブル | BookTable（manage） | 書籍 ID / タイトル / 著者 / ISBN / 出版社 / ジャンル / 媒体 / 状態 / 操作列 |
| 状態列 | バッジ | BookStatusBadge（dot） | 在庫あり（success）/ 貸出中（info）/ 予約待ち（pending） |
| 操作列 | ボタン | Button（ghost, sm） | 編集 → /staff/books/:bookId/edit、削除 → /staff/books/:bookId/delete、予約状況 → /staff/books/:bookId/reservations |
| ページ送り | ナビゲーション | Pagination（default / single-page） | 総ページ数 = ceil(totalCount / 20)。現在ページを aria-current で示す |
| 読み込み中 | プレースホルダ | Skeleton（table） | 0.4 秒を超える取得で表示（Doherty Threshold） |
| 該当なし | 空状態 | EmptyState（with-action） | 絞り込み結果 0 件 / 未登録時。アクション「書籍を登録」 |
| 取得失敗 | 通知 | Alert（destructive） | 「一覧を取得できませんでした」+ 再試行 |
| 登録・編集・削除完了通知 | 通知 | Alert（success） | 前画面からの遷移時にクエリ `?notice=created|updated|deleted` で表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| 文字色 | var(--foreground) | var(--color-gray-900)（dark: var(--color-gray-50)） |
| アクセント（staff primary） | var(--primary) | var(--color-slate-700)（#334155、dark: var(--color-slate-400)） |
| テーブルヘッダ背景 | var(--table-header-bg) | var(--background-subtle) = var(--color-gray-50) |
| サイドバー アクティブ項目 | var(--sidebar-active-bg) / var(--sidebar-active-fg) | var(--primary-light) / var(--primary) |
| 状態バッジ 在庫あり | var(--success) / var(--success-light) | green 系 |
| 状態バッジ 貸出中 | var(--info) / var(--info-light) | blue 系 |
| 状態バッジ 予約待ち | var(--pending) / var(--pending-light) | orange 系 |
| フォーカスリング | var(--ring) | var(--primary) |

#### UIロジック

- **状態管理**: 画面内状態（CLP-012: 2 層構成、状態管理層なし）。`BookListPageState = { filter: {searchType, q, genreId, status}, page, items, totalCount, loading, error }`。フィルタ・ページは URL クエリと双方向同期し、編集・削除から戻ったときに検索条件とページ番号を復元する（ux-design「ページ間の遷移ルール」）
- **バリデーション**: q は 100 文字以内。searchType「ISBN」のときは数字とハイフンのみを補助的にチェック（LP-029: 最終判定は API）。不正時は Input（error）で表示し送信しない
- **ローディング**: 初回・フィルタ変更・ページ変更で `loading = true`。0.4 秒を超えたら Skeleton（table）を表示。取得中は BookSearchFilter の送信ボタンを disabled
- **エラーハンドリング**: api client が正規化した統一エラー型を受け取り、401 → IdP 再認証、403 → Alert「この画面を表示する権限がありません」、その他 → Alert（destructive）+ 再試行。コンソールログに個人情報・トークンを出力しない（CLR-009）
- **表示**: 一覧は更新日時降順。ジャンル列は genreName、媒体列は「紙」「電子」の文言

#### 操作フロー

1. 司書がサイドバー「蔵書管理 > 蔵書一覧」を選ぶ（または `/staff/books?page=2` を直接開く）
2. view が URL クエリから filter / page を復元し、api client `listBooks` を呼ぶ（GET /api/v1/books）
3. 応答を BookTable（manage）に描画し、Pagination の総ページ数を更新する
4. 司書が BookSearchFilter で条件を変えて検索すると page を 1 に戻して再取得し、URL クエリを更新する
5. Pagination でページを選ぶと `page` を更新して再取得する
6. 行内操作「編集」「削除」「予約状況」で該当画面へ遷移する。遷移先の「戻る」は現在の URL クエリを引き継いで一覧へ戻る

## コンポーネント設計

### BookListPage

- **ベースコンポーネント**: PortalShell（staff）+ BookSearchFilter（staff）+ BookTable（manage）+ Pagination + EmptyState + Skeleton + Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialQuery | { page: number; searchType?: SearchType; q?: string; genreId?: string; status?: BookStatus } | No | URL クエリから復元した初期条件（既定 page = 1） |
  | notice | 'created' \| 'updated' \| 'deleted' | No | 前画面からの完了通知種別 |
- **状態**: `filter`, `page`, `items: BookSummary[]`, `totalCount`, `loading`, `error`
- **イベント**: onFilterSubmit（page を 1 にして再取得）、onPageChange、onEdit(bookId)、onDelete(bookId)、onSelectReservations(bookId)、onCreateClick

### BookSearchFilter（staff variant の UC 固有設定）

- **ベースコンポーネント**: BookSearchFilter（variant: staff）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | { searchType: SearchType; q: string; genreId?: string; status?: BookStatus } | Yes | 現在の絞り込み条件（searchType 既定「キーワード」） |
  | onChange | (value) => void | Yes | 入力変更 |
  | onSubmit | () => void | Yes | 検索実行（Enter / 検索ボタン） |
  | compact | boolean | No | 一覧上部に配置するため true |
- **状態**: 内部にジャンル選択肢（GET /api/v1/genres の結果）を保持
- **イベント**: onChange, onSubmit

### BookTable（manage variant の UC 固有設定）

- **ベースコンポーネント**: BookTable（variant: manage）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | books | BookSummary[] | Yes | 一覧行（bookId, title, author, isbn, publisher, genreName, mediaType, status） |
  | onEdit | (bookId: string) => void | Yes | 編集画面へ遷移 |
  | onDelete | (bookId: string) => void | Yes | 削除確認画面へ遷移 |
  | onSelect | (bookId: string) => void | No | 予約状況画面へ遷移 |
  | loading | boolean | Yes | true のとき Table（loading）/ Skeleton |
- **状態**: なし（表示専用）
- **イベント**: onEdit, onDelete, onSelect

## ティア完了条件（BDD）

```gherkin
Feature: 書籍一覧を参照する - 司書向けフロントエンド

  Scenario: 一覧取得中は Skeleton が表示され、取得後に BookTable に置き換わる
    Given 司書「佐藤花子」が司書ポータルにログイン済み
    And GET /api/v1/books が 1 秒後に 20 件（totalCount 45）を返すようモックされている
    When 蔵書一覧画面（/staff/books）を開く
    Then 0.4 秒経過後に Skeleton（table）が表示される
    And 応答後に BookTable に 20 行と Pagination「1 / 3」が表示される

  Scenario: 絞り込み条件とページ番号が URL クエリに反映される
    Given 蔵書一覧画面（/staff/books）を表示している
    When BookSearchFilter で検索条件種別「著者」を選び「夏目」と入力して検索する
    Then URL が「/staff/books?page=1&searchType=author&q=%E5%A4%8F%E7%9B%AE」になる
    And GET /api/v1/books が searchType=author&q=夏目&page=1&pageSize=20 で呼ばれる

  Scenario: 編集画面から戻ると絞り込み条件とページが復元される
    Given 蔵書一覧画面を「?page=2&status=ON_LOAN」で表示している
    When 行内操作「編集」で書籍「B-0021」の編集画面へ遷移し、「戻る」を押す
    Then 蔵書一覧画面が「?page=2&status=ON_LOAN」で再表示される

  Scenario: 結果 0 件のとき EmptyState に登録導線が表示される
    Given 蔵書一覧画面（/staff/books）を表示している
    When 検索条件種別「ISBN」で「9999999999999」を検索し、API が items 空・totalCount 0 を返す
    Then EmptyState（with-action）「該当する書籍がありません」と「書籍を登録」ボタンが表示される
    And BookTable は表示されない
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-書籍一覧）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'books'、activeItem = 'bookList' |
| PageHeader | `@/components/common/PageHeader` | title = 「蔵書一覧」、primaryAction = { label: 「書籍を登録」, onClick: onCreateClick }、notices = NoticeAlert |
| NoticeAlert | `@/components/common/NoticeAlert` | notice = props.notice（created / updated / deleted）、messages = { created: 「書籍を登録しました」, updated: 「書籍を更新しました」, deleted: 「書籍を削除しました」 }、onDismiss = `?notice` を replace で除去 |
| PaginatedListFrame | `@/components/common/PaginatedListFrame` | filter = BookSearchFilter（staff, compact）、page / totalCount = state.page / state.totalCount、pageSize = 20、onPageChange = onPageChange、loading / error = state.loading / state.error、empty = items.length === 0、skeleton = { variant: 'table' }、emptyState = { title: 「該当する書籍がありません」, action: { label: 「書籍を登録」, onClick: onCreateClick } }、onRetry = 再取得、children = BookTable（manage） |
| ErrorAlert | `@/components/common/ErrorAlert` | PaginatedListFrame 内部で利用。audience = 'staff' |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useUrlQueryState | `page` / `searchType` / `q` / `genreId` / `status` の URL クエリ双方向同期（編集・削除から戻ったときの復元） |
