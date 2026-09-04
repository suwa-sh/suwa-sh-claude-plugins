# 書籍を削除する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルに書籍削除確認画面（/staff/books/:bookId/delete）を追加する。
初期表示で GET /api/v1/books/{bookId} を呼び、状態に応じて ConfirmPanel を destructive（削除可）/ blocked（削除不可）で表示する。
確定時に DELETE /api/v1/books/{bookId}（冪等キー付き）を呼び、完了後は蔵書一覧画面へ戻る（履歴 replace + Alert success）。確認ステップは LP-034 / SR-005 に従う。

## 画面仕様

### 書籍削除確認画面

- **URL**: `/staff/books/:bookId/delete`（クエリ: 戻り先の一覧条件 `page`, `searchType`, `q`, `genreId`, `status` を引き継ぐ）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff / staff-collapsed） | サイドバー「蔵書管理 > 蔵書一覧」をアクティブ表示 |
| 確認パネル | 確認ステップ | ConfirmPanel（destructive / blocked） | title「書籍を削除しますか」、summary（書籍 ID / タイトル / 著者 / ジャンル）、impact（「この操作は取り消せません」または削除不可の根拠） |
| 現在の状態 | バッジ | BookStatusBadge（dot） | summary 内に表示。削除不可の根拠として貸出中 / 予約待ちを示す |
| 確定ボタン | ボタン | Button（destructive） | ConfirmPanel 内。blocked では非表示。submitting 中は disabled + Spinner |
| 戻るボタン | ボタン | Button（ghost） | 論理上の親（蔵書一覧画面）へ戻る |
| 読み込み中 | プレースホルダ | Skeleton（card） | GET 応答まで |
| 不在 | 空状態 | EmptyState（with-action） | 「書籍が見つかりません」+「蔵書一覧へ戻る」 |
| 送信失敗 | 通知 | Alert（destructive） | 500 / ネットワーク断で「削除できませんでした」+ 再試行 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| 削除確定（destructive） | var(--destructive) / var(--destructive-light) | red 系 |
| 削除不可（blocked） | var(--warning) / var(--warning-light) | amber 系（ui-design「削除可否」） |
| 状態バッジ 在庫あり / 貸出中 / 予約待ち | var(--success) / var(--info) / var(--pending) | green / blue / orange 系 |
| カード背景 / 枠 | var(--card-bg) / var(--card-border) | design tokens component 層 |
| フォーカスリング | var(--ring) | var(--primary) |

#### UIロジック

- **状態管理**: 画面内状態（CLP-012）。`BookDeleteState = { book: BookDetailResponse | null, deletable, submitting, loading, loadError, blockedReason, submitError }`。画面遷移で破棄
- **バリデーション**: 入力なし。`deletable = book.status === 'AVAILABLE'` を補助判定として ConfirmPanel の variant に反映（最終判定は API）
- **ローディング**: 初期 GET 中は Skeleton（card）。送信中は確定・戻るボタンを disabled（SR-005）
- **エラーハンドリング**: 404 → EmptyState、409 BOOK_NOT_DELETABLE → ConfirmPanel を blocked に切り替え detail（貸出中 / 予約待ち）を impact に表示、409 OPTIMISTIC_LOCK_CONFLICT → 再読み込み導線、401 → 再認証、403 → 権限エラー、その他 → Alert（destructive）+ 再試行
- **完了時**: 蔵書一覧画面へ `?notice=deleted` と引き継いだ条件を付けて遷移し、履歴を replace（確認画面へ戻れないようにする）

#### 操作フロー

1. 蔵書一覧画面の行内「削除」から遷移する（直接 URL アクセス時も対象の要約を表示する）
2. GET /api/v1/books/{bookId} の応答で ConfirmPanel を初期化する。status が AVAILABLE なら destructive、それ以外なら blocked
3. 司書が summary と impact を確認し「削除する」を押す（blocked では押せない）
4. api client `deleteBook` を呼ぶ（DELETE、Idempotency-Key 付与）
5. 204 応答で蔵書一覧画面（`?notice=deleted`）へ遷移し Alert（success）「書籍を削除しました」を表示する
6. 「戻る」は蔵書一覧画面へクエリを引き継いで戻る

## コンポーネント設計

### BookDeletePage

- **ベースコンポーネント**: PortalShell（staff）+ ConfirmPanel + BookStatusBadge + Skeleton + EmptyState + Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | bookId | string | Yes | ルートパラメータ |
  | returnQuery | { page?: number; searchType?: string; q?: string; genreId?: string; status?: string } | No | 蔵書一覧画面へ戻るときに引き継ぐクエリ |
- **状態**: `book`, `deletable`, `submitting`, `loading`, `loadError`, `blockedReason`, `submitError`
- **イベント**: onConfirm、onCancel、onReload

### ConfirmPanel（UC 固有設定）

- **ベースコンポーネント**: ConfirmPanel（variant: destructive / blocked）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | title | string | Yes | 「書籍を削除しますか」 |
  | summary | ReactNode | Yes | 書籍 ID / タイトル / 著者 / ジャンル / BookStatusBadge |
  | impact | string | Yes | destructive: 「この操作は取り消せません。蔵書一覧から除外されます」/ blocked: 「貸出中のため削除できません」「予約待ちのため削除できません」 |
  | tone | 'destructive' | Yes | 削除操作のため固定（variant は tone + blocked から導出。共通 ConfirmPage 準拠） |
  | onConfirm | () => void | Yes | DELETE を呼ぶ |
  | onCancel | () => void | Yes | 一覧へ戻る |
  | submitting | boolean | Yes | 送信中 |
  | blocked | boolean | Yes | true のとき確定ボタンを非表示 |
- **状態**: なし（表示専用）
- **イベント**: onConfirm, onCancel

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を削除する - 司書向けフロントエンド

  Scenario: 在庫ありの書籍は destructive の確認パネルを表示し、確定で DELETE を呼ぶ
    Given 司書「佐藤花子」が司書ポータルにログイン済み
    And GET /api/v1/books/B-0001 が {title: "吾輩は猫である", status: "AVAILABLE"} を返すようモックされている
    And DELETE /api/v1/books/B-0001 が HTTP 204 を返すようモックされている
    When 書籍削除確認画面（/staff/books/B-0001/delete?page=2）を開き「削除する」を押す
    Then ConfirmPanel（destructive）に「吾輩は猫である」と BookStatusBadge「在庫あり」が表示されていた
    And DELETE /api/v1/books/B-0001 が Idempotency-Key 付きで 1 回呼ばれる
    And URL が「/staff/books?page=2&notice=deleted」に置換（replace）される

  Scenario: 貸出中の書籍は blocked の確認パネルを表示し確定ボタンを出さない
    Given GET /api/v1/books/B-0002 が {title: "坊っちゃん", status: "ON_LOAN"} を返すようモックされている
    When 書籍削除確認画面（/staff/books/B-0002/delete）を開く
    Then ConfirmPanel（blocked）に impact「貸出中のため削除できません」と BookStatusBadge「貸出中」が表示される
    And 「削除する」ボタンは表示されず「戻る」ボタンのみ表示される

  Scenario: API の 409 で blocked に切り替わる
    Given GET /api/v1/books/B-0003 が {status: "AVAILABLE"} を返すようモックされている
    And DELETE /api/v1/books/B-0003 が HTTP 409（code: BOOK_NOT_DELETABLE, detail: "予約待ち"）を返すようモックされている
    When 書籍削除確認画面（/staff/books/B-0003/delete）を開き「削除する」を押す
    Then ConfirmPanel が blocked に切り替わり impact「予約待ちのため削除できません」が表示される

  Scenario: 送信中はボタンが無効化され二重送信されない
    Given GET /api/v1/books/B-0001 が {status: "AVAILABLE"} を返すようモックされている
    And DELETE /api/v1/books/B-0001 が 2 秒後に HTTP 204 を返すようモックされている
    When 書籍削除確認画面を開き「削除する」を 0.2 秒間隔で 2 回押す
    Then 「削除する」は 1 回目の押下後 disabled + Spinner になる
    And DELETE /api/v1/books/B-0001 は 1 回だけ呼ばれる
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-書籍削除）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'books'、activeItem = 'bookList' |
| ConfirmPage | `@/components/common/ConfirmPage` | title = 「書籍を削除しますか」、tone = 'destructive'、blocked = !state.deletable（ConfirmPanel variant は tone + blocked から導出）、summary = 書籍 ID / タイトル / 著者 / ジャンル / BookStatusBadge、impact = destructive 文言 または state.blockedReason、loading = state.loading、loadError = state.loadError、emptyState = { title: 「書籍が見つかりません」, action: { label: 「蔵書一覧へ戻る」 } }、submitting = state.submitting、submitError = state.submitError（409 BOOK_NOT_DELETABLE → blocked = true に切替）、confirmLabel = 「削除する」、onConfirm = onConfirm、onCancel = onCancel |
| PageHeader | `@/components/common/PageHeader` | ConfirmPage 内部で利用 |
| AsyncStateView | `@/components/common/AsyncStateView` | ConfirmPage 内部で利用（skeleton = { variant: 'card' }） |
| ErrorAlert | `@/components/common/ErrorAlert` | ConfirmPage 内部で利用。audience = 'staff'（conflict OPTIMISTIC_LOCK_CONFLICT → onReload） |
| SubmitButton | `@/components/common/SubmitButton` | label = 「削除する」、submitting = state.submitting、variant = 'destructive'（ConfirmPage 内） |
| BackLink | `@/components/common/BackLink` | label = 「蔵書一覧へ戻る」、to = '/staff/books'、returnQuery = props.returnQuery |
| NoticeAlert（発行） | `@/components/common/NoticeAlert` | 表示は蔵書一覧側。本 UC は `notice=deleted` を発行する |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useIdempotencyKey | DELETE /api/v1/books/{bookId} の Idempotency-Key 生成（再試行で同一キーを再送） |
| useNoticeNavigation | 204 応答後に `/staff/books` + returnQuery + `notice=deleted` を組み立てて replace 遷移 |
