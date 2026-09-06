# 貸出統計レポートを参照する - 司書ポータル仕様

## 変更概要

貸出統計レポート画面（`/staff/reports/loans`）を追加し、統計レポートの集計明細を KPI カード 4 枚 + 貸出件数推移チャート 1 枚 + 人気書籍ランキング表の 3 層で表示する。統計レポート状態（集計中／作成済み／実績なし）に応じて `LoadingState` / 通常表示 / `EmptyState` を切り替える。

## 画面仕様

### 貸出統計レポート画面

- **ルート id**: `staff-report-loans`
- **URL**: `/staff/reports/loans`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（司書ロールのトークンを持つ場合のみ。arch SR-005）
- **ポータル**: staff（司書ポータル / `primary_staff`）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠・サイドバー | レイアウト | `PortalShell`（`staff`） | ナビ末尾「レポート」配下。コンテンツはフル幅 |
| 統計レポート状態 | バッジ | `ReportStatusBadge` | 画面上部に常置。集計中／作成済み／実績なしを文言つきで示す |
| 第1層: 期間内貸出件数 | KPI | `ReportKpiCard(with-delta)` | 前期比 `+12%` を中立トーンで示す（減少＝悪と決めつけない） |
| 第1層: 返却済み件数 | KPI | `ReportKpiCard` | 期間内貸出のうち貸出状態「返却済み」の件数 |
| 第1層: 利用者数 | KPI | `ReportKpiCard` | 期間内に貸出した利用者の実数（個人情報は表示しない） |
| 第1層: 1 利用者あたり貸出件数 | KPI | `ReportKpiCard` | 分母（利用者数）・分子（期間内貸出件数）を補足文言に明示 |
| 第2層: 貸出件数の推移 | チャート | `LoanTrendChart`（`daily` / `monthly`） | 集計期間区分に応じてバリアントを選ぶ。`highlightMax` で最大値を強調 |
| 第3層: 人気書籍ランキング | 表 | `Table` + `Pagination` | 上位 20 件。順位・タイトル・著者・ジャンル・貸出回数を列に持つ |
| 利用者区分別の貸出内訳 | チャート + 表 | `LoanTrendChart`（区分別棒）+ `Table` | 3 区分を棒と表で併置する |
| ジャンル別の貸出内訳 | 表 | `Table` | 8 区分は表で提示する |
| 集計中の表示 | ローディング | `LoadingState`（KPI 群は `kind="card"`, チャートは `kind="card"`, ランキング表は `kind="list"`） | 各領域に配置する。`label` は「貸出統計レポートの KPI を読み込み中」「貸出件数推移チャートを読み込み中」「人気書籍ランキングを読み込み中」。画面側で `Skeleton` / `Spinner` を直接使わない |
| 実績なしの表示 | 空状態 | `EmptyState(with-action)` | 「集計期間を変更して再集計する」を条件指定画面への導線として提示 |
| 条件を変更する | ボタン | `Button(outline)` | `useAppNavigation().navigate("staff-report-loans-new")` で集計期間指定画面（`/staff/reports/loans/new`）へ遷移。画面上にフィルタ UI を二重に持たない |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-teal-700)` |
| KPI カード背景 | `var(--component-kpi-bg)` | `var(--card-bg)` |
| KPI アクセント | `var(--component-kpi-accent)` | `var(--analysis)`（`--color-violet-600`） |
| KPI 数値フォント | `var(--font-family-mono)` | `'JetBrains Mono', …` |
| チャート棒 | `var(--component-chart-bar-bg)` | `var(--primary)` |
| 非強調の棒 | `var(--component-chart-bar-muted-bg)` | `var(--color-gray-300)` |
| チャートグリッド | `var(--component-chart-grid)` | `var(--border)`（ダークは `--color-gray-700`） |
| 表ヘッダー | `var(--component-table-header-bg)` | `var(--color-gray-50)` |
| KPI 群の間隔 | `var(--semantic-component-gap)` | `var(--spacing-3)` |
| 層の間隔 | `var(--semantic-section-gap)` | `var(--spacing-8)` |

#### UIロジック

- **状態管理**: ステート層（`L-frontend-staff-state`）で `LoanStatsViewState { report, breakdownAxis, page, loading, error }` を保持する。`breakdownAxis`（利用者区分／ジャンル）の切り替えは取得済みデータの再描画のみで、API を再取得しない
- **バリデーション**: 参照系のため入力バリデーションは持たない。`page` はページネーションの範囲内に制限する
- **ローディング**: 取得中と統計レポート状態「集計中」はいずれも `AsyncSection` 経由の `LoadingState`（KPI 群 `kind="card"` / チャート `kind="card"` / ランキング表 `kind="list"`）に一本化して表示する。画面側で `Skeleton` / `Spinner` / `animate-pulse` を直接使わず、同一領域でスケルトンとスピナーを併用しない。集計完了は `aria-live="polite"` で通知する
- **エラーハンドリング**: HTTP 404 は「まだ集計されていません。集計を実行してください」を `EmptyState(with-action)` で表示する。HTTP 403 は「この操作には司書の権限が必要です」、5xx は `Alert(destructive)` を `role="alert"` で表示し再取得導線を出す
- **アクセシビリティ**: `LoanTrendChart` に期間ラベルと `aria-label` を付与し、同じ内容を第 3 層の `Table` でテキスト提供する。表は `caption` と `th scope` を付ける
- **数値表記**: 件数は `toLocaleString('ja-JP')` の 3 桁区切り、比率は小数第 1 位まで表示する（arch SR-004）
- **個人情報**: ランキング・内訳は件数のみを扱い、利用者の氏名・連絡先・利用者番号を表示しない（arch SR-006 / NFR E.1.2.1）

#### 操作フロー

1. 司書がサイドバー「レポート」→「貸出統計レポート」を選び、`useAppNavigation().navigate("staff-report-loans")` で本画面（`/staff/reports/loans`）を開く
2. 最新の貸出統計レポートを取得し、統計レポート状態に応じて表示を切り替える
3. 作成済みなら KPI 4 枚 → 推移チャート → ランキング表の順に読み取る
4. 内訳の軸（利用者区分／ジャンル）を切り替えて構成比を確認する
5. ランキング表を `Pagination` で 20 件/頁ずつ辿る
6. 条件を変えたい場合は「条件を変更する」で `useAppNavigation().navigate("staff-report-loans-new")` により集計期間指定画面（`/staff/reports/loans/new`）へ遷移する

## コンポーネント設計

### LoanStatsKpiRow

- **ベースコンポーネント**: `ReportKpiCard`（Domain / `with-delta` バリアント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | label | string | Yes | 指標名（期間内貸出件数 / 返却済み件数 / 利用者数 / 1利用者あたり貸出件数） |
  | value | number | Yes | 指標値。等幅・3 桁区切りで表示する |
  | unit | string | No | 単位（件 / 人） |
  | delta | number | No | 前期比（％）。増減とも中立トーンで示す |
  | tone | `'default' \| 'neutral'` | No | 既定は `default`。減少を `destructive` にしない |
- **状態**: なし（表示専用）
- **イベント**: なし

### LoanTrendSection

- **ベースコンポーネント**: `LoanTrendChart`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | data | `{ label: string; value: number }[]` | Yes | 期間ごとの貸出件数。時間順に固定し欠損期間は 0 で含める |
  | unit | string | No | 単位（件） |
  | highlightMax | boolean | No | 最大値の期間にデータラベルを付ける |
  | emptyMessage | string | No | 実績なし時の文言 |
- **状態**: なし（表示専用）
- **イベント**: なし

### PopularBookRankingTable

- **ベースコンポーネント**: `Table` + `Pagination`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | ranking | `{ rank: number; bookId: string; title: string; author: string; genre: string; loanCount: number }[]` | Yes | ランキング行（20 件/頁） |
  | page | number | Yes | 現在ページ |
  | totalPages | number | Yes | 総ページ数 |
- **状態**: なし（親のステート層が保持）
- **イベント**: `onPageChange(page)`

### LoanBreakdownPanel

- **ベースコンポーネント**: `LoanTrendChart`（区分別棒）+ `Table`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | axis | `'利用者区分' \| 'ジャンル'` | Yes | 内訳の集計軸 |
  | data | `{ label: string; value: number }[]` | Yes | 区分ごとの貸出件数 |
- **状態**: `axis`（親のステート層と同期）
- **イベント**: `onAxisChange(axis)` — 再取得せず再描画する
- **デザインシステムへの拡張要求**: 現行のデザインシステム定義（`docs/design/latest/_digest/components.yaml#LoanTrendChart`）は時系列用で variants が `monthly` / `daily` / `empty` のみであり、区分別棒バリアントも軸切り替えイベント `onAxisChange` に対応する props も持たない。区分別棒バリアントと軸切り替え props の追加はデザインシステムへの拡張要求として扱う（拡張が承認されない場合は、利用者区分別内訳を `Table` のみ＝既存バリアント範囲の表現に置き換える）

## ティア完了条件（BDD）

```gherkin
Feature: 貸出統計レポートを参照する - 司書ポータル

  Scenario: 3層構造で貸出統計を表示する
    Given 貸出統計レポートの取得結果が 期間内貸出件数 240・返却済み 200・利用者数 96・1利用者あたり 2.5 件である
    When 司書「山田花子」が貸出統計レポート画面を開く
    Then ReportKpiCard が 4 枚表示され、LoanTrendChart が 1 枚、ランキング Table が 20 件表示される

  Scenario: 集計期間区分に応じたチャートバリアントを使う
    Given レポートの集計期間区分が「日次」である
    When 司書が貸出統計レポート画面を開く
    Then LoanTrendChart が daily バリアントで描画され、棒が時間順に並ぶ

  Scenario: 内訳の軸切り替えで再取得しない
    Given 司書が貸出統計レポート画面を表示している
    When 司書が内訳の軸を「ジャンル」に切り替える
    Then ジャンル 8 区分が Table で表示され、API リクエストは追加で発生しない

  Scenario: 実績なしはEmptyStateを表示する
    Given API が report_status "実績なし" を返す
    When 司書が貸出統計レポート画面を開く
    Then EmptyState に「対象期間に貸出実績がありません」と「集計期間を変更して再集計する」が表示される

  Scenario: 個人情報を表示しない
    Given 貸出統計レポートの内訳に利用者区分別の件数が含まれている
    When 司書が貸出統計レポート画面を開く
    Then 画面に利用者の氏名・連絡先・利用者番号は表示されない
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（`staff-report-loans-new`） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「集計中の表示」（KPI 群 `kind="card"` / チャート `kind="card"` / ランキング表 `kind="list"`）。`AsyncSection` の `skeleton` prop 経由で間接利用する |
| `AsyncSection` | `@/components/common/AsyncSection` | LoanStatsKpiRow / LoanTrendSection / PopularBookRankingTable の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（PopularBookRankingTable（`Table`） + `Pagination` 20 件/頁） |
| `ReportSummarySection` | `@/components/common/ReportSummarySection` | 「KPI 行 → 推移チャート → 明細テーブル」の情報階層 |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← KPI 群 `"card"` / チャート `"line"` / ランキング表 `"list"` / `label` ← `"貸出統計レポートの KPI を読み込み中"` / `"貸出件数推移チャートを読み込み中"` / `"人気書籍ランキングを読み込み中"` / `rows` ← ランキング表は `per_page`（20） |
| `AsyncSection` | `loading` ← LoanStatsKpiRow / LoanTrendSection / PopularBookRankingTable の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← 領域ごとに `"card"` / `"line"` / `"list"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← 上記の `label` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← なし / `table` ← PopularBookRankingTable（`Table`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |
| `ReportSummarySection` | `status` ← `ReportStatusBadge` の状態（集計中 / 作成済み / 実績なし） / `kpis` ← LoanStatsKpiRow（`ReportKpiCard`）（1 行 4 件まで） / `chart` ← LoanTrendSection（`LoanTrendChart`） / LoanBreakdownPanel / `detail` ← PopularBookRankingTable（`Table` + `Pagination`） / `emptyMessage` ← 実績なしの文言 |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけ
- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
