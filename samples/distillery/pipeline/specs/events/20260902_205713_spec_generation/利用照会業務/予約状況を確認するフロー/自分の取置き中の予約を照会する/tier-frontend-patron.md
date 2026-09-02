# 自分の取置き中の予約を照会する - 利用者ポータル仕様

## 変更概要

取置き中予約確認画面を追加し、本人の取置き中の予約を受取期限つきカードで一覧表示する。取置き案内メールからの着地点であり、期限当日の取置きは上部の注意喚起とカードの `deadline-today` で強調する。

## 画面仕様

### 取置き中予約確認画面

- **ルート id**: `patron-hold-list`
- **URL**: `/reservations/holds`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 利用者（ログイン済み。役割=利用者。本人の予約のみ）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | `PortalShell`（variant: patron） | サイドバー + ヘッダー + 本文の骨格 |
| 取置きカード | カード | `HoldPickupCard`（variant: default / deadline-today） | 書籍タイトル・著者・取置き開始日時（`YYYY年M月D日 HH:mm`）・取置き期限（`YYYY年M月D日`）と残日数（`あと{N}日`）・窓口提示用の利用者番号を表示 |
| 予約の状態 | バッジ | `ReservationStatusBadge` | 予約状態（取置き中）を dot + 文言で表示 |
| 期限当日の注意喚起 | 通知 | `Alert`（warning） | 「本日が受取期限の取置きが N 件あります」を上部に表示 |
| 0 件表示 | 空状態 | `EmptyState`（with-action） | 「取置き中の予約はありません」と予約状況一覧への導線（`useAppNavigation().navigate("patron-reservation-list")` / 表示 URL: `/reservations`） |
| 読み込み中 | プレースホルダ | `LoadingState`（`kind="card"` / `label="取置き中の予約を読み込み中"`） | loading 表現の唯一の入口。カード群の取得のため `card` を使う |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 本文色 | `var(--semantic-foreground)` | `var(--color-gray-900)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-blue-700)` |
| 取置き中の状態色 | `var(--semantic-warning)` | `var(--color-amber-600)` |
| カード内余白 | `var(--card-padding)` | `var(--spacing-6)` |
| カード間余白 | `var(--component-gap)` | `var(--spacing-3)` |
| 利用者番号の書体 | `var(--font-family-mono)` | `JetBrains Mono, SFMono-Regular, Consolas, Menlo, monospace` |

#### UIロジック

- **状態管理**: 画面ローカルに `items`・`expiringTodayCount`・`loading`・`error` を保持する。画面表示時に取得し、明示的な再読み込み操作で再取得する
- **バリデーション**: クエリパラメータを取らない画面のため入力バリデーションは不要。取得結果が空配列のときは `EmptyState` を表示する
- **ローディング**: 取得中は `AsyncSection` 経由で `LoadingState`（`kind="card"` / `label="取置き中の予約を読み込み中"`）を表示する。画面側で `Skeleton` / `Spinner` を直接使わず、`animate-pulse` 等の独自 loading 表現も持たない
- **エラーハンドリング**: `EmptyState` / `Alert(destructive)` / `LoadingState` の 3 状態を必ず実装する。401 はログイン画面へ誘導する。5xx は再試行導線つき `Alert(destructive)` を `role="alert"` で通知する
- **日付書式**: `ui-design.md`「日付・期限の表示規約」に従う（arch SR-004）。API 上は ISO 8601（日付 `YYYY-MM-DD` / 日時は UTC オフセット付き）、画面の取置き期限は `YYYY年M月D日`（例 `2026年9月9日`）、取置き開始日時は `YYYY年M月D日 HH:mm` とする。残日数は日付と必ず併記し、文言は `あと{N}日`、超過は `{N}日超過` に統一する（「残り N 日」「N 日後」は使わない）
- **アクセシビリティ**: 期限当日の強調は色だけでなく「本日が受取期限です」の文言を伴う。件数の更新は `aria-live="polite"` で通知する
- **PII**: 表示するのは本人の利用者番号のみ。他利用者の情報へ到達する導線を置かない（arch SP-004 / 条件「個人情報参照可否条件」）

#### 操作フロー

1. 取置き案内メールのリンク、またはサイドバーの「取置き」から取置き中予約確認画面（ルート id `patron-hold-list` / 表示 URL: `/reservations/holds`）を開く
2. 期限当日の注意喚起がある場合は先に確認する
3. 取置きカードごとに書籍・受取期限（`YYYY年M月D日`）・残日数（`あと{N}日`）を確認する
4. 詳細を見る場合は `useAppNavigation().navigate("patron-hold-detail", { reservationId })` で取置き受取案内画面へ遷移する（表示 URL: `/reservations/holds/:reservationId`）
5. 予約全体を見る場合は `useAppNavigation().navigate("patron-reservation-list")` で予約状況一覧画面へ戻る（表示 URL: `/reservations`）

## コンポーネント設計

### MyHoldList

- **ベースコンポーネント**: `HoldPickupCard` + `ReservationStatusBadge` + `Alert(warning)` + `EmptyState`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | items | array | Yes | 取置き中の予約一覧（reservation_id, book_title, book_author, hold_started_at, hold_expires_at, days_remaining, reservation_status） |
  | userNumber | string | Yes | 窓口提示用の利用者番号（本人） |
  | expiringTodayCount | number | Yes | 取置き期限が当日の件数 |
  | loading | boolean | Yes | 読み込み中フラグ。取得中は `AsyncSection` 経由で `LoadingState`（`kind="card"`）を表示する |
  | error | string | No | エラーメッセージ |
  | onSelect | function | Yes | カード選択ハンドラ（取置き受取案内画面へ遷移） |
- **状態**: なし（表示専用）
- **イベント**: `onSelect`、`onNavigateToReservations`

## ティア完了条件（BDD）

```gherkin
Feature: 自分の取置き中の予約を照会する - 利用者ポータル

  Scenario: 取置き中の予約がカードで一覧表示される
    Given 本人の取置き中の予約が 2 件存在し days_remaining がそれぞれ 3 と 6 である
    When 利用者が取置き中予約確認画面 /reservations/holds を開く
    Then HoldPickupCard が 2 件表示される
    And それぞれに受取期限が「YYYY年M月D日」形式で表示される
    And それぞれに残日数「あと3日」「あと6日」が表示される

  Scenario: 期限当日の件数を上部で注意喚起する
    Given 本人の取置き中の予約のうち 1 件が期限当日である
    When 利用者が取置き中予約確認画面 /reservations/holds を開く
    Then Alert(warning) に「本日が受取期限の取置きが 1 件あります」が表示される
    And 該当カードが variant deadline-today で表示される

  Scenario: 0 件のときに空状態と導線を表示する
    Given 本人の取置き中の予約が 0 件である
    When 利用者が取置き中予約確認画面 /reservations/holds を開く
    Then EmptyState(with-action) に「取置き中の予約はありません」が表示される
    And 予約状況一覧画面 /reservations への導線が表示される

  Scenario: カードから受取案内へ遷移する
    Given 本人の取置き中の予約 R-0007 がカードで表示されている
    When 利用者がカードを選択する
    Then 取置き受取案内画面 /reservations/holds/R-0007 へ遷移する
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（取置き受取案内画面 / 予約状況一覧画面） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（`kind="card"`）。`AsyncSection` の `skeleton` prop 経由で間接利用する |
| `AsyncSection` | `@/components/common/AsyncSection` | MyHoldList の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"card"`（カード群の取得） / `label` ← `"取置き中の予約を読み込み中"` |
| `AsyncSection` | `loading` ← MyHoldList の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"card"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"取置き中の予約を読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useListQueryState` | `@/components/common/hooks/useListQueryState` | 検索条件・ページをルーティングのクエリパラメータと同期する（画面をまたぐ共有状態を持たない / arch LR-026） |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 本 UC の一覧はページ送りを伴わないため `DataListSection` を使わず、`AsyncSection` + Domain テーブルの直接組み合わせとする（common-components.md の参考）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
