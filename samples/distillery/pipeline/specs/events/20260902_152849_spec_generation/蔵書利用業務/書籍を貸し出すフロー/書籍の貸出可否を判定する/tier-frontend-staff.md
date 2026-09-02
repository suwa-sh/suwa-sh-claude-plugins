# 書籍の貸出可否を判定する - 司書ポータル仕様

## 変更概要

貸出可否判定画面（`/staff/loans/eligibility`）を追加する。書籍IDと利用者番号を指定して貸出可否を判定し、判定結果を「可否 + 根拠条件」の並置で表示する。不可の場合は根拠となった RDRA 条件名と充足していない項目をその場に展開する（反応型オンボーディング）。判定結果は状態管理層で保持し、窓口貸出受付画面へ引き継ぐ。

## 画面仕様

### 貸出可否判定画面

- **URL**: `/staff/loans/eligibility`
- **アクセス権**: 司書（司書ロールのトークンを持つ場合のみ表示。館内ネットワークからのアクセスに限定する）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | PortalShell（variant: staff） | 司書ポータル共通レイアウト。ポータル色は `primary_staff` |
| 書籍ID入力 | フォーム | Input（variant: default / error） | 判定対象の書籍IDを入力する |
| 利用者番号入力 | フォーム | Input（variant: default / error） | 貸出対象利用者の利用者番号を入力する（前画面から引き継いだ値を初期表示） |
| 判定実行 | ボタン | Button（variant: default, size: md） | 主操作。送信中は `loading` かつ `disabled` / `aria-busy` |
| 対象書籍の提示 | カード | BookCard（variant: default / on-loan / reserved） | タイトル・著者・ISBN・ジャンル・資料種別を表示 |
| 書籍状態バッジ | バッジ | BookStatusBadge | 在庫あり / 貸出中 / 予約待ちを dot + 文言で表示 |
| 対象利用者の提示 | カード | UserProfileCard（variant: default / in-transaction） | 氏名・利用者区分・利用者状態。連絡先は既定でマスク |
| 判定結果と根拠 | 注意喚起 | Alert（variant: success / destructive） | 可は success、不可は destructive。根拠条件名と不足項目を本文に展開 |
| 取得中表示 | ローディング | Skeleton（variant: line） | 判定要求中に BookCard / UserProfileCard 位置へ表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | var(--color-white) |
| アクセント | var(--portal-primary) → var(--semantic-primary_staff) | var(--color-teal-700) |
| 判定可 | var(--semantic-success) | var(--color-green-600) |
| 判定不可 | var(--semantic-destructive) | var(--color-red-600) |
| 書籍状態（在庫あり / 貸出中 / 予約待ち） | var(--semantic-success) / var(--semantic-info) / var(--semantic-warning) | var(--color-green-600) / var(--color-blue-600) / var(--color-amber-600) |
| 入力欄 | var(--component-input-border) / var(--component-input-focus_ring) | var(--border-strong) / var(--ring) |
| 余白 | var(--spacing-page_padding) / var(--spacing-section_gap) | var(--spacing-6) / var(--spacing-8) |

#### UIロジック

- **状態管理**: 判定対象（書籍ID・利用者番号）と判定結果を状態管理層に保持し、窓口貸出受付画面へ引き継ぐ（LP-030）。判定後に書籍・貸出の一覧キャッシュは無効化しない（参照のみのため）。
- **バリデーション**: 書籍ID・利用者番号の必須と形式（空白のみ不可）を送信前にチェックし、不備は Input(error) とフィールド直下のメッセージで示す。可否そのものはフロント側で独自判定しない（LR-030 に準じ、判定結果は API の応答を表示する）。
- **ローディング**: 判定要求中は Button を `loading` かつ `aria-busy="true"` にし、結果領域に Skeleton を表示する。
- **エラーハンドリング**: api client から伝播したエラーを状態管理層で分類（通信 / 認可 / 業務ルール違反 / 競合）し、view 層で司書向けメッセージへ変換する（LR-031 / CLP-014）。404（書籍・利用者が存在しない）は業務エラーとして Alert(destructive) に表示し、フォームへフォーカスを戻す。
- **判定不可時の展開**: 不可の場合、根拠となった RDRA 条件名（貸出可否条件 / 取置き中書籍貸出条件 / 資料種別利用可否条件）と充足していない項目を Alert 本文へ展開する。

#### 操作フロー

1. 司書がサイドバーの「蔵書利用業務」→「貸出可否判定」を選択する。
2. 前画面（利用者特定）から引き継いだ利用者番号がある場合は初期表示する。
3. 司書が書籍IDを入力し、「判定する」を押す。
4. api client が `POST /api/v1/loans/eligibility-checks` を呼び出す。
5. 判定結果を Alert（success / destructive）と BookCard / UserProfileCard で表示する。
6. 「貸出可」のとき、窓口貸出受付画面（`/staff/loans/new`）への前方遷移ボタンを表示する。書籍ID・利用者番号・利用者区分を状態管理層で引き継ぐ。
7. 「貸出不可」のとき、根拠条件と不足項目を展開し、次アクション（返却待ち・取置き対象者の確認）を案内する。

## コンポーネント設計

### LoanEligibilityForm

- **ベースコンポーネント**: Input（UI） + Button（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialBookId | string | No | 書籍IDの初期値 |
  | initialUserNo | string | No | 利用者番号の初期値（前画面からの引き継ぎ） |
  | submitting | boolean | Yes | true のとき Button を loading / disabled / aria-busy にする |
  | onSubmit | (input: { bookId: string; userNo: string }) => void | Yes | 判定要求を発火する |
- **状態**: `bookId` / `userNo`（入力値）、`fieldErrors`（必須・形式エラー）
- **イベント**: `onChange`（入力変更）、`onSubmit`（判定実行）

### LoanEligibilityResult

- **ベースコンポーネント**: Alert（UI） + BookCard（Domain） + UserProfileCard（Domain） + BookStatusBadge（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | eligible | boolean | Yes | 貸出可否。true で Alert(success)、false で Alert(destructive) |
  | reasons | Array<{ conditionName: string; detail: string }> | Yes | 根拠条件名と不足項目。可の場合も満たした条件名を並置する |
  | book | { bookId: string; title: string; author: string; isbn: string; genre: string; materialType: string; bookStatus: string } | Yes | 判定対象の書籍 |
  | user | { userNo: string; name: string; userCategory: string; userStatus: string } | Yes | 判定対象の利用者。連絡先は含まない |
  | onProceedToLoan | () => void | No | 「貸出可」のときに表示する窓口貸出受付画面への遷移ハンドラ |
- **状態**: なし（表示専用）
- **イベント**: `onProceedToLoan`（貸出登録へ前方遷移）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍の貸出可否を判定する - 司書ポータル

  Scenario: 貸出可の判定結果が根拠条件とともに表示される
    Given 司書「山田花子」が貸出可否判定画面を開いている
    And API が eligible = true、reasons に条件「貸出可否条件」を返す
    When 司書が書籍ID "B-000001" と利用者番号 "U-000123" を入力して「判定する」を押す
    Then Alert(success) に「貸出可」と条件「貸出可否条件」が並置表示される
    And 窓口貸出受付画面へ進むボタンが表示される

  Scenario: 貸出不可のとき根拠条件と不足項目が展開表示される
    Given 司書「山田花子」が貸出可否判定画面を開いている
    And API が eligible = false、reasons に条件「貸出可否条件」と不足項目「書籍状態が貸出中」を返す
    When 司書が書籍ID "B-000003" と利用者番号 "U-000123" を入力して「判定する」を押す
    Then Alert(destructive) に「貸出不可」と条件「貸出可否条件」と「書籍状態が貸出中」が表示される
    And 窓口貸出受付画面へ進むボタンは表示されない

  Scenario: 必須項目が未入力なら送信しない
    Given 司書「山田花子」が貸出可否判定画面を開いている
    When 司書が書籍IDを空のまま「判定する」を押す
    Then Input(error) と「書籍IDを入力してください」が表示される
    And API リクエストは送信されない

  Scenario: 判定中は二重送信を防止する
    Given 司書「山田花子」が書籍ID "B-000001" と利用者番号 "U-000123" を入力している
    When 司書が「判定する」を連続で 2 回押す
    Then Button は loading かつ disabled で aria-busy が true になる
    And API リクエストは 1 回だけ送信される

  Scenario: 判定結果が次画面へ引き継がれる
    Given 司書「山田花子」が書籍ID "B-000001" と利用者番号 "U-000123" で「貸出可」の判定を受けている
    When 司書が窓口貸出受付画面へ進むボタンを押す
    Then 窓口貸出受付画面に書籍ID "B-000001" と利用者番号 "U-000123" が引き継がれて初期表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | LoanEligibilityResult の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `EntityFormSection` | `@/components/common/EntityFormSection` | LoanEligibilityForm の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | LoanEligibilityResult の利用者連絡先（`UserProfileCard`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← LoanEligibilityResult の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `EntityFormSection` | `mode` ← `"action"` / `fields` ← 書籍ID / 利用者番号（text） / `value` `onChange` ← LoanEligibilityForm の同名 props / `current` ← — / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← true / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
