# 自分の返却期限を照会する - 利用者ポータル仕様

## 変更概要

返却期限リマインドメールの着地点となる返却期限リマインド確認画面を追加する。ログイン中の利用者本人の期限接近の貸出だけを、残日数つきで表示する。通知タイミング区分（期限前リマインド / 期限当日）で見出しを出し分ける。

## 画面仕様

### 返却期限リマインド確認画面

- **URL**: `/loans/due`（クエリ `timing_type` を受け付ける。リマインドメールのリンク先）
- **アクセス権**: 利用者（ログイン必須）。表示対象はログイン中の利用者本人に紐づく貸出のみ
- **ポータル**: `patron`（利用者ポータル）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`patron`） | ヘッダー・サイドバー・メインの共通骨格 |
| 見出し | テキスト | `PortalShell` のページ見出し | `timing_type` で「返却期限が近づいています」/「本日が返却期限です」を出し分ける |
| 返却期限の案内 | 通知 | `Alert`（`info`） | 「窓口でご返却ください」の 1 アクションを示す |
| 期限超過の案内 | 通知 | `Alert`（`warning`） | 延滞の貸出があるとき延滞返却対象確認画面（`/loans/overdue`）への導線を示す |
| 対象貸出の一覧 | テーブル | `LoanTable`（`showUser=false`） | 書籍タイトル・著者・貸出日・返却期限を表示する。利用者列は出さない |
| 残日数の表示 | インジケーター | `DueDateIndicator`（`safe` / `near` / `due-today` / `overdue`） | 残日数を数値と文言で表示する（色のみに依存しない）。残日数 0 の行は `due-today` を使う |
| 0 件時の表示 | 空状態 | `EmptyState`（`with-action`） | 「返却期限が近い貸出はありません」＋現在の貸出一覧への導線 |
| 読み込み中 | スケルトン | `Skeleton`（`table`） | 応答が 0.4 秒を超える場合に表示する |
| 取得失敗 | 警告 | `Alert`（`destructive`） | 再取得ボタンを併記する |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 本文色 | `var(--semantic-foreground)` | `var(--color-gray-900)` |
| アクセント | `var(--semantic-primary_patron)` | `var(--color-blue-700)`（`#1D4ED8`） |
| 期限接近 | `var(--duedate-near_color)` | component 層の `duedate` トークン |
| 期限超過 | `var(--duedate-over_color)` | component 層の `duedate` トークン |
| ページ余白 | `var(--layout-page_padding)` | `var(--spacing-6)` |
| コンテンツ最大幅 | `var(--layout-content_max_width)` | 80rem |

#### UIロジック

- **状態管理**: `L-frontend-patron-view` の画面ローカル状態として `timingType` / `loans` / `total` / `loading` / `error` を保持する（利用者ポータルには状態管理層を置かない構成のため、画面内で完結させる）
- **バリデーション**: クエリの `timing_type` はバリエーション「通知タイミング区分」の値（期限前リマインド / 期限当日）のみを受け付ける。不正値は既定「期限前リマインド」に丸めて照会する
- **ローディング**: 取得中は `Skeleton`（`table`）を表示する（ドハティの閾値 0.4 秒）
- **エラーハンドリング**: 401 はログイン画面へ誘導する。403 / 500 は `Alert`（`destructive`）を `role="alert"` で表示する
- **本人限定参照**: 他利用者のデータへ到達する導線を画面上に置かない（arch SP-004）。利用者番号や氏名の入力欄も設けない
- **PII**: 取得した貸出データをブラウザストレージへ保存しない（arch の PII 非保存ルール）
- **アクセシビリティ**: テーブルに `caption` と `th scope` を付与し、件数の更新を `aria-live="polite"` で通知する。日付は `toLocaleDateString('ja-JP')` で書式化する

#### 操作フロー

1. 利用者がリマインドメールのリンク、またはサイドバー「貸出」から返却期限リマインド確認画面を開く
2. クエリの `timing_type` に応じた見出しを表示する
3. 本人の期限接近貸出を取得して一覧表示する（残日数つき）
4. 延滞の貸出がある場合は `Alert`（`warning`）で延滞返却対象確認画面への導線を示す
5. 返却対象貸出確認画面（`/loans/return`）へ進み、窓口へ持参する冊数を確認する

## コンポーネント設計

### MyDueLoanList

- **ベースコンポーネント**: `LoanTable`（Domain）+ `DueDateIndicator`（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loans | MyDueLoan[] | Yes | 本人の期限接近貸出（loanId / bookTitle / author / loanDate / dueDate / daysRemaining / loanStatus） |
  | loading | boolean | Yes | 取得中フラグ |
  | error | string \| null | Yes | 取得エラーメッセージ |
  | showUser | boolean | Yes | 利用者ポータルのため常に `false` |
  | today | string | Yes | `DueDateIndicator` の基準日（ISO 日付） |
  | emptyMessage | string | No | 既定「返却期限が近い貸出はありません」 |
- **状態**: `default` / `loading` / `empty` / `error`
- **イベント**: なし（照会専用。行アクションを持たない）

### DueDateNotice

- **ベースコンポーネント**: `Alert`（UI、`info` / `warning`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | timingType | "期限前リマインド" \| "期限当日" | Yes | 見出しと本文の出し分けに使う |
  | overdueCount | number | Yes | 延滞の貸出件数。1 以上のとき `warning` で延滞画面への導線を出す |
- **状態**: なし（表示専用）
- **イベント**: `onNavigateOverdue()` — 延滞返却対象確認画面へ遷移する

## ティア完了条件（BDD）

```gherkin
Feature: 自分の返却期限を照会する - 利用者ポータル

  Scenario: 本人の期限接近貸出を残日数つきで表示する
    Given API が貸出「L-1001」（書籍「吾輩は猫である」/ 返却期限「2026-09-05」/ 残日数 3）を返す
    When 利用者が返却期限リマインド確認画面を開く
    Then LoanTable に「吾輩は猫である」の行が表示され DueDateIndicator に「残り3日」と表示される

  Scenario: 期限当日のクエリで見出しを切り替える
    Given API が返却期限「2026-09-02」の貸出を 1 件返す
    When 利用者が /loans/due?timing_type=期限当日 を開く
    Then 見出しに「本日が返却期限です」が表示される

  Scenario: 利用者列を表示しない
    Given API が本人の貸出を 1 件返す
    When 利用者が返却期限リマインド確認画面を開く
    Then LoanTable に利用者名の列が描画されない

  Scenario: 延滞があるとき延滞画面への導線を出す
    Given API が overdue_count「1」を返す
    When 利用者が返却期限リマインド確認画面を開く
    Then Alert(warning) に「返却期限を過ぎた貸出があります」と /loans/overdue への導線が表示される

  Scenario: 対象が 0 件のとき空状態を表示する
    Given API が対象件数 0 件を返す
    When 利用者が返却期限リマインド確認画面を開く
    Then EmptyState に「返却期限が近い貸出はありません」と現在の貸出一覧への導線が表示される

  Scenario: 未ログインのときログイン画面へ誘導する
    Given アクセストークンが無効である
    When 利用者が /loans/due を開く
    Then API が HTTP 401 を返し画面はログイン画面へ遷移する
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | MyDueLoanList の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← MyDueLoanList の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"table"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
