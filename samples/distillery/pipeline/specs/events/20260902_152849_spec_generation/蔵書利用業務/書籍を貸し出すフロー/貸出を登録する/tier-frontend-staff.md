# 貸出を登録する - 司書ポータル仕様

## 変更概要

窓口貸出受付画面（`/staff/loans/new`）を追加する。貸出可否判定画面から引き継いだ書籍ID・利用者番号を初期表示し、貸出期間区分を ToggleGroup で選択させる。選択した区分から算出される返却期限を登録前に DueDateIndicator で確認させ、冪等キー付きで貸出を登録する。登録後は貸出一覧・蔵書一覧のキャッシュを無効化する。

## 画面仕様

### 窓口貸出受付画面

- **URL**: `/staff/loans/new`
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
| 返却期限の事前確認 | 期限表示 | DueDateIndicator（variant: safe） | 選択中の貸出期間区分から算出した返却期限と残日数を登録前に表示 |
| 貸出登録 | ボタン | Button（variant: default, size: md） | 主操作。送信中は `loading` かつ `disabled` / `aria-busy` |
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

- **状態管理**: 貸出可否判定画面から引き継いだ書籍ID・利用者番号・利用者区分を状態管理層から取得する（LP-030）。登録成功後は貸出一覧（`/staff/loans`）・蔵書一覧・利用者名簿の関連キャッシュを無効化する。
- **バリデーション**: 書籍ID・利用者番号の必須と形式、貸出期間区分の選択必須を送信前にチェックする。貸出可否そのものはフロント側で独自判定せず、API の応答を表示する（LR-030）。
- **返却期限の事前表示**: 選択中の貸出期間区分に対応する日数を貸出日（本日）に加算した返却期限を DueDateIndicator で表示する。この表示はあくまで確認用で、正となる返却期限は API のレスポンス（`due_date`）で置き換える。
- **ローディング**: 登録中は Button を `loading` かつ `disabled` / `aria-busy="true"` にする（arch SR-002）。応答が 0.4 秒を超える場合は結果領域に Skeleton を表示する。
- **二重送信防止**: 冪等キー（UUID）を画面で 1 回だけ生成し、`X-Idempotency-Key` ヘッダに付与する。再送時も同一キーを使う（LR-032 / arch CTP-006 の 4 層防御のフロントエンド分担）。
- **エラーハンドリング**: api client から伝播したエラーを状態管理層で分類（通信 / 認可 / 業務ルール違反 / 競合）し（LR-031）、view 層で司書向けメッセージへ変換する。409 は `code` で分岐し、貸出中・取置き中の競合は Alert(destructive) に理由を表示して貸出可否判定画面へ戻る導線を出す。`LOAN_PERIOD_TYPE_MISMATCH` は ToggleGroup 直下にインラインエラー「この利用者区分では選択できない貸出期間区分です」を表示し、既定区分へ戻すアクションを提示する（画面遷移しない）。
- **日付書式**: 返却期限は `toLocaleDateString('ja-JP')` で書式化する（arch SR-004）。

#### 操作フロー

1. 貸出可否判定画面で「貸出可」の判定を受け、窓口貸出受付画面へ前方遷移する。
2. 書籍ID・利用者番号が初期表示され、BookCard / UserProfileCard に対象が表示される。
3. 貸出期間区分の既定値（利用者区分に対応する区分）が選択された状態で、返却期限の見込みが DueDateIndicator に表示される。
4. 司書が必要に応じて貸出期間区分を選択可能な区分の範囲で変更する。返却期限の表示が即座に更新される。選択不可の区分は disabled のため押下できない。
5. 司書が「貸出を登録する」を押す。冪等キー付きで `POST /api/v1/loans` を呼び出す。
6. 成功時、Alert(success) に貸出IDと確定した返却期限を表示し、次の行動導線（続けて貸し出す / 貸出一覧を見る）を 1 つ提示する（ピーク・エンドの法則）。
7. 失敗時、Alert(destructive) に理由（貸出中 / 取置き中 / 未登録利用者）と再判定への導線を表示する。

## コンポーネント設計

### LoanRegistrationForm

- **ベースコンポーネント**: Input（UI） + ToggleGroup（UI） + Button（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialBookId | string | No | 書籍IDの初期値（判定画面からの引き継ぎ） |
  | initialUserNo | string | No | 利用者番号の初期値（判定画面からの引き継ぎ） |
  | userCategory | string | No | 利用者区分。貸出期間区分の既定選択の決定に使う |
  | loanPeriodOptions | Array<{ value: string; label: string; days: number }> | Yes | 貸出期間区分（標準 / 短期 / 長期）とその日数 |
  | submitting | boolean | Yes | true のとき Button を loading / disabled / aria-busy にする |
  | onSubmit | (input: { bookId: string; userNo: string; loanPeriodType: string; idempotencyKey: string }) => void | Yes | 貸出登録を発火する |
- **状態**: `bookId` / `userNo` / `loanPeriodType`（入力値）、`idempotencyKey`（画面初期化時に 1 回だけ生成）、`fieldErrors`
- **イベント**: `onChange`（入力・区分の変更）、`onSubmit`（貸出登録）

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
    Then DueDateIndicator の返却期限が 2026-09-09 に更新される
    And 残日数が「あと 7 日」と文言で表示される

  Scenario: 選択できない貸出期間区分は押下できない
    Given 司書「山田花子」が利用者区分 "一般" の利用者について窓口貸出受付画面を開いている
    When 司書が貸出期間区分の ToggleGroup を確認する
    Then 「長期」は disabled で aria-disabled が true である
    And 「標準」「短期」は選択できる

  Scenario: 登録中は二重送信を防止する
    Given 司書「山田花子」が書籍ID "B-000001"、利用者番号 "U-000123"、貸出期間区分「標準」を指定している
    When 司書が「貸出を登録する」を連続で 2 回押す
    Then Button は loading かつ disabled で aria-busy が true になる
    And API リクエストは同一の X-Idempotency-Key で 1 回だけ送信される

  Scenario: 登録成功時に貸出IDと返却期限が表示される
    Given 司書「山田花子」が窓口貸出受付画面で貸出情報を入力している
    And API が貸出ID "L-000001"、返却期限 "2026-09-16" を返す
    When 司書が「貸出を登録する」を押す
    Then Alert(success) に貸出ID "L-000001" と返却期限「2026年9月16日」が表示される
    And 次の行動導線（続けて貸し出す）が 1 つ表示される

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
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | LoanRegistrationForm の対象書籍・利用者の照会結果 の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `EntityFormSection` | `@/components/common/EntityFormSection` | LoanRegistrationForm の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | LoanRegistrationForm の登録ボタン（`onSubmit`） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | 利用者確認欄の連絡先（`UserProfileCard`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← LoanRegistrationForm の対象書籍・利用者の照会結果 の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `EntityFormSection` | `mode` ← `"action"` / `fields` ← 書籍ID / 利用者番号（text）、貸出期間（single） / `value` `onChange` ← LoanRegistrationForm の同名 props / `current` ← — / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← true / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
