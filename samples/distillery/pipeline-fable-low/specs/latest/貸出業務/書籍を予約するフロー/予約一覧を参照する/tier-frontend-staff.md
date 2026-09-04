# 予約一覧を参照する - 司書向けフロントエンド仕様

## 変更概要

司書ポータル（staff）に書籍別予約状況画面を追加する。蔵書一覧画面の行内操作「予約状況」、返却通知送信確認画面の「予約状況へ」、在庫状況一覧画面（予約待ちの書籍）から遷移する。BookCard で書籍要約、ReservationTable（showUser）で予約順位 / 利用者 / 受付日時 / 状態を表示し、通知済みの予約者を先頭に強調して引き渡し先を即断できるようにする（ux-design「司書（窓口）」フロー）。

## 画面仕様

### 書籍別予約状況画面

- **URL**: `/staff/books/:bookId/reservations`（クエリ: `includeClosed`, `page`）
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff / staff-collapsed） | サイドバー「予約・延滞状況 > 書籍別予約状況」をアクティブ表示 |
| 書籍要約 | カード | BookCard（compact） + BookStatusBadge | タイトル / 著者 / ジャンル / 状態（在庫あり / 貸出中 / 予約待ち） |
| 待ち人数と進行 | ステッパー | ReservationQueueTracker | 「待ち人数: N 人」と 予約中 → 通知済み → 貸出完了 のステップ（順位 1 位の状態を current に） |
| 表示切替 | トグル | ToggleGroup（single, sm） | 「有効な予約のみ」（既定）/「取消・終了も表示」 |
| 予約一覧 | テーブル | ReservationTable（showUser） | 予約順位 / 利用者（利用者番号 + 氏名） / 受付日時 / 状態 |
| 予約の状態 | バッジ | ReservationStatusBadge（dot） | 予約中（warning）/ 通知済み（analysis）/ 取消・終了（neutral） |
| ページ送り | ナビゲーション | Pagination（default / single-page） | 総ページ数 = ceil(totalCount / 20)。現在ページを aria-current で示す |
| 読み込み中 | プレースホルダ | Skeleton（table） | 0.4 秒を超える取得で表示 |
| 予約なし | 空状態 | EmptyState（default） | 「この書籍に予約はありません」 |
| 書籍なし / 取得失敗 | 空状態 / 通知 | EmptyState（with-action）/ Alert（destructive） | 「書籍が見つかりません」+ 蔵書一覧へ / 「一覧を取得できませんでした」+ 再試行 |
| 窓口操作へ | ボタン | Button（secondary） | 返却受付画面（`/staff/returns/new?bookId=`）/ 貸出受付画面（`/staff/loans/new?userNumber=` 順位 1 位の利用者番号を引き継ぐ） |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（staff primary） | var(--primary) | var(--color-slate-700)（#334155） |
| テーブルヘッダ背景 | var(--table-header-bg) | var(--background-subtle) |
| 引き渡し先の行強調 | var(--analysis-light) | violet-50（dark: rgba(124,58,237,0.18)） |
| 予約中バッジ | var(--warning) / var(--warning-light) | amber 系 |
| 通知済みバッジ | var(--analysis) / var(--analysis-light) | violet 系 |
| 取消・終了バッジ | var(--neutral) / var(--neutral-light) | gray 系 |
| 書籍の状態 予約待ち | var(--pending) / var(--pending-light) | orange 系 |
| トラッカー | queue_tracker.done / current / todo | success / primary / border_strong |

#### UIロジック

- **状態管理**: 画面内状態（2 層構成、状態管理層なし）: `BookReservationsPageState = { book, items, page, totalCount, waitingCount, includeClosed, loading, error }`。`includeClosed` と `page` は URL クエリと双方向同期する
- **バリデーション**: 入力項目なし。`page` は 1 以上の整数のみ受け付け、不正値は 1 に補正する
- **ローディング**: 初回・切替・ページ変更で `loading = true`。0.4 秒を超えたら Skeleton（table）
- **エラーハンドリング**: 401 → IdP 再認証、403 → Alert「この画面を表示する権限がありません」、404 → EmptyState「書籍が見つかりません」、その他 → Alert（destructive）+ 再試行（LR-027）。コンソールログに個人情報を出力しない
- **表示**: 有効予約は予約順位昇順。`includeClosed = true` のとき取消・終了は末尾に受付日時降順。通知済みの行を強調し「引き渡し先」ラベルを添える。予約中と予約待ちは文言と dot で区別する（ui-design 補足）
- **個人情報**: 氏名は表示するが連絡先は表示しない（LR-025）

#### 操作フロー

1. 司書が蔵書一覧の行内「予約状況」（または返却通知送信確認画面の「予約状況へ」）から画面を開く
2. view が URL クエリから `includeClosed` / `page` を復元し、api client `listBookReservations` を呼ぶ
3. BookCard と ReservationQueueTracker（待ち人数）、ReservationTable を描画する
4. 「取消・終了も表示」を切り替えると page を 1 に戻して再取得し、URL クエリを更新する
5. 「返却受付へ」「貸出受付へ」で書籍 ID / 順位 1 位の利用者番号をクエリで引き継いで遷移する

## コンポーネント設計

### BookReservationsPage

- **ベースコンポーネント**: PortalShell（staff） + BookCard + ReservationQueueTracker + ToggleGroup + ReservationTable + Pagination
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | bookId | string | Yes | ルートパラメータ |
  | initialIncludeClosed | boolean | No | クエリ `includeClosed` からの初期値（既定 false） |
  | initialPage | number | No | クエリ `page` からの初期値（既定 1） |
- **状態**: `book`、`items`、`page`、`totalCount`、`waitingCount`、`includeClosed`、`loading`、`error`
- **イベント**: `onToggleClosed(includeClosed)`、`onPageChange(page)`、`onGoReturn()`、`onGoLoan(userNumber)`

### ReservationTable（UC 固有 Props）

- **ベースコンポーネント**: ReservationTable（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | reservations | ReservationListItem[]（reservationId, queuePosition, userNumber, userName, acceptedAt, status） | Yes | 予約一覧 |
  | showUser | true | Yes | 利用者列（利用者番号 + 氏名）を表示 |
  | highlightNotified | boolean | No | 通知済みの行を強調（既定 true） |
  | loading | boolean | Yes | 読み込み中 |
- **状態**: なし（表示のみ）
- **イベント**: `onSelectUser(userNumber)`（窓口利用状況照会画面へ）

## ティア完了条件（BDD）

```gherkin
Feature: 予約一覧を参照する - 司書向けフロントエンド

  Scenario: 有効な予約を順位順に描画し通知済みを強調する
    Given 司書が /staff/books/B-000789/reservations を開いている
    And GET /api/v1/books/B-000789/reservations が {book: {title: "こころ", status: "RESERVED"}, items: [{queuePosition: 1, userName: "山田太郎", status: "NOTIFIED"}, {queuePosition: 2, userName: "鈴木一郎", status: "RESERVED"}], totalCount: 2, waitingCount: 2} を返す
    When 一覧の取得が完了する
    Then ReservationTable に 2 行が順位順に表示され 1 行目に「引き渡し先」ラベルが付く
    And ReservationQueueTracker に「待ち人数: 2 人」が表示される

  Scenario: 取消・終了の表示を切り替える
    Given 司書が書籍別予約状況画面を開いている
    When 「取消・終了も表示」を ON にする
    Then GET /api/v1/books/B-000789/reservations?includeClosed=true&page=1 が呼ばれる
    And URL クエリが includeClosed=true に更新される

  Scenario: 予約がないときは空状態を表示する
    Given GET /api/v1/books/B-000456/reservations が {items: [], totalCount: 0, waitingCount: 0} を返す
    When 司書が /staff/books/B-000456/reservations を開く
    Then EmptyState に「この書籍に予約はありません」が表示される

  Scenario: 取得に 0.4 秒以上かかるとスケルトンを表示する
    Given 司書が書籍別予約状況画面を開いている
    When 一覧の取得が 0.4 秒を超える
    Then Skeleton（table）が表示され、応答後に ReservationTable に置き換わる
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称: S-予約一覧）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|---------------|-------------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'reservations'、activeItem = 'bookReservations' |
| PageHeader | `@/components/common/PageHeader` | title = 「書籍別予約状況」、subtitle = book.title、status = BookStatusBadge（book.status）、notices = ErrorAlert |
| ScopeToggle | `@/components/common/ScopeToggle` | options = [{value:'false', label:「有効な予約のみ」}, {value:'true', label:「取消・終了も表示」}]、value = String(includeClosed)、onChange = onToggleClosed（page を 1 に戻す）、size = 'sm'、ariaLabel = 「表示範囲」 |
| PaginatedListFrame | `@/components/common/PaginatedListFrame` | filter = ScopeToggle、summary = BookCard（compact）+ ReservationQueueTracker（待ち人数）、page = page、totalCount = totalCount、onPageChange = onPageChange、loading / error / empty / onRetry、skeleton = { variant:'table' }、emptyState = { title: 「この書籍に予約はありません」 }、children = ReservationTable（showUser） |
| AsyncStateView | `@/components/common/AsyncStateView` | PaginatedListFrame 内部で利用（404 → emptyState「書籍が見つかりません」+ action「蔵書一覧へ」） |
| ErrorAlert | `@/components/common/ErrorAlert` | error = 正規化済み error、onRetry = 再取得、audience = 'staff'（403 → 「この画面を表示する権限がありません」） |
| CounterHandoffActions | `@/components/common/CounterHandoffActions` | actions = ['return', 'loan']、bookId = bookId（onGoReturn）、userNumber = 順位 1 位の userNumber（onGoLoan）、disabled = 順位 1 位が無いとき「貸出受付へ」を非表示 |

使用する共通 hooks:

- `useUrlQueryState`（`@/components/common/hooks/useUrlQueryState`）: includeClosed / page ⇄ URL クエリ
- `useDelayedLoading`: AsyncStateView 内部（0.4 秒遅延 Skeleton）
