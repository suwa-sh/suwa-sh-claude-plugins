# 利用者の利用状況を参照する - 司書向けフロントエンド仕様

## 変更概要

司書ポータル（staff）に窓口利用状況照会画面を追加する。Input（with-icon）で利用者番号を入力し、LoanTable と ReservationTable を 1 画面に並べて貸出・予約の状況を即答できるようにする。連絡先は PiiMaskedText で既定マスクし、目のアイコンで明示開示する（NFR E.1.2.1 / E.6.1.1、LR-025）。照会結果から貸出受付 / 返却受付へ利用者番号を引き継ぐ（ux-design「司書（窓口）: 利用者の問い合わせに応じて書籍と利用状況を調べる」）。

## 画面仕様

### 窓口利用状況照会画面

- **URL**: `/staff/users/:userId/status`（`:userId` = 利用者番号。`/staff/users/status` で入力待ちの初期表示。クエリ: `loanScope`）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff / staff-collapsed） | サイドバー「窓口 > 窓口利用状況照会」をアクティブ表示 |
| 利用者番号入力 | フォーム | Input（with-icon） + Button（default） | 利用者番号の単一条件。Enter で照会 |
| 利用者要約 | カード | Card（default） + PiiMaskedText（email / phone / address） | 利用者番号 / 氏名 / 連絡先（既定マスク、目のアイコンで開示） |
| 集計 | カード | StatCard | 貸出中 / 延滞 / 予約中の件数（3 枚） |
| 貸出の表示範囲 | トグル | ToggleGroup（single, sm） | 「現在の貸出」（既定）/「履歴」 |
| 貸出一覧 | テーブル | LoanTable（current / history, showUser = false） | 書籍 / 貸出日 / 返却期限（DueDateIndicator）/ 状態（LoanStatusBadge）/ 返却日 |
| 予約一覧 | テーブル | ReservationTable（showUser = false） | 書籍 / 受付日時 / 順位（N 人中 M 番目）/ 状態（ReservationStatusBadge） |
| 予約の表示範囲 | トグル | ToggleGroup（single, sm） | 「有効な予約のみ」（既定）/「取消・終了も表示」。切替時は `GET /api/v1/users/{userNumber}/usage?includeClosedReservations=true` で再取得する |
| 窓口操作へ | ボタン | Button（secondary） | 貸出受付画面（`/staff/loans/new?userNumber=`）/ 返却受付画面（`/staff/returns/new`） |
| 読み込み中 | プレースホルダ | Skeleton（card + table） | 0.4 秒を超える取得で表示 |
| 利用者なし | 空状態 | EmptyState（default） | 「利用者番号 {番号} は登録されていません」（NotFound variant） |
| 貸出 / 予約なし | 空状態 | EmptyState（default） | 「貸出はありません」「予約はありません」 |
| 取得失敗 | 通知 | Alert（destructive） | 「利用状況を取得できませんでした」+ 再試行 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（staff primary） | var(--primary) | var(--color-slate-700)（#334155） |
| テーブルヘッダ背景 | var(--table-header-bg) | var(--background-subtle) |
| マスク表示 | pii.masked_color / pii.masked_bg | var(--foreground-muted) / var(--background-muted) |
| 返却期限 ok / soon / overdue | due_date.ok / due_date.soon / due_date.overdue | success / warning / destructive |
| 貸出中 / 延滞 / 返却済み | var(--info) / var(--destructive) / var(--neutral) | blue / red / gray 系 |
| 予約中 / 通知済み / 取消 | var(--warning) / var(--analysis) / var(--neutral) | amber / violet / gray 系 |
| StatCard 数値 | stat_card.value_size / label_color | var(--font-size-3xl) / var(--foreground-secondary) |

#### UIロジック

- **状態管理**: 画面内状態（2 層構成）: `UserUsagePageState = { userNumberInput, userNumber, loanScope, includeClosedReservations, usage(user, loans, reservations, summary, today, remindDays), revealed{email, phone, address}, loading, error, notFound }`。`userNumber` はルート、`loanScope` と `includeClosedReservations` はクエリと同期する。開示状態は画面内メモリのみで永続化しない（LR-025）
- **バリデーション**: 利用者番号は必須。空欄では照会ボタンを disabled。形式チェックは Backend API の 400 に従いフィールドエラーを表示する
- **ローディング**: 照会中は Input を disabled、0.4 秒を超えたら Skeleton（card + table）
- **エラーハンドリング**: 404 `USER_NOT_FOUND` → NotFound 表示「利用者番号 {番号} は登録されていません」（入力は保持）。401 → IdP 再認証。403 → Alert「司書のみ操作できます」。その他 → Alert（destructive）+ 再試行（LR-027）。コンソールログに氏名・連絡先を出力しない
- **連絡先の開示**: PiiMaskedText の目のアイコンで `GET /api/v1/users/{userNumber}/usage?reveal=true` を再取得し、該当項目のみ平文表示する。ページ遷移で開示状態を破棄する
- **表示**: 貸出は返却期限昇順（延滞が先頭）、予約は通知済みを先頭に受付日時降順。延滞が 1 件以上なら「返却受付へ」を主要操作にする
- **引き継ぎ**: 延滞・督促状況画面 / 書籍別予約状況画面から `userNumber` をルートで受け取り自動照会する。貸出受付画面へは `?userNumber=` で引き継ぐ

#### 操作フロー

1. 司書がサイドバー「窓口 > 窓口利用状況照会」を開く（または他画面から利用者番号つきで遷移し自動照会）
2. 利用者番号を入力し Enter → `GET /api/v1/users/{userNumber}/usage?loanScope=current`
3. 利用者要約（マスク済み連絡先）、StatCard（貸出中 / 延滞 / 予約中）、LoanTable、ReservationTable を描画する
4. 必要に応じて目のアイコンで連絡先を開示する（`reveal=true` で再取得）
5. 「履歴」で loanScope = history に切り替え、LoanTable（history）を再取得する
6. 「貸出受付へ」「返却受付へ」で窓口画面に遷移する（利用者番号を引き継ぐ）

## コンポーネント設計

### UserUsagePage

- **ベースコンポーネント**: PortalShell（staff） + Input + Card + PiiMaskedText + StatCard + ToggleGroup + LoanTable + ReservationTable
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialUserNumber | string | No | ルート `:userId` からの初期値（あれば自動照会） |
  | initialLoanScope | "current" \| "history" | No | クエリ `loanScope` からの初期値（既定 current） |
- **状態**: `userNumberInput`、`userNumber`、`loanScope`、`includeClosedReservations`、`usage`、`revealed`、`loading`、`error`、`notFound`
- **イベント**: `onLookup(userNumber)`、`onLoanScopeChange(scope)`、`onReveal(kind)`、`onGoLoan()`、`onGoReturn()`

### PiiMaskedText（UC 固有 Props）

- **ベースコンポーネント**: PiiMaskedText（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | string | Yes | マスク済み文字列（開示後は平文） |
  | kind | "email" \| "phone" \| "address" | Yes | 種別（アイコン・ラベル切替） |
  | revealable | true | Yes | 目のアイコンで開示可能 |
  | revealed | boolean | Yes | 開示状態 |
  | onReveal | () => void | Yes | 開示要求（reveal=true で再取得） |

### LoanTable / ReservationTable（UC 固有 Props）

- **ベースコンポーネント**: LoanTable / ReservationTable（design-event.yaml domain）
- **Props**: `loans` / `reservations`（UC「貸出履歴を参照する」「予約状況を参照する」と同じ項目型）、`today`、`remindDays`、`showUser = false`、`loading`。ReservationTable の `onCancel` は渡さない（司書は利用者ポータルの取消操作を持たない）

## ティア完了条件（BDD）

```gherkin
Feature: 利用者の利用状況を参照する - 司書向けフロントエンド

  Scenario: 利用者番号を照会して 2 テーブルを描画する
    Given 司書が /staff/users/status を開いている
    And GET /api/v1/users/U-000123/usage が {user: {name: "田中太郎", emailMasked: "ta***@example.com"}, loans: [{book: {title: "吾輩は猫である"}, dueDate: "2026-09-17", status: "ON_LOAN", remainingDays: 7, dueStatus: "OK"}], reservations: [{book: {title: "こころ"}, queuePosition: 3, totalWaiting: 3, status: "RESERVED"}], summary: {onLoanCount: 1, overdueCount: 0, activeReservationCount: 1}, today: "2026-09-10", remindDays: 3} を返す
    When 利用者番号「U-000123」を入力して Enter を押す
    Then 利用者要約に「田中太郎」と PiiMaskedText「ta***@example.com」が表示される
    And LoanTable に「吾輩は猫である / あと 7 日 / 貸出中」、ReservationTable に「こころ / 3 人中 3 番目 / 予約中」が表示される
    And StatCard に「貸出中 1 / 延滞 0 / 予約中 1」が表示される

  Scenario: 連絡先を明示操作で開示する
    Given 司書が利用者番号「U-000123」の照会結果を表示している
    When PiiMaskedText の「メールアドレスを表示」を押す
    Then GET /api/v1/users/U-000123/usage?reveal=true が呼ばれ「tanaka@example.com」が表示される
    And 画面遷移すると開示状態は破棄される

  Scenario: 未登録の利用者番号は NotFound を表示する
    Given GET /api/v1/users/U-999999/usage が HTTP 404 {code: "USER_NOT_FOUND"} を返す
    When 利用者番号「U-999999」を入力して照会する
    Then EmptyState に「利用者番号 U-999999 は登録されていません」が表示され入力値は保持される

  Scenario: 延滞があるとき返却受付への導線を主要操作にする
    Given GET /api/v1/users/U-000300/usage が {summary: {overdueCount: 1}, loans: [{status: "OVERDUE", dueStatus: "OVERDUE", remainingDays: -10}]} を返す
    When 司書が /staff/users/U-000300/status を開く
    Then StatCard「延滞 1」が強調され「返却受付へ」ボタンが主要操作として表示される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称: S-利用状況）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|---------------|-------------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'counter'、activeItem = 'userStatus' |
| PageHeader | `@/components/common/PageHeader` | title = 「窓口利用状況照会」、subtitle = userNumber、primaryAction = overdueCount >= 1 ? 「返却受付へ」 : 「貸出受付へ」、notices = ErrorAlert |
| KeywordSearchInput | `@/components/common/KeywordSearchInput` | value = userNumberInput、onChange = 入力更新、onSubmit = onLookup、placeholder = 「利用者番号で照会」、maxLength = 20、error = 400 フィールドエラー、disabled = loading、autoFocus = true |
| AsyncStateView | `@/components/common/AsyncStateView` | loading = loading、error = error（404 は emptyState に寄せる）、empty = notFound、skeleton = { variant:'card' }（Card + StatCard）+ { variant:'table' }（各 Table）、emptyState = { title: 「利用者番号 {userNumber} は登録されていません」 }、onRetry = onLookup、children = 利用者要約 + StatCardGroup + 2 テーブル |
| StatCardGroup | `@/components/common/StatCardGroup` | items = [{key:'onLoan', label:「貸出中」, value: summary.onLoanCount}, {key:'overdue', label:「延滞」, value: summary.overdueCount, tone:'destructive'}, {key:'reservation', label:「予約中」, value: summary.activeReservationCount}]、loading = loading |
| ScopeToggle（貸出） | `@/components/common/ScopeToggle` | options = [{value:'current', label:「現在の貸出」}, {value:'history', label:「履歴」}]、value = loanScope、onChange = onLoanScopeChange、size = 'sm'、ariaLabel = 「貸出の表示範囲」 |
| ScopeToggle（予約） | `@/components/common/ScopeToggle` | options = [{value:'false', label:「有効な予約のみ」}, {value:'true', label:「取消・終了も表示」}]、value = String(includeClosedReservations)、onChange = includeClosedReservations 更新 + 再取得、size = 'sm'、ariaLabel = 「予約の表示範囲」 |
| ErrorAlert | `@/components/common/ErrorAlert` | error = 正規化済み error（「利用状況を取得できませんでした」）、onRetry = onLookup、audience = 'staff'（403 → 「司書のみ操作できます」） |
| CounterHandoffActions | `@/components/common/CounterHandoffActions` | actions = ['loan', 'return']、userNumber = userNumber（onGoLoan → `/staff/loans/new?userNumber=`、onGoReturn → `/staff/returns/new`） |

各テーブルは PaginatedListFrame を使わない（1 画面 2 テーブル、ページングなし）。LoanTable / ReservationTable は AsyncStateView の content スロットに直接置く。

使用する共通 hooks:

- `useUrlQueryState`（`@/components/common/hooks/useUrlQueryState`）: loanScope / includeClosedReservations ⇄ URL クエリ（userNumber はルート）
- `usePiiReveal`（`@/components/common/hooks/usePiiReveal`）: revealed{email, phone, address}（kind 別）と `reveal=true` 再取得。画面遷移で破棄
- `useDelayedLoading`: AsyncStateView 内部（0.4 秒遅延 Skeleton）
