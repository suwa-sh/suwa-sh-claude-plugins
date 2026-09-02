# 利用者を削除する - バックエンド API 仕様

## 変更概要

BC-002（利用者コンテキスト）モジュールに利用者削除の Command ユースケースを追加する。利用者削除可否条件の判定は domain 層（AG-002 集約ルート）が強制する（presentation では行わない / LP-001）。判定材料である進行中の貸出・予約の件数は、BC-003（貸出）・BC-004（予約）のモジュール公開インターフェース経由で取得し、テーブルへ直接アクセスしない（CLR-007 モジュール間の直接データアクセス禁止）。

## API 仕様

### 利用者削除 API

- **メソッド**: DELETE
- **パス**: `/api/v1/users/{userNo}`
- **認証**: Bearer トークン。役割「司書」のみ到達可（RBAC / NFR E.5.2.1）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users/{userNo}.delete` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| userNo（パス） | string | Yes | 削除対象の利用者番号 |
| X-Idempotency-Key（ヘッダー） | string | Yes | 冪等キー（UUID） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| （本文なし） | - | 成功時は HTTP 204 No Content |

削除可否の事前確認は `GET /api/v1/users/{userNo}` の `deletable` / `active_loan_count` / `active_reservation_count` を用いる（「利用者情報を編集する」UC で定義済み）。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHORIZED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 404 | 指定した利用者番号の利用者が存在しない | `{"code":"NOT_FOUND","message":"対象の利用者が見つかりません"}` |
| 409 | 利用者削除可否条件が未充足（進行中の貸出または予約が存在する） | `{"code":"BUSINESS_RULE_VIOLATION","message":"進行中の取引があるため削除できません","reasons":["貸出中・延滞の貸出が 1 件あります"]}` |
| 500 | 技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

## 非同期イベント（該当する場合）

なし（利用者削除では MQ への publish を行わない）。

## データモデル変更

### user_events（利用者イベント / E-002 のイベントログ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| event_type | VARCHAR(20) | 本 UC では `USER_WITHDRAWN` を追記する | 追加（値の追加） |
| payload | JSON | 削除時点の利用者区分・登録日時（氏名・連絡先は含めない） | 変更なし |
| occurred_at | TIMESTAMP | 発生日時 | 変更なし |

### users（利用者 / E-002 のスナップショット）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_no | VARCHAR(20) | 利用者番号（PK）。DELETE の対象 | 削除（行削除） |
| name | VARCHAR(100) | 氏名 | 削除（行削除） |
| email | VARCHAR(255) | 連絡先 | 削除（行削除） |

### loans / reservations（判定材料。参照のみ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loans.loan_status | VARCHAR(10) | 「貸出中」「延滞」を進行中とみなす | 変更なし（参照のみ） |
| reservations.reservation_status | VARCHAR(10) | 「予約中」「取置き中」を進行中とみなす | 変更なし（参照のみ） |

必要なインデックス: `loans(user_no, loan_status)`、`reservations(user_no, reservation_status)`。

## ビジネスルール

- 利用者削除可否条件: 対象利用者に貸出状態が「貸出中」「延滞」の貸出、および予約状態が「予約中」「取置き中」の予約が存在しない場合に限り削除を許可する。未充足のときは 409 と未充足理由の一覧を返す。`reasons` には進行中取引が存在する項目だけを含め、件数が 0 の項目は含めない。
- 判定の実行位置（LP-011 所有者ベースの認可判定 / LP-001）: 削除可否は domain 層で強制する。presentation 層では判定しない。フロントエンドの表示は補助であり、API 側で必ず再判定する。
- 削除は物理削除とし、`users` の行を削除する。削除の事実は `user_events` に `USER_WITHDRAWN` として残す（イベントログには氏名・連絡先を含めない）。
- 返却済みの貸出（貸出状態「返却済み」）とキャンセル・貸出済みの予約は進行中とみなさず、削除を妨げない。過去の貸出実績は貸出統計の集計対象として `loans` に残る。
- 冪等キー検証（LP-007）: 同一冪等キーの再送は追加の削除イベントを追記せず 204 を返す。
- トランザクション境界（LP-005）: 進行中件数の再取得・イベント追記・`users` の削除を単一トランザクションで確定する。
- 監査ログ（LP-006）: 「誰が・いつ・どの利用者番号を削除したか」を INFO で記録する。氏名・連絡先はログに出力しない。
- レスポンスタイム: 5 秒以内（NFR B.2.1.1）。

## ティア完了条件（BDD）

```gherkin
Feature: 利用者を削除する - バックエンド API

  Scenario: 進行中取引のない利用者を削除できる
    Given 利用者「U-000123」に貸出中・延滞の貸出が 0 件、予約中・取置き中の予約が 0 件である
    And 司書ロールのトークンと未処理の冪等キーを保持している
    When DELETE /api/v1/users/U-000123 を実行する
    Then HTTP 204 が返る
    And users から user_no「U-000123」の行が削除される
    And user_events に event_type「USER_WITHDRAWN」が 1 件追記される

  Scenario: 進行中の貸出があると 409 になる
    Given 利用者「U-000200」に貸出状態「貸出中」の貸出が 1 件ある
    And 司書ロールのトークンを保持している
    When DELETE /api/v1/users/U-000200 を実行する
    Then HTTP 409 が返る
    And code が「BUSINESS_RULE_VIOLATION」である
    And users の user_no「U-000200」の行が残っている

  Scenario: 取置き中の予約があると 409 になる
    Given 利用者「U-000300」に予約状態「取置き中」の予約が 1 件ある
    And 司書ロールのトークンを保持している
    When DELETE /api/v1/users/U-000300 を実行する
    Then HTTP 409 が返る
    And reasons に予約に関する未充足理由が含まれる

  Scenario: 返却済みの貸出だけなら削除できる
    Given 利用者「U-000400」の貸出がすべて貸出状態「返却済み」である
    And 司書ロールのトークンと未処理の冪等キーを保持している
    When DELETE /api/v1/users/U-000400 を実行する
    Then HTTP 204 が返る
    And loans の返却済み貸出は削除されない

  Scenario: 存在しない利用者番号で 404 になる
    Given 司書ロールのトークンを保持している
    When DELETE /api/v1/users/U-999999 を実行する
    Then HTTP 404 が返る
    And code が「NOT_FOUND」である

  Scenario: 同一冪等キーの再送で 204 が返る
    Given 冪等キー「22222222-2222-2222-2222-222222222222」で利用者「U-000123」が削除済みである
    When 同じ冪等キーで DELETE /api/v1/users/U-000123 を再送する
    Then HTTP 204 が返る
    And user_events の USER_WITHDRAWN が 1 件のままである

  Scenario: 利用者ロールでは 403 になる
    Given 利用者ロールのトークンを保持している
    When DELETE /api/v1/users/U-000123 を実行する
    Then HTTP 403 が返る
    And code が「FORBIDDEN」である
```
