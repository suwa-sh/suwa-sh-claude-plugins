# 自分の予約順位を照会する - 利用者ポータル仕様

## 変更概要

予約順位確認画面を追加し、予約 1 件の進行段階（予約中 → 取置き中 → 貸出済み）と予約順位・待ち人数を提示する。目標勾配効果に基づき到達段階を数値と段階表示の両方で示し、待ちの不透明さを減らす。

## 画面仕様

### 予約順位確認画面

- **URL**: `/reservations/:reservationId/rank`
- **アクセス権**: 利用者（ログイン済み。役割=利用者。本人の予約のみ）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | `PortalShell`（variant: patron） | サイドバー + ヘッダー + 本文の骨格 |
| 予約の進行段階 | ステッパー | `ReservationQueueTracker` | 予約状態・予約順位・有効予約件数・取置き期限を段階表示する |
| 予約対象書籍 | カード | `BookCard`（variant: reserved） | タイトル・著者・ISBN・出版社・ジャンル・資料種別・書籍状態を表示 |
| 予約の状態 | バッジ | `ReservationStatusBadge` | 予約状態を dot + 文言で表示する（design の予約順位確認画面は `ReservationQueueTracker` のみだが、状態バッジ表示に本コンポーネントを利用する） |
| 順位サマリ | カード | `Card`（default） | 「順位 3 / 全 5 件」「あと 2 人」を等幅・桁揃えで表示 |
| 読み込み中 | スケルトン | `Skeleton`（line） | 取得が 0.4 秒を超える場合に表示（ドハティの閾値） |

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
| カード内余白 | `var(--card-padding)` | `var(--spacing-6)` |

#### UIロジック

- **状態管理**: 画面ローカルに `reservation`・`loading`・`error` を保持する。予約状態はサーバ状態の写しであり、画面側で書き換えない
- **バリデーション**: `reservationId` がルートパラメータとして存在すること。形式不正時は蔵書検索画面へ戻る導線つきの `EmptyState` を表示する
- **ローディング**: 取得中は `Skeleton`（line）を表示し、レイアウトシフトを避ける
- **エラーハンドリング**: 404（本人の予約でない / 存在しない）は `EmptyState`（with-action）で「対象の予約が見つかりません」と予約状況一覧への導線を示す。401 はログイン画面へ誘導する。5xx は再試行導線つき `Alert(destructive)` を `role="alert"` で通知する
- **アクセシビリティ**: 予約状態は色（dot）だけでなく状態名の文言を必ず伴う。順位の更新は `aria-live="polite"` で通知する（JIS X 8341-3 AA 目標 / NFR F.3.1.2）
- **PII**: 他利用者の氏名・連絡先・利用者番号は一切表示しない。待ち人数は件数のみ示す（arch SP-004 / 条件「個人情報参照可否条件」）

#### 操作フロー

1. 予約登録の完了後、または予約状況一覧画面から `/reservations/:reservationId/rank` へ遷移する
2. 予約状態と予約順位・待ち人数を確認する
3. 取置き中の場合は取置き期限と残日数を確認し、取置き受取案内画面への導線をたどる
4. 予約状況一覧画面へ戻る

## コンポーネント設計

### ReservationRankPanel

- **ベースコンポーネント**: `Card` + `ReservationQueueTracker` + `BookCard`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | reservation | object | Yes | 予約（reservation_id, reservation_status, priority, applied_at, hold_expires_at） |
  | book | object | Yes | 予約対象書籍（book_id, title, author, genre, material_type, book_status） |
  | waitingAhead | number | Yes | 自分より前に待っている人数（予約順位 - 1） |
  | totalReservations | number | Yes | 対象書籍の有効予約件数 |
  | loading | boolean | Yes | 読み込み中フラグ |
- **状態**: なし（表示専用）
- **イベント**: `onNavigateToHold`（取置き受取案内画面への遷移）

## ティア完了条件（BDD）

```gherkin
Feature: 自分の予約順位を照会する - 利用者ポータル

  Scenario: 予約中の予約で順位と待ち人数が表示される
    Given 予約 R-0007 の予約状態が「予約中」・予約順位が 3・有効予約件数が 5 である
    When 利用者が予約順位確認画面 /reservations/R-0007/rank を開く
    Then ReservationQueueTracker が「予約中」の段階を示す
    And 「順位 3 / 全 5 件」と「あと 2 人」が表示される

  Scenario: 取置き中の予約で取置き期限が表示される
    Given 予約 R-0100 の予約状態が「取置き中」・取置き期限が 2026-09-09 である
    When 利用者が予約順位確認画面 /reservations/R-0100/rank を開く
    Then 「取置き中」の状態バッジが文言つきで表示される
    And 取置き受取案内画面への導線が表示される

  Scenario: 対象が見つからない場合に代替導線を示す
    Given 予約 R-0500 が本人の予約ではない
    When 利用者が予約順位確認画面 /reservations/R-0500/rank を開く
    Then EmptyState(with-action) に「対象の予約が見つかりません」が表示される
    And 予約状況一覧画面 /reservations への導線が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | ReservationRankPanel の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← ReservationRankPanel の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 表示要素の「ステッパー」は Domain の `ReservationQueueTracker` による進行表示である。共通フォームパターンが禁じる「入力 → 確認 → 完了の複数ページウィザード」のステッパーではない
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
