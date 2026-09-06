# 利用者を削除する - 司書ポータル仕様

## 変更概要

司書ポータル（`tier-frontend-staff`）に退会手続画面を追加する。削除対象の登録内容と進行中取引の件数を提示し、削除可否はバックエンド API の応答（`deletable` と未充足理由）を表示するだけとする（LR-030）。実行は `Modal(destructive-confirm)` を経由させる。

## 画面仕様

### 退会手続画面

- **URL**: `/staff/users/:userNumber/withdraw`
- **アクセス権**: 司書（役割「司書」のトークンを持つ場合のみ表示 / LP-029）
- **ポータル**: `staff`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | サイドバー「利用者管理」を選択状態にする |
| 対象の登録内容 | カード | `UserProfileCard`（`default` / `in-transaction`） | 氏名・利用者番号・利用者区分。連絡先は既定マスク |
| 利用者状態 | バッジ | `UserStatusBadge` | 登録済み / 取引進行中。取引進行中は削除不可の根拠表示に使う |
| 削除不可の根拠 | メッセージ | `Alert`（`warning`） | 進行中の貸出件数・予約件数を明示する |
| 退会ボタン | ボタン | `Button`（`destructive`） | `deletable` が false のときは不活性 |
| キャンセル | ボタン | `Button`（`outline`） | 利用者名簿画面へ戻る |
| 確認ダイアログ | オーバーレイ | `Modal`（`destructive-confirm` / `md`） | 対象の氏名・利用者番号を再掲する。確定ボタンに初期フォーカスを当てない |
| 実行結果 | メッセージ | `Alert`（`success` / `destructive`） | 完了、または失敗理由と再試行手段 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 破壊的操作 | `var(--semantic-destructive)` | `var(--color-red-600)` |
| 警告表示 | `var(--semantic-warning)` | `var(--color-amber-600)` |
| ポータルアクセント | `var(--primary)` | `var(--color-teal-700)`（`#0F766E`） |
| モーダル | `var(--modal-bg)` / `var(--modal-shadow)` | `var(--color-white)` / `var(--shadow-lg)` |
| モーダル背景 | `var(--modal-backdrop)` | ライト `rgba(...,0.45)` / ダーク `rgba(2, 6, 23, 0.7)` |
| アニメーション | `var(--duration-slow)` | 320ms（Modal。`prefers-reduced-motion` では無効化） |

#### UIロジック

- **状態管理**: 対象の利用者番号を利用者名簿から引き継ぎ、状態管理層（`L-frontend-staff-state`）で保持する。取得した `deletable` と未充足理由を保持し、削除成功後は利用者一覧のキャッシュを無効化する（LP-030）。
- **バリデーション**: フロント側で削除可否を独自判定しない。表示は `GET /api/v1/users/{userNumber}` の `deletable` / `active_loan_count` / `active_reservation_count` に従う。
- **ローディング**: 対象情報の取得中は `Skeleton`（`line`）を表示する。削除実行中は確定ボタンを `loading` にする。
- **エラーハンドリング**: 409 は `Alert(warning)` に未充足理由を件数つきで表示し、最新を再取得する導線を出す。404 は「対象の利用者が見つかりません」を表示して利用者名簿へ戻す。
- **意図的な壁**: `Modal(destructive-confirm)` で対象名を再掲したうえで確定させる。確定ボタンは既定でフォーカスしない。
- **冪等キー**: 画面表示時に UUID を発行し、実行・再送で同一キーを `X-Idempotency-Key` に付与する（LR-032）。
- **アクセシビリティ**: `Modal` はフォーカストラップと Esc クローズを備え、閉じたら起動元へフォーカスを戻す。実行結果は `aria-live="polite"`、エラーは `role="alert"`。

#### 操作フロー

1. 司書が利用者名簿画面の行から退会手続画面へ遷移する。
2. 状態管理層が `GET /api/v1/users/{userNumber}` で対象情報と削除可否を取得する。
3. `UserProfileCard` と `UserStatusBadge` に対象を表示する。
4. `deletable` が false のときは `Alert(warning)` に未充足理由を表示し、退会ボタンを不活性にする。
5. `deletable` が true のとき、司書が「退会させる」を押すと `Modal(destructive-confirm)` を開く。
6. 司書が確定すると `DELETE /api/v1/users/{userNumber}` を要求する。
7. 204 応答で `Alert(success)` を表示し、利用者名簿画面へ戻す。

## コンポーネント設計

### UserProfileCard（退会手続画面での利用）

- **ベースコンポーネント**: `UserProfileCard`（domain コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | user | UserDetail | Yes | 利用者番号・氏名・利用者区分・利用者状態・進行中件数 |
  | maskContact | boolean | Yes | 退会手続では常に true（開示操作を出さない） |
  | actions | Action[] | No | 「退会させる」（`destructive`）と「キャンセル」（`outline`） |
- **状態**: `default` / `in-transaction`（利用者状態が取引進行中のとき）
- **イベント**: `onWithdraw`（確認モーダルを開く）、`onCancel`

### WithdrawConfirmModal（退会確認）

- **ベースコンポーネント**: `Modal`（`destructive-confirm` / `md`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | open | boolean | Yes | 表示状態 |
  | userNo | string | Yes | 再掲する利用者番号 |
  | userName | string | Yes | 再掲する氏名 |
  | submitting | boolean | Yes | 実行中は確定ボタンを不活性にする |
  | onConfirm | () => void | Yes | 削除要求を状態管理層へ渡す |
  | onClose | () => void | Yes | 閉じて起動元へフォーカスを戻す |
- **状態**: `closed` / `open` / `submitting`
- **イベント**: `onConfirm`、`onClose`

## ティア完了条件（BDD）

```gherkin
Feature: 利用者を削除する - 司書ポータル

  Scenario: 削除可能な利用者では退会ボタンが活性になる
    Given バックエンド API が deletable true・進行中件数 0 を返すようスタブされている
    When 司書が退会手続画面（/staff/users/U-000123/withdraw）を表示する
    Then 「退会させる」ボタンが活性である
    And UserStatusBadge に「登録済み」が表示される

  Scenario: 削除不可のとき理由が件数つきで表示される
    Given バックエンド API が deletable false・active_loan_count 1 を返すようスタブされている
    When 司書が退会手続画面（/staff/users/U-000200/withdraw）を表示する
    Then Alert(warning) に「進行中の貸出が 1 件」が表示される
    And 「退会させる」ボタンが不活性である

  Scenario: 確認モーダルを経由しないと削除されない
    Given 司書が退会手続画面を表示している
    When 司書が「退会させる」を押す
    Then Modal(destructive-confirm) が開く
    And DELETE /api/v1/users/U-000123 はまだ呼ばれない

  Scenario: 確定で削除要求が 1 回だけ送られる
    Given 司書が確認モーダルを表示している
    When 司書が確定ボタンを 2 回続けて押す
    Then DELETE /api/v1/users/U-000123 の呼び出しが 1 回だけ発生する
    And 確定ボタンが disabled かつ aria-busy="true" になる

  Scenario: Esc でモーダルを閉じると起動元へフォーカスが戻る
    Given 司書が確認モーダルを表示している
    When 司書が Esc キーを押す
    Then モーダルが閉じる
    And 「退会させる」ボタンにフォーカスが戻る
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | UserProfileCard（退会手続画面） の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `ConfirmActionModal` | `@/components/common/ConfirmActionModal` | WithdrawConfirmModal（`Modal(destructive-confirm)`） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | WithdrawConfirmModal の確定ボタン（`onConfirm`） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | UserProfileCard の連絡先（`maskContact`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← UserProfileCard（退会手続画面） の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `ConfirmActionModal` | `open` ← モーダル開閉状態 / `tone` ← `"destructive"` / `title` `confirmLabel` ← 既存モーダルの文言 / `targetLabel` ← 対象利用者番号・氏名 / `impact` ← 実行後に起きること（既存の説明文） / `onConfirm` `onCancel` `submitting` ← WithdrawConfirmModal（`Modal(destructive-confirm)`） の同名 props |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"destructive"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← true / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
