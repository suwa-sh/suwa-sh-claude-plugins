# 自分の貸出内容と返却期限を照会する - バックエンド API 仕様

## 変更概要

本人の貸出詳細を返す参照系 API `GET /api/v1/me/loans/{loanId}` を追加する。認証コンテキストの利用者番号を必ず検索条件に含め、他の利用者の貸出を返さない（個人情報参照可否条件）。返却期限までの残日数をサーバ側で算出して返す。実装は貸出コンテキスト（BC-003）の集約 AG-003 を参照し、書籍情報は BC-001 から取得する。

## API 仕様

### 自分の貸出詳細を取得する

- **メソッド**: GET
- **パス**: `/api/v1/me/loans/{loanId}`
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `利用者` または `司書`（自分の貸出のみ）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/loans/{loanId}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| loanId | string(path) | Yes | 照会する貸出ID |
| Authorization | string(header) | Yes | `Bearer {access_token}`。認証コンテキストから利用者番号を解決する |
| traceparent | string(header) | No | W3C Trace Context |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| loan_id | string | 貸出ID |
| loan_date | string(date) | 貸出日 |
| loan_period_type | string | 貸出期間区分（標準 / 短期 / 長期） |
| due_date | string(date) | 返却期限 |
| days_remaining | integer | 返却期限までの残日数。0 は期限当日、負値は超過日数 |
| loan_status | string | 貸出状態（貸出中 / 延滞 / 返却済み） |
| book | object | 貸出対象の書籍。`book_id` / `title` / `author` / `isbn` / `publisher` / `genre` / `material_type` |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 404 | 指定された貸出が存在しない、または認証コンテキストの利用者に紐づかない | `{"code":"LOAN_NOT_FOUND","message":"該当する貸出が見つかりません"}` |

他の利用者の貸出は 403 ではなく 404 で返す。403 は貸出の存在自体を推測させるため、本人限定参照の観点で見つからない扱いに統一する。

## 非同期イベント（該当する場合）

本 UC は参照系のため非同期イベントを発行しない。

## データモデル変更

参照のみで、テーブル定義の変更はない。

### loans（E-004 貸出）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID（主キー）。照会のキー | 変更なし（SELECT） |
| book_id | VARCHAR | 貸出対象の書籍ID。書籍情報の結合キー | 変更なし（SELECT） |
| user_no | VARCHAR | 貸出先の利用者番号。本人限定参照の絞り込み条件 | 変更なし（SELECT） |
| loan_date | DATE | 貸出日 | 変更なし（SELECT） |
| loan_period_type | VARCHAR | 貸出期間区分（標準 / 短期 / 長期） | 変更なし（SELECT） |
| due_date | DATE | 返却期限。残日数の算出基準 | 変更なし（SELECT） |
| loan_status | VARCHAR | 貸出状態（貸出中 / 延滞 / 返却済み） | 変更なし（SELECT） |

### books（E-001 書籍）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（主キー） | 変更なし（SELECT） |
| title | VARCHAR | タイトル | 変更なし（SELECT） |
| author | VARCHAR | 著者 | 変更なし（SELECT） |
| isbn | VARCHAR | ISBN | 変更なし（SELECT） |
| publisher | VARCHAR | 出版社 | 変更なし（SELECT） |
| genre | VARCHAR | ジャンル | 変更なし（SELECT） |
| material_type | VARCHAR | 資料種別 | 変更なし（SELECT） |

## ビジネスルール

- 個人情報参照可否条件: `loans` の検索条件に必ず認証コンテキストの `user_no` を含める。パス・クエリで他の利用者番号を指定する経路は提供しない。
- 所有者ベースの認可判定（LP-011）: 貸出の `user_no` と認証コンテキストの利用者番号が一致することを domain 層で強制する。presentation 層・view 層の表示制御は補助であり、実際の制約は domain 層が担保する。
- 残日数の算出: `days_remaining = due_date - 参照日（サーバのシステム日付、JST）`。クライアントの端末日時に依存させない。
- 貸出状態が「返却済み」の貸出も本 API で取得できる。返却済みの場合 `days_remaining` は返却期限と参照日の差を返し、画面側は LoanStatusBadge の「返却済み」を優先表示する。
- レスポンスの PII 最小化（LR-003）: 利用者の氏名・連絡先はレスポンスに含めない。
- 参照系のため監査ログは出力せず、アクセスログのみを presentation 層で出力する（LP-002 / LP-006）。domain 層はログを出力しない（LP-010）。
- 本 UC は状態遷移を発生させない。「貸出中 → 延滞」の遷移は別 UC「期限超過の貸出を延滞にする」が担う。

## ティア完了条件（BDD）

```gherkin
Feature: 自分の貸出内容と返却期限を照会する - バックエンド API

  Scenario: 本人の貸出詳細を返却期限つきで取得できる
    Given 貸出 "L-000001"（利用者番号 "U-000123"、書籍ID "B-000001"、貸出日 2026-09-02、貸出期間区分 "標準"、返却期限 2026-09-16、貸出状態 "貸出中"）が存在する
    And 利用者「田中太郎」（利用者番号 "U-000123"）のアクセストークンが有効である
    And サーバのシステム日付が 2026-09-02 である
    When GET /api/v1/me/loans/L-000001 を呼び出す
    Then HTTP 200 が返り、due_date が "2026-09-16"、days_remaining が 14、loan_status が "貸出中" である
    And book.title が "吾輩は猫である" である

  Scenario: 期限超過の貸出は残日数が負値で返る
    Given 貸出 "L-000003"（利用者番号 "U-000123"、返却期限 2026-08-30、貸出状態 "延滞"）が存在する
    And サーバのシステム日付が 2026-09-02 である
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans/L-000003 を呼び出す
    Then HTTP 200 が返り、days_remaining が -3、loan_status が "延滞" である

  Scenario: 他の利用者の貸出は 404 を返す
    Given 貸出 "L-000009" が利用者番号 "U-000456" に紐づいて存在する
    And 利用者「田中太郎」（利用者番号 "U-000123"）のアクセストークンが有効である
    When GET /api/v1/me/loans/L-000009 を呼び出す
    Then HTTP 404 が返り、code が "LOAN_NOT_FOUND" である
    And レスポンスに他の利用者の貸出内容は含まれない

  Scenario: 存在しない貸出IDは 404 を返す
    Given 貸出 "L-999999" が存在しない
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans/L-999999 を呼び出す
    Then HTTP 404 が返り、code が "LOAN_NOT_FOUND" である

  Scenario: 無効なトークンでは 401 を返す
    Given 期限切れのアクセストークンを保持している
    When GET /api/v1/me/loans/L-000001 を呼び出す
    Then HTTP 401 が返り、code が "UNAUTHENTICATED" である

  Scenario: レスポンスに利用者の個人情報を含めない
    Given 貸出 "L-000001" が利用者番号 "U-000123" に紐づいて存在する
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans/L-000001 を呼び出す
    Then HTTP 200 が返る
    And レスポンスに氏名（name）と連絡先（email）のフィールドが含まれない
```
