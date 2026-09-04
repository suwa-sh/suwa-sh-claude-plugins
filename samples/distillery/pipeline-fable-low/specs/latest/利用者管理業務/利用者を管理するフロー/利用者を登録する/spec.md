# 利用者を登録する

## 概要

司書が利用者登録画面で氏名・連絡先（メールアドレス・電話番号・住所）を入力して利用者を登録する。
システムは一意の利用者番号を採番し、登録完了画面で司書に提示する。登録した利用者は貸出・予約の主体となり、通知の送信先となる。

## データフロー

```mermaid
graph LR
  subgraph FE["tier-frontend-staff"]
    FE_View["view\n利用者登録画面 / UserForm"]
    FE_State["view（画面内状態）\nUserFormState{name,email,phone,address,errors,submitting}"]
    FE_API["api-client\nPOST /api/v1/users"]
    FE_View --> FE_State --> FE_API
  end
  subgraph BE["tier-backend-api"]
    BE_Pres["presentation\nCreateUserRequest"]
    BE_UC["usecase\nRegisterUserCommand"]
    BE_Domain["domain\n利用者（User）\nuser_number, user_type=利用者"]
    BE_Repo["repository\nUserRepository.save"]
    BE_GW["gateway\nUserSnapshotAdapter / UserEventAdapter"]
    BE_Pres --> BE_UC --> BE_Domain
    BE_UC --> BE_Repo --> BE_GW
  end
  subgraph DB["RDB"]
    DB_Users[("users\nuser_number, name, email, phone, address, user_type, version")]
    DB_Events[("user_events\nevent_type=REGISTERED, occurred_at")]
  end
  FE_API -->|"POST /api/v1/users {name,email,phone,address}"| BE_Pres
  BE_GW -->|"INSERT users / INSERT user_events"| DB_Users
  BE_GW --> DB_Events
  DB_Users --> BE_GW --> BE_Repo --> BE_UC --> BE_Pres -->|"HTTP 201 {userNumber,name,email,phone,address,userType,registeredAt}"| FE_API --> FE_State --> FE_View
```

| レイヤー | データモデル | 変換内容 |
|---------|------------|---------|
| FE view | UserForm 入力値（氏名・メールアドレス・電話番号・住所） | 入力 → UserFormState。インライン検証（必須・メール形式）→ CreateUserRequest 相当の JSON |
| FE api-client | POST /api/v1/users リクエスト | trace_id と Idempotency-Key を付与。HTTP エラーを統一エラー型（422 検証 / 401 再認証 / 403 権限）に正規化 |
| BE presentation | CreateUserRequest(name, email, phone?, address?) | スキーマ検証（型・形式・必須）+ 認可コンテキスト（司書）抽出 → RegisterUserCommand |
| BE usecase | RegisterUserCommand | トランザクション開始。利用者番号採番 → User 生成 → UserRepository.save → コミット |
| BE domain | User（user_number, name, email, phone, address, user_type=利用者） | 不変条件「利用者番号は一意」を集約 root で保証 |
| BE gateway | INSERT users（snapshot）/ INSERT user_events（登録イベント） | Event/Snapshot 併用パターン（LR-008） |
| Response | UserResponse(userNumber, name, email, phone, address, userType, registeredAt) | 登録完了メッセージと利用者番号の表示（Registered variant） |

## 処理フロー

```mermaid
sequenceDiagram
  actor Staff as 司書

  box rgb(230,240,255) tier-frontend-staff
    participant View as view（利用者登録画面）
    participant APIClient as api-client
  end

  box rgb(240,255,240) tier-backend-api
    participant Pres as presentation
    participant UC as usecase
    participant Domain as domain
    participant Repo as repository
    participant GW as gateway
  end

  participant DB as RDB

  Staff->>View: 氏名・メールアドレス・電話番号・住所を入力し「登録」を押す
  View->>View: インライン検証（氏名必須・メールアドレス必須/形式）
  alt 入力エラーあり
    View-->>Staff: UserForm errors を表示（ValidationError）。送信しない
  else 入力エラーなし
    View->>View: submitting=true（ボタン無効化）
    View->>APIClient: createUser({name,email,phone,address})
    APIClient->>Pres: POST /api/v1/users（trace_id 付与）
    Pres->>Pres: スキーマ検証（型・形式・必須）
    Pres->>Pres: 認可コンテキスト抽出（user_id, 利用者区分=司書）
    Pres->>UC: RegisterUserCommand
    UC->>Repo: nextUserNumber()
    Repo->>GW: 採番
    GW->>DB: 採番（シーケンス）
    DB-->>GW: 利用者番号
    GW-->>Repo: 利用者番号
    Repo-->>UC: 利用者番号
    UC->>Domain: User.register(userNumber, name, email, phone, address, userType=利用者)
    Domain-->>UC: User
    UC->>Repo: save(User)
    Repo->>GW: insert snapshot / insert event
    GW->>DB: INSERT users, INSERT user_events(登録)
    DB-->>GW: OK
    GW-->>Repo: OK
    Repo-->>UC: User
    UC->>UC: コミット。監査ログ（操作種別=利用者登録, 対象=利用者番号）
    UC-->>Pres: User
    Pres-->>APIClient: HTTP 201 UserResponse
    APIClient-->>View: 登録結果
    View-->>Staff: Registered（利用者番号を表示。Alert success）
  end
```

## バリエーション一覧

| バリエーション名 | 値 | 処理内容 | 適用 tier | 適用箇所 |
|----------------|---|---------|----------|---------|
| 利用者区分 | 司書、利用者 | 司書が登録する利用者の区分は既定で「利用者」。司書区分の付与は本 UC の登録画面では扱わない（userType 省略時は「利用者」） | tier-backend-api | RegisterUserCommand |

## 分岐条件一覧

| 条件名 | 判定ルール | 適用 tier | 適用箇所 | BDD Scenario |
|--------|----------|----------|---------|-------------|
| 入力検証（LP-001） | 氏名・メールアドレスは必須。メールアドレスは RFC 5322 形式。電話番号・住所は任意 | tier-frontend-staff / tier-backend-api | UserForm / POST /api/v1/users | 必須項目が未入力のため登録できない |
| 利用者番号の一意性（AG-002 不変条件） | 採番した利用者番号が既存と重複しない。重複時は採番をやり直す | tier-backend-api | UserRepository.nextUserNumber | 利用者を登録して利用者番号が採番される |

## 計算ルール一覧

| 計算名 | 入力情報 | 計算式/ロジック | 出力情報 | 適用 tier |
|--------|---------|---------------|---------|----------|
| 利用者番号採番 | 既存の利用者番号 | RDB シーケンスによる連番採番（形式は実装で確定。例: `U0001234`） | 利用者.利用者番号 | tier-backend-api |

## 状態遷移一覧

| 状態モデル | 遷移元 | 遷移先 | トリガー | 事前条件 | 事後処理 | 適用 tier |
|-----------|--------|--------|---------|---------|---------|----------|
| （なし） | - | - | 利用者は状態モデルを持たない（情報.tsv「利用者」状態モデル空） | - | - | - |

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 |
|-----------|--------|------|
| 業務 | 利用者管理業務 | このUCが属する業務 |
| BUC | 利用者を管理するフロー | このUCを含むBUC |
| アクター | 司書 | 操作するアクター |
| 情報 | 利用者 | 登録する情報（利用者番号・氏名・連絡先・利用者区分・登録日） |
| 画面 | 利用者登録画面 | 操作する画面 |
| バリエーション | 利用者区分 | 登録時に付与する区分 |

## E2E 完了条件（BDD）

### 正常系

```gherkin
Feature: 利用者を登録する

  Scenario: 利用者を登録して利用者番号が採番される
    Given 司書「佐藤花子」が司書ポータルにログイン済み
    And 利用者登録画面（/staff/users/new）を表示している
    When 氏名「田中太郎」、メールアドレス「tanaka@example.com」、電話番号「090-1234-5678」、住所「東京都千代田区1-1」を入力して「登録」を押す
    Then HTTP 201 が返り、利用者番号（例「U0001234」）が画面に表示される
    And 利用者一覧画面で「田中太郎」が利用者番号つきで表示される

  Scenario: 電話番号と住所を省略して登録する
    Given 司書「佐藤花子」が利用者登録画面を表示している
    When 氏名「鈴木一郎」、メールアドレス「suzuki@example.com」のみ入力して「登録」を押す
    Then HTTP 201 が返り、利用者番号が表示される
```

### 異常系

```gherkin
  Scenario: 必須項目が未入力のため登録できない
    Given 司書「佐藤花子」が利用者登録画面を表示している
    When 氏名を空のまま、メールアドレス「tanaka@example.com」を入力して「登録」を押す
    Then 氏名欄に「氏名は必須です」が表示され、API は呼び出されない

  Scenario: メールアドレス形式が不正なため API が 422 を返す
    Given 司書「佐藤花子」が利用者登録画面を表示している
    When 氏名「田中太郎」、メールアドレス「tanaka@@example」を入力して「登録」を押す
    Then HTTP 422 application/problem+json（code=VALIDATION_ERROR, errors[0].field=email）が返り、メールアドレス欄にエラーが表示される

  Scenario: 利用者区分が利用者のアカウントは登録 API を呼べない
    Given 利用者「田中太郎」のアクセストークンを持つクライアントがある
    When POST /api/v1/users を氏名「山田」メールアドレス「yamada@example.com」で呼び出す
    Then HTTP 403 application/problem+json（code=FORBIDDEN）が返る
```

## ティア別仕様

- [司書向けフロントエンド](tier-frontend-staff.md)
- [Backend API](tier-backend-api.md)

### 統合 API Spec

- [OpenAPI Spec](../../../_cross-cutting/api/openapi.yaml)（全 UC 統合、Contract First 開発用）
