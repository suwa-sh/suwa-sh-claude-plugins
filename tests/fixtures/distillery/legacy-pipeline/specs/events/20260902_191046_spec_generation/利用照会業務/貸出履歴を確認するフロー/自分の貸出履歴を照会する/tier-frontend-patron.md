# 自分の貸出履歴を照会する - 利用者ポータル仕様

## 変更概要

利用者ポータル（`tier-frontend-patron`）に貸出履歴画面を追加する。返却済みの貸出を `LoanTable` で一覧し、`Pagination`（20 件/頁）で分割する。返却済みのみを扱う旨を空状態のメッセージで明示し、現在の貸出との混同を防ぐ。

## 画面仕様

### 貸出履歴画面

- **ルート id**: `patron-loan-history`
- **URL**: `/loans/history`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 利用者（ログイン中の本人のみ。参照対象は認証コンテキストの利用者番号に固定される）
- **ポータル**: `patron`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`patron`） | サイドバー「貸出」を選択状態にする |
| 履歴一覧 | テーブル | `LoanTable` | `showUser` は false。書籍タイトル・貸出日・返却期限・返却日を表示する。日付の列は `YYYY/MM/DD`（例 `2026/08/14`） |
| ページング | ナビゲーション | `Pagination`（`default` / `single-page`） | 20 件/頁。無限スクロールは使わない |
| 0 件表示 | 空状態 | `EmptyState`（`default`） | 「返却済みの貸出はまだありません」＋現在の貸出との違いを説明する |
| 読み込み中 | プレースホルダ | `LoadingState`（`kind="list"` / `label="貸出履歴を読み込み中"`） | loading 表現の唯一の入口。応答が 0.4 秒を超える可能性があるため表示する |
| 取得失敗 | メッセージ | `Alert`（`destructive`） | 平易な日本語。内部情報は出さない（LR-027） |
| 現在の貸出への導線 | ボタン | `Button`（`outline`） | `useAppNavigation().navigate("patron-loan-list")` で現在の貸出一覧画面へ遷移（表示 URL: `/loans`） |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 本文色 | `var(--semantic-foreground)` | `var(--color-gray-900)` |
| ポータルアクセント | `var(--primary)` | `var(--color-blue-700)`（`#1D4ED8`） |
| テーブルヘッダー背景 | `var(--table-header-bg)` | `var(--color-gray-50)` |
| セル余白 | `var(--table-cell-padding-x)` / `var(--table-cell-padding-y)` | `var(--spacing-4)` / `var(--spacing-3)` |
| 中立表示（返却済み） | `var(--semantic-neutral)` | `var(--color-gray-500)` |
| ページ余白 | `var(--page-padding)` | `var(--spacing-6)` |

#### UIロジック

- **状態管理**: 画面ローカルに保持する（LR-026）。頁番号はルーティングのクエリパラメータで表現し、ブラウザバックで前頁へ戻れるようにする。
- **バリデーション**: 入力項目が無いため画面側のバリデーションは行わない（照会のみ）。
- **ローディング**: 取得中と頁切替時は `AsyncSection` 経由で `LoadingState`（`kind="list"` / `label="貸出履歴を読み込み中"`）を表示する。画面側で `Skeleton` / `Spinner` を直接使わず、`animate-pulse` 等の独自 loading 表現も持たない。
- **エラーハンドリング**: API クライアント層が分類したエラーを受け取り（CLP-012）、`Alert(destructive)` に平易なメッセージと再試行を表示する。401 はログイン画面へ誘導する。
- **本人限定参照の UI 制約**: `LoanTable` の `showUser` を false に固定し、利用者番号を入力・指定する導線を持たない（LP-025）。
- **表示の区別**: 履歴は返却済みのみを扱う。空状態のメッセージで「現在借りている書籍は『貸出』から確認できます」と案内し、`useAppNavigation().navigate("patron-loan-list")` で現在の貸出一覧画面への導線を出す。
- **日付の表示**: `ui-design.md`「日付・期限の表示規約」に従う。API 上は ISO 8601 `YYYY-MM-DD`（例 `2026-08-14`）、画面の一覧列は `YYYY/MM/DD`（例 `2026/08/14`）、一覧列以外の画面表示は `YYYY年M月D日`（例 `2026年8月14日`）とする。
- **アクセシビリティ**: 表に `caption`「貸出履歴」と `th scope="col"` を付与する。件数更新は `aria-live="polite"`。日付の書式化は上記「日付の表示」に従う。
- **PII 非保存**: 取得した履歴をローカルストレージ等へ保存しない（CLR-008）。

#### 操作フロー

1. 利用者がサイドバー「貸出」→「貸出履歴」を開く。
2. API クライアント層が `GET /api/v1/me/loans?status=history&page=1&per_page=20`（`listMyLoans` / 所有 UC: 自分の現在の貸出を照会する。`consumes:` 参照）を要求する。
3. 取得中は `LoadingState`（`kind="list"`）を表示し、完了後に `LoanTable` を描画する。
4. 0 件のときは `EmptyState` に返却済みのみを扱う旨と現在の貸出への導線（`useAppNavigation().navigate("patron-loan-list")`）を出す。
5. 利用者が `Pagination` で頁を切り替えると当該頁を再取得する。

## コンポーネント設計

### LoanTable（貸出履歴画面での利用）

- **ベースコンポーネント**: `LoanTable`（domain コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | MyLoanHistoryItem[] | Yes | 貸出ID・書籍タイトル・著者・貸出日・返却期限・返却日・貸出期間区分 |
  | loading | boolean | Yes | 取得中は `AsyncSection` 経由で `LoadingState`（`kind="list"`）を表示する |
  | error | string \| null | No | 取得失敗時のメッセージ |
  | showUser | boolean | Yes | 常に false（本人限定参照） |
  | emptyMessage | string | No | 「返却済みの貸出はまだありません」 |
- **状態**: `default` / `loading` / `empty` / `error`
- **イベント**: なし（履歴行からの操作導線は持たない）

### Pagination（貸出履歴画面での利用）

- **ベースコンポーネント**: `Pagination`（UI コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | page | number | Yes | 現在頁 |
  | perPage | number | Yes | 20 固定 |
  | total | number | Yes | 総件数 |
  | onChange | (page: number) => void | Yes | 頁切替でクエリパラメータを更新し再取得する |
- **状態**: `default` / `single-page`（総頁数が 1 のとき）
- **イベント**: `onChange`

## ティア完了条件（BDD）

```gherkin
Feature: 自分の貸出履歴を照会する - 利用者ポータル

  Scenario: 返却済みの行が描画される
    Given バックエンド API が貸出「坊っちゃん / 貸出日 2026-08-01 / 返却日 2026-08-14」（ISO 8601）を返すようスタブされている
    When 利用者が貸出履歴画面（/loans/history）を表示する
    Then LoanTable に「坊っちゃん」の行が表示される
    And 返却日の列に「2026/08/14」が表示される

  Scenario: 利用者列を表示しない
    Given バックエンド API が本人の返却済み貸出 2 件を返すようスタブされている
    When 利用者が貸出履歴画面を表示する
    Then LoanTable に利用者名の列が存在しない

  Scenario: 20 件/頁で分割される
    Given バックエンド API が total 25・1 頁目 20 件を返すようスタブされている
    When 利用者が貸出履歴画面を表示する
    Then LoanTable に 20 行が描画される
    And Pagination に「1 / 2」が表示される

  Scenario: 頁切替でクエリパラメータが更新される
    Given 利用者が貸出履歴画面の 1 頁目を表示している
    When 利用者が Pagination の 2 頁目を選択する
    Then GET /api/v1/me/loans?status=history&page=2&per_page=20 が呼ばれる
    And URL のクエリパラメータが page=2 になる

  Scenario: 0 件のとき現在の貸出との違いを案内する
    Given バックエンド API が items 0 件を返すようスタブされている
    When 利用者が貸出履歴画面を表示する
    Then EmptyState に「返却済みの貸出はまだありません」が表示される
    And 現在の貸出一覧画面（/loans）への導線が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（現在の貸出一覧画面へ） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（`kind="list"`）。`AsyncSection` の `skeleton` prop 経由で間接利用する |
| `AsyncSection` | `@/components/common/AsyncSection` | LoanTable（貸出履歴） の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（LoanTable（Domain） + `Pagination` 20 件/頁） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"list"`（一覧・テーブルの取得） / `label` ← `"貸出履歴を読み込み中"` / `rows` ← `per_page`（20） |
| `AsyncSection` | `loading` ← LoanTable（貸出履歴） の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"list"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"貸出履歴を読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← なし / `table` ← LoanTable（Domain） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useListQueryState` | `@/components/common/hooks/useListQueryState` | 検索条件・ページをルーティングのクエリパラメータと同期する（画面をまたぐ共有状態を持たない / arch LR-026） |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
