# 利用者情報を編集する - バックエンド API 仕様

## 変更概要

BC-002（利用者コンテキスト）モジュールに利用者詳細取得の Query と、利用者編集の Command を追加する。編集は AG-002 集約ルートで属性を更新し、編集イベントの追記とスナップショット更新を単一トランザクションで確定する。楽観ロックで同時編集の競合を検知する。

## API 仕様

### 利用者詳細取得 API

- **メソッド**: GET
- **パス**: `/api/v1/users/{userNo}`
- **認証**: Bearer トークン。役割「司書」のみ到達可
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users/{userNo}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| userNo（パス） | string | Yes | 利用者番号 |
| reveal（クエリ） | boolean | No | 既定 false。true のときだけ生の連絡先 `email` を返す |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| user_no | string | 利用者番号 |
| name | string | 氏名 |
| email_masked | string | マスク済み連絡先 |
| email | string | 生の連絡先。司書ロールかつ編集用途のときのみ返す（`reveal=true` 指定時） |
| user_category | string | 利用者区分 |
| user_status | string | 利用者状態 |
| active_loan_count | integer | 進行中の貸出件数 |
| active_reservation_count | integer | 進行中の予約件数 |
| registered_at | string(date-time) | 登録日時 |
| updated_at | string(date-time) | 最終更新日時。楽観ロックの版として使う |
| deletable | boolean | 削除可否。進行中の貸出・予約がいずれも 0 件のとき true |

### 利用者情報更新 API

- **メソッド**: PUT
- **パス**: `/api/v1/users/{userNo}`
- **認証**: Bearer トークン。役割「司書」のみ到達可（RBAC / NFR E.5.2.1）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users/{userNo}.put` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| userNo（パス） | string | Yes | 利用者番号 |
| X-Idempotency-Key（ヘッダー） | string | Yes | 冪等キー（UUID） |
| If-Match（ヘッダー） | string | Yes | 取得時の `updated_at` を版として指定する（楽観ロック） |
| name | string | Yes | 氏名。1〜100 文字 |
| email | string | Yes | 連絡先（メールアドレス）。書式検証あり |
| user_category | string | Yes | 利用者区分。許容値: 一般 / 学生 / 団体 |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| user_no | string | 利用者番号 |
| name | string | 変更後の氏名 |
| email_masked | string | 変更後のマスク済み連絡先 |
| user_category | string | 変更後の利用者区分 |
| user_status | string | 利用者状態（本 UC では変更しない） |
| updated_at | string(date-time) | 更新日時（編集イベントの occurred_at） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | 必須項目欠落、桁超過、メールアドレス書式不正、利用者区分が許容値外 | `{"code":"VALIDATION_ERROR","message":"入力内容を確認してください","details":[...]}` |
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHORIZED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 404 | 指定した利用者番号の利用者が存在しない | `{"code":"NOT_FOUND","message":"対象の利用者が見つかりません"}` |
| 409 | 楽観ロック競合、または変更後の連絡先が他の利用者と重複 | `{"code":"CONFLICT","message":"最新の内容を取得してからやり直してください"}` |
| 500 | 技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

## 非同期イベント（該当する場合）

なし（利用者編集では MQ への publish を行わない。連絡先の変更は通知作成時に `users.email` を参照して反映される）。

## データモデル変更

### user_events（利用者イベント / E-002 のイベントログ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| event_type | VARCHAR(20) | 本 UC では `USER_PROFILE_CHANGED` を追記する | 追加（値の追加） |
| payload | JSON | 変更後の氏名・連絡先・利用者区分と、変更された項目名の一覧 | 変更なし |
| occurred_at | TIMESTAMP | 発生日時。スナップショットの updated_at へ射影する | 変更なし |

### users（利用者 / E-002 のスナップショット）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| name | VARCHAR(100) | 氏名。保管時暗号化の対象 | 変更（UPDATE 対象） |
| email | VARCHAR(255) | 連絡先。保管時暗号化の対象。UNIQUE 制約あり | 変更（UPDATE 対象） |
| user_category | VARCHAR(10) | 利用者区分 | 変更（UPDATE 対象） |
| updated_at | TIMESTAMP | 最終更新日時。楽観ロックの版 | 変更（UPDATE 対象） |
| user_status | VARCHAR(10) | 利用者状態 | 変更なし（本 UC では更新しない） |

必要なインデックス: `users(user_no)`（PK）、`users(email)`（UNIQUE）。

## ビジネスルール

- 属性変更のみを行い、利用者状態（登録済み / 取引進行中）は変更しない。進行中取引があっても編集は許可する（制限されるのは削除のみ / 利用者削除可否条件）。
- 連絡先は取置き案内・返却期限リマインド・延滞督促メールの宛先となるため、変更後は以降に作成される通知の宛先へ反映される。既に作成済みの通知は送信時点の宛先をコピー保持しているため遡って変更しない（E-006 の `recipient_email`）。
- 楽観ロック（LR-009 楽観ロックによる競合制御）: `If-Match` に指定された版と `users.updated_at` が一致するときだけ更新する。不一致は 409。
- 冪等キー検証（LP-007）: 同一冪等キーの再送は前回結果を返す。
- トランザクション境界（LP-005）: `user_events` の追記と `users` の更新を単一トランザクションで確定する。
- 監査ログ（LP-006）: 「誰が・いつ・どの利用者番号の何の項目を変更したか」を INFO で記録する。変更前後の氏名・連絡先の値はログに出力しない（項目名のみ）。
- レスポンスの PII 最小化（LR-003）: 更新レスポンスの連絡先はマスク済み値のみを返す。
- レスポンスタイム: 5 秒以内（NFR B.2.1.1）。

## ティア完了条件（BDD）

```gherkin
Feature: 利用者情報を編集する - バックエンド API

  Scenario: 司書が連絡先を変更できる
    Given 利用者「U-000123」の連絡先が「tanaka@example.com」である
    And 司書ロールのトークンと最新の版を保持している
    When PUT /api/v1/users/U-000123 に {"name":"田中太郎","email":"taro.tanaka@example.com","user_category":"一般"} を送信する
    Then HTTP 200 が返る
    And users.email が「taro.tanaka@example.com」になる
    And user_events に event_type「USER_PROFILE_CHANGED」が 1 件追記される

  Scenario: 更新日時がイベントの発生日時と一致する
    Given 司書ロールのトークンと最新の版を保持している
    When PUT /api/v1/users/U-000123 で氏名を「田中太朗」に変更する
    Then users.updated_at が追記された user_events.occurred_at と一致する

  Scenario: 利用者状態は変更されない
    Given 利用者「U-000200」の利用者状態が「取引進行中」である
    And 司書ロールのトークンと最新の版を保持している
    When PUT /api/v1/users/U-000200 で連絡先を変更する
    Then HTTP 200 が返る
    And users.user_status が「取引進行中」のままである

  Scenario: 存在しない利用者番号で 404 になる
    Given 司書ロールのトークンを保持している
    When PUT /api/v1/users/U-999999 を実行する
    Then HTTP 404 が返る
    And code が「NOT_FOUND」である

  Scenario: 古い版を指定すると 409 になる
    Given 利用者「U-000123」が別の司書により既に更新されている
    And 更新前の版を If-Match に保持している
    When PUT /api/v1/users/U-000123 を実行する
    Then HTTP 409 が返る
    And code が「CONFLICT」である

  Scenario: 利用者ロールでは 403 になる
    Given 利用者ロールのトークンを保持している
    When PUT /api/v1/users/U-000123 を実行する
    Then HTTP 403 が返る
    And code が「FORBIDDEN」である
```
