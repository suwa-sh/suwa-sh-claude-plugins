# 自分の返却済み貸出を照会する - バックエンド API 仕様

## 変更概要

本人の返却済み貸出を一覧で返す参照系 API を追加する。`GET /api/v1/me/loans?status=返却済み` で貸出状態が「返却済み」の貸出に絞り込み、返却日の降順で返す。認証コンテキストの利用者番号を必ず検索条件に含め、他の利用者の貸出を返さない（個人情報参照可否条件）。実装は貸出コンテキスト（BC-003）の集約 AG-003 を参照し、書籍情報は BC-001 から取得する。

本 API は「返却対象の貸出を照会する」と同じエンドポイント（`GET /api/v1/me/loans`）を `status` パラメータで使い分ける。

## API 仕様

### 自分の貸出一覧を取得する（返却済みの絞り込み）

- **メソッド**: GET
- **パス**: `/api/v1/me/loans`
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `利用者` または `司書`（自分の貸出のみ）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/loans.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| status | string(query) | No | 貸出状態での絞り込み（貸出中 / 延滞 / 返却済み）。本 UC では `返却済み` を指定する |
| returnable | boolean(query) | No | true のとき貸出中・延滞に絞り込む。`status` と併用しない |
| page | integer(query) | No | ページ番号。既定 1、最小 1 |
| per_page | integer(query) | No | 1 ページの件数。既定 20、最大 20 |
| Authorization | string(header) | Yes | `Bearer {access_token}`。認証コンテキストから利用者番号を解決する |
| traceparent | string(header) | No | W3C Trace Context |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | array | 貸出の配列。各要素は `loan_id` / `loan_date` / `loan_period_type` / `due_date` / `returned_at` / `overdue_days` / `loan_status` / `book`（`book_id` / `title` / `author`） |
| page | integer | 現在のページ番号 |
| per_page | integer | 1 ページの件数 |
| total | integer | 絞り込み条件に一致する総件数 |
| latest_returned_at | string(date) | `status=返却済み` のときのみ。直近の返却日。0 件のときは null |

`status=返却済み` のとき、items は返却日（returned_at）の降順で返す。`returned_at` と `overdue_days` は貸出状態が「返却済み」の要素にのみ設定する。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | status がバリエーション（貸出中 / 延滞 / 返却済み）外、page が 1 未満、per_page が 1 未満または 20 超過 | `{"code":"INVALID_REQUEST","message":"検索条件の指定が正しくありません"}` |
| 400 | status と returnable を同時に指定した | `{"code":"INVALID_REQUEST","message":"status と returnable は同時に指定できません"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |

該当件数が 0 件の場合は HTTP 200 に `items: []`、`total: 0`、`latest_returned_at: null` を返す（404 にはしない）。

## 非同期イベント（該当する場合）

本 UC は参照系のため非同期イベントを発行しない。

## データモデル変更

参照のみで、テーブル定義の変更はない（`returned_at` 列の追加は「返却を登録する」で行う）。

### loans（E-004 貸出）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID（主キー） | 変更なし（SELECT） |
| book_id | VARCHAR | 貸出対象の書籍ID。書籍情報の結合キー | 変更なし（SELECT） |
| user_no | VARCHAR | 貸出先の利用者番号。本人限定参照の絞り込み条件 | 変更なし（SELECT） |
| loan_date | DATE | 貸出日 | 変更なし（SELECT） |
| loan_period_type | VARCHAR | 貸出期間区分（標準 / 短期 / 長期） | 変更なし（SELECT） |
| due_date | DATE | 返却期限。超過日数の算出基準 | 変更なし（SELECT） |
| returned_at | DATE | 返却日。並び順のキーかつ超過日数の算出基準 | 変更なし（SELECT） |
| loan_status | VARCHAR | 貸出状態。本 UC の対象は「返却済み」 | 変更なし（SELECT） |

### books（E-001 書籍）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（主キー） | 変更なし（SELECT） |
| title | VARCHAR | タイトル | 変更なし（SELECT） |
| author | VARCHAR | 著者 | 変更なし（SELECT） |

## ビジネスルール

- 個人情報参照可否条件: `loans` の検索条件に必ず認証コンテキストの `user_no` を含める。クエリパラメータで他の利用者番号を指定する経路は提供しない。貸出履歴は読書傾向を推知しうる機微情報のため、本人以外へは一切返さない。
- 照会対象の定義: `status=返却済み` のとき、貸出状態が「返却済み」の貸出のみを返す。貸出状態が「貸出中」「延滞」の貸出は含めない。
- 所有者ベースの認可判定（LP-011）: 一覧の各要素が認証コンテキストの利用者に紐づくことを domain 層で強制する。
- 超過日数の算出: `overdue_days = max(0, returned_at - due_date)`。期限内返却は 0 とする。
- 並び順: `status=返却済み` のとき返却日の降順で返す。直近の返却完了が先頭に来る。
- ページネーション（NFR B.1.1.1 / B.2.1.1 の性能目標に対する設計）: `per_page` の上限を 20 件とし、`total` を返す。返却済みの貸出は年々蓄積されるため、全件返却は行わない。
- 書籍情報は `book_id IN (:book_ids)` の一括取得で解決し、行ごとの N+1 クエリを行わない。
- レスポンスの PII 最小化（LR-003）: 利用者の氏名・連絡先はレスポンスに含めない。
- 参照系のため監査ログは出力せず、アクセスログのみを presentation 層で出力する（LP-002 / LP-006）。domain 層はログを出力しない（LP-010）。
- 本 UC は状態遷移を発生させない。返却済みの貸出は過去の貸出履歴・貸出統計の集計対象として保持され続ける。

## ティア完了条件（BDD）

```gherkin
Feature: 自分の返却済み貸出を照会する - バックエンド API

  Scenario: 本人の返却済み貸出だけを返却日の降順で返す
    Given 貸出 "L-000001"（利用者番号 "U-000123"、返却日 2026-09-10、貸出状態 "返却済み"）が存在する
    And 貸出 "L-000002"（利用者番号 "U-000123"、返却日 2026-08-20、貸出状態 "返却済み"）が存在する
    And 貸出 "L-000009"（利用者番号 "U-000456"、貸出状態 "返却済み"）が存在する
    When 利用者「田中太郎」（利用者番号 "U-000123"）のトークンで GET /api/v1/me/loans?status=返却済み を呼び出す
    Then HTTP 200 が返り、total が 2 である
    And items[0].loan_id が "L-000001"、items[1].loan_id が "L-000002" である
    And items に "L-000009" は含まれない
    And latest_returned_at が "2026-09-10" である

  Scenario: 貸出中の貸出は返却済みの絞り込みに含まれない
    Given 貸出 "L-000004"（利用者番号 "U-000123"、貸出状態 "貸出中"）だけが存在する
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans?status=返却済み を呼び出す
    Then HTTP 200 が返り、total が 0 で items が空配列である
    And latest_returned_at が null である

  Scenario: 延滞返却の超過日数が返る
    Given 貸出 "L-000003"（利用者番号 "U-000123"、返却期限 2026-08-30、返却日 2026-09-02、貸出状態 "返却済み"）が存在する
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans?status=返却済み を呼び出す
    Then HTTP 200 が返り、items[0].overdue_days が 3 である

  Scenario: 期限内返却の超過日数は 0 になる
    Given 貸出 "L-000001"（利用者番号 "U-000123"、返却期限 2026-09-16、返却日 2026-09-10、貸出状態 "返却済み"）が存在する
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans?status=返却済み を呼び出す
    Then HTTP 200 が返り、items[0].overdue_days が 0 である

  Scenario: 21 件以上の返却済み貸出はページネーションで分割して返す
    Given 利用者番号 "U-000123" に貸出状態 "返却済み" の貸出が 25 件存在する
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans?status=返却済み&page=1&per_page=20 を呼び出す
    Then HTTP 200 が返り、items が 20 件、total が 25、page が 1 である

  Scenario: 不正な status 値は 400 を返す
    Given 利用者「田中太郎」のトークンが有効である
    When GET /api/v1/me/loans?status=完了 を呼び出す
    Then HTTP 400 が返り、code が "INVALID_REQUEST" である

  Scenario: status と returnable の同時指定は 400 を返す
    Given 利用者「田中太郎」のトークンが有効である
    When GET /api/v1/me/loans?status=返却済み&returnable=true を呼び出す
    Then HTTP 400 が返り、code が "INVALID_REQUEST" である

  Scenario: レスポンスに利用者の個人情報を含めない
    Given 貸出 "L-000001" が利用者番号 "U-000123" に紐づいて存在する
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans?status=返却済み を呼び出す
    Then HTTP 200 が返る
    And items の各要素に氏名（name）と連絡先（email）のフィールドが含まれない
```
