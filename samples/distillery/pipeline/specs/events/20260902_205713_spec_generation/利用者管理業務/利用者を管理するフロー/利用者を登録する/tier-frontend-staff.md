# 利用者を登録する - 司書ポータル仕様

## 変更概要

司書ポータル（`tier-frontend-staff`）に利用申込受付画面を追加し、氏名・連絡先・利用者区分の入力フォーム、送信中の二重送信防止、冪等キーの付与、採番結果の提示を実装する。登録成功後は利用者名簿のキャッシュを無効化する。

## 画面仕様

### 利用申込受付画面

- **ルート id**: `staff-user-new`
- **URL**: `/staff/users/new`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（役割「司書」のトークンを持つ場合のみ表示 / LP-029）
- **ポータル**: `staff`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | サイドバー「利用者管理」を選択状態にする |
| 入力フォーム枠 | カード | `Card`（`default`） | `lg` は 2 列、`md` 以下は 1 列にスタックする |
| 氏名 | フォーム | `Input`（`default` / `error`） | 必須。最大 100 文字 |
| 連絡先（メールアドレス） | フォーム | `Input`（`default` / `error`） | 必須。メールアドレス書式。個人情報である旨の補足を添える |
| 利用者区分 | フォーム | `ToggleGroup`（`single` / `md`） | 一般 / 学生 / 団体。既定は「一般」 |
| 登録ボタン | ボタン | `Button`（`default` / `lg`） | `SubmitActionButton` 経由。送信中は `disabled` かつ `aria-busy="true"` |
| 送信中の待機表現 | プレースホルダ | `LoadingState`（`kind="action"` / `label="利用者を登録中"`） | 更新系ボタン押下中の唯一の loading 表現。`SubmitActionButton` が内包する |
| キャンセル | ボタン | `Button`（`outline`） | `useAppNavigation().navigate("staff-user-list")` で利用者名簿画面へ戻る（表示 URL: `/staff/users`） |
| 業務メッセージ | メッセージ | `Alert`（`success` / `destructive`） | 採番された利用者番号、または失敗理由と再試行手段 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| カード余白 | `var(--card-padding)` | `var(--spacing-6)` |
| 入力枠線 | `var(--input-border)` | `var(--border-strong)` |
| フォーカスリング | `var(--input-focus-ring)` | `var(--ring)` |
| ポータルアクセント | `var(--primary)` | `var(--color-teal-700)`（`#0F766E`） |
| 成功表示 | `var(--semantic-success)` | `var(--color-green-600)` |
| エラー表示 | `var(--semantic-destructive)` | `var(--color-red-600)` |

#### UIロジック

- **状態管理**: フォーム値・送信中フラグ・冪等キーを状態管理層（`L-frontend-staff-state`）で保持する。登録成功後は利用者名簿の一覧キャッシュを無効化する（LP-030）。
- **バリデーション**: 氏名必須（1〜100 文字）、連絡先必須（メールアドレス書式）、利用者区分は RDRA バリエーションの値のみ。形式チェックはビュー層、業務判断はバックエンド API に委ねる。
- **ローディング**: 送信中の待機表現は `SubmitActionButton` が内包する `LoadingState`（`kind="action"` / `label="利用者を登録中"`）に一本化し、フォーム全体を操作不可にする（arch SR-002 二重送信防止）。画面側で `Skeleton` / `Spinner` を直接使わず、`animate-pulse` 等の独自 loading 表現も持たない。
- **エラーハンドリング**: 状態管理層でエラーを分類（通信 / 認可 / 業務ルール違反 / 競合）し、ビュー層は `Alert(destructive)` に平易な日本語で表示する。409（連絡先重複）は該当 `Input` の下にも `error` を出す。
- **冪等キー**: 画面表示時に UUID を 1 つ発行し、送信・再送で同一キーを `X-Idempotency-Key` に付与する（LR-032）。登録成功後に新しいキーを再発行する。
- **アクセシビリティ**: 各 `Input` に `label` を関連付け、エラーは `role="alert"` で通知する。送信結果は `aria-live="polite"`。

#### 操作フロー

1. 司書がサイドバー「利用者管理」→「利用申込受付」を開く（利用者名簿画面の登録ボタンからも `useAppNavigation().navigate("staff-user-new")` で遷移する）。
2. 画面表示時に冪等キー（UUID）を発行する。
3. 司書が氏名・連絡先を入力し、利用者区分を選択する（既定「一般」）。
4. 「登録する」を押すとビュー層で形式チェックを行う。
5. 状態管理層が送信中にして `POST /api/v1/users` を要求する。
6. 201 応答で採番された利用者番号を `Alert(success)` に表示し、`useAppNavigation().navigate("staff-user-list")` で利用者名簿画面へ進む導線を出す（表示 URL: `/staff/users`）。
7. 失敗時は `Alert(destructive)` に理由を表示し、同一冪等キーで再試行できるようにする。

## コンポーネント設計

### 受け渡し契約（更新系 UC の Props / event 所有権）

`_cross-cutting/ux-ui/common-components.md`「6. コンポーネント間の受け渡し規約」に従う。

- **実行結果の所有者は利用申込受付ページ（ページコンポーネント）**とする。`UserRegisterForm` は結果を state に持たず、入力値とユーザー操作だけを扱う。
- **完了結果の型は API のレスポンススキーマ名 `UserResponse`（`_api-summary.yaml` の `response_schema`）をそのまま使う**。画面側で別名を再定義しない。
- **子は `POST /api/v1/users` を直接呼ばない**。送信の実行主体はページ側であり、子は `onSubmit(input)` で入力値を通知する。
- **子コンポーネントのイベント名は `onUserRegistrationSucceeded`**（`on{ドメイン動詞}{結果}`）に揃える。`onDone` / `onComplete` / `onRegister` のような汎用名は使わない。
- **結果表示（`Alert(success)` の利用者番号提示）は state を持たない表示専用**とし、確定した `UserResponse` を Props で受け取る。`result` が `null` の間は描画しない（「未実行」と「結果 0 件」を区別する）。

| 役割 | コンポーネント | 保持する state | Props / イベント |
|------|--------------|---------------|-----------------|
| 実行結果の所有者 | 利用申込受付ページ | `result: UserResponse \| null` / `submitting: boolean` / `error` | 子へ `submitting` / `onUserRegistrationSucceeded` を渡す |
| 入力・送信トリガ | `UserRegisterForm` | 入力値・項目別エラー・冪等キー | `onSubmit(input)` を親へ通知。結果は保持しない |
| 完了表示 | 採番結果の `Alert(success)` | なし | `result: UserResponse`（確定値）を親から受け取る |

### UserRegisterForm（利用申込受付画面の登録フォーム）

- **ベースコンポーネント**: `Card` + `Input` + `ToggleGroup` + `Button`（UI コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | defaultUserCategory | "一般" \| "学生" \| "団体" | No | 既定値。未指定時は「一般」 |
  | submitting | boolean | Yes | 送信中は全入力と登録ボタンを不活性にする |
  | fieldErrors | Record<string, string> | No | 項目別のエラーメッセージ |
  | onSubmit | (form: { name: string; email: string; userCategory: string }) => void | Yes | 登録要求をページ側へ渡す（API 呼び出しはページが行う） |
  | result | UserResponse \| null | Yes | ページが所有する確定結果。`null` の間は採番結果を描画しない |
  | onUserRegistrationSucceeded | (result: UserResponse) => void | Yes | 登録成功をページへ通知し、次の行動導線（利用者名簿への遷移）を起動する |
- **状態**: `default` / `submitting` / `error`（結果 state は持たない）
- **イベント**: `onChange`（各項目）、`onSubmit`（登録）、`onUserRegistrationSucceeded`（登録成功の通知）、`onCancel`（`useAppNavigation().navigate("staff-user-list")`）

## ティア完了条件（BDD）

```gherkin
Feature: 利用者を登録する - 司書ポータル

  Scenario: 利用者区分の既定値が一般で初期表示される
    Given 司書が司書ポータルにログイン済みである
    When 司書が利用申込受付画面（/staff/users/new）を表示する
    Then ToggleGroup で「一般」が選択されている
    And 登録ボタンが活性である

  Scenario: 必須項目が未入力なら送信されない
    Given 司書が利用申込受付画面を表示している
    When 司書が氏名を空のまま「登録する」を押す
    Then 氏名の Input が error 表示になる
    And POST /api/v1/users が呼ばれない

  Scenario: 送信中は二重送信できない
    Given 司書が氏名「田中太郎」・連絡先「tanaka@example.com」を入力している
    When 司書が「登録する」を 2 回続けて押す
    Then POST /api/v1/users の呼び出しが 1 回だけ発生する
    And 登録ボタンが disabled かつ aria-busy="true" になる

  Scenario: 再送時も同一の冪等キーを使う
    Given 司書が「登録する」を押して通信エラーになっている
    When 司書が「再試行」を押す
    Then 1 回目と同じ X-Idempotency-Key ヘッダーで POST /api/v1/users が呼ばれる

  Scenario: 登録成功で利用者番号を提示する
    Given バックエンド API が user_no「U-000123」で HTTP 201 を返すようスタブされている
    When 司書が有効な入力で「登録する」を押す
    Then Alert(success) に「U-000123」が表示される
    And 利用者名簿画面への導線が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（キャンセル / 登録後の利用者名簿へ） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「送信中の待機表現」（`kind="action"`）。`SubmitActionButton` 経由で間接利用する |
| `EntityFormSection` | `@/components/common/EntityFormSection` | UserRegisterForm の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | UserRegisterForm の登録ボタン（`onSubmit`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `EntityFormSection` | `mode` ← `"create"` / `fields` ← 氏名 / 連絡先（text）、利用者区分（single） / `value` `onChange` ← UserRegisterForm の同名 props / `current` ← — / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `LoadingState` | `kind` ← `"action"`（更新系のボタン押下中） / `label` ← `"利用者を登録中"` |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 本 UC は `AsyncSection` の対象外（新規入力が起点で取得待ちが無い / common-components.md）。取得を伴う領域がある場合は Domain テーブル自身の 4 状態（default / loading / empty / error）で満たす
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
