# 自分の取置き状況を照会する - バックエンド API 仕様

## 変更概要

本人の予約 1 件の取置き状況（予約状態・取置き期限・残日数）を返す照会エンドポイントを追加する。個人情報参照可否条件を満たすため、認証コンテキストの利用者番号と一致する予約のみを対象とし、不一致の場合は存在を秘匿して 404 を返す。

## API 仕様

### 自分の取置き状況照会 API

- **メソッド**: GET
- **パス**: `/api/v1/me/reservations/{reservation_id}/hold`
- **認証**: Bearer トークン（IdP 発行。API Gateway でトークン検証と粗粒度 RBAC。役割=利用者）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/reservations/{reservation_id}/hold.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| reservation_id | string | Yes | 照会対象の予約ID（path） |

利用者番号は認証コンテキストから解決し、リクエストでは受け取らない（条件「個人情報参照可否条件」/ arch CLR-003）。

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| reservation_id | string | 予約ID |
| reservation_status | string | 予約状態（取置き中 / 予約中 / 貸出済み / キャンセル） |
| is_on_hold | boolean | 予約状態が「取置き中」か |
| hold_expires_at | string(date-time) | 取置き期限。取置き中のときのみ設定 |
| hold_started_at | string(date-time) | 取置き開始日時。`reservations.hold_started_at` を直接参照する（取置き遷移時に設定される。取置きを経ていない予約は NULL） |
| days_remaining | integer | 取置き期限までの残日数。取置き中のときのみ設定 |
| user_no | string | 窓口提示用の利用者番号（本人） |
| book_id | string | 取置き対象の書籍ID |
| book_title | string | 書籍タイトル |
| book_author | string | 著者 |
| book_genre | string | ジャンル |
| book_material_type | string | 資料種別 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | reservation_id の形式不正 | `{"code":"INVALID_REQUEST","message":"予約IDの形式が不正です"}` |
| 401 | トークン未提示・失効 | `{"code":"UNAUTHENTICATED","message":"ログインが必要です"}` |
| 404 | 予約が存在しない、または本人の予約でない | `{"code":"RESERVATION_NOT_FOUND","message":"対象の予約が見つかりません"}` |

## 非同期イベント（該当する場合）

この UC では非同期イベントを発行しない。

## データモデル変更

### reservations（情報: 予約 / E-005）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id / user_no / book_id / reservation_status / hold_expires_at | VARCHAR / TIMESTAMP | 取置き状況の判定と表示に参照する | 参照のみ |

### books（情報: 書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id / title / author / genre / material_type | VARCHAR | 取置き対象書籍の表示項目 | 参照のみ |

本 UC は参照のみで、テーブルの更新は行わない。取置き開始日時は `reservations.hold_started_at`、取置き期限は `reservations.hold_expires_at` を直接参照する（`_cross-cutting/datastore/rdb-schema.yaml` の `state_transition_rules`「予約状態遷移規則」が両列の設定タイミングの正本）。

## ビジネスルール

- 個人情報参照可否条件: 取置き状況の照会は、ログイン中の利用者本人に紐づく予約のみを対象とする。他利用者の予約は 404 として扱う
- 予約状態が「取置き中」でない場合は `is_on_hold=false` とし、`hold_expires_at` / `days_remaining` を返さない。現在の予約状態は返し、利用者が次の行動を判断できるようにする
- `days_remaining` は取置き期限の日付から当日の日付を引いた日数とする。負値（期限超過）はそのまま返し、画面側で超過表示に用いる
- レスポンスに他利用者の情報を含めない。本人の氏名・メールアドレスも返さず、窓口提示用の利用者番号のみを返す（NFR E.1.2.1 / E.6.1.1）

## ティア完了条件（BDD）

```gherkin
Feature: 自分の取置き状況を照会する - バックエンド API

  Scenario: 取置き中の予約で取置き期限と残日数が返る
    Given 予約 R-0007 は user_no が U-0001 で reservation_status が「取置き中」・hold_expires_at が 2026-09-09 である
    And 当日が 2026-09-06 である
    And 利用者番号 U-0001 のアクセストークンを保持している
    When GET /api/v1/me/reservations/R-0007/hold を送信する
    Then HTTP 200 が返り is_on_hold が true である
    And days_remaining が 3 である
    And user_no が U-0001 で返る

  Scenario: 取置き中でない予約では取置き情報が返らない
    Given 予約 R-0007 の reservation_status が「予約中」である
    When GET /api/v1/me/reservations/R-0007/hold を送信する
    Then HTTP 200 が返り is_on_hold が false である
    And hold_expires_at と days_remaining が返らない

  Scenario: 他利用者の予約は 404 になる
    Given 予約 R-0500 は user_no が U-0002 の予約である
    And 利用者番号 U-0001 のアクセストークンを保持している
    When GET /api/v1/me/reservations/R-0500/hold を送信する
    Then HTTP 404 が返り code が RESERVATION_NOT_FOUND である
    And レスポンスに他利用者の情報は含まれない

  Scenario: 未認証では 401 になる
    Given アクセストークンを保持していない
    When GET /api/v1/me/reservations/R-0007/hold を送信する
    Then HTTP 401 が返り code が UNAUTHENTICATED である
    And 予約情報は返らない
```
