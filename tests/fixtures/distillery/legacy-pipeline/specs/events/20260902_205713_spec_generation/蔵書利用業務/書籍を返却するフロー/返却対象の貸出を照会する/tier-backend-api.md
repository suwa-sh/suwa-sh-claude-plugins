# 返却対象の貸出を照会する - バックエンド API 仕様

## 変更概要

本人の返却対象の貸出を一覧で返す参照系 API `GET /api/v1/me/loans` を追加する（`returnable=true` で貸出状態が「貸出中」「延滞」に絞り込む）。認証コンテキストの利用者番号を必ず検索条件に含め、他の利用者の貸出を返さない（個人情報参照可否条件）。ページネーション（20 件/頁）で分割する。実装は貸出コンテキスト（BC-003）の集約 AG-003 を参照し、書籍情報は BC-001 から取得する。

## API 仕様

### 自分の貸出一覧を取得する（返却対象の絞り込み）

- **メソッド**: GET
- **パス**: `/api/v1/me/loans`
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `利用者` または `司書`（自分の貸出のみ）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/loans.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| returnable | boolean(query) | No | true のとき貸出状態が「貸出中」「延滞」の貸出だけに絞り込む。本 UC では true を指定する |
| status | string(query) | No | 貸出状態での絞り込み（貸出中 / 延滞 / 返却済み）。`returnable` と併用しない |
| page | integer(query) | No | ページ番号。既定 1、最小 1 |
| per_page | integer(query) | No | 1 ページの件数。既定 20、最大 20 |
| Authorization | string(header) | Yes | `Bearer {access_token}`。認証コンテキストから利用者番号を解決する |
| traceparent | string(header) | No | W3C Trace Context |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | array | 貸出の配列。各要素は `loan_id` / `loan_date` / `loan_period_type` / `due_date` / `days_remaining` / `loan_status` / `book`（`book_id` / `title` / `author`） |
| page | integer | 現在のページ番号 |
| per_page | integer | 1 ページの件数 |
| total | integer | 絞り込み条件に一致する総件数 |

`returnable=true` のとき、items は返却期限（due_date）の昇順で返す。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | page が 1 未満、per_page が 1 未満または 20 超過、status がバリエーション外の値 | `{"code":"INVALID_REQUEST","message":"検索条件の指定が正しくありません"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |

該当件数が 0 件の場合は HTTP 200 に `items: []`、`total: 0` を返す（404 にはしない）。

## 非同期イベント（該当する場合）

本 UC は参照系のため非同期イベントを発行しない。

## データモデル変更

参照のみで、テーブル定義の変更はない。

### loans（E-004 貸出）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID（主キー） | 変更なし（SELECT） |
| book_id | VARCHAR | 貸出対象の書籍ID。書籍情報の結合キー | 変更なし（SELECT） |
| user_no | VARCHAR | 貸出先の利用者番号。本人限定参照の絞り込み条件 | 変更なし（SELECT） |
| loan_date | DATE | 貸出日 | 変更なし（SELECT） |
| loan_period_type | VARCHAR | 貸出期間区分（標準 / 短期 / 長期） | 変更なし（SELECT） |
| due_date | DATE | 返却期限。並び順のキーかつ残日数の算出基準 | 変更なし（SELECT） |
| loan_status | VARCHAR | 貸出状態。返却対象は「貸出中」「延滞」 | 変更なし（SELECT） |

### books（E-001 書籍）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（主キー） | 変更なし（SELECT） |
| title | VARCHAR | タイトル | 変更なし（SELECT） |
| author | VARCHAR | 著者 | 変更なし（SELECT） |

## ビジネスルール

- 個人情報参照可否条件: `loans` の検索条件に必ず認証コンテキストの `user_no` を含める。クエリパラメータで他の利用者番号を指定する経路は提供しない。
- 返却対象の定義: 貸出状態が「貸出中」または「延滞」の貸出を返却対象とする。貸出状態が「返却済み」の貸出は `returnable=true` の結果に含めない（返却済みは進行中の取引ではないため）。
- 所有者ベースの認可判定（LP-011）: 一覧の各要素が認証コンテキストの利用者に紐づくことを domain 層で強制する。
- 残日数の算出: `days_remaining = due_date - 参照日（サーバのシステム日付、JST）`。負値は超過日数を表す。クライアントの端末日時に依存させない。
- 並び順: `returnable=true` のとき返却期限の昇順で返す。超過している貸出が先頭に来ることで、返却の優先度が読み取れる。
- ページネーション（NFR B.1.1.1 / B.2.1.1 の性能目標に対する設計）: `per_page` の上限を 20 件とし、`total` を返す。無限スクロール向けのカーソル API は提供しない。
- 書籍情報は `book_id IN (:book_ids)` の一括取得で解決し、行ごとの N+1 クエリを行わない。
- レスポンスの PII 最小化（LR-003）: 利用者の氏名・連絡先はレスポンスに含めない。
- 参照系のため監査ログは出力せず、アクセスログのみを presentation 層で出力する（LP-002 / LP-006）。domain 層はログを出力しない（LP-010）。

## ティア完了条件（BDD）

```gherkin
Feature: 返却対象の貸出を照会する - バックエンド API

  Scenario: 本人の返却対象の貸出だけを返却期限の昇順で返す
    Given 貸出 "L-000003"（利用者番号 "U-000123"、返却期限 2026-08-30、貸出状態 "延滞"）が存在する
    And 貸出 "L-000001"（利用者番号 "U-000123"、返却期限 2026-09-16、貸出状態 "貸出中"）が存在する
    And 貸出 "L-000009"（利用者番号 "U-000456"、貸出状態 "貸出中"）が存在する
    And サーバのシステム日付が 2026-09-02 である
    When 利用者「田中太郎」（利用者番号 "U-000123"）のトークンで GET /api/v1/me/loans?returnable=true を呼び出す
    Then HTTP 200 が返り、total が 2 である
    And items[0].loan_id が "L-000003" で days_remaining が -3 である
    And items[1].loan_id が "L-000001" で days_remaining が 14 である
    And items に "L-000009" は含まれない

  Scenario: 返却済みの貸出は返却対象に含まれない
    Given 貸出 "L-000004"（利用者番号 "U-000123"、貸出状態 "返却済み"）だけが存在する
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans?returnable=true を呼び出す
    Then HTTP 200 が返り、total が 0 で items が空配列である

  Scenario: 21 件以上の返却対象はページネーションで分割して返す
    Given 利用者番号 "U-000123" に貸出状態 "貸出中" の貸出が 25 件存在する
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans?returnable=true&page=1&per_page=20 を呼び出す
    Then HTTP 200 が返り、items が 20 件、total が 25、page が 1 である

  Scenario: per_page の上限を超える指定は 400 を返す
    Given 利用者「田中太郎」のトークンが有効である
    When GET /api/v1/me/loans?returnable=true&per_page=100 を呼び出す
    Then HTTP 400 が返り、code が "INVALID_REQUEST" である

  Scenario: 無効なトークンでは 401 を返す
    Given 期限切れのアクセストークンを保持している
    When GET /api/v1/me/loans?returnable=true を呼び出す
    Then HTTP 401 が返り、code が "UNAUTHENTICATED" である

  Scenario: レスポンスに利用者の個人情報を含めない
    Given 貸出 "L-000001" が利用者番号 "U-000123" に紐づいて存在する
    When 利用者「田中太郎」のトークンで GET /api/v1/me/loans?returnable=true を呼び出す
    Then HTTP 200 が返る
    And items の各要素に氏名（name）と連絡先（email）のフィールドが含まれない
```
