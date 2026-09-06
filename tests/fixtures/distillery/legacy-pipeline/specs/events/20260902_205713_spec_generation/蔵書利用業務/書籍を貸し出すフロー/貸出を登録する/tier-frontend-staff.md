# 貸出を登録する - 司書ポータル仕様

## 変更概要

窓口貸出受付画面（`/staff/loans/new`）を追加する。貸出可否判定画面から引き継いだ書籍ID・利用者番号を初期表示し、貸出期間区分を ToggleGroup で選択させる。選択した区分から算出される返却期限を登録前に DueDateIndicator で確認させ、冪等キー付きで貸出を登録する。登録後は貸出一覧・蔵書一覧のキャッシュを無効化する。

## 画面仕様

### 窓口貸出受付画面

- **ルート id**: `staff-loan-new`
- **URL**: `/staff/loans/new`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（司書ロールのトークンを持つ場合のみ表示。館内ネットワークからのアクセスに限定する）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | PortalShell（variant: staff） | 司書ポータル共通レイアウト |
| 書籍ID入力 | フォーム | Input（variant: default / error） | 判定画面から引き継いだ書籍IDを初期表示 |
| 利用者番号入力 | フォーム | Input（variant: default / error） | 判定画面から引き継いだ利用者番号を初期表示 |
| 貸出期間区分の選択 | フォーム | ToggleGroup（variant: single, size: md） | 標準 / 短期 / 長期。利用者区分の既定区分を初期選択し、選択可能集合に含まれない区分（一般利用者の「長期」）は disabled |
| 対象書籍の提示 | カード | BookCard（variant: default） | タイトル・著者・ジャンル・資料種別・書籍状態を表示 |
| 対象利用者の提示 | カード | UserProfileCard（variant: default） | 氏名・利用者区分・利用者状態。連絡先は既定でマスク |
| 返却期限の事前確認 | 期限表示 | DueDateIndicator（variant: safe） | 選択中の貸出期間区分から算出した返却期限（`YYYY年M月D日`）と残日数（`あと{N}日`）を登録前に表示 |
| 貸出登録 | ボタン | SubmitActionButton（Button variant: default, size: md） | 主操作。送信中は `disabled` / `aria-busy` とし、待機表現は `LoadingState`（`kind="action"`）に委譲 |
| 対象の取得待ち | ローディング | LoadingState（`kind="detail"`） | 引き継ぎ状態が無く書籍・利用者を再取得する間の待機表現（`AsyncSection` 経由） |
| 登録結果 | 注意喚起 | Alert（variant: success / destructive） | 成功時は貸出IDと返却期限、失敗時は業務エラーの理由を表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | var(--color-white) |
| アクセント | var(--portal-primary) → var(--semantic-primary_staff) | var(--color-teal-700) |
| 返却期限（余裕あり） | var(--component-duedate-safe_color) / var(--component-duedate-safe_bg) | var(--success) / var(--success-light) |
| 返却期限（期限接近） | var(--component-duedate-near_color) / var(--component-duedate-near_bg) | var(--pending) / var(--pending-light) |
| 成功表示 | var(--semantic-success) | var(--color-green-600) |
| 失敗表示 | var(--semantic-destructive) | var(--color-red-600) |
| 入力欄 | var(--component-input-border) / var(--component-input-focus_ring) | var(--border-strong) / var(--ring) |
| 余白 | var(--spacing-page_padding) / var(--spacing-component_gap) | var(--spacing-6) / var(--spacing-3) |

#### UIロジック

- **状態管理**: 貸出可否判定画面から引き継いだ書籍ID・利用者番号・利用者区分を状態管理層から取得する（LP-030）。引き継ぎ状態が無い場合（直リンク・再読込）は `_api-summary.yaml` の `consumes:` に記録した `getBookAvailability` / `getLoanTarget` / `checkLoanEligibility` を呼んで再取得する。登録成功後は蔵書一覧（ルート id `staff-book-list`）・利用者名簿（`staff-user-list`）の関連キャッシュを無効化する。
- **バリデーション**: 書籍ID・利用者番号の必須と形式、貸出期間区分の選択必須を送信前にチェックする。貸出可否そのものはフロント側で独自判定せず、API の応答を表示する（LR-030）。
- **返却期限の事前表示**: 選択中の貸出期間区分に対応する日数を貸出日（本日）に加算した返却期限を DueDateIndicator で表示する。表示は `ui-design.md`「日付・期限の表示規約」に従い、日付を `YYYY年M月D日`、残日数を `あと{N}日` とする。この表示はあくまで確認用で、正となる返却期限は API のレスポンス（`due_date`、ISO 8601 `YYYY-MM-DD`）で置き換える。
- **ローディング**: loading 表現は `LoadingState` に一本化する（画面側で独自の loading UI を作らない）。登録中は `SubmitActionButton` が `disabled` / `aria-busy="true"` にしたうえで `LoadingState`（`kind="action"`）を出す（arch SR-002）。対象書籍・利用者の再取得中は `AsyncSection` 経由で `LoadingState`（`kind="detail"`、`label="貸出対象を読み込み中"`、`delayMs=300`）を出す。
- **二重送信防止**: 冪等キー（UUID）を画面で 1 回だけ生成し、`X-Idempotency-Key` ヘッダに付与する。再送時も同一キーを使う（LR-032 / arch CTP-006 の 4 層防御のフロントエンド分担）。同一キーでの再送に対する応答（保存済み結果のリプレイ / 409 `IDEMPOTENCY_KEY_IN_PROGRESS` / 409 `IDEMPOTENCY_KEY_CONFLICT`）は `_cross-cutting/api/openapi.yaml` の `IdempotencyKeyHeader` を正本とし、リプレイ時は登録成功と同じ画面表示にする。
- **認証情報の送信**: 司書の識別情報は `Authorization: Bearer {access_token}` のクレーム（`sub` / `role`）だけで送る。`X-User-No` 等の独自ヘッダを付けない。401（`UNAUTHENTICATED` / `TOKEN_EXPIRED` / `IDENTITY_CLAIM_MISSING`）は `useApiErrorPresenter` の「認可」分類として再ログイン導線を出す。
- **エラーハンドリング**: api client から伝播したエラーを状態管理層で分類（通信 / 認可 / 業務ルール違反 / 競合）し（LR-031）、view 層で司書向けメッセージへ変換する。409 は `code` で分岐し、貸出中・取置き中の競合は Alert(destructive) に理由を表示して貸出可否判定画面へ戻る導線を出す。`LOAN_PERIOD_TYPE_MISMATCH` は ToggleGroup 直下にインラインエラー「この利用者区分では選択できない貸出期間区分です」を表示し、既定区分へ戻すアクションを提示する（画面遷移しない）。
- **日付書式**: `ui-design.md`「日付・期限の表示規約」に従う（arch SR-004）。返却期限は `toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })` で `YYYY年M月D日` に整形し、残日数は `あと{N}日` と併記する。API との送受信は ISO 8601 `YYYY-MM-DD` のままとする。
- **画面遷移**: 遷移はすべて `useAppNavigation().navigate("<ルート id>")` で行い、URL 文字列を画面側に直書きしない。使用するルート id は `staff-loan-eligibility`（貸出可否判定画面へ戻る）と `staff-loan-new`（続けて貸し出す）。

#### 操作フロー

1. 貸出可否判定画面（`staff-loan-eligibility`）で「貸出可」の判定を受け、`useAppNavigation().navigate("staff-loan-new")` で窓口貸出受付画面へ前方遷移する。
2. 書籍ID・利用者番号が初期表示され、BookCard / UserProfileCard に対象が表示される。
3. 貸出期間区分の既定値（利用者区分に対応する区分）が選択された状態で、返却期限の見込みが DueDateIndicator に表示される。
4. 司書が必要に応じて貸出期間区分を選択可能な区分の範囲で変更する。返却期限の表示が即座に更新される。選択不可の区分は disabled のため押下できない。
5. 司書が「貸出を登録する」を押す。冪等キー付きで `POST /api/v1/loans` を呼び出す。
6. 成功時、ページが `LoanResponse` を `result` に保持し、`LoanConfirmation` へ確定値として渡す。Alert(success) に貸出IDと確定した返却期限（`YYYY年M月D日`）を表示し、次の行動導線（続けて貸し出す = `staff-loan-new`）を 1 つ提示する（ピーク・エンドの法則）。
7. 失敗時、Alert(destructive) に理由（貸出中 / 取置き中 / 未登録利用者）と再判定への導線（`staff-loan-eligibility`）を表示する。

## コンポーネント設計

受け渡しの所有権は `_cross-cutting/ux-ui/common-components.md`「6. コンポーネント間の受け渡し規約」に従う。
本 UC では次のとおり確定する。

| 役割 | コンポーネント | 保持する state | 受け渡し |
|------|--------------|---------------|---------|
| 実行結果の所有者 | `LoanRegistrationPage`（ページ） | `result: LoanResponse \| null` / `submitting: boolean` / `error` | `POST /api/v1/loans`（`createLoan`）を呼ぶ唯一の主体。子へ `submitting` / `result` / ハンドラを渡す |
| 入力・送信トリガ | `LoanRegistrationForm` | 入力値・項目別エラー・冪等キー | `onSubmit(input)` をページへ通知する。API を直接呼ばず、結果も保持しない |
| 完了表示 | `LoanConfirmation` | なし（表示専用） | `result: LoanResponse` を確定値として受け取る。`null` の間は描画しない |
| 期限表示 | `DueDatePreview` | なし（表示専用） | 登録前は見込み、登録後は `result.due_date` |

### LoanRegistrationPage

- **ベースコンポーネント**: `PortalPageLayout` + `AsyncSection` + `LoanRegistrationForm` + `LoanConfirmation`
- **State**:
  | State | 型 | 説明 |
  |-------|---|------|
  | result | `LoanResponse \| null` | 貸出登録の完了結果。`null` は「未実行」を表し、「結果 0 件」と区別する |
  | submitting | `boolean` | 送信中フラグ。`SubmitActionButton` 経由で `LoadingState`（`kind="action"`）に伝わる |
  | error | `ApiError \| null` | `useApiErrorPresenter` で 4 分類に正規化したエラー |
- **責務**: `createLoan` の呼び出し、冪等キーの保持（`useIdempotentMutation`）、キャッシュ無効化、次の行動導線の遷移（`useAppNavigation`）

### LoanConfirmation

- **ベースコンポーネント**: Alert（UI, `success`） + DueDatePreview
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | result | `LoanResponse \| null` | Yes | 貸出登録の確定結果。`null` の間は何も描画しない。型は `_api-summary.yaml` の `response_schema`（`LoanResponse`）と同一で、画面側で別名の再定義をしない |
  | onLoanSucceeded | `(result: LoanResponse) => void` | Yes | 次の行動導線（続けて貸し出す / 貸出一覧を見る）を親へ通知する。汎用名 `onLoan` / `onDone` は使わない |
- **状態**: なし（表示専用。結果を自前の state に写さない）
- **イベント**: `onLoanSucceeded`（利用者操作による次の行動の要求。遷移の実行主体はページ側）
- **表示**: `result.loan_id` と `result.due_date`（`YYYY年M月D日` へ整形）、残日数（`あと{N}日`）

### LoanRegistrationForm

- **ベースコンポーネント**: Input（UI） + ToggleGroup（UI） + Button（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialBookId | string | No | 書籍IDの初期値（判定画面からの引き継ぎ） |
  | initialUserNo | string | No | 利用者番号の初期値（判定画面からの引き継ぎ） |
  | userCategory | string | No | 利用者区分。貸出期間区分の既定選択の決定に使う |
  | loanPeriodOptions | Array<{ value: string; label: string; days: number }> | Yes | 貸出期間区分（標準 / 短期 / 長期）とその日数 |
  | submitting | boolean | Yes | true のとき `SubmitActionButton` を disabled / aria-busy にし、`LoadingState`（`kind="action"`）を出す |
  | onSubmit | (input: { bookId: string; userNo: string; loanPeriodType: string; idempotencyKey: string }) => void | Yes | 貸出登録をページへ要求する。本コンポーネントは API を直接呼ばない |
- **状態**: `bookId` / `userNo` / `loanPeriodType`（入力値）、`idempotencyKey`（画面初期化時に 1 回だけ生成）、`fieldErrors`
- **保持しない状態**: 貸出登録の結果（`LoanResponse`）。結果の所有者は `LoanRegistrationPage` である
- **イベント**: `onChange`（入力・区分の変更）、`onSubmit`（貸出登録の要求）

### DueDatePreview

- **ベースコンポーネント**: DueDateIndicator（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | dueDate | string(date) | Yes | 選択中の貸出期間区分から算出した返却期限（登録前は見込み、登録後は API の `due_date`） |
  | today | string(date) | Yes | 本日日付。残日数の算出に使う |
  | state | "safe" \| "near" \| "due-today" \| "overdue" | Yes | 残日数から決まる表示段階。新規貸出は通常 "safe" |
  | size | "sm" \| "md" | No | 表示サイズ |
- **状態**: なし（表示専用）
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 貸出を登録する - 司書ポータル

  Scenario: 判定画面からの引き継ぎ値が初期表示される
    Given 司書「山田花子」が貸出可否判定画面で書籍ID "B-000001" と利用者番号 "U-000123"（利用者区分 "一般"）の「貸出可」判定を受けている
    When 司書が窓口貸出受付画面（/staff/loans/new）へ進む
    Then 書籍ID "B-000001" と利用者番号 "U-000123" が入力欄に初期表示される
    And 貸出期間区分の ToggleGroup で「標準」が初期選択される

  Scenario: 貸出期間区分の変更で返却期限の表示が更新される
    Given 司書「山田花子」が窓口貸出受付画面を開いており、本日が 2026-09-02 である
    When 司書が貸出期間区分を「短期」（7 日）に変更する
    Then DueDateIndicator の返却期限が「2026年9月9日」と表示される
    And 残日数が「あと7日」と文言で表示される

  Scenario: 選択できない貸出期間区分は押下できない
    Given 司書「山田花子」が利用者区分 "一般" の利用者について窓口貸出受付画面を開いている
    When 司書が貸出期間区分の ToggleGroup を確認する
    Then 「長期」は disabled で aria-disabled が true である
    And 「標準」「短期」は選択できる

  Scenario: 登録中は二重送信を防止する
    Given 司書「山田花子」が書籍ID "B-000001"、利用者番号 "U-000123"、貸出期間区分「標準」を指定している
    When 司書が「貸出を登録する」を連続で 2 回押す
    Then SubmitActionButton は disabled で aria-busy が true になり、LoadingState（kind="action"）が表示される
    And API リクエストは同一の X-Idempotency-Key で 1 回だけ送信される

  Scenario: 対象の再取得中は LoadingState が表示される
    Given 司書「山田花子」が引き継ぎ状態を持たずに窓口貸出受付画面（ルート id staff-loan-new）を直接開く
    When 対象書籍と対象利用者の取得が完了していない
    Then LoadingState（kind="detail"、label "貸出対象を読み込み中"）が表示され aria-busy が true になる
    And 画面独自のスピナー・Skeleton は表示されない

  Scenario: 登録成功時に貸出IDと返却期限が表示される
    Given 司書「山田花子」が窓口貸出受付画面で貸出情報を入力している
    And API が貸出ID "L-000001"、返却期限 "2026-09-16" を返す
    When 司書が「貸出を登録する」を押す
    Then LoanRegistrationPage の result に LoanResponse が保持され、LoanConfirmation へ確定値として渡される
    And Alert(success) に貸出ID "L-000001" と返却期限「2026年9月16日（あと14日）」が表示される
    And 次の行動導線（続けて貸し出す）が 1 つ表示され、押下で useAppNavigation().navigate("staff-loan-new") が呼ばれる

  Scenario: 貸出中の書籍への登録失敗時に理由と再判定導線を表示する
    Given 司書「山田花子」が書籍ID "B-000003"、利用者番号 "U-000123" を指定している
    And API が HTTP 409（code "BOOK_NOT_AVAILABLE"）を返す
    When 司書が「貸出を登録する」を押す
    Then Alert(destructive) に「この書籍は貸出中のため貸し出せません」が表示される
    And 貸出可否判定画面へ戻る導線が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ルート id `staff-loan-new` からポータル・画面名・アクティブナビを解決し、404 とポータル外アクセスを判定する |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | loading 表現の唯一の入口。対象取得中は `kind="detail"`、登録送信中は `SubmitActionButton` 経由で `kind="action"` |
| `AsyncSection` | `@/components/common/AsyncSection` | LoanRegistrationForm の対象書籍・利用者の照会結果 の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `EntityFormSection` | `@/components/common/EntityFormSection` | LoanRegistrationForm の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | LoanRegistrationForm の登録ボタン（`onSubmit`） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | 利用者確認欄の連絡先（`UserProfileCard`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AppShell` | `routeId` ← `"staff-loan-new"` / `onNavigate` ← 実装リポのルーターの遷移関数（`router.push`） / `children` ← `LoanRegistrationPage` |
| `LoadingState` | `kind` ← `"detail"`（対象取得中） / `label` ← `"貸出対象を読み込み中"` / `delayMs` ← `300` |
| `AsyncSection` | `loading` ← LoanRegistrationForm の対象書籍・利用者の照会結果 の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"detail"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"貸出対象を読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `EntityFormSection` | `mode` ← `"action"` / `fields` ← 書籍ID / 利用者番号（text）、貸出期間（single） / `value` `onChange` ← LoanRegistrationForm の同名 props / `current` ← — / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← true / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API。`staff-loan-eligibility`（再判定へ戻る） / `staff-loan-new`（続けて貸し出す）をルート id で呼ぶ |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `AppShell` の `onNavigate` にルーターの遷移関数を注入するだけにする（URL 文字列を画面側へ直書きしない）
