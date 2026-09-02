# 延滞中の貸出を照会する - 司書ポータル仕様

## 変更概要

司書が延滞の発生状況を把握するための延滞状況一覧画面を追加する。超過日数の降順を既定ソートとし、長期延滞から着手できるようにする。督促の実施状況（直近の延滞督促の通知状態）を行に併記し、督促送信画面への導線を持つ。

## 画面仕様

### 延滞状況一覧画面

- **ルート id**: `staff-overdue-list`
- **URL**: `/staff/overdues`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（館内ネットワークからのみ到達可能。NFR E.5.3.1）
- **ポータル**: `staff`（司書ポータル）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインの共通骨格 |
| 延滞サマリ | テキスト | `Card`（`flush`） | 延滞総件数・督促未送信件数・督促未達件数を先頭に表示する |
| 督促未達の警告 | 警告 | `Alert`（`destructive`） | 直近督促が「送信失敗」の貸出が 1 件以上のとき「督促未達 N 件」を表示する |
| 延滞貸出の一覧 | テーブル | `LoanTable`（`showUser=true`） | 書籍タイトル・著者・利用者名・利用者区分・返却期限・超過日数・督促状況を表示する |
| 超過日数の表示 | インジケーター | `DueDateIndicator`（`state=overdue`） | 超過日数を `{N}日超過` の文言で表示する（色のみに依存しない）。返却期限は一覧の列として `YYYY/MM/DD` で桁を揃える（`ui-design.md`「日付・期限の表示規約」が正本） |
| 貸出状態の表示 | バッジ | `LoanStatusBadge`（`state=延滞`, `dot`） | 状態名の文言を必ず伴う |
| 督促状況の表示 | バッジ | `NotificationStatusBadge`（`state`, `dot`） | 送信待ち / 送信済み / 送信失敗（RDRA 通知状態の 3 値のみ） |
| 督促未送信の表示 | バッジ | `Badge`（`neutral`） | 通知レコードが存在しない行は「未送信」を表示する（`NotificationStatusBadge` は「未送信」状態を持たないため使わない） |
| 並び替え | トグル | `ToggleGroup`（`single`, `sm`） | 「超過日数の降順（既定）」「超過日数の昇順」 |
| ページング | ページャ | `Pagination`（20 件/頁） | 一覧下部に配置する |
| 督促送信へ | ボタン | `Button`（`default`） | 督促送信画面（ルート id `staff-overdue-dun`）へ遷移する |
| 0 件時の表示 | 空状態 | `EmptyState`（`default`） | 「延滞中の貸出はありません」 |
| 読み込み中 | 状態表示 | `LoadingState`（`kind: list`, `label: 「延滞状況一覧を読み込み中」`, `delayMs: 300`） | `AsyncSection` の `skeleton` 経由で表示する。画面側で `Skeleton` / `Spinner` を直接使わない |
| 取得失敗 | 警告 | `Alert`（`destructive`） | 再取得ボタンを併記する |

一覧・レポートは最大幅を解除してフル幅で表示する（`ui-design.md` の司書ポータル レイアウト方針）。

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| アクセント | `var(--semantic-primary_staff)` | `var(--color-teal-700)`（`#0F766E`） |
| 延滞の強調 | `var(--semantic-destructive)` | `var(--color-red-600)` |
| 超過日数 | `var(--duedate-over_color)` | component 層の `duedate` トークン |
| 送信失敗 | `var(--semantic-destructive)` | `var(--color-red-600)` |
| テーブル行ホバー | `var(--table-row_hover_bg)` | `var(--hover-muted)` |
| セクション間隔 | `var(--layout-section_gap)` | `var(--spacing-8)` |

#### UIロジック

- **状態管理**: `OverdueListState`（`sort` / `minDaysOverdue` / `page` / `items` / `summary` / `loading` / `error`）で保持する。条件とページは URL クエリと同期する
- **バリデーション**: `sort` は `days_overdue_desc` / `days_overdue_asc` のみ。`minDaysOverdue` は 0 以上の整数のみ許可する
- **ローディング**: loading 表現は共通コンポーネント `LoadingState`（`@/components/common/LoadingState`）に一本化する。取得中は `AsyncSection` の `skeleton="list"` 経由で `LoadingState`（`kind="list"` / `label="延滞状況一覧を読み込み中"` / `delayMs=300`）を表示する。並び替えの切替時は前回結果を保持したまま `aria-busy` を立てる。画面側で `Skeleton` / `Spinner` を直接使わず、同一領域での併用もしない
- **エラーハンドリング**: 取得失敗は `Alert`（`destructive`）+ 再取得ボタン。403 は「この画面は司書のみ利用できます」を表示する
- **本画面は照会専用**: 督促メールの送信・再送は督促送信画面で行う。一覧に送信ボタンを置かない
- **PII**: 利用者の連絡先（メールアドレス）は表示しない。氏名と利用者区分のみ表示する（arch LR-003）
- **アクセシビリティ**: 一覧テーブルに `caption` と `th scope` を付与し、件数の更新を `aria-live="polite"` で通知する。超過日数は数値と文言の両方で示す

#### 操作フロー

1. 司書がサイドバー「期限・督促」から延滞状況一覧画面を開く
2. 既定ソート「超過日数の降順」で一覧を取得する
3. 延滞総件数・督促未送信件数・督促未達件数のサマリを先頭に表示する
4. 督促未達がある場合は `Alert`（`destructive`）で警告する
5. 長期延滞から順に確認し、`Pagination` で 20 件ずつ確認する
6. 「督促を送信する」ボタンで `useAppNavigation().navigate("staff-overdue-dun")`（表示 URL `/staff/overdues/dun`）により督促送信画面へ遷移する

## コンポーネント設計

### OverdueLoanList

- **ベースコンポーネント**: `LoanTable`（Domain）+ `DueDateIndicator`（Domain）+ `LoanStatusBadge`（Domain）+ `NotificationStatusBadge`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | OverdueLoan[] | Yes | 延滞貸出の配列（loanId / bookTitle / author / userNo / userName / userCategory / dueDate / daysOverdue / loanStatus / lastDunStatus） |
  | loading | boolean | Yes | 取得中フラグ。true のとき `AsyncSection` 経由で `LoadingState`（`kind="list"`）を表示する |
  | error | string \| null | Yes | 取得エラーメッセージ |
  | showUser | boolean | Yes | 司書向けのため常に `true` |
  | today | string | Yes | `DueDateIndicator` の基準日（ISO 日付） |
  | emptyMessage | string | No | 既定「延滞中の貸出はありません」 |
- **状態**: `default` / `loading` / `empty` / `error`
- **イベント**: なし（照会専用。行アクションを持たない）

### OverdueSummary

- **ベースコンポーネント**: `Card`（UI、`flush`）+ `Alert`（UI、`destructive`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | overdueTotal | number | Yes | 延滞総件数 |
  | dunNotSent | number | Yes | 督促未送信件数 |
  | dunFailed | number | Yes | 督促未達（送信失敗）件数 |
- **状態**: なし（表示専用）
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 延滞中の貸出を照会する - 司書ポータル

  Scenario: 超過日数の降順を既定ソートにする
    Given API が days_overdue 13 の貸出「L-3001」と days_overdue 3 の貸出「L-3002」をこの順で返す
    When 司書が延滞状況一覧画面を開く
    Then LoanTable の 1 行目に「L-3001」が「13日超過」、2 行目に「L-3002」が「3日超過」で表示される

  Scenario: 督促状況をバッジで表示する
    Given API が貸出「L-3001」の last_dun_status「送信済み」を返す
    When 司書が延滞状況一覧画面を開く
    Then 貸出「L-3001」の行に NotificationStatusBadge「送信済み」が文言つきで表示される

  Scenario: 督促未送信の行を中立表示にする
    Given API が貸出「L-3003」の last_dun_status「未送信」を返す
    When 司書が延滞状況一覧画面を開く
    Then 貸出「L-3003」の行に「未送信」が中立表示のバッジで表示される

  Scenario: 督促未達件数を警告として表示する
    Given API が dun_failed「2」を返す
    When 司書が延滞状況一覧画面を開く
    Then Alert(destructive) に「督促未達 2 件」が表示される

  Scenario: 連絡先を表示しない
    Given API が items に recipient_email を含めずに返す
    When 司書が延滞状況一覧画面を開く
    Then 一覧にメールアドレス列が描画されない

  Scenario: 延滞が 0 件のとき空状態を表示する
    Given API が延滞 0 件を返す
    When 司書が延滞状況一覧画面を開く
    Then EmptyState に「延滞中の貸出はありません」が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（`staff-overdue-dun`） |
| `LoadingState` | `@/components/common/LoadingState` | loading 表現の唯一の入口。一覧取得中（`kind="list"`） |
| `AsyncSection` | `@/components/common/AsyncSection` | OverdueLoanList の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（OverdueLoanList（`LoanTable`） + `Pagination` 20 件/頁） |
| `FilterPanel` | `@/components/common/FilterPanel` | 表示要素「並び替え」（`ToggleGroup(single)`） の内側で使う（置き換えない） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AppShell` | `portal` ← `"staff"` / `routeId` ← `staff-overdue-list` / `onNavigate` ← 実装リポのルーター遷移関数 / `children` ← 本画面のページ本体 |
| `useAppNavigation` | `navigate` ← ルート id（`staff-overdue-dun`）/ `href` ← 表示用リンクの生成 |
| `LoadingState` | `kind` ← `"list"`（`AsyncSection` の `skeleton` がそのまま渡る）/ `label` ← 「延滞状況一覧を読み込み中」/ `delayMs` ← `300` / `rows` ← 表示予定件数（既定 20） |
| `AsyncSection` | `loading` ← OverdueLoanList の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"list"`（`LoadingState` の `kind` にそのまま渡る）/ `loadingLabel` ← 「延滞状況一覧を読み込み中」/ `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← 表示要素「並び替え」（`ToggleGroup(single)`） / `table` ← OverdueLoanList（`LoanTable`） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |
| `FilterPanel` | `fields` ← 並び順（single、超過日数の降順（既定）/ 昇順） / `onChange` `onSubmit` `onReset` ← 表示要素「並び替え」（`ToggleGroup(single)`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
