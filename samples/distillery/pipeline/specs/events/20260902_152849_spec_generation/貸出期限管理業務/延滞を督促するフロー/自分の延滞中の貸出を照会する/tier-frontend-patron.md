# 自分の延滞中の貸出を照会する - 利用者ポータル仕様

## 変更概要

督促メールの着地点となる延滞返却対象確認画面を追加する。ログイン中の利用者本人の延滞中の貸出だけを、超過日数つきで表示する。責める文言を避け、超過日数と「窓口で返却してください」の 1 アクションだけを示す。

## 画面仕様

### 延滞返却対象確認画面

- **URL**: `/loans/overdue`（督促メールのリンク先）
- **アクセス権**: 利用者（ログイン必須）。表示対象はログイン中の利用者本人に紐づく貸出のみ
- **ポータル**: `patron`（利用者ポータル）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`patron`） | ヘッダー・サイドバー・メインの共通骨格 |
| 返却の案内 | 通知 | `Alert`（`warning`） | 「返却期限を過ぎた本があります。窓口でご返却ください」の 1 アクションのみを示す |
| 返却対象の冊数 | テキスト | `Alert`（`warning`）内の補足 | 「返却対象 N 冊」を明示する |
| 延滞貸出の一覧 | テーブル | `LoanTable`（`showUser=false`） | 書籍タイトル・著者・貸出日・返却期限を表示する。利用者列は出さない |
| 超過日数の表示 | インジケーター | `DueDateIndicator`（`state=overdue`） | 超過日数を数値と文言で表示する（色のみに依存しない） |
| 0 件時の表示 | 空状態 | `EmptyState`（`with-action`） | 「返却期限を過ぎた貸出はありません」＋現在の貸出一覧への導線 |
| 読み込み中 | スケルトン | `Skeleton`（`table`） | 応答が 0.4 秒を超える場合に表示する |
| 取得失敗 | 警告 | `Alert`（`destructive`） | 再取得ボタンを併記する |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 本文色 | `var(--semantic-foreground)` | `var(--color-gray-900)` |
| アクセント | `var(--semantic-primary_patron)` | `var(--color-blue-700)`（`#1D4ED8`） |
| 警告 | `var(--semantic-warning)` | `var(--color-amber-600)` |
| 期限超過 | `var(--duedate-over_color)` | component 層の `duedate` トークン |
| ページ余白 | `var(--layout-page_padding)` | `var(--spacing-6)` |
| コンテンツ最大幅 | `var(--layout-content_max_width)` | 80rem |

#### UIロジック

- **状態管理**: 画面ローカル状態として `loans` / `total` / `loading` / `error` を保持する（利用者ポータルには状態管理層を置かない構成のため画面内で完結させる）
- **バリデーション**: `page` は 1 以上の整数のみ許可し、それ以外は 1 に丸める
- **ローディング**: 取得中は `Skeleton`（`table`）を表示する
- **エラーハンドリング**: 401 はログイン画面へ誘導する。403 / 500 は `Alert`（`destructive`）を `role="alert"` で表示する
- **文言**: 利用者を責める表現を使わない。事実（超過日数・対象書籍）と次の行動（窓口で返却）だけを示す
- **本人限定参照**: 他利用者のデータへ到達する導線を画面上に置かない（arch SP-004）
- **PII**: 取得した貸出データをブラウザストレージへ保存しない
- **アクセシビリティ**: テーブルに `caption` と `th scope` を付与する。件数の更新を `aria-live="polite"` で通知する。超過日数は数値と文言の両方で示す

#### 操作フロー

1. 利用者が督促メールのリンク、または返却期限リマインド確認画面の導線から延滞返却対象確認画面を開く
2. 返却の案内（`Alert(warning)`）と返却対象の冊数を表示する
3. 延滞中の貸出を超過日数つきで一覧表示する
4. 返却対象貸出確認画面（`/loans/return`）へ進み、持参する冊数を確認して窓口へ向かう

## コンポーネント設計

### MyOverdueLoanList

- **ベースコンポーネント**: `LoanTable`（Domain）+ `DueDateIndicator`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | MyOverdueLoan[] | Yes | 本人の延滞貸出（loanId / bookTitle / author / loanDate / dueDate / daysOverdue / loanStatus） |
  | loading | boolean | Yes | 取得中フラグ |
  | error | string \| null | Yes | 取得エラーメッセージ |
  | showUser | boolean | Yes | 利用者ポータルのため常に `false` |
  | today | string | Yes | `DueDateIndicator` の基準日（ISO 日付） |
  | emptyMessage | string | No | 既定「返却期限を過ぎた貸出はありません」 |
- **状態**: `default` / `loading` / `empty` / `error`
- **イベント**: なし（照会専用）

### OverdueReturnNotice

- **ベースコンポーネント**: `Alert`（UI、`warning`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | overdueCount | number | Yes | 返却対象の冊数。0 のとき描画しない |
- **状態**: なし（表示専用）
- **イベント**: `onNavigateReturn()` — 返却対象貸出確認画面へ遷移する

## ティア完了条件（BDD）

```gherkin
Feature: 自分の延滞中の貸出を照会する - 利用者ポータル

  Scenario: 延滞中の貸出を超過日数つきで表示する
    Given API が貸出「L-3001」（書籍「坊っちゃん」/ 返却期限「2026-09-01」/ 超過日数 1）を返す
    When 利用者が延滞返却対象確認画面を開く
    Then LoanTable に「坊っちゃん」の行が表示され DueDateIndicator に「1日超過」と表示される

  Scenario: 返却対象の冊数を明示する
    Given API が total「2」を返す
    When 利用者が延滞返却対象確認画面を開く
    Then Alert(warning) に「返却対象 2 冊」と「窓口でご返却ください」が表示される

  Scenario: 責める文言を使わない
    Given API が延滞 1 件を返す
    When 利用者が延滞返却対象確認画面を開く
    Then 画面の文言は事実（超過日数・対象書籍）と返却案内のみで、利用者を非難する表現を含まない

  Scenario: 利用者列を表示しない
    Given API が本人の延滞貸出を 1 件返す
    When 利用者が延滞返却対象確認画面を開く
    Then LoanTable に利用者名の列が描画されない

  Scenario: 延滞が 0 件のとき空状態を表示する
    Given API が延滞 0 件を返す
    When 利用者が延滞返却対象確認画面を開く
    Then EmptyState に「返却期限を過ぎた貸出はありません」と現在の貸出一覧への導線が表示される

  Scenario: 未ログインのときログイン画面へ誘導する
    Given アクセストークンが無効である
    When 利用者が /loans/overdue を開く
    Then API が HTTP 401 を返し画面はログイン画面へ遷移する
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | MyOverdueLoanList の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← MyOverdueLoanList の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"table"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 本 UC の一覧はページ送りを伴わないため `DataListSection` を使わず、`AsyncSection` + Domain テーブルの直接組み合わせとする（common-components.md の参考）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
