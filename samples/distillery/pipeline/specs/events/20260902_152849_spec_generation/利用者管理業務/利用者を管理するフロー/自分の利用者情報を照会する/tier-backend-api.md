# 自分の利用者情報を照会する - バックエンド API 仕様

## 変更概要

BC-002（利用者コンテキスト）モジュールに本人の登録内容を返す Query ユースケースを追加する。参照対象は認証コンテキストの利用者番号に固定し、リクエストで利用者番号を受け取らない。所有者ベースの認可判定は domain 層で強制する（LP-011 / CTP-002）。

## API 仕様

### 本人の登録内容取得 API

- **メソッド**: GET
- **パス**: `/api/v1/me`
- **認証**: IdP 発行の Bearer トークン。役割「利用者」「司書」いずれも自分の登録内容を取得できる
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| Authorization（ヘッダー） | string | Yes | Bearer トークン。認証コンテキストの利用者番号が参照対象を決める |
| reveal（クエリ） | boolean | No | 既定 false。true のときだけ本人の生の連絡先 `email` を返す（段階的開示の明示操作でのみ指定する） |
| （利用者番号のパラメータなし） | - | - | 利用者番号を受け取るパラメータを定義しない（本人限定参照の担保） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| user_no | string | 本人の利用者番号 |
| name | string | 氏名 |
| email_masked | string | マスク済み連絡先 |
| email | string | 本人の生の連絡先。`reveal=true` 指定時のみ返す（既定は返さない） |
| user_category | string | 利用者区分（一般 / 学生 / 団体） |
| user_status | string | 利用者状態（登録済み / 取引進行中） |
| registered_at | string(date-time) | 登録日時 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHORIZED","message":"再度ログインしてください"}` |
| 403 | 認証コンテキストに利用者番号が無い（業務側の利用者に紐づかないアカウント） | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 404 | 認証コンテキストの利用者番号に対応する利用者が存在しない（退会済み等） | `{"code":"NOT_FOUND","message":"登録内容が見つかりません"}` |
| 500 | 技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

## 非同期イベント（該当する場合）

なし（照会 UC のため publish/subscribe は発生しない）。

## データモデル変更

### user_accounts（利用者アカウント / E-003）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| account_id | VARCHAR(36) | アカウントID（PK）。認証コンテキストの識別子 | 変更なし（参照のみ） |
| login_id | VARCHAR(64) | ログインID。IdP のサブジェクトに対応し、マイページのログイン情報として表示する | 変更なし（参照のみ） |
| user_no | VARCHAR(20) | 利用者番号。参照対象を決める | 変更なし（参照のみ） |
| role | VARCHAR(10) | 役割（司書 / 利用者） | 変更なし（参照のみ） |
| is_active | BOOLEAN | 有効フラグ | 変更なし（参照のみ） |

### users（利用者 / E-002 のスナップショット）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_no | VARCHAR(20) | 利用者番号（PK） | 変更なし（参照のみ） |
| name | VARCHAR(100) | 氏名。保管時暗号化の対象 | 変更なし |
| email | VARCHAR(255) | 連絡先。保管時暗号化の対象。マスクして返す | 変更なし |
| user_category | VARCHAR(10) | 利用者区分 | 変更なし |
| user_status | VARCHAR(10) | 利用者状態 | 変更なし |
| registered_at | TIMESTAMP | 登録日時 | 変更なし |

必要なインデックス: `users(user_no)`（PK）、`user_accounts(account_id)`（PK）、`user_accounts(user_no)`、`user_accounts(login_id)`（UNIQUE）。

## ビジネスルール

- 個人情報参照可否条件: 参照対象はログイン中の利用者本人に紐づく利用者情報のみ。API のインターフェース上、他の利用者番号を指定する手段を提供しない。
- 所有者ベースの認可判定（LP-011）: domain 層で、取得対象の利用者番号が認証コンテキストの利用者番号と一致することを強制する。presentation 層では役割による粗粒度の到達可否のみを判定する（LP-003）。
- レスポンスの PII 最小化（LR-003）: 利用者向け API は本人の情報のみを返し、連絡先はマスク済み値とする。
- Command / Query の分離（LP-008）: 本 UC は Query。domain を経由せず repository の読み取り専用 finder を使う（認可判定のみ domain のポリシーを適用する）。
- 監査ログ（LP-006）: 本人限定参照の照会であるため「誰が・いつ・本人の登録内容を照会したか」を INFO で記録する。氏名・連絡先はログに出力しない。
- ブラウザストレージへの PII 非保存（CLR-008）: レスポンスにキャッシュ制御ヘッダー（`Cache-Control: no-store`）を付与する。
- レスポンスタイム: 5 秒以内（NFR B.2.1.1）。

## ティア完了条件（BDD）

```gherkin
Feature: 自分の利用者情報を照会する - バックエンド API

  Scenario: 本人の登録内容を取得できる
    Given 利用者「U-000123 / 田中太郎 / 一般 / 登録済み」が登録されている
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me を実行する
    Then HTTP 200 が返る
    And user_no が「U-000123」である
    And user_category が「一般」である

  Scenario: 連絡先がマスクされて返る
    Given 利用者「U-000123」の連絡先が「tanaka@example.com」である
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me を実行する
    Then email_masked が「t****@example.com」である
    And レスポンスに生の連絡先フィールド email が含まれない

  Scenario: reveal=true 指定時のみ本人の生の連絡先が返る
    Given 利用者「U-000123」の連絡先が「tanaka@example.com」である
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me?reveal=true を実行する
    Then HTTP 200 が返る
    And email が「tanaka@example.com」である

  Scenario: 参照対象がトークンの利用者番号に固定される
    Given 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me?user_no=U-000200 を実行する
    Then HTTP 200 が返る
    And user_no が「U-000123」である

  Scenario: 取引進行中の状態が返る
    Given 利用者「U-000200」の利用者状態が「取引進行中」である
    And 利用者「U-000200」のトークンを保持している
    When GET /api/v1/me を実行する
    Then user_status が「取引進行中」である

  Scenario: トークンが無効なら 401 になる
    Given 期限切れのトークンを保持している
    When GET /api/v1/me を実行する
    Then HTTP 401 が返る
    And code が「UNAUTHORIZED」である

  Scenario: 退会済みの利用者番号では 404 になる
    Given 退会済みの利用者「U-000900」のトークンを保持している
    When GET /api/v1/me を実行する
    Then HTTP 404 が返る
    And code が「NOT_FOUND」である
```
