# 人気書籍ランキングを参照する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルの分析レポートグループに人気書籍ランキング画面（`/staff/reports/ranking`）を追加する。PeriodSelector（期間別貸出統計画面と共通）で期間を指定し、`GET /api/v1/reports/popular-books` の結果を StatCard と RankingList で表示する。集計中は Skeleton + 「集計中」文言（arch LP-036 / NFR B.2.1.3）。

## 画面仕様

### 人気書籍ランキング画面

- **URL**: `/staff/reports/ranking?periodType={DAY|MONTH|YEAR}&from={YYYY-MM-DD}&to={YYYY-MM-DD}&limit={1..100}`
- **アクセス権**: 司書（認証 + 司書区分必須。館内経路）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff） | サイドバー「分析レポート」グループ |
| 期間指定 | フォーム | PeriodSelector | granularity / from / to。既定: 月・直近 12 か月。分析 3 画面で URL クエリを引き継ぐ |
| 表示件数 | フォーム | ToggleGroup（single, sm） | 10 / 20 / 50 件。既定 20 |
| 期間内貸出件数 | テキスト | StatCard | label「期間内貸出件数」、value = totalLoans、unit「件」 |
| 1 位の貸出回数 | テキスト | StatCard | label「1 位の貸出回数」、value = items[0].loanCount、unit「回」 |
| ランキング | リスト | RankingList | items（ranking / title / author / genreName / loanCount）、limit。バーは 1 位比 |
| 集計中 | ローディング | Skeleton（line × limit 件） | RankingList の領域を Skeleton にし「集計中…」を表示 |
| データなし | 空状態 | EmptyState（default） | 「この期間の貸出はありません」 |
| エラー | 通知 | Alert（destructive） | 400 / 403 / 5xx の司書向けメッセージ（理由コード付き） |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | design tokens semantic.background |
| アクセント | var(--primary) | staff = #334155（Shelf Slate） |
| 集計値サイズ | var(--font-size-3xl) | component.stat_card.value_size |
| ランキングバー | var(--chart-bar) | component.chart.bar = var(--primary) |
| ランキングバー（2 位以下） | var(--chart-bar-muted) | component.chart.bar_muted = var(--primary-light) |
| 行区切り | var(--border) | semantic.border |

#### UIロジック

- **状態管理**: 2 層構成（view / component → api client。CLP-012）。画面内状態 = { periodType, from, to, limit, status(idle/loading/success/empty/error), data, error }。期間と limit は URL クエリと同期する
- **バリデーション**: PeriodSelector の from <= to と期間上限（日 366 日 / 月 36 か月 / 年 10 年）。limit は ToggleGroup の固定値のため入力検証不要
- **ローディング**: 取得中は StatCard と RankingList を Skeleton に置き換え「集計中…」を表示。PeriodSelector 変更は 300ms デバウンス
- **エラーハンドリング**: api client が HTTP エラーを統一エラー型に正規化（LR-027）。400 → PeriodSelector にフィールドエラー、403 → 「この機能は司書のみ利用できます」、5xx / タイムアウト（10 秒）→ Alert（destructive）+ 再試行
- **個人情報**: 表示しない（書籍の集計値のみ）

#### 操作フロー

1. 司書がサイドバー「分析レポート > 人気書籍ランキング」を選ぶ（または他の分析画面から期間クエリ付きで遷移する）
2. 既定または URL クエリの期間・件数で API を呼び、Skeleton を表示する
3. 応答後に StatCard 2 枚と RankingList（順位 / 書籍 / ジャンル / 貸出回数バー）を描画する
4. PeriodSelector や表示件数を変更すると URL クエリを更新して再取得する
5. ランキング行のタイトルを選ぶと蔵書一覧画面（`/staff/books?bookId=`）へ遷移し、書籍情報を確認できる

## コンポーネント設計

### PopularBooksPage

- **ベースコンポーネント**: PortalShell（staff）+ PeriodSelector + ToggleGroup + StatCard + RankingList + Skeleton + EmptyState + Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialPeriod | { periodType: 'DAY' \| 'MONTH' \| 'YEAR'; from: string; to: string } | No | URL クエリから復元した初期期間 |
  | initialLimit | 10 \| 20 \| 50 | No | 初期表示件数（既定 20） |
- **状態**: periodType / from / to / limit / status / data(PopularBooksResponse) / error
- **イベント**: onPeriodChange、onLimitChange、onSelectBook（bookId → 蔵書一覧画面へ遷移）、onRetry

### RankingList（本画面での利用）

- **ベースコンポーネント**: RankingList（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | items | { ranking: number; bookId: string; title: string; author: string; genreName: string; loanCount: number }[] | Yes | 順位付きの書籍一覧（API の items をそのまま渡す） |
  | limit | number | Yes | 表示件数上限 |
  | onSelect | (bookId: string) => void | No | 行選択時 |
- **状態**: なし
- **イベント**: onSelect。バーの幅は loanCount / items[0].loanCount。同順位は同じ順位番号を表示する

## ティア完了条件（BDD）

```gherkin
Feature: 人気書籍ランキングを参照する - 司書向けフロントエンド

  Scenario: 既定期間でランキングを表示する
    Given 司書「S-0001」がログイン済みで、今日が 2026-09-03 である
    And API GET /api/v1/reports/popular-books が periodType=MONTH&from=2025-10-01&to=2026-09-30&limit=20 に対して items 20 件（1 位「吾輩は猫である」42 回）と totalLoans=1580 を返す
    When /staff/reports/ranking を開く
    Then 取得中は RankingList の領域に Skeleton と「集計中…」が表示される
    And 応答後に RankingList の 1 行目に順位 1・「吾輩は猫である」・「42 回」が表示される
    And StatCard「期間内貸出件数」に「1,580 件」が表示される

  Scenario: 表示件数を 50 件に切り替える
    Given 司書「S-0001」が /staff/reports/ranking を表示している
    When 表示件数の ToggleGroup で「50」を選ぶ
    Then URL クエリの limit が 50 に更新され API が limit=50 で再取得される

  Scenario: 期間内に貸出がなければ EmptyState を表示する
    Given 司書「S-0001」が /staff/reports/ranking を表示している
    And API が items=[]・totalLoans=0 を返す
    When PeriodSelector で granularity=YEAR, from=2020-01-01, to=2020-12-31 を指定する
    Then EmptyState「この期間の貸出はありません」が表示され StatCard は「0 件」を表示する
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-ランキング）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'reports'、activeItem = 'ranking' |
| PageHeader | `@/components/common/PageHeader` | title = 「人気書籍ランキング」 |
| PeriodReportFrame | `@/components/common/PeriodReportFrame` | period = { granularity: state.periodType, from: state.from, to: state.to }、onPeriodChange = onPeriodChange（URL 更新 + 300ms デバウンス再取得）、maxRangeError = 上限超過文言、stats = [{ key: 'total', label: 「期間内貸出件数」, value: data.totalLoans, unit: 「件」 }, { key: 'top', label: 「1 位の貸出回数」, value: items[0]?.loanCount ?? 0, unit: 「回」 }]、extraControls = ScopeToggle（表示件数）、loading = status === 'loading'、error = state.error、empty = status === 'empty'、emptyState = { title: 「この期間の貸出はありません」 }、onRetry = onRetry、children = RankingList |
| ScopeToggle | `@/components/common/ScopeToggle` | options = [{ value: '10', label: '10' }, { value: '20', label: '20' }, { value: '50', label: '50' }]、value = String(state.limit)、onChange = onLimitChange、size = 'sm'、ariaLabel = 「表示件数」 |
| StatCardGroup | `@/components/common/StatCardGroup` | PeriodReportFrame 内部で利用（stats、loadingLabel = 「集計中…」） |
| AsyncStateView | `@/components/common/AsyncStateView` | PeriodReportFrame 内部で利用（skeleton = { variant: 'line', count: limit }、loadingLabel = 「集計中…」） |
| ErrorAlert | `@/components/common/ErrorAlert` | PeriodReportFrame 内部で利用。audience = 'staff'（reasonCode 併記） |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useUrlQueryState | `periodType` / `from` / `to` / `limit` の URL クエリ双方向同期（分析 3 画面間で期間を引き継ぐ） |
