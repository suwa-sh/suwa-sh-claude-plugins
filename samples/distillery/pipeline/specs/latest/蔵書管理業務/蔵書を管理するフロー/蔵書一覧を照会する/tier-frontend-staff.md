# 蔵書一覧を照会する - 司書ポータル仕様

## 変更概要

司書ポータル（tier-frontend-staff）に蔵書管理台帳画面（`/staff/books`）を実装し、蔵書一覧の取得・絞り込み・ページ送りと書籍状態の表示を行う。ビュー層 → 状態管理層 → API クライアント層の 3 レイヤーで構成する。

## 画面仕様

### 蔵書管理台帳画面

- **ルート id**: `staff-book-list`
- **URL**: `/staff/books`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（利用者アカウントの役割が「司書」のトークンを持つ場合のみ表示。実際の制御は API Gateway の粗粒度 RBAC と Backend API の認可判定）
- **ポータル**: `staff`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインコンテンツ |
| 絞り込みフィルター | フォーム | `BookSearchFilter` | 検索キーワード・ジャンル（複数）・資料種別（複数）を ToggleGroup で指定する |
| 蔵書一覧 | テーブル | `Table` | 台帳は項目比較が目的のため `BookCard` ではなく `Table` を使う（ui-design.md のコンポーネント選定ルール） |
| 書籍状態 | バッジ | `BookStatusBadge` | 在庫あり / 貸出中 / 予約待ち。`dot` と文言を必ず併記する |
| ページ送り | ナビゲーション | `Pagination`（`default` / `single-page`） | 20 件/頁。無限スクロールは使わない |
| 0 件表示 | 空状態 | `EmptyState`（`with-action`） | 「条件に一致する蔵書がありません」と絞り込み解除の導線 |
| 読み込み中 | ローディング | `LoadingState`（`kind="list"`, `label="蔵書一覧を読み込み中"`） | loading 表現の唯一の入口。画面側で `Skeleton` / `Spinner` を直接使わない |
| 取得エラー | メッセージ | `Alert`（`destructive`） | 再試行ボタンを同じ位置に置く |
| 新規登録導線 | ボタン | `Button`（`default`） | `useAppNavigation().navigate("staff-book-new")` で書籍受入登録画面（`/staff/books/new`）へ遷移する |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--background)` | `var(--color-white)` |
| 本文色 | `var(--foreground)` | `var(--color-gray-900)` |
| アクセント | `var(--primary)` | `var(--color-teal-700)`（#0F766E） |
| 在庫ありバッジ | `var(--success)` | `var(--color-green-600)` |
| 貸出中バッジ | `var(--info)` | `var(--color-blue-600)` |
| 予約待ちバッジ | `var(--warning)` | `var(--color-amber-600)` |
| テーブルヘッダ背景 | `var(--table-header-bg)` | `var(--color-gray-50)` |
| 余白 | `var(--page-padding)` / `var(--section-gap)` | `var(--spacing-6)` / `var(--spacing-8)` |

#### UIロジック

- **状態管理**: 検索条件（keyword / genre[] / material_type[] / book_status[]）とページ番号を状態管理層で保持し、ルーティングのクエリパラメータと同期する。ブラウザバックで直前の絞り込み条件へ戻れる
- **バリデーション**: ジャンル・資料種別・書籍状態は RDRA バリエーション・状態モデルの値のみを選択肢とし、自由入力を許さない。キーワードは 100 文字以内に制限する
- **ローディング**: 取得中は `LoadingState`（`kind="list"` / `label="蔵書一覧を読み込み中"`）を `AsyncSection` 経由で表示してレイアウトシフトを避ける。総件数の更新は `aria-live="polite"` で通知する
- **エラーハンドリング**: 401 は再ログイン導線、403 は「この操作の権限がありません」、5xx は `Alert(destructive)` + 再試行ボタンを表示する。個票データはエラー時に描画しない
- **一覧の必須 3 状態**: `LoadingState` / `EmptyState` / `Alert(destructive)` を必ず実装する（`AsyncSection` が 3 状態の順序と位置を強制する）

#### 操作フロー

1. 司書がサイドバーの「蔵書管理」から蔵書管理台帳画面を開く
2. 画面初期化時に `GET /api/v1/books?page=1&per_page=20` を実行し、`LoadingState`（`kind="list"`）を表示する
3. 応答を受けてテーブル・総件数・`Pagination` を描画する
4. 司書が `BookSearchFilter` で条件を変更すると page を 1 に戻して再取得する
5. 司書が `Pagination` でページを切り替えると page のみ変更して再取得する
6. 行の「編集」「除籍」から `useAppNavigation().navigate("staff-book-edit")` / `useAppNavigation().navigate("staff-book-withdraw")` で書誌情報訂正画面（`/staff/books/{book_id}/edit`）・除籍手続画面（`/staff/books/{book_id}/withdraw`）へ遷移する（パスは `buildPath` で組み立てる）

## コンポーネント設計

### BookLedgerTable

- **ベースコンポーネント**: `Table`（UI） + `BookStatusBadge`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | books | BookSummary[] | Yes | 表示する書籍一覧（最大 20 件） |
  | loading | boolean | Yes | true のとき `AsyncSection` 経由で `LoadingState`（`kind="list"`）を表示する |
  | error | string \| null | Yes | 取得エラーメッセージ |
  | onSelect | (bookId: string) => void | No | 行選択時のハンドラ |
- **状態**: なし（表示専用。データは状態管理層が保持する）
- **イベント**: onSelect（行クリック）、onEdit / onWithdraw（行内アクション）

### BookLedgerFilter

- **ベースコンポーネント**: `BookSearchFilter`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | BookLedgerQuery | Yes | keyword / genre[] / material_type[] / book_status[] |
  | onChange | (q: BookLedgerQuery) => void | Yes | 条件変更ハンドラ |
  | onSubmit | () => void | Yes | 絞り込み実行 |
  | resultCount | number | No | 総件数の表示 |
- **状態**: 詳細条件（ジャンル・資料種別）の折りたたみ開閉状態
- **イベント**: onChange, onSubmit, onReset

## ティア完了条件（BDD）

```gherkin
Feature: 蔵書一覧を照会する - 司書ポータル

  Scenario: 蔵書一覧を表形式で表示する
    Given API が「吾輩は猫である」（book_status=在庫あり）を含む 2 件を返す状態である
    When 司書が蔵書管理台帳画面（/staff/books）を開く
    Then 表に 2 行が表示され、「吾輩は猫である」の行に「在庫あり」バッジが緑のドットと文言つきで表示される

  Scenario: 取得中はローディング表示になる
    Given 蔵書一覧の取得応答が 1 秒遅延する状態である
    When 司書が蔵書管理台帳画面を開く
    Then 表の領域に LoadingState(kind="list", label="蔵書一覧を読み込み中") が表示され、応答後に表へ置き換わる

  Scenario: 0件のとき EmptyState を表示する
    Given API が items=[] , total=0 を返す状態である
    When 司書がジャンル「児童」で絞り込む
    Then 「条件に一致する蔵書がありません」と絞り込み解除ボタンが表示される

  Scenario: 取得失敗時に再試行できる
    Given API が HTTP 500 を返す状態である
    When 司書が蔵書管理台帳画面を開く
    Then Alert(destructive) に「蔵書一覧を取得できませんでした」と再試行ボタンが表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（`staff-book-new` / `staff-book-edit` / `staff-book-withdraw`） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（`kind="list"`）。`AsyncSection` の `skeleton` prop 経由で間接利用する |
| `AsyncSection` | `@/components/common/AsyncSection` | BookLedgerTable の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（BookLedgerTable（`Table`） + `Pagination` 20 件/頁） |
| `FilterPanel` | `@/components/common/FilterPanel` | BookLedgerFilter（`BookSearchFilter`） の内側で使う（置き換えない） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"list"`（蔵書一覧テーブルの取得） / `label` ← `"蔵書一覧を読み込み中"` / `rows` ← `per_page`（20） |
| `AsyncSection` | `loading` ← BookLedgerTable の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"list"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"蔵書一覧を読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← BookLedgerFilter（`BookSearchFilter`） / `table` ← BookLedgerTable（`Table`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |
| `FilterPanel` | `fields` ← 検索キーワード（text）/ ジャンル（multi）/ 資料種別（multi） / `onChange` `onSubmit` `onReset` ← BookLedgerFilter（`BookSearchFilter`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useListQueryState` | `@/components/common/hooks/useListQueryState` | 検索条件・ページをルーティングのクエリパラメータと同期する（画面をまたぐ共有状態を持たない / arch LR-026） |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけ
- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
