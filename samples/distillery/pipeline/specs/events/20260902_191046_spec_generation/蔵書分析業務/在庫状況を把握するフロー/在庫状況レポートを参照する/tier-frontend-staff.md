# 在庫状況レポートを参照する - 司書ポータル仕様

## 変更概要

在庫状況レポート画面（`/staff/reports/inventory`）を追加し、統計レポートの集計明細を KPI カード 4 枚 + 区分別棒グラフ 1 枚 + 明細表の 3 層で表示する。統計レポート状態（集計中／作成済み／実績なし）に応じて `LoadingState` / 通常表示 / `EmptyState` を切り替える。

## 画面仕様

### 在庫状況レポート画面

- **ルート id**: `staff-report-inventory`
- **URL**: `/staff/reports/inventory`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（司書ロールのトークンを持つ場合のみ。arch SR-005）
- **ポータル**: staff（司書ポータル / `primary_staff`）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠・サイドバー | レイアウト | `PortalShell`（`staff`） | ナビ末尾「レポート」配下。コンテンツはフル幅（ui-design: レポートは最大幅を解除） |
| 統計レポート状態 | バッジ | `ReportStatusBadge` | 画面上部に常置。集計中／作成済み／実績なしを文言つきで示す |
| 第1層: 蔵書総数 | KPI | `ReportKpiCard(with-delta)` | 値は等幅・`toLocaleString('ja-JP')` の 3 桁区切り。前回集計比を `±N 件` で併記 |
| 第1層: 在庫あり件数 | KPI | `ReportKpiCard(with-delta)` | 前回集計との差異を併記 |
| 第1層: 貸出中件数 | KPI | `ReportKpiCard(with-delta)` | 前回集計との差異を併記 |
| 第1層: 稼働率 | KPI | `ReportKpiCard(default)` | 分母（蔵書総数）・分子（貸出中件数）を補足文言に明示。API に `utilization_rate` の前回比フィールドが無いため delta は描画しない |
| 第2層: 書籍状態別件数 | チャート | `LoanTrendChart` | 3 区分の横並び棒。縦軸は 0 起点。円グラフは使わない |
| 第3層: 書籍一覧 | 表 | `Table` + `BookStatusBadge` + `Pagination` | 20 件/頁。書籍状態を色 + 文言で示す |
| ジャンル別蔵書件数 | 表 | `Table` | 8 区分は表で提示する（棒グラフにしない） |
| 集計中の表示 | ローディング | `LoadingState`（KPI 群は `kind="card"`, チャートは `kind="card"`, 明細表は `kind="list"`） | 各領域に配置する。`label` は「在庫状況レポートの KPI を読み込み中」「区分別件数チャートを読み込み中」「書籍一覧を読み込み中」。画面側で `Skeleton` / `Spinner` を直接使わない |
| 実績なしの表示 | 空状態 | `EmptyState(with-action)` | 「集計期間を変更して再集計する」を条件指定画面への導線として提示 |
| 条件を変更する | ボタン | `Button(outline)` | `useAppNavigation().navigate("staff-report-inventory-new")` で在庫状況集計条件指定画面（`/staff/reports/inventory/new`）へ遷移。画面上にフィルタ UI を二重に持たない |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-teal-700)` |
| KPI カード背景 | `var(--component-kpi-bg)` | `var(--card-bg)` |
| KPI アクセント | `var(--component-kpi-accent)` | `var(--analysis)`（`--color-violet-600`） |
| チャート棒 | `var(--component-chart-bar-bg)` | `var(--primary)` |
| チャートグリッド | `var(--component-chart-grid)` | `var(--border)`（ダークは `--color-gray-700`） |
| KPI 数値フォント | `var(--font-family-mono)` | `'JetBrains Mono', …` |
| KPI 群の間隔 | `var(--semantic-component-gap)` | `var(--spacing-3)`（0.75rem） |
| 層の間隔 | `var(--semantic-section-gap)` | `var(--spacing-8)`（2rem） |
| 在庫あり | `var(--semantic-success)` | `var(--color-green-600)` |
| 貸出中 | `var(--semantic-info)` | `var(--color-blue-600)` |
| 予約待ち | `var(--semantic-warning)` | `var(--color-amber-600)` |

#### UIロジック

- **状態管理**: ステート層（`L-frontend-staff-state`）で `InventoryReportViewState { report, statusFilter, page, loading, error }` を保持する。`statusFilter` はチャートのドリルダウン結果で、明細表のみに作用する
- **バリデーション**: 参照系のため入力バリデーションは持たない。`page` はページネーションの範囲内に制限する
- **ローディング**: 取得中と統計レポート状態「集計中」はいずれも `AsyncSection` 経由の `LoadingState`（KPI 群 `kind="card"` / チャート `kind="card"` / 明細表 `kind="list"`）に一本化して表示する（レイアウトシフト回避）。画面側で `Skeleton` / `Spinner` / `animate-pulse` を直接使わず、同一領域でスケルトンとスピナーを併用しない。集計完了は `aria-live="polite"` で通知する
- **エラーハンドリング**: HTTP 404 は「まだ集計されていません。集計を実行してください」を `EmptyState(with-action)` で表示し、条件指定画面への導線を出す。HTTP 403 は「この操作には司書の権限が必要です」、5xx は `Alert(destructive)` を `role="alert"` で表示し再取得導線を出す
- **アクセシビリティ**: `LoanTrendChart` に区分名ラベルと `aria-label` を付与し、同じ内容を第 3 層の `Table` でテキスト提供する。表は `caption` と `th scope` を付ける
- **個人情報**: 本画面は書籍のみを扱い、利用者の氏名・連絡先を表示しない（arch SR-006）

#### 操作フロー

1. 司書がサイドバー「レポート」→「在庫状況レポート」を選び、`useAppNavigation().navigate("staff-report-inventory")` で本画面（`/staff/reports/inventory`）を開く
2. 最新の在庫状況レポートを取得し、統計レポート状態に応じて表示を切り替える
3. 作成済みなら KPI 4 枚 → 区分別棒 → 明細表の順に読み取る
4. 棒グラフの区分をクリックすると、明細表が同じ区分で絞り込まれる（画面遷移なし）
5. 明細表を `Pagination` で 20 件/頁ずつ辿る
6. 条件を変えたい場合は「条件を変更する」で `useAppNavigation().navigate("staff-report-inventory-new")` により在庫状況集計条件指定画面（`/staff/reports/inventory/new`）へ遷移する

## コンポーネント設計

### InventoryKpiRow

- **ベースコンポーネント**: `ReportKpiCard`（Domain / `with-delta` バリアント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | label | string | Yes | 指標名（蔵書総数 / 在庫あり / 貸出中 / 稼働率） |
  | value | number | Yes | 指標値。等幅・3 桁区切りで表示する |
  | unit | string | No | 単位（件 / %） |
  | delta | number | No | 前回集計比。増減を中立トーンで示す |
  | tone | `'default' \| 'success' \| 'info' \| 'warning'` | No | 書籍状態区分と同じ意味色を使う |
- **状態**: なし（表示専用）
- **イベント**: なし

### InventoryStatusChart

- **ベースコンポーネント**: `LoanTrendChart`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | data | `{ label: string; value: number }[]` | Yes | 書籍状態別件数（在庫あり / 貸出中 / 予約待ち） |
  | unit | string | No | 単位（件） |
  | highlightMax | boolean | No | 最大区分を強調する |
  | emptyMessage | string | No | 実績なし時の文言 |
- **状態**: `selectedLabel`（ドリルダウン中の書籍状態）
- **イベント**: `onSelectSegment(label)` — 明細表の絞り込みを発火する
- **デザインシステムへの拡張要求（LoanTrendChart への拡張点）**: 現行のデザインシステム定義（`docs/design/latest/_digest/components.yaml#LoanTrendChart`、props: `data` / `unit` / `highlightMax` / `emptyMessage`、variants: `monthly` / `daily` / `empty`）には、本 UC が必要とする以下が存在しない。デザインシステム側へ追加要求する
  - props: `selected`（選択中の区分ラベル）・`onSelectSegment(label)`（区分クリックのドリルダウンイベント）
  - variants: 区分別棒（時系列ではなくカテゴリ軸の棒）バリアントの追加

### InventoryBookTable

- **ベースコンポーネント**: `Table` + `BookStatusBadge` + `Pagination`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | books | `{ bookId: string; title: string; author: string; genre: string; bookStatus: string }[]` | Yes | 明細行（20 件/頁） |
  | page | number | Yes | 現在ページ |
  | totalPages | number | Yes | 総ページ数 |
  | statusFilter | string | No | 絞り込み中の書籍状態 |
- **状態**: なし（親のステート層が保持）
- **イベント**: `onPageChange(page)`

## ティア完了条件（BDD）

```gherkin
Feature: 在庫状況レポートを参照する - 司書ポータル

  Scenario: 3層構造で在庫状況を表示する
    Given 在庫状況レポートの取得結果が 蔵書総数 120・在庫あり 80・貸出中 30・予約待ち 10・稼働率 25.0% である
    When 司書「山田花子」が在庫状況レポート画面を開く
    Then ReportKpiCard が 4 枚表示され、値が 3 桁区切りの等幅で描画される
    And LoanTrendChart に 3 区分の棒が 0 起点で表示され、Table に書籍一覧が 20 件表示される

  Scenario: 集計中はLoadingStateを表示する
    Given API が report_status "集計中" を返す
    When 司書が在庫状況レポート画面を開く
    Then ReportStatusBadge が「集計中」を示し、KPI 領域に LoadingState(kind="card") が、チャート領域に LoadingState(kind="card") が表示される

  Scenario: 実績なしはEmptyStateを表示する
    Given API が report_status "実績なし" を返す
    When 司書が在庫状況レポート画面を開く
    Then EmptyState に「集計期間を変更して再集計する」が with-action で表示される

  Scenario: チャートの区分クリックで明細表を絞り込む
    Given 司書が在庫状況レポート画面を表示している
    When 司書が棒グラフの「予約待ち」をクリックする
    Then Table が書籍状態「予約待ち」の 10 件で絞り込まれ、URL の画面遷移は発生しない
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（`staff-report-inventory-new`） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「集計中の表示」（KPI 群 `kind="card"` / チャート `kind="card"` / 明細表 `kind="list"`）。`AsyncSection` の `skeleton` prop 経由で間接利用する |
| `AsyncSection` | `@/components/common/AsyncSection` | InventoryKpiRow / InventoryStatusChart / InventoryBookTable の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（InventoryBookTable（`Table`） + `Pagination` 20 件/頁） |
| `ReportSummarySection` | `@/components/common/ReportSummarySection` | 「KPI 行 → 推移チャート → 明細テーブル」の情報階層 |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← KPI 群 `"card"` / チャート `"line"` / 明細表 `"list"` / `label` ← `"在庫状況レポートの KPI を読み込み中"` / `"区分別件数チャートを読み込み中"` / `"書籍一覧を読み込み中"` / `rows` ← 明細表は `per_page`（20） |
| `AsyncSection` | `loading` ← InventoryKpiRow / InventoryStatusChart / InventoryBookTable の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← 領域ごとに `"card"` / `"line"` / `"list"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← 上記の `label` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← なし / `table` ← InventoryBookTable（`Table`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |
| `ReportSummarySection` | `status` ← `ReportStatusBadge` の状態（集計中 / 作成済み / 実績なし） / `kpis` ← InventoryKpiRow（`ReportKpiCard`）（1 行 4 件まで） / `chart` ← InventoryStatusChart（`LoanTrendChart`） / `detail` ← InventoryBookTable（`Table` + `Pagination`） / `emptyMessage` ← 実績なしの文言 |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけ
- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
