# 返却通知を送信する - 司書向けフロントエンド仕様

## 変更概要

司書ポータル（staff）に返却通知送信確認画面を追加する。返却受付画面（予約あり）から遷移し、ConfirmPanel で送信先（予約順位 1 位の利用者）と書籍要約を確認して送信を確定する。送信先の連絡先は PiiMaskedText で既定マスクし、送信記録を NotificationLogTable に表示する（ux-design「司書（窓口）」フロー、arch LP-034 / LR-025）。

## 画面仕様

### 返却通知送信確認画面

- **URL**: `/staff/returns/:loanId/notify`
- **アクセス権**: 司書（認証 + 利用者区分「司書」必須。館内経路のみ）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff） | サイドバー「窓口 > 返却受付」をアクティブ表示 |
| 確認パネル | フォーム | ConfirmPanel（primary / blocked） | 対象の要約（書籍名・送信先氏名）+ 影響（予約を通知済みにし返却通知メールを送る）+ 送信を確定 / 戻る |
| 送信先の連絡先 | テキスト | PiiMaskedText（email） | 送信先メールアドレスを既定マスク、目のアイコンで開示 |
| 予約一覧 | テーブル | ReservationTable（showUser） | 書籍の予約（順位 / 利用者 / 受付日時 / 状態）。順位 1 位を強調 |
| 予約の状態 | バッジ | ReservationStatusBadge（dot） | 予約中（warning）/ 通知済み（analysis） |
| 通知記録 | テーブル | NotificationLogTable | この予約に対する返却通知の送信記録（通知種別 / 送信先 / 送信日時 / 送信結果）。折りたたみ表示 |
| 処理結果 | 通知 | Alert（success / warning / destructive） | 「返却通知を受け付けました」「送信できません: {根拠}」「送信に失敗しました」 |
| 予約状況へ / 返却受付へ | ボタン | Button（secondary） | 書籍別予約状況画面（/staff/books/:bookId/reservations）/ 返却受付画面へ遷移 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white)（dark: var(--color-gray-900)） |
| アクセント（staff primary） | var(--primary) | var(--color-slate-700)（#334155） |
| 送信確定ボタン | var(--primary) / var(--primary-foreground) | slate-700 / white |
| 予約中バッジ | var(--warning) / var(--warning-light) | amber 系 |
| 通知済みバッジ | var(--analysis) / var(--analysis-light) | violet 系 |
| 送信結果 成功 / 失敗 | var(--success) / var(--destructive) | green / red 系 |
| マスク表示 | pii.masked_color / pii.masked_bg | var(--foreground-muted) / var(--background-muted) |

#### UIロジック

- **状態管理**: 画面内状態（2 層構成）: `phase`（default / sent / failed / blocked）、`preview`（book, reservation, recipient, reservations[], notifications[]）、`submitting`、`error`、`idempotencyKey`、`revealed`（連絡先開示フラグ。永続化しない）
- **バリデーション**: 入力項目なし。`preview.reservation` が無い（予約者なし）場合は ConfirmPanel を blocked にし「送信を確定」を無効化する
- **ローディング**: プレビュー取得中は Skeleton（card + table）。確定送信中は「送信を確定」を disabled + Spinner
- **エラーハンドリング**: プレビュー GET が 200 で `canSend = false` のとき `blockedReason`（`NO_RESERVATION_TO_NOTIFY` / `LOAN_NOT_RETURNED` / `RETURN_NOTICE_ALREADY_SENT`）に応じて blocked 表示にする（`RETURN_NOTICE_ALREADY_SENT` は Alert（warning）「本日すでに返却通知を送信済みです」を併記）。POST の 409 `NO_RESERVATION_TO_NOTIFY` / `LOAN_NOT_RETURNED` は blocked 表示、POST の 409 `RETURN_NOTICE_ALREADY_SENT` は Alert（warning）「本日すでに返却通知を送信済みです」+ 通知記録を再取得、404 `LOAN_NOT_FOUND` は EmptyState「貸出が見つかりません」+ 返却受付へ。401 は IdP ログインへ、403 は「司書のみ操作できます」。5xx / ネットワークエラーは「送信を受け付けられませんでした。再試行してください」（同じ冪等キーで再送可）
- **送信結果の確認**: 202 受付後は「返却通知を受け付けました（送信中）」を表示し、通知記録を 3 秒後に 1 回再取得して送信結果（成功 / 失敗）を反映する。失敗のときは Alert（destructive）「送信に失敗しました。連絡先を確認してください」
- **二重送信防止**: 確定成功後は履歴を replace し、ブラウザの戻るで確認状態に戻れないようにする（SR-005）
- **個人情報**: 連絡先は既定マスク。開示状態は画面内メモリのみ（LR-025）。ブラウザログに出力しない

#### 操作フロー

1. 返却受付画面の「返却通知を送信する」から遷移する（直接 URL アクセス時もプレビューを表示する）
2. `GET /api/v1/loans/{loanId}/return-notice` で書籍・送信先・予約一覧・通知記録を取得する
3. ConfirmPanel に「{書籍名} の返却を {氏名}（予約順位 1 位）に通知します」と影響「予約を通知済みにし、返却通知メールを送信します」を表示する
4. 司書が「送信を確定」を押す → `POST /api/v1/notifications/return-notices {loanId}`（Idempotency-Key 付き）
5. sent: 「返却通知を受け付けました」を表示。通知記録を再取得して送信結果を反映する
6. 「予約状況へ」で書籍別予約状況画面、「返却受付へ」で返却受付画面に戻る

## コンポーネント設計

### ReturnNoticeConfirmPage

- **ベースコンポーネント**: PortalShell（staff） + ConfirmPanel + ReservationTable + NotificationLogTable
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loanId | string | Yes | ルートパラメータ |
- **状態**: `phase`、`preview`、`submitting`、`error`、`idempotencyKey`、`revealed`
- **イベント**: `onConfirm()`、`onBack()`、`onReveal()`、`onRefreshLogs()`

### ConfirmPanel（UC 固有 Props）

- **ベースコンポーネント**: ConfirmPanel（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | title | string | Yes | 「返却通知を送信します」 |
  | summary | ReactNode | Yes | 書籍名・送信先氏名・PiiMaskedText（email）・予約順位 |
  | impact | string | Yes | 「予約を通知済みにし、返却通知メールを送信します」 |
  | tone | "primary" | Yes | 送信は primary トーン |
  | blocked | boolean | Yes | 予約者なし / 貸出未返却のとき true |
  | submitting | boolean | Yes | 送信中 |
  | onConfirm / onCancel | () => void | Yes | 確定 / 戻る |

### NotificationLogTable（UC 固有 Props）

- **ベースコンポーネント**: NotificationLogTable（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | logs | NotificationLog[]（notificationId, notificationType, recipientMasked, sentAt, sendResult） | Yes | 対象予約の通知記録 |
  | loading | boolean | Yes | 再取得中 |

## ティア完了条件（BDD）

```gherkin
Feature: 返却通知を送信する - 司書向けフロントエンド

  Scenario: 送信先をマスク表示して確認パネルを表示する
    Given 司書が /staff/returns/L-0002/notify を開いている
    And GET /api/v1/loans/L-0002/return-notice が {book: {title: "こころ"}, reservation: {queuePosition: 1, status: "RESERVED"}, recipient: {name: "山田太郎", emailMasked: "u2***@example.com"}} を返す
    When プレビューの取得が完了する
    Then ConfirmPanel に「こころ の返却を 山田太郎（予約順位 1 位）に通知します」と表示される
    And 連絡先は「u2***@example.com」とマスク表示され「メールアドレスを表示」ボタンがある
    And 「送信を確定」ボタンが有効である

  Scenario: 送信を確定して受付結果を表示する
    Given ConfirmPanel が default 表示である
    When 「送信を確定」を押し POST /api/v1/notifications/return-notices が HTTP 202 {notificationId: "N-0001", sendResult: "PENDING"} を返す
    Then 送信中は「送信を確定」が disabled になり Spinner が表示される
    And Alert（success）に「返却通知を受け付けました」が表示される
    And 通知記録が再取得され NotificationLogTable に「返却通知 / 送信待ち」の行が表示される

  Scenario: 予約者がいない場合は送信できない
    Given GET /api/v1/loans/L-0001/return-notice が HTTP 200 {canSend: false, blockedReason: "NO_RESERVATION_TO_NOTIFY", reservation: null} を返す
    When 司書が /staff/returns/L-0001/notify を開く
    Then ConfirmPanel が blocked 表示になり「送信できません: この書籍に予約者はいません」が表示される
    And 「送信を確定」ボタンは無効である

  Scenario: 同日送信済みの場合は警告を表示する
    Given ConfirmPanel が default 表示である
    When 「送信を確定」を押し HTTP 409 {code: "RETURN_NOTICE_ALREADY_SENT"} が返る
    Then Alert（warning）に「送信できません: 本日すでに返却通知を送信済みです」が表示される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称: S-返却通知）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|---------------|-------------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'counter'、activeItem = 'returnRegister' |
| ConfirmPage | `@/components/common/ConfirmPage` | title = 「返却通知を送信します」、tone = 'primary'、blocked = !preview.canSend（`NO_RESERVATION_TO_NOTIFY` / `LOAN_NOT_RETURNED`）、summary = 書籍名・送信先氏名・PiiMaskedText（email）・予約順位、impact = 「予約を通知済みにし、返却通知メールを送信します」、supplement = ReservationTable（showUser）+ CollapsibleSection(NotificationLogTable)、loading = プレビュー取得中、loadError = プレビュー error（404 `LOAN_NOT_FOUND` → emptyState「貸出が見つかりません」+ 返却受付へ）、submitting = submitting、submitError = POST error（409 `RETURN_NOTICE_ALREADY_SENT` は Alert（warning）+ onRefreshLogs）、confirmLabel = 「送信を確定」、onConfirm = onConfirm、onCancel = onBack、doneActions = [{label:「予約状況へ」, onClick: → `/staff/books/{bookId}/reservations`}, {label:「返却受付へ」, onClick: → `/staff/returns/new`, variant:'secondary'}] |
| PageHeader / AsyncStateView / ErrorAlert / BackLink / SubmitButton | ConfirmPage 内部で利用 | ErrorAlert.audience = 'staff'（403 → 「司書のみ操作できます」）。SubmitButton.label = confirmLabel、submitting = submitting |
| CollapsibleSection | `@/components/common/CollapsibleSection` | title = 「通知記録」、open / onToggle = 画面内状態、count = preview.notifications.length、children = NotificationLogTable（loading = 再取得中） |

使用する共通 hooks:

- `useIdempotencyKey`（`@/components/common/hooks/useIdempotencyKey`）: idempotencyKey の生成・再送（5xx / ネットワーク）・確定成功で破棄
- `usePiiReveal`（`@/components/common/hooks/usePiiReveal`）: revealed（送信先 email の開示状態。画面内のみ）
- `useDelayedLoading`: ConfirmPage 内部（Skeleton card + table）
