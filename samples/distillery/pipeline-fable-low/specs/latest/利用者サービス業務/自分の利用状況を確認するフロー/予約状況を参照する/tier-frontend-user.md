# 予約状況を参照する - 利用者向けフロントエンド仕様

## 変更概要

利用者ポータル（patron）にマイ予約状況画面を追加する。ReservationTable（本人分）と ReservationQueueTracker で予約順位の繰り上がりを可視化し、ReservationStatusBadge と順位を同一行に表示する（ux-design「利用者: 自分の利用状況を確認し、不要な予約を取り消す」、目標勾配効果）。予約中・通知済みの行から予約取消画面へ遷移し、取消後は本画面に戻って Alert（success）で完了を伝える。

## 画面仕様

### マイ予約状況画面

- **URL**: `/me/reservations`（クエリ: `includeClosed`, `page`, `notice`（cancelled））
- **アクセス権**: 利用者（認証必須。本人分のみ。未認証時は IdP ログインへ遷移し、ログイン後に元 URL へ戻す）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（patron） | トップナビ「マイ予約状況」をアクティブ表示 |
| 完了通知 | 通知 | Alert（success） | `notice=cancelled` のとき「予約を取り消しました」（表示後にクエリを除去） |
| 表示切替 | トグル | ToggleGroup（single, md） | 「予約中の書籍」（既定）/「取消・終了も表示」 |
| 予約一覧 | テーブル | ReservationTable（showUser = false, onCancel） | 書籍（タイトル / 著者）/ 受付日時 / 順位 / 状態 / 操作（取り消す） |
| 予約の進行 | ステッパー | ReservationQueueTracker（waiting / notified / completed / cancelled） | 「3 人中 3 番目（あと 2 人）」、通知済みは「来館してください」 |
| 予約の状態 | バッジ | ReservationStatusBadge（dot） | 予約中（warning）/ 通知済み（analysis）/ 取消（neutral） |
| ページ送り | ナビゲーション | Pagination（default / single-page） | 総ページ数 = ceil(totalCount / 20) |
| 読み込み中 | プレースホルダ | Skeleton（table） | 0.4 秒を超える取得で表示 |
| 予約なし | 空状態 | EmptyState（with-action） | 「予約中の書籍はありません」+ 蔵書検索へ |
| 取得失敗 | 通知 | Alert（destructive） | 「予約状況を取得できませんでした」+ 再試行 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（patron primary） | var(--primary) | var(--color-blue-600)（#2563EB） |
| テーブルヘッダ背景 | var(--table-header-bg) | var(--background-subtle) |
| 予約中バッジ | var(--warning) / var(--warning-light) | amber 系 |
| 通知済みバッジ | var(--analysis) / var(--analysis-light) | violet 系 |
| 取消バッジ | var(--neutral) / var(--neutral-light) | gray 系 |
| トラッカー | queue_tracker.done / current / todo | success / primary / border_strong |
| 取消ボタン | Button（outline, sm） + var(--destructive) | red-600 |

#### UIロジック

- **状態管理**: 画面内状態（2 層構成、状態管理層なし）: `MyReservationsPageState = { includeClosed, page, items, totalCount, activeCount, loading, error, notice }`。`includeClosed` と `page` は URL クエリと双方向同期する。本人データは画面遷移で破棄する（LP-030）
- **バリデーション**: 入力項目なし。`page` は 1 以上に補正する
- **ローディング**: 初回・切替・ページ変更で `loading = true`。0.4 秒を超えたら Skeleton（table）
- **エラーハンドリング**: 401 → IdP 再認証、403 → Alert「この画面は利用者向けです」、その他 → Alert（destructive）+ 再試行（LR-023 / LP-031）。コンソールログに予約状況を出力しない
- **表示**: 有効予約は通知済みを先頭に、次に予約中を受付日時降順。`includeClosed = true` のとき取消・終了は末尾。ReservationQueueTracker は `position = queuePosition`、`total = totalWaiting`。通知済みの行には「来館してください（{notifiedAt} に通知）」を添える。取消・終了の行は neutral に落とし「取り消す」を出さない
- **取消導線**: `canCancel = true` の行に「取り消す」→ `/reservations/{reservationId}/cancel`。取消後は `?notice=cancelled` で戻り、一覧を再取得する
- **レスポンシブ**: sm では行を 2 段組みにし、状態バッジと順位を 1 段目に出す

#### 操作フロー

1. 利用者がトップナビ「マイ予約状況」を開く（未認証なら IdP ログインへ）
2. view が URL クエリから `includeClosed` / `page` / `notice` を復元し、api client `listMyReservations` を呼ぶ（GET /api/v1/me/reservations）
3. `notice=cancelled` があれば Alert（success）「予約を取り消しました」を表示し、クエリを除去する
4. ReservationTable と各行の ReservationQueueTracker を描画する
5. 「取り消す」で予約取消画面へ遷移する。「取消・終了も表示」を切り替えると page = 1 で再取得し URL クエリを更新する

## コンポーネント設計

### MyReservationsPage

- **ベースコンポーネント**: PortalShell（patron） + ToggleGroup + ReservationTable + ReservationQueueTracker + Pagination
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialIncludeClosed | boolean | No | クエリ `includeClosed` からの初期値（既定 false） |
  | initialPage | number | No | クエリ `page` からの初期値（既定 1） |
  | notice | "cancelled" | No | クエリ `notice` からの完了通知 |
- **状態**: `includeClosed`、`page`、`items`、`totalCount`、`activeCount`、`loading`、`error`、`notice`
- **イベント**: `onToggleClosed(includeClosed)`、`onPageChange(page)`、`onCancel(reservationId)`、`onRetry()`

### ReservationTable（UC 固有 Props）

- **ベースコンポーネント**: ReservationTable（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | reservations | MyReservationItem[]（reservationId, book{title, author}, acceptedAt, queuePosition, totalWaiting, status, notifiedAt, cancelledAt, canCancel） | Yes | 本人の予約 |
  | showUser | false | Yes | 本人分のため利用者列は非表示 |
  | onCancel | (reservationId: string) => void | Yes | 「取り消す」押下（canCancel の行のみ表示） |
  | loading | boolean | Yes | 読み込み中 |
- **状態**: なし（表示のみ）
- **イベント**: `onCancel`、`onSelectBook(bookId)`（書籍詳細・在庫状況画面へ）

## ティア完了条件（BDD）

```gherkin
Feature: 予約状況を参照する - 利用者向けフロントエンド

  Scenario: 予約中の予約を順位トラッカーつきで描画する
    Given 利用者が /me/reservations を開いている
    And GET /api/v1/me/reservations?includeClosed=false&page=1 が {items: [{reservationId: "R-0003", book: {title: "こころ"}, queuePosition: 3, totalWaiting: 3, status: "RESERVED", canCancel: true}], totalCount: 1, activeCount: 1} を返す
    When 一覧の取得が完了する
    Then ReservationTable に「こころ / 予約中」の行と ReservationQueueTracker「3 人中 3 番目（あと 2 人）」が表示される
    And 行に「取り消す」ボタンが表示される

  Scenario: 通知済みの予約に来館案内を表示する
    Given GET /api/v1/me/reservations が {items: [{book: {title: "吾輩は猫である"}, queuePosition: 1, totalWaiting: 2, status: "NOTIFIED", notifiedAt: "2026-09-10T09:00:00+09:00", canCancel: true}]} を返す
    When 利用者が /me/reservations を開く
    Then ReservationStatusBadge「通知済み」と「来館してください（2026/09/10 に通知）」が表示され ReservationQueueTracker が notified になる

  Scenario: 取消後に戻ると完了通知を表示する
    Given 利用者が予約取消画面で取消を確定した
    When /me/reservations?notice=cancelled に遷移する
    Then Alert（success）に「予約を取り消しました」が表示され URL から notice が除去される
    And 一覧が再取得される

  Scenario: 予約がないときは空状態を表示する
    Given GET /api/v1/me/reservations が {items: [], totalCount: 0, activeCount: 0} を返す
    When 利用者が /me/reservations を開く
    Then EmptyState に「予約中の書籍はありません」と「蔵書を検索する」ボタンが表示される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称: P-予約状況）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|---------------|-------------------------------------|
| PatronLayout | `@/components/common/PatronLayout` | activeNav = 'myReservations'、requireAuth = true |
| PageHeader | `@/components/common/PageHeader` | title = 「マイ予約状況」、notices = NoticeAlert + ErrorAlert |
| NoticeAlert（表示） | `@/components/common/NoticeAlert` | notice = クエリ `notice`（'cancelled' / 'created'）、messages = { cancelled: 「予約を取り消しました」, created: 「予約を受け付けました」 }、onDismiss = クエリ除去（replace）+ 一覧再取得 |
| ScopeToggle | `@/components/common/ScopeToggle` | options = [{value:'false', label:「予約中の書籍」}, {value:'true', label:「取消・終了も表示」}]、value = String(includeClosed)、onChange = onToggleClosed（page を 1 に戻す）、size = 'md'、ariaLabel = 「表示範囲」 |
| PaginatedListFrame | `@/components/common/PaginatedListFrame` | filter = ScopeToggle、page = page、totalCount = totalCount、onPageChange = onPageChange、loading / error / empty / onRetry = onRetry、skeleton = { variant:'table' }、emptyState = { title: 「予約中の書籍はありません」, action: { label: 「蔵書を検索する」, onClick: → `/books` } }、children = ReservationTable（showUser = false, onCancel）+ 行内 ReservationQueueTracker |
| AsyncStateView | `@/components/common/AsyncStateView` | PaginatedListFrame 内部で利用 |
| ErrorAlert | `@/components/common/ErrorAlert` | error = 正規化済み error（「予約状況を取得できませんでした」）、onRetry = onRetry、audience = 'patron'（403 → 「この画面は利用者向けです」） |

使用する共通 hooks:

- `useUrlQueryState`（`@/components/common/hooks/useUrlQueryState`）: includeClosed / page / notice ⇄ URL クエリ
- `useDelayedLoading`: AsyncStateView 内部（0.4 秒遅延 Skeleton）
