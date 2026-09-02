# 利用者一覧を照会する - バックエンド API 仕様

## 変更概要

BC-002（利用者コンテキスト）モジュールに利用者一覧照会の Query ユースケースを追加する。Query は domain を経由せず repository の読み取り専用 finder を利用する（LP-008）。レスポンスは司書ロール向け API のため氏名・連絡先を含めるが、連絡先はマスク済み値を既定とし、生値は返さない（LR-003）。

## API 仕様

### 利用者一覧照会 API

- **メソッド**: GET
- **パス**: `/api/v1/users`
- **認証**: IdP 発行の Bearer トークン（OAuth2/OIDC）。API Gateway で検証済み。役割「司書」のみ到達可（RBAC / NFR E.5.2.1）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| keyword | string | No | 氏名・利用者番号の部分一致。最大 100 文字 |
| user_category | string | No | 利用者区分。許容値: 一般 / 学生 / 団体 |
| page | integer | No | 頁番号。既定 1、最小 1 |
| per_page | integer | No | 頁あたり件数。既定 20、最大 100 |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items[].user_no | string | 利用者番号 |
| items[].name | string | 氏名 |
| items[].email_masked | string | マスク済み連絡先（例 `t****@example.com`） |
| items[].user_category | string | 利用者区分（一般 / 学生 / 団体） |
| items[].user_status | string | 利用者状態（登録済み / 取引進行中） |
| items[].active_loan_count | integer | 貸出状態が「貸出中」「延滞」の貸出件数 |
| items[].active_reservation_count | integer | 予約状態が「予約中」「取置き中」の予約件数 |
| items[].deletable | boolean | 利用者削除可否条件の充足有無（進行中の貸出・予約がいずれも 0 件） |
| items[].registered_at | string(date-time) | 登録日時 |
| total | integer | 総件数 |
| page | integer | 現在頁 |
| per_page | integer | 頁あたり件数 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `user_category` が許容値外、`page` < 1、`per_page` > 100 | `{"code":"VALIDATION_ERROR","message":"リクエストパラメータが不正です","details":[...]}` |
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHORIZED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 500 | データストアアクセス失敗などの技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

## 非同期イベント（該当する場合）

なし（照会 UC のため publish/subscribe は発生しない）。

## データモデル変更

### users（利用者 / E-002 のスナップショット）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_no | VARCHAR(20) | 利用者番号（PK） | 変更なし（参照のみ） |
| name | VARCHAR(100) | 氏名。保管時暗号化の対象（NFR E.6.1.1） | 変更なし |
| email | VARCHAR(255) | 連絡先。保管時暗号化の対象。レスポンスへはマスクして射影する | 変更なし |
| user_category | VARCHAR(10) | 利用者区分 | 変更なし |
| user_status | VARCHAR(10) | 利用者状態 | 変更なし |
| registered_at | TIMESTAMP | 登録日時 | 変更なし |
| updated_at | TIMESTAMP | 最終更新日時 | 変更なし |

### loans / reservations（進行中件数の集計対象）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loans.user_no | VARCHAR(20) | 利用者番号。進行中貸出件数の集計キー | 変更なし（参照のみ） |
| loans.loan_status | VARCHAR(10) | 貸出状態。「貸出中」「延滞」を進行中とみなす | 変更なし |
| reservations.user_no | VARCHAR(20) | 利用者番号。進行中予約件数の集計キー | 変更なし（参照のみ） |
| reservations.reservation_status | VARCHAR(10) | 予約状態。「予約中」「取置き中」を進行中とみなす | 変更なし |

必要なインデックス: `users(user_category)`、`users(name)`（キーワード検索）、`loans(user_no, loan_status)`、`reservations(user_no, reservation_status)`。

## ビジネスルール

- 個人情報参照可否条件: この API は司書ロール専用。利用者ロールのトークンでは 403 を返す。
- レスポンスの PII 最小化（LR-003）: 連絡先はマスク済み値のみを返し、生値はレスポンスに含めない。
- 利用者削除可否条件: 進行中の貸出（貸出中 / 延滞）と予約（予約中 / 取置き中）がいずれも 0 件のときに限り `deletable = true` とする。判定結果のみを返し、削除の実行判定は「利用者を削除する」UC の domain 層が再度行う。
- Command / Query の分離（LP-008）: 本 UC は Query。domain を経由せず repository の読み取り専用 finder を使う。
- ページネーション: 既定 20 件/頁。同時アクセス〜100 / 50 TPS（NFR B.1.1.1 / B.2.1.3）の前提で全件返却は行わない。
- レスポンスタイム: 5 秒以内（NFR B.2.1.1）。
- 監査ログ（LP-006）: 本人限定参照ではないが、個人情報の一覧照会であるため「誰が・いつ・利用者一覧を照会したか」を INFO で構造化ログに記録する。ログに氏名・連絡先は出力しない（LP-024 相当のログ PII 非出力）。

## ティア完了条件（BDD）

```gherkin
Feature: 利用者一覧を照会する - バックエンド API

  Scenario: 司書が既定条件で一覧を取得する
    Given 利用者が 25 件登録されている
    And 司書ロールのトークンを保持している
    When GET /api/v1/users を実行する
    Then HTTP 200 が返る
    And items の件数が 20 である
    And total が 25 である

  Scenario: 利用者区分で絞り込める
    Given 利用者区分「学生」の利用者が 3 件登録されている
    And 司書ロールのトークンを保持している
    When GET /api/v1/users?user_category=学生 を実行する
    Then HTTP 200 が返る
    And items の件数が 3 である
    And 全 items の user_category が「学生」である

  Scenario: 進行中取引のある利用者は deletable が false になる
    Given 利用者「U-000200」に貸出状態「貸出中」の貸出が 1 件ある
    And 司書ロールのトークンを保持している
    When GET /api/v1/users?keyword=U-000200 を実行する
    Then items[0].active_loan_count が 1 である
    And items[0].deletable が false である
    And items[0].user_status が「取引進行中」である

  Scenario: 連絡先がマスクされて返る
    Given 利用者「U-000123」の連絡先が「tanaka@example.com」である
    And 司書ロールのトークンを保持している
    When GET /api/v1/users?keyword=U-000123 を実行する
    Then items[0].email_masked が「t****@example.com」である（マスク規則: ローカル部の先頭 1 文字のみ残す）
    And レスポンスに生の連絡先フィールドが含まれない

  Scenario: 利用者ロールでは 403 になる
    Given 利用者ロールのトークンを保持している
    When GET /api/v1/users を実行する
    Then HTTP 403 が返る
    And code が「FORBIDDEN」である

  Scenario: 許容外の利用者区分で 400 になる
    Given 司書ロールのトークンを保持している
    When GET /api/v1/users?user_category=法人 を実行する
    Then HTTP 400 が返る
    And code が「VALIDATION_ERROR」である
```
