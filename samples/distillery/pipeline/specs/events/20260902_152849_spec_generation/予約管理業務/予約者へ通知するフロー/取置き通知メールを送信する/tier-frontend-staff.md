# 取置き通知メールを送信する - 司書ポータル仕様

## 変更概要

取置き通知送信画面を追加し、取置き案内の送信実行・送信実績の確認・送信失敗の再送を提供する。送信は非同期処理（202 受付）であるため、受付直後は「送信待ち」を表示し、通知状態の遷移をポーリングで反映する。未達（送信失敗）は上部の警告で件数を知らせる。

## 画面仕様

### 取置き通知送信画面

- **URL**: `/staff/holds/notify`
- **アクセス権**: 司書（ログイン済み。役割=司書。館内ネットワークからのみアクセス可 / NFR E.5.3.1）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | `PortalShell`（variant: staff） | サイドバー + ヘッダー + 本文の骨格 |
| 送信実績一覧 | テーブル | `NotificationLogTable`（states: default / with-failures / loading / empty） | 通知種別・宛先利用者番号・送信日時・通知状態・送信結果を一覧。送信失敗行のみ再送操作を出す |
| 通知の状態 | バッジ | `NotificationStatusBadge` | 通知状態（送信待ち / 送信済み / 送信失敗）を dot + 文言で表示 |
| 未達件数の警告 | 通知 | `Alert`（warning / destructive） | 送信失敗の件数と追跡導線を上部に表示 |
| 取置き案内を送信 | ボタン | `Button`（default / md） | 送信対象への送信を実行する主操作。送信中は `disabled` かつ `aria-busy="true"` |
| 再送 | ボタン | `Button`（outline / sm） | 送信失敗行の再送操作 |
| 通知種別の絞り込み | トグル | `ToggleGroup`（single / sm） | 通知種別（取置き案内 / 返却期限リマインド / 延滞督促）で絞り込む。既定は「取置き案内」 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-teal-700)` |
| 送信待ちの状態色 | `var(--semantic-warning)` | `var(--color-amber-600)` |
| 送信済みの状態色 | `var(--semantic-success)` | `var(--color-green-600)` |
| 送信失敗の状態色 | `var(--semantic-destructive)` | `var(--color-red-600)` |
| テーブルヘッダー背景 | `var(--table-header-bg)` | `var(--color-gray-50)` |
| セクション間余白 | `var(--section-gap)` | `var(--spacing-8)` |

#### UIロジック

- **状態管理**: 状態管理層（`L-frontend-staff-state`）で `target`（送信対象の予約）・`logs`（送信実績一覧）・`submitting`・`error` を保持する。202 受付後は送信実績一覧を一定間隔で再取得し、通知状態が「送信待ち」から遷移したら停止する
- **バリデーション**: 送信対象の予約IDが未指定、または取置き通知対象条件を満たさない場合は送信ボタンを非活性にし、根拠条件名を `Alert(warning)` に表示する（反応型オンボーディング）
- **ローディング**: 一覧取得中は `Skeleton`（table）を表示する。送信要求中は `Button` を `disabled` かつ `aria-busy="true"` にする
- **エラーハンドリング**: 409（重複送信 / 条件未充足）は `Alert(warning)`、403 は `Alert(destructive)`、5xx は再試行導線つき `Alert(destructive)` を `role="alert"` で通知する。一覧は `EmptyState` / `Alert(destructive)` / `Skeleton` の 3 状態を必ず実装する
- **二重送信防止**: 送信ごとに UUID の冪等キーを生成し `X-Idempotency-Key` に付与する（arch SR-002）
- **完了時の提示**: 送信結果はピーク・エンドの法則に従い、結果サマリ（件数 + 状態バッジ）と次の行動導線（取置き対象者特定画面へ戻る / 未達の再送）を同じ位置に提示する
- **PII**: 送信実績一覧では宛先メールアドレスをマスク表示し、利用者番号で識別する（NFR E.1.2.1）

#### 操作フロー

1. 取置き対象者特定画面から送信対象（予約ID・通知種別=取置き案内）を引き継いで `/staff/holds/notify` を開く
2. 送信対象と宛先利用者番号を確認する
3. 「取置き案内を送信」を押下する（202 受付）
4. 送信実績一覧で通知状態が「送信待ち」から「送信済み」または「送信失敗」へ変わるのを確認する
5. 送信失敗があれば該当行の「再送」を押下する

## コンポーネント設計

### HoldNoticeSendPanel

- **ベースコンポーネント**: `Card` + `Button(default)` + `Alert`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | target | object | Yes | 送信対象（reservation_id, book_title, user_no, notification_type=取置き案内） |
  | sendable | boolean | Yes | 取置き通知対象条件を満たすか |
  | reasonCondition | string | No | 送信不可のときの根拠条件名 |
  | submitting | boolean | Yes | 送信中フラグ |
  | onSend | function | Yes | 送信実行ハンドラ |
- **状態**: なし（送信状態は状態管理層で保持）
- **イベント**: `onSend`

### HoldNoticeLogSection

- **ベースコンポーネント**: `NotificationLogTable` + `NotificationStatusBadge` + `ToggleGroup(single)` + `Alert(warning)`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | logs | array | Yes | 送信実績（notification_id, notification_type, recipient_user_no, sent_at, notification_status, send_result） |
  | loading | boolean | Yes | 読み込み中フラグ |
  | failureCount | number | Yes | 通知状態が「送信失敗」の件数 |
  | notificationType | string | Yes | 絞り込み中の通知種別（既定: 取置き案内） |
  | onRetry | function | Yes | 再送ハンドラ |
  | onChangeType | function | Yes | 通知種別の絞り込み変更ハンドラ |
- **状態**: `pollingActive`（送信待ちが存在する間のポーリング可否）
- **イベント**: `onRetry`、`onChangeType`

## ティア完了条件（BDD）

```gherkin
Feature: 取置き通知メールを送信する - 司書ポータル

  Scenario: 送信を実行すると送信待ちの行が追加される
    Given 司書が取置き通知送信画面 /staff/holds/notify を開き送信対象が予約 R-0007 である
    When 司書が「取置き案内を送信」を押下する
    Then POST /api/v1/staff/notifications/hold-notices が X-Idempotency-Key 付きで 1 回だけ送信される
    And 送信実績一覧に「送信待ち」バッジの行が追加される

  Scenario: 送信済みへの遷移が一覧に反映される
    Given 通知 N-0001 の通知状態が「送信待ち」で一覧に表示されている
    When ワーカーの送信が成功して通知状態が「送信済み」になる
    Then ポーリングにより一覧の該当行が「送信済み」バッジへ更新される
    And ポーリングが停止する

  Scenario: 送信失敗行に再送ボタンと未達警告を表示する
    Given 通知 N-0002 の通知状態が「送信失敗」である
    When 司書が取置き通知送信画面 /staff/holds/notify を開く
    Then 上部に未達件数 1 件の Alert(warning) が表示される
    And 該当行に「再送」ボタン（outline）が表示される

  Scenario: 送信対象が条件を満たさない場合は送信できない
    Given 送信対象の予約 R-0300 の予約状態が「キャンセル」である
    When 司書が取置き通知送信画面 /staff/holds/notify を開く
    Then 「取置き案内を送信」ボタンが非活性になる
    And 根拠条件名「取置き通知対象条件」が Alert(warning) に表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | HoldNoticeLogSection の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `FilterPanel` | `@/components/common/FilterPanel` | HoldNoticeLogSection の通知種別トグル（`ToggleGroup(single)`） の内側で使う（置き換えない） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | HoldNoticeSendPanel の送信ボタン（`onSend`）と送信失敗行の再送（`outline`） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | HoldNoticeLogSection の宛先（`NotificationLogTable` の宛先列） |
| `NotificationLogSection` | `@/components/common/NotificationLogSection` | HoldNoticeSendPanel / HoldNoticeLogSection（送信対象サマリ → 送信実行 → 送信実績一覧 → 失敗行の再送） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← HoldNoticeLogSection の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"table"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `FilterPanel` | `fields` ← 通知種別（single、既定「取置き案内」） / `onChange` `onSubmit` `onReset` ← HoldNoticeLogSection の通知種別トグル（`ToggleGroup(single)`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← true / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |
| `NotificationLogSection` | `notificationType` ← `"取置き通知"` / `logs` ← 送信実績の配列 / `loading` ← 取得中フラグ / `onSend` ← 送信実行 / `onRetry` ← 送信失敗行のみ活性の再送 |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 本 UC の一覧はページ送りを伴わないため `DataListSection` を使わず、`AsyncSection` + Domain テーブルの直接組み合わせとする（common-components.md の参考）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
