# 利用者を登録する - Backend API仕様

## 変更概要

利用者コンテキスト（BC-002）モジュールに利用者登録 API（POST /api/v1/users）を追加する。
presentation でスキーマ検証と認可コンテキスト抽出、usecase で利用者番号採番とトランザクション、domain の User 集約（AG-002）で不変条件を検証し、repository が Event/Snapshot 併用で永続化する。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 利用者登録 API

- **メソッド**: POST
- **パス**: `/api/v1/users`
- **認証**: Bearer（IdP 発行アクセストークン）。API Gateway で利用者区分=司書の粗粒度 RBAC（館内経路）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| name | string | Yes | 氏名（1〜100 文字） |
| email | string | Yes | メールアドレス（RFC 5322 形式、最大 254 文字） |
| phone | string | No | 電話番号（数字とハイフン、最大 20 文字） |
| address | string | No | 住所（最大 200 文字） |
| userType | string | No | 利用者区分: `PATRON`（利用者）/ `STAFF`（司書）。省略時 `PATRON` |

Content-Type: `application/json`。ヘッダ `Idempotency-Key`（必須。同一キーの再送は最初の結果を返す: LR-002）、`X-Trace-Id`（任意。無ければ Gateway が生成）。

#### レスポンス

HTTP 201 Created。`Location: /api/v1/users/{userNumber}`

| フィールド | 型 | 説明 |
|-----------|---|------|
| userNumber | string | 採番された利用者番号 |
| name | string | 氏名 |
| email | string | メールアドレス |
| phone | string \| null | 電話番号 |
| address | string \| null | 住所 |
| userType | string | 利用者区分: `PATRON`（利用者）/ `STAFF`（司書） |
| version | integer | 楽観ロック用バージョン（登録直後は 1） |
| registeredAt | string (date-time) | 登録日時（登録イベントの occurred_at） |
| updatedAt | string (date-time) | 更新日時（登録直後は registeredAt と同値） |

#### エラーレスポンス

すべて `application/problem+json`（RFC 9457）。`type`, `title`, `status`, `detail`, `code`, `traceId` を含む。

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | JSON 構文不正・Idempotency-Key 欠落 | code=BAD_REQUEST |
| 401 | トークン未提示・期限切れ | code=UNAUTHENTICATED |
| 403 | 利用者区分が司書でない | code=FORBIDDEN |
| 422 | 必須欠落・形式不正（name 空、email 形式不正、userType が enum 外） | code=VALIDATION_ERROR, errors[]={field, message} |

## 非同期イベント（該当する場合）

なし（利用者登録は通知を発行しない）。

## データモデル変更

### users（利用者 snapshot。E-003）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_number | VARCHAR(20) PK | 利用者番号（採番） | 追加 |
| name | VARCHAR(100) | 氏名（保管時暗号化対象） | 追加 |
| email | VARCHAR(254) | メールアドレス（保管時暗号化対象） | 追加 |
| phone | VARCHAR(20) NULL | 電話番号 | 追加 |
| address | VARCHAR(200) NULL | 住所 | 追加 |
| user_type | VARCHAR(10) | 利用者区分（PATRON / STAFF） | 追加 |
| version | INT | 楽観ロック用 | 追加 |
| updated_at | TIMESTAMP | スナップショット最終更新日時 | 追加 |

### user_events（利用者イベント履歴。E-003 event_snapshot の履歴側）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| event_id | VARCHAR(36) PK | イベント ID | 追加 |
| user_number | VARCHAR(20) | 対象利用者番号 | 追加 |
| event_type | VARCHAR(20) | REGISTERED / UPDATED / DELETED | 追加 |
| payload | JSON | 変更後属性（氏名・連絡先） | 追加 |
| occurred_at | TIMESTAMP | 発生日時（登録日・更新日の正本） | 追加 |
| actor_user_number | VARCHAR(20) | 操作した司書の利用者番号 | 追加 |

## ビジネスルール

- 利用者番号は一意でありシステムが採番する（AG-002 不変条件）。クライアントから指定できない
- 利用者区分の既定値は `PATRON`（利用者）（バリエーション: 利用者区分）
- 入力検証は presentation 層で型・形式・必須のみ行う（LP-001）。ビジネス上の不変条件は domain で検証する（LR-005）
- 氏名・連絡先の値はアクセスログ・監査ログに記録しない（LP-006）
- 保存は UserRepository.save が user_events INSERT + users INSERT を同一トランザクションで実行する（LR-008）

## ティア完了条件（BDD）

```gherkin
Feature: 利用者を登録する - Backend API

  Scenario: 有効な入力で利用者を登録する
    Given 司書区分のアクセストークンを持つ
    When POST /api/v1/users に {name:"田中太郎", email:"tanaka@example.com", phone:"090-1234-5678", address:"東京都千代田区1-1"} を送る
    Then HTTP 201 が返り、レスポンスの userNumber が空でなく userType が "PATRON" である
    And users テーブルに該当行が 1 件、user_events に event_type=REGISTERED が 1 件作成される

  Scenario: 必須項目欠落で 422 を返す
    Given 司書区分のアクセストークンを持つ
    When POST /api/v1/users に {email:"tanaka@example.com"} を送る
    Then HTTP 422 application/problem+json が返り、code=VALIDATION_ERROR、errors[0].field="name" である

  Scenario: 利用者区分のトークンで 403 を返す
    Given 利用者区分のアクセストークンを持つ
    When POST /api/v1/users に {name:"田中太郎", email:"tanaka@example.com"} を送る
    Then HTTP 403 application/problem+json（code=FORBIDDEN）が返り、users テーブルは変更されない
```
