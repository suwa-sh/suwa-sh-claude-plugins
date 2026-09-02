# リマインドメールを送信する - 司書ポータル仕様

## 変更概要

返却期限リマインドの送信実績を司書が追跡するためのリマインド送信画面を追加する。送信待ち / 送信済み / 送信失敗の件数を先頭に置き、送信失敗の行だけに再送操作を出す。未達（送信失敗）は `Alert`（`destructive`）で上部に明示し、追跡漏れを防ぐ。

## 画面仕様

### リマインド送信画面

- **ルート id**: `staff-duedate-remind`
- **URL**: `/staff/duedates/remind`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（館内ネットワークからのみ到達可能。NFR E.5.3.1）
- **ポータル**: `staff`（司書ポータル）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインの共通骨格 |
| 送信状態サマリ | テキスト | `Card`（`flush`）+ `NotificationStatusBadge` | 送信待ち / 送信済み / 送信失敗の件数を先頭に配置する |
| 未達の警告 | 警告 | `Alert`（`destructive`） | 送信失敗が 1 件以上のとき「未達 N 件。再送してください」を表示する |
| 通知タイミング区分の絞り込み | トグル | `ToggleGroup`（`single`, `sm`） | 値は「期限前リマインド」「期限当日」。未選択（すべて）を既定にする |
| 送信実績の一覧 | テーブル | `NotificationLogTable` | 通知ID・宛先（マスク）・利用者名・対象貸出・書籍タイトル・通知タイミング区分・通知状態・送信結果を表示する。返却期限は一覧の列として `YYYY/MM/DD`、送信日時は `YYYY年M月D日 HH:mm` で表示する（API 上は ISO 8601。`ui-design.md`「日付・期限の表示規約」が正本） |
| 通知状態の表示 | バッジ | `NotificationStatusBadge`（`state`, `dot`） | 送信待ち=warning / 送信済み=success / 送信失敗=destructive。状態名の文言を必ず伴う |
| 再送操作 | ボタン | `Button`（`outline`） | 送信失敗の行にのみ表示する |
| ページング | ページャ | `Pagination`（20 件/頁） | 一覧下部に配置する |
| 0 件時の表示 | 空状態 | `EmptyState`（`default`） | 「送信実績はありません」 |
| 読み込み中 | 状態表示 | `LoadingState`（`kind: list`, `label: 「リマインドの送信実績を読み込み中」`, `delayMs: 300`） | `AsyncSection` の `skeleton` 経由で表示する。画面側で `Skeleton` / `Spinner` を直接使わない |
| 再送中 | 状態表示 | `LoadingState`（`kind: action`, `label: 「リマインドメールを再送中」`） | `SubmitActionButton` が内包する。該当行のボタン以外に独自の loading 表現を置かない |
| 再送完了 | 通知 | `Alert`（`success`） | 「再送を受け付けました」を `aria-live="polite"` で通知する |

通知種別は本画面で「返却期限リマインド」に固定する（画面の目的が返却期限リマインドの送信実績追跡であるため）。

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

- **状態管理**: `NotificationLogState`（`timingType` / `status` / `page` / `items` / `summary` / `loading` / `error` / `resending`）で保持する。フィルターとページは URL クエリと同期する
- **バリデーション**: `timingType` はバリエーション「通知タイミング区分」の値のみ、`status` はバリエーション相当の通知状態（送信待ち / 送信済み / 送信失敗）のみを受け付ける
- **ローディング**: loading 表現は共通コンポーネント `LoadingState`（`@/components/common/LoadingState`）に一本化する。一覧取得中は `AsyncSection` の `skeleton="list"` 経由で `LoadingState`（`kind="list"` / `label="リマインドの送信実績を読み込み中"` / `delayMs=300`）を表示する。再送中は該当行の `SubmitActionButton` が内包する `LoadingState`（`kind="action"` / `label="リマインドメールを再送中"`）で待機を示し、ボタンを `disabled` かつ `aria-busy="true"` にする（arch SR-002 二重送信防止）。画面側で `Skeleton` / `Spinner` を直接使わず、同一領域での併用もしない
- **エラーハンドリング**: 一覧取得失敗は `Alert`（`destructive`）+ 再取得ボタン。再送の 409（送信失敗以外）は「送信失敗の通知のみ再送できます」を `role="alert"` で表示し、一覧を再取得して最新状態へ揃える
- **冪等性**: 再送リクエストごとに UUID の冪等キーを生成し `X-Idempotency-Key` ヘッダへ付与する（arch SR-002）
- **個人情報**: 宛先メールアドレスは既定でマスク表示する（`t***@example.com`）。ブラウザストレージへ保存しない（arch の PII 非保存ルール）

#### 操作フロー

1. 司書がサイドバー「期限・督促」からリマインド送信画面（ルート id `staff-duedate-remind`、`useAppNavigation().navigate("staff-duedate-remind")`）を開く
2. 通知種別「返却期限リマインド」の送信実績を取得し、送信状態サマリを先頭に表示する
3. 送信失敗が 1 件以上あれば `Alert`（`destructive`）で未達件数を表示する
4. 必要に応じて通知タイミング区分・通知状態で絞り込む
5. 送信失敗の行の「再送」を押す
6. 再送受付後に一覧を再取得し、対象行の通知状態が「送信待ち」に変わったことを確認する

## コンポーネント設計

### 受け渡し契約（更新系 UC の共通規約）

`_cross-cutting/ux-ui/common-components.md`「6. コンポーネント間の受け渡し規約」に従う。再送（`POST /api/v1/staff/notifications/{notification_id}/resend`）が本 UC の更新操作である。

| 役割 | コンポーネント | 保持する state | Props / イベント |
|------|--------------|---------------|-----------------|
| 実行結果の所有者 | リマインド送信ページ | `result: NotificationResendResponse \| null` / `submitting: boolean` / `error` | 子へ `submitting` / `onRemindResendSucceeded` を渡す |
| 入力・送信トリガ | RemindNotificationLog | 冪等キーのみ | `onRetry(notificationId)` を親へ通知。結果は保持しない |
| 完了表示 | 再送完了 `Alert(success)` | なし | `result: NotificationResendResponse`（確定値）を親から受け取る |

- 実行結果（`NotificationResendResponse`）の所有者はページコンポーネントであり、子は結果を state に持たない。
- 完了結果の型は `NotificationResendResponse` をそのまま使い、画面側で別名の再定義をしない。本 UC は当該 operation を所有しないため、型の正本は `_api-summary.yaml` の `consumes[].contract`（`_cross-cutting/api/openapi.yaml` の `resendNotification`）であり、所有 UC は「取置き通知メールを送信する」である。
- 子から親への完了通知イベントは `onRemindResendSucceeded` とする（`onDone` / `onComplete` などの汎用名は使わない）。
- 再送完了の表示は state を持たず、`result` が `null` の間は描画しない。
- API 呼び出しの実行主体はページであり、子コンポーネントは API を直接呼ばない。

### RemindNotificationLog

- **ベースコンポーネント**: `NotificationLogTable`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | logs | NotificationLog[] | Yes | 通知の配列（notificationId / recipientEmailMasked / userName / targetLoanId / bookTitle / timingType / status / sendResult / requestedAt） |
  | loading | boolean | Yes | 取得中フラグ。true のとき `AsyncSection` 経由で `LoadingState`（`kind="list"`）を表示する |
  | onRetry | (notificationId: string) => void | Yes | 再送ハンドラ。送信失敗の行にのみ提供する。API 呼び出しはページ側で行う |
  | submitting | boolean | Yes | ページが所有する再送中フラグ。`SubmitActionButton` の `submitting` へ渡す（`disabled` + `aria-busy="true"`） |
  | resendingId | string \| null | No | 再送中の通知ID。該当行の `SubmitActionButton` に `LoadingState`（`kind="action"`）を表示する |
  | result | NotificationResendResponse \| null | No | 直近の再送結果（確定値）。`null` の間は再送完了表示を描画しない |
  | onRemindResendSucceeded | (result: NotificationResendResponse) => void | No | 再送受付完了の通知。ページが一覧を再取得する |
- **状態**: `default` / `with-failures` / `loading` / `empty`（実行結果は保持しない）
- **イベント**: `onRetry(notificationId)` / `onRemindResendSucceeded(result)`

### NotificationSendSummary

- **ベースコンポーネント**: `Card`（UI、`flush`）+ `NotificationStatusBadge`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | pending | number | Yes | 送信待ち件数 |
  | sent | number | Yes | 送信済み件数 |
  | failed | number | Yes | 送信失敗件数 |
- **状態**: なし（表示専用）
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: リマインドメールを送信する - 司書ポータル

  Scenario: 送信状態のサマリを先頭に表示する
    Given API が送信待ち 0 件・送信済み 10 件・送信失敗 2 件のサマリを返す
    When 司書がリマインド送信画面を開く
    Then 画面先頭に「送信待ち 0 / 送信済み 10 / 送信失敗 2」が NotificationStatusBadge つきで表示される

  Scenario: 未達件数を警告として表示する
    Given API が送信失敗 2 件を返す
    When 司書がリマインド送信画面を開く
    Then Alert(destructive) に「未達 2 件」が表示される

  Scenario: 送信失敗の行にだけ再送ボタンを出す
    Given 通知「N-2001」が送信失敗、通知「N-2002」が送信済みで一覧に表示されている
    When 司書がリマインド送信画面の一覧を確認する
    Then 通知「N-2001」の行にのみ Button(outline)「再送」が表示される

  Scenario: 再送中はボタンを二重押下できない
    Given 通知「N-2001」の再送リクエストが処理中である
    When 司書が同じ行の再送ボタンをもう一度押す
    Then ボタンは disabled かつ aria-busy="true" で追加のリクエストは送信されない

  Scenario: 宛先メールアドレスをマスク表示する
    Given 通知「N-2001」の宛先が「tanaka@example.com」である
    When 司書がリマインド送信画面を開く
    Then 一覧の宛先列に「t***@example.com」が表示される

  Scenario: 送信実績が 0 件のとき空状態を表示する
    Given API が通知 0 件を返す
    When 司書がリマインド送信画面を開く
    Then EmptyState に「送信実績はありません」が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（`staff-duedate-upcoming`） |
| `LoadingState` | `@/components/common/LoadingState` | loading 表現の唯一の入口。一覧取得中（`kind="list"`）と再送中（`kind="action"`） |
| `AsyncSection` | `@/components/common/AsyncSection` | RemindNotificationLog の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（RemindNotificationLog（`NotificationLogTable`） + `Pagination` 20 件/頁） |
| `FilterPanel` | `@/components/common/FilterPanel` | 表示要素「通知タイミング区分の絞り込み」（`ToggleGroup(single)`） の内側で使う（置き換えない） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | 送信実行と送信失敗行の再送ボタン（`Button(outline)` / `onRetry`） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | RemindNotificationLog の `recipientEmailMasked` |
| `NotificationLogSection` | `@/components/common/NotificationLogSection` | NotificationSendSummary / RemindNotificationLog（送信対象サマリ → 送信実行 → 送信実績一覧 → 失敗行の再送） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AppShell` | `portal` ← `"staff"` / `routeId` ← `staff-duedate-remind` / `onNavigate` ← 実装リポのルーター遷移関数 / `children` ← 本画面のページ本体 |
| `useAppNavigation` | `navigate` ← ルート id（`staff-duedate-upcoming`）/ `href` ← 表示用リンクの生成 |
| `LoadingState` | `kind` ← 一覧取得中は `"list"`（`AsyncSection` の `skeleton` がそのまま渡る）、再送中は `"action"`（`SubmitActionButton` が内包）/ `label` ← 「リマインドの送信実績を読み込み中」/「リマインドメールを再送中」/ `delayMs` ← `300`（一覧取得中のちらつき抑止） |
| `AsyncSection` | `loading` ← RemindNotificationLog の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"list"`（`LoadingState` の `kind` にそのまま渡る）/ `loadingLabel` ← 「リマインドの送信実績を読み込み中」/ `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← 表示要素「通知タイミング区分の絞り込み」（`ToggleGroup(single)`） / `table` ← RemindNotificationLog（`NotificationLogTable`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |
| `FilterPanel` | `fields` ← 通知タイミング区分（single、未選択で全件） / `onChange` `onSubmit` `onReset` ← 表示要素「通知タイミング区分の絞り込み」（`ToggleGroup(single)`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"outline"`（再送行） / `onSubmit` ← ページの再送ハンドラ（`onRetry`） / `submitting` ← ページが所有する `submitting`（`disabled` + `aria-busy="true"`。内包する `LoadingState` は `kind="action"`） / `children` ← 既存のボタンラベル |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← true / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |
| `NotificationLogSection` | `notificationType` ← `"リマインド"` / `logs` ← 送信実績の配列 / `loading` ← 取得中フラグ / `onSend` ← 送信実行 / `onRetry` ← 送信失敗行のみ活性の再送 |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
