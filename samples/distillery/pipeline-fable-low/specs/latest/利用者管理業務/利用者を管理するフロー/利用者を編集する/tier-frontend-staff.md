# 利用者を編集する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルに利用者編集画面（/staff/users/:userId/edit）を追加する。初期表示で GET /api/v1/users/{userNumber} を呼び、UserForm（edit）に反映する。
保存時は PUT /api/v1/users/{userNumber} に version を同梱し、409 競合・404 不在をそれぞれの文言で表示する。

## 画面仕様

### 利用者編集画面

- **URL**: `/staff/users/:userId/edit`（`:userId` = 利用者番号）
- **アクセス権**: 司書（認証 + 利用者区分=司書。館内経路のみ）
- **ポータル**: staff（司書ポータル）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル枠 | レイアウト | PortalShell | 司書ポータル |
| 利用者番号 | テキスト | Input（disabled） | 変更不可 |
| 利用者区分 | テキスト | Badge | 表示のみ。userType を PATRON→「利用者」/ STAFF→「司書」に変換して表示 |
| 利用者編集フォーム | フォーム | UserForm（mode=edit） | 氏名 / メールアドレス / 電話番号 / 住所 |
| 連絡先の現在値 | テキスト | PiiMaskedText（email / phone / address, revealable） | 既定マスク。編集開始（目のアイコン）で開示して Input を有効化 |
| 保存ボタン | ボタン | Button（default） | submitting 中は disabled + Spinner |
| 戻るボタン | ボタン | Button（ghost） | 変更を破棄して一覧へ戻る |
| 読み込み中 | プレースホルダ | Skeleton（line） | GET 応答待ち |
| エラー | 通知 | Alert（destructive / warning） | 404 / 409 / 5xx |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white) |
| マスク背景 | var(--pii-masked-bg) | var(--background-muted) = var(--color-gray-100) |
| アクセント | var(--primary) | staff=var(--color-slate-700)（#334155） |

#### UIロジック

- **状態管理**: UserEditState（user: UserResponse | null, version, form{name,email,phone,address}, errors, submitting, loadError）を画面内メモリに保持。画面遷移で破棄し永続化しない（LR-025）
- **バリデーション**: 登録画面と同じ（氏名必須 1〜100 文字、メールアドレス必須 + 形式、電話番号・住所任意）。API の 422 errors[].field をフィールドエラーへ反映
- **ローディング**: 初期表示は Skeleton（line ×4）。保存中は submitting=true でボタン disabled + Spinner
- **エラーハンドリング**: 404 → 「利用者が見つかりません」+ 一覧へ戻るボタン。409（OPTIMISTIC_LOCK_CONFLICT）→ warning Alert「他の司書が更新しました。再読み込みしてください」+ 再読み込みボタン（GET を再実行し form を再設定）。401 → 再認証。403 → 権限エラー Alert

#### 操作フロー

1. 利用者一覧画面の行内「編集」から遷移する（戻り先の検索条件・ページ番号はクエリで保持）
2. GET /api/v1/users/{userNumber} の応答で UserForm(edit) を初期化する。連絡先は PiiMaskedText で表示
3. 修正するフィールドの開示アイコンを押して編集する
4. 「保存」を押す。インライン検証を通過したら PUT /api/v1/users/{userNumber} を送信する（version 同梱。api client が `Idempotency-Key` を生成して付与し、再試行では同一キーを再送する）
5. 200 応答で Alert（success）を表示し、元の利用者一覧画面へ戻る（履歴は replace）

## コンポーネント設計

### UserEditPage

- **ベースコンポーネント**: PortalShell + UserForm（edit）+ PiiMaskedText + Alert + Skeleton
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | userNumber | string | Yes | ルートパラメータ `:userId` |
- **状態**: UserEditState（上記）
- **イベント**: onLoad（getUser）, onSubmit（updateUser）, onReload（競合時の再取得）, onBack

### UserForm（既存ドメインコンポーネントの利用）

- **ベースコンポーネント**: UserForm（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initial | {name,email,phone,address} | Yes | GET 応答の現在値 |
  | mode | "edit" | Yes | 編集モード（利用者番号を disabled 表示） |
  | onSubmit | (values) => void | Yes | 検証済み入力値 |
  | submitting | boolean | Yes | 送信中 |
  | errors | Record<field,string> | No | フィールドエラー |
- **状態**: 入力値・ダーティフラグ
- **イベント**: onChange, onSubmit

### PiiMaskedText（既存ドメインコンポーネントの利用）

- **ベースコンポーネント**: PiiMaskedText
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | value | string | Yes | 現在値 |
  | kind | "email" \| "phone" \| "address" | Yes | マスク方式 |
  | revealable | boolean | Yes | true（編集のため開示可） |
- **状態**: revealed
- **イベント**: onReveal（開示時に対応 Input を編集可能にする）

## ティア完了条件（BDD）

```gherkin
Feature: 利用者を編集する - 司書向けフロントエンド

  Scenario: 現在値を初期表示して保存する
    Given 司書がログイン済みで API モックが GET /api/v1/users/U0001234 に 200 {userNumber:"U0001234", name:"田中太郎", email:"tanaka@example.com", phone:"090-1234-5678", address:"東京都千代田区1-1", userType:"PATRON", version:1} を返す
    And API モックが PUT /api/v1/users/U0001234 に 200（version:2）を返す
    When 利用者編集画面（/staff/users/U0001234/edit）を開き、メールアドレスを開示して「tanaka.taro@example.com」に変更し「保存」を押す
    Then PUT のリクエストボディに version:1 と email:"tanaka.taro@example.com" が含まれる
    And Alert（success）「保存しました」が表示され利用者一覧画面へ遷移する

  Scenario: 連絡先は既定でマスク表示される
    Given 司書がログイン済みで API モックが利用者「U0001234」を返す
    When 利用者編集画面を開く
    Then メールアドレスは「t***@example.com」のようにマスクされ、目のアイコンで開示できる

  Scenario: 409 競合時に再読み込み導線を表示する
    Given 司書が利用者「U0001234」の編集画面を開いている
    And API モックが PUT /api/v1/users/U0001234 に 409 problem+json {code:"OPTIMISTIC_LOCK_CONFLICT"} を返す
    When 氏名を「田中太朗」に変更して「保存」を押す
    Then Alert（warning）「他の司書が更新しました。再読み込みしてください」と「再読み込み」ボタンが表示される

  Scenario: 存在しない利用者は不在メッセージを表示する
    Given 司書がログイン済みで API モックが GET /api/v1/users/U9999999 に 404 problem+json {code:"USER_NOT_FOUND"} を返す
    When 利用者編集画面（/staff/users/U9999999/edit）を開く
    Then 「利用者が見つかりません」と「一覧へ戻る」ボタンが表示され、フォームは表示されない
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-利用者編集）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'users'、activeItem = 'userList' |
| EntityFormPage | `@/components/common/EntityFormPage` | mode = 'edit'、title = 「利用者を編集」（subtitle = userNumber）、status = Badge（利用者区分）、loading = 初期 GET 中、loadError = state.loadError（404 → EmptyState with-action「一覧へ戻る」）、submitError = state.errors 由来（422 → fieldErrors、409 OPTIMISTIC_LOCK_CONFLICT → 競合 Alert + 再読み込み）、submitting = state.submitting、onReload = onReload、onCancel = onBack、children = ({ fieldErrors }) => UserForm（edit, errors = fieldErrors）+ PiiMaskedText |
| PageHeader | `@/components/common/PageHeader` | EntityFormPage 内部で利用 |
| AsyncStateView | `@/components/common/AsyncStateView` | EntityFormPage 内部で利用（skeleton = { variant: 'line', count: 4 }） |
| ErrorAlert | `@/components/common/ErrorAlert` | EntityFormPage 内部で利用。audience = 'staff'（conflict → warning + onReload） |
| SubmitButton | `@/components/common/SubmitButton` | label = 「保存」、submitting = state.submitting |
| BackLink | `@/components/common/BackLink` | label = 「一覧へ戻る」、to = '/staff/users'、returnQuery = 一覧から引き継いだ q / page |
| NoticeAlert（発行） | `@/components/common/NoticeAlert` | 表示は利用者一覧側。本 UC は `notice=updated` を発行する |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useNoticeNavigation | 200 応答後に `/staff/users` + returnQuery + `notice=updated` を組み立てて replace 遷移 |
| usePiiReveal | 連絡先（email / phone / address）の開示状態。開示時に対応 Input を編集可能にする。画面内のみ保持 |
