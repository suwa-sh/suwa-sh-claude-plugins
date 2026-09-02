# 返却を登録する - 司書ポータル仕様

## 変更概要

窓口返却受付画面（`/staff/returns/new`）を追加する。書籍IDまたは利用者番号から返却対象の貸出を特定し、対象を確認したうえで冪等キー付きで返却を登録する。延滞返却は責めずに事実（超過日数）だけを示す。登録後は返却後在庫整理画面への導線を提示し、貸出一覧・蔵書一覧のキャッシュを無効化する。

## 画面仕様

### 窓口返却受付画面

- **URL**: `/staff/returns/new`
- **アクセス権**: 司書（司書ロールのトークンを持つ場合のみ表示。館内ネットワークからのアクセスに限定する）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | PortalShell（variant: staff） | 司書ポータル共通レイアウト |
| 書籍ID / 利用者番号の入力 | フォーム | Input（variant: default / with-icon / error） | 返却対象の貸出を特定するための入力 |
| 返却対象の貸出一覧 | テーブル | LoanTable（states: default / loading / empty / error） | 特定した貸出を表示。`showUser` は true（司書向けに利用者列を出す） |
| 貸出状態バッジ | バッジ | LoanStatusBadge | 貸出中 / 延滞を dot + 文言で表示 |
| 返却期限と超過日数 | 期限表示 | DueDateIndicator（variant: safe / near / due-today / overdue, size: sm） | 延滞は超過日数を数値と文言で示す |
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

- **状態管理**: 特定した返却対象（貸出ID・書籍ID）と返却結果を状態管理層に保持し、返却後在庫整理画面（`/staff/returns/:loanId/restock`）へ引き継ぐ（LP-030）。登録成功後は貸出一覧（`/staff/loans`）・蔵書一覧・延滞状況一覧のキャッシュを無効化する。
- **バリデーション**: 書籍IDまたは利用者番号のいずれかが入力されていることを送信前にチェックする。返却可否（返却済みかどうか）はフロント側で独自判定せず、API の応答を表示する（LR-030）。
- **ローディング**: 対象特定中は LoanTable の `loading` 状態、返却登録中は Button を `loading` かつ `disabled` / `aria-busy="true"` にする（arch SR-002）。
- **二重送信防止**: 冪等キー（UUID）を返却対象の確定時に 1 回だけ生成し、`X-Idempotency-Key` ヘッダに付与する。再送時も同一キーを使う（LR-032）。
- **エラーハンドリング**: api client から伝播したエラーを状態管理層で分類（通信 / 認可 / 業務ルール違反 / 競合）し（LR-031）、view 層で司書向けメッセージへ変換する。409（既に返却済み）は Alert(destructive) に表示し、対象の再特定を促す。
- **延滞返却の表現**: 超過日数を Alert(warning) と DueDateIndicator(overdue) で事実として示す。督促の停止は結果サマリに事実として記載する。
- **日付書式**: 返却期限・返却日は `toLocaleDateString('ja-JP')` で書式化する（arch SR-004）。

#### 操作フロー

1. 司書がサイドバーの「蔵書利用業務」→「窓口返却受付」を選択する。
2. 司書が返却された書籍の書籍ID（または利用者番号）を入力する。
3. 該当する貸出中・延滞の貸出が LoanTable に表示される。0 件のときは EmptyState を表示する。
4. 司書が返却対象の貸出を選択する。延滞の場合は Alert(warning) に超過日数が表示される。
5. 司書が「返却を登録する」を押す。冪等キー付きで `POST /api/v1/loans/{loanId}/return` を呼び出す。
6. 成功時、Alert(success) に返却完了サマリ（返却日・超過日数・貸出状態「返却済み」）を表示し、返却後在庫整理画面への導線を 1 つ提示する（ピーク・エンドの法則）。
7. 失敗時、Alert(destructive) に理由（既に返却済み / 貸出が見つからない）と再特定への導線を表示する。

## コンポーネント設計

### ReturnTargetFinder

- **ベースコンポーネント**: Input（UI） + LoanTable（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | Array<{ loanId: string; book: { title: string }; user: { userNo: string }; dueDate: string; daysRemaining: number; loanStatus: string }> | Yes | 特定された返却対象の貸出 |
  | loading | boolean | Yes | true のとき LoanTable の loading 状態を表示 |
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
  | submitting | boolean | Yes | true のとき Button を loading / disabled / aria-busy にする |
  | result | { loanStatus: string; returnedAt: string; overdueDays: number } \| null | No | 返却登録の結果。非 null で Alert(success) を表示 |
  | error | { code: string; message: string } \| null | No | 業務エラー。非 null で Alert(destructive) を表示 |
  | onSubmit | (input: { loanId: string; idempotencyKey: string }) => void | Yes | 返却登録を発火する |
- **状態**: `idempotencyKey`（対象確定時に 1 回だけ生成）
- **イベント**: `onSubmit`（返却登録）、`onProceedToRestock`（返却後在庫整理画面への遷移）

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
    Then Alert(warning) に「返却期限を 3 日超過しています」が表示される
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
    And 返却後在庫整理画面（/staff/returns/L-000001/restock）への導線が表示される

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
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `EntityFormSection` | `@/components/common/EntityFormSection` | ReturnTargetFinder / ReturnRegistrationPanel の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | ReturnRegistrationPanel の返却実行ボタン（`onSubmit`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `EntityFormSection` | `mode` ← `"action"` / `fields` ← 返却対象の特定キー（text） / `value` `onChange` ← ReturnTargetFinder / ReturnRegistrationPanel の同名 props / `current` ← — / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 本 UC は `AsyncSection` の対象外（新規入力が起点で取得待ちが無い / common-components.md）。取得を伴う領域がある場合は Domain テーブル自身の 4 状態（default / loading / empty / error）で満たす
- 本 UC の一覧はページ送りを伴わないため `DataListSection` を使わず、`AsyncSection` + Domain テーブルの直接組み合わせとする（common-components.md の参考）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
