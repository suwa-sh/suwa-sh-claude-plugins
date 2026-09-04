# 書籍を検索する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルの窓口グループに窓口蔵書検索画面（/staff/search）を追加する。
利用者からの問い合わせに即答するため、BookSearchFilter（staff）による検索と BookTable（select）による状態列常時表示を実装し、行選択から書籍別予約状況画面 / 貸出受付画面へ遷移できるようにする（ux-design「司書（窓口）: 利用者の問い合わせに応じて書籍と利用状況を調べる」）。
館内経路の GET /api/v1/books 呼び出しは「書籍一覧を参照する」と同じ api client `listBooks` を再利用する。

## 画面仕様

### 窓口蔵書検索画面

- **URL**: `/staff/search`（クエリ: `searchType`, `q`, `genreId`, `status`, `page`）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff / staff-collapsed） | サイドバー「窓口 > 窓口蔵書検索」をアクティブ表示 |
| ページ見出し「窓口蔵書検索」 | テキスト | - | - |
| 検索条件 | フォーム | BookSearchFilter（staff） | 検索条件種別（ToggleGroup）+ Input / Select（ジャンル）+ 在庫状況（ToggleGroup single: すべて / 在庫あり / 貸出中 / 予約待ち） |
| 検索結果 | テーブル | BookTable（select） | 書籍 ID / タイトル / 著者 / ISBN / ジャンル / 媒体 / 状態 / 操作列（予約状況 / 貸出受付） |
| 状態列 | バッジ | BookStatusBadge（dot） | 在庫あり / 貸出中 / 予約待ち を常時表示（詳細画面へ遷移せず在庫状況を答える） |
| 操作列 | ボタン | Button（ghost, sm） | 「予約状況」→ /staff/books/:bookId/reservations、「貸出受付」→ /staff/loans/new?bookId=（在庫あり・予約待ちのとき） |
| ページ送り | ナビゲーション | Pagination（default / single-page） | 20 件/頁 |
| 読み込み中 | プレースホルダ | Skeleton（table） | 0.4 秒超で表示 |
| 該当なし | 空状態 | EmptyState（default） | 「該当する書籍がありません」 |
| 取得失敗 | 通知 | Alert（destructive） | 「検索できませんでした」+ 再試行 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（staff primary） | var(--primary) | var(--color-slate-700)（dark: var(--color-slate-400)） |
| テーブルヘッダ背景 | var(--table-header-bg) | var(--background-subtle) |
| サイドバー アクティブ項目 | var(--sidebar-active-bg) / var(--sidebar-active-fg) | var(--primary-light) / var(--primary) |
| 状態バッジ 在庫あり / 貸出中 / 予約待ち | var(--success) / var(--info) / var(--pending) | green / blue / orange 系 |
| フォーカスリング | var(--ring) | var(--primary) |

#### UIロジック

- **状態管理**: 画面内状態（CLP-012）。`CounterBookSearchState = { filter: {searchType, q, genreId, status}, page, items, totalCount, loading, error, genres }`。URL クエリと双方向同期
- **バリデーション**（補助）: searchType が genre 以外のとき q 必須・100 文字以内。ISBN は数字とハイフンのみ。genre のとき genreId 必須。不正時は Input（error）で表示し送信しない
- **ローディング**: 検索実行・ページ変更で Skeleton（table）。取得中は検索ボタン disabled
- **エラーハンドリング**: 401 → 再認証、403 → Alert「この画面を表示する権限がありません」、その他 → Alert（destructive）+ 再試行（LR-027 / CLP-013）
- **キーボード操作**: 検索 Input に初期フォーカス、Enter で検索、結果行は矢印キーで移動し Enter で「予約状況」へ（窓口の最少操作: LP-035）
- **表示**: 状態列は常に表示（タブレット幅でも間引かない: ui-design レスポンシブ戦略）

#### 操作フロー

1. 司書がサイドバー「窓口 > 窓口蔵書検索」を開く。検索 Input にフォーカスが当たる
2. 利用者の問い合わせに応じて検索条件種別と文字列を入力し Enter を押す
3. view が api client `listBooks` を呼び（GET /api/v1/books、館内経路）、BookTable（select）に状態列つきで描画する
4. 在庫状況を口頭で案内する。貸出中なら行内「予約状況」で書籍別予約状況画面へ遷移して待ち人数を答える
5. 在庫あり（または予約待ちで予約順位 1 位の利用者）なら行内「貸出受付」で貸出受付画面へ bookId を引き継いで遷移する
6. 遷移先から「戻る」で検索条件とページを復元する

## コンポーネント設計

### CounterBookSearchPage

- **ベースコンポーネント**: PortalShell（staff）+ BookSearchFilter（staff）+ BookTable（select）+ Pagination + EmptyState + Skeleton + Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialQuery | { searchType?: SearchType; q?: string; genreId?: string; status?: BookStatus; page?: number } | No | URL クエリから復元した初期条件 |
- **状態**: `filter`, `page`, `items`, `totalCount`, `loading`, `error`, `genres`
- **イベント**: onSearch、onPageChange、onSelectReservations(bookId)、onSelectLoan(bookId)

### BookSearchFilter（staff variant の UC 固有設定）

- **ベースコンポーネント**: BookSearchFilter（variant: staff）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | { searchType: SearchType; q: string; genreId?: string; status?: BookStatus } | Yes | 現在の検索条件（searchType 既定「キーワード」、status 既定「すべて」） |
  | onChange | (value) => void | Yes | 入力変更 |
  | onSubmit | () => void | Yes | 検索実行 |
  | compact | boolean | No | false |
  | autoFocus | boolean | No | true（窓口の最少操作） |
- **状態**: ジャンル選択肢、補助検証エラー
- **イベント**: onChange, onSubmit

### BookTable（select variant の UC 固有設定）

- **ベースコンポーネント**: BookTable（variant: select）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | books | BookSummary[] | Yes | 検索結果 |
  | onSelect | (bookId: string) => void | Yes | 「予約状況」（書籍別予約状況画面へ） |
  | onLoan | (bookId: string) => void | No | 「貸出受付」（status が AVAILABLE / RESERVED かつ mediaType PAPER のとき表示） |
  | loading | boolean | Yes | true のとき Table（loading） |
- **状態**: なし（表示専用）。編集 / 削除操作は持たない（manage variant との違い）
- **イベント**: onSelect, onLoan

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を検索する - 司書向けフロントエンド

  Scenario: 検索結果が状態列つきの BookTable に表示される
    Given 司書「佐藤花子」が司書ポータルにログイン済み
    And GET /api/v1/books が「吾輩は猫である」（AVAILABLE）と「猫を抱いて象と泳ぐ」（ON_LOAN）を返すようモックされている
    When 窓口蔵書検索画面（/staff/search）で「猫」と入力して Enter を押す
    Then GET /api/v1/books が searchType=keyword&q=猫&page=1&pageSize=20 で館内経路に呼ばれる
    And BookTable（select）に 2 行が表示され、状態列に BookStatusBadge「在庫あり」「貸出中」が表示される

  Scenario: 在庫状況で絞り込むと status が付与される
    Given 窓口蔵書検索画面（/staff/search）を表示している
    When 検索条件種別「タイトル」で「猫」、在庫状況「在庫あり」を指定して検索する
    Then GET /api/v1/books が searchType=title&q=猫&status=AVAILABLE で呼ばれる
    And URL が「/staff/search?searchType=title&q=%E7%8C%AB&status=AVAILABLE&page=1」になる

  Scenario: 貸出中の行から予約状況画面へ遷移し、戻ると条件が復元される
    Given 窓口蔵書検索画面を「?searchType=keyword&q=猫&page=1」で表示し「猫を抱いて象と泳ぐ」（B-0002、ON_LOAN）が表示されている
    When 行内「予約状況」を押す
    Then 書籍別予約状況画面（/staff/books/B-0002/reservations）へ遷移する
    When 「戻る」を押す
    Then 窓口蔵書検索画面が「?searchType=keyword&q=猫&page=1」で再表示される

  Scenario: 在庫ありの行には「貸出受付」が表示され bookId を引き継ぐ
    Given 窓口蔵書検索画面に「吾輩は猫である」（B-0001、AVAILABLE、PAPER）が表示されている
    When 行内「貸出受付」を押す
    Then 貸出受付画面（/staff/loans/new?bookId=B-0001）へ遷移する

  Scenario: 画面表示時に検索 Input へフォーカスが当たる
    Given 司書「佐藤花子」が司書ポータルにログイン済み
    When 窓口蔵書検索画面（/staff/search）を開く
    Then BookSearchFilter の検索 Input がフォーカスされている
    And 検索条件種別は「キーワード」、在庫状況は「すべて」が選択されている
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-検索）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'counter'、activeItem = 'counterSearch' |
| PageHeader | `@/components/common/PageHeader` | title = 「窓口蔵書検索」 |
| PaginatedListFrame | `@/components/common/PaginatedListFrame` | filter = BookSearchFilter（staff, autoFocus）、page / totalCount = state.page / state.totalCount、pageSize = 20、onPageChange = onPageChange、loading / error = state.loading / state.error、empty = items.length === 0、skeleton = { variant: 'table' }、emptyState = { title: 「該当する書籍がありません」 }、onRetry = 再取得、children = BookTable（select） |
| ErrorAlert | `@/components/common/ErrorAlert` | PaginatedListFrame 内部で利用。audience = 'staff'（403 → forbidden 文言、その他 → server + 再試行） |
| CounterHandoffActions | `@/components/common/CounterHandoffActions` | BookTable（select）の操作列。bookId = 行の bookId、actions = ['loan']、disabled = !(status ∈ {AVAILABLE, RESERVED} && mediaType === 'PAPER')。「予約状況」は行の onSelect で遷移 |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useUrlQueryState | `searchType` / `q` / `genreId` / `status` / `page` の URL クエリ双方向同期（遷移先から戻ったときの復元） |
