# 自分の予約状況を照会する - 利用者ポータル仕様

## 変更概要

予約状況一覧画面を追加し、本人の予約を状態バッジ・予約順位つきのテーブルで一覧表示する。一覧は 20 件/頁のページネーションで分割し、0 件・読み込み中・エラーの 3 状態を必ず実装する。

## 画面仕様

### 予約状況一覧画面

- **URL**: `/reservations`
- **アクセス権**: 利用者（ログイン済み。役割=利用者。本人の予約のみ）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | `PortalShell`（variant: patron） | サイドバー + ヘッダー + 本文の骨格 |
| 予約一覧 | テーブル | `Table`（default / empty） | 書籍タイトル・著者・ジャンル・資料種別・予約状態・予約順位・申込日時の列 |
| 予約の状態 | バッジ | `ReservationStatusBadge` | 予約状態（予約中 / 取置き中 / 貸出済み / キャンセル）を dot + 文言で表示 |
| 予約の進行状況 | ステッパー | `ReservationQueueTracker` | 行の展開時に「予約中 → 取置き中 → 貸出済み」の段階と順位を表示 |
| 0 件表示 | 空状態 | `EmptyState`（with-action） | 「予約はありません」と蔵書検索画面への導線 |
| ページ分割 | ページネーション | `Pagination`（default / single-page） | 20 件/頁で分割。無限スクロールは使わない |
| 読み込み中 | スケルトン | `Skeleton`（table） | 一覧取得中に表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 本文色 | `var(--semantic-foreground)` | `var(--color-gray-900)` |
| 補足色 | `var(--semantic-foreground-secondary)` | `var(--color-gray-600)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-blue-700)` |
| 予約中の状態色 | `var(--semantic-info)` | `var(--color-blue-600)` |
| 取置き中の状態色 | `var(--semantic-warning)` | `var(--color-amber-600)` |
| キャンセルの中立色 | `var(--semantic-neutral)` | `var(--color-gray-500)` |
| テーブルヘッダー背景 | `var(--table-header-bg)` | `var(--color-gray-50)` |
| セクション間余白 | `var(--section-gap)` | `var(--spacing-8)` |

#### UIロジック

- **状態管理**: 画面ローカルに `items`・`total`・`page`・`statusFilter`・`loading`・`error` を保持する。ページ・絞り込みの変更で再取得する
- **バリデーション**: `page` は 1 以上、`statusFilter` は予約状態のバリエーション値（予約中 / 取置き中 / 貸出済み / キャンセル）に限定する。自由入力は受け付けない
- **ローディング**: 一覧取得中は `Skeleton`（table）を表示し、レイアウトシフトを避ける（ドハティの閾値）
- **エラーハンドリング**: 一覧は `EmptyState` / `Alert(destructive)` / `Skeleton` の 3 状態を必ず実装する。401 はログイン画面へ誘導する。5xx は再試行導線つき `Alert(destructive)` を `role="alert"` で通知する
- **アクセシビリティ**: テーブルに `caption` と `th scope` を付与する。件数の更新は `aria-live="polite"` で通知する。状態バッジは色に加えて状態名の文言を必ず伴う
- **日付書式**: 申込日時・取置き期限は `toLocaleDateString('ja-JP')` で書式化する（arch SR-004）
- **PII**: 他利用者の予約・氏名・連絡先へ到達する導線を置かない（arch SP-004 / 条件「個人情報参照可否条件」）

#### 操作フロー

1. サイドバーの「予約状況」から `/reservations` を開く
2. 予約一覧（20 件/頁）を確認する
3. 必要に応じて予約状態で絞り込む
4. 行を選んで予約順位確認画面 `/reservations/:reservationId/rank` へ遷移する
5. 取置き中の行からは取置き中予約確認画面 `/reservations/holds` へ遷移する

## コンポーネント設計

### MyReservationTable

- **ベースコンポーネント**: `Table` + `ReservationStatusBadge` + `ReservationQueueTracker` + `EmptyState` + `Pagination`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | items | array | Yes | 予約一覧（reservation_id, book_title, book_author, book_genre, book_material_type, reservation_status, priority, applied_at, hold_expires_at） |
  | total | number | Yes | 総件数 |
  | page | number | Yes | 現在のページ番号 |
  | size | number | Yes | 1 ページ件数（既定 20） |
  | loading | boolean | Yes | 読み込み中フラグ |
  | error | string | No | エラーメッセージ |
  | statusFilter | string | No | 絞り込み中の予約状態 |
  | onChangePage | function | Yes | ページ変更ハンドラ |
  | onChangeStatus | function | Yes | 予約状態の絞り込み変更ハンドラ |
  | onSelect | function | Yes | 行選択ハンドラ（予約順位確認画面へ遷移） |
- **状態**: `expandedRowId`（進行状況の展開行）
- **イベント**: `onChangePage`、`onChangeStatus`、`onSelect`

## ティア完了条件（BDD）

```gherkin
Feature: 自分の予約状況を照会する - 利用者ポータル

  Scenario: 予約一覧が状態バッジと順位つきで表示される
    Given 本人の予約が「予約中」2 件・「取置き中」1 件存在する
    When 利用者が予約状況一覧画面 /reservations を開く
    Then テーブルに 3 行が表示される
    And 各行に予約状態バッジ（文言つき）と予約順位が表示される

  Scenario: 0 件のときに空状態と導線を表示する
    Given 本人の予約が 0 件である
    When 利用者が予約状況一覧画面 /reservations を開く
    Then EmptyState(with-action) に「予約はありません」が表示される
    And 蔵書検索画面 /search への導線が表示される

  Scenario: 21 件以上でページネーションが機能する
    Given 本人の予約が 25 件存在する
    When 利用者が予約状況一覧画面 /reservations を開き 2 ページ目を選ぶ
    Then GET /api/v1/me/reservations?page=2&size=20 が送信される
    And 残り 5 件が表示される

  Scenario: 取得失敗時に再試行導線を表示する
    Given 予約一覧の取得が HTTP 500 で失敗する
    When 利用者が予約状況一覧画面 /reservations を開く
    Then Alert(destructive) が role="alert" で表示される
    And 再試行ボタンが表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | MyReservationTable の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（MyReservationTable（`Table`） + `Pagination` 20 件/頁） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← MyReservationTable の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"table"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← なし / `table` ← MyReservationTable（`Table`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 表示要素の「ステッパー」は Domain の `ReservationQueueTracker` による進行表示である。共通フォームパターンが禁じる「入力 → 確認 → 完了の複数ページウィザード」のステッパーではない
- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
