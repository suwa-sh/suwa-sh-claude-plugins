# 書籍情報を編集する - 司書ポータル仕様

## 変更概要

司書ポータル（tier-frontend-staff）に書誌情報訂正画面（`/staff/books/:bookId/edit`）を実装する。対象書籍の現行値を取得してフォームへ反映し、変更項目の差分確認・資料種別利用可否条件の即時案内・楽観ロック競合の提示を行う。

## 画面仕様

### 書誌情報訂正画面

- **URL**: `/staff/books/:bookId/edit`
- **アクセス権**: 司書
- **ポータル**: `staff`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインコンテンツ |
| 入力フォーム枠 | カード | `Card` | 現行値を初期表示する 1 画面 1 フォーム |
| タイトル / 著者 / ISBN / 出版社 | テキスト入力 | `Input`（`default` / `error`） | 変更した項目はラベルに変更マークを付ける |
| ジャンル | 単一選択 | `ToggleGroup`（`single`） | RDRA バリエーション「ジャンル」の 8 値 |
| 資料種別 | 単一選択 | `ToggleGroup`（`single`） | 「紙書籍」「電子書籍」。電子書籍選択時は未対応案内 |
| 書籍状態 | バッジ | `BookStatusBadge` | 参照表示のみ（本 UC では変更しない） |
| 変更項目の確認 | カード | `Card`（`flush`） | 保存前に「項目: 変更前 → 変更後」を列挙する |
| 未対応案内 | メッセージ | `Alert`（`warning`） | 資料種別「電子書籍」選択時 |
| 保存ボタン | ボタン | `Button`（`default`, `lg`） | 差分がないときは `disabled`。送信中は `loading` + `aria-busy` |
| 取消ボタン | ボタン | `Button`（`outline`） | 蔵書管理台帳画面へ戻る |
| 取得・保存エラー | メッセージ | `Alert`（`destructive`） | 404 / 409 / 5xx の原因と次の行動を同じ位置に置く |
| 読み込み中 | ローディング | `Skeleton`（`line`） | 現行値の取得中に表示する |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--background)` | `var(--color-white)` |
| アクセント | `var(--primary)` | `var(--color-teal-700)`（#0F766E） |
| 入力枠線 | `var(--input-border)` | `var(--border-strong)` |
| フォーカスリング | `var(--ring)` | `var(--color-blue-500)` |
| 変更差分の強調 | `var(--info)` | `var(--color-blue-600)` |
| 警告 | `var(--warning)` | `var(--color-amber-600)` |
| カード余白 | `var(--card-padding)` | `var(--spacing-6)` |

#### UIロジック

- **状態管理**: 現行値（current）と入力値（draft）を分けて保持し、差分（dirtyFields）を算出する。楽観ロック用の version も保持する
- **バリデーション**: 登録時と同一ルール（タイトル・著者・出版社は必須 255 文字以内、ISBN は任意で 13 桁/10 桁、ジャンル・資料種別は必須でバリエーション値のみ）
- **資料種別利用可否条件**: 「電子書籍」を選択した時点で `Alert(warning)` を表示し、保存ボタンを `disabled` にする
- **差分がないときの抑止**: dirtyFields が空なら保存ボタンを `disabled` にする
- **ローディング**: 現行値の取得中は `Skeleton(line)`、保存中は `Button` を `loading` にする
- **エラーハンドリング**: 404 は「対象の書籍が見つかりません」+ 台帳への導線、409 は「他の担当者が更新しました。最新の内容を読み込んで操作し直してください」+ 再読込ボタン、5xx は再試行ボタンを表示する
- **二重送信防止**: 送信開始で `disabled`、`X-Idempotency-Key` を API クライアント層で付与する（arch SR-002）

#### 操作フロー

1. 司書が蔵書管理台帳画面の行アクション「編集」から書誌情報訂正画面へ遷移する
2. `GET /api/v1/books/{book_id}` で現行値と version を取得し、フォームへ反映する
3. 司書が訂正したい項目を編集する
4. 変更項目が「項目: 変更前 → 変更後」の形で確認表示される
5. 保存ボタンを押すと `PUT /api/v1/books/{book_id}` を冪等キー付きで送信する
6. 成功時は「更新しました」と台帳への遷移導線を表示する

## コンポーネント設計

### BookEditForm

- **ベースコンポーネント**: `Card`（UI） + `Input`（UI） + `ToggleGroup`（UI） + `BookStatusBadge`（Domain） + `Button`（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | current | BookSummary | Yes | 取得した現行の書誌情報 |
  | value | BookEditFormValue | Yes | 入力中の値 |
  | onChange | (v: BookEditFormValue) => void | Yes | 入力変更ハンドラ |
  | onSubmit | () => void | Yes | 保存実行 |
  | submitting | boolean | Yes | 送信中フラグ |
  | errors | Record<string, string> | No | 項目別エラーメッセージ |
- **状態**: 項目別タッチ状態、未対応案内の表示可否
- **イベント**: onChange、onSubmit、onCancel

### BookDiffSummary

- **ベースコンポーネント**: `Card`（`flush`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | current | BookSummary | Yes | 変更前の値 |
  | draft | BookEditFormValue | Yes | 変更後の値 |
- **状態**: なし（差分は props から算出する）
- **イベント**: なし（表示専用）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍情報を編集する - 司書ポータル

  Scenario: 現行の書誌情報をフォームへ反映する
    Given API が book_id「BK-001」に対しタイトル「吾輩は猫である」・著者「夏目 漱右」を返す状態である
    When 司書が書誌情報訂正画面（/staff/books/BK-001/edit）を開く
    Then タイトル欄に「吾輩は猫である」、著者欄に「夏目 漱右」が初期表示される

  Scenario: 変更した項目だけを差分表示する
    Given 司書が「吾輩は猫である」の書誌情報訂正画面を開いている
    When 司書が著者を「夏目漱石」に変更する
    Then 変更項目に「著者: 夏目 漱右 → 夏目漱石」だけが表示される

  Scenario: 差分がないときは保存できない
    Given 司書が書誌情報訂正画面を開いている
    When 司書が何も変更せずに保存ボタンを見る
    Then 保存ボタンが disabled になっている

  Scenario: 楽観ロック競合を再読込導線つきで示す
    Given API が PUT に対し HTTP 409 を返す状態である
    When 司書が著者を訂正して保存する
    Then Alert(destructive) に「他の担当者が更新しました。最新の内容を読み込んで操作し直してください」と再読込ボタンが表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | BookEditForm の現行値取得 の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `EntityFormSection` | `@/components/common/EntityFormSection` | BookEditForm の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | BookEditForm の保存ボタン |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← BookEditForm の現行値取得 の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `EntityFormSection` | `mode` ← `"edit"` / `fields` ← タイトル / 著者 / ISBN / 出版社（text）、ジャンル（single） / `value` `onChange` ← BookEditForm の同名 props / `current` ← BookEditForm の `current`（BookDiffSummary の差分表示に使う） / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
