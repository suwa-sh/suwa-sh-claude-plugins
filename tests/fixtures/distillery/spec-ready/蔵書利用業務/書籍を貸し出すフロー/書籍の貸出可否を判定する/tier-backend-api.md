# 書籍の貸出可否を判定する - バックエンド API 仕様

## 変更概要

貸出可否を判定する参照系 API `POST /api/v1/loans/eligibility-checks` を追加する。書籍・利用者・予約を取得し、貸出可否条件・取置き中書籍貸出条件・資料種別利用可否条件を domain 層で適用して可否と根拠を返す。状態遷移・永続化は行わない。判定ロジックの正本は貸出コンテキスト（BC-003）の集約 AG-003 に置き、書籍状態・予約状態は BC-001 / BC-004 から参照する。

## API 仕様

### 貸出可否を判定する

- **メソッド**: POST
- **パス**: `/api/v1/loans/eligibility-checks`
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `司書` のみ（RBAC）。館内ネットワークからのアクセスに限定する
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans/eligibility-checks.post` を参照

判定要求であり永続化を伴わないため、冪等キー（X-Idempotency-Key）は不要とする。

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id | string | Yes | 判定対象の書籍ID |
| user_no | string | Yes | 貸出対象利用者の利用者番号 |
| Authorization | string(header) | Yes | `Bearer {access_token}`。司書ロールであること |
| traceparent | string(header) | No | W3C Trace Context |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| eligible | boolean | 貸出可否の判定結果 |
| reasons | array | 判定の根拠。`condition_name`（RDRA 条件名）と `satisfied`（boolean）と `detail`（不足項目の説明）を要素に持つ |
| book | object | 判定対象の書籍。`book_id` / `title` / `author` / `isbn` / `publisher` / `genre` / `material_type` / `book_status` |
| user | object | 判定対象の利用者。`user_no` / `name` / `user_category` / `user_status`（連絡先は含まない） |
| hold | object | 対象書籍に取置き中の予約がある場合のみ。`reservation_id` / `priority` / `holder_user_no` / `hold_expires_at` |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | book_id または user_no が未指定・空文字・形式不正 | `{"code":"INVALID_REQUEST","message":"書籍IDと利用者番号を指定してください"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 司書ロールではない | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 404 | 指定された書籍が存在しない | `{"code":"BOOK_NOT_FOUND","message":"該当する書籍が見つかりません"}` |
| 404 | 指定された利用者が存在しない | `{"code":"USER_NOT_FOUND","message":"該当する利用者が見つかりません"}` |

書籍・利用者が存在するうえでの貸出不可は業務上の正常応答であり、HTTP 200 に `eligible: false` として返す（エラーステータスにはしない）。

## 非同期イベント（該当する場合）

本 UC は参照系のため非同期イベントを発行しない。

## データモデル変更

参照のみで、テーブル定義の変更はない。

### books（E-001 書籍）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（主キー）。判定対象のキー | 変更なし（SELECT） |
| title | VARCHAR | タイトル | 変更なし（SELECT） |
| author | VARCHAR | 著者 | 変更なし（SELECT） |
| isbn | VARCHAR | ISBN | 変更なし（SELECT） |
| publisher | VARCHAR | 出版社 | 変更なし（SELECT） |
| genre | VARCHAR | ジャンル | 変更なし（SELECT） |
| material_type | VARCHAR | 資料種別（紙書籍 / 電子書籍）。資料種別利用可否条件の判定に使う | 変更なし（SELECT） |
| book_status | VARCHAR | 書籍状態（在庫あり / 貸出中 / 予約待ち）。貸出可否条件の判定に使う | 変更なし（SELECT） |

### users（E-002 利用者）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_no | VARCHAR | 利用者番号（主キー） | 変更なし（SELECT） |
| name | VARCHAR | 氏名 | 変更なし（SELECT） |
| user_category | VARCHAR | 利用者区分（一般 / 学生 / 団体） | 変更なし（SELECT） |
| user_status | VARCHAR | 利用者状態（登録済み / 取引進行中）。貸出可否条件の判定に使う | 変更なし（SELECT） |

### reservations（E-005 予約）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id | VARCHAR | 予約ID（主キー） | 変更なし（SELECT） |
| book_id | VARCHAR | 予約対象の書籍ID。判定対象書籍での絞り込みに使う | 変更なし（SELECT） |
| user_no | VARCHAR | 予約申込者の利用者番号。取置き対象者の照合に使う | 変更なし（SELECT） |
| applied_at | TIMESTAMP | 予約申込日時。予約順位の昇順ソートキー | 変更なし（SELECT） |
| priority | INT | 予約順位。取置き中書籍貸出条件の判定に使う | 変更なし（SELECT） |
| reservation_status | VARCHAR | 予約状態（予約中 / 取置き中 / 貸出済み / キャンセル） | 変更なし（SELECT） |
| hold_expires_at | TIMESTAMP | 取置き期限。判定結果の hold に含める | 変更なし（SELECT） |

## ビジネスルール

- 資料種別利用可否条件を最初に評価する。`material_type` が「電子書籍」の場合は他の条件を評価せず `eligible = false`（理由: 電子書籍は未対応）とする。
- 貸出可否条件: `book_status` が「在庫あり」であり、`user_status` が「登録済み」または「取引進行中」であるときに `eligible = true` とする。`book_status` が「貸出中」の場合は `eligible = false`（理由: 貸出中）とする。
- 取置き中書籍貸出条件: `book_status` が「予約待ち」の場合、対象書籍に `reservation_status = '取置き中'` かつ `priority = 1` の予約が存在し、その `user_no` が要求の利用者番号と一致するときのみ `eligible = true` とする。一致しない場合は `eligible = false`（理由: 他の利用者へ取置き中）とする。取置き中の予約が存在せず「予約待ち」の場合は `eligible = false`（理由: 予約待ちのため取置き対象者の確定待ち）とする。
- `reasons` には評価した RDRA 条件名（貸出可否条件 / 取置き中書籍貸出条件 / 資料種別利用可否条件）を、満たした条件も含めて `satisfied` フラグ付きで返す。判定結果と根拠を並置するというブランドボイス／UI 要件に対応する。
- 判定は読み取り専用トランザクションで行い、書籍状態・予約状態・利用者状態のいずれも更新しない（LP-005 トランザクション境界）。
- レスポンスの PII 最小化: 利用者の連絡先（email）は返さない（LR-003）。
- domain 層はログを出力しない（LP-010）。判定要求と結果の記録は presentation 層のアクセスログで行う（LP-002）。監査ログは状態変更を伴わないため出力しない。
- 判定結果は時点情報であり、後続の「貸出を登録する」でも同じ条件を再評価する（判定と登録の間に他の窓口操作で状態が変わりうるため）。

## ティア完了条件（BDD）

```gherkin
Feature: 書籍の貸出可否を判定する - バックエンド API

  Scenario: 在庫ありの紙書籍と登録済み利用者は貸出可を返す
    Given 書籍ID "B-000001" の書籍が書籍状態 "在庫あり"、資料種別 "紙書籍" で存在する
    And 利用者番号 "U-000123" の利用者が利用者状態 "登録済み" で存在する
    When 司書のトークンで POST /api/v1/loans/eligibility-checks に {"book_id":"B-000001","user_no":"U-000123"} を送る
    Then HTTP 200 が返り、eligible が true である
    And reasons に condition_name "貸出可否条件" が satisfied true で含まれる

  Scenario: 貸出中の書籍は貸出不可を返す
    Given 書籍ID "B-000003" の書籍が書籍状態 "貸出中" で存在する
    And 利用者番号 "U-000123" の利用者が利用者状態 "登録済み" で存在する
    When 司書のトークンで POST /api/v1/loans/eligibility-checks に {"book_id":"B-000003","user_no":"U-000123"} を送る
    Then HTTP 200 が返り、eligible が false である
    And reasons に condition_name "貸出可否条件" が satisfied false と detail "書籍状態が貸出中" で含まれる

  Scenario: 取置き中の書籍は予約順1位の利用者に貸出可を返す
    Given 書籍ID "B-000002" の書籍が書籍状態 "予約待ち" で存在する
    And 書籍ID "B-000002" に利用者番号 "U-000123" の予約が priority 1、予約状態 "取置き中" で存在する
    When 司書のトークンで POST /api/v1/loans/eligibility-checks に {"book_id":"B-000002","user_no":"U-000123"} を送る
    Then HTTP 200 が返り、eligible が true である
    And hold.holder_user_no が "U-000123" である

  Scenario: 取置き中の書籍は他の利用者へ貸出不可を返す
    Given 書籍ID "B-000002" に利用者番号 "U-000123" の予約が priority 1、予約状態 "取置き中" で存在する
    And 利用者番号 "U-000456" の利用者が利用者状態 "登録済み" で存在する
    When 司書のトークンで POST /api/v1/loans/eligibility-checks に {"book_id":"B-000002","user_no":"U-000456"} を送る
    Then HTTP 200 が返り、eligible が false である
    And reasons に condition_name "取置き中書籍貸出条件" が satisfied false で含まれる

  Scenario: 電子書籍は資料種別利用可否条件で貸出不可を返す
    Given 書籍ID "B-000004" の書籍が資料種別 "電子書籍" で存在する
    And 利用者番号 "U-000123" の利用者が利用者状態 "登録済み" で存在する
    When 司書のトークンで POST /api/v1/loans/eligibility-checks に {"book_id":"B-000004","user_no":"U-000123"} を送る
    Then HTTP 200 が返り、eligible が false である
    And reasons に condition_name "資料種別利用可否条件" が satisfied false で含まれる

  Scenario: 存在しない書籍IDは 404 を返す
    Given 書籍ID "B-999999" の書籍が存在しない
    When 司書のトークンで POST /api/v1/loans/eligibility-checks に {"book_id":"B-999999","user_no":"U-000123"} を送る
    Then HTTP 404 が返り、code が "BOOK_NOT_FOUND" である

  Scenario: 必須パラメータ欠落は 400 を返す
    Given 司書のトークンが有効である
    When POST /api/v1/loans/eligibility-checks に {"book_id":""} を送る
    Then HTTP 400 が返り、code が "INVALID_REQUEST" である

  Scenario: 利用者ロールでは判定 API を呼び出せない
    Given 利用者「田中太郎」のアクセストークン（役割 "利用者"）が有効である
    When POST /api/v1/loans/eligibility-checks に {"book_id":"B-000001","user_no":"U-000123"} を送る
    Then HTTP 403 が返り、code が "FORBIDDEN" である
```
