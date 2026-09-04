# 貸出を登録する - 司書向けフロントエンド仕様

## 変更概要

司書ポータル（staff）に貸出受付画面を追加する。LoanRegisterPanel で利用者番号と書籍 ID の 2 入力から貸出可否を判定し、返却期限の自動算出結果を確認して確定する。判定否のときは根拠を並記し、確定は冪等キー付きで二重送信を防ぐ（arch SP-006 / SR-005）。

## 画面仕様

### 貸出受付画面

- **URL**: `/staff/loans/new`（`?userNumber=` で窓口利用状況照会画面から利用者番号を引き継ぐ）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff） | サイドバー「窓口」グループのアクティブ項目 |
| 受付パネル | フォーム | LoanRegisterPanel（input / allowed / denied / done） | 利用者番号・書籍 ID の入力、判定結果、確定ボタン |
| 書籍の状態 | バッジ | BookStatusBadge | 判定結果に含まれる書籍の状態（在庫あり / 貸出中 / 予約待ち） |
| 返却期限 | テキスト | DueDateIndicator（ok） | 算出された返却期限（`dueDate`, `today`, `remindDays`） |
| 判定結果・処理結果 | 通知 | Alert（success / destructive） | 「貸出できます」「貸出できません: {根拠}」「貸出を登録しました」 |
| 判定 / 確定 / 続けて受付 | ボタン | Button（default / secondary） | 判定（Enter 同等）、貸出を確定、続けて受付 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント | var(--primary) | staff = var(--color-slate-700)（#334155） |
| 判定可 | var(--success) / var(--success-light) | var(--color-green-600) / var(--color-green-50) |
| 判定否 | var(--destructive) / var(--destructive-light) | var(--color-red-600) / var(--color-red-50) |
| 返却期限 ok | due_date.ok | var(--success) |

#### UIロジック

- **状態管理**: 画面内状態（ビュー層に保持。状態管理層は置かない）: `phase`（input / allowed / denied / done）、`userNumber`、`bookId`、`eligibility`（判定結果）、`loan`（登録結果）、`submitting`、`idempotencyKey`（確定操作ごとに生成。再送時は同じ値を使う）
- **バリデーション**: 利用者番号・書籍 ID は必須。空欄のまま判定・確定は不可（Button disabled）。形式チェックは Backend API の 400 に従いフィールドエラーを表示する
- **ローディング**: 判定中は入力欄を disabled、Button 内に Spinner。0.4 秒を超える場合は Skeleton（line）で判定結果領域を確保する
- **エラーハンドリング**: 409（`BOOK_NOT_AVAILABLE` / `RESERVATION_PRIORITY_MISMATCH` / `MEDIA_TYPE_NOT_LOANABLE`）と 404（`BOOK_NOT_FOUND` / `USER_NOT_FOUND`）は denied として「貸出できません: {根拠}」を Alert（destructive）で表示し、次の操作（返却受付へ / 入力し直す）を添える。401 は IdP ログインへ、403 は「司書のみ操作できます」。5xx / ネットワークエラーは「登録できませんでした。再試行してください」（同じ冪等キーで再送可）
- **二重送信防止**: 確定送信中は「貸出を確定」を disabled + Spinner。確定成功後は履歴を replace して確認状態に戻れないようにする

#### 操作フロー

1. 司書がサイドバー「窓口 > 貸出受付」から画面を開く（利用者番号がクエリにあれば初期値に入れる）
2. 利用者番号と書籍 ID を入力し Enter（または「判定」）を押す
3. `GET /api/v1/loans/eligibility` の結果で allowed（書籍名・利用者名・返却期限を表示）または denied（根拠を表示）に切り替わる
4. allowed のとき「貸出を確定」を押す → `POST /api/v1/loans`（Idempotency-Key 付き）
5. done で「貸出を登録しました」と返却期限を大きく表示する
6. 「続けて受付」で input に戻る（入力をクリア）

## コンポーネント設計

### LoanRegisterPage

- **ベースコンポーネント**: PortalShell（staff） + LoanRegisterPanel
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialUserNumber | string | No | クエリ `userNumber` からの初期値 |
  | today | string (date) | Yes | DueDateIndicator の基準日 |
- **状態**: `phase`、`userNumber`、`bookId`、`eligibility`、`loan`、`submitting`、`error`、`idempotencyKey`
- **イベント**: `onLookup(userNumber, bookId)`、`onConfirm()`、`onReset()`

### LoanRegisterPanel（UC 固有 Props）

- **ベースコンポーネント**: LoanRegisterPanel（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | lookup | (userNumber: string, bookId: string) => Promise<LoanEligibility> | Yes | 貸出可否照会 |
  | onConfirm | (input: {userNumber: string; bookId: string}) => Promise<LoanResult> | Yes | 貸出確定 |
  | submitting | boolean | Yes | 確定送信中 |
  | variant | "input" \| "allowed" \| "denied" \| "done" | Yes | 表示状態 |
- **状態**: 入力値、判定結果（allowed, reasonCode, reasonMessage, book{bookId,title,status}, user{userNumber,name}, dueDate）
- **イベント**: `onLookup`, `onConfirm`, `onReset`

## ティア完了条件（BDD）

```gherkin
Feature: 貸出を登録する - 司書向けフロントエンド

  Scenario: 判定可の結果で返却期限を表示し確定ボタンを有効にする
    Given 司書が貸出受付画面を開いている
    And GET /api/v1/loans/eligibility が {allowed: true, dueDate: "2026-09-17", book: {title: "吾輩は猫である", status: "AVAILABLE"}} を返す
    When 利用者番号「U-000123」と書籍 ID「B-000456」を入力して Enter を押す
    Then LoanRegisterPanel が allowed 表示になり返却期限「2026-09-17」が表示される
    And 「貸出を確定」ボタンが有効になる

  Scenario: 判定否の根拠を表示する
    Given 司書が貸出受付画面を開いている
    And GET /api/v1/loans/eligibility が {allowed: false, reasonCode: "BOOK_NOT_AVAILABLE", reasonMessage: "この書籍は貸出中です"} を返す
    When 利用者番号「U-000123」と書籍 ID「B-000456」を入力して判定する
    Then Alert（destructive）に「貸出できません: この書籍は貸出中です」が表示される
    And 「貸出を確定」ボタンは表示されない

  Scenario: 確定送信中はボタンを無効化し完了後に返却期限を表示する
    Given LoanRegisterPanel が allowed 表示である
    When 「貸出を確定」を押す
    Then 送信中は「貸出を確定」が disabled になり Spinner が表示される
    And POST /api/v1/loans が HTTP 201 を返すと「貸出を登録しました」と返却期限「2026-09-17」が表示される

  Scenario: 必須入力が空のとき判定できない
    Given 司書が貸出受付画面を開いている
    When 書籍 ID を空のまま利用者番号「U-000123」だけ入力する
    Then 「判定」ボタンは disabled のままである
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称: S-貸出登録）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|---------------|-------------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'counter'、activeItem = 'loanRegister' |
| PageHeader | `@/components/common/PageHeader` | title = 「貸出受付」、notices = ErrorAlert / Alert（success「貸出を登録しました」） |
| ErrorAlert | `@/components/common/ErrorAlert` | error = 正規化済み error（business: 「貸出できません: {根拠}」は呼び出し側が組む。server / network は onConfirm 再送）、onRetry = onConfirm（同一 Idempotency-Key）、audience = 'staff' |
| SubmitButton | `@/components/common/SubmitButton` | label = 「貸出を確定」、submitting = submitting、variant = 'default'（LoanRegisterPanel allowed 内の確定ボタン）。「判定」は type = 'button'、onClick = onLookup、submitting = 判定中 |

共通シェルは持たない（LoanRegisterPanel が受付フローを内包。取得系一覧がないため AsyncStateView は不使用）。

使用する共通 hooks:

- `useIdempotencyKey`（`@/components/common/hooks/useIdempotencyKey`）: idempotencyKey の生成・再送・onReset での破棄
- `useCounterFlow`（`@/components/common/hooks/useCounterFlow`）: phase（input → allowed / denied → done）と「続けて受付」リセット（LoanRegisterPanel.variant に写像）
- `useDelayedLoading`: 判定中 0.4 秒超の Skeleton（line）判定
