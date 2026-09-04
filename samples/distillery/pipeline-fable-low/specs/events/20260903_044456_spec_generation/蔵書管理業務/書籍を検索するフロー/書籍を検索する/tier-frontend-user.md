# 書籍を検索する - 利用者向けフロントエンド仕様

## 変更概要

利用者ポータルに蔵書検索画面（/search）を追加する。プライマリナビの先頭項目（最頻操作）で、未認証でも利用できる。
BookSearchFilter（patron）による検索条件入力、BookCard（compact）グリッドによる結果表示、Pagination（20 件/頁）、EmptyState / Skeleton を実装する。
公開経路の GET /api/v1/books 呼び出しと HTTP エラーの正規化を api client に追加する。

## 画面仕様

### 蔵書検索画面

- **URL**: `/search`（クエリ: `searchType`, `q`, `genreId`, `page`）
- **アクセス権**: 利用者（未認証でも閲覧可。予約導線は認証必須）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（patron） | トップナビ「蔵書検索」をアクティブ表示 |
| ページ見出し「蔵書検索」 | テキスト | - | - |
| 検索条件 | フォーム | BookSearchFilter（patron） | 検索条件種別（ToggleGroup single: キーワード / タイトル / 著者 / ISBN / ジャンル）+ Input（with-icon）または Select（ジャンル）。在庫状況フィルタは持たない |
| 検索結果 | カードグリッド | BookCard（compact） | タイトル / 著者 / ジャンル / 媒体種別 / BookStatusBadge。lg: 3 列、md: 2 列、sm: 1 列 |
| 在庫状況 | バッジ | BookStatusBadge（dot） | 在庫あり（success）/ 貸出中（info）+「予約できます」/ 予約待ち（pending）+「予約できます」 |
| 件数表示 | テキスト | - | 「{totalCount} 件」 |
| ページ送り | ナビゲーション | Pagination（default / single-page） | 総ページ数 = ceil(totalCount / 20) |
| 読み込み中 | プレースホルダ | Skeleton（card × 6） | 0.4 秒を超える取得で表示 |
| 該当なし | 空状態 | EmptyState（default） | 「該当する書籍が見つかりませんでした。条件を変えてお試しください」 |
| 取得失敗 | 通知 | Alert（destructive） | 「検索できませんでした。しばらくしてからもう一度お試しください」+ 再試行 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| 文字色 | var(--foreground) | var(--color-gray-900)（dark: var(--color-gray-50)） |
| アクセント（patron primary） | var(--primary) | var(--color-blue-600)（#2563EB、dark: var(--color-blue-500)） |
| カード背景 / 枠 | var(--card-bg) / var(--card-border) | design tokens component 層 |
| 状態バッジ 在庫あり / 貸出中 / 予約待ち | var(--success) / var(--info) / var(--pending) | green / blue / orange 系 |
| フォーカスリング | var(--ring) | var(--primary) |
| コンテンツ最大幅 | var(--content-max-width) | 80rem |

#### UIロジック

- **状態管理**: 画面内状態（CLP-010: 2 層構成）。`BookSearchPageState = { filter: {searchType, q, genreId}, page, items: BookSummary[], totalCount, loading, error, genres }`。URL クエリと双方向同期し、書籍詳細から戻ったときに検索条件とページを復元する。永続化しない（LP-030）
- **バリデーション**（補助: LP-029）: searchType が genre 以外のとき q 必須・100 文字以内。ISBN のときは数字とハイフンのみを補助チェック。genre のとき genreId 必須。不正時は Input（error）で表示し送信しない
- **ローディング**: 検索実行・ページ変更で `loading = true`。0.4 秒超で Skeleton（card）。取得中は検索ボタンを disabled
- **エラーハンドリング**: api client の統一エラー型を受け取り、利用者向け文言に変換（LP-031）。400 → 「検索条件を確認してください」、429 → 「アクセスが集中しています」、その他 → Alert（destructive）+ 再試行。技術的詳細は表示しない。コンソールに検索文字列を出力しない（CLR-008）
- **表示**: 検索条件種別の初期値は「キーワード」（ux-design: 1 入力で結果に到達）。結果は更新日時降順。電子書籍には「予約できます」を出さない

#### 操作フロー

1. 利用者がトップナビ「蔵書検索」を開く（または `/search?q=猫` を直接開く）
2. view が URL クエリから filter / page を復元し、条件があれば api client `searchBooks` を呼ぶ（GET /api/v1/books）
3. 利用者が検索条件種別を選び、文字列（またはジャンル）を入力して Enter / 検索ボタンを押す
4. view が page を 1 にして再取得し、URL クエリを更新する
5. 応答を BookCard グリッドに描画し、Pagination を更新する
6. BookCard を選ぶと書籍詳細・在庫状況画面（/books/:bookId）へ遷移する。「戻る」で検索条件とページを復元する

## コンポーネント設計

### BookSearchPage

- **ベースコンポーネント**: PortalShell（patron）+ BookSearchFilter（patron）+ BookCard（compact）+ Pagination + EmptyState + Skeleton + Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialQuery | { searchType?: SearchType; q?: string; genreId?: string; page?: number } | No | URL クエリから復元した初期条件（既定 searchType = 'keyword', page = 1） |
- **状態**: `filter`, `page`, `items`, `totalCount`, `loading`, `error`, `genres`
- **イベント**: onSearch（page を 1 にして再取得）、onPageChange、onSelectBook(bookId)

### BookSearchFilter（patron variant の UC 固有設定）

- **ベースコンポーネント**: BookSearchFilter（variant: patron）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | { searchType: 'keyword' \| 'title' \| 'author' \| 'isbn' \| 'genre'; q: string; genreId?: string } | Yes | 現在の検索条件 |
  | onChange | (value) => void | Yes | 入力変更 |
  | onSubmit | () => void | Yes | 検索実行 |
  | compact | boolean | No | false（見出し直下に通常配置） |
- **状態**: ジャンル選択肢（GET /api/v1/genres）、補助検証エラー
- **イベント**: onChange, onSubmit

### BookCard（compact variant の UC 固有設定）

- **ベースコンポーネント**: BookCard（variant: compact）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | book | BookSummary（bookId, title, author, genreName, mediaType, status） | Yes | 表示データ |
  | onSelect | (bookId: string) => void | Yes | 書籍詳細へ遷移 |
  | detail | boolean | No | false |
- **状態**: なし（表示専用）。status が ON_LOAN / RESERVED かつ mediaType が PAPER のとき「予約できます」を並記
- **イベント**: onSelect

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を検索する - 利用者向けフロントエンド

  Scenario: 検索条件が URL クエリに反映され API が呼ばれる
    Given 蔵書検索画面（/search）を表示している
    And GET /api/v1/books が 2 件（totalCount 2）を返すようモックされている
    When 検索条件種別「キーワード」のまま「猫」と入力して Enter を押す
    Then GET /api/v1/books が searchType=keyword&q=猫&page=1&pageSize=20 で呼ばれる
    And URL が「/search?searchType=keyword&q=%E7%8C%AB&page=1」になる
    And BookCard（compact）が 2 件表示される

  Scenario: 貸出中の書籍には「予約できます」が並記される
    Given GET /api/v1/books が {title: "猫を抱いて象と泳ぐ", status: "ON_LOAN", mediaType: "PAPER"} を含む結果を返すようモックされている
    When 蔵書検索画面で「猫」を検索する
    Then 「猫を抱いて象と泳ぐ」の BookCard に BookStatusBadge「貸出中」と「予約できます」が表示される

  Scenario: ジャンル検索では Select が表示され genreId で呼ばれる
    Given 蔵書検索画面（/search）を表示している
    And GET /api/v1/genres が 8 件を返すようモックされている
    When 検索条件種別「ジャンル」を選び Select で「児童書」を選択して検索する
    Then 検索文字列の Input は表示されず Select が表示されている
    And GET /api/v1/books が searchType=genre&genreId=G-007&page=1 で呼ばれる

  Scenario: 書籍詳細から戻ると検索条件とページが復元される
    Given 蔵書検索画面を「?searchType=author&q=夏目漱石&page=2」で表示している
    When BookCard「こころ」を選んで書籍詳細・在庫状況画面へ遷移し、ブラウザの戻るを押す
    Then 蔵書検索画面が「?searchType=author&q=夏目漱石&page=2」で再表示され 2 ページ目の結果が表示される

  Scenario: 結果 0 件のとき EmptyState が表示される
    Given GET /api/v1/books が items 空・totalCount 0 を返すようモックされている
    When 蔵書検索画面で「存在しないタイトル」を検索する
    Then EmptyState（default）「該当する書籍が見つかりませんでした。条件を変えてお試しください」が表示される
    And Pagination は表示されない
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 P-検索）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| PatronLayout | `@/components/common/PatronLayout` | activeNav = 'search'、requireAuth = false（未認証でも閲覧可） |
| PageHeader | `@/components/common/PageHeader` | title = 「蔵書検索」 |
| PaginatedListFrame | `@/components/common/PaginatedListFrame` | filter = BookSearchFilter（patron）、summary = 「{totalCount} 件」、page / totalCount = state.page / state.totalCount、pageSize = 20、onPageChange = onPageChange、loading / error = state.loading / state.error、empty = items.length === 0、skeleton = { variant: 'card', count: 6 }、emptyState = { title: 「該当する書籍が見つかりませんでした。条件を変えてお試しください」 }、onRetry = 再取得、children = BookCard（compact）グリッド |
| ErrorAlert | `@/components/common/ErrorAlert` | PaginatedListFrame 内部で利用。audience = 'patron'（400 → validation 文言、429 / 5xx → server + 再試行） |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useUrlQueryState | `searchType` / `q` / `genreId` / `page` の URL クエリ双方向同期（書籍詳細から戻ったときの復元） |
