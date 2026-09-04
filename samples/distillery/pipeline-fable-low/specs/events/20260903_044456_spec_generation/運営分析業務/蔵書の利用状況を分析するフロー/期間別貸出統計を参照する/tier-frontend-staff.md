# 期間別貸出統計を参照する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルの分析レポートグループに期間別貸出統計画面（`/staff/reports/loans`）を追加する。PeriodSelector で集計期間種別（日 / 月 / 年）と期間を指定し、`GET /api/v1/reports/loan-statistics` の結果を StatCard と PeriodStatChart で表示する。集計中は Skeleton + 「集計中」文言で待ち時間を可視化する（design nfr_decisions B.2.1.3 / arch LP-036）。

## 画面仕様

### 期間別貸出統計画面

- **URL**: `/staff/reports/loans?periodType={DAY|MONTH|YEAR}&from={YYYY-MM-DD}&to={YYYY-MM-DD}`
- **アクセス権**: 司書（認証 + 司書区分必須。館内経路）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff） | サイドバー「分析レポート」グループのアクティブ項目 |
| 期間指定 | フォーム | PeriodSelector | granularity（日 / 月 / 年）と from / to。既定: 月・直近 12 か月 |
| 期間内貸出件数 | テキスト | StatCard | label「期間内貸出件数」、value = totalLoans、unit「件」、delta = 前期比 |
| 1 期間あたり平均 | テキスト | StatCard | label「1 期間あたり平均」、value = totalLoans / series 数（小数 1 桁） |
| 貸出件数推移 | グラフ | PeriodStatChart | series（periodStart, loanTotal）、granularity。bar = var(--chart-bar) |
| 集計中 | ローディング | Skeleton（card / line） | StatCard 2 枚と PeriodStatChart の領域を Skeleton にし「集計中…」を表示 |
| データなし | 空状態 | EmptyState（default） | 期間内の貸出が 0 件のとき「この期間の貸出はありません」 |
| エラー | 通知 | Alert（destructive） | 400 / 403 / 5xx の司書向けメッセージ（理由コード付き） |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | design tokens semantic.background |
| アクセント | var(--primary) | staff = #334155（Shelf Slate） |
| 集計値サイズ | var(--font-size-3xl) | component.stat_card.value_size |
| 集計値ラベル | var(--foreground-secondary) | component.stat_card.label_color |
| 棒グラフ | var(--chart-bar) / var(--chart-bar-muted) | component.chart.bar = var(--primary) / bar_muted = var(--primary-light) |
| グラフ罫線 | var(--chart-grid) | component.chart.grid = var(--border)（dark: gray-700） |

#### UIロジック

- **状態管理**: 2 層構成（view / component → api client。CLP-012）。画面内状態 = { periodType, from, to, status(idle/loading/success/empty/error), data, error }。期間は URL クエリと同期し、分析 3 画面（在庫状況一覧 / 人気書籍ランキング / 期間別貸出統計）間で引き継ぐ
- **バリデーション**: from <= to。periodType ごとの上限（日 366 日 / 月 36 か月 / 年 10 年）を超える場合は PeriodSelector にエラー文言を出し API を呼ばない。日付は YYYY/MM/DD 表示・YYYY-MM-DD 送信
- **ローディング**: 取得中は StatCard と PeriodStatChart を Skeleton に置き換え「集計中…」を表示。PeriodSelector 変更のたびに再取得（連続変更は 300ms デバウンス）
- **エラーハンドリング**: api client が HTTP エラーを統一エラー型に正規化（LR-027）。400 → PeriodSelector にフィールドエラー、403 → 「この機能は司書のみ利用できます」、5xx / タイムアウト（10 秒）→ Alert（destructive）+ 再試行ボタン
- **個人情報**: 本画面は集計値のみを扱い個人情報を表示しない

#### 操作フロー

1. 司書がサイドバー「分析レポート > 期間別貸出統計」を選ぶ（または他の分析画面から期間クエリ付きで遷移する）
2. 既定（月・直近 12 か月）または URL クエリの期間で API を呼び、Skeleton を表示する
3. 応答後に StatCard（期間内貸出件数・前期比、1 期間あたり平均）と PeriodStatChart を描画する
4. PeriodSelector で集計期間種別や期間を変更すると URL クエリを更新して再取得する
5. 貸出が 0 件の期間は EmptyState を表示する

## コンポーネント設計

### LoanStatisticsPage

- **ベースコンポーネント**: PortalShell（staff）+ PeriodSelector + StatCard + PeriodStatChart + Skeleton + EmptyState + Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialPeriod | { periodType: 'DAY' \| 'MONTH' \| 'YEAR'; from: string; to: string } | No | URL クエリから復元した初期期間。無ければ月・直近 12 か月 |
- **状態**: periodType / from / to / status / data(LoanStatisticsResponse) / error(NormalizedApiError)
- **イベント**: onPeriodChange（PeriodSelector → URL 更新 + 再取得）、onRetry（Alert の再試行）

### PeriodSelector（本画面での利用）

- **ベースコンポーネント**: PeriodSelector（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | granularity | 'DAY' \| 'MONTH' \| 'YEAR' | Yes | 集計期間種別（バリエーション「集計期間種別」） |
  | from | string | Yes | 期間開始日（YYYY-MM-DD） |
  | to | string | Yes | 期間終了日（YYYY-MM-DD） |
  | onChange | (value) => void | Yes | 変更時に呼ぶ |
  | maxRangeError | string | No | 上限超過時のエラー文言 |
- **状態**: なし（制御コンポーネント）
- **イベント**: onChange

### PeriodStatChart（本画面での利用）

- **ベースコンポーネント**: PeriodStatChart（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | series | { periodStart: string; periodEnd: string; loanTotal: number }[] | Yes | 期間別貸出件数 |
  | granularity | 'DAY' \| 'MONTH' \| 'YEAR' | Yes | X 軸ラベルの書式（日: MM/DD、月: YYYY/MM、年: YYYY） |
  | loading | boolean | No | true で Skeleton |
- **状態**: なし
- **イベント**: なし（sm ではバー本数を最大 31 本に制限しラベルを間引く）

## ティア完了条件（BDD）

```gherkin
Feature: 期間別貸出統計を参照する - 司書向けフロントエンド

  Scenario: 既定期間で統計を表示する
    Given 司書「S-0001」がログイン済みで、今日が 2026-09-03 である
    And API GET /api/v1/reports/loan-statistics が periodType=MONTH&from=2025-10-01&to=2026-09-30 に対して series 12 件・totalLoans=1580・previousTotalLoans=1420 を返す
    When /staff/reports/loans を開く
    Then 取得中は StatCard と PeriodStatChart の領域に Skeleton と「集計中…」が表示される
    And 応答後に StatCard「期間内貸出件数」に「1,580 件」と delta「+160」が表示される
    And PeriodStatChart に 12 本のバーが表示される

  Scenario: 上限超過の期間は API を呼ばずにエラーを表示する
    Given 司書「S-0001」が /staff/reports/loans を表示している
    When PeriodSelector で granularity=DAY, from=2025-01-01, to=2026-12-31 を指定する
    Then PeriodSelector に「日単位の集計期間は 366 日以内で指定してください」が表示される
    And API は呼ばれない

  Scenario: 貸出 0 件の期間は EmptyState を表示する
    Given 司書「S-0001」が /staff/reports/loans を表示している
    And API が totalLoans=0 の応答を返す
    When PeriodSelector で from=2020-01-01, to=2020-12-31, granularity=MONTH を指定する
    Then EmptyState「この期間の貸出はありません」が表示される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-貸出統計）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'reports'、activeItem = 'loanStatistics' |
| PageHeader | `@/components/common/PageHeader` | title = 「期間別貸出統計」 |
| PeriodReportFrame | `@/components/common/PeriodReportFrame` | period = { granularity: state.periodType, from: state.from, to: state.to }（既定: 月・直近 12 か月）、onPeriodChange = onPeriodChange（URL 更新 + 300ms デバウンス再取得）、maxRangeError = 上限超過文言（例: 「日単位の集計期間は 366 日以内で指定してください」）、stats = [{ key: 'total', label: 「期間内貸出件数」, value: data.totalLoans, unit: 「件」, delta: totalLoans - previousTotalLoans }, { key: 'avg', label: 「1 期間あたり平均」, value: totalLoans / series.length }]、loading = status === 'loading'、error = state.error、empty = status === 'empty'、emptyState = { title: 「この期間の貸出はありません」 }、onRetry = onRetry、children = PeriodStatChart |
| StatCardGroup | `@/components/common/StatCardGroup` | PeriodReportFrame 内部で利用（stats、loadingLabel = 「集計中…」） |
| AsyncStateView | `@/components/common/AsyncStateView` | PeriodReportFrame 内部で利用（loadingLabel = 「集計中…」） |
| ErrorAlert | `@/components/common/ErrorAlert` | PeriodReportFrame 内部で利用。audience = 'staff'（reasonCode 併記。400 → validation を PeriodSelector へ） |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useUrlQueryState | `periodType` / `from` / `to` の URL クエリ双方向同期（分析 3 画面間で期間を引き継ぐ） |
