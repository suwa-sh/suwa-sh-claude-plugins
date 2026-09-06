# 自分の返却期限を照会する - バックエンド API 仕様

## 変更概要

ログイン中の利用者本人の期限接近貸出を返す読み取り専用エンドポイントを追加する。所有者ベースの認可判定（個人情報参照可否条件）は domain 層に集約し、レスポンスには本人の情報のみを含める。

## API 仕様

### 自分の返却期限一覧の取得

- **メソッド**: GET
- **パス**: `/api/v1/me/loans/due`
- **認証**: 外部マネージド IdP 発行のアクセストークン（Bearer）。API Gateway で検証済みのクレームから `user_id`・役割・利用者番号を取り出して認証コンテキストを確立する（arch LP-003）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/loans/due.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| timing_type | string | No | 通知タイミング区分。`期限前リマインド` / `期限当日`。既定は `期限前リマインド` |
| page | integer | No | ページ番号（1 始まり）。既定 1 |
| per_page | integer | No | 1 ページ件数。既定 20、最大 100 |

利用者番号はリクエストパラメータで受け取らない。認証コンテキストから解決する（他利用者のデータを指定できないようにするため）。

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| base_date | string(date) | 判定基準日（サーバのシステム日付） |
| timing_type | string | 適用した通知タイミング区分 |
| remind_days | integer | 適用したリマインド基準日数（外部設定値） |
| total | integer | 本人の対象貸出の総件数 |
| overdue_count | integer | 本人の貸出のうち貸出状態が「延滞」の件数（延滞画面への導線判断に使う） |
| page | integer | 現在のページ番号 |
| per_page | integer | 1 ページ件数 |
| items | MyDueLoanItem[] | 期限接近貸出の配列 |
| items[].loan_id | string | 貸出ID |
| items[].book_id | string | 書籍ID |
| items[].book_title | string | 書籍のタイトル |
| items[].author | string | 書籍の著者 |
| items[].loan_date | string(date) | 貸出日 |
| items[].loan_period_type | string | 貸出期間区分（標準 / 短期 / 長期） |
| items[].due_date | string(date) | 返却期限 |
| items[].days_remaining | integer | 残日数（`due_date - base_date`） |
| items[].loan_status | string | 貸出状態（本 API では常に `貸出中`） |

利用者の氏名・連絡先・利用者番号はレスポンスに含めない（本人の貸出のみを返す利用者向け API のため。arch LR-003 レスポンスの PII 最小化）。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `timing_type` がバリエーション「通知タイミング区分」の値でない、`page` / `per_page` が範囲外 | `{"code":"INVALID_PARAMETER","message":"パラメータの値が不正です"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 認証コンテキストに利用者番号が無い（利用者として紐づいていないアカウント） | `{"code":"FORBIDDEN","message":"この操作は利用者のみ実行できます"}` |
| 500 | データストア障害等の技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

## 非同期イベント（該当する場合）

本 UC は非同期イベントを発行・購読しない。

## データモデル変更

### loans（情報: 貸出 / E-004）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID（PK） | 変更なし（参照のみ） |
| book_id | VARCHAR | 書籍情報の JOIN キー | 変更なし（参照のみ） |
| user_no | VARCHAR | 本人限定参照の絞り込みキー | 変更なし（参照のみ） |
| loan_date | DATE | 貸出日 | 変更なし（参照のみ） |
| loan_period_type | VARCHAR | 貸出期間区分 | 変更なし（参照のみ） |
| due_date | DATE | 返却期限。期限接近の判定軸 | 変更なし（参照のみ） |
| loan_status | VARCHAR | 貸出状態。`貸出中` を対象、`延滞` を件数集計に使う | 変更なし（参照のみ） |

インデックス: `(user_no, loan_status, due_date)` の複合インデックスを必要とする（本人限定 + 貸出状態 + 期限の絞り込み）。

### books（情報: 書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| title / author | VARCHAR | 一覧表示に JOIN で参照する | 変更なし（参照のみ） |

## ビジネスルール

- 個人情報参照可否条件: 照会対象はログイン中の利用者本人に紐づく貸出のみとする。他の利用者の貸出は返さない
- 所有者ベースの認可判定は domain 層で行う。presentation 層では役割による粗粒度の到達可否のみを判定する（arch LP-003 / CTP-002）
- 検索条件の `user_no` は必ず認証コンテキストから供給する。リクエストで受け取らない
- 貸出状態が「貸出中」であり `0 <= (due_date - base_date) <= remind_days` を満たす貸出のみを返す。`timing_type = 期限当日` では `due_date = base_date` に限定する
- 貸出状態が「延滞」の貸出は `items` に含めず `overdue_count` にのみ計上する（延滞は「自分の延滞中の貸出を照会する」が扱う）
- 貸出状態が「返却済み」の貸出は返さない
- 本人限定参照の照会は監査ログの対象とし、`user_id`・利用者番号・照会条件を構造化ログへ INFO で記録する（arch LP-006 / NFR E.7.1.1）
- Query 系ユースケースとして domain の集約を経由せず repository の読み取り専用 finder を利用する。ただし所有者判定は domain のポリシーとして適用する（arch LP-008 / LP-011 相当）

## ティア完了条件（BDD）

```gherkin
Feature: 自分の返却期限を照会する - バックエンド API

  Scenario: 本人の期限接近貸出を返す
    Given 利用者「田中太郎」（利用者番号 U-0001）の貸出「L-1001」が返却期限「2026-09-05」・貸出状態「貸出中」である
    And リマインド基準日数が「3」に設定されている
    When 田中太郎のアクセストークンで GET /api/v1/me/loans/due を呼び出す
    Then HTTP 200 が返り items に loan_id「L-1001」と days_remaining「3」が含まれる

  Scenario: 他の利用者の貸出を返さない
    Given 利用者「佐藤花子」（利用者番号 U-0002）の貸出「L-2001」が返却期限「2026-09-04」・貸出状態「貸出中」である
    When 田中太郎のアクセストークンで GET /api/v1/me/loans/due を呼び出す
    Then HTTP 200 が返り items に loan_id「L-2001」は含まれない

  Scenario: 延滞の貸出を件数だけ返す
    Given 利用者「田中太郎」の貸出「L-1004」の貸出状態が「延滞」である
    When 田中太郎のアクセストークンで GET /api/v1/me/loans/due を呼び出す
    Then HTTP 200 が返り overdue_count が 1 になり items に loan_id「L-1004」は含まれない

  Scenario: レスポンスに個人情報を含めない
    Given 利用者「田中太郎」の貸出が 1 件存在する
    When 田中太郎のアクセストークンで GET /api/v1/me/loans/due を呼び出す
    Then レスポンスに氏名・連絡先・利用者番号のフィールドが含まれない

  Scenario: 未認証のリクエストを拒否する
    Given アクセストークンを付与していない
    When GET /api/v1/me/loans/due を呼び出す
    Then HTTP 401 が返り code「UNAUTHENTICATED」が返却される

  Scenario: 通知タイミング区分の許容値以外を拒否する
    Given 田中太郎がログイン済みである
    When 田中太郎のアクセストークンで GET /api/v1/me/loans/due?timing_type=期限超過督促 を呼び出す
    Then HTTP 400 が返り code「INVALID_PARAMETER」が返却される
```
