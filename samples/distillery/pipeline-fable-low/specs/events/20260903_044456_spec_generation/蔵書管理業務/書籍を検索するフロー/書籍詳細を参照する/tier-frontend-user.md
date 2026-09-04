# 書籍詳細を参照する - 利用者向けフロントエンド仕様

## 変更概要

利用者ポータルに書籍詳細・在庫状況画面（/books/:bookId）を追加する。
BookCard（detail）による書籍属性表示、BookStatusBadge による在庫状況表示、状態に応じた CTA 切替（窓口案内 / 予約申込）、ReservationQueueTracker による待ち人数表示を実装する。
公開経路の GET /api/v1/books/{bookId} 呼び出しを api client に追加する。

## 画面仕様

### 書籍詳細・在庫状況画面

- **URL**: `/books/:bookId`
- **アクセス権**: 利用者（未認証でも閲覧可。予約申込 CTA 押下時に未認証なら IdP ログインへ遷移し、ログイン後に元 URL へ戻す）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（patron） | トップナビ「蔵書検索」をアクティブ表示 |
| 戻るリンク | リンク | Button（ghost） | 「検索結果へ戻る」（検索条件・ページを復元） |
| 書籍詳細 | カード | BookCard（detail） | タイトル / 著者 / ISBN / 出版社 / ジャンル / 媒体種別 |
| 在庫状況 | バッジ | BookStatusBadge（dot） | 在庫あり（success）/ 貸出中（info）/ 予約待ち（pending）。状態の隣に次の行動文言を並記（ux-design: 状態と次の行動をセットで示す） |
| 予約待ち人数 | ステッパー | ReservationQueueTracker | 予約待ち・貸出中のとき「現在 n 人待ち。申し込むと n+1 番目」 |
| 予約申込 CTA | ボタン | Button（default, lg） | 「予約を申し込む」→ /books/:bookId/reserve。貸出中・予約待ちかつ紙のとき表示 |
| 窓口案内 | 通知 | Alert（info） | 在庫あり: 「窓口でお借りいただけます」 |
| 電子書籍注記 | 通知 | Alert（info） | 電子: 「電子書籍は貸出・予約の対象外です」 |
| 読み込み中 | プレースホルダ | Skeleton（card） | 0.4 秒超で表示 |
| 不在 | 空状態 | EmptyState（with-action） | 「この書籍は見つかりませんでした」+「蔵書検索へ戻る」 |
| 取得失敗 | 通知 | Alert（destructive） | 「書籍情報を取得できませんでした。しばらくしてからもう一度お試しください」+ 再試行 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（patron primary） | var(--primary) | var(--color-blue-600)（dark: var(--color-blue-500)） |
| カード背景 / 枠 | var(--card-bg) / var(--card-border) | design tokens component 層 |
| 状態バッジ 在庫あり / 貸出中 / 予約待ち | var(--success) / var(--info) / var(--pending) | green / blue / orange 系 |
| キュートラッカー 現在位置 | var(--queue-tracker-current) | var(--primary) |
| 情報通知 | var(--info) / var(--info-light) | blue 系 |
| フォーカスリング | var(--ring) | var(--primary) |

#### UIロジック

- **状態管理**: 画面内状態（CLP-010）。`BookDetailPageState = { book: BookDetailResponse | null, loading, error, returnQuery }`。永続化しない（LP-030）
- **バリデーション**: 入力なし
- **ローディング**: 初期 GET 中は Skeleton（card）
- **エラーハンドリング**: 404 → EmptyState、その他 → Alert（destructive）+ 再試行（LP-031: 技術的詳細は表示しない）。コンソールに書籍情報を出力しない（CLR-008）
- **CTA 切替**: `status === 'AVAILABLE'` → 窓口案内 / `(status === 'ON_LOAN' || status === 'RESERVED') && mediaType === 'PAPER'` → 予約申込 CTA + ReservationQueueTracker / `mediaType === 'ELECTRONIC'` → 電子書籍注記
- **戻る**: 蔵書検索画面から遷移した場合は URL クエリ（`returnQuery`）を引き継いで検索結果へ戻る。直接アクセス時は `/search` へ

#### 操作フロー

1. 利用者が蔵書検索画面の BookCard を選ぶ（または `/books/B-0001` を直接開く）
2. view が api client `getBookDetail` を呼び（GET /api/v1/books/{bookId}）、Skeleton を表示する
3. 応答を BookCard（detail）と BookStatusBadge に描画し、状態に応じて CTA を切り替える
4. 貸出中 / 予約待ちの紙の書籍では「予約を申し込む」を押すと予約申込画面（/books/:bookId/reserve）へ遷移する（未認証なら IdP ログイン経由）
5. 「検索結果へ戻る」で蔵書検索画面へ条件を復元して戻る

## コンポーネント設計

### BookDetailPage

- **ベースコンポーネント**: PortalShell（patron）+ BookCard（detail）+ BookStatusBadge + ReservationQueueTracker + Button + Alert + Skeleton + EmptyState
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | bookId | string | Yes | ルートパラメータ |
  | returnQuery | { searchType?: string; q?: string; genreId?: string; page?: number } | No | 検索結果へ戻るときに引き継ぐクエリ |
- **状態**: `book`, `loading`, `error`
- **イベント**: onReserveClick(bookId)、onBack、onRetry

### BookCard（detail variant の UC 固有設定）

- **ベースコンポーネント**: BookCard（variant: detail）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | book | BookDetailResponse（bookId, title, author, isbn, publisher, genreName, mediaType, status） | Yes | 表示データ |
  | detail | boolean | Yes | true（全属性を表示） |
  | onSelect | (bookId: string) => void | No | 未使用 |
- **状態**: なし
- **イベント**: なし

### ReservationQueueTracker（UC 固有設定）

- **ベースコンポーネント**: ReservationQueueTracker
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | total | number | Yes | waitingCount（現在の待ち人数） |
  | position | number | No | waitingCount + 1（申し込んだ場合の順位。申込前の目安として表示） |
  | state | 'preview' | Yes | 申込前プレビュー表示（design 側で variant `preview` を追加する前提で維持。common-components.md 要確認 2） |
- **状態**: なし
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 書籍詳細を参照する - 利用者向けフロントエンド

  Scenario: 在庫ありの書籍は窓口案内を表示し CTA を出さない
    Given GET /api/v1/books/B-0001 が {title: "吾輩は猫である", status: "AVAILABLE", mediaType: "PAPER", waitingCount: 0} を返すようモックされている
    When 書籍詳細・在庫状況画面（/books/B-0001）を開く
    Then BookCard（detail）に「吾輩は猫である」と BookStatusBadge「在庫あり」が表示される
    And Alert（info）「窓口でお借りいただけます」が表示され、Button「予約を申し込む」は表示されない

  Scenario: 予約待ちの書籍は待ち人数と予約申込 CTA を表示する
    Given GET /api/v1/books/B-0003 が {status: "RESERVED", mediaType: "PAPER", waitingCount: 2} を返すようモックされている
    When 書籍詳細・在庫状況画面（/books/B-0003）を開く
    Then BookStatusBadge「予約待ち」と ReservationQueueTracker「現在 2 人待ち。申し込むと 3 番目」が表示される
    And Button「予約を申し込む」を押すと「/books/B-0003/reserve」へ遷移する

  Scenario: 電子書籍は注記を表示し CTA を出さない
    Given GET /api/v1/books/B-0100 が {status: "AVAILABLE", mediaType: "ELECTRONIC"} を返すようモックされている
    When 書籍詳細・在庫状況画面（/books/B-0100）を開く
    Then Alert（info）「電子書籍は貸出・予約の対象外です」が表示され、Button「予約を申し込む」は表示されない

  Scenario: 検索結果へ戻ると検索条件が復元される
    Given 蔵書検索画面「/search?searchType=keyword&q=猫&page=1」から書籍詳細・在庫状況画面（/books/B-0001）へ遷移している
    When 「検索結果へ戻る」を押す
    Then URL が「/search?searchType=keyword&q=%E7%8C%AB&page=1」になる

  Scenario: 存在しない書籍は EmptyState を表示する
    Given GET /api/v1/books/B-9999 が HTTP 404（code: BOOK_NOT_FOUND）を返すようモックされている
    When 書籍詳細・在庫状況画面（/books/B-9999）を開く
    Then EmptyState（with-action）「この書籍は見つかりませんでした」と「蔵書検索へ戻る」ボタンが表示される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 P-詳細）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| PatronLayout | `@/components/common/PatronLayout` | activeNav = 'search'、requireAuth = false（予約申込 CTA 押下時のみ IdP へ） |
| PageHeader | `@/components/common/PageHeader` | title = book.title、status = BookStatusBadge（dot）、back = { label: 「検索結果へ戻る」, onClick: onBack }、notices = Alert（info）窓口案内 / 電子書籍注記 |
| AsyncStateView | `@/components/common/AsyncStateView` | loading = state.loading、error = state.error（kind ≠ notFound）、empty = error.kind === 'notFound'、skeleton = { variant: 'card' }、emptyState = { title: 「この書籍は見つかりませんでした」, action: { label: 「蔵書検索へ戻る」, onClick: → /search } }、onRetry = onRetry、children = BookCard（detail）+ ReservationQueueTracker + 予約申込 CTA |
| ErrorAlert | `@/components/common/ErrorAlert` | AsyncStateView 内部で利用。audience = 'patron' |
| BackLink | `@/components/common/BackLink` | label = 「検索結果へ戻る」、to = '/search'、returnQuery = props.returnQuery |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useUrlQueryState | 蔵書検索画面から引き継いだ `returnQuery`（searchType / q / genreId / page）の保持と BackLink への受け渡し |
