# 自分の予約状況を照会する - バックエンド API 仕様

## 変更概要

予約コンテキスト（BC-004）に、本人の予約一覧を返す照会エンドポイントを追加する。個人情報参照可否条件を満たすため、認証コンテキストの利用者番号で必ず絞り込み、他利用者の予約が混入しないようにする。一覧はページネーション（既定 20 件/頁）で返す。

## API 仕様

### 自分の予約一覧照会 API

- **メソッド**: GET
- **パス**: `/api/v1/me/reservations`
- **認証**: Bearer トークン（IdP 発行。API Gateway でトークン検証と粗粒度 RBAC。役割=利用者）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/reservations.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| status | string | No | 予約状態での絞り込み（予約中 / 取置き中 / 貸出済み / キャンセル）。未指定は全件 |
| page | integer | No | ページ番号（既定 1、1 以上） |
| size | integer | No | 1 ページ件数（既定 20、最大 100） |

利用者番号は認証コンテキストから解決し、リクエストでは受け取らない（条件「個人情報参照可否条件」/ arch CLR-003）。

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items[].reservation_id | string | 予約ID |
| items[].book_id | string | 予約対象の書籍ID |
| items[].book_title | string | 書籍タイトル |
| items[].book_author | string | 著者 |
| items[].book_genre | string | ジャンル |
| items[].book_material_type | string | 資料種別 |
| items[].reservation_status | string | 予約状態 |
| items[].priority | integer | 予約順位。「貸出済み」「キャンセル」では null |
| items[].applied_at | string(date-time) | 予約申込日時 |
| items[].hold_expires_at | string(date-time) | 取置き期限。「取置き中」のときのみ設定 |
| total | integer | 総件数 |
| page / size | integer | ページ情報 |
| active_count | integer | 予約状態が「予約中」「取置き中」の件数 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | page が 1 未満、size が 100 超、status がバリエーション値以外 | `{"code":"INVALID_REQUEST","message":"検索条件が不正です"}` |
| 401 | トークン未提示・失効 | `{"code":"UNAUTHENTICATED","message":"ログインが必要です"}` |

該当 0 件は 404 ではなく、`items` が空配列の 200 を返す。

## 非同期イベント（該当する場合）

この UC では非同期イベントを発行しない。

## データモデル変更

### reservations（情報: 予約 / E-005）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id / book_id / user_no / applied_at / priority / reservation_status / hold_expires_at | VARCHAR / TIMESTAMP / INT | 一覧の絞り込みと表示に参照する | 参照のみ |

### books（情報: 書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id / title / author / genre / material_type | VARCHAR | 一覧行の書籍表示項目 | 参照のみ |

本 UC は参照のみで、テーブルの更新は行わない。

## ビジネスルール

- 個人情報参照可否条件: 一覧は必ず認証コンテキストの利用者番号で絞り込む。`user_no` をリクエストパラメータとして受け取らない
- 予約順位決定条件: 予約状態が「貸出済み」「キャンセル」の予約は順位対象外のため `priority` を null で返す
- 既定の並び順は予約申込日時の降順（新しい予約が先）とする
- ページネーションは 1 ページ 20 件を既定とし、無限スクロール向けのカーソル API は提供しない（NFR B.1.1.1 に対する design 決定）
- 書籍属性は `book_id` の一括取得（IN 句）で解決し、行ごとの N+1 クエリを避ける（NFR B.2.1.1 レスポンス 5 秒以内）
- レスポンスに氏名・メールアドレスを含めない（NFR E.1.2.1 / E.6.1.1）

## ティア完了条件（BDD）

```gherkin
Feature: 自分の予約状況を照会する - バックエンド API

  Scenario: 本人の予約一覧が返る
    Given 利用者番号 U-0001 に reservation_status が「予約中」2 件・「取置き中」1 件の予約が存在する
    And 利用者番号 U-0001 のアクセストークンを保持している
    When GET /api/v1/me/reservations?page=1&size=20 を送信する
    Then HTTP 200 が返り items が 3 件である
    And active_count が 3 である
    And すべての行の user_no が U-0001 に紐づく予約である

  Scenario: 予約状態で絞り込める
    Given 利用者番号 U-0001 に「予約中」2 件・「キャンセル」1 件の予約が存在する
    When GET /api/v1/me/reservations?status=予約中 を送信する
    Then HTTP 200 が返り items が 2 件である
    And すべての行の reservation_status が「予約中」である

  Scenario: キャンセル済みの予約は priority が null で返る
    Given 利用者番号 U-0001 に reservation_status が「キャンセル」の予約 R-0300 が存在する
    When GET /api/v1/me/reservations を送信する
    Then R-0300 の行の priority が null である
    And reservation_status が「キャンセル」で返る

  Scenario: 0 件でも 200 と空配列を返す
    Given 利用者番号 U-0003 に予約が存在しない
    When GET /api/v1/me/reservations を送信する
    Then HTTP 200 が返り items が空配列である
    And total が 0 である
```
