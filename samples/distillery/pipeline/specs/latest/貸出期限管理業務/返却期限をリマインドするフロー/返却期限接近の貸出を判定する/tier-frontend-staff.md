# 返却期限接近の貸出を判定する - 司書ポータル仕様

## 変更概要

日次タイマーによる返却期限接近判定の結果を司書が確認するための一覧画面を追加する。通知タイミング区分（期限前リマインド / 期限当日）で絞り込み、残日数つきで対象貸出を一覧表示する。リマインド送信画面への導線を持つ。

## 画面仕様

### 返却期限接近貸出一覧画面

- **ルート id**: `staff-duedate-upcoming`
- **URL**: `/staff/duedates/upcoming`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（館内ネットワークからのみ到達可能。NFR E.5.3.1）
- **ポータル**: `staff`（司書ポータル）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインの共通骨格 |
| 判定日時の明示 | テキスト | `Alert`（`info`） | 「日次バッチの判定結果です（判定日時: {evaluated_at}）」を一覧上部に表示する |
| 通知タイミング区分の絞り込み | トグル | `ToggleGroup`（`single`, `sm`） | 値は「期限前リマインド」「期限当日」。既定は「期限前リマインド」 |
| 期限接近貸出の一覧 | テーブル | `LoanTable`（`showUser=true`） | 書籍タイトル・著者・利用者名・貸出日・返却期限（列は `YYYY/MM/DD`）・状態を表示する |
| 残日数の表示 | インジケーター | `DueDateIndicator`（`state=near`） | 残日数を `あと{N}日`（当日は `本日が返却期限`、超過は `{N}日超過`）で表示する（色のみに依存しない） |
| ページング | ページャ | `Pagination`（20 件/頁） | 一覧下部に配置する |
| リマインド送信へ | ボタン | `Button`（`default`） | `useAppNavigation().navigate("staff-duedate-remind")` でリマインド送信画面（表示上は `/staff/duedates/remind`）へ遷移する |
| 0 件時の表示 | 空状態 | `EmptyState`（`default`） | 「対象の貸出はありません」 |
| 読み込み中 | ローディング | `LoadingState`（`kind="list"`, `label="返却期限接近の貸出一覧を読み込み中"`） | 共通の loading 表現。応答が 0.4 秒を超える場合に表示する（`delayMs=300`） |
| 取得失敗 | 警告 | `Alert`（`destructive`） | 再取得ボタンを併記する |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 本文色 | `var(--semantic-foreground)` | `var(--color-gray-900)` |
| アクセント | `var(--semantic-primary_staff)` | `var(--color-teal-700)`（`#0F766E`） |
| 期限接近の強調 | `var(--duedate-near_color)` | component 層の `duedate` トークン |
| ページ余白 | `var(--layout-page_padding)` | `var(--spacing-6)` |
| セクション間隔 | `var(--layout-section_gap)` | `var(--spacing-8)` |
| テーブル境界 | `var(--table-border)` | `var(--border)` |

#### UIロジック

- **状態管理**: `L-frontend-staff-state` の `UpcomingDueListState`（`timingType` / `page` / `items` / `total` / `evaluatedAt` / `loading` / `error`）で保持する。`timingType` と `page` は URL クエリと同期し、ブラウザバックで条件指定へ戻れるようにする
- **バリデーション**: `timingType` はバリエーション「通知タイミング区分」の値（期限前リマインド / 期限当日）のみを受け付ける。`page` は 1 以上の整数のみ許可し、それ以外は 1 に丸める
- **ローディング**: 一覧取得中は `LoadingState`（`kind="list"` / `label="返却期限接近の貸出一覧を読み込み中"`）を `AsyncSection` 経由で表示する。画面側で `Skeleton` / `Spinner` を直接使わない。既存結果があるトグル切替時は前回結果を保持したまま `aria-busy` を立てる
- **日付・残日数の表示**: `_cross-cutting/ux-ui/ui-design.md`「日付・期限の表示規約」に従う。一覧列の返却期限は `YYYY/MM/DD`、本文中の日付は `YYYY年M月D日`、判定日時は `YYYY年M月D日 HH:mm`、残日数は `あと{N}日`（当日は `本日が返却期限`、超過は `{N}日超過`）。API 上は ISO 8601（`due_date` は `YYYY-MM-DD`、`evaluated_at` は date-time）のまま扱い、表示時にのみ変換する
- **エラーハンドリング**: API クライアント層で集約したエラーを `Alert`（`destructive`）へ変換し、`role="alert"` で通知する。403（役割不一致）は「この画面は司書のみ利用できます」を表示し、一覧は描画しない
- **アクセシビリティ**: 一覧テーブルに `caption` と `th scope` を付与する。件数の更新は `aria-live="polite"` で通知する

#### 操作フロー

1. 司書がサイドバー「期限・督促」から返却期限接近貸出一覧画面を開く
2. 既定の通知タイミング区分「期限前リマインド」で一覧を取得する
3. 上部に判定日時（`evaluated_at`）と対象件数を表示する
4. 必要に応じて `ToggleGroup` で「期限当日」に切り替え、再取得する
5. 一覧を確認し、`Pagination` で 20 件ずつ確認する
6. 「リマインドを送信する」ボタンで `useAppNavigation().navigate("staff-duedate-remind")` によりリマインド送信画面（`/staff/duedates/remind`）へ遷移する

## コンポーネント設計

### UpcomingDueLoanList

- **ベースコンポーネント**: `LoanTable`（Domain）+ `DueDateIndicator`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | UpcomingDueLoan[] | Yes | 期限接近貸出の配列（loanId / bookTitle / author / userNo / userName / loanDate / dueDate / daysRemaining） |
  | loading | boolean | Yes | 取得中フラグ。`AsyncSection` 経由で `LoadingState`（`kind="list"`）を表示する |
  | error | string \| null | Yes | 取得エラーメッセージ |
  | showUser | boolean | Yes | 司書向けのため常に `true` |
  | today | string | Yes | `DueDateIndicator` の基準日（ISO 日付） |
  | emptyMessage | string | No | 既定「対象の貸出はありません」 |
- **状態**: `default` / `loading` / `empty` / `error`
- **イベント**: なし（行選択・行アクションは持たない。送信操作はリマインド送信画面が担う）

### DueTimingFilter

- **ベースコンポーネント**: `ToggleGroup`（UI、`single` / `sm`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | "期限前リマインド" \| "期限当日" | Yes | 選択中の通知タイミング区分 |
  | options | string[] | Yes | RDRA バリエーション「通知タイミング区分」の値のみ |
  | disabled | boolean | No | 取得中は `true` |
- **状態**: 選択値（親の `UpcomingDueListState` から供給される制御コンポーネント）
- **イベント**: `onChange(timingType)` — 一覧の再取得をトリガーする

## ティア完了条件（BDD）

```gherkin
Feature: 返却期限接近の貸出を判定する - 司書ポータル

  Scenario: 期限接近貸出の一覧を残日数つきで表示する
    Given API が貸出「L-1001」（書籍「吾輩は猫である」/ 利用者「田中太郎」/ 返却期限「2026-09-05」/ 残日数 3）を 1 件返す
    When 司書が返却期限接近貸出一覧画面を開く
    Then LoanTable に「吾輩は猫である」「田中太郎」の行が返却期限「2026/09/05」で表示され DueDateIndicator に「あと3日」と表示される

  Scenario: 通知タイミング区分を期限当日に切り替える
    Given 返却期限接近貸出一覧画面が「期限前リマインド」で表示されている
    When 司書が ToggleGroup で「期限当日」を選択する
    Then timing_type「期限当日」で一覧が再取得され URL クエリが「?timing_type=期限当日」に同期する

  Scenario: 判定日時を一覧上部に明示する
    Given API が evaluated_at「2026-09-02T01:10:00+09:00」を返す
    When 司書が返却期限接近貸出一覧画面を開く
    Then Alert(info) に「判定日時: 2026年9月2日 01:10」が表示される

  Scenario: 対象 0 件のとき空状態を表示する
    Given API が対象件数 0 件を返す
    When 司書が返却期限接近貸出一覧画面を開く
    Then EmptyState に「対象の貸出はありません」が表示され LoanTable の行は描画されない

  Scenario: 取得に失敗したときエラーを通知する
    Given 一覧 API が HTTP 500 を返す
    When 司書が返却期限接近貸出一覧画面を開く
    Then Alert(destructive) が role="alert" で表示され再取得ボタンが提示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（リマインド送信画面へのルート id 指定遷移） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「読み込み中」（`kind="list"`）。画面側の `Skeleton` / `Spinner` 直接利用を置き換える |
| `AsyncSection` | `@/components/common/AsyncSection` | UpcomingDueLoanList の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（UpcomingDueLoanList（`LoanTable`） + `Pagination` 20 件/頁） |
| `FilterPanel` | `@/components/common/FilterPanel` | DueTimingFilter（`ToggleGroup(single)`） の内側で使う（置き換えない） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"list"`（一覧の取得待ち） / `label` ← `"返却期限接近の貸出一覧を読み込み中"` / `delayMs` ← `300`（トグル切替時のちらつき抑止） / `rows` ← 表示予定件数（20） |
| `AsyncSection` | `loading` ← UpcomingDueLoanList の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"list"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `LoadingState` の `label` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← DueTimingFilter（`ToggleGroup(single)`） / `table` ← UpcomingDueLoanList（`LoanTable`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |
| `FilterPanel` | `fields` ← 通知タイミング区分（single、既定「期限前リマインド」） / `onChange` `onSubmit` `onReset` ← DueTimingFilter（`ToggleGroup(single)`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
