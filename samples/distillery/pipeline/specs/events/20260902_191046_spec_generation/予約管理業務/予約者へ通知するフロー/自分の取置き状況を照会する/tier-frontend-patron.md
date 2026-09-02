# 自分の取置き状況を照会する - 利用者ポータル仕様

## 変更概要

取置き受取案内画面を追加し、取置き中の予約 1 件について書籍・取置き期限・残日数・窓口提示用の利用者番号を提示する。取置き案内メールからの着地点となる画面であり、期限当日は `HoldPickupCard` の `deadline-today` で強調する。

## 画面仕様

### 取置き受取案内画面

- **ルート id**: `patron-hold-detail`
- **URL**: `/reservations/holds/:reservationId`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 利用者（ログイン済み。役割=利用者。本人の予約のみ）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | `PortalShell`（variant: patron） | サイドバー + ヘッダー + 本文の骨格 |
| 取置き案内 | カード | `HoldPickupCard`（variant: default / deadline-today） | 書籍タイトル・著者・取置き開始日時（`YYYY年M月D日 HH:mm`）・取置き期限（`YYYY年M月D日`）と残日数（`あと{N}日`、超過は `{N}日超過`）・窓口提示用の利用者番号を表示 |
| 期限の注意喚起 | 通知 | `Alert`（warning） | 期限当日に「本日が受取期限」を表示（`ui-design.md` の当日表記に揃えた取置き期限版） |
| 取置き対象外の案内 | 通知 | `Alert`（info） | 予約状態が「取置き中」でない場合に現在の状態と次の導線を示す |
| 予約を取り消す | ボタン | `Button`（outline / md） | 予約取消受付の導線（窓口での取消受付につなぐ） |
| 読み込み中 | ローディング | `LoadingState`（`kind="card"`, `label="取置き状況を読み込み中"`） | 共通の loading 表現。取得中に表示（`delayMs=300`） |
| 予約状況一覧へ | ボタン | `Button`（ghost / md） | `useAppNavigation().navigate("patron-reservation-list")` で予約状況一覧画面（表示上は `/reservations`）へ遷移する |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 本文色 | `var(--semantic-foreground)` | `var(--color-gray-900)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-blue-700)` |
| 取置き中の状態色 | `var(--semantic-warning)` | `var(--color-amber-600)` |
| カード内余白 | `var(--card-padding)` | `var(--spacing-6)` |
| 見出しサイズ | `var(--font-size-2xl)` | `1.5rem` |
| 利用者番号の書体 | `var(--font-family-mono)` | `JetBrains Mono, SFMono-Regular, Consolas, Menlo, monospace` |

#### UIロジック

- **状態管理**: 画面ローカルに `hold`（取置き状況）・`loading`・`error` を保持する。予約状態はサーバ状態の写しであり画面側で書き換えない
- **バリデーション**: `reservationId` がルートパラメータとして存在すること。形式不正時は予約状況一覧画面への導線つき `EmptyState` を表示する
- **ローディング**: 取得中は `LoadingState`（`kind="card"` / `label="取置き状況を読み込み中"`）を `AsyncSection` 経由で表示する。画面側で `Skeleton` / `Spinner` を直接使わない
- **エラーハンドリング**: 404（本人の予約でない / 存在しない）は `EmptyState`（with-action）で「対象の予約が見つかりません」と予約状況一覧への導線を示す。401 はログイン画面へ誘導する。5xx は再試行導線つき `Alert(destructive)` を `role="alert"` で通知する
- **日付書式**: `_cross-cutting/ux-ui/ui-design.md`「日付・期限の表示規約」に従う。取置き期限は `YYYY年M月D日`（`toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })`）、取置き開始日時は `YYYY年M月D日 HH:mm`、残日数は `あと{N}日`（当日は「本日が受取期限」、超過は `{N}日超過`）とし、日付と残日数を必ず併記する（例: `2026年9月9日（あと3日）`）。API 上は ISO 8601 date-time のまま扱い、表示時にのみ変換する（arch SR-004 / 色に依存しない表現）
- **アクセシビリティ**: 取置き期限の残日数は色（`deadline-today`）だけでなく文言で示す。利用者番号は等幅・大きめの文字サイズで提示し、`aria-label` に「窓口提示用の利用者番号」を付与する
- **PII**: 表示するのは本人の利用者番号のみ。氏名・連絡先は表示しない（arch SP-004 / 条件「個人情報参照可否条件」）

#### 操作フロー

1. 取置き案内メールのリンク、または取置き中予約確認画面から `useAppNavigation().navigate("patron-hold-detail")`（表示上は `/reservations/holds/:reservationId`）で遷移する
2. 書籍・取置き期限・残日数を確認する
3. 窓口提示用の利用者番号を確認する
4. 期限当日の場合は `Alert(warning)` の注意喚起を確認して来館する
5. 受け取らない場合は `useAppNavigation().navigate("patron-reservation-list")` で予約状況一覧画面へ戻り、予約取消受付の導線をたどる

## コンポーネント設計

### HoldPickupPanel

- **ベースコンポーネント**: `HoldPickupCard` + `Alert` + `Button`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | bookTitle | string | Yes | 取置き対象書籍のタイトル |
  | author | string | Yes | 著者 |
  | holdStartAt | string | No | 取置き開始日時（API の `hold_started_at`。ISO 8601 date-time。表示は `YYYY年M月D日 HH:mm`） |
  | holdDeadline | string | Yes | 取置き期限 |
  | daysRemaining | number | Yes | 取置き期限までの残日数 |
  | userNumber | string | Yes | 窓口提示用の利用者番号 |
  | reservationStatus | string | Yes | 予約状態（取置き中 / 予約中 / 貸出済み / キャンセル） |
  | loading | boolean | Yes | 読み込み中フラグ。`AsyncSection` 経由で `LoadingState`（`kind="card"`）を表示する |
  | onCancel | function | No | 予約取消の導線ハンドラ |
- **状態**: なし（表示専用）
- **イベント**: `onCancel`、`onNavigateToList`

## ティア完了条件（BDD）

```gherkin
Feature: 自分の取置き状況を照会する - 利用者ポータル

  Scenario: 取置き中の予約で受取案内カードが表示される
    Given 予約 R-0007 の予約状態が「取置き中」で取置き期限（API 上は ISO 8601 の 2026-09-09）、残日数が 3 である
    When 利用者が取置き受取案内画面 /reservations/holds/R-0007 を開く
    Then HoldPickupCard に「受取期限 2026年9月9日（あと3日）」が表示される
    And 窓口提示用の利用者番号が等幅で大きく表示される

  Scenario: 期限当日は deadline-today で強調される
    Given 予約 R-0100 の取置き期限が当日で残日数が 0 である
    When 利用者が取置き受取案内画面 /reservations/holds/R-0100 を開く
    Then HoldPickupCard が variant deadline-today で表示される
    And Alert(warning) に「本日が受取期限」が表示される

  Scenario: 取置き中でない予約では案内を出し分ける
    Given 予約 R-0007 の予約状態が「予約中」である
    When 利用者が取置き受取案内画面 /reservations/holds/R-0007 を開く
    Then Alert(info) に「まだ取置きされていません」と現在の状態が表示される
    And 予約順位確認画面への導線が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（予約状況一覧画面・予約順位確認画面へのルート id 指定遷移） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（`kind="card"`）。画面側の `Skeleton` / `Spinner` 直接利用を置き換える |
| `AsyncSection` | `@/components/common/AsyncSection` | HoldPickupPanel の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"line"`（1〜数行の部分取得） / `label` ← `"取置き状況を読み込み中"` / `delayMs` ← `300` |
| `AsyncSection` | `loading` ← HoldPickupPanel の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `LoadingState` の `label` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
