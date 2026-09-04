# 予約を登録する - 利用者向けフロントエンド仕様

## 変更概要

利用者ポータル（patron）に予約申込画面を追加する。書籍詳細・在庫状況画面の CTA から遷移し、BookCard（detail）と ReservationQueueTracker で書籍と待ち人数を示し、ConfirmPanel（primary）で予約を確定する。在庫ありの書籍では ConfirmPanel を blocked にして「窓口でお借りいただけます」を案内する。確定は冪等キー付きで二重送信を防ぐ（arch SP-002 / LR-021 / LP-033）。

## 画面仕様

### 予約申込画面

- **URL**: `/books/:bookId/reserve`
- **アクセス権**: 利用者（認証必須。未認証時は IdP ログインへ遷移し、ログイン後に元 URL へ戻す）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（patron） | トップナビ「蔵書検索」をアクティブ表示 |
| 書籍要約 | カード | BookCard（detail） | タイトル / 著者 / ジャンル / 媒体種別 / 在庫状況（BookStatusBadge） |
| 予約の進行と待ち人数 | ステッパー | ReservationQueueTracker（waiting） | 申込前は「予約すると {N+1} 番目になります（あと {N} 人）」、完了後は position = 付与された順位 |
| 確認パネル | フォーム | ConfirmPanel（primary / blocked） | 対象の要約 + 影響（返却時に予約順で通知）+ 予約を確定 / 戻る |
| 処理結果・判定結果 | 通知 | Alert（success / info / destructive） | 「予約を受け付けました」「予約できません: {根拠}」 |
| マイ予約状況へ / 書籍詳細へ | ボタン | Button（default / secondary） | 完了後の導線: マイ予約状況画面（/me/reservations）、戻り先: 書籍詳細・在庫状況画面 |
| 読み込み中 | プレースホルダ | Skeleton（card） | 可否照会の待ち時間（0.4 秒超で表示） |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（patron primary） | var(--primary) | var(--color-blue-600)（#2563EB、dark: var(--color-blue-500)） |
| 予約確定ボタン | var(--primary) / var(--primary-foreground) | blue-600 / white |
| 予約中バッジ / トラッカー現在ステップ | var(--warning) / queue_tracker.current | amber-600 / var(--primary) |
| 予約不可 | var(--destructive) / var(--destructive-light) | red-600 / red-50 |
| 書籍の状態 貸出中 | var(--info) / var(--info-light) | blue 系 |
| 書籍の状態 予約待ち | var(--pending) / var(--pending-light) | orange 系 |

#### UIロジック

- **状態管理**: 画面内状態（2 層構成、状態管理層なし）: `phase`（loading / onLoan / alreadyAvailable / submitting / done / error）、`eligibility`（allowed, reasonCode, reasonMessage, waitingCount, expectedQueuePosition, book）、`reservation`（登録結果）、`idempotencyKey`（確定操作ごとに生成。再送時は同じ値）
- **バリデーション**: 入力項目なし。`eligibility.allowed = false` のときは ConfirmPanel を blocked にして確定を無効化する。利用者番号は送信しない（トークン由来）
- **ローディング**: 可否照会中は Skeleton（card）。確定送信中は「予約を確定」を disabled + Spinner
- **エラーハンドリング**: 409（`BOOK_AVAILABLE_NOT_RESERVABLE` / `RESERVATION_ALREADY_EXISTS` / `MEDIA_TYPE_NOT_RESERVABLE`）は「予約できません: {根拠}」を Alert（destructive）で表示し、在庫ありのときは「窓口でお借りいただけます」を添える（brand voice: 状態と次の行動をセットで伝える）。404 `BOOK_NOT_FOUND` は EmptyState「書籍が見つかりません」+ 蔵書検索へ。401 は IdP ログインへ。5xx / ネットワークエラーは「予約を受け付けられませんでした。再試行してください」（同じ冪等キーで再送可。LP-031）
- **二重送信防止**: 確定成功後は履歴を replace して確認状態に戻れないようにする（LR-021）
- **個人情報**: 本人データ（予約結果）は画面内メモリのみ。localStorage 等へ永続化しない（LP-030 / SR-002）

#### 操作フロー

1. 書籍詳細・在庫状況画面の「予約する」（状態が貸出中 / 予約待ちのとき表示）から遷移する
2. `GET /api/v1/books/{bookId}/reservation-eligibility` で可否・待ち人数を取得し、BookCard と ReservationQueueTracker を描画する
3. onLoan: ConfirmPanel に「{書籍名} を予約します。予約順位は {expectedQueuePosition} 位（あと {waitingCount} 人）の見込みです」を表示。alreadyAvailable: blocked 表示で「在庫があります。窓口でお借りいただけます」
4. 利用者が「予約を確定」を押す → `POST /api/v1/reservations {bookId}`（Idempotency-Key 付き）
5. done: Alert（success）「予約を受け付けました」と ReservationQueueTracker（position = 付与順位）を表示し、「マイ予約状況へ」を主要操作にする
6. 「戻る」は書籍詳細・在庫状況画面（論理上の親画面）へ

## コンポーネント設計

### ReservationApplyPage

- **ベースコンポーネント**: PortalShell（patron） + BookCard + ReservationQueueTracker + ConfirmPanel
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | bookId | string | Yes | ルートパラメータ |
- **状態**: `phase`、`eligibility`、`reservation`、`submitting`、`error`、`idempotencyKey`
- **イベント**: `onConfirm()`、`onBack()`、`onGoMyReservations()`

### ConfirmPanel（UC 固有 Props）

- **ベースコンポーネント**: ConfirmPanel（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | title | string | Yes | 「予約を申し込みます」 |
  | summary | ReactNode | Yes | 書籍名・著者・現在の状態・見込み順位 |
  | impact | string | Yes | 「返却されると予約順に返却通知メールをお送りします」 |
  | tone | "primary" | Yes | 予約は primary トーン |
  | blocked | boolean | Yes | allowed = false のとき true |
  | submitting | boolean | Yes | 送信中 |
  | onConfirm / onCancel | () => void | Yes | 確定 / 戻る |

### ReservationQueueTracker（UC 固有 Props）

- **ベースコンポーネント**: ReservationQueueTracker（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | state | "RESERVED" | Yes | 申込前後とも予約中ステップ |
  | position | number | Yes | 申込前: expectedQueuePosition、完了後: queuePosition |
  | total | number | Yes | 有効予約数（申込前: waitingCount + 1） |
  | variant | "waiting" | Yes | 待ち表示 |

## ティア完了条件（BDD）

```gherkin
Feature: 予約を登録する - 利用者向けフロントエンド

  Scenario: 貸出中の書籍で見込み順位を表示し確定ボタンを有効にする
    Given 利用者が /books/B-000789/reserve を開いている
    And GET /api/v1/books/B-000789/reservation-eligibility が {allowed: true, waitingCount: 2, expectedQueuePosition: 3, book: {title: "こころ", status: "RESERVED"}} を返す
    When 可否照会が完了する
    Then ReservationQueueTracker に「3 番目（あと 2 人）」が表示される
    And ConfirmPanel の「予約を確定」ボタンが有効である

  Scenario: 予約を確定して順位を表示する
    Given ConfirmPanel が有効表示である
    When 「予約を確定」を押し POST /api/v1/reservations が HTTP 201 {reservationId: "R-0003", queuePosition: 3, status: "RESERVED"} を返す
    Then 送信中は「予約を確定」が disabled になり Spinner が表示される
    And Alert（success）に「予約を受け付けました。予約順位: 3 位」が表示される
    And 「マイ予約状況へ」ボタンが表示される

  Scenario: 在庫ありの書籍では確定できない
    Given GET /api/v1/books/B-000456/reservation-eligibility が {allowed: false, reasonCode: "BOOK_AVAILABLE_NOT_RESERVABLE", reasonMessage: "この書籍は在庫があります"} を返す
    When 利用者が /books/B-000456/reserve を開く
    Then ConfirmPanel が blocked 表示になり「予約できません: この書籍は在庫があります。窓口でお借りいただけます」が表示される
    And 「予約を確定」ボタンは無効である

  Scenario: 確定時に 409 が返ったら根拠を表示する
    Given ConfirmPanel が有効表示である
    When 「予約を確定」を押し HTTP 409 {code: "RESERVATION_ALREADY_EXISTS", detail: "この書籍はすでに予約済みです"} が返る
    Then Alert（destructive）に「予約できません: この書籍はすでに予約済みです」が表示される
    And 「マイ予約状況へ」ボタンが表示される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称: P-予約登録）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|---------------|-------------------------------------|
| PatronLayout | `@/components/common/PatronLayout` | activeNav = 'search'、requireAuth = true |
| ConfirmPage | `@/components/common/ConfirmPage` | title = 「予約を申し込みます」、tone = 'primary'、blocked = !eligibility.allowed、summary = BookCard（detail）+ ReservationQueueTracker（state = 'RESERVED', variant = 'waiting', position = expectedQueuePosition, total = waitingCount + 1）、impact = 「返却されると予約順に返却通知メールをお送りします」（blocked 時は「在庫があります。窓口でお借りいただけます」）、loading = phase === 'loading'、loadError = 可否照会 error、emptyState = { title: 「書籍が見つかりません」, action: { label: 「蔵書検索へ」, onClick: → `/books` } }（404）、submitting = submitting、submitError = POST error（409 は 「予約できません: {根拠}」）、confirmLabel = 「予約を確定」、onConfirm = onConfirm、onCancel = onBack、doneActions = [{label:「マイ予約状況へ」, onClick: onGoMyReservations}, {label:「書籍詳細へ」, onClick: onBack, variant:'secondary'}] |
| PageHeader / AsyncStateView / ErrorAlert / BackLink / SubmitButton | ConfirmPage 内部で利用 | ErrorAlert.audience = 'patron'。SubmitButton.variant = 'default'。BackLink.to = `/books/{bookId}` |
| NoticeAlert（発行） | `@/components/common/NoticeAlert` | 発行のみ。done 後の「マイ予約状況へ」は `useNoticeNavigation` で `/me/reservations?notice=created` へ遷移（表示側は P-予約状況） |

使用する共通 hooks:

- `useIdempotencyKey`（`@/components/common/hooks/useIdempotencyKey`）: idempotencyKey の生成・再送・確定成功で破棄
- `useNoticeNavigation`（`@/components/common/hooks/useNoticeNavigation`）: 親パス `/me/reservations` + notice = 'created'
- `useDelayedLoading`: ConfirmPage 内部（Skeleton card）
