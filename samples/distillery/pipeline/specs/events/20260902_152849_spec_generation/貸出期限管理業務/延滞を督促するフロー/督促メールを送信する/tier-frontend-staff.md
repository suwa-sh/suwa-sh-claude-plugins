# 督促メールを送信する - 司書ポータル仕様

## 変更概要

延滞督促の送信実績を司書が追跡するための督促送信画面を追加する。未達（送信失敗）件数を `Alert`（`destructive`）で上部に出し、追跡漏れを防ぐ。送信失敗の行だけに再送操作を出す。

## 画面仕様

### 督促送信画面

- **URL**: `/staff/overdues/dun`
- **アクセス権**: 司書（館内ネットワークからのみ到達可能。NFR E.5.3.1）
- **ポータル**: `staff`（司書ポータル）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインの共通骨格 |
| 未達の警告 | 警告 | `Alert`（`destructive`） | 送信失敗が 1 件以上のとき「未達 N 件。再送してください」を最上部に表示する |
| 送信状態サマリ | テキスト | `Card`（`flush`）+ `NotificationStatusBadge` | 送信待ち / 送信済み / 送信失敗の件数を表示する |
| 通知状態の絞り込み | トグル | `ToggleGroup`（`single`, `sm`） | 「すべて（既定）」「送信待ち」「送信済み」「送信失敗」 |
| 送信実績の一覧 | テーブル | `NotificationLogTable` | 通知ID・宛先（マスク）・利用者名・対象貸出・書籍タイトル・返却期限・通知状態・送信結果を表示する |
| 通知状態の表示 | バッジ | `NotificationStatusBadge`（`state`, `dot`） | 送信待ち=warning / 送信済み=success / 送信失敗=destructive。状態名の文言を必ず伴う |
| 再送操作 | ボタン | `Button`（`outline`） | 送信失敗の行にのみ表示する |
| ページング | ページャ | `Pagination`（20 件/頁） | 一覧下部に配置する |
| 0 件時の表示 | 空状態 | `EmptyState`（`default`） | 「送信実績はありません」 |
| 読み込み中 | スケルトン | `Skeleton`（`table`） | 応答が 0.4 秒を超える場合に表示する |
| 再送完了 | 通知 | `Alert`（`success`） | 「再送を受け付けました」を `aria-live="polite"` で通知する |

通知種別は本画面で「延滞督促」に固定する。通知タイミング区分は「期限超過督促」の 1 値のみのためフィルターを設けない。

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| アクセント | `var(--semantic-primary_staff)` | `var(--color-teal-700)`（`#0F766E`） |
| 送信待ち | `var(--semantic-warning)` | `var(--color-amber-600)` |
| 送信済み | `var(--semantic-success)` | `var(--color-green-600)` |
| 送信失敗 | `var(--semantic-destructive)` | `var(--color-red-600)` |
| 個人情報マスク | `var(--pii-mask_bg)` / `var(--pii-mask_color)` | component 層の `pii` トークン |
| セクション間隔 | `var(--layout-section_gap)` | `var(--spacing-8)` |

#### UIロジック

- **状態管理**: `DunLogState`（`status` / `page` / `items` / `summary` / `loading` / `error` / `resending`）で保持する。フィルターとページは URL クエリと同期する
- **バリデーション**: `status` は通知状態（送信待ち / 送信済み / 送信失敗）の値のみ受け付ける
- **ローディング**: 一覧取得中は `Skeleton`（`table`）。再送中は該当行の `Button` を `loading`（`disabled` かつ `aria-busy="true"`）にする（arch SR-002）
- **エラーハンドリング**: 取得失敗は `Alert`（`destructive`）+ 再取得ボタン。再送の 409 は「送信失敗の通知のみ再送できます」を `role="alert"` で表示し、一覧を再取得する
- **冪等性**: 再送リクエストごとに UUID の冪等キーを生成し `X-Idempotency-Key` ヘッダへ付与する
- **個人情報**: 宛先メールアドレスは既定でマスク表示する。ブラウザストレージへ保存しない
- **文言**: 利用者を責める表現を避け、事実（超過日数・対象書籍）と次の行動（再送）だけを示す

#### 操作フロー

1. 司書が延滞状況一覧画面またはサイドバー「期限・督促」から督促送信画面を開く
2. 通知種別「延滞督促」の送信実績を取得する
3. 未達（送信失敗）が 1 件以上あれば最上部に `Alert`（`destructive`）で警告する
4. 通知状態で絞り込み、失敗行を特定する
5. 送信失敗の行の「再送」を押す
6. 再送受付後に一覧を再取得し、対象行の通知状態が「送信待ち」に変わったことを確認する

## コンポーネント設計

### DunNotificationLog

- **ベースコンポーネント**: `NotificationLogTable`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | logs | NotificationLog[] | Yes | 通知の配列（notificationId / recipientEmailMasked / userName / targetLoanId / bookTitle / dueDate / status / sendResult / requestedAt） |
  | loading | boolean | Yes | 取得中フラグ |
  | onRetry | (notificationId: string) => void | Yes | 再送ハンドラ。送信失敗の行にのみ提供する |
  | resendingId | string \| null | No | 再送中の通知ID。該当行の Button を loading にする |
- **状態**: `default` / `with-failures` / `loading` / `empty`
- **イベント**: `onRetry(notificationId)`

### DunFailureAlert

- **ベースコンポーネント**: `Alert`（UI、`destructive`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | failedCount | number | Yes | 送信失敗（未達）件数。0 のとき描画しない |
- **状態**: なし（表示専用）
- **イベント**: `onFilterFailed()` — 通知状態「送信失敗」で一覧を絞り込む

## ティア完了条件（BDD）

```gherkin
Feature: 督促メールを送信する - 司書ポータル

  Scenario: 未達件数を最上部に警告表示する
    Given API が送信失敗 2 件を返す
    When 司書が督促送信画面を開く
    Then 画面最上部の Alert(destructive) に「未達 2 件」が表示される

  Scenario: 送信状態のサマリを表示する
    Given API が送信待ち 1 件・送信済み 8 件・送信失敗 2 件のサマリを返す
    When 司書が督促送信画面を開く
    Then 「送信待ち 1 / 送信済み 8 / 送信失敗 2」が NotificationStatusBadge つきで表示される

  Scenario: 送信失敗の行にだけ再送ボタンを出す
    Given 通知「N-4001」が送信失敗、通知「N-4002」が送信済みで一覧に表示されている
    When 司書が督促送信画面の一覧を確認する
    Then 通知「N-4001」の行にのみ Button(outline)「再送」が表示される

  Scenario: 未達の警告から失敗行だけに絞り込む
    Given 督促送信画面に未達 2 件の Alert(destructive) が表示されている
    When 司書が Alert 内の絞り込み導線を押す
    Then 通知状態「送信失敗」で一覧が再取得され URL クエリが同期する

  Scenario: 再送中はボタンを二重押下できない
    Given 通知「N-4001」の再送リクエストが処理中である
    When 司書が同じ行の再送ボタンをもう一度押す
    Then ボタンは disabled かつ aria-busy="true" で追加のリクエストは送信されない

  Scenario: 宛先メールアドレスをマスク表示する
    Given 通知「N-4001」の宛先が「tanaka@example.com」である
    When 司書が督促送信画面を開く
    Then 一覧の宛先列に「t***@example.com」が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | DunNotificationLog の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（DunNotificationLog（`NotificationLogTable`） + `Pagination` 20 件/頁） |
| `FilterPanel` | `@/components/common/FilterPanel` | 表示要素「通知状態の絞り込み」（`ToggleGroup(single)`） の内側で使う（置き換えない） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | 送信実行と送信失敗行の再送ボタン（`Button(outline)` / `onRetry`） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | DunNotificationLog の宛先列 |
| `NotificationLogSection` | `@/components/common/NotificationLogSection` | DunFailureAlert / DunNotificationLog（送信対象サマリ → 送信実行 → 送信実績一覧 → 失敗行の再送） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← DunNotificationLog の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"table"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← 表示要素「通知状態の絞り込み」（`ToggleGroup(single)`） / `table` ← DunNotificationLog（`NotificationLogTable`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |
| `FilterPanel` | `fields` ← 通知状態（single、既定「すべて」） / `onChange` `onSubmit` `onReset` ← 表示要素「通知状態の絞り込み」（`ToggleGroup(single)`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← true / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |
| `NotificationLogSection` | `notificationType` ← `"督促"` / `logs` ← 送信実績の配列 / `loading` ← 取得中フラグ / `onSend` ← 送信実行 / `onRetry` ← 送信失敗行のみ活性の再送 |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
