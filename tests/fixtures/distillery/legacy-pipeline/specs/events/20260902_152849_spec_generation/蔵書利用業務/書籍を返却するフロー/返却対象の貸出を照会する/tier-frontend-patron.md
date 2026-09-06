# 返却対象の貸出を照会する - 利用者ポータル仕様

## 変更概要

返却対象貸出確認画面（`/loans/return`）を追加する。ログイン中の利用者本人の貸出中・延滞の貸出を返却期限の昇順で一覧表示し、窓口で提示する対象を特定できるようにする。一覧は LoanTable の 4 状態（default / loading / empty / error）を実装し、Pagination（20 件/頁）で分割する。

## 画面仕様

### 返却対象貸出確認画面

- **URL**: `/loans/return`
- **アクセス権**: 利用者（ログイン済み。本人に紐づく貸出のみ）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | PortalShell（variant: patron） | 利用者ポータル共通レイアウト |
| 返却対象の貸出一覧 | テーブル | LoanTable（states: default / loading / empty / error） | 書籍タイトル・返却期限・残日数・貸出状態。`showUser` は false（本人のみのため） |
| 返却期限の視覚化 | 期限表示 | DueDateIndicator（variant: safe / near / due-today / overdue, size: sm） | 各行に残日数・超過日数を数値と文言で表示 |
| 貸出状態の表示 | バッジ | LoanStatusBadge | 貸出中 / 延滞 を dot + 文言で各行に表示 |
| 窓口提示への導線 | ボタン | Button（variant: outline, size: sm） | 各行から利用者番号提示画面（/mypage/card）へ遷移する副次操作 |
| 0 件の表示 | 空状態 | EmptyState（variant: with-action） | 「返却対象の貸出はありません」と蔵書検索画面への導線 |
| 取得中表示 | ローディング | Skeleton（variant: table） | LoanTable の loading 状態で表示 |
| 取得失敗表示 | エラー | Alert（variant: destructive） | LoanTable の error 状態で表示 |
| ページ送り | ページャ | Pagination（variant: default / single-page） | 20 件/頁で分割。無限スクロールは使わない |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | var(--color-white) |
| アクセント | var(--portal-primary) → var(--semantic-primary_patron) | var(--color-blue-700) |
| テーブルヘッダ | var(--component-table-header_bg) / var(--component-table-header_foreground) | var(--color-gray-50) / var(--foreground-secondary) |
| 行ホバー | var(--component-table-row_hover_bg) | var(--hover-muted) |
| 返却期限（余裕あり / 期限接近 / 超過） | var(--component-duedate-safe_color) / var(--component-duedate-near_color) / var(--component-duedate-over_color) | var(--success) / var(--pending) / var(--destructive) |
| 貸出状態（貸出中 / 延滞） | var(--semantic-info) / var(--semantic-destructive) | var(--color-blue-600) / var(--color-red-600) |
| 余白 | var(--spacing-page_padding) / var(--spacing-section_gap) | var(--spacing-6) / var(--spacing-8) |

#### UIロジック

- **状態管理**: 画面ローカルに保持する（LR-026）。ページ番号はルーティングのクエリパラメータ（`?page=`）で表現し、共有状態を持たない。
- **バリデーション**: 入力項目を持たない画面のため、フロントエンドバリデーションは行わない。ページ番号が不正な場合は 1 ページ目にフォールバックする。
- **ローディング**: 取得中は LoanTable の `loading` 状態（Skeleton table）を表示し、レイアウトシフトを避ける。
- **エラーハンドリング**: api client 層で分類されたエラーを view 層で平易なメッセージへ変換する（LR-027 / CLP-012）。401 は再ログイン誘導、通信エラーは LoanTable の `error` 状態で Alert(destructive) と再試行導線を表示する。
- **本人限定参照の UI 制約**: 利用者番号を指定して他人の貸出を検索する導線を持たない（LP-025）。API は常に `/api/v1/me/loans` を呼ぶ。
- **PII の非永続化**: 貸出一覧・書籍情報をブラウザの永続ストレージへ保存しない（CLR-008）。
- **日付書式**: 返却期限は `toLocaleDateString('ja-JP')` で書式化する（arch SR-004）。
- **アクセシビリティ**: テーブルに `caption` と `th scope` を付与する。DueDateIndicator は色に加えて残日数・超過日数を文言で示す。一覧件数の更新は `aria-live="polite"` で通知する。

#### 操作フロー

1. 利用者がサイドバーの「蔵書利用業務」→「返却対象を確認」を選択する。
2. api client が `GET /api/v1/me/loans?returnable=true&page=1&per_page=20` を呼び出す（trace_id 付与）。
3. 取得中は LoanTable の loading 状態を表示する。
4. 取得成功かつ 1 件以上のとき、返却期限の昇順で一覧を表示する。超過している貸出が先頭に来る。
5. 取得成功かつ 0 件のとき、EmptyState に「返却対象の貸出はありません」と蔵書検索への導線を表示する。
6. 利用者が返却対象を確認し、必要に応じて利用者番号提示画面へ遷移して窓口で提示する。返却登録は司書ポータルで行う。

## コンポーネント設計

### ReturnableLoanList

- **ベースコンポーネント**: LoanTable（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | Array<{ loanId: string; book: { title: string; author: string }; dueDate: string; daysRemaining: number; loanStatus: string; loanPeriodType: string }> | Yes | 返却対象の貸出一覧。返却期限の昇順 |
  | loading | boolean | Yes | true のとき LoanTable の loading 状態（Skeleton table）を表示 |
  | error | string \| null | Yes | エラーメッセージ。非 null のとき error 状態を表示 |
  | showUser | boolean | Yes | 常に false（本人の貸出のみを表示するため） |
  | emptyMessage | string | Yes | 「返却対象の貸出はありません」 |
  | actionsFor | (loan) => ReactNode | No | 各行の副次操作（利用者番号提示画面への導線） |
- **状態**: LoanTable の 4 状態（default / loading / empty / error）
- **イベント**: `onSelect`（貸出内容・返却期限確認画面への遷移）

### ReturnDueCell

- **ベースコンポーネント**: DueDateIndicator（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | dueDate | string(date) | Yes | 返却期限 |
  | today | string(date) | Yes | 本日日付 |
  | state | "safe" \| "near" \| "due-today" \| "overdue" | Yes | 残日数から決まる表示段階 |
  | size | "sm" | Yes | 一覧内表示のため sm を使う |
- **状態**: なし（表示専用）
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 返却対象の貸出を照会する - 利用者ポータル

  Scenario: 返却対象が返却期限の昇順で表示される
    Given 利用者「田中太郎」がログイン済みで、本日が 2026-09-02 である
    And API が貸出「L-000003」（返却期限 2026-08-30、残日数 -3）と貸出「L-000001」（返却期限 2026-09-16、残日数 14）を返す
    When 利用者が返却対象貸出確認画面（/loans/return）を開く
    Then LoanTable の 1 行目に "L-000003" が DueDateIndicator(overdue)「3 日超過」で表示される
    And 2 行目に "L-000001" が DueDateIndicator(safe)「あと 14 日」で表示される

  Scenario: 取得中は LoanTable の loading 状態を表示する
    Given 利用者「田中太郎」がログイン済み
    When 返却対象貸出確認画面を開き、API 応答が 0.4 秒以上かかる
    Then LoanTable が loading 状態になり Skeleton(table) が表示される

  Scenario: 0 件のとき EmptyState と次の行動導線を表示する
    Given 利用者「田中太郎」がログイン済み
    And API が items 0 件を返す
    When 利用者が返却対象貸出確認画面を開く
    Then EmptyState(with-action) に「返却対象の貸出はありません」が表示される
    And 蔵書検索画面（/search）への導線が表示される

  Scenario: 取得に失敗したら error 状態と再試行導線を表示する
    Given バックエンド API が 500 を返す状態である
    When 利用者が返却対象貸出確認画面を開く
    Then LoanTable が error 状態になり Alert(destructive) が表示される
    And 再試行の導線が表示される

  Scenario: 21 件以上の返却対象は Pagination で分割表示する
    Given 利用者「田中太郎」に返却対象の貸出が 25 件存在する
    When 利用者が返却対象貸出確認画面を開く
    Then 1 ページ目に 20 件が表示され、Pagination に 2 ページ分が表示される
    And 無限スクロールは行われない
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | ReturnableLoanList の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（ReturnableLoanList（`LoanTable`） + `Pagination` 20 件/頁） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← ReturnableLoanList の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"table"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← なし / `table` ← ReturnableLoanList（`LoanTable`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useListQueryState` | `@/components/common/hooks/useListQueryState` | 検索条件・ページをルーティングのクエリパラメータと同期する（画面をまたぐ共有状態を持たない / arch LR-026） |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
