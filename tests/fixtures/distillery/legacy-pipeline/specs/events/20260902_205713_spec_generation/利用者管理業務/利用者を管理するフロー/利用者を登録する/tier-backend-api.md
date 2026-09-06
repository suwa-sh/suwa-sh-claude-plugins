# 利用者を登録する - バックエンド API 仕様

## 変更概要

BC-002（利用者コンテキスト）モジュールに利用者登録の Command ユースケースを追加する。冪等キーを KVS で検証し（LP-007）、利用者番号の採番・利用者状態「登録済み」の初期化を domain（AG-002 集約ルート）で行い、利用者登録イベントの追記とスナップショットの射影を単一トランザクションで確定する（LP-005）。

## API 仕様

### 利用者登録 API

- **メソッド**: POST
- **パス**: `/api/v1/users`
- **認証**: IdP 発行の Bearer トークン。役割「司書」のみ到達可（RBAC / NFR E.5.2.1）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| X-Idempotency-Key（ヘッダー） | string | Yes | 冪等キー（UUID）。二重登録の抑止に使う |
| name | string | Yes | 氏名。1〜100 文字 |
| email | string | Yes | 連絡先（メールアドレス）。書式検証あり。最大 255 文字 |
| user_category | string | Yes | 利用者区分。許容値: 一般 / 学生 / 団体 |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| user_no | string | 採番された利用者番号 |
| name | string | 氏名 |
| email_masked | string | マスク済み連絡先 |
| user_category | string | 利用者区分 |
| user_status | string | 利用者状態。登録直後は「登録済み」 |
| registered_at | string(date-time) | 登録日時（利用者登録イベントの occurred_at） |

成功時のステータスコードは 201。`Location: /api/v1/users/{user_no}` を返す。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | 必須項目欠落、氏名の桁超過、メールアドレス書式不正、利用者区分が許容値外 | `{"code":"VALIDATION_ERROR","message":"入力内容を確認してください","details":[...]}` |
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHORIZED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 409 | 同一連絡先の利用者が既に存在する（一意制約違反） | `{"code":"CONFLICT","message":"同じ連絡先の利用者が既に登録されています"}` |
| 422 | ドメインの不変条件違反 | `{"code":"BUSINESS_RULE_VIOLATION","message":"利用者を登録できません"}` |
| 500 | 技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

同一の冪等キーで再送された場合は新規登録を行わず、前回と同一のレスポンス（201 と同じ本文）を返す。

## 非同期イベント（該当する場合）

なし（利用者登録では MQ への publish を行わない）。

## データモデル変更

### user_events（利用者イベント / E-002 のイベントログ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| event_id | VARCHAR(36) | イベントID（PK） | 追加 |
| user_no | VARCHAR(20) | 利用者番号 | 追加 |
| event_type | VARCHAR(20) | イベント種別。本 UC では `USER_REGISTERED` | 追加 |
| payload | JSON | 氏名・連絡先・利用者区分（暗号化対象項目を含む） | 追加 |
| occurred_at | TIMESTAMP | 発生日時。スナップショットの registered_at へ射影する | 追加 |

### users（利用者 / E-002 のスナップショット）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_no | VARCHAR(20) | 利用者番号（PK）。採番結果 | 追加 |
| name | VARCHAR(100) | 氏名。保管時暗号化の対象（NFR E.6.1.1） | 追加 |
| email | VARCHAR(255) | 連絡先。保管時暗号化の対象。一意制約を張る | 追加 |
| user_category | VARCHAR(10) | 利用者区分（一般 / 学生 / 団体） | 追加 |
| user_status | VARCHAR(10) | 利用者状態。登録時は「登録済み」 | 追加 |
| registered_at | TIMESTAMP | 登録日時 | 追加 |
| updated_at | TIMESTAMP | 最終更新日時 | 追加 |

必要なインデックス: `users(email)`（UNIQUE。重複登録の最終防御）、`user_events(user_no, occurred_at)`。

## ビジネスルール

- 利用者登録ポリシー: 貸出・予約は登録済み利用者に限定される。登録時の利用者状態は「登録済み」とする（状態.tsv: 利用者状態）。
- 利用者番号の採番: 一意な利用者番号を採番し、以降の識別子とする。採番は domain 層（AG-002 集約ルート）の責務とする。
- 利用者区分（バリエーション）: 一般 / 学生 / 団体のみを許容する。返却期限設定条件で貸出期間を決める適用単位となるため、未指定を許さない。
- 冪等キー検証（LP-007）: KVS で既処理を検知した場合は前回結果を返す。KVS で検知できない競合は `users(email)` の一意制約で最終防御する。
- トランザクション境界（LP-005）: `user_events` の追記と `users` の射影を単一トランザクションで確定する。
- 監査ログ（LP-006）: 「誰が・いつ・どの利用者番号を登録したか」を INFO で記録する。氏名・連絡先はログに出力しない。
- レスポンスの PII 最小化（LR-003）: 連絡先はマスク済み値のみを返す。
- レスポンスタイム: 5 秒以内（NFR B.2.1.1）。

## ティア完了条件（BDD）

```gherkin
Feature: 利用者を登録する - バックエンド API

  Scenario: 司書が利用者を登録できる
    Given 司書ロールのトークンを保持している
    And 冪等キー「11111111-1111-1111-1111-111111111111」が未処理である
    When POST /api/v1/users に {"name":"田中太郎","email":"tanaka@example.com","user_category":"一般"} を送信する
    Then HTTP 201 が返る
    And user_no が採番されている
    And user_status が「登録済み」である

  Scenario: 登録イベントとスナップショットが同時に確定する
    Given 司書ロールのトークンを保持している
    When POST /api/v1/users で利用者「田中太郎」を登録する
    Then user_events に event_type「USER_REGISTERED」が 1 件追記される
    And users に該当 user_no のレコードが 1 件作成される
    And users.registered_at が user_events.occurred_at と一致する

  Scenario: 同一冪等キーの再送で二重登録されない
    Given 冪等キー「11111111-1111-1111-1111-111111111111」で利用者「田中太郎」が登録済みである
    When 同じ冪等キーで同じ本文の POST /api/v1/users を再送する
    Then HTTP 201 が返る
    And 前回と同一の user_no が返る
    And users の該当レコードが 1 件のままである

  Scenario: 連絡先が重複すると 409 になる
    Given 連絡先「tanaka@example.com」の利用者が既に登録されている
    And 司書ロールのトークンと未処理の冪等キーを保持している
    When POST /api/v1/users に同じ連絡先で送信する
    Then HTTP 409 が返る
    And code が「CONFLICT」である

  Scenario: 利用者区分が許容値外なら 400 になる
    Given 司書ロールのトークンを保持している
    When POST /api/v1/users に user_category「法人」を送信する
    Then HTTP 400 が返る
    And code が「VALIDATION_ERROR」である

  Scenario: 利用者ロールでは 403 になる
    Given 利用者ロールのトークンを保持している
    When POST /api/v1/users を実行する
    Then HTTP 403 が返る
    And code が「FORBIDDEN」である
```
