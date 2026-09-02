# 在庫状況を区分別に集計する - 司書ポータル仕様

## 変更概要

在庫状況集計条件指定画面（`/staff/reports/inventory/new`）を追加し、レポート種別と集計期間区分・集計期間を指定して集計要求を送信できるようにする。送信後は在庫状況レポート画面へ前方遷移し、統計レポート状態「集計中」を表示する。

## 画面仕様

### 在庫状況集計条件指定画面

- **ルート id**: `staff-report-inventory-new`
- **URL**: `/staff/reports/inventory/new`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（司書ロールのトークンを持つ場合のみ。arch SR-005）
- **ポータル**: staff（司書ポータル / `primary_staff`）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠・サイドバー | レイアウト | `PortalShell`（`staff`） | ナビ末尾「レポート」配下に配置する |
| レポート種別の選択 | トグル | `ReportPeriodSelector`（内部で `ToggleGroup(single)`） | 値はバリエーション「レポート種別」の 3 値。本画面では「在庫状況」を初期選択かつ既定とする |
| 集計期間区分の選択 | トグル | `ReportPeriodSelector` | 値はバリエーション「集計期間区分」（日次／月次／年次）。既定は「月次」 |
| 集計期間（開始日／終了日） | 入力 | `ReportPeriodSelector`（内部で `Input`） | 集計期間区分に応じた既定期間を初期表示する。入力値・API 送信値は ISO 8601 `YYYY-MM-DD`、確認用の表示テキストは `YYYY年M月D日`（`ui-design.md`「日付・期限の表示規約」） |
| 直近の集計状態 | バッジ | `ReportStatusBadge` | 直近レポートの統計レポート状態（集計中／作成済み／実績なし）を示す |
| 集計を実行 | ボタン | `Button(default)` | 送信中は `SubmitActionButton` 内の `LoadingState`（`kind="action"`, `label="在庫状況の集計を要求中"`）で待機表現を出し、`disabled` + `aria-busy="true"` にする（arch SR-002） |
| 読み込み中 | ローディング | `LoadingState`（`kind="line"`, `label="直近の集計状態を読み込み中"`） | 「直近の集計状態」バッジの取得中に表示する。画面側で `Skeleton` / `Spinner` を直接使わない |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-teal-700)` |
| カード | `var(--component-card-bg)` / `var(--component-card-radius)` | `var(--color-white)` / `var(--radius-xl)` |
| ボタン | `var(--component-button-height-md)` / `var(--component-button-radius)` | `2.25rem` / `var(--radius-lg)` |
| セクション余白 | `var(--semantic-section-gap)` | `var(--spacing-8)` |
| 集計中バッジ色 | `var(--semantic-analysis)` | `var(--color-violet-600)` |

#### UIロジック

- **状態管理**: ステート層（`L-frontend-staff-state`）で `InventoryReportRequestState { reportType, periodType, periodStart, periodEnd, submitting }` を保持する。既定値は `reportType='在庫状況'`, `periodType='月次'`（ux-design のデフォルト効果）
- **バリデーション**: `periodStart <= periodEnd` を送信前に検査する。レポート種別・集計期間区分は `ToggleGroup` で RDRA バリエーション値に束縛し、自由入力を許さない。業務判定（在庫状況集計条件）はバックエンドに委ねる
- **ローディング**: 送信中の待機表現は `SubmitActionButton` に内包された `LoadingState`（`kind="action"` / `label="在庫状況の集計を要求中"`）に一本化する。「直近の集計状態」の取得中は `AsyncSection` 経由の `LoadingState`（`kind="line"` / `label="直近の集計状態を読み込み中"`）を表示する。送信後の遷移先では `ReportStatusBadge`「集計中」と `LoadingState`（`kind="list"`）を表示する。応答が 0.4 秒を超える可能性があるため待機表現を必ず出し、画面側で `Skeleton` / `Spinner` / `animate-pulse` を直接使わない
- **エラーハンドリング**: HTTP 400 は `Alert(destructive)` を `role="alert"` でフォーム上部に表示する。HTTP 403 は「この操作には司書の権限が必要です」を表示し、集計要求を再送しない。ネットワークエラーは再試行導線を出す
- **冪等性**: 集計要求ごとに UUID の冪等キーを生成し `X-Idempotency-Key` ヘッダへ付与する（arch SR-002）

#### 操作フロー

1. 司書がサイドバー「レポート」→「在庫状況レポート」→「条件を変更する」から `useAppNavigation().navigate("staff-report-inventory-new")` で本画面（`/staff/reports/inventory/new`）を開く
2. レポート種別「在庫状況」・集計期間区分（既定「月次」）・集計期間を確認する
3. 「集計を実行」を押す。ボタンは `loading` かつ `aria-busy="true"` になる
4. HTTP 202 を受け取り、ページコンポーネントが `result`（`ReportAcceptedResponse`）を確定させ、`report_id` を保持して `useAppNavigation().navigate("staff-report-inventory")` で在庫状況レポート画面（`/staff/reports/inventory`）へ前方遷移する
5. 遷移先で統計レポート状態「集計中」を表示し、完了を `aria-live="polite"` で通知する

## コンポーネント設計

### 受け渡し契約（`common-components.md`「6. コンポーネント間の受け渡し規約」）

- **実行結果の所有者は在庫状況集計条件指定ページ（ページコンポーネント）**とする。ページが `result: ReportAcceptedResponse | null` と `submitting: boolean` を保持し、`POST /api/v1/reports/inventory` の実行主体になる。子コンポーネントは API を直接呼ばない
- **完了結果の型は API のレスポンススキーマ名 `ReportAcceptedResponse`（`_api-summary.yaml` の `response_schema`）をそのまま使う**。画面側で別名を再定義しない
- **子から親へのイベント名は `on{ドメイン動詞}{結果}`** に揃える（本 UC は `onReportAggregationSucceeded`）。`onDone` / `onComplete` のような汎用名は使わない
- **結果表示コンポーネントは state を持たない**。確定値を Props で受け取り、`result` が `null` の間は描画しない

### InventoryReportConditionForm

- **ベースコンポーネント**: `ReportPeriodSelector`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | `{ reportType: string; periodType: string; periodStart: string; periodEnd: string }` | Yes | 集計条件の現在値 |
  | onChange | `(value) => void` | Yes | 条件変更時に呼ばれる |
  | onSubmit | `() => void` | Yes | 集計実行時に呼ばれる |
  | submitting | boolean | Yes | 送信中フラグ（親が所有し、`SubmitActionButton` の `LoadingState(kind="action")` に伝播する） |
  | result | ReportAcceptedResponse \| null | Yes | 親が確定させた集計要求の受理結果。`null` の間は完了表示を描画しない |
  | onReportAggregationSucceeded | (accepted: ReportAcceptedResponse) => void | Yes | 受理後の次の行動導線（`useAppNavigation().navigate("staff-report-inventory")`）を親へ通知する |
- **状態**: `periodError`（期間の前後関係エラー）と冪等キーのみ。**送信中フラグ・集計要求の結果（`ReportAcceptedResponse`）は保持しない**
- **イベント**: `onChange`（トグル・日付入力）、`onSubmit`（入力値を親へ通知する。API 呼び出しは親が行う）、`onReportAggregationSucceeded`

### InventoryReportStatusIndicator

- **ベースコンポーネント**: `ReportStatusBadge`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | state | `'集計中' \| '作成済み' \| '実績なし'` | Yes | 統計レポート状態 |
  | dot | boolean | No | ドット表示の有無。文言は常に併記する |
- **状態**: なし（表示専用）
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 在庫状況を区分別に集計する - 司書ポータル

  Scenario: 既定値のまま集計を実行できる
    Given 司書「山田花子」が在庫状況集計条件指定画面 /staff/reports/inventory/new を開いている
    When 司書が条件を変更せず「集計を実行」を押す
    Then レポート種別「在庫状況」・集計期間区分「月次」で集計要求が送信され、ボタンが aria-busy="true" になる

  Scenario: 集計期間の前後が逆のとき送信をブロックする
    Given 司書が集計期間の開始日に「2026-08-31」、終了日に「2026-08-01」を入力している
    When 司書が「集計を実行」を押す
    Then 「集計終了日は集計開始日以降の日付を指定してください」が role="alert" で表示され、API は呼ばれない

  Scenario: 集計要求後に集計中を表示する
    Given 司書が在庫状況集計条件指定画面で集計を実行した
    When API が HTTP 202 と report_status「集計中」を返す
    Then 在庫状況レポート画面へ遷移し、ReportStatusBadge が「集計中」を LoadingState(kind="list") とともに表示する

  Scenario: 権限がない場合はエラーを表示する
    Given 利用者ロールのトークンで在庫状況集計条件指定画面に到達した
    When 司書向け API が HTTP 403 を返す
    Then 「この操作には司書の権限が必要です」が role="alert" で表示され、再送しない
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（`staff-report-inventory`） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（`kind="line"`）と集計実行ボタンの送信中（`kind="action"`）。それぞれ `AsyncSection` / `SubmitActionButton` 経由で間接利用する |
| `AsyncSection` | `@/components/common/AsyncSection` | InventoryReportStatusIndicator（集計状態の取得） の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `FilterPanel` | `@/components/common/FilterPanel` | InventoryReportConditionForm（`ReportPeriodSelector`） の内側で使う（置き換えない） |
| `EntityFormSection` | `@/components/common/EntityFormSection` | InventoryReportConditionForm の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | InventoryReportConditionForm の集計実行ボタン（`onSubmit`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"line"`（直近の集計状態の取得） / `"action"`（集計実行ボタン押下中） / `label` ← `"直近の集計状態を読み込み中"` / `"在庫状況の集計を要求中"` |
| `AsyncSection` | `loading` ← InventoryReportStatusIndicator（集計状態の取得） の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"直近の集計状態を読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `FilterPanel` | `fields` ← レポート種別（single）/ 集計期間区分（single） / `onChange` `onSubmit` `onReset` ← InventoryReportConditionForm（`ReportPeriodSelector`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |
| `EntityFormSection` | `mode` ← `"action"` / `fields` ← レポート種別 / 集計期間区分（single）、集計期間（text, type=date） / `value` `onChange` ← InventoryReportConditionForm の同名 props / `current` ← — / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけ
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
