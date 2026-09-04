# 利用者一覧を参照する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルの利用者管理グループに利用者一覧画面（/staff/users）を追加する。
Input（with-icon）による利用者番号・氏名の絞り込み、UserTable による一覧表示と行内操作（編集 / 削除 / 利用状況）、PiiMaskedText による連絡先の既定マスク、Pagination（20 件/頁）を実装する。
GET /api/v1/users の呼び出しと HTTP エラーの正規化を api client に追加する。

## 画面仕様

### 利用者一覧画面

- **URL**: `/staff/users`（クエリ: `q`, `page`, `notice`）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff / staff-collapsed） | サイドバー「利用者管理 > 利用者一覧」をアクティブ表示 |
| ページ見出し「利用者一覧」+「利用者を登録」 | テキスト + ボタン | Button（default） | 押下で利用者登録画面（/staff/users/new）へ遷移 |
| 絞り込み | フォーム | Input（with-icon） | 「利用者番号または氏名で検索」。Enter で検索（ui-design: 利用者検索は単一条件の Input） |
| 利用者一覧 | テーブル | UserTable | 利用者番号 / 氏名 / 区分 / 連絡先（PiiMaskedText）/ 登録日 / 操作列 |
| 連絡先列 | テキスト | PiiMaskedText（email / phone, revealable） | 既定マスク。目のアイコンで行ごとに開示 |
| 操作列 | ボタン | Button（ghost, sm） | 編集 → /staff/users/:userId/edit、削除 → /staff/users/:userId/delete、利用状況 → /staff/users/:userId/status |
| ページ送り | ナビゲーション | Pagination（default / single-page） | 総ページ数 = ceil(totalCount / 20) |
| 読み込み中 | プレースホルダ | Skeleton（table） | 0.4 秒超で表示 |
| 該当なし | 空状態 | EmptyState（with-action） | 絞り込み結果 0 件 / 未登録時。アクション「利用者を登録」 |
| 取得失敗 | 通知 | Alert（destructive） | 「一覧を取得できませんでした」+ 再試行 |
| 登録・編集・削除完了通知 | 通知 | Alert（success） | 前画面からの遷移時にクエリ `?notice=created|updated|deleted` で表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| 文字色 | var(--foreground) | var(--color-gray-900)（dark: var(--color-gray-50)） |
| アクセント（staff primary） | var(--primary) | var(--color-slate-700)（dark: var(--color-slate-400)） |
| テーブルヘッダ背景 | var(--table-header-bg) | var(--background-subtle) |
| サイドバー アクティブ項目 | var(--sidebar-active-bg) / var(--sidebar-active-fg) | var(--primary-light) / var(--primary) |
| マスク背景 / マスク文字 | var(--pii-masked-bg) / var(--foreground-muted) | var(--background-muted) / gray 系 |
| フォーカスリング | var(--ring) | var(--primary) |

#### UIロジック

- **状態管理**: 画面内状態（CLP-012）。`UserListPageState = { q, page, items: UserSummary[], totalCount, loading, error, revealed: Set<userNumber> }`。q / page は URL クエリと双方向同期し、編集・削除から戻ったときに復元する。氏名・連絡先はメモリ内のみ保持し永続化しない（LR-025）
- **バリデーション**: q は 100 文字以内。不正時は Input（error）で表示し送信しない
- **ローディング**: 初回・検索・ページ変更で `loading = true`。0.4 秒超で Skeleton（table）。取得中は Input の送信を disabled
- **エラーハンドリング**: 401 → 再認証、403 → Alert「この画面を表示する権限がありません」、その他 → Alert（destructive）+ 再試行。コンソールに氏名・連絡先を出力しない（CLR-009）
- **表示**: 一覧は利用者番号昇順。区分列は「司書」「利用者」。登録日は YYYY/MM/DD。開示状態（revealed）はページ遷移・再検索で破棄する

#### 操作フロー

1. 司書がサイドバー「利用者管理 > 利用者一覧」を選ぶ（または `/staff/users?page=2` を直接開く）
2. view が URL クエリから q / page を復元し、api client `listUsers` を呼ぶ（GET /api/v1/users）
3. 応答を UserTable に描画し（連絡先はマスク）、Pagination の総ページ数を更新する
4. 司書が Input に利用者番号または氏名を入力して Enter を押すと page を 1 に戻して再取得し、URL クエリを更新する
5. 必要な行だけ目のアイコンで連絡先を開示する
6. 行内操作「編集」「削除」「利用状況」で該当画面へ遷移する。遷移先の「戻る」は現在の URL クエリを引き継いで一覧へ戻る

## コンポーネント設計

### UserListPage

- **ベースコンポーネント**: PortalShell（staff）+ Input（with-icon）+ UserTable + PiiMaskedText + Pagination + EmptyState + Skeleton + Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialQuery | { q?: string; page?: number } | No | URL クエリから復元した初期条件（既定 page = 1） |
  | notice | 'created' \| 'updated' \| 'deleted' | No | 前画面からの完了通知種別 |
- **状態**: `q`, `page`, `items`, `totalCount`, `loading`, `error`, `revealed`
- **イベント**: onSearch（page を 1 にして再取得）、onPageChange、onEdit(userNumber)、onDelete(userNumber)、onSelectStatus(userNumber)、onCreateClick

### UserTable（UC 固有設定）

- **ベースコンポーネント**: UserTable
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | users | UserSummary[]（userNumber, name, userType, email, phone, registeredAt） | Yes | 一覧行 |
  | onEdit | (userNumber: string) => void | Yes | 編集画面へ遷移 |
  | onDelete | (userNumber: string) => void | Yes | 削除確認画面へ遷移 |
  | onSelect | (userNumber: string) => void | No | 窓口利用状況照会画面へ遷移 |
  | loading | boolean | Yes | true のとき Table（loading）/ Skeleton |
- **状態**: なし（表示専用。連絡先セルは PiiMaskedText に委譲）
- **イベント**: onEdit, onDelete, onSelect

### PiiMaskedText（既存ドメインコンポーネントの利用）

- **ベースコンポーネント**: PiiMaskedText
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | string | Yes | メールアドレス / 電話番号 |
  | kind | 'email' \| 'phone' | Yes | マスク形式 |
  | revealable | boolean | No | true |
- **状態**: revealed（行ごと。画面内のみ）
- **イベント**: onReveal

## ティア完了条件（BDD）

```gherkin
Feature: 利用者一覧を参照する - 司書向けフロントエンド

  Scenario: 一覧取得中は Skeleton が表示され、取得後に UserTable に置き換わる
    Given 司書「佐藤花子」が司書ポータルにログイン済み
    And GET /api/v1/users が 1 秒後に 20 件（totalCount 45）を返すようモックされている
    When 利用者一覧画面（/staff/users）を開く
    Then 0.4 秒経過後に Skeleton（table）が表示される
    And 応答後に UserTable に 20 行と Pagination「1 / 3」が表示される

  Scenario: 連絡先は既定でマスクされ、行ごとに開示できる
    Given GET /api/v1/users が {userNumber: "U0001234", name: "田中太郎", email: "tanaka@example.com", phone: "090-1234-5678"} を含む結果を返すようモックされている
    When 利用者一覧画面（/staff/users）を開く
    Then 「田中太郎」の連絡先列に「t***@example.com」「090-****-5678」が表示される
    And 目のアイコンを押すと「tanaka@example.com」が表示され、他の行はマスクのままである

  Scenario: 検索文字列とページ番号が URL クエリに反映される
    Given 利用者一覧画面（/staff/users）を表示している
    When Input に「田中」と入力して Enter を押す
    Then URL が「/staff/users?page=1&q=%E7%94%B0%E4%B8%AD」になる
    And GET /api/v1/users が q=田中&page=1&pageSize=20 で呼ばれる

  Scenario: 削除確認画面から戻ると検索条件とページが復元される
    Given 利用者一覧画面を「?page=2&q=田中」で表示している
    When 行内操作「削除」で利用者「U0001234」の削除確認画面へ遷移し、「戻る」を押す
    Then 利用者一覧画面が「?page=2&q=田中」で再表示される

  Scenario: 結果 0 件のとき EmptyState に登録導線が表示される
    Given 利用者一覧画面（/staff/users）を表示している
    When Input に「存在しない氏名」を入力して検索し、API が items 空・totalCount 0 を返す
    Then EmptyState（with-action）「該当する利用者がいません」と「利用者を登録」ボタンが表示される
    And UserTable は表示されない
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-利用者一覧）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'users'、activeItem = 'userList' |
| PageHeader | `@/components/common/PageHeader` | title = 「利用者一覧」、primaryAction = { label: 「利用者を登録」, onClick: onCreateClick }、notices = NoticeAlert |
| NoticeAlert | `@/components/common/NoticeAlert` | notice = props.notice（created / updated / deleted）、messages = { created: 「利用者を登録しました」, updated: 「利用者を更新しました」, deleted: 「利用者を削除しました」 }、onDismiss = `?notice` を replace で除去 |
| PaginatedListFrame | `@/components/common/PaginatedListFrame` | filter = KeywordSearchInput、page / totalCount = state.page / state.totalCount、pageSize = 20、onPageChange = onPageChange、loading / error = state.loading / state.error、empty = items.length === 0、skeleton = { variant: 'table' }、emptyState = { title: 「該当する利用者がいません」, action: { label: 「利用者を登録」, onClick: onCreateClick } }、onRetry = 再取得、children = UserTable |
| KeywordSearchInput | `@/components/common/KeywordSearchInput` | value = state.q、onChange = setQ、onSubmit = onSearch（page を 1 に戻す）、placeholder = 「利用者番号または氏名で検索」、maxLength = 100、disabled = state.loading |
| ErrorAlert | `@/components/common/ErrorAlert` | PaginatedListFrame 内部で利用。audience = 'staff' |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useUrlQueryState | `q` / `page` の URL クエリ双方向同期（編集・削除から戻ったときの復元） |
| usePiiReveal | UserTable 連絡先列（PiiMaskedText email / phone）の行別開示状態。ページ遷移・再検索で破棄 |
