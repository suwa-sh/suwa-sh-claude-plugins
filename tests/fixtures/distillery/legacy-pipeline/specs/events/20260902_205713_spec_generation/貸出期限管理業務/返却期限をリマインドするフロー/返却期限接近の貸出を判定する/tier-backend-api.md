# 返却期限接近の貸出を判定する - バックエンド API 仕様

## 変更概要

司書が返却期限接近の貸出を確認するための読み取り専用エンドポイントを追加する。リマインド通知対象条件と同一の判定式で貸出中の貸出を抽出し、残日数を付与して返す。Query 系ユースケースのため domain を経由せず repository の読み取り専用 finder を利用する（arch LP-008）。

## API 仕様

### 返却期限接近貸出一覧の取得

- **メソッド**: GET
- **パス**: `/api/v1/staff/duedates/upcoming`
- **認証**: 外部マネージド IdP 発行のアクセストークン（Bearer）。API Gateway で検証済みのクレームから役割「司書」を確認する（RBAC / NFR E.5.2.1）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/duedates/upcoming.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| timing_type | string | No | 通知タイミング区分。`期限前リマインド` / `期限当日`。既定は `期限前リマインド` |
| base_date | string(date) | No | 判定基準日。既定はサーバのシステム日付 |
| page | integer | No | ページ番号（1 始まり）。既定 1 |
| per_page | integer | No | 1 ページ件数。既定 20、最大 100（NFR B.1.1.1 に対する design 決定に整合） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| evaluated_at | string(date-time) | 判定を評価した日時。画面上部の「判定日時」に表示する |
| base_date | string(date) | 判定基準日 |
| timing_type | string | 適用した通知タイミング区分 |
| remind_days | integer | 適用したリマインド基準日数（外部設定値） |
| total | integer | 条件に合致する総件数 |
| page | integer | 現在のページ番号 |
| per_page | integer | 1 ページ件数 |
| items | StaffUpcomingDueItem[] | 期限接近貸出の配列 |
| items[].loan_id | string | 貸出ID |
| items[].book_id | string | 書籍ID |
| items[].book_title | string | 書籍のタイトル |
| items[].author | string | 書籍の著者 |
| items[].user_no | string | 利用者番号 |
| items[].user_name | string | 利用者の氏名（司書ロール向け API のみ返す。arch LR-003） |
| items[].loan_date | string(date) | 貸出日 |
| items[].loan_period_type | string | 貸出期間区分（標準 / 短期 / 長期） |
| items[].due_date | string(date) | 返却期限 |
| items[].days_remaining | integer | 残日数（`due_date - base_date`） |
| items[].loan_status | string | 貸出状態（本 API では常に `貸出中`） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `timing_type` がバリエーション「通知タイミング区分」の値でない | `{"code":"INVALID_TIMING_TYPE","message":"通知タイミング区分の値が不正です"}` |
| 400 | `base_date` が日付形式でない、`page` / `per_page` が範囲外 | `{"code":"INVALID_PARAMETER","message":"パラメータの値が不正です"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |
| 500 | データストア障害等の技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

## 非同期イベント（該当する場合）

本 UC のバックエンド API は非同期イベントを発行・購読しない。返却期限リマインド送信要求の publish は tier-worker が担う（[tier-worker.md](tier-worker.md)）。

## データモデル変更

### loans（情報: 貸出 / E-004）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID（PK） | 変更なし（参照のみ） |
| book_id | VARCHAR | 貸出対象の書籍ID | 変更なし（参照のみ） |
| user_no | VARCHAR | 貸出先の利用者番号 | 変更なし（参照のみ） |
| loan_date | DATE | 貸出日 | 変更なし（参照のみ） |
| loan_period_type | VARCHAR | 貸出期間区分 | 変更なし（参照のみ） |
| due_date | DATE | 返却期限。抽出条件の主キー的な検索軸 | 変更なし（参照のみ） |
| loan_status | VARCHAR | 貸出状態。`貸出中` のみを対象にする | 変更なし（参照のみ） |

インデックス: `(loan_status, due_date)` の複合インデックスを必要とする（本 UC と tier-worker の走査が同一のアクセスパターンを持つため）。

### books（情報: 書籍 / E-001）・users（情報: 利用者 / E-002）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| books.title / books.author | VARCHAR | 一覧表示に JOIN で参照する | 変更なし（参照のみ） |
| users.name | VARCHAR | 司書向け一覧に表示する氏名。保管時暗号化の対象（NFR E.6.1.1） | 変更なし（参照のみ） |

## ビジネスルール

- リマインド通知対象条件: 貸出状態が「貸出中」であり、かつ `0 <= (due_date - base_date) <= remind_days` を満たす貸出のみを返す
- 通知タイミング区分は残日数で決まる。`timing_type = 期限前リマインド` のとき `1 <= (due_date - base_date) <= remind_days`、`timing_type = 期限当日` のとき `due_date = base_date` の貸出のみを返す（spec.md 計算ルール一覧「通知タイミング区分の決定」と同一定義）
- 貸出状態が「返却済み」「延滞」の貸出は返さない（返却済みは対象外、延滞は督促通知対象条件が扱う）
- `remind_days` は外部設定から読み込む（既定 3 日）。API はレスポンスに適用値を含め、画面が判定根拠を提示できるようにする
- 利用者の氏名・連絡先を返すのは司書ロール向け API に限る（arch LR-003 レスポンスの PII 最小化）。連絡先（メールアドレス）は本 API では返さない
- Query 系ユースケースとして domain を経由せず repository の読み取り専用 finder を直接利用する（arch LP-008）
- 本人限定参照の判定は行わない（司書は全利用者の貸出を対象とするため。条件「個人情報参照可否条件」は利用者向け API に適用する）
- 照会（本人限定参照以外の一覧照会）も監査ログの対象とし、`user_id`・役割・検索条件を構造化ログへ INFO で記録する（arch LP-006）

## ティア完了条件（BDD）

```gherkin
Feature: 返却期限接近の貸出を判定する - バックエンド API

  Scenario: 期限前リマインド区分で期限接近の貸出を返す
    Given 貸出「L-1001」が貸出状態「貸出中」・返却期限「2026-09-05」で登録されている
    And リマインド基準日数が「3」に設定されている
    When 司書トークンで GET /api/v1/staff/duedates/upcoming?timing_type=期限前リマインド&base_date=2026-09-02 を呼び出す
    Then HTTP 200 が返り items に loan_id「L-1001」と days_remaining「3」が含まれる

  Scenario: 期限当日区分では返却期限が基準日と一致する貸出だけを返す
    Given 貸出「L-1002」の返却期限が「2026-09-02」で貸出状態が「貸出中」である
    And 貸出「L-1001」の返却期限が「2026-09-05」で貸出状態が「貸出中」である
    When 司書トークンで GET /api/v1/staff/duedates/upcoming?timing_type=期限当日&base_date=2026-09-02 を呼び出す
    Then HTTP 200 が返り items は loan_id「L-1002」の 1 件のみになる

  Scenario: 返却済みの貸出を返さない
    Given 貸出「L-1003」が貸出状態「返却済み」・返却期限「2026-09-03」で登録されている
    When 司書トークンで GET /api/v1/staff/duedates/upcoming?base_date=2026-09-02 を呼び出す
    Then HTTP 200 が返り items に loan_id「L-1003」は含まれない

  Scenario: 通知タイミング区分の許容値以外を拒否する
    Given 司書「山田司書」がログイン済みである
    When 司書トークンで GET /api/v1/staff/duedates/upcoming?timing_type=期限超過督促 を呼び出す
    Then HTTP 400 が返り code「INVALID_TIMING_TYPE」が返却される

  Scenario: 利用者ロールのトークンでは到達できない
    Given 利用者「田中太郎」のアクセストークンを保持している
    When 利用者トークンで GET /api/v1/staff/duedates/upcoming を呼び出す
    Then HTTP 403 が返り code「FORBIDDEN」が返却される
```
