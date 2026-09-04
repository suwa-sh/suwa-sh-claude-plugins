# 利用者を編集する - Backend API仕様

## 変更概要

利用者コンテキスト（BC-002）モジュールに利用者取得 API（GET /api/v1/users/{userNumber}）と利用者更新 API（PUT /api/v1/users/{userNumber}）を追加する。
更新は楽観ロック（version）で競合を検知し、属性変更イベントを user_events に記録する。参照・更新とも監査ログ（LP-006）を出力する。

## API 仕様

### 利用者取得 API

- **メソッド**: GET
- **パス**: `/api/v1/users/{userNumber}`
- **認証**: Bearer。API Gateway で利用者区分=司書の粗粒度 RBAC（館内経路）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users/{userNumber}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| userNumber | string (path) | Yes | 利用者番号 |

#### レスポンス

HTTP 200。

| フィールド | 型 | 説明 |
|-----------|---|------|
| userNumber | string | 利用者番号 |
| name | string | 氏名 |
| email | string | メールアドレス |
| phone | string \| null | 電話番号 |
| address | string \| null | 住所 |
| userType | string | 利用者区分 |
| version | integer | 楽観ロック用バージョン（更新時に同梱する） |
| registeredAt | string (date-time) | 登録日時 |
| updatedAt | string (date-time) | 最終更新日時 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | 未認証 | code=UNAUTHENTICATED |
| 403 | 利用者区分が司書でない | code=FORBIDDEN |
| 404 | 利用者番号が存在しない | code=USER_NOT_FOUND |

### 利用者更新 API

- **メソッド**: PUT
- **パス**: `/api/v1/users/{userNumber}`
- **認証**: Bearer。利用者区分=司書
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users/{userNumber}.put` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| userNumber | string (path) | Yes | 利用者番号（変更不可） |
| name | string | Yes | 氏名（1〜100 文字） |
| email | string | Yes | メールアドレス（RFC 5322、最大 254 文字） |
| phone | string \| null | No | 電話番号（最大 20 文字） |
| address | string \| null | No | 住所（最大 200 文字） |
| version | integer | Yes | 取得時の version（楽観ロック） |

Content-Type: `application/json`。ヘッダ `Idempotency-Key`（必須。同一キーの再送は最初の結果を返す: LR-002）、`X-Trace-Id`（任意。無ければ Gateway が生成）。

#### レスポンス

HTTP 200。利用者取得 API と同じ UserResponse（version は +1 された値）。

#### エラーレスポンス

すべて `application/problem+json`（RFC 9457）。

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | JSON 構文不正・Idempotency-Key 欠落 | code=BAD_REQUEST |
| 401 | 未認証 | code=UNAUTHENTICATED |
| 403 | 利用者区分が司書でない | code=FORBIDDEN |
| 404 | 利用者番号が存在しない | code=USER_NOT_FOUND |
| 409 | version 不一致（他の更新が先行） | code=OPTIMISTIC_LOCK_CONFLICT, detail に現在の version |
| 422 | 必須欠落・形式不正・version 欠落 | code=VALIDATION_ERROR, errors[]={field, message} |

## 非同期イベント（該当する場合）

なし。

## データモデル変更

### users（利用者 snapshot。E-003）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| name | VARCHAR(100) | 氏名 | 変更（UPDATE 対象） |
| email | VARCHAR(254) | メールアドレス | 変更（UPDATE 対象） |
| phone | VARCHAR(20) NULL | 電話番号 | 変更（UPDATE 対象） |
| address | VARCHAR(200) NULL | 住所 | 変更（UPDATE 対象） |
| version | INT | 楽観ロック。UPDATE ... WHERE version = ? で +1 | 変更（UPDATE 対象） |
| updated_at | TIMESTAMP | 更新日時 | 変更（UPDATE 対象） |

### user_events（利用者イベント履歴）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| event_type | VARCHAR(20) | 「UPDATED」を追加 | 追加（値） |
| payload | JSON | 変更後の氏名・連絡先 | 追加（値） |

## ビジネスルール

- 利用者番号は変更できない（AG-002 不変条件「利用者番号は一意」。path の userNumber を正とし body には含めない）
- 利用者区分は本 API では変更しない（リクエストに userType を含めない）
- 楽観ロック: リクエスト version と snapshot の version が一致する場合のみ更新し、不一致は 409（LP-013）。競合は WARN ログに対象 ID と競合回数を含める（LP-018）
- 参照（GET）・更新（PUT）とも監査ログに user_id・操作種別・対象利用者番号を記録し、氏名・連絡先の値は記録しない（LP-006）
- 保存は user_events INSERT（属性変更）+ users UPDATE を同一トランザクションで実行する（LR-008）

## ティア完了条件（BDD）

```gherkin
Feature: 利用者を編集する - Backend API

  Scenario: 利用者を取得する
    Given 司書区分のアクセストークンを持ち、利用者「U0001234 田中太郎」（version 1）が存在する
    When GET /api/v1/users/U0001234 を呼び出す
    Then HTTP 200 が返り、name="田中太郎"、version=1 である

  Scenario: version が一致する更新は成功する
    Given 司書区分のアクセストークンを持ち、利用者「U0001234」（version 1）が存在する
    When PUT /api/v1/users/U0001234 に {name:"田中太郎", email:"tanaka.taro@example.com", phone:"090-1234-5678", address:"東京都千代田区1-1", version:1} を送る
    Then HTTP 200 が返り、email="tanaka.taro@example.com"、version=2 である
    And user_events に event_type=UPDATED が 1 件追加される

  Scenario: version が不一致の更新は 409 を返す
    Given 司書区分のアクセストークンを持ち、利用者「U0001234」の version が 2 である
    When PUT /api/v1/users/U0001234 に version:1 を含む更新を送る
    Then HTTP 409 application/problem+json（code=OPTIMISTIC_LOCK_CONFLICT）が返り、users は変更されない

  Scenario: 存在しない利用者の更新は 404 を返す
    Given 司書区分のアクセストークンを持ち、利用者「U9999999」が存在しない
    When PUT /api/v1/users/U9999999 に {name:"山田", email:"yamada@example.com", version:1} を送る
    Then HTTP 404 application/problem+json（code=USER_NOT_FOUND）が返る
```
