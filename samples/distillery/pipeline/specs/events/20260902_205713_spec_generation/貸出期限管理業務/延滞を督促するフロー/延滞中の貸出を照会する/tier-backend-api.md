# 延滞中の貸出を照会する - バックエンド API 仕様

## 変更概要

貸出状態が「延滞」の貸出を一覧で返す読み取り専用エンドポイントを追加する。超過日数を算出し、対象貸出ごとの直近の延滞督促通知の通知状態を合成して督促の実施状況を返す。

## API 仕様

### 延滞中の貸出一覧の取得

- **メソッド**: GET
- **パス**: `/api/v1/staff/overdues`
- **認証**: 外部マネージド IdP 発行のアクセストークン（Bearer）。役割「司書」を確認する（RBAC / NFR E.5.2.1）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/overdues.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| sort | string | No | 並び順。`days_overdue_desc`（既定） / `days_overdue_asc` |
| min_days_overdue | integer | No | 超過日数の下限で絞り込む。既定 1 |
| page | integer | No | ページ番号（1 始まり）。既定 1 |
| per_page | integer | No | 1 ページ件数。既定 20、最大 100 |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| base_date | string(date) | 超過日数の算出基準日（サーバのシステム日付） |
| summary.overdue_total | integer | 貸出状態が「延滞」の総件数 |
| summary.dun_not_sent | integer | 延滞督促の通知が未生成の件数 |
| summary.dun_failed | integer | 直近督促の通知状態が「送信失敗」の件数（未達件数） |
| total | integer | 絞り込み条件に合致する総件数 |
| page | integer | 現在のページ番号 |
| per_page | integer | 1 ページ件数 |
| items | OverdueLoanItem[] | 延滞貸出の配列 |
| items[].loan_id | string | 貸出ID |
| items[].book_id | string | 書籍ID |
| items[].book_title | string | 書籍のタイトル |
| items[].author | string | 書籍の著者 |
| items[].user_no | string | 利用者番号 |
| items[].user_name | string | 利用者の氏名（司書ロール向け API のみ返す。arch LR-003） |
| items[].user_category | string | 利用者区分（一般 / 学生 / 団体） |
| items[].loan_date | string(date) | 貸出日 |
| items[].due_date | string(date) | 返却期限 |
| items[].days_overdue | integer | 超過日数（`base_date - due_date`） |
| items[].loan_status | string | 貸出状態（本 API では常に `延滞`） |
| items[].last_dun_status | string | 直近の延滞督促の通知状態。通知が無い場合は `未送信` |
| items[].last_dun_requested_at | string(date-time) | 直近の延滞督促の送信要求日時。通知が無い場合は null |

連絡先（メールアドレス）はレスポンスに含めない。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `sort` が許容値でない、`min_days_overdue` が負値、`page` / `per_page` が範囲外 | `{"code":"INVALID_PARAMETER","message":"パラメータの値が不正です"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |
| 500 | データストア障害等の技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

## 非同期イベント（該当する場合）

本 UC は非同期イベントを発行・購読しない。

## データモデル変更

### loans（情報: 貸出 / E-004）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID（PK）。通知との突合キー | 変更なし（参照のみ） |
| book_id / user_no | VARCHAR | 書籍・利用者の JOIN キー | 変更なし（参照のみ） |
| loan_date | DATE | 貸出日 | 変更なし（参照のみ） |
| due_date | DATE | 返却期限。超過日数の算出とソート軸 | 変更なし（参照のみ） |
| loan_status | VARCHAR | 貸出状態。`延滞` のみを対象にする | 変更なし（参照のみ） |

インデックス: `(loan_status, due_date)` の複合インデックスを必要とする（延滞の絞り込みと超過日数降順 = 返却期限昇順のソート）。

### notifications（情報: 通知 / E-006）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| target_loan_id | VARCHAR | 対象貸出ID。直近督促の突合キー | 変更なし（参照のみ） |
| notification_type | VARCHAR | `延滞督促` で絞り込む | 変更なし（参照のみ） |
| notification_status | VARCHAR | 督促状況として表示する | 変更なし（参照のみ） |
| requested_at | DATETIME | 直近判定のソート軸 | 変更なし（参照のみ） |

インデックス: `(target_loan_id, notification_type, requested_at)` の複合インデックスを必要とする（対象貸出ごとの直近督促の取得）。

### books / users（参照のみ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| books.title / books.author | VARCHAR | 未返却の書籍を特定するために表示する | 変更なし（参照のみ） |
| users.name / users.user_category | VARCHAR | 司書向け一覧に表示する氏名・利用者区分 | 変更なし（参照のみ） |

## ビジネスルール

- 督促通知対象条件に基づき、貸出状態が「延滞」の貸出のみを対象とする。貸出状態が「返却済み」の貸出は督促を停止しているため一覧に含めない
- 超過日数は `base_date - due_date` で算出し、既定の並び順は超過日数の降順（返却期限の昇順）とする
- 督促状況は対象貸出の延滞督促通知のうち `requested_at` が最新の 1 件の通知状態とする。通知が 1 件も無い場合は `未送信` とする
- 貸出状態が「貸出中」の貸出は本 API の対象外とする（期限超過でも延滞遷移前は返さない。遷移は日次ジョブが行う）
- 利用者の氏名・利用者区分を返すのは司書ロール向け API に限る。連絡先は返さない（arch LR-003）
- Query 系ユースケースとして domain を経由せず repository の読み取り専用 finder を利用する（arch LP-008）
- 照会は監査ログの対象とし、`user_id`・役割・検索条件を構造化ログへ INFO で記録する（arch LP-006）
- 一覧は 1 ページ最大 100 件までとし、無限スクロールは提供しない（NFR B.1.1.1 / B.2.1.1 に対する design 決定）

## ティア完了条件（BDD）

```gherkin
Feature: 延滞中の貸出を照会する - バックエンド API

  Scenario: 延滞の貸出を超過日数の降順で返す
    Given 貸出「L-3001」が貸出状態「延滞」・返却期限「2026-08-20」で登録されている
    And 貸出「L-3002」が貸出状態「延滞」・返却期限「2026-08-30」で登録されている
    When 司書トークンで GET /api/v1/staff/overdues?sort=days_overdue_desc を呼び出す
    Then HTTP 200 が返り items[0].loan_id が「L-3001」、items[1].loan_id が「L-3002」になる

  Scenario: 直近の延滞督促の通知状態を督促状況として返す
    Given 貸出「L-3001」に対する延滞督促の通知が通知状態「送信済み」で 1 件存在する
    When 司書トークンで GET /api/v1/staff/overdues を呼び出す
    Then loan_id「L-3001」の last_dun_status が「送信済み」になる

  Scenario: 督促通知が無い貸出を未送信として返す
    Given 貸出「L-3003」が貸出状態「延滞」で延滞督促の通知が 1 件も存在しない
    When 司書トークンで GET /api/v1/staff/overdues を呼び出す
    Then loan_id「L-3003」の last_dun_status が「未送信」、last_dun_requested_at が null になる

  Scenario: 返却済みの貸出を返さない
    Given 貸出「L-3004」が貸出状態「返却済み」・返却期限「2026-08-25」で登録されている
    When 司書トークンで GET /api/v1/staff/overdues を呼び出す
    Then HTTP 200 が返り items に loan_id「L-3004」は含まれない

  Scenario: 未達件数をサマリに含める
    Given 直近督促の通知状態が「送信失敗」の延滞貸出が 2 件存在する
    When 司書トークンで GET /api/v1/staff/overdues を呼び出す
    Then summary.dun_failed が 2 になる

  Scenario: 許容値以外の並び順を拒否する
    Given 司書「山田司書」がログイン済みである
    When 司書トークンで GET /api/v1/staff/overdues?sort=title_asc を呼び出す
    Then HTTP 400 が返り code「INVALID_PARAMETER」が返却される
```
