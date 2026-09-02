# 書籍を削除する - 司書ポータル仕様

## 変更概要

司書ポータル（tier-frontend-staff）に除籍手続画面（`/staff/books/:bookId/withdraw`）を実装する。対象書籍の提示、蔵書削除可否条件の判定結果と未充足理由の根拠表示、`Modal(destructive-confirm)` による意図的な壁つきの除籍実行を行う。

## 画面仕様

### 除籍手続画面

- **ルート id**: `staff-book-withdraw`
- **URL**: `/staff/books/:bookId/withdraw`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書
- **ポータル**: `staff`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインコンテンツ |
| 対象書籍の提示 | カード | `BookCard` | タイトル・著者・ISBN・出版社・ジャンル・資料種別・予約件数を一覧できる |
| 書籍状態 | バッジ | `BookStatusBadge` | 在庫あり / 貸出中 / 予約待ち |
| 除籍不可の理由 | メッセージ | `Alert`（`warning`） | 蔵書削除可否条件の未充足理由を根拠つきで箇条書きする |
| 除籍実行ボタン | ボタン | `Button`（`destructive`, `lg`） | 削除不可のときは `disabled`。実行中は `SubmitActionButton` 内の `LoadingState`（`kind="action"`, `label="除籍を実行中"`）で待機表現を出す |
| 確認ダイアログ | モーダル | `Modal`（`destructive-confirm`, `md`） | 対象書籍名を再掲し、確定ボタンは既定でフォーカスしない |
| 取消ボタン | ボタン | `Button`（`outline`） | `useAppNavigation().navigate("staff-book-list")` で蔵書管理台帳画面（`/staff/books`）へ戻る |
| 除籍完了 | メッセージ | `Alert`（`success`） | 「除籍しました」と `useAppNavigation().navigate("staff-book-list")` による台帳への遷移導線 |
| エラー | メッセージ | `Alert`（`destructive`） | 404 / 422 / 5xx の原因と次の行動 |
| 読み込み中 | ローディング | `LoadingState`（`kind="detail"`, `label="除籍可否の判定結果を読み込み中"`） | 可否判定（単一書籍の詳細）の取得中に表示する。画面側で `Skeleton` / `Spinner` を直接使わない |

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
- **ローディング**: 可否判定の取得中は `AsyncSection` 経由の `LoadingState`（`kind="detail"` / `label="除籍可否の判定結果を読み込み中"`）、削除実行中は `SubmitActionButton` に内包された `LoadingState`（`kind="action"` / `label="除籍を実行中"`）に一本化し、`aria-busy="true"` にする。画面側で `Skeleton` / `Spinner` / `animate-pulse` を直接使わない
- **エラーハンドリング**: 404 は「対象の書籍が見つかりません」+ 台帳への導線、422 は最新の未充足理由を再取得して表示、5xx は再試行ボタンを表示する
- **二重送信防止**: 確定後は `disabled` にし、`X-Idempotency-Key` を API クライアント層で付与する

#### 操作フロー

1. 司書が蔵書管理台帳画面の行アクション「除籍」から `useAppNavigation().navigate("staff-book-withdraw")`（パスは `buildPath("staff-book-withdraw", { book_id })`）で除籍手続画面（`/staff/books/{book_id}/withdraw`）へ遷移する
2. `GET /api/v1/books/{book_id}/withdrawal-eligibility` で対象書籍と可否判定を取得する
3. 削除可能なら除籍ボタンを有効化し、不可なら理由を並べてボタンを無効化する
4. 除籍ボタンを押すと確認 Modal が開き、対象書籍名が再掲される
5. 「除籍する」で `DELETE /api/v1/books/{book_id}` を冪等キー付きで送信する
6. 成功時はページコンポーネントが `result`（`true`）を確定させ、「除籍しました」と `useAppNavigation().navigate("staff-book-list")` による台帳（`/staff/books`）への遷移導線を表示する

## コンポーネント設計

### 受け渡し契約（`common-components.md`「6. コンポーネント間の受け渡し規約」）

- **実行結果の所有者は除籍手続ページ（ページコンポーネント）**とする。ページが `result: boolean | null` と `submitting: boolean` を保持し、`DELETE /api/v1/books/{book_id}` の実行主体になる。子コンポーネント（パネル・確認モーダル）は API を直接呼ばない
- **完了結果の型は API の応答形に従う**。`deleteBook` は 204（本文なし）を返し `openapi.yaml` に対応するスキーマを持たないため、完了結果は `result: boolean | null`（`true` = 除籍完了、`null` = 未実行）とする。本文を持つ operation と異なり、画面側でレスポンススキーマ名を型として参照しない
- **子から親へのイベント名は `on{ドメイン動詞}{結果}`** に揃える（本 UC は `onBookWithdrawalSucceeded`）。`onDone` / `onComplete` のような汎用名は使わない
- **結果表示コンポーネントは state を持たない**。確定値を Props で受け取り、`result` が `null` の間は描画しない

### BookWithdrawalPanel

- **ベースコンポーネント**: `BookCard`（Domain） + `BookStatusBadge`（Domain） + `Alert`（UI） + `Button`（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | book | BookSummary | Yes | 除籍対象の書籍 |
  | deletable | boolean | Yes | 蔵書削除可否条件の判定結果 |
  | reasons | string[] | Yes | 削除不可の未充足理由（deletable=false のとき 1 件以上） |
  | loading | boolean | Yes | 判定取得中フラグ（`AsyncSection` 経由で `LoadingState(kind="detail")` を表示する） |
  | submitting | boolean | Yes | 除籍実行中フラグ（親が所有し、`SubmitActionButton` の `LoadingState(kind="action")` に伝播する） |
  | result | boolean \| null | Yes | 親が確定させた除籍完了結果（`true` = 除籍完了）。`null` の間は完了表示（`Alert(success)`）を描画しない |
  | onWithdraw | () => void | Yes | 確認ダイアログを開く |
  | onBookWithdrawalSucceeded | () => void | Yes | 除籍完了後の次の行動導線（`useAppNavigation().navigate("staff-book-list")`）を親へ通知する |
- **状態**: なし（判定結果・実行結果はページコンポーネントが保持する。本コンポーネントは表示専用）
- **イベント**: onWithdraw、onBookWithdrawalSucceeded、onCancel

### WithdrawalConfirmModal

- **ベースコンポーネント**: `Modal`（`destructive-confirm`, `md`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | open | boolean | Yes | 開閉状態 |
  | bookTitle | string | Yes | 再掲する対象書籍名 |
  | submitting | boolean | Yes | 削除実行中フラグ（親が所有する。`LoadingState(kind="action")` に伝播する） |
  | onConfirm | () => void | Yes | 除籍の実行を親へ依頼する（API 呼び出しは親が行う） |
  | onClose | () => void | Yes | 閉じる（Esc / バックドロップ / 取消） |
- **状態**: フォーカストラップの内部状態のみ。**除籍結果（`result`）は保持しない**
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
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（`staff-book-list`） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（`kind="detail"`）と除籍実行ボタンの実行中（`kind="action"`）。それぞれ `AsyncSection` / `SubmitActionButton` 経由で間接利用する |
| `AsyncSection` | `@/components/common/AsyncSection` | BookWithdrawalPanel の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `ConfirmActionModal` | `@/components/common/ConfirmActionModal` | WithdrawalConfirmModal（`Modal(destructive-confirm)`） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | BookWithdrawalPanel の除籍実行ボタン（`onWithdraw`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"detail"`（可否判定の取得） / `"action"`（除籍実行中） / `label` ← `"除籍可否の判定結果を読み込み中"` / `"除籍を実行中"` |
| `AsyncSection` | `loading` ← BookWithdrawalPanel の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"detail"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"除籍可否の判定結果を読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `ConfirmActionModal` | `open` ← モーダル開閉状態 / `tone` ← `"destructive"` / `title` `confirmLabel` ← 既存モーダルの文言 / `targetLabel` ← 対象書籍タイトル / `impact` ← 実行後に起きること（既存の説明文） / `onConfirm` `onCancel` `submitting` ← WithdrawalConfirmModal（`Modal(destructive-confirm)`） の同名 props |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"destructive"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけ
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
