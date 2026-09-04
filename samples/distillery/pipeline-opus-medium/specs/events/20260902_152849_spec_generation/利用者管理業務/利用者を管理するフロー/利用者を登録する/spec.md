# 利用者を登録する

## 概要

司書が利用申込を受け付け、氏名・連絡先・利用者区分を登録して利用者番号を採番し、利用者を一意に識別できるようにする。登録された利用者は利用者状態「登録済み」で開始し、以降の貸出・予約の対象となる。

## データフロー

```mermaid
graph LR
  subgraph FE["tier-frontend-staff"]
    FE_View["ビュー層\n利用申込受付画面 / 登録フォーム"]
    FE_State["状態管理層\nUserRegisterState(入力値・送信中・冪等キー)"]
    FE_API["API クライアント層\nPOST /api/v1/users"]
    FE_View --> FE_State --> FE_API
  end
  subgraph BE["tier-backend-api"]
    BE_Pres["プレゼンテーション層\nCreateUserRequest"]
    BE_UC["ユースケース層\nRegisterUserCommand"]
    BE_Domain["domain\nUser(集約ルート / AG-002)\n利用者状態: 登録済み"]
    BE_Repo["リポジトリ層\nUserRepository.save"]
    BE_GW["ゲートウェイ層\nUserAdapter / UserRecord"]
    BE_Pres --> BE_UC --> BE_Domain
    BE_UC --> BE_Repo --> BE_GW
  end
  subgraph KVS["KVS"]
    KVS_Idem[("idem:api:createUser:{key}\n処理結果")]
  end
  subgraph DB["RDB"]
    DB_Events[("user_events\n利用者登録イベント / occurred_at")]
    DB_Users[("users\n利用者番号 / 氏名 / 連絡先 / 利用者区分 / 利用者状態=登録済み")]
  end
  FE_API -->|"POST /api/v1/users {name,email,user_category} + X-Idempotency-Key"| BE_Pres
  BE_UC --> KVS_Idem
  BE_GW -->|"INSERT user_events"| DB_Events
  BE_GW -->|"INSERT users（スナップショット射影）"| DB_Users
  DB_Users --> BE_GW --> BE_Repo --> BE_UC --> BE_Pres -->|"HTTP 201 UserResponse"| FE_API --> FE_State --> FE_View
```

| レイヤー | データモデル | 変換内容 |
|---------|------------|---------|
| FE ビュー層 | 利用申込受付画面（氏名・連絡先・利用者区分） | 司書の入力 → フォーム状態。利用者区分の既定値は「一般」 |
| FE 状態管理層 | UserRegisterState(form, submitting, idempotencyKey) | 送信時に冪等キー（UUID）を発行し、再送時も同一キーを使う（LR-032） |
| BE presentation | CreateUserRequest(name, email, user_category) | 必須・桁・メールアドレス書式・利用者区分の許容値を検証し Command へ変換 |
| BE usecase | RegisterUserCommand | 冪等キーを KVS で検証（LP-007）。トランザクション境界を張り、利用者登録イベントとスナップショットを確定する |
| BE domain | User（AG-002 集約ルート） | 利用者番号を採番し、利用者状態を「登録済み」で初期化する |
| BE gateway | INSERT user_events / INSERT users | イベントを追記し、スナップショットへ射影する（registered_at = イベントの occurred_at） |
| Response | UserResponse(user_no, name, email_masked, user_category, user_status, registered_at) | 採番された利用者番号を司書へ提示する |

## 処理フロー

```mermaid
sequenceDiagram
  actor Staff as 司書

  box rgb(230,240,255) tier-frontend-staff
    participant View as ビュー層
    participant State as 状態管理層
    participant APIClient as API クライアント層
  end

  box rgb(240,255,240) tier-backend-api
    participant Pres as プレゼンテーション層
    participant UC as ユースケース層
    participant Domain as domain
    participant Repo as リポジトリ層
    participant GW as ゲートウェイ層
  end

  participant KVS as KVS
  participant DB as RDB

  Staff->>View: 氏名・連絡先・利用者区分を入力して「登録する」を押す
  View->>View: 形式チェック（必須・メールアドレス書式）
  View->>State: 登録要求（送信中にして二重送信を禁止）
  State->>APIClient: POST /api/v1/users
  APIClient->>Pres: POST /api/v1/users + X-Idempotency-Key
  Pres->>Pres: 入力バリデーション（利用者区分の許容値: 一般/学生/団体）
  Pres->>Pres: 認証コンテキストを確立する（役割=司書）
  alt 役割が司書でない
    Pres-->>APIClient: HTTP 403 FORBIDDEN
  else 役割が司書
    Pres->>UC: RegisterUserCommand(name, email, userCategory, idempotencyKey)
    UC->>KVS: 冪等キーを検証する
    alt 既処理の冪等キー
      KVS-->>UC: 前回の処理結果
      UC-->>Pres: 前回と同一の UserDto
      Pres-->>APIClient: HTTP 201 UserResponse（前回結果の再送）
    else 未処理
      UC->>Repo: 連絡先の重複確認
      Repo->>GW: UserAdapter.findByEmail(email)
      GW->>DB: SELECT users WHERE email = ?
      DB-->>GW: 該当行（0 件 / 1 件）
      GW-->>Repo: UserRecord?
      Repo-->>UC: 既存利用者の有無
      alt 連絡先が既存利用者と重複
        UC->>Domain: ドメイン例外（連絡先重複）
        Domain-->>UC: 連絡先重複
        UC-->>Pres: 409 CONFLICT
        Pres-->>APIClient: HTTP 409 CONFLICT
      else 重複なし
        UC->>Domain: User.register(name, email, userCategory)
        Domain->>Domain: 利用者番号を採番し、利用者状態を「登録済み」に初期化する
        UC->>Repo: UserRepository.save(User)
        Repo->>GW: UserAdapter.insert(UserRecord)
        GW->>DB: INSERT user_events / INSERT users
        alt users(email) の一意制約違反
          DB-->>GW: 一意制約違反
          GW-->>Repo: 連絡先重複エラーへ写像
          Repo-->>UC: 連絡先重複
          UC-->>Pres: 409 CONFLICT
          Pres-->>APIClient: HTTP 409 CONFLICT
        else 登録成功
          DB-->>GW: 採番結果
          GW-->>Repo: UserRecord
          Repo-->>UC: User
          UC->>KVS: 処理結果を冪等キーで保存する
          UC->>UC: 監査ログ（誰が・いつ・利用者 U-000123 を登録したか）
          UC-->>Pres: UserDto
          Pres-->>APIClient: HTTP 201 UserResponse
        end
      end
    end
  end
  APIClient-->>State: 採番された利用者番号
  State-->>View: 送信中を解除し、利用者一覧のキャッシュを無効化する
  View-->>Staff: Alert(success)「利用者番号 U-000123 を採番しました」
```

## バリエーション一覧

| バリエーション名 | 値 | 処理内容 | 適用 tier | 適用箇所 |
|----------------|---|---------|----------|---------|
| 利用者区分 | 一般 / 学生 / 団体 | ToggleGroup での単一選択。既定値は「一般」（デフォルト効果） | tier-frontend-staff | 利用申込受付画面の入力フォーム |
| 利用者区分 | 一般 / 学生 / 団体 | 許容値チェックと `users.user_category` への保存。以降の返却期限設定条件の適用単位となる | tier-backend-api | POST /api/v1/users |

## 分岐条件一覧

| 条件名 | 判定ルール | 適用 tier | 適用箇所 | BDD Scenario |
|--------|----------|----------|---------|-------------|
| 個人情報参照可否条件 | 登録 API は司書ロールのみ到達可。レスポンスの連絡先はマスク値を返す | tier-backend-api | POST /api/v1/users | 利用者ロールでは利用者を登録できない |
| 重複登録の抑止（冪等キー検証 / LP-007） | 同一の冪等キーで再送された場合は新規採番せず前回結果を返す | tier-backend-api | POST /api/v1/users | 同一冪等キーの再送で二重登録されない |

## 計算ルール一覧

| 計算名 | 入力情報 | 計算式/ロジック | 出力情報 | 適用 tier |
|--------|---------|---------------|---------|----------|
| 利用者番号の採番 | 利用者（登録要求） | 連番方式で一意な利用者番号を採番する（例 `U-` + 6 桁ゼロ埋め連番） | user_no | tier-backend-api |
| 登録日時の射影 | 利用者登録イベント | registered_at = 利用者登録イベントの occurred_at | users.registered_at | tier-backend-api |

## 状態遷移一覧

| 状態モデル | 遷移元 | 遷移先 | トリガー | 事前条件 | 事後処理 | 適用 tier |
|-----------|--------|--------|---------|---------|---------|----------|
| 利用者状態 | （初期） | 登録済み | 利用者を登録する | 司書としてログイン済みで、氏名・連絡先・利用者区分が入力されている | 利用者番号を採番し、貸出・予約の対象とする | tier-backend-api |

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 |
|-----------|--------|------|
| 業務 | 利用者管理業務 | このUCが属する業務 |
| BUC | 利用者を管理するフロー | このUCを含むBUC |
| アクティビティ | 利用申込を受け付けて登録する | このUCが実現するアクティビティ |
| アクター | 司書 | 操作するアクター（立場: 提供者） |
| 情報 | 利用者 | 登録する情報 |
| 状態 | 利用者状態 | 登録済みで開始する |
| 条件 | 個人情報参照可否条件 | 連絡先の取り扱いの根拠 |
| バリエーション | 利用者区分 | 登録時に選択する区分 |
| 画面 | 利用申込受付画面 | このUCの画面 |

## E2E 完了条件（BDD）

### 正常系

```gherkin
Feature: 利用者を登録する

  Scenario: 利用申込を受け付けて利用者番号を採番する
    Given 司書「山田花子」が司書ポータルにログイン済みである
    And 司書が利用申込受付画面（/staff/users/new）を開いている
    When 司書が氏名「田中太郎」・連絡先「tanaka@example.com」・利用者区分「一般」を入力して登録する
    Then 利用者番号「U-000123」が採番される
    And 利用者状態が「登録済み」になる
    And Alert(success) に採番された利用者番号が表示される

  Scenario: 利用者区分の既定値が一般である
    Given 司書「山田花子」が利用申込受付画面を開いている
    When 司書が画面の初期表示を確認する
    Then 利用者区分の ToggleGroup で「一般」が選択されている

  Scenario: 登録した利用者が名簿に現れる
    Given 司書「山田花子」が利用者「田中太郎」を登録済みである
    When 司書が利用者名簿画面（/staff/users）を開く
    Then 一覧に利用者番号「U-000123」と氏名「田中太郎」が表示される
    And 利用者状態バッジに「登録済み」が表示される
```

### 異常系

```gherkin
  Scenario: 必須項目が未入力のとき登録できない
    Given 司書「山田花子」が利用申込受付画面を開いている
    When 司書が氏名を空のまま「登録する」を押す
    Then Input(error) に「氏名を入力してください」と表示される
    And POST /api/v1/users は呼ばれない

  Scenario: 連絡先の書式が不正なとき 400 になる
    Given 司書ロールのトークンを保持している
    When POST /api/v1/users に連絡先「tanaka_at_example」を指定して実行する
    Then HTTP 400 が返る
    And code が「VALIDATION_ERROR」である

  Scenario: 許容外の利用者区分を指定すると 400 になる
    Given 司書ロールのトークンを保持している
    When POST /api/v1/users に利用者区分「法人」を指定して実行する
    Then HTTP 400 が返る
    And code が「VALIDATION_ERROR」である

  Scenario: 同一冪等キーの再送で二重登録されない
    Given 司書「山田花子」が冪等キー「11111111-1111-1111-1111-111111111111」で利用者「田中太郎」を登録済みである
    When 同じ冪等キーで同じ内容の POST /api/v1/users を再送する
    Then 前回と同じ利用者番号「U-000123」が返る
    And users テーブルの登録件数が 1 件のままである

  Scenario: 利用者ロールでは利用者を登録できない
    Given 利用者「田中太郎」のトークンを保持している
    When POST /api/v1/users を実行する
    Then HTTP 403 が返る
    And code が「FORBIDDEN」である
```

## ティア別仕様

- [司書ポータル](tier-frontend-staff.md)
- [バックエンド API](tier-backend-api.md)

### 統合 API Spec

- [OpenAPI Spec](../../../_cross-cutting/api/openapi.yaml)（全 UC 統合、Contract First 開発用）
