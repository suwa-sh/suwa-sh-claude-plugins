# 自分の返却済み貸出を照会する - 利用者ポータル仕様

## 変更概要

返却完了確認画面（`/loans/returned`）を追加する。ログイン中の利用者本人の返却済み貸出を返却日の降順で一覧表示し、返却が完了したことを確認できるようにする。完了サマリ（件数）と次の行動導線を必ず 1 つ提示する（ピーク・エンドの法則）。一覧は Pagination（20 件/頁）で分割する。

## 画面仕様

### 返却完了確認画面

- **URL**: `/loans/returned`
- **アクセス権**: 利用者（ログイン済み。本人に紐づく貸出のみ）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | PortalShell（variant: patron） | 利用者ポータル共通レイアウト |
| 返却完了サマリ | 注意喚起 | Alert（variant: success） | 「返却が完了しています（N 件）」を上部に表示 |
| 返却済み貸出一覧 | テーブル | LoanTable（states: default / loading / empty / error） | 書籍タイトル・貸出日・返却期限・返却日・貸出状態。`showUser` は false |
| 貸出状態バッジ | バッジ | LoanStatusBadge | 「返却済み」を dot + 文言で表示 |
| 0 件の表示 | 空状態 | EmptyState（variant: with-action） | 「返却済みの貸出はありません」と現在の貸出一覧への導線 |
| 取得中表示 | ローディング | Skeleton（variant: table） | LoanTable の loading 状態で表示 |
| 取得失敗表示 | エラー | Alert（variant: destructive） | LoanTable の error 状態で表示 |
| ページ送り | ページャ | Pagination（variant: default / single-page） | 20 件/頁で分割。無限スクロールは使わない |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | var(--color-white) |
| 本文色 | var(--semantic-foreground) | var(--color-gray-900) |
| アクセント | var(--portal-primary) → var(--semantic-primary_patron) | var(--color-blue-700) |
| 完了サマリ | var(--semantic-success) | var(--color-green-600) |
| 貸出状態（返却済み） | var(--semantic-neutral) | var(--color-gray-500) |
| テーブルヘッダ | var(--component-table-header_bg) / var(--component-table-header_foreground) | var(--color-gray-50) / var(--foreground-secondary) |
| 行ホバー | var(--component-table-row_hover_bg) | var(--hover-muted) |
| 余白 | var(--spacing-page_padding) / var(--spacing-section_gap) | var(--spacing-6) / var(--spacing-8) |

#### UIロジック

- **状態管理**: 画面ローカルに保持する（LR-026）。ページ番号はルーティングのクエリパラメータ（`?page=`）で表現し、共有状態を持たない。
- **バリデーション**: 入力項目を持たない画面のため、フロントエンドバリデーションは行わない。ページ番号が不正な場合は 1 ページ目にフォールバックする。
- **ローディング**: 取得中は LoanTable の `loading` 状態（Skeleton table）を表示し、レイアウトシフトを避ける。
- **エラーハンドリング**: api client 層で分類されたエラーを view 層で平易なメッセージへ変換する（LR-027 / CLP-012）。401 は再ログイン誘導、通信エラーは LoanTable の `error` 状態で Alert(destructive) と再試行導線を表示する。
- **本人限定参照の UI 制約**: 利用者番号を指定して他人の貸出を検索する導線を持たない（LP-025）。API は常に `/api/v1/me/loans` を呼ぶ。
- **延滞返却の表現**: 超過日数は事実としてのみ示し、責める文言や警告色の強調表示は行わない。貸出状態は「返却済み」（neutral）で統一する。
- **PII の非永続化**: 貸出履歴は読書傾向という機微情報のため、ブラウザの永続ストレージへ保存しない（CLR-008）。
- **日付書式**: 返却日・返却期限は `toLocaleDateString('ja-JP')` で書式化する（arch SR-004）。
- **アクセシビリティ**: テーブルに `caption` と `th scope` を付与する。LoanStatusBadge は色に加えて状態名の文言を伴う。一覧件数の更新は `aria-live="polite"` で通知する。

#### 操作フロー

1. 利用者がサイドバーの「蔵書利用業務」→「返却完了を確認」を選択する（または返却対象貸出確認画面から遷移する）。
2. api client が `GET /api/v1/me/loans?status=返却済み&page=1&per_page=20` を呼び出す（trace_id 付与）。
3. 取得中は LoanTable の loading 状態を表示する。
4. 取得成功かつ 1 件以上のとき、Alert(success) に返却完了サマリ（件数）を表示し、LoanTable に返却日の降順で一覧を表示する。
5. 取得成功かつ 0 件のとき、EmptyState に「返却済みの貸出はありません」と現在の貸出一覧（`/loans`）への導線を表示する。
6. 利用者が行を選択すると貸出内容・返却期限確認画面（`/loans/:loanId`）へ遷移する。

## コンポーネント設計

### ReturnedLoanSummary

- **ベースコンポーネント**: Alert（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | total | number | Yes | 返却済み貸出の総件数。0 のとき本コンポーネントは表示しない |
  | latestReturnedAt | string(date) \| null | No | 直近の返却日。「最後の返却: 2026年9月10日」として補足表示する |
- **状態**: なし（表示専用）
- **イベント**: なし

### ReturnedLoanList

- **ベースコンポーネント**: LoanTable（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | Array<{ loanId: string; book: { title: string; author: string }; loanDate: string; dueDate: string; returnedAt: string; overdueDays: number; loanStatus: string; loanPeriodType: string }> | Yes | 返却済み貸出の一覧。返却日の降順 |
  | loading | boolean | Yes | true のとき LoanTable の loading 状態（Skeleton table）を表示 |
  | error | string \| null | Yes | エラーメッセージ。非 null のとき error 状態を表示 |
  | showUser | boolean | Yes | 常に false（本人の貸出のみを表示するため） |
  | emptyMessage | string | Yes | 「返却済みの貸出はありません」 |
  | onSelect | (loanId: string) => void | No | 貸出内容・返却期限確認画面への遷移ハンドラ |
- **状態**: LoanTable の 4 状態（default / loading / empty / error）
- **イベント**: `onSelect`（貸出詳細への遷移）

## ティア完了条件（BDD）

```gherkin
Feature: 自分の返却済み貸出を照会する - 利用者ポータル

  Scenario: 返却済み貸出が返却日の降順で表示される
    Given 利用者「田中太郎」がログイン済み
    And API が貸出「L-000001」（返却日 2026-09-10）と貸出「L-000002」（返却日 2026-08-20）を返す
    When 利用者が返却完了確認画面（/loans/returned）を開く
    Then LoanTable の 1 行目に "L-000001"（返却日「2026年9月10日」）が表示される
    And 2 行目に "L-000002"（返却日「2026年8月20日」）が表示される
    And LoanStatusBadge に「返却済み」が dot と文言で表示される

  Scenario: 返却完了サマリが件数つきで表示される
    Given 利用者「田中太郎」がログイン済み
    And API が total 3、直近の返却日 2026-09-10 を返す
    When 利用者が返却完了確認画面を開く
    Then Alert(success) に「返却が完了しています（3 件）」が表示される

  Scenario: 取得中は LoanTable の loading 状態を表示する
    Given 利用者「田中太郎」がログイン済み
    When 返却完了確認画面を開き、API 応答が 0.4 秒以上かかる
    Then LoanTable が loading 状態になり Skeleton(table) が表示される

  Scenario: 0 件のとき EmptyState と次の行動導線を表示する
    Given 利用者「田中太郎」がログイン済み
    And API が items 0 件を返す
    When 利用者が返却完了確認画面を開く
    Then EmptyState(with-action) に「返却済みの貸出はありません」が表示される
    And 現在の貸出一覧（/loans）への導線が表示される

  Scenario: 延滞返却は超過日数を事実としてのみ示す
    Given 利用者「田中太郎」がログイン済み
    And API が貸出「L-000003」（返却期限 2026-08-30、返却日 2026-09-02、overdue_days 3）を返す
    When 利用者が返却完了確認画面を開く
    Then 「3 日超過して返却」が事実として表示される
    And LoanStatusBadge は neutral の「返却済み」であり、警告色の強調表示は行われない

  Scenario: 21 件以上の返却済み貸出は Pagination で分割表示する
    Given 利用者「田中太郎」に返却済みの貸出が 25 件存在する
    When 利用者が返却完了確認画面を開く
    Then 1 ページ目に 20 件が表示され、Pagination に 2 ページ分が表示される
    And 無限スクロールは行われない
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | ReturnedLoanList の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（ReturnedLoanList（`LoanTable`） + `Pagination` 20 件/頁） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← ReturnedLoanList の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"table"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← なし / `table` ← ReturnedLoanList（`LoanTable`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useListQueryState` | `@/components/common/hooks/useListQueryState` | 検索条件・ページをルーティングのクエリパラメータと同期する（画面をまたぐ共有状態を持たない / arch LR-026） |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
