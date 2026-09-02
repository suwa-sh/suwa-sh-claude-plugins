# 書籍を検索する - 利用者ポータル仕様

## 変更概要

利用者ポータル（tier-frontend-patron）に蔵書検索画面（`/search`）を実装する。検索条件種別・検索語・詳細条件（ジャンル・資料種別・在庫ありのみ）の指定、検索結果カード一覧、在庫状況バッジ、ページ送りを提供する。状態は画面ローカル + ルーティングのクエリパラメータで保持する（arch LR-026）。

## 画面仕様

### 蔵書検索画面

- **ルート id**: `patron-book-search`
- **URL**: `/search`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 利用者（利用者ポータル。司書ポータルの画面へはリンクしない）
- **ポータル**: `patron`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`patron`） | ヘッダー・サイドバー・メインコンテンツ |
| 検索フィルター | フォーム | `BookSearchFilter` | 検索条件種別（単一）・ジャンル（複数）・資料種別（複数）・在庫ありのみを ToggleGroup で指定し、結果件数を表示する |
| 検索結果 | カード一覧 | `BookCard`（`default` / `on-loan` / `reserved` / `grid`） | 利用者向けの提示は `Table` ではなく `BookCard` を使う（ui-design.md のコンポーネント選定ルール） |
| 在庫状況 | バッジ | `BookStatusBadge` | 在庫あり / 貸出中 / 予約待ち。`dot` と文言を必ず併記する |
| ページ送り | ナビゲーション | `Pagination`（`default` / `single-page`） | 20 件/頁。無限スクロールは使わない |
| 0 件表示 | 空状態 | `EmptyState`（`with-action`） | 「条件に一致する書籍がありません」と条件変更の導線 |
| 読み込み中 | ローディング | `LoadingState`（`kind="card"`） | loading 表現の唯一の入口。検索結果カード群の取得待ちを表示する（`label`「検索結果を読み込み中」） |
| 検索エラー | メッセージ | `Alert`（`destructive`） | 再試行ボタンを同じ位置に置く |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--background)` | `var(--color-white)` |
| 本文色 | `var(--foreground)` | `var(--color-gray-900)` |
| アクセント | `var(--primary)` | `var(--color-blue-700)`（#1D4ED8） |
| 在庫ありバッジ | `var(--success)` | `var(--color-green-600)` |
| 貸出中バッジ | `var(--info)` | `var(--color-blue-600)` |
| 予約待ちバッジ | `var(--warning)` | `var(--color-amber-600)` |
| カード | `var(--card-bg)` / `var(--card-radius)` | `var(--color-white)` / `var(--radius-xl)` |
| 余白 | `var(--page-padding)` / `var(--component-gap)` | `var(--spacing-6)` / `var(--spacing-3)` |

#### UIロジック

- **状態管理**: 検索条件（search_type / q / genre[] / material_type[] / available_only / page）と結果をコンポーネントローカルに保持し、ルーティングのクエリパラメータと同期する（画面をまたぐ共有状態は持たない）
- **既定値**: 検索条件種別は「キーワード」を初期選択にする（デフォルト効果）。詳細条件（ジャンル・資料種別）は折りたたみに置き、既定はキーワードのみ表示する（段階的開示）
- **バリデーション**: 検索語は 1〜100 文字。検索条件種別「ISBN」を選んだ場合は 13 桁または 10 桁の形式チェックを行う。検索語が空のときは検索ボタンを `disabled` にする
- **ローディング**: 取得中は `LoadingState`（`kind="card"` / `label`「検索結果を読み込み中」）を結果領域に表示する（`AsyncSection` の `skeleton` prop 経由）。画面側で `Skeleton` / `Spinner` を直接使わない。結果件数は `aria-live="polite"` で通知する
- **エラーハンドリング**: 400 は入力欄にエラーを表示、401 は再ログイン導線、5xx は `Alert(destructive)` + 再試行ボタンを表示する
- **一覧の必須 3 状態**: `LoadingState` / `EmptyState` / `Alert(destructive)` を必ず実装する
- **本人限定参照の UI 制約**: 検索結果から他利用者の貸出・予約情報へ到達する導線を置かない（arch SP-004 / LP-025）
- **遷移**: 書籍カードの選択で `useAppNavigation().navigate("patron-book-detail")`（表示上は `/books/:bookId`）により書籍詳細・在庫状況画面へ前方遷移する（一覧 → 詳細 → 操作の 3 段構成）

#### 操作フロー

1. 利用者がサイドバーの「蔵書をさがす」から蔵書検索画面を開く
2. 検索条件種別（既定「キーワード」）を選び、検索語を入力する
3. 必要に応じて詳細条件（ジャンル・資料種別・在庫ありのみ）を開いて指定する
4. 検索ボタンを押すと `GET /api/v1/books/search` を実行し、`LoadingState`（`kind="card"`）を表示する
5. 結果を `BookCard` 一覧と `Pagination` で描画し、件数を読み上げ通知する
6. カードを選ぶと `useAppNavigation().navigate("patron-book-detail")` で書籍詳細・在庫状況画面へ遷移する

## コンポーネント設計

### BookSearchPanel

- **ベースコンポーネント**: `BookSearchFilter`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | BookSearchQuery | Yes | search_type / q / genre[] / material_type[] / available_only |
  | onChange | (q: BookSearchQuery) => void | Yes | 条件変更ハンドラ |
  | onSubmit | () => void | Yes | 検索実行 |
  | resultCount | number | No | 結果件数の表示 |
- **状態**: 詳細条件の折りたたみ開閉状態
- **イベント**: onChange、onSubmit、onReset

### BookSearchResultList

- **ベースコンポーネント**: `BookCard`（Domain） + `BookStatusBadge`（Domain） + `EmptyState`（UI） + `LoadingState`（共通）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | items | BookSearchResultItem[] | Yes | 検索結果（最大 20 件） |
  | loading | boolean | Yes | true のとき `LoadingState`（`kind="card"`）を表示する |
  | error | string \| null | Yes | 検索エラーメッセージ |
  | onSelect | (bookId: string) => void | Yes | 書籍詳細への遷移 |
- **状態**: なし（表示専用）
- **イベント**: onSelect

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を検索する - 利用者ポータル

  Scenario: 検索条件種別の既定はキーワードになる
    Given 利用者が蔵書検索画面（/search）を開く
    When 画面が初期表示される
    Then 検索条件種別の ToggleGroup で「キーワード」が選択済みになり、詳細条件は折りたたまれている

  Scenario: 検索結果をカードとバッジで表示する
    Given API が「吾輩は猫である」（availability=在庫あり）1 件と total=1 を返す状態である
    When 利用者が検索語「漱石」で検索する
    Then BookCard が 1 枚表示され、「在庫あり」バッジが緑のドットと文言つきで表示される

  Scenario: 検索語が空のとき検索ボタンを無効にする
    Given 利用者が蔵書検索画面を開いている
    When 検索語が空欄である
    Then 検索ボタンが disabled になっている

  Scenario: 0件のとき EmptyState を表示する
    Given API が items=[] , total=0 を返す状態である
    When 利用者が検索語「存在しない書名」で検索する
    Then 「条件に一致する書籍がありません」と条件変更を促す導線が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（書籍詳細・在庫状況画面へのルート id 指定遷移） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（検索結果カード群の取得待ち。`kind="card"`） |
| `AsyncSection` | `@/components/common/AsyncSection` | BookSearchResultList の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（BookSearchResultList（`BookCard` グリッド） + `Pagination` 20 件/頁） |
| `FilterPanel` | `@/components/common/FilterPanel` | BookSearchPanel（`BookSearchFilter`） の内側で使う（置き換えない） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"card"`（検索結果はカード群） / `label` ← `"検索結果を読み込み中"` / `delayMs` ← 300（検索の再取得によるちらつき抑止） |
| `AsyncSection` | `loading` ← BookSearchResultList の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"card"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"検索結果を読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← BookSearchPanel（`BookSearchFilter`） / `table` ← BookSearchResultList（`BookCard` グリッド） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |
| `FilterPanel` | `fields` ← 検索条件種別（single）/ 検索語（text）/ ジャンル（multi）/ 資料種別（multi）/ 在庫ありのみ（single） / `onChange` `onSubmit` `onReset` ← BookSearchPanel（`BookSearchFilter`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useListQueryState` | `@/components/common/hooks/useListQueryState` | 検索条件・ページをルーティングのクエリパラメータと同期する（画面をまたぐ共有状態を持たない / arch LR-026） |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
