# 貸出履歴を参照する - 利用者向けフロントエンド仕様

## 変更概要

利用者ポータル（patron）にマイ貸出履歴画面を追加する。LoanTable（current / history）で本人の貸出を表示し、DueDateIndicator（ok / soon / overdue / returned）で残日数を先頭に示す（ux-design「利用者: 自分の利用状況を確認し、不要な予約を取り消す」）。20 件/頁の Pagination と Skeleton を標準装備し、本人データは画面内メモリにのみ保持する（LP-030 / SP-002）。

## 画面仕様

### マイ貸出履歴画面

- **URL**: `/me/loans`（クエリ: `scope`（current / history）, `page`）
- **アクセス権**: 利用者（認証必須。本人分のみ。未認証時は IdP ログインへ遷移し、ログイン後に元 URL へ戻す）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（patron） | トップナビ「マイ貸出履歴」をアクティブ表示 |
| 表示範囲切替 | トグル | ToggleGroup（single, md） | 「現在の貸出」（既定）/「履歴」 |
| 貸出一覧 | テーブル | LoanTable（current / history） | 書籍（タイトル / 著者）/ 貸出日 / 返却期限 / 状態 /（履歴では返却日） |
| 返却期限 | インジケータ | DueDateIndicator（ok / soon / overdue / returned） | 「2026/09/17（あと 7 日）」「10 日超過」「返却日 2026/08/10」 |
| 貸出の状態 | バッジ | LoanStatusBadge（dot） | 貸出中（info）/ 延滞（destructive）/ 返却済み（neutral） |
| 延滞の注意 | 通知 | Alert（warning） | `overdueCount >= 1` のとき見出し直下に「返却期限を過ぎた書籍があります。窓口へご返却ください」 |
| ページ送り | ナビゲーション | Pagination（default / single-page） | 総ページ数 = ceil(totalCount / 20) |
| 読み込み中 | プレースホルダ | Skeleton（table） | 0.4 秒を超える取得で表示 |
| 貸出なし | 空状態 | EmptyState（with-action） | 「現在借りている書籍はありません」+ 蔵書検索へ（履歴では「貸出履歴はありません」） |
| 取得失敗 | 通知 | Alert（destructive） | 「貸出履歴を取得できませんでした」+ 再試行 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（patron primary） | var(--primary) | var(--color-blue-600)（#2563EB） |
| テーブルヘッダ背景 | var(--table-header-bg) | var(--background-subtle) |
| 返却期限 ok / soon / overdue | due_date.ok / due_date.soon / due_date.overdue | var(--success) / var(--warning) / var(--destructive) |
| 貸出中バッジ | var(--info) / var(--info-light) | blue 系 |
| 延滞バッジ | var(--destructive) / var(--destructive-light) | red 系 |
| 返却済みバッジ | var(--neutral) / var(--neutral-light) | gray 系 |
| 延滞注意 Alert | var(--warning) / var(--warning-light) | amber 系 |

#### UIロジック

- **状態管理**: 画面内状態（2 層構成、状態管理層なし）: `MyLoansPageState = { scope, page, items, totalCount, overdueCount, today, remindDays, loading, error }`。`scope` と `page` は URL クエリと双方向同期する。本人データは画面遷移で破棄する（LP-030）
- **バリデーション**: 入力項目なし。`scope` は current / history 以外を current に補正、`page` は 1 以上に補正する
- **ローディング**: 初回・切替・ページ変更で `loading = true`。0.4 秒を超えたら Skeleton（table）
- **エラーハンドリング**: 401 → IdP 再認証（ログイン後に元 URL へ）、403 → Alert「この画面は利用者向けです」、その他 → Alert（destructive）+ 再試行（LR-023 / LP-031）。コンソールログに貸出履歴・氏名を出力しない
- **表示**: 現在の貸出は返却期限昇順（延滞 → まもなく → 通常の順に自然に並ぶ）。履歴は貸出日降順。DueDateIndicator は `today` と `remindDays` を API 応答から受け取る（クライアントの時計に依存しない）。「あと N 日」の残日数を先頭に示す（フレーミング効果）
- **レスポンシブ**: sm では LoanTable を 2 段組みにし、状態バッジと期限を 1 段目に出す（ui-design モバイル対応方針）

#### 操作フロー

1. 利用者がトップナビ「マイ貸出履歴」を開く（未認証なら IdP ログインへ）
2. view が URL クエリから `scope` / `page` を復元し、api client `listMyLoans` を呼ぶ（GET /api/v1/me/loans）
3. LoanTable（current）を描画し、`overdueCount >= 1` なら Alert（warning）を見出し直下に出す
4. 「履歴」に切り替えると scope = history、page = 1 で再取得し、LoanTable（history）に返却日列を表示する
5. Pagination でページを変えると再取得し URL クエリを更新する

## コンポーネント設計

### MyLoansPage

- **ベースコンポーネント**: PortalShell（patron） + ToggleGroup + LoanTable + Pagination
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialScope | "current" \| "history" | No | クエリ `scope` からの初期値（既定 current） |
  | initialPage | number | No | クエリ `page` からの初期値（既定 1） |
- **状態**: `scope`、`page`、`items`、`totalCount`、`overdueCount`、`today`、`remindDays`、`loading`、`error`
- **イベント**: `onScopeChange(scope)`、`onPageChange(page)`、`onRetry()`

### LoanTable（UC 固有 Props）

- **ベースコンポーネント**: LoanTable（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | MyLoanItem[]（loanId, book{title, author}, loanedOn, dueDate, returnedOn, status, remainingDays, dueStatus） | Yes | 本人の貸出 |
  | today | string (date) | Yes | DueDateIndicator の基準日（API 応答） |
  | remindDays | number | Yes | soon 判定の日数（API 応答） |
  | showUser | false | Yes | 本人分のため利用者列は非表示 |
  | variant | "current" \| "history" | Yes | 表示範囲 |
  | loading | boolean | Yes | 読み込み中 |
- **状態**: なし（表示のみ）
- **イベント**: `onSelectBook(bookId)`（書籍詳細・在庫状況画面へ）

## ティア完了条件（BDD）

```gherkin
Feature: 貸出履歴を参照する - 利用者向けフロントエンド

  Scenario: 現在の貸出を残日数つきで描画する
    Given 利用者が /me/loans を開いている
    And GET /api/v1/me/loans?scope=current&page=1 が {items: [{book: {title: "吾輩は猫である"}, dueDate: "2026-09-17", status: "ON_LOAN", remainingDays: 7, dueStatus: "OK"}, {book: {title: "坊っちゃん"}, dueDate: "2026-08-31", status: "OVERDUE", remainingDays: -10, dueStatus: "OVERDUE"}], totalCount: 2, today: "2026-09-10", remindDays: 3} を返す
    When 一覧の取得が完了する
    Then LoanTable に 2 行が表示され「坊っちゃん」の DueDateIndicator が overdue で「10 日超過」と表示される
    And Alert（warning）に「返却期限を過ぎた書籍があります。窓口へご返却ください」が表示される

  Scenario: 履歴に切り替えると返却日列を表示する
    Given 利用者がマイ貸出履歴画面を開いている
    When 「履歴」を選ぶ
    Then GET /api/v1/me/loans?scope=history&page=1 が呼ばれる
    And LoanTable（history）に返却日列が表示され URL クエリが scope=history に更新される

  Scenario: 貸出がないときは空状態を表示する
    Given GET /api/v1/me/loans が {items: [], totalCount: 0} を返す
    When 利用者が /me/loans を開く
    Then EmptyState に「現在借りている書籍はありません」と「蔵書を検索する」ボタンが表示される

  Scenario: 未認証なら IdP ログインへ遷移する
    Given 利用者がログインしていない
    When 利用者が /me/loans を開く
    Then IdP のログイン画面に遷移し、戻り先として /me/loans が保持される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称: P-貸出履歴）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|---------------|-------------------------------------|
| PatronLayout | `@/components/common/PatronLayout` | activeNav = 'myLoans'、requireAuth = true |
| PageHeader | `@/components/common/PageHeader` | title = 「マイ貸出履歴」、notices = ErrorAlert / Alert（warning「返却期限を過ぎた書籍があります。窓口へご返却ください」: overdueCount >= 1） |
| ScopeToggle | `@/components/common/ScopeToggle` | options = [{value:'current', label:「現在の貸出」}, {value:'history', label:「履歴」}]、value = scope、onChange = onScopeChange（page を 1 に戻す）、size = 'md'、ariaLabel = 「表示範囲」 |
| PaginatedListFrame | `@/components/common/PaginatedListFrame` | filter = ScopeToggle、page = page、totalCount = totalCount、onPageChange = onPageChange、loading / error / empty / onRetry = onRetry、skeleton = { variant:'table' }、emptyState = { title: scope === 'current' ? 「現在借りている書籍はありません」 : 「貸出履歴はありません」, action: { label: 「蔵書を検索する」, onClick: → `/books` } }、children = LoanTable（variant = scope, showUser = false） |
| AsyncStateView | `@/components/common/AsyncStateView` | PaginatedListFrame 内部で利用 |
| ErrorAlert | `@/components/common/ErrorAlert` | error = 正規化済み error（「貸出履歴を取得できませんでした」）、onRetry = onRetry、audience = 'patron'（403 → 「この画面は利用者向けです」） |

使用する共通 hooks:

- `useUrlQueryState`（`@/components/common/hooks/useUrlQueryState`）: scope / page ⇄ URL クエリ（不正値は current / 1 に補正）
- `useDelayedLoading`: AsyncStateView 内部（0.4 秒遅延 Skeleton）
