# 自分の延滞中の貸出を照会する - バックエンド API 仕様

## 変更概要

ログイン中の利用者本人の延滞中の貸出を返す読み取り専用エンドポイントを追加する。所有者ベースの認可判定（個人情報参照可否条件）は domain 層に集約し、レスポンスには本人の貸出情報のみを含める。

## API 仕様

### 自分の延滞中の貸出一覧の取得

- **メソッド**: GET
- **パス**: `/api/v1/me/loans/overdue`
- **認証**: 外部マネージド IdP 発行のアクセストークン（Bearer）。API Gateway で検証済みのクレームから `user_id`・役割・利用者番号を取り出して認証コンテキストを確立する（arch LP-003）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/loans/overdue.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| page | integer | No | ページ番号（1 始まり）。既定 1 |
| per_page | integer | No | 1 ページ件数。既定 20、最大 100 |

利用者番号はリクエストパラメータで受け取らない。認証コンテキストから解決する。

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| base_date | string(date) | 超過日数の算出基準日（サーバのシステム日付） |
| total | integer | 本人の延滞貸出の総件数（＝返却対象の冊数） |
| page | integer | 現在のページ番号 |
| per_page | integer | 1 ページ件数 |
| items | MyOverdueLoanItem[] | 延滞貸出の配列（超過日数の降順） |
| items[].loan_id | string | 貸出ID |
| items[].book_id | string | 書籍ID |
| items[].book_title | string | 書籍のタイトル |
| items[].author | string | 書籍の著者 |
| items[].loan_date | string(date) | 貸出日 |
| items[].loan_period_type | string | 貸出期間区分（標準 / 短期 / 長期） |
| items[].due_date | string(date) | 返却期限 |
| items[].days_overdue | integer | 超過日数（`base_date - due_date`） |
| items[].loan_status | string | 貸出状態（本 API では常に `延滞`） |

利用者の氏名・連絡先・利用者番号はレスポンスに含めない（arch LR-003 レスポンスの PII 最小化）。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `page` / `per_page` が範囲外 | `{"code":"INVALID_PARAMETER","message":"パラメータの値が不正です"}` |
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
| due_date | DATE | 返却期限。超過日数の算出とソート軸 | 変更なし（参照のみ） |
| loan_status | VARCHAR | 貸出状態。`延滞` のみを対象にする | 変更なし（参照のみ） |

インデックス: `(user_no, loan_status, due_date)` の複合インデックスを必要とする（本人限定 + 貸出状態 + 期限のソート。「自分の返却期限を照会する」と共通）。

### books（情報: 書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| title / author | VARCHAR | 一覧表示に JOIN で参照する | 変更なし（参照のみ） |

## ビジネスルール

- 個人情報参照可否条件: 照会対象はログイン中の利用者本人に紐づく貸出のみとする。他の利用者の貸出は返さない
- 所有者ベースの認可判定は domain 層で行う。presentation 層では役割による粗粒度の到達可否のみを判定する（arch LP-003 / CTP-002）
- 検索条件の `user_no` は必ず認証コンテキストから供給する。リクエストで受け取らない
- 貸出状態が「延滞」の貸出のみを返す。「貸出中」「返却済み」は返さない
- 超過日数は `base_date - due_date` で算出し、並び順は超過日数の降順（返却期限の昇順）とする
- `total` は本人の延滞貸出の総件数であり、画面の「返却対象の冊数」として使う
- 本人限定参照の照会は監査ログの対象とし、`user_id`・利用者番号・照会条件を構造化ログへ INFO で記録する（arch LP-006 / NFR E.7.1.1）
- Query 系ユースケースとして repository の読み取り専用 finder を利用する。所有者判定は domain のポリシーとして適用する（arch LP-008）

## ティア完了条件（BDD）

```gherkin
Feature: 自分の延滞中の貸出を照会する - バックエンド API

  Scenario: 本人の延滞貸出を超過日数つきで返す
    Given 利用者「田中太郎」（利用者番号 U-0001）の貸出「L-3001」が貸出状態「延滞」・返却期限「2026-09-01」である
    When 田中太郎のアクセストークンで GET /api/v1/me/loans/overdue を呼び出す
    Then HTTP 200 が返り items に loan_id「L-3001」と days_overdue「1」が含まれる

  Scenario: 他の利用者の延滞貸出を返さない
    Given 利用者「佐藤花子」（利用者番号 U-0002）の貸出「L-3009」が貸出状態「延滞」である
    When 田中太郎のアクセストークンで GET /api/v1/me/loans/overdue を呼び出す
    Then HTTP 200 が返り items に loan_id「L-3009」は含まれない

  Scenario: 返却済みの貸出を返さない
    Given 利用者「田中太郎」の貸出「L-3002」が貸出状態「返却済み」・返却期限「2026-08-30」である
    When 田中太郎のアクセストークンで GET /api/v1/me/loans/overdue を呼び出す
    Then HTTP 200 が返り items に loan_id「L-3002」は含まれない

  Scenario: 超過日数の降順で返す
    Given 利用者「田中太郎」の貸出「L-3001」の返却期限が「2026-08-20」、貸出「L-3003」の返却期限が「2026-08-30」でいずれも延滞である
    When 田中太郎のアクセストークンで GET /api/v1/me/loans/overdue を呼び出す
    Then items[0].loan_id が「L-3001」、items[1].loan_id が「L-3003」になる

  Scenario: レスポンスに個人情報を含めない
    Given 利用者「田中太郎」の延滞貸出が 1 件存在する
    When 田中太郎のアクセストークンで GET /api/v1/me/loans/overdue を呼び出す
    Then レスポンスに氏名・連絡先・利用者番号のフィールドが含まれない

  Scenario: 未認証のリクエストを拒否する
    Given アクセストークンを付与していない
    When GET /api/v1/me/loans/overdue を呼び出す
    Then HTTP 401 が返り code「UNAUTHENTICATED」が返却される
```
