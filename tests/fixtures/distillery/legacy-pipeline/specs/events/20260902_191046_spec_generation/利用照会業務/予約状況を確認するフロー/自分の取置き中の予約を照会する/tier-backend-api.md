# 自分の取置き中の予約を照会する - バックエンド API 仕様

## 変更概要

予約コンテキスト（BC-004）に、本人の取置き中の予約一覧を返す照会エンドポイントを追加する。個人情報参照可否条件を満たすため、認証コンテキストの利用者番号で必ず絞り込む。取置き期限の昇順で返し、期限当日の件数を併せて返す。

## API 仕様

### 自分の取置き中予約一覧照会 API

- **メソッド**: GET
- **パス**: `/api/v1/me/reservations/holds`
- **認証**: Bearer トークン（IdP 発行。API Gateway でトークン検証と粗粒度 RBAC。役割=利用者）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/reservations/holds.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| （なし） | - | - | 利用者番号は認証コンテキストから解決する（条件「個人情報参照可否条件」/ arch CLR-003） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items[].reservation_id | string | 予約ID |
| items[].book_id | string | 取置き対象の書籍ID |
| items[].book_title | string | 書籍タイトル |
| items[].book_author | string | 著者 |
| items[].book_genre | string | ジャンル |
| items[].book_material_type | string | 資料種別 |
| items[].reservation_status | string | 予約状態（取置き中） |
| items[].hold_started_at | string(date-time) | 取置き開始日時（取置き遷移イベントの発生時刻） |
| items[].hold_expires_at | string(date-time) | 取置き期限 |
| items[].days_remaining | integer | 取置き期限までの残日数 |
| total | integer | 取置き中の件数 |
| expiring_today_count | integer | 取置き期限が当日の件数 |
| user_no | string | 窓口提示用の利用者番号（本人） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | トークン未提示・失効 | `{"code":"UNAUTHENTICATED","message":"ログインが必要です"}` |

該当 0 件は 404 ではなく、`items` が空配列の 200 を返す。

## 非同期イベント（該当する場合）

この UC では非同期イベントを発行しない。

## データモデル変更

### reservations（情報: 予約 / E-005）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id / book_id / user_no / reservation_status / hold_expires_at | VARCHAR / TIMESTAMP | 取置き中の抽出と表示に参照する | 参照のみ |

### books（情報: 書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id / title / author / genre / material_type | VARCHAR | 一覧カードの書籍表示項目 | 参照のみ |

本 UC は参照のみで、テーブルの更新は行わない。取置き開始日時は取置き遷移イベントから取得する（E-005 の設計方針）。

## ビジネスルール

- 個人情報参照可否条件: 一覧は必ず認証コンテキストの利用者番号で絞り込む。`user_no` をリクエストパラメータとして受け取らない
- 対象は予約状態が「取置き中」の予約のみとする。「予約中」「貸出済み」「キャンセル」は含めない
- 並び順は取置き期限の昇順（期限が近いものが先）とする
- `days_remaining` は取置き期限の日付から当日の日付を引いた日数とする。負値（期限超過）はそのまま返し、画面側で超過表示に用いる
- `expiring_today_count` は `days_remaining` が 0 の件数とする
- 取置き中の件数は利用者ごとに少数のため、ページネーションは設けず全件返す
- 書籍属性は `book_id` の一括取得（IN 句）で解決し、行ごとの N+1 クエリを避ける（NFR B.2.1.1 レスポンス 5 秒以内）
- レスポンスに氏名・メールアドレスを含めない（NFR E.1.2.1 / E.6.1.1）

## ティア完了条件（BDD）

```gherkin
Feature: 自分の取置き中の予約を照会する - バックエンド API

  Scenario: 本人の取置き中予約が期限昇順で返る
    Given 利用者番号 U-0001 に reservation_status が「取置き中」の予約が hold_expires_at 2026-09-12 と 2026-09-09 で 2 件存在する
    And 当日が 2026-09-06 である
    And 利用者番号 U-0001 のアクセストークンを保持している
    When GET /api/v1/me/reservations/holds を送信する
    Then HTTP 200 が返り items が 2 件である
    And 1 件目の hold_expires_at が 2026-09-09 で days_remaining が 3 である

  Scenario: 期限当日の件数が返る
    Given 利用者番号 U-0002 に取置き期限が当日の予約が 1 件存在する
    When GET /api/v1/me/reservations/holds を送信する
    Then HTTP 200 が返り expiring_today_count が 1 である
    And 該当行の days_remaining が 0 である

  Scenario: 取置き中でない予約は含まれない
    Given 利用者番号 U-0001 に reservation_status が「予約中」の予約が 3 件存在する
    And 取置き中の予約は存在しない
    When GET /api/v1/me/reservations/holds を送信する
    Then HTTP 200 が返り items が空配列である
    And total が 0 である

  Scenario: 他利用者の取置きは含まれない
    Given 利用者番号 U-0002 に取置き中の予約が 3 件存在する
    And 利用者番号 U-0001 のアクセストークンを保持している
    When GET /api/v1/me/reservations/holds を送信する
    Then HTTP 200 が返り U-0002 の予約は 1 件も含まれない
    And user_no が U-0001 で返る
```
