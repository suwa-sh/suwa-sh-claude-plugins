# 利用者情報を編集する - 司書ポータル仕様

## 変更概要

司書ポータル（`tier-frontend-staff`）に利用者情報変更画面を追加する。現在値を `UserProfileCard` で提示（連絡先は既定マスク）し、氏名・連絡先・利用者区分の編集フォーム、変更差分の保存前確認、冪等キー付きの更新要求を実装する。

## 画面仕様

### 利用者情報変更画面

- **ルート id**: `staff-user-edit`
- **URL**: `/staff/users/:userNumber/edit`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 司書（役割「司書」のトークンを持つ場合のみ表示 / LP-029）
- **ポータル**: `staff`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | サイドバー「利用者管理」を選択状態にする |
| 現在の登録内容 | カード | `UserProfileCard`（`default` / `revealed`） | 連絡先は `maskContact` により既定マスク。明示操作で開示する |
| 氏名 | フォーム | `Input`（`default` / `error`） | 必須。最大 100 文字 |
| 連絡先（メールアドレス） | フォーム | `Input`（`default` / `error`） | 必須。メールアドレス書式 |
| 利用者区分 | フォーム | `ToggleGroup`（`single` / `md`） | 一般 / 学生 / 団体。現在値を初期選択にする |
| 保存ボタン | ボタン | `Button`（`default`） | `SubmitActionButton` 経由。送信中は `disabled` かつ `aria-busy="true"` |
| 現在値の読み込み中 | プレースホルダ | `LoadingState`（`kind="detail"` / `label="利用者情報を読み込み中"`） | 単一エンティティの詳細取得。`AsyncSection` の `skeleton` prop 経由で使う |
| 保存中の待機表現 | プレースホルダ | `LoadingState`（`kind="action"` / `label="利用者情報を保存中"`） | 更新系ボタン押下中の唯一の loading 表現。`SubmitActionButton` が内包する |
| キャンセル | ボタン | `Button`（`outline`） | `useAppNavigation().navigate("staff-user-list")` で利用者名簿画面へ戻る（表示 URL: `/staff/users`） |
| 変更差分の確認 | 確認 | `Modal`（`confirm` / `md`） | 変更した項目だけを変更前後で提示する |
| 業務メッセージ | メッセージ | `Alert`（`success` / `warning` / `destructive`） | 更新結果、競合（409）の再取得案内 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| カード余白 | `var(--card-padding)` | `var(--spacing-6)` |
| 入力枠線 | `var(--input-border)` | `var(--border-strong)` |
| ポータルアクセント | `var(--primary)` | `var(--color-teal-700)`（`#0F766E`） |
| 個人情報マスク背景 | `var(--pii-mask-bg)` | ダークでは `var(--color-gray-800)` |
| モーダル | `var(--modal-bg)` / `var(--modal-shadow)` | `var(--color-white)` / `var(--shadow-lg)` |
| アニメーション | `var(--duration-slow)` | 320ms（Modal 開閉。`prefers-reduced-motion` では無効化） |

#### UIロジック

- **状態管理**: 対象の利用者番号は利用者名簿から引き継ぎ、状態管理層（`L-frontend-staff-state`）で保持する。現在値と入力値を分けて保持し、差分抽出に使う。更新成功後は利用者一覧と当該利用者のキャッシュを無効化する（LP-030）。
- **バリデーション**: 氏名必須（1〜100 文字）、連絡先必須（メールアドレス書式）、利用者区分は RDRA バリエーションの値のみ。業務判断はバックエンド API に委ねる。
- **ローディング**: 現在値の取得中は `AsyncSection` 経由で `LoadingState`（`kind="detail"` / `label="利用者情報を読み込み中"`）を表示する。保存中の待機表現は `SubmitActionButton` が内包する `LoadingState`（`kind="action"` / `label="利用者情報を保存中"`）に一本化する。画面側で `Skeleton` / `Spinner` を直接使わず、`animate-pulse` 等の独自 loading 表現も持たない。
- **エラーハンドリング**: 状態管理層でエラーを分類し（CLP-014）、404 は「対象の利用者が見つかりません」、409 は `Alert(warning)` に「他の司書が更新しました。最新を取得してから保存してください」と再取得導線を出す。
- **段階的開示**: 連絡先は既定でマスクし、司書の明示操作（`revealed`）で開示する（NFR E.1.2.1 / 個人情報参照可否条件）。
- **冪等キー**: 画面表示時に UUID を発行し、保存・再送で同一キーを `X-Idempotency-Key` に付与する（LR-032）。
- **楽観ロック（If-Match）**: 現在値取得（`GET /api/v1/users/{user_no}`）の応答 `updated_at` を版として状態管理層に保持し、`PUT /api/v1/users/{user_no}` の `If-Match` ヘッダーへ必須で送出する（LR-009）。409（版不一致）を受けたら再取得して版を更新してから再送する。
- **アクセシビリティ**: `Modal` はフォーカストラップと Esc クローズを備え、閉じたら起動元へフォーカスを戻す。エラーは `role="alert"`。

#### 操作フロー

1. 司書が利用者名簿画面の行から `useAppNavigation().navigate("staff-user-edit", { userNumber })` で利用者情報変更画面へ遷移する。
2. 状態管理層が `GET /api/v1/users/{userNumber}` で現在値を取得する。
3. `UserProfileCard` に現在値を表示する（連絡先はマスク）。
4. 司書が氏名・連絡先・利用者区分を変更する。
5. 「保存する」を押すと変更差分を `Modal(confirm)` で提示する。
6. 司書が確定すると `PUT /api/v1/users/{userNumber}` を要求する。
7. 200 応答で `Alert(success)` を表示し、`useAppNavigation().navigate("staff-user-list")` で利用者名簿画面へ進む導線を出す（表示 URL: `/staff/users`）。
8. 409 応答では最新値の再取得を促し、再取得後に再編集させる。

## コンポーネント設計

### 受け渡し契約（更新系 UC の Props / event 所有権）

`_cross-cutting/ux-ui/common-components.md`「6. コンポーネント間の受け渡し規約」に従う。

- **実行結果の所有者は利用者情報変更ページ（ページコンポーネント）**とする。`UserEditForm` / `UserProfileCard` は結果を state に持たない。
- **完了結果の型は API のレスポンススキーマ名 `UserResponse`（`_api-summary.yaml` の `PUT /api/v1/users/{user_no}` の `response_schema`）をそのまま使う**。画面側で別名を再定義しない。
- **子は `PUT /api/v1/users/{user_no}` を直接呼ばない**。送信の実行主体はページ側であり、子は `onSubmit(input)` で入力値を通知する。
- **子コンポーネントのイベント名は `onUserUpdateSucceeded`**（`on{ドメイン動詞}{結果}`）に揃える。`onDone` / `onComplete` / `onSave` のような汎用名は使わない。
- **更新結果の表示（`Alert(success)`）は state を持たない表示専用**とし、確定した `UserResponse` を Props で受け取る。`result` が `null` の間は描画しない。

| 役割 | コンポーネント | 保持する state | Props / イベント |
|------|--------------|---------------|-----------------|
| 実行結果の所有者 | 利用者情報変更ページ | `result: UserResponse \| null` / `submitting: boolean` / `error` | 子へ `submitting` / `onUserUpdateSucceeded` を渡す |
| 入力・送信トリガ | `UserEditForm` | 入力値・項目別エラー・冪等キー・版（`If-Match`） | `onSubmit(input)` を親へ通知。結果は保持しない |
| 完了表示 | 更新結果の `Alert(success)` | なし | `result: UserResponse`（確定値）を親から受け取る |

### UserProfileCard（利用者情報変更画面での利用）

- **ベースコンポーネント**: `UserProfileCard`（domain コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | user | UserDetail | Yes | 利用者番号・氏名・連絡先・利用者区分・利用者状態・登録日時 |
  | maskContact | boolean | Yes | 既定 true。明示操作で false（`revealed`）にする |
  | actions | Action[] | No | 編集画面では「連絡先を表示する」トグルのみを渡す |
- **状態**: `default` / `revealed` / `in-transaction`（利用者状態が取引進行中のとき）
- **イベント**: `onToggleMask`（連絡先の開示切替）

### UserEditForm（編集フォーム）

- **ベースコンポーネント**: `Input` + `ToggleGroup` + `Button` + `Modal`（UI コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | current | { name: string; email: string; userCategory: string } | Yes | 取得した現在値。差分抽出の基準 |
  | submitting | boolean | Yes | 保存中は入力と保存ボタンを不活性にする |
  | fieldErrors | Record<string, string> | No | 項目別のエラーメッセージ |
  | onSubmit | (form) => void | Yes | 確認モーダル確定後に更新要求をページ側へ渡す（API 呼び出しはページが行う） |
  | result | UserResponse \| null | Yes | ページが所有する確定結果。`null` の間は更新結果を描画しない |
  | onUserUpdateSucceeded | (result: UserResponse) => void | Yes | 更新成功をページへ通知し、次の行動導線（利用者名簿への遷移）を起動する |
- **状態**: `default` / `confirming` / `submitting` / `error`（結果 state は持たない）
- **イベント**: `onChange`、`onSubmit`、`onUserUpdateSucceeded`（更新成功の通知）、`onCancel`（`useAppNavigation().navigate("staff-user-list")`）

## ティア完了条件（BDD）

```gherkin
Feature: 利用者情報を編集する - 司書ポータル

  Scenario: 現在値がフォームに初期表示される
    Given バックエンド API が利用者「U-000123 / 田中太郎 / 一般」を返すようスタブされている
    When 司書が利用者情報変更画面（/staff/users/U-000123/edit）を表示する
    Then 氏名の Input に「田中太郎」が入っている
    And ToggleGroup で「一般」が選択されている

  Scenario: 連絡先が既定でマスクされる
    Given バックエンド API が連絡先「tanaka@example.com」を返すようスタブされている
    When 司書が利用者情報変更画面を表示する
    Then UserProfileCard の連絡先がマスク表示である
    And 「連絡先を表示する」操作で生の連絡先が表示される

  Scenario: 変更差分だけが確認モーダルに出る
    Given 司書が利用者情報変更画面を表示している
    When 司書が連絡先だけを「taro.tanaka@example.com」に変更して「保存する」を押す
    Then Modal(confirm) に連絡先の変更前後が表示される
    And 氏名の行は表示されない

  Scenario: 保存中は二重送信できない
    Given 司書が確認モーダルを表示している
    When 司書が確定ボタンを 2 回続けて押す
    Then PUT /api/v1/users/U-000123 の呼び出しが 1 回だけ発生する
    And 確定ボタンが disabled かつ aria-busy="true" になる

  Scenario: 競合時に再取得を促す
    Given バックエンド API が HTTP 409 を返すようスタブされている
    When 司書が変更を保存する
    Then Alert(warning) に他の司書による更新の旨が表示される
    And 最新を再取得するボタンが表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（キャンセル / 更新後の利用者名簿へ） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「現在値の読み込み中」（`kind="detail"`）と「保存中の待機表現」（`kind="action"`）。それぞれ `AsyncSection` / `SubmitActionButton` 経由で間接利用する |
| `AsyncSection` | `@/components/common/AsyncSection` | UserProfileCard / UserEditForm の現行値取得 の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `EntityFormSection` | `@/components/common/EntityFormSection` | UserEditForm の内側で使う（`Card` + `Input` + `ToggleGroup` + `Alert` の配置とエラー表示位置） |
| `ConfirmActionModal` | `@/components/common/ConfirmActionModal` | UserEditForm の変更差分モーダル（`Modal(confirm)`） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | UserEditForm の保存ボタン（`onSubmit`） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | UserProfileCard の現行連絡先 |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"detail"`（現在値の取得） / `"action"`（保存中） / `label` ← `"利用者情報を読み込み中"` / `"利用者情報を保存中"` |
| `AsyncSection` | `loading` ← UserProfileCard / UserEditForm の現行値取得 の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"detail"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"利用者情報を読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `EntityFormSection` | `mode` ← `"edit"` / `fields` ← 氏名 / 連絡先（text）、利用者区分（single） / `value` `onChange` ← UserEditForm の同名 props / `current` ← UserEditForm の `current`（変更差分の確認モーダルに使う） / `errors` ← 項目別エラー（`Input(error)`） / `formError` ← 業務エラー（`Alert`、`role="alert"`） / `footer` ← `SubmitActionButton` |
| `ConfirmActionModal` | `open` ← モーダル開閉状態 / `tone` ← `"confirm"` / `title` `confirmLabel` ← 既存モーダルの文言 / `targetLabel` ← 変更対象の利用者と変更項目 / `impact` ← 実行後に起きること（既存の説明文） / `onConfirm` `onCancel` `submitting` ← UserEditForm の変更差分モーダル（`Modal(confirm)`） の同名 props |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← true / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
