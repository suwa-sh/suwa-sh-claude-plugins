# 予約を取り消す - 司書ポータル仕様

## 変更概要

司書が窓口で予約取消を受け付ける予約取消受付画面を追加する。対象予約を特定したうえで `Modal(destructive-confirm)` による意図的な壁を置き、取消後は繰り上げ件数と書籍状態の変化を完了サマリとして提示する。

> 注: design-event.yaml の screens では「予約取消受付画面」が portal=patron に割り当てられているが、RDRA の BUC.tsv では本 UC のアクターが司書であるため司書ポータルで仕様化する（既知のねじれ。todo 登録済み）。ルート・コンポーネント構成は design の定義を踏襲する。

## 画面仕様

### 予約取消受付画面

- **URL**: `/reservations/:reservationId/cancel`（design-event.yaml の route。司書ポータルのナビゲーション空間で提供する）
- **アクセス権**: 司書（ログイン済み。役割=司書。館内ネットワークからのみアクセス可 / NFR E.5.3.1）
- **ポータル**: staff（design-event.yaml では patron。上記ねじれの注記を参照）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | `PortalShell`（variant: staff） | サイドバー + ヘッダー + 本文の骨格 |
| 対象予約の状態 | バッジ | `ReservationStatusBadge` | 予約状態（予約中 / 取置き中 / 貸出済み / キャンセル）を dot + 文言で表示 |
| 取消不可の理由 | 通知 | `Alert`（warning / destructive） | 貸出済み・キャンセル済みで取消できない場合に根拠となる予約状態を示す |
| 取消の確認 | モーダル | `Modal`（destructive-confirm / md） | 書籍名・利用者番号・予約順位を再掲して取消を確定する |
| 取消を実行 | ボタン | `Button`（destructive / md） | 破壊的操作。送信中は `disabled` かつ `aria-busy="true"` |
| 中止 | ボタン | `Button`（outline / md） | 取消をやめて前画面へ戻る |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-teal-700)` |
| 破壊的操作 | `var(--semantic-destructive)` | `var(--color-red-600)` |
| 取置き中の状態色 | `var(--semantic-warning)` | `var(--color-amber-600)` |
| モーダル背景 | `var(--modal-bg)` | `var(--color-white)` |
| セクション間余白 | `var(--section-gap)` | `var(--spacing-8)` |

#### UIロジック

- **状態管理**: 状態管理層（`L-frontend-staff-state`）で対象予約・取消結果・エラーを保持する。取消成功後は対象予約のキャッシュを「キャンセル」で更新し、同一書籍の予約一覧を再取得する
- **バリデーション**: 予約状態が「予約中」「取置き中」のときのみ取消ボタンを活性にする。それ以外は非活性にし、`Alert` で根拠となる予約状態を表示する（反応型オンボーディング）
- **ローディング**: 対象予約の取得中は `Skeleton`（line）を表示する
- **エラーハンドリング**: 409 は `Alert(warning)` に業務メッセージ、404 は `Alert(destructive)` で「対象の予約が見つかりません」、5xx は再試行導線つき `Alert(destructive)` を `role="alert"` で通知する
- **意図的な壁**: 取消は `Modal(destructive-confirm)` を必ず経由する。確定ボタンには既定でフォーカスを当てない。Esc とフォーカストラップを備え、閉じたら起動元へフォーカスを戻す
- **二重送信防止**: 取消ごとに UUID の冪等キーを生成し `X-Idempotency-Key` に付与する（arch SR-002）
- **操作ログ**: 取消操作は司書の操作ログとして記録対象であることを画面上に明示する（arch CLR-009）
- **PII**: 対象利用者は利用者番号のみを表示し、氏名・連絡先は表示しない（NFR E.1.2.1）

#### 操作フロー

1. 司書が窓口で利用者から予約取消の申し出を受け、対象予約を特定して `/reservations/:reservationId/cancel` を開く
2. 書籍名・利用者番号・予約状態・予約順位を確認する
3. 「取消を実行」を押下し、`Modal(destructive-confirm)` で対象を再確認して確定する
4. 完了サマリ（キャンセル済みの予約状態バッジ + 繰り上げ件数 + 書籍状態）を確認する
5. 続けて別の予約を取り消す場合は予約一覧へ戻る

## コンポーネント設計

### ReservationCancelPanel

- **ベースコンポーネント**: `Card` + `ReservationStatusBadge` + `Modal(destructive-confirm)` + `Button(destructive)`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | reservation | object | Yes | 対象予約（reservation_id, book_id, book_title, user_no, priority, reservation_status, hold_expires_at） |
  | cancellable | boolean | Yes | 予約状態が「予約中」「取置き中」で取消可能か |
  | submitting | boolean | Yes | 送信中フラグ |
  | onCancelReservation | function | Yes | 取消確定ハンドラ |
  | onAbort | function | Yes | 中止ハンドラ |
- **状態**: `confirmOpen`（確認モーダルの開閉）
- **イベント**: `onCancelReservation`、`onAbort`

### CancelResultSummary

- **ベースコンポーネント**: `Alert`（success） + `ReservationStatusBadge`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | reservationStatus | string | Yes | 取消後の予約状態（キャンセル） |
  | promotedCount | number | Yes | 順位を繰り上げた後続予約の件数 |
  | bookStatus | string | Yes | 取消後の書籍状態（予約待ち / 在庫あり） |
- **状態**: なし（表示専用）
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 予約を取り消す - 司書ポータル

  Scenario: 予約中の予約を確認モーダル経由で取り消せる
    Given 司書「山田司書」が予約取消受付画面 /reservations/R-0007/cancel を開いている
    And 予約 R-0007 の予約状態が「予約中」で予約順位が 1 である
    When 司書が「取消を実行」を押下し確認モーダルで確定する
    Then POST /api/v1/staff/reservations/R-0007/cancel が 1 回だけ送信される
    And 完了サマリに「キャンセル」バッジと繰り上げ件数が表示される

  Scenario: 貸出済みの予約では取消ボタンが非活性になる
    Given 予約 R-0200 の予約状態が「貸出済み」
    When 司書が予約取消受付画面 /reservations/R-0200/cancel を開く
    Then 「取消を実行」ボタンが非活性になる
    And 「すでに貸出済みのため取り消せません」という Alert(warning) が表示される

  Scenario: 確認モーダルを閉じると取消は送信されない
    Given 司書が予約取消受付画面 /reservations/R-0007/cancel で確認モーダルを開いている
    When 司書が Esc キーを押す
    Then モーダルが閉じて起動元のボタンへフォーカスが戻る
    And 取消リクエストは送信されない
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | ReservationCancelPanel（対象予約の取得） の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `ConfirmActionModal` | `@/components/common/ConfirmActionModal` | ReservationCancelPanel の確認部（`Modal(destructive-confirm)`） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | ReservationCancelPanel の取消実行ボタン（`onCancelReservation`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← ReservationCancelPanel（対象予約の取得） の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `ConfirmActionModal` | `open` ← モーダル開閉状態 / `tone` ← `"destructive"` / `title` `confirmLabel` ← 既存モーダルの文言 / `targetLabel` ← 対象予約（書籍タイトル・利用者） / `impact` ← 実行後に起きること（既存の説明文） / `onConfirm` `onCancel` `submitting` ← ReservationCancelPanel の確認部（`Modal(destructive-confirm)`） の同名 props |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"destructive"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
