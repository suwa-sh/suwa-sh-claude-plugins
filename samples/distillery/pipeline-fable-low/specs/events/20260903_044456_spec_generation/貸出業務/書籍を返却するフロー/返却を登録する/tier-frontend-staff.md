# 返却を登録する - 司書向けフロントエンド仕様

## 変更概要

司書ポータル（staff）に返却受付画面を追加する。ReturnRegisterPanel で書籍 ID の 1 入力から貸出を特定し、返却後の書籍状態（在庫あり / 予約待ち）と予約者の有無を確定前に提示して確定する。予約ありの場合のみ返却通知送信確認画面へ遷移する（ux-design「ページ間の遷移ルール」）。確定は冪等キー付きで二重送信を防ぐ（arch SP-006 / SR-005 / LP-034 / LP-035）。

## 画面仕様

### 返却受付画面

- **URL**: `/staff/returns/new`（`?bookId=` で窓口蔵書検索画面から書籍 ID を引き継げる）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff） | サイドバー「窓口 > 返却受付」をアクティブ表示 |
| 受付パネル | フォーム | ReturnRegisterPanel（input / found / found-with-reservation / done） | 書籍 ID の入力、照会結果、確定ボタン |
| 貸出の状態 | バッジ | LoanStatusBadge（dot） | 照会した貸出の状態（貸出中 / 延滞） |
| 返却後の書籍の状態 | バッジ | BookStatusBadge（dot） | 返却後に遷移する状態（在庫あり / 予約待ち）を確定前に表示 |
| 照会結果・処理結果 | 通知 | Alert（success / warning / destructive） | 「返却できます」「予約者がいます」「返却できません: {根拠}」「返却を登録しました」 |
| 照会 / 確定 / 返却通知へ / 続けて受付 | ボタン | Button（default / secondary） | 照会（Enter 同等）、返却を確定、返却通知を送信する（予約ありのとき）、続けて受付 |
| 読み込み中 | プレースホルダ | Skeleton（line）/ Spinner | 照会・確定の待ち時間（0.4 秒超で表示） |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（staff primary） | var(--primary) | var(--color-slate-700)（#334155、dark: var(--color-slate-400)） |
| 返却可 | var(--success) / var(--success-light) | var(--color-green-600) / var(--color-green-50) |
| 予約あり | var(--warning) / var(--warning-light) | var(--color-amber-600) / var(--color-amber-50) |
| 返却不可 | var(--destructive) / var(--destructive-light) | var(--color-red-600) / var(--color-red-50) |
| 状態バッジ 延滞 | var(--destructive) | red 系 |
| 状態バッジ 予約待ち | var(--pending) / var(--pending-light) | orange 系 |

#### UIロジック

- **状態管理**: 画面内状態（2 層構成、状態管理層なし）: `phase`（input / found / found-with-reservation / done）、`bookId`、`lookup`（照会結果: loan, book, user, nextBookStatus, reservationCount）、`result`（登録結果）、`submitting`、`error`、`idempotencyKey`（確定操作ごとに生成。再送時は同じ値）
- **バリデーション**: 書籍 ID は必須。空欄のまま照会・確定は不可（Button disabled）。形式チェックは Backend API の 400 に従いフィールドエラーを表示する（LP-029 相当: クライアント側は補助）
- **ローディング**: 照会中は入力欄を disabled、Button 内に Spinner。0.4 秒を超える場合は Skeleton（line）で結果領域を確保する
- **エラーハンドリング**: 409（`BOOK_NOT_ON_LOAN` / `LOAN_ALREADY_RETURNED` / `CONCURRENT_UPDATE`）と 404（`BOOK_NOT_FOUND` / `LOAN_NOT_FOUND`）は「返却できません: {根拠}」を Alert（destructive）で表示し input に戻す。401 は IdP ログインへ、403 は「司書のみ操作できます」。5xx / ネットワークエラーは「登録できませんでした。再試行してください」（同じ冪等キーで再送可）
- **二重送信防止**: 確定送信中は「返却を確定」を disabled + Spinner。確定成功後は履歴を replace して確認状態に戻れないようにする
- **個人情報**: 利用者名は表示するが連絡先は表示しない（LR-025）。画面遷移で照会結果を破棄する

#### 操作フロー

1. 司書がサイドバー「窓口 > 返却受付」から画面を開く（`bookId` クエリがあれば初期値に入れて自動照会）
2. 書籍 ID を入力し Enter（または「照会」）を押す → `GET /api/v1/returns/lookup?bookId=`
3. found: 貸出（利用者名・貸出日・返却期限・状態）と返却後の書籍状態「在庫あり」を表示。found-with-reservation: 「予約者が N 人います」と返却後の書籍状態「予約待ち」を表示
4. 「返却を確定」を押す → `POST /api/v1/loans/{loanId}/return`（Idempotency-Key 付き）
5. done: 「返却を登録しました」と返却後の書籍状態を表示。予約ありなら「返却通知を送信する」ボタン（`/staff/returns/{loanId}/notify` へ遷移）を主要操作として表示
6. 「続けて受付」で input に戻る（入力と照会結果をクリア）

## コンポーネント設計

### ReturnRegisterPage

- **ベースコンポーネント**: PortalShell（staff） + ReturnRegisterPanel
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialBookId | string | No | クエリ `bookId` からの初期値 |
  | today | string (date) | Yes | 返却日・延滞表示の基準日 |
- **状態**: `phase`、`bookId`、`lookup`、`result`、`submitting`、`error`、`idempotencyKey`
- **イベント**: `onLookup(bookId)`、`onConfirm()`、`onGoNotify(loanId)`、`onReset()`

### ReturnRegisterPanel（UC 固有 Props）

- **ベースコンポーネント**: ReturnRegisterPanel（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | lookup | (bookId: string) => Promise<ReturnLookup> | Yes | 返却対象照会 |
  | onConfirm | (loanId: string) => Promise<ReturnResult> | Yes | 返却確定 |
  | submitting | boolean | Yes | 確定送信中 |
  | variant | "input" \| "found" \| "found-with-reservation" \| "done" | Yes | 表示状態 |
- **状態**: 入力値、照会結果（loan{loanId, loanedOn, dueDate, status}, book{bookId, title, status}, user{userNumber, name}, nextBookStatus, reservationCount）
- **イベント**: `onLookup`, `onConfirm`, `onReset`

## ティア完了条件（BDD）

```gherkin
Feature: 返却を登録する - 司書向けフロントエンド

  Scenario: 予約のない貸出を照会して返却後の状態を表示する
    Given 司書が返却受付画面を開いている
    And GET /api/v1/returns/lookup が {loan: {loanId: "L-0001", status: "ON_LOAN"}, book: {title: "吾輩は猫である"}, nextBookStatus: "AVAILABLE", reservationCount: 0} を返す
    When 書籍 ID「B-000456」を入力して Enter を押す
    Then ReturnRegisterPanel が found 表示になり BookStatusBadge「在庫あり」が表示される
    And 「返却を確定」ボタンが有効になる

  Scenario: 予約のある貸出を照会して予約者の存在を表示する
    Given 司書が返却受付画面を開いている
    And GET /api/v1/returns/lookup が {nextBookStatus: "RESERVED", reservationCount: 2} を返す
    When 書籍 ID「B-000789」を入力して照会する
    Then ReturnRegisterPanel が found-with-reservation 表示になり Alert（warning）に「予約者が 2 人います」と表示される

  Scenario: 確定後に予約ありなら返却通知送信確認画面への導線を表示する
    Given ReturnRegisterPanel が found-with-reservation 表示である
    When 「返却を確定」を押し POST /api/v1/loans/L-0002/return が HTTP 200 {hasReservation: true} を返す
    Then 「返却を登録しました（予約待ち）」と「返却通知を送信する」ボタンが表示される
    And ボタンを押すと /staff/returns/L-0002/notify に遷移する

  Scenario: 貸出中でない書籍は根拠つきで拒否する
    Given 司書が返却受付画面を開いている
    And GET /api/v1/returns/lookup が HTTP 409 {code: "BOOK_NOT_ON_LOAN", detail: "この書籍は貸出中ではありません"} を返す
    When 書籍 ID「B-000456」を入力して照会する
    Then Alert（destructive）に「返却できません: この書籍は貸出中ではありません」が表示される
    And 「返却を確定」ボタンは表示されない
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称: S-返却登録）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|---------------|-------------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'counter'、activeItem = 'returnRegister' |
| PageHeader | `@/components/common/PageHeader` | title = 「返却受付」、notices = ErrorAlert / Alert（success / warning） |
| AsyncStateView | `@/components/common/AsyncStateView` | 照会結果領域: loading = 照会中、error = null（照会エラーは ErrorAlert で input に戻す）、empty = false、skeleton = { variant:'line' }、children = ReturnRegisterPanel の結果表示 |
| ErrorAlert | `@/components/common/ErrorAlert` | error = 正規化済み error（business: 「返却できません: {根拠}」。server / network は再試行）、onRetry = onConfirm（同一 Idempotency-Key）、audience = 'staff' |
| SubmitButton | `@/components/common/SubmitButton` | label = 「返却を確定」、submitting = submitting、variant = 'default'。「照会」は type = 'button'、onClick = onLookup |

共通シェルは持たない（ReturnRegisterPanel が受付フローを内包）。「返却通知を送信する」（`/staff/returns/{loanId}/notify`）は PageHeader.primaryAction または Panel done 内の Button（default）で遷移する。

使用する共通 hooks:

- `useIdempotencyKey`（`@/components/common/hooks/useIdempotencyKey`）: idempotencyKey の生成・再送・onReset での破棄
- `useCounterFlow`（`@/components/common/hooks/useCounterFlow`）: phase（input → found / found-with-reservation → done）と「続けて受付」リセット（ReturnRegisterPanel.variant に写像）
- `useDelayedLoading`: 照会中 0.4 秒超の Skeleton（line）判定
