# 司書向けに蔵書を検索する - 司書ポータル仕様

## 変更概要

司書ポータル（tier-frontend-staff）にレファレンス検索画面（`/staff/books/reference-search`）を実装する。利用者向けと同一の検索条件（書籍検索条件）を指定し、結果を表形式で一度に多く見せる。窓口対応中の使用を想定し、検索条件と結果を状態管理層で保持する。

## 画面仕様

### レファレンス検索画面

- **URL**: `/staff/books/reference-search`
- **アクセス権**: 司書（館内ネットワークからのアクセスに限定される。NFR E.5.3.1）
- **ポータル**: `staff`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインコンテンツ。一覧はフル幅で表示する |
| 検索フィルター | フォーム | `BookSearchFilter` | 検索条件種別（単一）・ジャンル（複数）・資料種別（複数）・在庫ありのみ。結果件数を表示する |
| 検索結果 | テーブル | `Table` | 司書向けの一覧は項目比較が目的のため `BookCard` ではなく `Table` を使う |
| 在庫状況 | バッジ | `BookStatusBadge` | 在庫あり / 貸出中 / 予約待ち。`dot` と文言を併記する |
| ページ送り | ナビゲーション | `Pagination`（`default` / `single-page`） | 20 件/頁。無限スクロールは使わない |
| 0 件表示 | 空状態 | `EmptyState`（`with-action`） | 「条件に一致する蔵書がありません」と条件変更の導線 |
| 読み込み中 | ローディング | `Skeleton`（`table`） | 取得中に表示する |
| 検索エラー | メッセージ | `Alert`（`destructive`） | 再試行ボタンを同じ位置に置く |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--background)` | `var(--color-white)` |
| 本文色 | `var(--foreground)` | `var(--color-gray-900)` |
| アクセント | `var(--primary)` | `var(--color-teal-700)`（#0F766E） |
| テーブルヘッダ背景 | `var(--table-header-bg)` | `var(--color-gray-50)` |
| 行ホバー | `var(--table-row-hover-bg)` | `var(--hover-muted)` |
| 在庫ありバッジ | `var(--success)` | `var(--color-green-600)` |
| 貸出中バッジ | `var(--info)` | `var(--color-blue-600)` |
| 予約待ちバッジ | `var(--warning)` | `var(--color-amber-600)` |

#### UIロジック

- **状態管理**: 検索条件（search_type / q / genre[] / material_type[] / available_only / page）と結果・総件数を状態管理層で保持し、ルーティングのクエリパラメータと同期する。窓口対応中に他画面へ移動して戻っても直前の検索条件を再現できる
- **既定値**: 検索条件種別は「キーワード」を初期選択にする（デフォルト効果）
- **バリデーション**: 検索語は 1〜100 文字。検索条件種別「ISBN」を選んだ場合は 13 桁または 10 桁の形式チェックを行う。空のときは検索ボタンを `disabled` にする
- **ローディング**: 取得中は `Skeleton(table)` を表示する。結果件数は `aria-live="polite"` で通知する
- **エラーハンドリング**: 400 は入力欄にエラー、401 は再ログイン導線、403 は「この操作の権限がありません」、5xx は `Alert(destructive)` + 再試行ボタンを表示する
- **一覧の必須 3 状態**: `Skeleton` / `EmptyState` / `Alert(destructive)` を必ず実装する
- **タブレット対応**: 館内タブレットでの窓口業務を想定し、`md` ではサイドバーを `collapsed` にして表の表示幅を確保する。`sm` 未満は表を横スクロールにする
- **ポータル分離**: 利用者ポータルの画面へはリンクしない（NFR E.5.3.1 / ux-design.md の遷移ルール）

#### 操作フロー

1. 司書がサイドバーの「蔵書管理」からレファレンス検索画面を開く
2. 利用者の問合せ内容に応じて検索条件種別を選び、検索語を入力する
3. 必要に応じてジャンル・資料種別・在庫ありのみを指定する
4. 検索ボタンを押すと `GET /api/v1/books/search` を実行し、`Skeleton(table)` を表示する
5. 結果を表に描画し、在庫状況バッジで貸出可否をその場で読み取る
6. ページャで結果を送りながら利用者へ案内する

## コンポーネント設計

### ReferenceSearchFilter

- **ベースコンポーネント**: `BookSearchFilter`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | BookSearchQuery | Yes | search_type / q / genre[] / material_type[] / available_only |
  | onChange | (q: BookSearchQuery) => void | Yes | 条件変更ハンドラ |
  | onSubmit | () => void | Yes | 検索実行 |
  | resultCount | number | No | 結果件数の表示 |
- **状態**: 詳細条件の折りたたみ開閉状態
- **イベント**: onChange、onSubmit、onReset

### ReferenceResultTable

- **ベースコンポーネント**: `Table`（UI） + `BookStatusBadge`（Domain） + `EmptyState`（UI） + `Skeleton`（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | items | BookSearchResultItem[] | Yes | 検索結果（最大 20 件） |
  | loading | boolean | Yes | true のとき `Skeleton(table)` を表示する |
  | error | string \| null | Yes | 検索エラーメッセージ |
  | onSelect | (bookId: string) => void | No | 行選択のハンドラ |
- **状態**: なし（表示専用）
- **イベント**: onSelect

## ティア完了条件（BDD）

```gherkin
Feature: 司書向けに蔵書を検索する - 司書ポータル

  Scenario: 検索結果を表形式で表示する
    Given API が 3 件の検索結果と total=3 を返す状態である
    When 司書がレファレンス検索画面で検索条件種別「著者」に「夏目漱石」を入力して検索する
    Then 表に 3 行が表示され、各行に在庫状況バッジが文言つきで表示される

  Scenario: 検索条件を保持して戻る
    Given 司書が検索条件種別「著者」・検索語「夏目漱石」で検索した結果を見ている
    When 司書が別画面へ移動してからブラウザバックで戻る
    Then 検索条件種別「著者」・検索語「夏目漱石」と直前の検索結果が再現される

  Scenario: 0件のとき EmptyState を表示する
    Given API が items=[] , total=0 を返す状態である
    When 司書が検索語「存在しない書名」で検索する
    Then 「条件に一致する蔵書がありません」と条件変更を促す導線が表示される

  Scenario: 検索失敗時に再試行できる
    Given API が HTTP 500 を返す状態である
    When 司書が検索語「漱石」で検索する
    Then Alert(destructive) に「検索できませんでした」と再試行ボタンが表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | ReferenceResultTable の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（ReferenceResultTable（`Table`） + `Pagination` 20 件/頁） |
| `FilterPanel` | `@/components/common/FilterPanel` | ReferenceSearchFilter（`BookSearchFilter`） の内側で使う（置き換えない） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← ReferenceResultTable の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"table"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← ReferenceSearchFilter（`BookSearchFilter`） / `table` ← ReferenceResultTable（`Table`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |
| `FilterPanel` | `fields` ← 検索条件種別（single）/ 検索語（text）/ ジャンル（multi）/ 資料種別（multi） / `onChange` `onSubmit` `onReset` ← ReferenceSearchFilter（`BookSearchFilter`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useListQueryState` | `@/components/common/hooks/useListQueryState` | 検索条件・ページをルーティングのクエリパラメータと同期する（画面をまたぐ共有状態を持たない / arch LR-026） |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
