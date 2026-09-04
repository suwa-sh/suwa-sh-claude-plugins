# 期限超過の貸出を延滞にする - 司書ポータル仕様

## 変更概要

日次タイマーによる延滞判定の結果を司書が確認するための延滞判定結果確認画面を追加する。状態遷移（貸出中 → 延滞）の件数を結果サマリとして示し、遷移した貸出の一覧を表示する。延滞状況一覧画面への導線を持つ。

## 画面仕様

### 延滞判定結果確認画面

- **ルート id**: `staff-overdue-judge`
- **URL**: `/staff/overdues/judge`（クエリ `base_date` を受け付ける）（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（館内ネットワークからのみ到達可能。NFR E.5.3.1）
- **ポータル**: `staff`（司書ポータル）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインの共通骨格 |
| 判定結果サマリ | 通知 | `Alert`（`info`） | 「貸出中 → 延滞 N 件（判定日: {base_date}）」を画面上部に表示する。`base_date` は API 上 ISO 8601 `YYYY-MM-DD` で受け取り、画面表示は `YYYY年M月D日`（例 `2026年9月2日`）に整形する |
| 延滞総数 | テキスト | `Card`（`flush`） | 判定後の延滞総件数を併記する |
| 遷移対象の一覧 | テーブル | `LoanTable`（`showUser=true`） | 書籍タイトル・著者・利用者名・返却期限・超過日数を表示する。返却期限は一覧の列として `YYYY/MM/DD`、超過日数は `{N}日超過` の文言で示す（`ui-design.md`「日付・期限の表示規約」が正本） |
| 貸出状態の表示 | バッジ | `LoanStatusBadge`（`state=延滞`, `dot`） | 状態名の文言を必ず伴う（色のみに依存しない） |
| 延滞状況一覧へ | ボタン | `Button`（`default`） | 延滞状況一覧画面（ルート id `staff-overdue-list`）へ遷移する |
| 判定日の指定 | 入力 | `Input`（`default`, type=date） | 過去日の判定結果を再表示する。既定は当日 |
| 0 件時の表示 | 空状態 | `EmptyState`（`default`） | 「新たに延滞となった貸出はありません」 |
| 読み込み中 | 状態表示 | `LoadingState`（`kind: list`, `label: 「延滞判定結果を読み込み中」`, `delayMs: 300`） | `AsyncSection` の `skeleton` 経由で表示する。画面側で `Skeleton` / `Spinner` を直接使わない |
| 取得失敗 | 警告 | `Alert`（`destructive`） | 再取得ボタンを併記する |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| アクセント | `var(--semantic-primary_staff)` | `var(--color-teal-700)`（`#0F766E`） |
| 延滞の強調 | `var(--semantic-destructive)` | `var(--color-red-600)` |
| 超過日数の表示 | `var(--duedate-over_color)` | component 層の `duedate` トークン |
| セクション間隔 | `var(--layout-section_gap)` | `var(--spacing-8)` |
| カード余白 | `var(--layout-card_padding)` | `var(--spacing-6)` |

#### UIロジック

- **状態管理**: `OverdueJudgementState`（`baseDate` / `transitionedCount` / `overdueTotal` / `items` / `page` / `loading` / `error`）で保持する。`baseDate` は URL クエリと同期し、ブラウザバックで前の判定日へ戻れるようにする
- **バリデーション**: `baseDate` は ISO 日付形式のみ受け付ける。未来日を指定した場合は当日に丸める
- **ローディング**: loading 表現は共通コンポーネント `LoadingState`（`@/components/common/LoadingState`）に一本化する。取得中は `AsyncSection` の `skeleton="list"` 経由で `LoadingState`（`kind="list"` / `label="延滞判定結果を読み込み中"` / `delayMs=300`）を表示する。画面側で `Skeleton` / `Spinner` を直接使わず、同一領域での併用もしない
- **エラーハンドリング**: 取得失敗は `Alert`（`destructive`）+ 再取得ボタン。403 は「この画面は司書のみ利用できます」を表示する
- **本画面は照会専用**: 状態遷移の実行は日次タイマー起動のワーカーが担う。画面から遷移を実行するボタンは置かない
- **アクセシビリティ**: 結果サマリの更新を `aria-live="polite"` で通知する。テーブルに `caption` と `th scope` を付与する

#### 操作フロー

1. 司書がサイドバー「期限・督促」から延滞判定結果確認画面を開く
2. 当日の判定結果（遷移件数・延滞総数）を結果サマリとして表示する
3. 遷移した貸出の一覧を確認する（超過日数つき）
4. 必要に応じて判定日を変更し、過去日の判定結果を再表示する
5. 「延滞状況を確認する」ボタンで `useAppNavigation().navigate("staff-overdue-list")`（表示 URL `/staff/overdues`）により延滞状況一覧画面へ遷移する

## コンポーネント設計

### OverdueJudgementSummary

- **ベースコンポーネント**: `Alert`（UI、`info`）+ `Card`（UI、`flush`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | baseDate | string | Yes | 判定日。API 上は ISO 8601 `YYYY-MM-DD` で受け取り、表示は `YYYY年M月D日` に整形する |
  | transitionedCount | number | Yes | 貸出中 → 延滞の遷移件数 |
  | overdueTotal | number | Yes | 判定後の延滞総件数 |
- **状態**: なし（表示専用）
- **イベント**: なし

### OverdueJudgedLoanList

- **ベースコンポーネント**: `LoanTable`（Domain）+ `LoanStatusBadge`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | JudgedOverdueLoan[] | Yes | 遷移対象の配列（loanId / bookTitle / author / userNo / userName / dueDate / daysOverdue / loanStatus） |
  | loading | boolean | Yes | 取得中フラグ |
  | error | string \| null | Yes | 取得エラーメッセージ |
  | showUser | boolean | Yes | 司書向けのため常に `true` |
  | emptyMessage | string | No | 既定「新たに延滞となった貸出はありません」 |
- **状態**: `default` / `loading` / `empty` / `error`
- **イベント**: なし（照会専用）

## ティア完了条件（BDD）

```gherkin
Feature: 期限超過の貸出を延滞にする - 司書ポータル

  Scenario: 状態遷移の件数を結果サマリで示す
    Given API が transitioned_count「3」・overdue_total「12」を返す
    When 司書が延滞判定結果確認画面を開く
    Then Alert(info) に「貸出中 → 延滞 3 件（判定日: 2026年9月2日）」と延滞総数「12 件」が表示される

  Scenario: 遷移した貸出を超過日数つきで表示する
    Given API が貸出「L-3001」（書籍「坊っちゃん」/ 利用者「田中太郎」/ 返却期限「2026-09-01」/ 超過日数 1）を返す
    When 司書が延滞判定結果確認画面を開く
    Then LoanTable に「坊っちゃん」「田中太郎」の行が返却期限 "2026/09/01"・「1日超過」で表示され LoanStatusBadge に「延滞」の文言が表示される

  Scenario: 判定日を変更して過去の結果を表示する
    Given 延滞判定結果確認画面が当日「2026-09-02」で表示されている
    When 司書が判定日に「2026-09-01」を入力する
    Then base_date「2026-09-01」で判定結果が再取得され URL クエリが同期する

  Scenario: 遷移が 0 件のとき空状態を表示する
    Given API が transitioned_count「0」を返す
    When 司書が延滞判定結果確認画面を開く
    Then 「貸出中 → 延滞 0 件」と EmptyState「新たに延滞となった貸出はありません」が表示される

  Scenario: 画面から状態遷移を実行できない
    Given 司書が延滞判定結果確認画面を開いている
    When 司書が画面上の操作を確認する
    Then 延滞へ遷移させる実行ボタンは存在せず延滞状況一覧画面への導線のみが表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（`staff-overdue-list`） |
| `LoadingState` | `@/components/common/LoadingState` | loading 表現の唯一の入口。判定結果の取得中（`kind="list"`） |
| `AsyncSection` | `@/components/common/AsyncSection` | OverdueJudgedLoanList の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `EntityFormSection` | `@/components/common/EntityFormSection` | 表示要素「判定日の指定」（`Input(type=date)`） の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AppShell` | `portal` ← `"staff"` / `routeId` ← `staff-overdue-judge` / `onNavigate` ← 実装リポのルーター遷移関数 / `children` ← 本画面のページ本体 |
| `useAppNavigation` | `navigate` ← ルート id（`staff-overdue-list`）/ `href` ← 表示用リンクの生成 |
| `LoadingState` | `kind` ← `"list"`（`AsyncSection` の `skeleton` がそのまま渡る）/ `label` ← 「延滞判定結果を読み込み中」/ `delayMs` ← `300` |
| `AsyncSection` | `loading` ← OverdueJudgedLoanList の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"list"`（`LoadingState` の `kind` にそのまま渡る）/ `loadingLabel` ← 「延滞判定結果を読み込み中」/ `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `EntityFormSection` | `mode` ← `"action"` / `fields` ← 判定日（text, type=date、既定は当日） / `value` `onChange` ← 表示要素「判定日の指定」（`Input(type=date)`） の同名 props / `current` ← — / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 本 UC の一覧はページ送りを伴わないため `DataListSection` を使わず、`AsyncSection` + Domain テーブルの直接組み合わせとする（common-components.md の参考）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
