# 書籍詳細と在庫状況を照会する - 利用者ポータル仕様

## 変更概要

利用者ポータル（tier-frontend-patron）に書籍詳細・在庫状況画面（`/books/:bookId`）を実装する。書誌情報・在庫状況バッジ・予約の進行状況・次に取れる行動の案内を表示し、書籍状態に応じて予約申込への導線を出し分ける。

## 画面仕様

### 書籍詳細・在庫状況画面

- **ルート id**: `patron-book-detail`
- **URL**: `/books/:bookId`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 利用者（利用者ポータル。他利用者の貸出・予約情報へは到達しない）
- **ポータル**: `patron`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`patron`） | ヘッダー・サイドバー・メインコンテンツ |
| 書誌情報 | カード | `BookCard`（`default` / `on-loan` / `reserved`） | タイトル・著者・ISBN・出版社・ジャンル・資料種別・予約件数 |
| 在庫状況 | バッジ | `BookStatusBadge` | 在庫あり / 貸出中 / 予約待ち。`dot` と文言を併記する |
| 予約の進行状況 | ステッパー | `ReservationQueueTracker` | 予約待ち件数と「予約中 → 取置き中 → 貸出済み」の段階を示す |
| 次の行動の案内 | メッセージ | `Alert`（`info` / `success`） | 在庫ありは「予約せずにそのまま借りられます」、貸出中は予約可能である旨を肯定形で示す |
| 予約申込ボタン | ボタン | `Button`（`default`, `lg`） | 書籍状態が「貸出中」「予約待ち」のときのみ表示し、`useAppNavigation().navigate("patron-reservation-new")` で書籍予約申込画面へ遷移する |
| 検索へ戻る | ボタン | `Button`（`ghost`） | `useAppNavigation().navigate("patron-book-search")` で蔵書検索画面へ戻る（ブラウザバックでも条件が保持される） |
| 取得エラー | メッセージ | `Alert`（`destructive`） | 404 は検索画面への導線、5xx は再試行ボタン |
| 読み込み中 | ローディング | `LoadingState`（`kind="detail"`） | loading 表現の唯一の入口。単一書籍の在庫状況取得待ちを表示する（`label`「書籍の在庫状況を読み込み中」） |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--background)` | `var(--color-white)` |
| 本文色 | `var(--foreground)` | `var(--color-gray-900)` |
| アクセント | `var(--primary)` | `var(--color-blue-700)`（#1D4ED8） |
| 在庫ありバッジ | `var(--success)` | `var(--color-green-600)` |
| 貸出中バッジ | `var(--info)` | `var(--color-blue-600)` |
| 予約待ちバッジ | `var(--warning)` | `var(--color-amber-600)` |
| 予約ステッパーの進行 | `var(--queue-active-bg)` / `var(--queue-done-bg)` | design の component トークン |
| カード | `var(--card-bg)` / `var(--card-padding)` | `var(--color-white)` / `var(--spacing-6)` |

#### UIロジック

- **状態管理**: 対象書籍の在庫状況（book / availability / reservation_count / reservable / guidance）を画面ローカルに保持する。画面間で共有しない
- **バリデーション**: 入力項目はない。`bookId` はルートパラメータとしてそのまま API へ渡す
- **予約導線の出し分け**: `reservable=true`（書籍状態が「貸出中」「予約待ち」）のときだけ予約申込ボタンを表示する。「在庫あり」のときはボタンを出さず、`Alert(info)` で「予約せずにそのまま借りられます」と肯定形で案内する（フレーミング効果）
- **ローディング**: 取得中は `LoadingState`（`kind="detail"` / `label`「書籍の在庫状況を読み込み中」）を表示する（`AsyncSection` の `skeleton` prop 経由）。画面側で `Skeleton` / `Spinner` を直接使わない
- **エラーハンドリング**: 404 は「対象の書籍が見つかりません」+ 蔵書検索画面への導線、401 は再ログイン導線、5xx は `Alert(destructive)` + 再試行ボタンを表示する
- **本人限定参照の UI 制約**: 予約者・貸出者などの他利用者情報は表示せず、そこへ到達する導線も置かない（arch SP-004 / LP-025）
- **アクセシビリティ**: 在庫状況は色だけで伝えず必ず状態名の文言を併記する。予約待ち件数は数値と文言で示す

#### 操作フロー

1. 利用者が蔵書検索画面の書籍カードを選び、書籍詳細・在庫状況画面へ遷移する
2. `GET /api/v1/books/{book_id}/availability` を実行し、`LoadingState`（`kind="detail"`）を表示する
3. 書誌情報・在庫状況バッジ・予約待ち件数・案内文を描画する
4. 書籍状態が「貸出中」「予約待ち」なら予約申込ボタンを表示する
5. 予約申込ボタンから `useAppNavigation().navigate("patron-reservation-new")`（表示上は `/books/:bookId/reserve`）で書籍予約申込画面へ前方遷移する
6. 「検索へ戻る」（`useAppNavigation().navigate("patron-book-search")`）またはブラウザバックで蔵書検索画面へ戻る

## コンポーネント設計

### BookAvailabilityPanel

- **ベースコンポーネント**: `BookCard`（Domain） + `BookStatusBadge`（Domain） + `Alert`（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | book | BookSummary | Yes | 書誌情報 |
  | availability | string | Yes | 在庫状況区分（在庫あり/貸出中/予約待ち） |
  | reservationCount | number | Yes | 予約待ち件数 |
  | guidance | string | Yes | 次の行動の案内文 |
  | loading | boolean | Yes | 取得中フラグ |
- **状態**: なし（表示専用）
- **イベント**: なし

### ReservationAvailabilityAction

- **ベースコンポーネント**: `ReservationQueueTracker`（Domain） + `Button`（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | reservable | boolean | Yes | 予約導線を出すか（書籍状態が貸出中/予約待ちのとき true） |
  | reservationCount | number | Yes | 現在の予約待ち件数 |
  | bookTitle | string | Yes | 対象書籍名 |
  | onReserve | () => void | No | 書籍予約申込画面への遷移 |
- **状態**: なし
- **イベント**: onReserve

## ティア完了条件（BDD）

```gherkin
Feature: 書籍詳細と在庫状況を照会する - 利用者ポータル

  Scenario: 在庫ありの書籍で予約ボタンを出さない
    Given API が availability=「在庫あり」, reservable=false, guidance=「予約せずにそのまま借りられます」を返す状態である
    When 利用者が書籍詳細・在庫状況画面（/books/BK-001）を開く
    Then 「在庫あり」バッジと案内文が表示され、予約申込ボタンが表示されない

  Scenario: 貸出中の書籍で予約ボタンと待ち件数を出す
    Given API が availability=「貸出中」, reservable=true, reservation_count=2 を返す状態である
    When 利用者が書籍詳細・在庫状況画面を開く
    Then 「貸出中」バッジと「現在の予約待ち 2 件」が表示され、予約申込ボタンが表示される

  Scenario: 取得中は LoadingState を表示する
    Given 在庫状況の取得応答が 1 秒遅延する状態である
    When 利用者が書籍詳細・在庫状況画面を開く
    Then LoadingState(kind="detail") が表示され、応答後に書誌情報へ置き換わる

  Scenario: 存在しない書籍で検索画面への導線を出す
    Given API が HTTP 404 を返す状態である
    When 利用者が /books/BK-999 を開く
    Then Alert(destructive) に「対象の書籍が見つかりません」と蔵書検索画面へのリンクが表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（書籍予約申込画面・蔵書検索画面へのルート id 指定遷移） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（単一書籍の在庫状況取得待ち。`kind="detail"`） |
| `AsyncSection` | `@/components/common/AsyncSection` | BookAvailabilityPanel の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"detail"`（単一エンティティの詳細取得） / `label` ← `"書籍の在庫状況を読み込み中"` |
| `AsyncSection` | `loading` ← BookAvailabilityPanel の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"detail"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"書籍の在庫状況を読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 表示要素の「ステッパー」は Domain の `ReservationQueueTracker` による進行表示である。共通フォームパターンが禁じる「入力 → 確認 → 完了の複数ページウィザード」のステッパーではない
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
