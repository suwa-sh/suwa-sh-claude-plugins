# 返却を登録する - 司書ポータル仕様

## 変更概要

窓口返却受付画面（`/staff/returns/new`）を追加する。書籍IDまたは利用者番号から返却対象の貸出を特定し、対象を確認したうえで冪等キー付きで返却を登録する。延滞返却は責めずに事実（超過日数）だけを示す。登録後は返却後在庫整理画面への導線を提示し、貸出一覧・蔵書一覧のキャッシュを無効化する。

## 画面仕様

### 窓口返却受付画面

- **ルート id**: `staff-return-new`
- **URL**: `/staff/returns/new`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（司書ロールのトークンを持つ場合のみ表示。館内ネットワークからのアクセスに限定する）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | PortalShell（variant: staff） | 司書ポータル共通レイアウト |
| 書籍ID / 利用者番号の入力 | フォーム | Input（variant: default / with-icon / error） | 返却対象の貸出を特定するための入力 |
| 返却対象の貸出一覧 | テーブル | LoanTable（states: default / empty / error） | 特定した貸出を表示。`showUser` は true（司書向けに利用者列を出す）。取得待ちは `LoadingState`（`kind="list"`）に委譲する |
| 読み込み中 | ローディング | `LoadingState`（`kind="list"` / `kind="action"`） | loading 表現の唯一の入口。返却対象一覧の取得待ちは `kind="list"`（`label`「返却対象の貸出を読み込み中」）、返却登録の送信中は `SubmitActionButton` が内包する `kind="action"`（`label`「返却を登録中」） |
| 貸出状態バッジ | バッジ | LoanStatusBadge | 貸出中 / 延滞を dot + 文言で表示 |
| 返却期限と超過日数 | 期限表示 | DueDateIndicator（variant: safe / near / due-today / overdue, size: sm） | 返却期限は一覧の列で `YYYY/MM/DD`、サマリでは `YYYY年M月D日` で表示し、残日数は `あと{N}日`、期限当日は `本日が返却期限`、超過は `{N}日超過` の文言で示す（`ui-design.md`「日付・期限の表示規約」） |
| 返却登録 | ボタン | Button（variant: default, size: md） | 主操作。送信中は `loading` かつ `disabled` / `aria-busy` |
| 延滞の注意喚起 | 注意喚起 | Alert（variant: warning） | 延滞返却時に超過日数を事実として提示する（責める文言は使わない） |
| 登録結果 | 注意喚起 | Alert（variant: success / destructive） | 成功時は返却完了サマリ、失敗時は理由を表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | var(--color-white) |
| アクセント | var(--portal-primary) → var(--semantic-primary_staff) | var(--color-teal-700) |
| 貸出状態（貸出中 / 延滞 / 返却済み） | var(--semantic-info) / var(--semantic-destructive) / var(--semantic-neutral) | var(--color-blue-600) / var(--color-red-600) / var(--color-gray-500) |
| 返却期限（超過） | var(--component-duedate-over_color) / var(--component-duedate-over_bg) | var(--destructive) / var(--destructive-light) |
| 警告 | var(--semantic-warning) | var(--color-amber-600) |
| テーブルヘッダ | var(--component-table-header_bg) | var(--color-gray-50) |
| 余白 | var(--spacing-page_padding) / var(--spacing-component_gap) | var(--spacing-6) / var(--spacing-3) |

#### UIロジック

- **状態管理**: 特定した返却対象（貸出ID・書籍ID）と返却結果（`ReturnResponse`）をページコンポーネント（状態管理層）に保持し、`useAppNavigation().navigate("staff-return-restock")`（表示上は `/staff/returns/:loanId/restock`）で返却後在庫整理画面へ引き継ぐ（LP-030）。登録成功後は貸出一覧・蔵書一覧・延滞状況一覧のキャッシュを無効化する。
- **バリデーション**: 書籍IDまたは利用者番号のいずれかが入力されていることを送信前にチェックする。返却可否（返却済みかどうか）はフロント側で独自判定せず、API の応答を表示する（LR-030）。
- **ローディング**: 対象特定中は `LoadingState`（`kind="list"` / `label`「返却対象の貸出を読み込み中」）を LoanTable の領域に表示し、返却登録中は `SubmitActionButton`（内包する `LoadingState`（`kind="action"` / `label`「返却を登録中」））で Button を `loading` かつ `disabled` / `aria-busy="true"` にする（arch SR-002）。画面側で `Skeleton` / `Spinner` を直接使わず、同一領域で併用しない。
- **二重送信防止**: 冪等キー（UUID）を返却対象の確定時に 1 回だけ生成し、`X-Idempotency-Key` ヘッダに付与する。再送時も同一キーを使う（LR-032）。
- **エラーハンドリング**: api client から伝播したエラーを状態管理層で分類（通信 / 認可 / 業務ルール違反 / 競合）し（LR-031）、view 層で司書向けメッセージへ変換する。409（既に返却済み）は Alert(destructive) に表示し、対象の再特定を促す。
- **延滞返却の表現**: 超過日数を Alert(warning) と DueDateIndicator(overdue) で事実として示す。督促の停止は結果サマリに事実として記載する。
- **日付書式**: API 上の返却期限・返却日は ISO 8601 `YYYY-MM-DD`（`format: date`）で送受信し、画面表示は一覧の列が `YYYY/MM/DD`、サマリ・詳細が `YYYY年M月D日`（`toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })`）とする（arch SR-004 / `ui-design.md`「日付・期限の表示規約」）。超過は `{N}日超過`、残日数は `あと{N}日`、期限当日は `本日が返却期限` に統一する。

#### 操作フロー

1. 司書がサイドバーの「蔵書利用業務」→「窓口返却受付」を選択し、`useAppNavigation().navigate("staff-return-new")` で本画面を開く。
2. 司書が返却された書籍の書籍ID（または利用者番号）を入力する。
3. 取得中は `LoadingState`（`kind="list"`）を表示し、該当する貸出中・延滞の貸出が LoanTable に表示される。0 件のときは EmptyState を表示する。
4. 司書が返却対象の貸出を選択する。延滞の場合は Alert(warning) に超過日数が表示される。
5. 司書が「返却を登録する」を押す。冪等キー付きで `POST /api/v1/loans/{loanId}/return` を呼び出す。
6. 成功時、Alert(success) に返却完了サマリ（返却日 `YYYY年M月D日`・超過は `{N}日超過`・貸出状態「返却済み」）を表示し、`useAppNavigation().navigate("staff-return-restock")` による返却後在庫整理画面への導線を 1 つ提示する（ピーク・エンドの法則）。
7. 失敗時、Alert(destructive) に理由（既に返却済み / 貸出が見つからない）と再特定への導線を表示する。

## コンポーネント設計

`_cross-cutting/ux-ui/common-components.md`「6. コンポーネント間の受け渡し規約」に従い、本 UC の受け渡し契約を次のとおりとする。

- 返却登録の実行結果を所有するのは窓口返却受付画面のページコンポーネントである（`result: ReturnResponse | null` / `submitting: boolean` / `error`）。子コンポーネントは結果を state に持たない
- 完了結果の型は API のレスポンススキーマ名 `ReturnResponse`（`_api-summary.yaml` の `response_schema`）をそのまま使う。画面側で別名の再定義をしない
- 子コンポーネントのイベント名は `on{ドメイン動詞}{結果}` に揃える（本 UC は `onReturnSucceeded`）。汎用名（`onDone` / `onComplete`）は使わない
- 子は API を直接呼ばない。送信の実行主体はページであり、ReturnTargetFinder / ReturnRegistrationPanel は入力値とユーザー操作だけを扱う
- 結果表示（返却完了サマリ）は state を持たず、確定値を Props で受け取る。`result` が `null` の間は描画しない

### ReturnTargetFinder

- **ベースコンポーネント**: Input（UI） + LoanTable（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | Array<{ loanId: string; book: { title: string }; user: { userNo: string }; dueDate: string; daysRemaining: number; loanStatus: string }> | Yes | 特定された返却対象の貸出 |
  | loading | boolean | Yes | true のとき LoanTable の領域に `LoadingState`（`kind="list"`）を表示 |
  | error | string \| null | Yes | エラーメッセージ。非 null のとき error 状態を表示 |
  | showUser | boolean | Yes | 常に true（司書向けに利用者列を出す） |
  | onFind | (input: { bookId?: string; userNo?: string }) => void | Yes | 返却対象の検索を発火する |
  | onSelect | (loanId: string) => void | Yes | 返却対象の貸出を確定する |
- **状態**: `bookId` / `userNo`（入力値）、`selectedLoanId`
- **イベント**: `onFind`（検索）、`onSelect`（対象確定）

### ReturnRegistrationPanel

- **ベースコンポーネント**: Button（UI） + Alert（UI） + DueDateIndicator（Domain） + LoanStatusBadge（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loan | { loanId: string; dueDate: string; daysRemaining: number; loanStatus: string } | Yes | 確定した返却対象の貸出 |
  | submitting | boolean | Yes | ページが所有する送信中フラグ。true のとき `SubmitActionButton` を loading / disabled / aria-busy にする（`LoadingState`（`kind="action"`）） |
  | result | ReturnResponse \| null | Yes | 返却登録の確定結果（ページが所有）。非 null で Alert(success) を表示し、`null` の間は完了表示を描画しない |
  | error | { code: string; message: string } \| null | No | 業務エラー。非 null で Alert(destructive) を表示 |
  | onSubmit | (input: { loanId: string; idempotencyKey: string }) => void | Yes | 返却登録の実行をページへ通知する（API 呼び出しはページ側） |
  | onReturnSucceeded | (result: ReturnResponse) => void | Yes | 返却完了をページへ通知する（`on{ドメイン動詞}{結果}` 規約。`onDone` / `onComplete` は使わない） |
- **状態**: `idempotencyKey`（対象確定時に 1 回だけ生成）。返却結果（`ReturnResponse`）は保持しない
- **イベント**: `onSubmit`（返却登録）、`onReturnSucceeded`（返却完了の通知）、`onProceedToRestock`（`useAppNavigation().navigate("staff-return-restock")` による返却後在庫整理画面への遷移）

## ティア完了条件（BDD）

```gherkin
Feature: 返却を登録する - 司書ポータル

  Scenario: 書籍IDから返却対象の貸出が特定される
    Given 司書「山田花子」が窓口返却受付画面を開いている
    And API が書籍ID "B-000001" に対する貸出「L-000001」（利用者番号 "U-000123"、貸出状態 "貸出中"）を返す
    When 司書が書籍ID "B-000001" を入力して検索する
    Then LoanTable に貸出「L-000001」が利用者列つき（showUser = true）で表示される
    And LoanStatusBadge に「貸出中」が表示される

  Scenario: 延滞返却は超過日数を事実として提示する
    Given 司書「山田花子」が窓口返却受付画面を開いており、本日が 2026-09-02 である
    And 返却対象の貸出「L-000003」の返却期限が 2026-08-30、貸出状態が "延滞" である
    When 司書が貸出「L-000003」を返却対象として選択する
    Then Alert(warning) に「3日超過」が表示される
    And DueDateIndicator の variant が overdue になる

  Scenario: 登録中は二重送信を防止する
    Given 司書「山田花子」が貸出「L-000001」を返却対象として選択している
    When 司書が「返却を登録する」を連続で 2 回押す
    Then Button は loading かつ disabled で aria-busy が true になる
    And API リクエストは同一の X-Idempotency-Key で 1 回だけ送信される

  Scenario: 登録成功時に返却完了サマリと次の導線を表示する
    Given 司書「山田花子」が貸出「L-000001」を返却対象として選択している
    And API が loan_status "返却済み"、returned_at "2026-09-10"、overdue_days 0 を返す
    When 司書が「返却を登録する」を押す
    Then Alert(success) に「返却済み」と返却日「2026年9月10日」が表示される
    And ルート id "staff-return-restock"（表示上は /staff/returns/L-000001/restock）への導線が表示される

  Scenario: 既に返却済みの貸出はエラーを表示して再特定を促す
    Given 司書「山田花子」が貸出「L-000004」を返却対象として選択している
    And API が HTTP 409（code "LOAN_ALREADY_RETURNED"）を返す
    When 司書が「返却を登録する」を押す
    Then Alert(destructive) に「この貸出は既に返却済みです」が表示される
    And 返却対象の再特定へ戻る導線が表示される

  Scenario: 該当する貸出が無いとき EmptyState を表示する
    Given 司書「山田花子」が窓口返却受付画面を開いている
    And API が該当する貸出 0 件を返す
    When 司書が書籍ID "B-999999" を入力して検索する
    Then LoanTable が empty 状態になり EmptyState が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（返却後在庫整理画面へのルート id 指定遷移） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（返却対象一覧は `kind="list"`、返却登録の送信中は `SubmitActionButton` 経由で `kind="action"`） |
| `EntityFormSection` | `@/components/common/EntityFormSection` | ReturnTargetFinder / ReturnRegistrationPanel の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | ReturnRegistrationPanel の返却実行ボタン（`onSubmit`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `EntityFormSection` | `mode` ← `"action"` / `fields` ← 返却対象の特定キー（text） / `value` `onChange` ← ReturnTargetFinder / ReturnRegistrationPanel の同名 props / `current` ← — / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `LoadingState` | `kind` ← 返却対象一覧は `"list"` / 返却登録ボタンは `"action"`（`SubmitActionButton` が内包） / `label` ← `"返却対象の貸出を読み込み中"` / `"返却を登録中"` / `rows` ← 返却対象の表示予定件数 |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 本 UC は `AsyncSection` の対象外（新規入力が起点で取得待ちが無い / common-components.md）。取得を伴う領域がある場合は Domain テーブル自身の 4 状態（default / loading / empty / error）で満たす
- 本 UC の一覧はページ送りを伴わないため `DataListSection` を使わず、`AsyncSection` + Domain テーブルの直接組み合わせとする（common-components.md の参考）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
