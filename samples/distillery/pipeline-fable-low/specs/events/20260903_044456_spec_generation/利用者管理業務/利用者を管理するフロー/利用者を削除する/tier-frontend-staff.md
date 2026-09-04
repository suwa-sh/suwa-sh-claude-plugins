# 利用者を削除する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルに利用者削除確認画面（/staff/users/:userId/delete）を追加する。
初期表示で GET /api/v1/users/{userNumber}?include=activeCounts を呼び、有効な貸出・予約の件数に応じて ConfirmPanel を destructive（削除可）/ blocked（削除不可）で表示する。連絡先は PiiMaskedText で既定マスクする。
確定時に DELETE /api/v1/users/{userNumber}（冪等キー付き）を呼び、完了後は利用者一覧画面へ戻る（履歴 replace + Alert success）。確認ステップは LP-034 / SR-005 に従う。

## 画面仕様

### 利用者削除確認画面

- **URL**: `/staff/users/:userId/delete`（`:userId` = 利用者番号。クエリ: 戻り先の一覧条件 `page`, `q` を引き継ぐ）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff / staff-collapsed） | サイドバー「利用者管理 > 利用者一覧」をアクティブ表示 |
| 確認パネル | 確認ステップ | ConfirmPanel（destructive / blocked） | title「利用者を削除しますか」、summary（利用者番号 / 氏名 / 利用者区分 / 連絡先）、impact（「この操作は取り消せません。貸出履歴は保持されます」または削除不可の根拠） |
| 連絡先 | テキスト | PiiMaskedText（email / phone / address, revealable） | 既定マスク。目のアイコンで開示（NFR E.1.2.1 / E.6.1.1） |
| 確定ボタン | ボタン | Button（destructive） | ConfirmPanel 内。blocked では非表示。submitting 中は disabled + Spinner |
| 戻るボタン | ボタン | Button（ghost） | 論理上の親（利用者一覧画面）へ戻る |
| 読み込み中 | プレースホルダ | Skeleton（card） | GET 応答まで |
| 不在 | 空状態 | EmptyState（with-action） | 「利用者が見つかりません」+「利用者一覧へ戻る」 |
| 送信失敗 | 通知 | Alert（destructive） | 500 / ネットワーク断で「削除できませんでした」+ 再試行 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| 削除確定（destructive） | var(--destructive) / var(--destructive-light) | red 系 |
| 削除不可（blocked） | var(--warning) / var(--warning-light) | amber 系（ui-design「削除可否」） |
| マスク背景 | var(--pii-masked-bg) | var(--background-muted)（dark: gray-700） |
| カード背景 / 枠 | var(--card-bg) / var(--card-border) | design tokens component 層 |
| フォーカスリング | var(--ring) | var(--primary) |

#### UIロジック

- **状態管理**: 画面内状態（CLP-012）。`UserDeleteState = { user: UserResponse | null, deletable, blockedReasons: ('ACTIVE_LOAN' | 'ACTIVE_RESERVATION')[], submitting, loading, loadError, submitError }`。氏名・連絡先はメモリ内のみ保持し、画面遷移で破棄する（LR-025）
- **バリデーション**: 入力なし。`deletable = activeLoanCount === 0 && activeReservationCount === 0` を補助判定として ConfirmPanel の variant に反映（最終判定は API）
- **ローディング**: 初期 GET 中は Skeleton（card）。送信中は確定・戻るボタンを disabled（SR-005）
- **エラーハンドリング**: 404 → EmptyState、409 USER_NOT_DELETABLE → ConfirmPanel を blocked に切り替え `reasons[]` を impact 文言（貸出中 n 冊 / 予約 m 件）に変換、409 SELF_DELETE_NOT_ALLOWED → Alert「自分自身は削除できません」、409 OPTIMISTIC_LOCK_CONFLICT → 再読み込み導線、401 → 再認証、403 → 権限エラー、その他 → Alert（destructive）+ 再試行。コンソールに氏名・連絡先を出力しない（CLR-009）
- **完了時**: 利用者一覧画面へ `?notice=deleted` と引き継いだ条件を付けて遷移し、履歴を replace

#### 操作フロー

1. 利用者一覧画面の行内「削除」から遷移する（直接 URL アクセス時も対象の要約を表示する）
2. GET /api/v1/users/{userNumber}?include=activeCounts の応答で ConfirmPanel を初期化する。activeLoanCount と activeReservationCount が共に 0 なら destructive、それ以外なら blocked（根拠を impact に表示）
3. 司書が summary（連絡先は必要に応じて開示）と impact を確認し「削除する」を押す
4. api client `deleteUser` を呼ぶ（DELETE、Idempotency-Key 付与）
5. 204 応答で利用者一覧画面（`?notice=deleted`）へ遷移し Alert（success）「利用者を削除しました」を表示する
6. 「戻る」は利用者一覧画面へクエリを引き継いで戻る

## コンポーネント設計

### UserDeletePage

- **ベースコンポーネント**: PortalShell（staff）+ ConfirmPanel + PiiMaskedText + Skeleton + EmptyState + Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | userNumber | string | Yes | ルートパラメータ（:userId） |
  | returnQuery | { page?: number; q?: string } | No | 利用者一覧画面へ戻るときに引き継ぐクエリ |
- **状態**: `user`, `deletable`, `blockedReasons`, `submitting`, `loading`, `loadError`, `submitError`
- **イベント**: onConfirm、onCancel、onReload

### ConfirmPanel（UC 固有設定）

- **ベースコンポーネント**: ConfirmPanel（variant: destructive / blocked）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | title | string | Yes | 「利用者を削除しますか」 |
  | summary | ReactNode | Yes | 利用者番号 / 氏名 / 利用者区分 / PiiMaskedText（email, phone, address） |
  | impact | string | Yes | destructive: 「この操作は取り消せません。過去の貸出履歴は保持されます」/ blocked: 「貸出中の書籍が n 冊あるため削除できません」「予約が m 件あるため削除できません」（複数理由は改行で併記） |
  | tone | 'destructive' | Yes | 削除操作のため固定（variant は tone + blocked から導出。共通 ConfirmPage 準拠） |
  | onConfirm | () => void | Yes | DELETE を呼ぶ |
  | onCancel | () => void | Yes | 一覧へ戻る |
  | submitting | boolean | Yes | 送信中 |
  | blocked | boolean | Yes | true のとき確定ボタンを非表示 |
- **状態**: なし
- **イベント**: onConfirm, onCancel

### PiiMaskedText（既存ドメインコンポーネントの利用）

- **ベースコンポーネント**: PiiMaskedText
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | string | Yes | メールアドレス / 電話番号 / 住所 |
  | kind | 'email' \| 'phone' \| 'address' | Yes | マスク形式 |
  | revealable | boolean | No | true（目のアイコンで開示） |
- **状態**: revealed（開示中かどうか。画面内のみ）
- **イベント**: onReveal

## ティア完了条件（BDD）

```gherkin
Feature: 利用者を削除する - 司書向けフロントエンド

  Scenario: 貸出も予約もない利用者は destructive の確認パネルを表示し、確定で DELETE を呼ぶ
    Given 司書「佐藤花子」が司書ポータルにログイン済み
    And GET /api/v1/users/U0001234?include=activeCounts が {name: "田中太郎", email: "tanaka@example.com", activeLoanCount: 0, activeReservationCount: 0} を返すようモックされている
    And DELETE /api/v1/users/U0001234 が HTTP 204 を返すようモックされている
    When 利用者削除確認画面（/staff/users/U0001234/delete?page=2）を開き「削除する」を押す
    Then ConfirmPanel（destructive）に「U0001234」「田中太郎」と PiiMaskedText「t***@example.com」が表示されていた
    And DELETE /api/v1/users/U0001234 が Idempotency-Key 付きで 1 回呼ばれる
    And URL が「/staff/users?page=2&notice=deleted」に置換（replace）される

  Scenario: 貸出中の利用者は blocked の確認パネルを表示し確定ボタンを出さない
    Given GET /api/v1/users/U0003456?include=activeCounts が {name: "鈴木一郎", activeLoanCount: 2, activeReservationCount: 1} を返すようモックされている
    When 利用者削除確認画面（/staff/users/U0003456/delete）を開く
    Then ConfirmPanel（blocked）に impact「貸出中の書籍が 2 冊あるため削除できません」と「予約が 1 件あるため削除できません」が表示される
    And 「削除する」ボタンは表示されず「戻る」ボタンのみ表示される

  Scenario: 連絡先は既定でマスクされ、目のアイコンで開示できる
    Given GET /api/v1/users/U0001234?include=activeCounts が {email: "tanaka@example.com", phone: "090-1234-5678"} を返すようモックされている
    When 利用者削除確認画面（/staff/users/U0001234/delete）を開く
    Then PiiMaskedText がメールアドレスを「t***@example.com」、電話番号を「090-****-5678」と表示する
    And 目のアイコンを押すと「tanaka@example.com」が表示される

  Scenario: API の 409 で blocked に切り替わる
    Given GET /api/v1/users/U0001234?include=activeCounts が {activeLoanCount: 0, activeReservationCount: 0} を返すようモックされている
    And DELETE /api/v1/users/U0001234 が HTTP 409（code: USER_NOT_DELETABLE, reasons: ["ACTIVE_LOAN"]）を返すようモックされている
    When 利用者削除確認画面を開き「削除する」を押す
    Then ConfirmPanel が blocked に切り替わり impact「貸出中の書籍があるため削除できません」が表示される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-利用者削除）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'users'、activeItem = 'userList' |
| ConfirmPage | `@/components/common/ConfirmPage` | title = 「利用者を削除しますか」、tone = 'destructive'、blocked = !state.deletable（ConfirmPanel variant は tone + blocked から導出）、summary = 利用者番号 / 氏名 / 利用者区分 / PiiMaskedText（email, phone, address）、impact = destructive 文言 または blockedReasons を変換した文言（複数理由は改行併記）、loading = state.loading、loadError = state.loadError、emptyState = { title: 「利用者が見つかりません」, action: { label: 「利用者一覧へ戻る」 } }、submitting = state.submitting、submitError = state.submitError（409 USER_NOT_DELETABLE → blocked = true に切替、409 SELF_DELETE_NOT_ALLOWED → business Alert）、confirmLabel = 「削除する」、onConfirm = onConfirm、onCancel = onCancel |
| PageHeader | `@/components/common/PageHeader` | ConfirmPage 内部で利用 |
| AsyncStateView | `@/components/common/AsyncStateView` | ConfirmPage 内部で利用（skeleton = { variant: 'card' }） |
| ErrorAlert | `@/components/common/ErrorAlert` | ConfirmPage 内部で利用。audience = 'staff'（conflict OPTIMISTIC_LOCK_CONFLICT → onReload） |
| SubmitButton | `@/components/common/SubmitButton` | label = 「削除する」、submitting = state.submitting、variant = 'destructive'（ConfirmPage 内） |
| BackLink | `@/components/common/BackLink` | label = 「利用者一覧へ戻る」、to = '/staff/users'、returnQuery = props.returnQuery |
| NoticeAlert（発行） | `@/components/common/NoticeAlert` | 表示は利用者一覧側。本 UC は `notice=deleted` を発行する |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useIdempotencyKey | DELETE /api/v1/users/{userNumber} の Idempotency-Key 生成（再試行で同一キーを再送） |
| useNoticeNavigation | 204 応答後に `/staff/users` + returnQuery + `notice=deleted` を組み立てて replace 遷移 |
| usePiiReveal | summary 内 PiiMaskedText（email / phone / address）の開示状態。画面内のみ保持 |
