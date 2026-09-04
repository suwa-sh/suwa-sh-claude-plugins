# 貸出履歴を参照する - Backend API仕様

## 変更概要

貸出コンテキスト（BC-003）に本人限定の貸出一覧 API（`/api/v1/me/loans`）を追加する。検索条件の利用者番号はトークンから取り出して固定し、クエリで他人の番号を指定できない（SP-016 / LP-007）。現在の貸出 / 履歴の切替、offset ページネーション（既定 20、上限 100）、返却期限の表示区分（現行リマインド日数に基づく）を返す。

## API 仕様

### 自分の貸出一覧

- **メソッド**: GET
- **パス**: `/api/v1/me/loans`
- **認証**: Bearer（IdP 発行トークン）、利用者区分「利用者」必須（司書は 403。司書は `/api/v1/users/{userNumber}/usage` を使う）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/loans.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| scope | string (query) | No | `current`（貸出中・延滞。既定）/ `history`（返却済み）/ `all` |
| page | integer (query) | No | ページ番号（1 始まり。既定 1） |
| pageSize | integer (query) | No | 1 ページ件数（既定 20、上限 100） |

#### レスポンス（200 `MyLoanPageResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | MyLoanItem[] | loanId, book(BookSummary), loanedOn, dueDate, returnedOn, status, remainingDays, dueStatus |
| page | integer | ページ番号 |
| pageSize | integer | 1 ページ件数 |
| totalCount | integer | 条件に合致する貸出の総件数 |
| today | string (date) | サーバ基準日（残日数の基準） |
| remindDays | integer | 現行のリマインド日数（DueDateIndicator の soon 判定） |
| overdueCount | integer | 本人の延滞件数（scope に依らない） |

`MyLoanItem.dueStatus`: `OK` / `SOON` / `OVERDUE` / `RETURNED`。`remainingDays` は `dueDate - today`（返却済みは null）。`returnedOn` は返却済みのときのみ。

#### エラーレスポンス（`application/problem+json`）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | scope が不正 / page < 1 / pageSize が 1〜100 の範囲外 / クエリに userNumber が含まれる | `{code: "VALIDATION_ERROR", errors: [{field, message}]}` |
| 401 | トークン無し・無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が「利用者」でない | `{code: "FORBIDDEN"}` |
| 429 | 公開経路のレート制限超過（API Gateway SP-010） | `{code: "RATE_LIMITED"}` + `Retry-After` |

## データモデル変更

### loans（貸出 E-004）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_number / current_status / loaned_on / due_date / book_id | — | 本人の貸出の取得条件と表示項目（参照のみ） | 参照のみ |

### loan_events（貸出イベント）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id / event_type / occurred_at | — | 返却日の導出（event_type = 'RETURNED'）（参照のみ） | 参照のみ |

### books（書籍 E-001）/ remind_days_settings（リマインド日数 E-006）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| books.title / author / media_type / current_status | — | 書籍要約（参照のみ） | 参照のみ |
| remind_days_settings.remind_days / valid_from / valid_to | — | 現行世代のリマインド日数（参照のみ） | 参照のみ |

## ビジネスルール

- 利用状況閲覧範囲判定: 検索条件の利用者番号はトークンの利用者番号に固定する。クエリ・本文で利用者番号を受け取らず、含まれていれば 400。利用者区分「司書」は 403（司書は UC「利用者の利用状況を参照する」で参照する）
- scope: `current` = 貸出の状態が「貸出中」「延滞」（返却期限昇順）、`history` = 「返却済み」（貸出日降順）、`all` = すべて（貸出日降順）
- 期限表示区分（DueDatePolicy）: 返却済み → `RETURNED`。`today > dueDate` → `OVERDUE`。`dueDate - today <= remindDays` → `SOON`。それ以外 → `OK`。`remindDays` は本日時点の有効世代（`valid_from <= today AND (valid_to IS NULL OR valid_to >= today)`）を使う（LR-004 / SR-012）。有効世代が無い場合は remindDays = 0 として `SOON` を出さない
- 返却日は返却イベント（loan_events.event_type = 'RETURNED'）の occurred_at の日付で導出する（arch E-004）
- 本日（`today`）はサーバの日付を返し、クライアントの時計に依存させない
- ページネーションは offset 方式。`pageSize` 既定 20、上限 100。`totalCount` を返す（SP-002）
- 貸出履歴は要配慮情報に準じる（NFR E.1.2.1 / E.6.1.1）。応答に氏名・連絡先を含めない。監査ログにデータ参照（E-004、本人）を記録する（SR-010）
- 参照系のため KVS キャッシュの対象にしてよい（LP-017）が、貸出の状態遷移（登録・返却・延滞判定）で当該利用者のキャッシュを無効化する

## ティア完了条件（BDD）

```gherkin
Feature: 貸出履歴を参照する - Backend API

  Scenario: 本人の現在の貸出を返す
    Given 利用者「U-000123」の貸出「L-0001」が「貸出中」（返却期限 2026-09-17）、「L-0003」が「延滞」（返却期限 2026-08-31）
    And 利用者「U-000300」の貸出「L-0002」が「貸出中」
    And 現行のリマインド日数が 3 日で本日が 2026-09-10
    When 利用者「U-000123」のトークンで GET /api/v1/me/loans を送る
    Then HTTP 200 で items が 2 件（L-0003, L-0001 の順）、totalCount 2、today "2026-09-10"、remindDays 3、overdueCount 1 が返る
    And items に「L-0002」は含まれない
    And L-0001 の remainingDays 7、dueStatus "OK"、L-0003 の remainingDays -10、dueStatus "OVERDUE" が返る

  Scenario: 履歴を返却日つきで返す
    Given 利用者「U-000123」の貸出「L-0000」が「返却済み」で返却イベントの occurred_at が 2026-08-10 14:00
    When 利用者「U-000123」のトークンで GET /api/v1/me/loans?scope=history を送る
    Then HTTP 200 で items[0].loanId "L-0000"、returnedOn "2026-08-10"、dueStatus "RETURNED" が返る

  Scenario: リマインド日数以内は soon を返す
    Given 利用者「U-000123」の貸出「L-0004」が「貸出中」（返却期限 2026-09-12）で本日が 2026-09-10、リマインド日数が 3 日
    When 利用者「U-000123」のトークンで GET /api/v1/me/loans を送る
    Then items[0].remainingDays 2、dueStatus "SOON" が返る

  Scenario: クエリで他人の利用者番号を指定しても無視されず 400 を返す
    Given 利用者「U-000123」のトークンを持つ
    When GET /api/v1/me/loans?userNumber=U-000300 を送る
    Then HTTP 400 で problem+json の code "VALIDATION_ERROR" と errors[0].field "userNumber" が返る

  Scenario: 司書トークンでは 403 を返す
    Given 利用者区分「司書」のトークンを持つ
    When GET /api/v1/me/loans を送る
    Then HTTP 403 で code "FORBIDDEN" が返る

  Scenario: pageSize の上限を超えると 400 を返す
    Given 利用者「U-000123」のトークンを持つ
    When GET /api/v1/me/loans?pageSize=101 を送る
    Then HTTP 400 で code "VALIDATION_ERROR" と errors[0].field "pageSize" が返る
```
