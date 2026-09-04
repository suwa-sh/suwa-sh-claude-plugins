# 在庫状況一覧を参照する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルの分析レポートグループに在庫状況一覧画面（`/staff/reports/inventory`）を追加する。`GET /api/v1/reports/inventory` の結果を StatCard 3 枚（在庫あり / 貸出中 / 予約待ち）、ToggleGroup による状態絞り込み、BookTable（inventory）+ Pagination で表示する（arch LP-036、design nfr_decisions「全一覧に 20 件/頁のページネーションと Skeleton」）。

## 画面仕様

### 在庫状況一覧画面

- **URL**: `/staff/reports/inventory?status={AVAILABLE|ON_LOAN|RESERVED}&genreId={ジャンルID}&page={n}`
- **アクセス権**: 司書（認証 + 司書区分必須。館内経路）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff） | サイドバー「分析レポート」グループ |
| 在庫あり件数 | テキスト | StatCard | label「在庫あり」、value = summary.available、unit「冊」、icon = 在庫アイコン |
| 貸出中件数 | テキスト | StatCard | label「貸出中」、value = summary.onLoan、unit「冊」 |
| 予約待ち件数 | テキスト | StatCard | label「予約待ち」、value = summary.reserved、unit「冊」 |
| 状態絞り込み | フォーム | ToggleGroup（single, md） | すべて / 在庫あり / 貸出中 / 予約待ち。既定「すべて」 |
| ジャンル絞り込み | フォーム | Select | バリエーション「ジャンル」8 値 + 「すべて」。選択肢は GET /api/v1/genres |
| 書籍一覧 | テーブル | BookTable（variant: inventory） | 書籍 ID / タイトル / 著者 / ISBN / 出版社 / ジャンル / 媒体 / 状態。操作列なし。行選択で書籍別予約状況画面へ（予約待ちのみ） |
| 状態 | バッジ | BookStatusBadge（dot） | 在庫あり = success / 貸出中 = info / 予約待ち = pending |
| ページ送り | ナビゲーション | Pagination（default / single-page） | 20 件/頁、totalCount からページ数を算出 |
| 読み込み中 | ローディング | Skeleton（card × 3, table） | 初回とページ切替時 |
| データなし | 空状態 | EmptyState（default） | 「条件に一致する書籍はありません」 |
| エラー | 通知 | Alert（destructive） | 403 / 5xx の司書向けメッセージ |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | design tokens semantic.background |
| アクセント | var(--primary) | staff = #334155（Shelf Slate） |
| 集計値サイズ | var(--font-size-3xl) | component.stat_card.value_size |
| テーブルヘッダ | var(--background-subtle) | component.table.header_bg |
| 行ホバー | var(--hover-muted) | component.table.row_hover |
| 在庫あり | var(--success) / var(--success-light) | semantic.success（green） |
| 貸出中 | var(--info) / var(--info-light) | semantic.info（blue） |
| 予約待ち | var(--pending) / var(--pending-light) | semantic.pending（orange） |

#### UIロジック

- **状態管理**: 2 層構成（view / component → api client。CLP-012）。画面内状態 = { status, genreId, page, loading, summary, items, totalCount, error }。絞り込み条件とページ番号は URL クエリと同期し、書籍別予約状況画面から戻ったときに復元する
- **バリデーション**: ToggleGroup / Select の固定値のみのため入力検証不要。page は 1 以上・最終ページ以下に補正する
- **ローディング**: 初回は StatCard と BookTable を Skeleton にする。絞り込み・ページ切替時は BookTable のみ loading にし StatCard は据え置く
- **エラーハンドリング**: api client が HTTP エラーを統一エラー型に正規化（LR-027）。403 → 「この機能は司書のみ利用できます」、5xx / タイムアウト（10 秒）→ Alert（destructive）+ 再試行
- **個人情報**: 表示しない（書籍情報のみ）

- **表示ラベル変換**: API enum は FE 側で日本語ラベルに変換して表示する。status: AVAILABLE → 「在庫あり」/ ON_LOAN → 「貸出中」/ RESERVED → 「予約待ち」（ToggleGroup の選択値・BookStatusBadge）、mediaType: PAPER → 「紙」/ ELECTRONIC → 「電子」（BookTable 媒体列）

#### 操作フロー

1. 司書がサイドバー「分析レポート > 在庫状況一覧」を選ぶ
2. 既定条件（すべて・1 ページ目）で API を呼び、Skeleton を表示する
3. 応答後に StatCard 3 枚と BookTable、Pagination を描画する
4. ToggleGroup / Select で絞り込むと page=1 に戻して再取得し、URL クエリを更新する
5. Pagination でページを切り替えると BookTable を再取得する
6. 予約待ちの書籍の行を選ぶと書籍別予約状況画面へ遷移する（戻り先の条件は URL クエリで保持）。人気書籍ランキング画面へは期間クエリを引き継いで遷移できる

## コンポーネント設計

### InventoryReportPage

- **ベースコンポーネント**: PortalShell（staff）+ StatCard + ToggleGroup + Select + BookTable + BookStatusBadge + Pagination + Skeleton + EmptyState + Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialFilter | { status?: 'AVAILABLE' \| 'ON_LOAN' \| 'RESERVED'; genreId?: string; page?: number } | No | URL クエリから復元した初期条件 |
- **状態**: status / genreId / page / loading / summary(InventorySummary) / items(BookRow[]) / totalCount / error
- **イベント**: onStatusChange、onGenreChange、onPageChange、onSelectBook（予約待ちのみ書籍別予約状況画面へ）、onRetry

### BookTable（inventory variant）

- **ベースコンポーネント**: BookTable（design-event.yaml domain、variant = inventory）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | books | { bookId: string; title: string; author: string; isbn: string; publisher: string; genreName: string; mediaType: 'PAPER' \| 'ELECTRONIC'; status: 'AVAILABLE' \| 'ON_LOAN' \| 'RESERVED' }[] | Yes | ページ内の書籍 |
  | onSelect | (bookId: string) => void | No | 行選択（予約待ちの行のみ有効） |
  | loading | boolean | No | true で Table（loading）表示 |
- **状態**: なし
- **イベント**: onSelect。状態列は BookStatusBadge（dot）で描画。md 未満では ISBN・出版社列を間引く

### InventorySummaryCards

- **ベースコンポーネント**: StatCard × 3
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | summary | { available: number; onLoan: number; reserved: number; total: number } | Yes | 状態別件数 |
  | activeStatus | string | No | ToggleGroup と連動して該当カードを強調 |
- **状態**: なし
- **イベント**: onClick（カード選択で ToggleGroup の値を切り替える）

## ティア完了条件（BDD）

```gherkin
Feature: 在庫状況一覧を参照する - 司書向けフロントエンド

  Scenario: 初回表示で件数と一覧を表示する
    Given 司書「S-0001」がログイン済みである
    And API GET /api/v1/reports/inventory が page=1&pageSize=20 に対して summary {available: 120, onLoan: 45, reserved: 8, total: 173}、items 20 件、totalCount 173 を返す
    When /staff/reports/inventory を開く
    Then 取得中は StatCard と BookTable の領域に Skeleton が表示される
    And 応答後に StatCard「在庫あり」に「120 冊」が表示される
    And BookTable に 20 行、Pagination に 9 ページが表示される

  Scenario: 状態で絞り込むと 1 ページ目から再取得する
    Given 司書「S-0001」が /staff/reports/inventory?page=3 を表示している
    When ToggleGroup で「貸出中」を選ぶ
    Then API が status=ON_LOAN&page=1&pageSize=20 で呼ばれる
    And URL が /staff/reports/inventory?status=ON_LOAN&page=1 に更新される

  Scenario: 結果 0 件で EmptyState を表示する
    Given 司書「S-0001」が /staff/reports/inventory を表示している
    And API が items=[]・totalCount=0 を返す
    When ToggleGroup で「予約待ち」、Select で「芸術」を選ぶ
    Then EmptyState「条件に一致する書籍はありません」が表示され Pagination は表示されない
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-在庫状況）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'reports'、activeItem = 'inventory' |
| PageHeader | `@/components/common/PageHeader` | title = 「在庫状況一覧」 |
| StatCardGroup | `@/components/common/StatCardGroup` | InventorySummaryCards を本コンポーネントで実装。items = [{ key: 'AVAILABLE', label: 「在庫あり」, value: summary.available, unit: 「冊」 }, { key: 'ON_LOAN', label: 「貸出中」, value: summary.onLoan, unit: 「冊」 }, { key: 'RESERVED', label: 「予約待ち」, value: summary.reserved, unit: 「冊」 }]、loading = 初回取得中のみ（絞り込み・ページ切替時は据え置き）、activeKey = state.status、onSelect = onStatusChange |
| ScopeToggle | `@/components/common/ScopeToggle` | options = [すべて / 在庫あり / 貸出中 / 予約待ち]（value = '' / AVAILABLE / ON_LOAN / RESERVED）、value = state.status、onChange = onStatusChange（page を 1 に戻す）、size = 'md'、ariaLabel = 「状態絞り込み」 |
| PaginatedListFrame | `@/components/common/PaginatedListFrame` | filter = ScopeToggle + Select（ジャンル）、summary = StatCardGroup、page / totalCount = state.page / state.totalCount、pageSize = 20、onPageChange = onPageChange、loading / error = state.loading / state.error、empty = items.length === 0、skeleton = { variant: 'table' }、emptyState = { title: 「条件に一致する書籍はありません」 }、onRetry = onRetry、children = BookTable（inventory） |
| ErrorAlert | `@/components/common/ErrorAlert` | PaginatedListFrame 内部で利用。audience = 'staff'（403 → 「この機能は司書のみ利用できます」） |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useUrlQueryState | `status` / `genreId` / `page` の URL クエリ双方向同期（書籍別予約状況画面から戻ったときの復元） |
