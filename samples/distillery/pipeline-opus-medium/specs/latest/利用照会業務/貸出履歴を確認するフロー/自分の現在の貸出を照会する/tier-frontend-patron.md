# 自分の現在の貸出を照会する - 利用者ポータル仕様

## 変更概要

利用者ポータル（`tier-frontend-patron`）に現在の貸出一覧画面を追加する。貸出中・延滞の貸出を `LoanTable` で一覧し、返却期限を `DueDateIndicator` で残日数・超過日数とともに提示する。他利用者の貸出へ到達する導線は置かない（LP-025）。

## 画面仕様

### 現在の貸出一覧画面

- **ルート id**: `patron-loan-list`
- **URL**: `/loans`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 利用者（ログイン中の本人のみ。参照対象は認証コンテキストの利用者番号に固定される）
- **ポータル**: `patron`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`patron`） | サイドバー「貸出」を選択状態にする |
| 貸出一覧 | テーブル | `LoanTable` | `showUser` は false。書籍タイトル・貸出日・返却期限・貸出状態を表示する。日付の列は `YYYY/MM/DD`（例 `2026/09/16`） |
| 貸出状態 | バッジ | `LoanStatusBadge` | 貸出中（`info`） / 延滞（`destructive`）。文言を必ず併記する |
| 返却期限 | インジケータ | `DueDateIndicator`（`safe` / `near` / `due-today` / `overdue`） | 日付（列は `YYYY/MM/DD`）と残日数を必ず併記する。文言は `あと{N}日` / `本日が返却期限` / `{N}日超過`（`ui-design.md`「日付・期限の表示規約」が正本） |
| 0 件表示 | 空状態 | `EmptyState`（`with-action`） | 「現在借りている書籍はありません」＋蔵書検索への導線（`useAppNavigation().navigate("patron-book-search")` / 表示 URL: `/search`） |
| 読み込み中 | プレースホルダ | `LoadingState`（`kind="list"` / `label="現在の貸出を読み込み中"`） | loading 表現の唯一の入口。応答が 0.4 秒を超える可能性があるため表示する |
| 取得失敗 | メッセージ | `Alert`（`destructive`） | 平易な日本語。内部情報は出さない（LR-027） |
| 詳細への導線 | 行操作 | `LoanTable` の `onSelect` | `useAppNavigation().navigate("patron-loan-detail", { loanId })` で貸出内容・返却期限確認画面へ遷移（表示 URL: `/loans/:loanId`） |
| 頁送り | ページネーション | `Pagination`（`default` / `single-page`） | 20 件/頁。21 件以上のときに頁を切り替える。無限スクロールは使わない |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| ポータルアクセント | `var(--primary)` | `var(--color-blue-700)`（`#1D4ED8`） |
| 貸出中バッジ | `var(--semantic-info)` | `var(--color-blue-600)` |
| 延滞バッジ | `var(--semantic-destructive)` | `var(--color-red-600)` |
| 返却期限（余裕あり） | `var(--duedate-safe-color)` | design tokens の `duedate.safe_color` |
| 返却期限（超過） | `var(--duedate-over-color)` | design tokens の `duedate.over_color` |
| テーブルヘッダー背景 | `var(--table-header-bg)` | `var(--color-gray-50)` |
| ページ余白 | `var(--page-padding)` | `var(--spacing-6)` |

#### UIロジック

- **状態管理**: 画面ローカルに保持する（LR-026）。画面をまたいで共有するのは認証情報のみで、貸出一覧は再取得で表現する。
- **バリデーション**: 入力項目が無いため画面側のバリデーションは行わない（照会のみ）。
- **ローディング**: 取得中は `AsyncSection` 経由で `LoadingState`（`kind="list"` / `label="現在の貸出を読み込み中"`）を表示し、レイアウトシフトを避ける（ドハティの閾値）。画面側で `Skeleton` / `Spinner` を直接使わず、`animate-pulse` 等の独自 loading 表現も持たない。
- **エラーハンドリング**: API クライアント層が分類したエラーを受け取り（CLP-012）、`Alert(destructive)` に平易なメッセージと再試行を表示する。401 はログイン画面へ誘導する。
- **本人限定参照の UI 制約**: `LoanTable` の `showUser` を false に固定し、利用者番号を入力・指定する導線を持たない（LP-025）。
- **表示段階**: `DueDateIndicator` の variant は API が返す `days_remaining` から決める（`safe` / `near` / `due-today` / `overdue`）。色だけで意味を伝えず、残日数・超過日数の文言を必ず添える。
- **日付・期限の表示**: `ui-design.md`「日付・期限の表示規約」に従う。API 上は ISO 8601 `YYYY-MM-DD`（例 `2026-09-16`）、画面の一覧列は `YYYY/MM/DD`（例 `2026/09/16`）、一覧列以外の画面表示は `YYYY年M月D日`（例 `2026年9月16日`）とする。残日数の文言は `あと{N}日`、期限当日は `本日が返却期限`、超過は `{N}日超過` に統一し、「残り N 日」「N 日後」は使わない。
- **アクセシビリティ**: 表に `caption`「現在の貸出」と `th scope="col"` を付与する。件数更新は `aria-live="polite"`。日付の書式化は上記「日付・期限の表示規約」に従う。
- **レスポンシブ**: `md` 以上は通常表示、`sm` 未満は表を横スクロールにする（カード表示への切替は行わない）。

#### 操作フロー

1. 利用者がサイドバー「貸出」から現在の貸出一覧画面を開く。
2. API クライアント層が `GET /api/v1/me/loans?status=current&page=1&per_page=20` を要求する。
3. 取得中は `LoadingState`（`kind="list"`）を表示し、完了後に `LoanTable` を描画する。
4. 0 件のときは `EmptyState` に蔵書検索への導線（`useAppNavigation().navigate("patron-book-search")`）を出す。
5. 利用者が行を選択すると `useAppNavigation().navigate("patron-loan-detail", { loanId })` で貸出内容・返却期限確認画面へ遷移する（表示 URL: `/loans/:loanId`）。
6. 21 件以上ある場合は `Pagination` で頁を切り替える。

## コンポーネント設計

### LoanTable（現在の貸出一覧画面での利用）

- **ベースコンポーネント**: `LoanTable`（domain コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | MyLoanSummary[] | Yes | 貸出ID・書籍タイトル・著者・貸出日・返却期限・貸出状態・残日数 |
  | loading | boolean | Yes | 取得中は `AsyncSection` 経由で `LoadingState`（`kind="list"`）を表示する |
  | error | string \| null | No | 取得失敗時のメッセージ |
  | showUser | boolean | Yes | 常に false（本人限定参照） |
  | emptyMessage | string | No | 「現在借りている書籍はありません」 |
  | onSelect | (loanId: string) => void | No | 貸出内容・返却期限確認画面へ遷移する |
- **状態**: `default` / `loading` / `empty` / `error`
- **イベント**: `onSelect`

### Pagination（現在の貸出一覧画面での利用）

- **ベースコンポーネント**: `Pagination`（UI コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | page | number | Yes | 現在の頁番号（1 始まり） |
  | perPage | number | Yes | 20 件固定 |
  | total | number | Yes | 総件数。`ceil(total / perPage)` が頁数 |
  | onChange | (page: number) => void | Yes | 頁切替。選択頁で一覧を再取得する |
- **状態**: `default` / `single-page`（総件数が 20 件以下のとき）
- **イベント**: `onChange`

### DueDateIndicator（貸出行での利用）

- **ベースコンポーネント**: `DueDateIndicator`（domain コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | dueDate | string(date) | Yes | 返却期限。API 上は ISO 8601 `YYYY-MM-DD`。一覧列の表示は `YYYY/MM/DD` |
  | today | string(date) | Yes | 現在日（ISO 8601 `YYYY-MM-DD`）。残日数の算出基準。文言は `あと{N}日` / `本日が返却期限` / `{N}日超過` |
  | state | "貸出中" \| "延滞" \| "返却済み" | Yes | 貸出状態 |
  | size | "sm" \| "md" | No | 一覧では `sm` |
- **状態**: `safe` / `near` / `due-today` / `overdue` / `returned`
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 自分の現在の貸出を照会する - 利用者ポータル

  Scenario: 貸出中の行が描画される
    Given バックエンド API が貸出「吾輩は猫である / 返却期限 2026-09-16（ISO 8601） / 貸出中 / days_remaining 14」を返すようスタブされている
    When 利用者が現在の貸出一覧画面（/loans）を表示する
    Then LoanTable に「吾輩は猫である」の行が表示される
    And 返却期限の列に「2026/09/16」が表示される
    And DueDateIndicator に「あと14日」が表示される
    And LoanStatusBadge に「貸出中」が表示される

  Scenario: 利用者列を表示しない
    Given バックエンド API が本人の貸出 2 件を返すようスタブされている
    When 利用者が現在の貸出一覧画面を表示する
    Then LoanTable に利用者名の列が存在しない

  Scenario: 超過日数が文言で表示される
    Given バックエンド API が days_remaining -3 の貸出を返すようスタブされている
    When 利用者が現在の貸出一覧画面を表示する
    Then DueDateIndicator が overdue 表示になる
    And 「3日超過」の文言が表示される

  Scenario: 0 件のとき蔵書検索への導線を出す
    Given バックエンド API が items 0 件を返すようスタブされている
    When 利用者が現在の貸出一覧画面を表示する
    Then EmptyState に「現在借りている書籍はありません」が表示される
    And 蔵書検索（/search）への導線が表示される

  Scenario: 取得中は LoadingState を表示する
    Given バックエンド API の応答が 1 秒遅延するようスタブされている
    When 利用者が現在の貸出一覧画面を表示する
    Then LoadingState(kind="list") が表示される
    And 待機領域に aria-busy="true" が付与される
    And 応答後に LoanTable へ置き換わる
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（貸出内容・返却期限確認画面 / 蔵書検索） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（`kind="list"`）。`AsyncSection` の `skeleton` prop 経由で間接利用する |
| `AsyncSection` | `@/components/common/AsyncSection` | LoanTable（現在の貸出一覧） の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（LoanTable（Domain） + `Pagination` 20 件/頁） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"list"`（一覧・テーブルの取得） / `label` ← `"現在の貸出を読み込み中"` / `rows` ← `per_page`（20） |
| `AsyncSection` | `loading` ← LoanTable（現在の貸出一覧） の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"list"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"現在の貸出を読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← なし / `table` ← LoanTable（Domain） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
