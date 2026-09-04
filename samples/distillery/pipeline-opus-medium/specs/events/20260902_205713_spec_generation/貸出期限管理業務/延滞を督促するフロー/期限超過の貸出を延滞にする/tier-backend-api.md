# 期限超過の貸出を延滞にする - バックエンド API 仕様

## 変更概要

日次タイマーによる延滞判定の結果を司書が確認するための読み取り専用エンドポイントを追加する。指定した判定日に「貸出中」から「延滞」へ遷移した貸出の件数と一覧、判定後の延滞総件数を返す。状態遷移そのものは tier-worker が行うため、本ティアは遷移を実行しない。

## API 仕様

### 延滞判定結果の取得

- **メソッド**: GET
- **パス**: `/api/v1/staff/overdues/judgement`
- **認証**: 外部マネージド IdP 発行のアクセストークン（Bearer）。役割「司書」を確認する（RBAC / NFR E.5.2.1）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/overdues/judgement.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| base_date | string(date) | No | 判定日。既定はサーバのシステム日付。未来日は当日に丸める |
| page | integer | No | ページ番号（1 始まり）。既定 1 |
| per_page | integer | No | 1 ページ件数。既定 20、最大 100 |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| base_date | string(date) | 判定日 |
| transitioned_count | integer | 判定日に「貸出中」から「延滞」へ遷移した貸出の件数（日次ジョブ実行結果 `lock:job:overdue-judge:{base_date}` の遷移対象貸出ID一覧の件数） |
| overdue_total | integer | 判定後の延滞総件数（貸出状態が「延滞」の貸出の総数） |
| total | integer | `items` の総件数（= `transitioned_count`） |
| page | integer | 現在のページ番号 |
| per_page | integer | 1 ページ件数 |
| items | JudgedOverdueLoanItem[] | 判定日に遷移した貸出の配列 |
| items[].loan_id | string | 貸出ID |
| items[].book_id | string | 書籍ID |
| items[].book_title | string | 書籍のタイトル |
| items[].author | string | 書籍の著者 |
| items[].user_no | string | 利用者番号 |
| items[].user_name | string | 利用者の氏名（司書ロール向け API のみ返す。arch LR-003） |
| items[].loan_date | string(date) | 貸出日 |
| items[].due_date | string(date) | 返却期限 |
| items[].days_overdue | integer | 超過日数（`base_date - due_date`） |
| items[].loan_status | string | 貸出状態（本 API では常に `延滞`） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `base_date` が日付形式でない、`page` / `per_page` が範囲外 | `{"code":"INVALID_PARAMETER","message":"パラメータの値が不正です"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |
| 500 | データストア障害等の技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

## 非同期イベント（該当する場合）

本 UC のバックエンド API は非同期イベントを発行・購読しない。延滞督促の送信要求 publish は tier-worker が担う（[tier-worker.md](tier-worker.md)）。

## データモデル変更

### loans（情報: 貸出 / E-004）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID（PK） | 変更なし（参照のみ） |
| book_id | VARCHAR | 書籍情報の JOIN キー | 変更なし（参照のみ） |
| user_no | VARCHAR | 利用者情報の JOIN キー | 変更なし（参照のみ） |
| loan_date | DATE | 貸出日 | 変更なし（参照のみ） |
| due_date | DATE | 返却期限。遷移日の逆算に使う | 変更なし（参照のみ） |
| loan_status | VARCHAR | 貸出状態。`延滞` のみを対象にする | 変更なし（参照のみ。更新は tier-worker が行う） |

インデックス: `(loan_status, due_date)` の複合インデックスを必要とする（延滞の絞り込みと返却期限による遷移日の特定）。

### books / users（参照のみ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| books.title / books.author | VARCHAR | 一覧表示に JOIN で参照する | 変更なし（参照のみ） |
| users.name | VARCHAR | 司書向け一覧に表示する氏名。保管時暗号化（NFR E.6.1.1） | 変更なし（参照のみ） |

## ビジネスルール

- 判定日に遷移した貸出の正本は日次ジョブの実行結果（`lock:job:overdue-judge:{base_date}` に記録した遷移件数と遷移対象貸出ID）とする。`transitioned_count` / `items` はこの実行結果を参照して返し、返却期限からの逆算（`due_date = base_date - 1 日`）では算出しない（ジョブが停止・遅延した翌日にまとめて遷移した貸出＝返却期限が `base_date - 2 日` 以前の貸出が漏れるため）
- `overdue_total` は貸出状態が「延滞」の貸出の総数とし、判定日で絞り込まない
- 貸出状態が「返却済み」の貸出は返さない（督促を停止した貸出のため）
- 本 API は貸出状態を更新しない。状態遷移の実行は tier-worker の日次ジョブに限る（状態遷移の実行経路を 1 本に保つため）
- 利用者の氏名を返すのは司書ロール向け API に限る。連絡先は返さない（arch LR-003）
- Query 系ユースケースとして domain を経由せず repository の読み取り専用 finder を利用する（arch LP-008）
- 照会は監査ログの対象とし、`user_id`・役割・判定日を構造化ログへ INFO で記録する（arch LP-006）

## ティア完了条件（BDD）

```gherkin
Feature: 期限超過の貸出を延滞にする - バックエンド API

  Scenario: 判定日に遷移した貸出の件数と一覧を返す
    Given 貸出「L-3001」の貸出状態が「延滞」で返却期限が「2026-09-01」である
    When 司書トークンで GET /api/v1/staff/overdues/judgement?base_date=2026-09-02 を呼び出す
    Then HTTP 200 が返り transitioned_count が 1 になり items に loan_id「L-3001」と days_overdue「1」が含まれる

  Scenario: 延滞総件数を判定日で絞り込まずに返す
    Given 貸出状態が「延滞」の貸出が 12 件存在する
    And そのうち返却期限が「2026-09-01」の貸出は 3 件である
    When 司書トークンで GET /api/v1/staff/overdues/judgement?base_date=2026-09-02 を呼び出す
    Then HTTP 200 が返り overdue_total が 12、transitioned_count が 3 になる

  Scenario: 返却済みの貸出を返さない
    Given 貸出「L-3002」の貸出状態が「返却済み」で返却期限が「2026-09-01」である
    When 司書トークンで GET /api/v1/staff/overdues/judgement?base_date=2026-09-02 を呼び出す
    Then HTTP 200 が返り items に loan_id「L-3002」は含まれない

  Scenario: 日付形式でない判定日を拒否する
    Given 司書「山田司書」がログイン済みである
    When 司書トークンで GET /api/v1/staff/overdues/judgement?base_date=2026-13-45 を呼び出す
    Then HTTP 400 が返り code「INVALID_PARAMETER」が返却される

  Scenario: 利用者ロールのトークンでは到達できない
    Given 利用者「田中太郎」のアクセストークンを保持している
    When 利用者トークンで GET /api/v1/staff/overdues/judgement を呼び出す
    Then HTTP 403 が返り code「FORBIDDEN」が返却される
```
