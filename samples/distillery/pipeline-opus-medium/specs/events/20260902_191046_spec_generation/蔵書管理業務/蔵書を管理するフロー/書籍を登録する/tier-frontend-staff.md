# 書籍を登録する - 司書ポータル仕様

## 変更概要

司書ポータル（tier-frontend-staff）に書籍受入登録画面（`/staff/books/new`）を実装する。書誌情報の入力・資料種別利用可否条件の即時案内・冪等キー付き送信・登録完了の提示を行う。

## 画面仕様

### 書籍受入登録画面

- **ルート id**: `staff-book-new`
- **URL**: `/staff/books/new`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書
- **ポータル**: `staff`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | ヘッダー・サイドバー・メインコンテンツ |
| 入力フォーム枠 | カード | `Card` | 1 画面 1 フォーム。`lg` は 2 列、`md` 以下は 1 列 |
| タイトル / 著者 / ISBN / 出版社 | テキスト入力 | `Input`（`default` / `error`） | 必須項目はラベルに必須表示。ISBN は任意 |
| ジャンル | 単一選択 | `ToggleGroup`（`single`） | 選択肢は RDRA バリエーション「ジャンル」の 8 値のみ |
| 資料種別 | 単一選択 | `ToggleGroup`（`single`） | 「紙書籍」「電子書籍」。既定は「紙書籍」 |
| 未対応案内 | メッセージ | `Alert`（`warning`） | 資料種別「電子書籍」選択時に表示する |
| 登録ボタン | ボタン | `Button`（`default`, `lg`） | 送信中は `SubmitActionButton` 内の `LoadingState`（`kind="action"`, `label="書籍を登録中"`）で待機表現を出し、`disabled` / `aria-busy="true"` にする |
| 取消ボタン | ボタン | `Button`（`outline`） | `useAppNavigation().navigate("staff-book-list")` で蔵書管理台帳画面（`/staff/books`）へ戻る |
| 登録完了 | メッセージ | `Alert`（`success`） | 「登録しました」と `useAppNavigation().navigate("staff-book-list")` による台帳への遷移導線を併記する |
| 登録エラー | メッセージ | `Alert`（`destructive`） | 原因と再試行手段を同じ位置に置く |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--background)` | `var(--color-white)` |
| アクセント | `var(--primary)` | `var(--color-teal-700)`（#0F766E） |
| 入力枠線 | `var(--input-border)` | `var(--border-strong)` |
| フォーカスリング | `var(--ring)` | `var(--color-blue-500)` |
| 警告 | `var(--warning)` | `var(--color-amber-600)` |
| 成功 | `var(--success)` | `var(--color-green-600)` |
| カード余白 | `var(--card-padding)` | `var(--spacing-6)` |

#### UIロジック

- **状態管理**: 入力値・送信中フラグ・冪等キー（UUID）を画面ローカルの BookIntakeFormState で保持する。送信成功後は台帳へ遷移し、状態を破棄する
- **バリデーション**: タイトル・著者・出版社（各 255 文字以内、必須）、ISBN（任意、13 桁または 10 桁のハイフン許容形式）、ジャンル・資料種別（必須、バリエーション値のみ）。エラーは該当 `Input` を `error` バリアントにし、`role="alert"` で通知する
- **資料種別利用可否条件の即時案内**: 「電子書籍」を選択した時点で `Alert(warning)` に「電子書籍は現在未対応です。紙書籍のみ登録できます」を表示し、登録ボタンを `disabled` にする（決断疲れの回避とフレーミング効果に従い、できることを先に書く）
- **ローディング**: 送信中の待機表現は `SubmitActionButton` に内包された `LoadingState`（`kind="action"` / `label="書籍を登録中"`）に一本化し、フォーム全体を再入力不可にする。画面側で `Spinner` / `Skeleton` / `animate-pulse` を直接使わない
- **エラーハンドリング**: 400/422 は該当項目または `Alert(destructive)`、401 は再ログイン導線、5xx は再試行ボタンを表示する
- **二重送信防止**: 送信開始で `disabled`、`X-Idempotency-Key` を API クライアント層で付与する（arch SR-002）

#### 操作フロー

1. 司書が蔵書管理台帳画面の「新規登録」から `useAppNavigation().navigate("staff-book-new")` で書籍受入登録画面（`/staff/books/new`）へ遷移する
2. タイトル・著者・ISBN・出版社を入力する
3. ジャンルを `ToggleGroup` から 1 つ選ぶ
4. 資料種別を選ぶ（「電子書籍」を選ぶと未対応案内が出て登録できない）
5. 登録ボタンを押す（冪等キー付きで `POST /api/v1/books`）
6. 成功時はページコンポーネントが `result`（`BookResponse`）を確定させ、`Alert(success)` と `useAppNavigation().navigate("staff-book-list")` による台帳（`/staff/books`）への遷移導線を表示する

## コンポーネント設計

### 受け渡し契約（`common-components.md`「6. コンポーネント間の受け渡し規約」）

- **実行結果の所有者は書籍受入登録ページ（ページコンポーネント）**とする。ページが `result: BookResponse | null` と `submitting: boolean` を保持し、`POST /api/v1/books` の実行主体になる。子コンポーネントは API を直接呼ばない
- **完了結果の型は API のレスポンススキーマ名 `BookResponse`（`_api-summary.yaml` の `response_schema`）をそのまま使う**。画面側で別名を再定義しない
- **子から親へのイベント名は `on{ドメイン動詞}{結果}`** に揃える（本 UC は `onBookRegistrationSucceeded`）。`onDone` / `onComplete` / `onBook` のような汎用名は使わない
- **結果表示コンポーネントは state を持たない**。確定値を Props で受け取り、`result` が `null` の間は描画しない（「未実行」と「結果 0 件」を区別する）

### BookIntakeForm

- **ベースコンポーネント**: `Card`（UI） + `Input`（UI） + `ToggleGroup`（UI） + `Button`（UI） + `Alert`（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | BookIntakeFormValue | Yes | title / author / isbn / publisher / genre / material_type |
  | onChange | (v: BookIntakeFormValue) => void | Yes | 入力変更ハンドラ |
  | onSubmit | () => void | Yes | 登録実行 |
  | submitting | boolean | Yes | 送信中フラグ（親が所有し、`SubmitActionButton` の `LoadingState(kind="action")` に伝播する） |
  | errors | Record<string, string> | No | 項目別エラーメッセージ |
- **状態**: 項目別のタッチ状態（blur 済みか）、未対応案内の表示可否、冪等キー。**登録結果（`BookResponse`）は保持しない**
- **イベント**: onChange、onSubmit（入力値を親へ通知する。API 呼び出しは親が行う）、onCancel

### BookIntakeResult

- **ベースコンポーネント**: `Alert`（`success`） + `Button`（`outline`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | result | BookResponse | Yes | 親が確定させた登録結果。`null` の間は本コンポーネントを描画しない |
  | onBookRegistrationSucceeded | (book: BookResponse) => void | Yes | 完了後の次の行動導線（`useAppNavigation().navigate("staff-book-list")`）を親へ通知する |
- **状態**: なし（表示専用。結果の所有者はページコンポーネント）
- **イベント**: onBookRegistrationSucceeded

### MaterialTypeNotice

- **ベースコンポーネント**: `Alert`（`warning`）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | materialType | string | Yes | 選択中の資料種別 |
- **状態**: なし
- **イベント**: なし（表示専用。materialType が「電子書籍」のときだけ描画する）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を登録する - 司書ポータル

  Scenario: 必須項目をすべて入力すると登録ボタンが有効になる
    Given 司書が書籍受入登録画面を開いている
    When 司書がタイトル「吾輩は猫である」、著者「夏目漱石」、出版社「新潮社」、ジャンル「文学」、資料種別「紙書籍」を入力する
    Then 登録ボタンが有効になる

  Scenario: 電子書籍の選択で未対応案内を表示する
    Given 司書が書籍受入登録画面で必須項目をすべて入力している
    When 司書が資料種別「電子書籍」を選択する
    Then 「電子書籍は現在未対応です。紙書籍のみ登録できます」という警告が表示され、登録ボタンが無効になる

  Scenario: タイトル未入力のエラーを項目に表示する
    Given 司書が書籍受入登録画面を開いている
    When 司書がタイトルを空欄のままフォーカスを外す
    Then タイトル入力欄が error バリアントになり「タイトルを入力してください」と表示される

  Scenario: 送信中はボタンを二度押しできない
    Given 司書が書籍受入登録画面で「坊っちゃん」の入力を完了している
    When 司書が登録ボタンを押す
    Then 登録ボタンが loading かつ disabled になり aria-busy が true になる
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（`staff-book-list`） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「登録ボタン」の送信中待機（`kind="action"`）。`SubmitActionButton` 経由で間接利用する |
| `EntityFormSection` | `@/components/common/EntityFormSection` | BookIntakeForm の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | BookIntakeForm の登録ボタン（`Button(default, lg)`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `EntityFormSection` | `mode` ← `"create"` / `fields` ← タイトル / 著者 / ISBN / 出版社（text）、ジャンル / 資料種別（single） / `value` `onChange` ← BookIntakeForm の同名 props / `current` ← — / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `LoadingState` | `kind` ← `"action"`（登録ボタン押下中） / `label` ← `"書籍を登録中"` |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけ
- 本 UC は `AsyncSection` の対象外（新規入力が起点で取得待ちが無い / common-components.md）。取得を伴う領域がある場合は Domain テーブル自身の 4 状態（default / loading / empty / error）で満たす
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
