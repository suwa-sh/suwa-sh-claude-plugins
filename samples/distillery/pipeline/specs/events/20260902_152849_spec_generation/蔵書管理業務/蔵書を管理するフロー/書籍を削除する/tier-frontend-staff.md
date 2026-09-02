# 書籍を削除する - 司書ポータル仕様

## 変更概要

司書ポータル（tier-frontend-staff）に除籍手続画面（`/staff/books/:bookId/withdraw`）を実装する。対象書籍の提示、蔵書削除可否条件の判定結果と未充足理由の根拠表示、`Modal(destructive-confirm)` による意図的な壁つきの除籍実行を行う。

## 画面仕様

### 除籍手続画面

- **URL**: `/staff/books/:bookId/withdraw`
- **アクセス権**: 司書
- **ポータル**: `staff`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインコンテンツ |
| 対象書籍の提示 | カード | `BookCard` | タイトル・著者・ISBN・出版社・ジャンル・資料種別・予約件数を一覧できる |
| 書籍状態 | バッジ | `BookStatusBadge` | 在庫あり / 貸出中 / 予約待ち |
| 除籍不可の理由 | メッセージ | `Alert`（`warning`） | 蔵書削除可否条件の未充足理由を根拠つきで箇条書きする |
| 除籍実行ボタン | ボタン | `Button`（`destructive`, `lg`） | 削除不可のときは `disabled` |
| 確認ダイアログ | モーダル | `Modal`（`destructive-confirm`, `md`） | 対象書籍名を再掲し、確定ボタンは既定でフォーカスしない |
| 取消ボタン | ボタン | `Button`（`outline`） | 蔵書管理台帳画面へ戻る |
| 除籍完了 | メッセージ | `Alert`（`success`） | 「除籍しました」と台帳への遷移導線 |
| エラー | メッセージ | `Alert`（`destructive`） | 404 / 422 / 5xx の原因と次の行動 |
| 読み込み中 | ローディング | `Skeleton`（`line`） | 可否判定の取得中に表示する |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--background)` | `var(--color-white)` |
| アクセント | `var(--primary)` | `var(--color-teal-700)`（#0F766E） |
| 破壊的操作 | `var(--destructive)` | `var(--color-red-600)` |
| 警告 | `var(--warning)` | `var(--color-amber-600)` |
| 在庫ありバッジ | `var(--success)` | `var(--color-green-600)` |
| モーダル開閉アニメーション | `var(--duration-slow)` | 320ms（`prefers-reduced-motion: reduce` で無効化） |
| カード余白 | `var(--card-padding)` | `var(--spacing-6)` |

#### UIロジック

- **状態管理**: 対象書籍・可否判定結果（deletable / reasons[]）・確認 Modal の開閉・送信中フラグ・冪等キーを画面ローカルに保持する
- **バリデーション**: 入力項目はない。可否判定は API の結果を正とし、画面側で条件を再実装しない
- **削除不可の提示**: `deletable=false` のとき `Alert(warning)` に理由（例: 「貸出中のため除籍できません」「取置き中の予約が1件あります」）を並べ、除籍ボタンを `disabled` にする（反応型オンボーディング: 根拠となった RDRA 条件名と未充足項目をその場に展開する）
- **意図的な壁**: 除籍ボタン押下で `Modal(destructive-confirm)` を開き、対象書籍名を再掲する。フォーカストラップと Esc クローズを備え、閉じたら起動元へフォーカスを戻す。確定ボタンは既定でフォーカスしない
- **ローディング**: 可否判定の取得中は `Skeleton(line)`、削除実行中は `Button` を `loading` かつ `aria-busy="true"` にする
- **エラーハンドリング**: 404 は「対象の書籍が見つかりません」+ 台帳への導線、422 は最新の未充足理由を再取得して表示、5xx は再試行ボタンを表示する
- **二重送信防止**: 確定後は `disabled` にし、`X-Idempotency-Key` を API クライアント層で付与する

#### 操作フロー

1. 司書が蔵書管理台帳画面の行アクション「除籍」から除籍手続画面へ遷移する
2. `GET /api/v1/books/{book_id}/withdrawal-eligibility` で対象書籍と可否判定を取得する
3. 削除可能なら除籍ボタンを有効化し、不可なら理由を並べてボタンを無効化する
4. 除籍ボタンを押すと確認 Modal が開き、対象書籍名が再掲される
5. 「除籍する」で `DELETE /api/v1/books/{book_id}` を冪等キー付きで送信する
6. 成功時は「除籍しました」と台帳への遷移導線を表示する

## コンポーネント設計

### BookWithdrawalPanel

- **ベースコンポーネント**: `BookCard`（Domain） + `BookStatusBadge`（Domain） + `Alert`（UI） + `Button`（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | book | BookSummary | Yes | 除籍対象の書籍 |
  | deletable | boolean | Yes | 蔵書削除可否条件の判定結果 |
  | reasons | string[] | Yes | 削除不可の未充足理由（deletable=false のとき 1 件以上） |
  | loading | boolean | Yes | 判定取得中フラグ |
  | onWithdraw | () => void | Yes | 確認ダイアログを開く |
- **状態**: なし（判定結果は状態管理層が保持する）
- **イベント**: onWithdraw、onCancel

### WithdrawalConfirmModal

- **ベースコンポーネント**: `Modal`（`destructive-confirm`, `md`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | open | boolean | Yes | 開閉状態 |
  | bookTitle | string | Yes | 再掲する対象書籍名 |
  | submitting | boolean | Yes | 削除実行中フラグ |
  | onConfirm | () => void | Yes | 除籍を確定する |
  | onClose | () => void | Yes | 閉じる（Esc / バックドロップ / 取消） |
- **状態**: フォーカストラップの内部状態
- **イベント**: onConfirm、onClose

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を削除する - 司書ポータル

  Scenario: 削除可能な書籍で除籍ボタンを有効にする
    Given API が deletable=true, reasons=[] を返す状態である
    When 司書が除籍手続画面（/staff/books/BK-001/withdraw）を開く
    Then 「吾輩は猫である」の BookCard が表示され、除籍ボタンが有効になる

  Scenario: 削除不可の理由を根拠つきで並べる
    Given API が deletable=false, reasons=["貸出中のため除籍できません","取置き中の予約が1件あります"] を返す状態である
    When 司書が除籍手続画面を開く
    Then Alert(warning) に 2 件の理由が箇条書きで表示され、除籍ボタンが disabled になる

  Scenario: 確認ダイアログで対象書籍名を再掲する
    Given 司書が削除可能な「吾輩は猫である」の除籍手続画面を開いている
    When 司書が除籍ボタンを押す
    Then Modal(destructive-confirm) が開き「吾輩は猫である」が再掲され、確定ボタンにフォーカスが当たっていない

  Scenario: Esc キーで確認ダイアログを閉じて削除しない
    Given 司書が確認ダイアログを開いている
    When 司書が Esc キーを押す
    Then ダイアログが閉じ、フォーカスが除籍ボタンへ戻り、削除は実行されない
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | BookWithdrawalPanel の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `ConfirmActionModal` | `@/components/common/ConfirmActionModal` | WithdrawalConfirmModal（`Modal(destructive-confirm)`） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | BookWithdrawalPanel の除籍実行ボタン（`onWithdraw`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← BookWithdrawalPanel の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `ConfirmActionModal` | `open` ← モーダル開閉状態 / `tone` ← `"destructive"` / `title` `confirmLabel` ← 既存モーダルの文言 / `targetLabel` ← 対象書籍タイトル / `impact` ← 実行後に起きること（既存の説明文） / `onConfirm` `onCancel` `submitting` ← WithdrawalConfirmModal（`Modal(destructive-confirm)`） の同名 props |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"destructive"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
