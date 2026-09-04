# 利用者番号で貸出対象利用者を特定する - バックエンド API 仕様

## 変更概要

貸出対象利用者の特定を行う参照系 API を 2 本追加する。利用者本人向けの `GET /api/v1/me/card` と、司書が提示された利用者番号から特定する `GET /api/v1/loan-targets/{userNo}`。いずれも参照のみで状態遷移を伴わない。実装は BC-002（利用者コンテキスト）の集約 AG-002 を参照し、貸出可否条件の利用者側前提（登録済みであること）を判定して返す。

## API 仕様

### 自分の利用者カードを取得する

- **メソッド**: GET
- **パス**: `/api/v1/me/card`
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `利用者` または `司書`
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/card.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| Authorization | string(header) | Yes | `Bearer {access_token}`。認証コンテキストから account_id / user_no を解決する |
| traceparent | string(header) | No | W3C Trace Context。フロントエンドが発行した trace_id を伝播する |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| user_no | string | 利用者番号 |
| name | string | 氏名 |
| user_category | string | 利用者区分（一般 / 学生 / 団体） |
| user_status | string | 利用者状態（登録済み / 取引進行中） |
| loanable | boolean | 貸出対象として有効か（貸出可否条件の利用者側前提の判定結果） |
| reason | string | `loanable` が false のときの理由。true のときは空文字 |

連絡先（email）はレスポンスに含めない（LR-003 レスポンスの PII 最小化）。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 404 | 認証コンテキストの利用者番号に対応する利用者が存在しない | `{"code":"USER_NOT_FOUND","message":"利用者情報が見つかりません"}` |

### 提示された利用者番号から貸出対象利用者を特定する

- **メソッド**: GET
- **パス**: `/api/v1/loan-targets/{userNo}`
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `司書` のみ（RBAC）。館内ネットワークからのアクセスに限定する
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loan-targets/{userNo}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| userNo | string(path) | Yes | 窓口で提示された利用者番号 |
| Authorization | string(header) | Yes | `Bearer {access_token}`。司書ロールであること |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| user_no | string | 利用者番号 |
| name | string | 氏名 |
| user_category | string | 利用者区分（一般 / 学生 / 団体） |
| user_status | string | 利用者状態（登録済み / 取引進行中） |
| loanable | boolean | 貸出対象として有効か |
| reason | string | `loanable` が false のときの理由 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | userNo の形式が不正（空文字・許容外の文字） | `{"code":"INVALID_USER_NO","message":"利用者番号の形式が正しくありません"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 司書ロールではない | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 404 | 指定された利用者番号の利用者が存在しない | `{"code":"USER_NOT_FOUND","message":"該当する利用者が見つかりません"}` |

## 非同期イベント（該当する場合）

本 UC は参照系のため非同期イベントを発行しない。

## データモデル変更

参照のみで、テーブル定義の変更はない。

### users（E-002 利用者）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_no | VARCHAR | 利用者番号（主キー）。特定のキー | 変更なし（SELECT） |
| name | VARCHAR | 氏名。保管時暗号化の対象（NFR E.6.1.1） | 変更なし（SELECT） |
| user_category | VARCHAR | 利用者区分（一般 / 学生 / 団体） | 変更なし（SELECT） |
| user_status | VARCHAR | 利用者状態（登録済み / 取引進行中） | 変更なし（SELECT） |

### user_accounts（E-003 利用者アカウント）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| account_id | VARCHAR | アカウントID（主キー）。認証コンテキストのキー | 変更なし（SELECT） |
| user_no | VARCHAR | 利用者番号。利用者への参照 | 変更なし（SELECT） |
| role | VARCHAR | 役割（司書 / 利用者）。RBAC の判定に使う | 変更なし（SELECT） |
| is_active | BOOLEAN | 有効フラグ。false のアカウントは 401 として扱う | 変更なし（SELECT） |

## ビジネスルール

- 貸出可否条件（利用者側の前提）: 利用者が登録済みであり、利用者状態が「登録済み」または「取引進行中」である場合に `loanable = true` とする。利用者が存在しない場合は 404 とし、`loanable` を返さない。
- 本人限定参照: `/api/v1/me/card` は認証コンテキストの利用者番号のみを対象とする。パス・クエリで他の利用者番号を指定する経路を提供しない（個人情報参照可否条件）。
- 司書向けの `/api/v1/loan-targets/{userNo}` は RBAC で司書ロールに限定する。利用者ロールのトークンでは 403 とする。
- レスポンスの PII 最小化: 連絡先（email）は本 UC のレスポンスに含めない。氏名は窓口での本人確認に必要なため含める。
- 本 UC は状態遷移を発生させない。利用者状態の「登録済み → 取引進行中」は「貸出を登録する」で発生する。
- アクセスログを presentation 層で、監査ログは出力しない（参照系のため。LP-002 / LP-006）。domain 層はログを出力しない（LP-010）。

## ティア完了条件（BDD）

```gherkin
Feature: 利用者番号で貸出対象利用者を特定する - バックエンド API

  Scenario: 利用者本人が自分の利用者カード情報を取得できる
    Given 利用者番号 "U-000123" の利用者「田中太郎」（利用者区分 "一般"、利用者状態 "登録済み"）が存在する
    And 利用者「田中太郎」のアクセストークンが有効である
    When GET /api/v1/me/card を呼び出す
    Then HTTP 200 が返り、user_no が "U-000123"、user_category が "一般"、loanable が true である
    And レスポンスに email フィールドが含まれない

  Scenario: 司書が提示された利用者番号で貸出対象利用者を特定できる
    Given 利用者番号 "U-000123" の利用者「田中太郎」が利用者状態 "登録済み" で存在する
    And 司書「山田花子」のアクセストークン（役割 "司書"）が有効である
    When GET /api/v1/loan-targets/U-000123 を呼び出す
    Then HTTP 200 が返り、name が "田中太郎"、user_status が "登録済み"、loanable が true である

  Scenario: 取引進行中の利用者も貸出対象として有効と判定する
    Given 利用者番号 "U-000123" の利用者が利用者状態 "取引進行中" で存在する
    When 司書のトークンで GET /api/v1/loan-targets/U-000123 を呼び出す
    Then HTTP 200 が返り、loanable が true である

  Scenario: 未登録の利用者番号は 404 を返す
    Given 利用者番号 "U-999999" の利用者が存在しない
    When 司書のトークンで GET /api/v1/loan-targets/U-999999 を呼び出す
    Then HTTP 404 が返り、code が "USER_NOT_FOUND" である

  Scenario: 利用者ロールでは司書向けの特定 API を呼び出せない
    Given 利用者「田中太郎」のアクセストークン（役割 "利用者"）が有効である
    When GET /api/v1/loan-targets/U-000456 を呼び出す
    Then HTTP 403 が返り、code が "FORBIDDEN" である

  Scenario: 無効なトークンでは 401 を返す
    Given 期限切れのアクセストークンを保持している
    When GET /api/v1/me/card を呼び出す
    Then HTTP 401 が返り、code が "UNAUTHENTICATED" である
```
