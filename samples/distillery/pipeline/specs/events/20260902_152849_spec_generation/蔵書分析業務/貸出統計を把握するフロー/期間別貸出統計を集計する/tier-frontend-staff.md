# 期間別貸出統計を集計する - 司書ポータル仕様

## 変更概要

集計期間指定画面（`/staff/reports/loans/new`）を追加し、レポート種別・集計期間区分・集計期間を指定して貸出統計の集計要求を送信できるようにする。送信後は貸出統計レポート画面へ前方遷移し、統計レポート状態「集計中」を表示する。

## 画面仕様

### 集計期間指定画面

- **URL**: `/staff/reports/loans/new`
- **アクセス権**: 司書（司書ロールのトークンを持つ場合のみ。arch SR-005）
- **ポータル**: staff（司書ポータル / `primary_staff`）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠・サイドバー | レイアウト | `PortalShell`（`staff`） | ナビ末尾「レポート」配下に配置する |
| レポート種別の選択 | トグル | `ReportPeriodSelector`（内部で `ToggleGroup(single)`） | バリエーション「レポート種別」の値のみ。本画面では「期間別貸出統計」を初期選択とし「人気書籍ランキング」も選べる |
| 集計期間区分の選択 | トグル | `ReportPeriodSelector` | バリエーション「集計期間区分」（日次／月次／年次）。既定は「月次」 |
| 集計期間（開始日／終了日） | 入力 | `ReportPeriodSelector`（内部で `Input`） | 集計期間区分に応じた既定期間を初期表示する |
| 直近の集計状態 | バッジ | `ReportStatusBadge` | 直近レポートの統計レポート状態を示す |
| 実績なしの注意喚起 | 通知 | `Alert(info)` | 直近の集計が「実績なし」だった場合に「集計期間を変更して再集計してください」を示す |
| 集計を実行 | ボタン | `Button(default)` | 送信中は `loading` + `disabled` + `aria-busy="true"`（arch SR-002） |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-teal-700)` |
| カード | `var(--component-card-bg)` / `var(--component-card-radius)` | `var(--color-white)` / `var(--radius-xl)` |
| 通知 | `var(--component-alert-radius)` / `var(--component-alert-padding)` | `var(--radius-lg)` / `var(--spacing-4)` |
| ボタン | `var(--component-button-height-md)` | `2.25rem` |
| セクション余白 | `var(--semantic-section-gap)` | `var(--spacing-8)` |
| 集計中バッジ色 | `var(--semantic-analysis)` | `var(--color-violet-600)` |

#### UIロジック

- **状態管理**: ステート層（`L-frontend-staff-state`）で `LoanStatsRequestState { reportType, periodType, periodStart, periodEnd, submitting }` を保持する。既定値は `reportType='期間別貸出統計'`, `periodType='月次'`
- **バリデーション**: `periodStart <= periodEnd` を送信前に検査する。レポート種別・集計期間区分は `ToggleGroup` で RDRA バリエーション値に束縛し、自由入力の分岐を作らない。実績有無の判定（貸出統計集計条件）はバックエンドに委ねる
- **ローディング**: 送信中は `Button` を `loading`、遷移先で `ReportStatusBadge`「集計中」+ `Skeleton` を表示する
- **エラーハンドリング**: HTTP 400 は `Alert(destructive)` を `role="alert"` でフォーム上部に表示する。HTTP 403 は「この操作には司書の権限が必要です」を表示して再送しない。5xx は再試行導線を出す
- **冪等性**: 集計要求ごとに UUID の冪等キーを生成し `X-Idempotency-Key` ヘッダへ付与する（arch SR-002）

#### 操作フロー

1. 司書がサイドバー「レポート」→「貸出統計レポート」→「条件を変更する」から本画面を開く
2. レポート種別（既定「期間別貸出統計」）・集計期間区分（既定「月次」）・集計期間を確認する
3. 「集計を実行」を押す。ボタンは `loading` かつ `aria-busy="true"` になる
4. HTTP 202 を受け取り、`report_id` を保持して貸出統計レポート画面（`/staff/reports/loans`）へ前方遷移する
5. 遷移先で統計レポート状態「集計中」を表示し、完了を `aria-live="polite"` で通知する
6. 集計結果が「実績なし」だった場合は本画面へ戻り、期間を変更して再集計する

## コンポーネント設計

### LoanStatsPeriodForm

- **ベースコンポーネント**: `ReportPeriodSelector`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | `{ reportType: string; periodType: string; periodStart: string; periodEnd: string }` | Yes | 集計条件の現在値 |
  | onChange | `(value) => void` | Yes | 条件変更時に呼ばれる |
  | onSubmit | `() => void` | Yes | 集計実行時に呼ばれる |
  | submitting | boolean | No | 送信中は `submitting` バリアントで表示する |
- **状態**: `submitting`（送信中）、`periodError`（期間の前後関係エラー）
- **イベント**: `onChange`（トグル・日付入力）、`onSubmit`（集計を実行）

### LoanStatsNoResultNotice

- **ベースコンポーネント**: `Alert`（UI / `info` バリアント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | visible | boolean | Yes | 直近の集計が「実績なし」のときに表示する |
  | previousPeriod | string | No | 実績なしだった集計期間を再掲する |
- **状態**: なし（表示専用）
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 期間別貸出統計を集計する - 司書ポータル

  Scenario: 既定値のまま集計を実行できる
    Given 司書「山田花子」が集計期間指定画面 /staff/reports/loans/new を開いている
    And レポート種別の初期選択が「期間別貸出統計」・集計期間区分の初期選択が「月次」である
    When 司書が条件を変更せず「集計を実行」を押す
    Then レポート種別「期間別貸出統計」・集計期間区分「月次」で集計要求が送信され、ボタンが aria-busy="true" になる

  Scenario: 集計期間の前後が逆のとき送信をブロックする
    Given 司書が集計期間の開始日に「2026-08-31」、終了日に「2026-08-01」を入力している
    When 司書が「集計を実行」を押す
    Then 「集計終了日は集計開始日以降の日付を指定してください」が role="alert" で表示され、API は呼ばれない

  Scenario: 直近が実績なしのとき再集計を促す
    Given 直近の貸出統計レポートの統計レポート状態が「実績なし」である
    When 司書が集計期間指定画面を開く
    Then Alert(info) に「集計期間を変更して再集計してください」が表示される

  Scenario: 集計要求後に集計中を表示する
    Given 司書が集計期間指定画面で集計を実行した
    When API が HTTP 202 と report_status「集計中」を返す
    Then 貸出統計レポート画面へ遷移し、ReportStatusBadge が「集計中」を Skeleton とともに表示する
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | LoanStatsNoResultNotice（集計結果の取得） の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `FilterPanel` | `@/components/common/FilterPanel` | LoanStatsPeriodForm（`ReportPeriodSelector`） の内側で使う（置き換えない） |
| `EntityFormSection` | `@/components/common/EntityFormSection` | LoanStatsPeriodForm の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | LoanStatsPeriodForm の集計実行ボタン（`onSubmit`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← LoanStatsNoResultNotice（集計結果の取得） の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `FilterPanel` | `fields` ← レポート種別（single）/ 集計期間区分（single） / `onChange` `onSubmit` `onReset` ← LoanStatsPeriodForm（`ReportPeriodSelector`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |
| `EntityFormSection` | `mode` ← `"action"` / `fields` ← レポート種別 / 集計期間区分（single）、集計期間（text, type=date） / `value` `onChange` ← LoanStatsPeriodForm の同名 props / `current` ← — / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
