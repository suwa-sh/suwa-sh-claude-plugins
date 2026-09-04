# 予約を取り消す - 利用者向けフロントエンド仕様

## 変更概要

利用者ポータル（patron）に予約取消画面を追加する。マイ予約状況画面の行内操作から遷移し、ConfirmPanel（destructive）に対象書籍の要約と「後続の順位が繰り上がる」影響を明示して取消を確定する（ux-design「利用者: 自分の利用状況を確認し、不要な予約を取り消す」）。確定後はマイ予約状況画面に戻り Alert（success）で完了を伝える。確定は冪等キー付きで二重送信を防ぐ（LR-021 / LP-033）。

## 画面仕様

### 予約取消画面

- **URL**: `/reservations/:reservationId/cancel`
- **アクセス権**: 利用者（認証必須。本人の予約のみ。未認証時は IdP ログインへ遷移し、ログイン後に元 URL へ戻す）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（patron） | トップナビ「マイ予約状況」をアクティブ表示 |
| 予約の状態 | バッジ | ReservationStatusBadge（dot） | 予約中（warning）/ 通知済み（analysis）/ 取消（neutral） |
| 確認パネル | フォーム | ConfirmPanel（destructive / blocked） | 対象の要約（書籍名・著者・予約順位・受付日時）+ 影響（後続の順位が繰り上がる。通知済みなら次の方に通知される）+ 予約を取り消す / 戻る |
| 処理結果・判定結果 | 通知 | Alert（success / destructive） | 「予約を取り消しました」（遷移先で表示）「取り消せません: {根拠}」「この予約は表示できません」 |
| 読み込み中 | プレースホルダ | Skeleton（card） | 予約詳細の取得待ち（0.4 秒超で表示） |
| 予約が見つからない | 空状態 | EmptyState（with-action） | 404 / 403 のとき。アクション「マイ予約状況へ」 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（patron primary） | var(--primary) | var(--color-blue-600)（#2563EB） |
| 取消確定ボタン | var(--destructive) / var(--primary-foreground) | red-600 / white |
| 予約中バッジ | var(--warning) / var(--warning-light) | amber 系 |
| 通知済みバッジ | var(--analysis) / var(--analysis-light) | violet 系 |
| 取消バッジ | var(--neutral) / var(--neutral-light) | gray 系 |
| モーダル / パネル | modal.radius / modal.padding | var(--radius-xl) / var(--spacing-6) |

#### UIロジック

- **状態管理**: 画面内状態（2 層構成）: `phase`（loading / default / blocked / submitting / forbidden / notFound / error）、`reservation`（reservationId, book, queuePosition, totalWaiting, status, acceptedAt, canCancel, blockedReason）、`idempotencyKey`
- **バリデーション**: 入力項目なし。`reservation.canCancel = false`（取消 / 終了）のときは ConfirmPanel を blocked にして確定を無効化する
- **ローディング**: 予約詳細取得中は Skeleton（card）。確定送信中は「予約を取り消す」を disabled + Spinner
- **エラーハンドリング**: 403 `FORBIDDEN`（他人の予約）と 404 `RESERVATION_NOT_FOUND` は EmptyState「この予約は表示できません」+ マイ予約状況へ（詳細な理由は出さない。LP-031）。409 `RESERVATION_NOT_CANCELLABLE` は blocked 表示「取り消せません: この予約はすでに終了しています」。401 は IdP ログインへ。5xx / ネットワークエラーは「取消を受け付けられませんでした。再試行してください」（同じ冪等キーで再送可）
- **完了後の遷移**: 200 受信後は履歴を replace してマイ予約状況画面（`/me/reservations?notice=cancelled`）へ遷移し、Alert（success）「予約を取り消しました」を表示する（LR-021 / ux-design 遷移ルール）
- **個人情報**: 本人データは画面内メモリのみ（LP-030 / SR-002）

#### 操作フロー

1. マイ予約状況画面の行内「取り消す」（状態が予約中 / 通知済みのとき表示）から遷移する
2. `GET /api/v1/reservations/{reservationId}` で予約詳細を取得し、ConfirmPanel に「{書籍名}（予約順位 {N} 位）の予約を取り消します」を表示する
3. 影響文言: 予約中なら「取り消すと、後続の方の順位が繰り上がります」、通知済みなら「取り消すと、次の順位の方に返却通知が送られます。再度予約する場合は末尾の順位になります」
4. 利用者が「予約を取り消す」を押す → `POST /api/v1/reservations/{reservationId}/cancel`（Idempotency-Key 付き）
5. 200 でマイ予約状況画面へ戻り Alert（success）を表示する
6. 「戻る」はマイ予約状況画面（論理上の親画面）へ

## コンポーネント設計

### ReservationCancelPage

- **ベースコンポーネント**: PortalShell（patron） + ConfirmPanel + ReservationStatusBadge
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | reservationId | string | Yes | ルートパラメータ |
- **状態**: `phase`、`reservation`、`submitting`、`error`、`idempotencyKey`
- **イベント**: `onConfirm()`、`onBack()`

### ConfirmPanel（UC 固有 Props）

- **ベースコンポーネント**: ConfirmPanel（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | title | string | Yes | 「予約を取り消します」 |
  | summary | ReactNode | Yes | 書籍名・著者・ReservationStatusBadge・予約順位・受付日時 |
  | impact | string | Yes | 状態に応じた影響文言（順位繰り上げ / 次順位への通知） |
  | tone | "destructive" | Yes | 取消は destructive トーン |
  | blocked | boolean | Yes | canCancel = false のとき true |
  | submitting | boolean | Yes | 送信中 |
  | onConfirm / onCancel | () => void | Yes | 確定 / 戻る |

## ティア完了条件（BDD）

```gherkin
Feature: 予約を取り消す - 利用者向けフロントエンド

  Scenario: 予約中の予約の確認パネルを表示する
    Given 利用者が /reservations/R-0001/cancel を開いている
    And GET /api/v1/reservations/R-0001 が {book: {title: "こころ"}, queuePosition: 1, status: "RESERVED", canCancel: true} を返す
    When 予約詳細の取得が完了する
    Then ConfirmPanel に「こころ（予約順位 1 位）の予約を取り消します」と ReservationStatusBadge「予約中」が表示される
    And 影響に「取り消すと、後続の方の順位が繰り上がります」が表示される
    And 「予約を取り消す」ボタンが有効である

  Scenario: 取消を確定してマイ予約状況画面に戻る
    Given ConfirmPanel が有効表示である
    When 「予約を取り消す」を押し POST /api/v1/reservations/R-0001/cancel が HTTP 200 {status: "CANCELLED"} を返す
    Then 送信中は「予約を取り消す」が disabled になり Spinner が表示される
    And /me/reservations に遷移し Alert（success）「予約を取り消しました」が表示される

  Scenario: 他人の予約は表示しない
    Given GET /api/v1/reservations/R-0002 が HTTP 403 {code: "FORBIDDEN"} を返す
    When 利用者が /reservations/R-0002/cancel を開く
    Then EmptyState に「この予約は表示できません」と「マイ予約状況へ」ボタンが表示される

  Scenario: 終了した予約は取り消せない
    Given GET /api/v1/reservations/R-0001 が {status: "CANCELLED", canCancel: false, blockedReason: "RESERVATION_NOT_CANCELLABLE"} を返す
    When 利用者が /reservations/R-0001/cancel を開く
    Then ConfirmPanel が blocked 表示になり「取り消せません: この予約はすでに終了しています」が表示される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称: P-予約取消）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|---------------|-------------------------------------|
| PatronLayout | `@/components/common/PatronLayout` | activeNav = 'myReservations'、requireAuth = true |
| ConfirmPage | `@/components/common/ConfirmPage` | title = 「予約を取り消します」、tone = 'destructive'、blocked = !reservation.canCancel、summary = 書籍名・著者・ReservationStatusBadge・予約順位・受付日時、impact = 状態に応じた影響文言（順位繰り上げ / 次順位への通知）、loading = phase === 'loading'、loadError = 取得 error、emptyState = { title: 「この予約は表示できません」, action: { label: 「マイ予約状況へ」, onClick: → `/me/reservations` } }（403 / 404）、submitting = submitting、submitError = POST error（409 `RESERVATION_NOT_CANCELLABLE` は blocked 表示 + 「取り消せません: この予約はすでに終了しています」）、confirmLabel = 「予約を取り消す」、onConfirm = onConfirm、onCancel = onBack |
| PageHeader / AsyncStateView / ErrorAlert / BackLink / SubmitButton | ConfirmPage 内部で利用 | ErrorAlert.audience = 'patron'。SubmitButton.variant = 'destructive'。BackLink.to = `/me/reservations` |
| NoticeAlert（発行） | `@/components/common/NoticeAlert` | 発行のみ。確定成功後に `useNoticeNavigation` で `/me/reservations?notice=cancelled` へ replace 遷移（表示側は P-予約状況） |

使用する共通 hooks:

- `useIdempotencyKey`（`@/components/common/hooks/useIdempotencyKey`）: idempotencyKey の生成・再送・確定成功で破棄
- `useNoticeNavigation`（`@/components/common/hooks/useNoticeNavigation`）: 親パス `/me/reservations` + notice = 'cancelled' を replace で遷移
- `useDelayedLoading`: ConfirmPage 内部（Skeleton card）
