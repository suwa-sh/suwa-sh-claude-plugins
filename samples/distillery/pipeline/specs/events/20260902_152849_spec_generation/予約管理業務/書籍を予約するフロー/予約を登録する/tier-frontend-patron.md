# 予約を登録する - 利用者ポータル仕様

## 変更概要

書籍予約申込画面を追加し、貸出中の書籍に対する予約申込を受け付ける。申込前に見込み順位と重複予約の有無を提示し、予約可否条件・重複予約禁止条件に該当する場合は肯定形の案内で申込を抑止する。送信は冪等キー付きの単一 POST とし、二重送信を防止する。

## 画面仕様

### 書籍予約申込画面

- **URL**: `/books/:bookId/reserve`
- **アクセス権**: 利用者（ログイン済み。役割=利用者）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | `PortalShell`（variant: patron） | サイドバー + ヘッダー + 本文の骨格 |
| 予約対象書籍 | カード | `BookCard`（variant: on-loan） | タイトル・著者・ISBN・出版社・ジャンル・資料種別・書籍状態・予約件数を表示 |
| 見込み予約順位 | ステッパー | `ReservationQueueTracker` | 申込した場合の見込み順位と待ち人数を「予約中 → 取置き中 → 貸出済み」の段階で提示 |
| 予約可否の案内 | 通知 | `Alert`（info / warning） | 在庫ありの場合は「予約せずにそのまま借りられます」、重複予約の場合は「すでに予約済みです」を表示 |
| 予約する | ボタン | `Button`（default / md） | 予約申込を送信する主操作。送信中は `disabled` かつ `aria-busy="true"` |
| 予約内容の確認 | モーダル | `Modal`（confirm / sm） | 対象書籍名を再掲して申込を確定する |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 本文色 | `var(--semantic-foreground)` | `var(--color-gray-900)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-blue-700)` |
| 予約中の状態色 | `var(--semantic-info)` | `var(--color-blue-600)` |
| 予約不可の案内色 | `var(--semantic-warning)` | `var(--color-amber-600)` |
| ページ余白 | `var(--page-padding)` | `var(--spacing-6)` |
| カード内余白 | `var(--card-padding)` | `var(--spacing-6)` |

#### UIロジック

- **状態管理**: 画面ローカルの状態として `book`（対象書籍）・`submitting`・`error`・`confirmOpen` を保持する（`L-frontend-patron-view` の責務）。サーバ状態の正本は Backend API とし、成功後は予約順位確認画面へ遷移して再取得する
- **申込前情報の取得元**: 本 UC が追加する API は `POST /api/v1/reservations` の 1 本のみで、申込前に表示する値は既存 API から取得する。`expectedRank` は書籍詳細・在庫状況照会 API（UC「書籍詳細と在庫状況を照会する」の `GET /api/v1/books/{book_id}/availability`）が返す有効予約件数 `reservation_count` から `expectedRank = reservation_count + 1` として算出する。`alreadyReserved` は `GET /api/v1/me/reservations`（UC「自分の予約状況を照会する」）の `items[]` に同一 `book_id` かつ `reservation_status` が「予約中」「取置き中」の予約が含まれるかで判定する。有効予約件数（`totalReservations`）は同じ書籍詳細・在庫状況照会 API の `reservation_count` をそのままマッピングして用いる（`totalReservations ← reservation_count`）。専用の申込プレビュー API は設けない
- **バリデーション**: `bookId` がルートパラメータとして存在すること。書籍状態が「貸出中」でない場合は主操作ボタンを非活性にし、理由を `Alert` で示す
- **ローディング**: 書籍取得が 0.4 秒を超える可能性があるため `Skeleton`（line）を表示する（ドハティの閾値。NFR B.2.1.1 レスポンス 5 秒以内）
- **エラーハンドリング**: 409（予約可否条件 / 重複予約禁止条件）は `Alert(warning)` に業務メッセージを表示し、404 は `Alert(destructive)` で「対象の書籍が見つかりません」を表示する。5xx は再試行導線つきの `Alert(destructive)` を `role="alert"` で通知する
- **二重送信防止**: 申込ごとに UUID の冪等キーを生成し `X-Idempotency-Key` に付与する。送信中は `Button` を `disabled` かつ `aria-busy="true"` にする（arch SR-002）
- **PII**: 予約申込画面では他利用者の情報を一切表示しない。待ち人数は件数のみを示す（arch SP-004 / 条件「個人情報参照可否条件」）

#### 操作フロー

1. 書籍詳細・在庫状況画面から「予約する」を選び `/books/:bookId/reserve` へ遷移する
2. 対象書籍と見込み予約順位（例: 順位 3 / 自分より前に 2 人）を確認する
3. 「予約する」を押下し、`Modal(confirm)` で書籍名を再確認して確定する
4. 送信完了後、予約順位確認画面 `/reservations/:reservationId/rank` へ遷移する
5. 予約不可（在庫あり / 重複予約）の場合は `Alert` の案内を読み、蔵書検索画面または予約状況一覧画面へ戻る

## コンポーネント設計

### ReservationApplyPanel

- **ベースコンポーネント**: `Card` + `ReservationQueueTracker` + `Button`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | book | object | Yes | 予約対象書籍（book_id, title, author, isbn, publisher, genre, material_type, book_status） |
  | expectedRank | number | Yes | 申込した場合の見込み予約順位 |
  | alreadyReserved | boolean | Yes | 重複予約禁止条件に該当するか |
  | submitting | boolean | Yes | 送信中フラグ |
  | onSubmit | function | Yes | 予約申込の送信ハンドラ |
- **状態**: `confirmOpen`（確認モーダルの開閉）
- **イベント**: `onSubmit`（申込確定）、`onCancel`（モーダルを閉じる）

### ReservationQueueTracker（既存ドメインコンポーネントの利用）

- **ベースコンポーネント**: `ReservationQueueTracker`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | state | string | Yes | 予約状態。本画面では申込前のプレビューとして「予約中」を渡す |
  | rank | number | Yes | 見込み予約順位 |
  | totalReservations | number | Yes | 対象書籍の有効予約件数 |
  | bookTitle | string | Yes | 書籍タイトル |
- **状態**: なし（表示専用）
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 予約を登録する - 利用者ポータル

  Scenario: 貸出中の書籍で予約申込を送信できる
    Given 書籍「吾輩は猫である」（書籍ID B-0001）の書籍状態が「貸出中」で有効予約が 2 件ある
    And 利用者「田中太郎」が書籍予約申込画面 /books/B-0001/reserve を開いている
    When 利用者が「予約する」を押下し確認モーダルで確定する
    Then POST /api/v1/reservations が X-Idempotency-Key 付きで 1 回だけ送信される
    And 予約順位確認画面 /reservations/:reservationId/rank へ遷移する

  Scenario: 在庫ありの書籍では予約申込を送信できない
    Given 書籍「こころ」（書籍ID B-0003）の書籍状態が「在庫あり」
    When 利用者が書籍予約申込画面 /books/B-0003/reserve を開く
    Then 「予約せずにそのまま借りられます」という Alert(info) が表示される
    And 「予約する」ボタンが非活性になる

  Scenario: 重複予約は申込前に検知して案内する
    Given 利用者「田中太郎」が書籍 B-0001 に予約状態が「予約中」の予約を持つ
    When 利用者が書籍予約申込画面 /books/B-0001/reserve を開く
    Then 「すでに予約済みです」という Alert(warning) が表示される
    And 予約状況一覧画面への導線が示される

  Scenario: 送信中は二重送信を防止する
    Given 利用者が書籍予約申込画面 /books/B-0001/reserve で確認モーダルを確定した
    When レスポンス到着前に「予約する」を再度押下する
    Then ボタンは disabled かつ aria-busy="true" のままで追加のリクエストは送信されない
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | ReservationApplyPanel（見込み順位の取得） の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `ConfirmActionModal` | `@/components/common/ConfirmActionModal` | ReservationApplyPanel の確認モーダル（`Modal(confirm)`） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | ReservationApplyPanel の予約実行ボタン（`onSubmit`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← ReservationApplyPanel（見込み順位の取得） の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `ConfirmActionModal` | `open` ← モーダル開閉状態 / `tone` ← `"confirm"` / `title` `confirmLabel` ← 既存モーダルの文言 / `targetLabel` ← 対象書籍タイトル / `impact` ← 実行後に起きること（既存の説明文） / `onConfirm` `onCancel` `submitting` ← ReservationApplyPanel の確認モーダル（`Modal(confirm)`） の同名 props |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 表示要素の「ステッパー」は Domain の `ReservationQueueTracker` による進行表示である。共通フォームパターンが禁じる「入力 → 確認 → 完了の複数ページウィザード」のステッパーではない
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
