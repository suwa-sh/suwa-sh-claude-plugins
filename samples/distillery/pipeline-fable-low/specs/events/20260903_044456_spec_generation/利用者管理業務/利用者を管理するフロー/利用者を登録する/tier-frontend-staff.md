# 利用者を登録する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルに利用者登録画面（/staff/users/new）を追加する。UserForm（create）で氏名・連絡先を入力し、POST /api/v1/users を呼び出す。
登録完了後は採番された利用者番号を表示し（Registered）、利用者一覧画面へ戻る導線を提供する。

## 画面仕様

### 利用者登録画面

- **URL**: `/staff/users/new`
- **アクセス権**: 司書（認証 + 利用者区分=司書。館内経路のみ）
- **ポータル**: staff（司書ポータル）

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル枠 | レイアウト | PortalShell | 司書ポータルのヘッダ・ナビ（利用者管理配下） |
| 利用者登録フォーム | フォーム | UserForm（mode=create） | 氏名 / メールアドレス / 電話番号 / 住所。利用者番号欄は表示しない（登録後にシステム採番） |
| 氏名 | 入力 | Input（default / error） | 必須 |
| メールアドレス | 入力 | Input（default / error） | 必須。形式検証 |
| 電話番号 | 入力 | Input | 任意 |
| 住所 | 入力 | Input | 任意 |
| 登録ボタン | ボタン | Button（default, md） | submitting 中は disabled + Spinner |
| 戻るボタン | ボタン | Button（ghost） | 利用者一覧画面へ戻る |
| 検証エラー | 通知 | Alert（destructive）+ UserForm errors | フィールド単位のインラインエラーと画面上部のまとめ表示 |
| 登録完了 | 通知 | Alert（success） | 「利用者番号 U0001234 で登録しました」を表示（Registered variant） |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | var(--color-white) |
| フォーム見出し背景 | var(--background-subtle) | var(--color-gray-50) |
| アクセント | var(--primary) | staff=var(--color-slate-700)（#334155） |
| ボタン文字色 | var(--primary-foreground) | var(--color-white) |

#### UIロジック

- **状態管理**: 画面内状態（UserFormState: name, email, phone, address, errors, submitting, registered{userNumber}）を view 層のメモリに保持する。永続化しない（LR-025）
- **バリデーション**: 氏名必須（1〜100 文字）、メールアドレス必須 + 形式、電話番号・住所は任意。クライアント検証は補助であり、API の 422 応答（errors[].field）を UserForm errors にマッピングして表示する
- **ローディング**: 送信中は submitting=true でボタンを disabled + Spinner、画面遷移をブロックする
- **エラーハンドリング**: 422 → フィールドエラー表示、401 → IdP 再認証へ誘導、403 → 「この操作の権限がありません」Alert、5xx / ネットワーク → 「登録できませんでした。再試行してください」Alert（入力値は保持）

#### 操作フロー

1. 利用者一覧画面の「新規登録」ボタンから利用者登録画面へ遷移する
2. 氏名・メールアドレス（必須）、電話番号・住所（任意）を入力する
3. 「登録」を押す。インライン検証を通過したら POST /api/v1/users を送信する（api client が `Idempotency-Key` を生成して付与し、再試行では同一キーを再送する）
4. 201 応答で Registered 表示（利用者番号 + Alert success）に切り替える
5. 「一覧へ戻る」で利用者一覧画面（/staff/users）に戻る。履歴は replace し、戻る操作で再送しない（SR-005）

## コンポーネント設計

### UserRegisterPage

- **ベースコンポーネント**: PortalShell + UserForm（create）+ Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | （なし。ルートコンポーネント） | - | - | - |
- **状態**: UserFormState（name, email, phone, address, errors, submitting）, registered（{userNumber, name} | null）
- **イベント**: onSubmit（createUser 呼出）, onBack（一覧へ遷移）

### UserForm（既存ドメインコンポーネントの利用）

- **ベースコンポーネント**: UserForm（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initial | {name,email,phone,address} | No | create では空 |
  | mode | "create" | Yes | 登録モード |
  | onSubmit | (values) => void | Yes | 検証済み入力値を親へ通知 |
  | submitting | boolean | Yes | 送信中フラグ |
  | errors | Record<field,string> | No | フィールドエラー |
- **状態**: 入力値・タッチ済みフィールド
- **イベント**: onChange, onSubmit

## ティア完了条件（BDD）

```gherkin
Feature: 利用者を登録する - 司書向けフロントエンド

  Scenario: 登録フォームを送信して利用者番号を表示する
    Given 司書がログイン済みで利用者登録画面（/staff/users/new）を表示している
    And API モックが POST /api/v1/users に対し 201 {userNumber:"U0001234", name:"田中太郎"} を返す
    When 氏名「田中太郎」、メールアドレス「tanaka@example.com」を入力して「登録」を押す
    Then Alert（success）に「利用者番号 U0001234 で登録しました」が表示される
    And 「一覧へ戻る」ボタンが表示される

  Scenario: 必須項目未入力でインラインエラーを表示する
    Given 司書が利用者登録画面を表示している
    When 氏名を空のまま「登録」を押す
    Then 氏名欄が error 表示になり「氏名は必須です」が表示される
    And API は呼び出されない

  Scenario: 送信中はボタンを無効化する
    Given 司書が利用者登録画面で氏名「田中太郎」、メールアドレス「tanaka@example.com」を入力している
    And API モックが応答を 2 秒遅延させる
    When 「登録」を押す
    Then 「登録」ボタンが disabled になり Spinner が表示される

  Scenario: API の 422 をフィールドエラーに反映する
    Given 司書が利用者登録画面で氏名「田中太郎」、メールアドレス「tanaka@@example」を入力している
    And API モックが 422 problem+json {code:"VALIDATION_ERROR", errors:[{field:"email", message:"メールアドレスの形式が不正です"}]} を返す
    When 「登録」を押す
    Then メールアドレス欄に「メールアドレスの形式が不正です」が表示される
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称 S-利用者登録）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|--------------|-----------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'users'、activeItem = 'userList' |
| EntityFormPage | `@/components/common/EntityFormPage` | mode = 'create'、title = 「利用者を登録」、submitError = state.submitError（422 → fieldErrors）、submitting = state.submitting、onCancel = onBack、children = ({ fieldErrors }) => UserForm（create, errors = fieldErrors）。登録完了（Registered）は `children` 外の notices に Alert（success）「利用者番号 {userNumber} で登録しました」を出す（正本 EntityFormPage 振る舞い） |
| PageHeader | `@/components/common/PageHeader` | EntityFormPage 内部で利用（notices = Registered の Alert） |
| ErrorAlert | `@/components/common/ErrorAlert` | EntityFormPage 内部で利用。audience = 'staff'（403 → 「この操作の権限がありません」） |
| SubmitButton | `@/components/common/SubmitButton` | label = 「登録」、submitting = state.submitting |
| BackLink | `@/components/common/BackLink` | label = 「一覧へ戻る」、to = '/staff/users'、replace = true（Registered 表示後） |
| NoticeAlert（発行） | `@/components/common/NoticeAlert` | 表示は利用者一覧側。「一覧へ戻る」押下時に `notice=created` を発行する |

使用する共通 hooks:

| hook | 用途 |
|------|------|
| useNoticeNavigation | 「一覧へ戻る」で `/staff/users` + `notice=created` を組み立てて replace 遷移（戻る操作で再送しない） |
