# 返却を登録する - バックエンド API 仕様

## 変更概要

返却登録 API `POST /api/v1/loans/{loanId}/return` と、司書向けの返却対象検索 API `GET /api/v1/loans` を追加する。返却登録は貸出状態を「貸出中 / 延滞 → 返却済み」へ遷移させ、返却日を記録する。延滞していた貸出は返却済みへの遷移により督促対象から外れる。同一トランザクション内で利用者の進行中取引を再評価し、他に進行中の貸出・予約が無ければ利用者状態を「登録済み」へ戻す。実装は貸出コンテキスト（BC-003）の集約 AG-003 に置く。

## API 仕様

### 返却対象の貸出を検索する（司書向け）

- **メソッド**: GET
- **パス**: `/api/v1/loans`
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `司書` のみ（RBAC）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id | string(query) | No | 書籍IDでの絞り込み。返却された書籍から対象貸出を特定する |
| user_no | string(query) | No | 利用者番号での絞り込み |
| status | string(query) | No | 貸出状態での絞り込み（貸出中 / 延滞 / 返却済み）。カンマ区切りで複数指定できる |
| page | integer(query) | No | ページ番号。既定 1 |
| per_page | integer(query) | No | 1 ページの件数。既定 20、最大 20 |
| Authorization | string(header) | Yes | `Bearer {access_token}`。司書ロールであること |

`book_id` と `user_no` のいずれか一方以上の指定を必須とする（全件走査を防ぐため）。

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | array | 貸出の配列。各要素は `loan_id` / `loan_date` / `loan_period_type` / `due_date` / `days_remaining` / `loan_status` / `book`（`book_id` / `title` / `author`） / `user`（`user_no` / `name`） |
| page | integer | 現在のページ番号 |
| per_page | integer | 1 ページの件数 |
| total | integer | 一致する総件数 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | book_id と user_no がいずれも未指定、または page / per_page / status が不正 | `{"code":"INVALID_REQUEST","message":"検索条件の指定が正しくありません"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 司書ロールではない | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |

### 返却を登録する

- **メソッド**: POST
- **パス**: `/api/v1/loans/{loanId}/return`
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `司書` のみ（RBAC）。館内ネットワークからのアクセスに限定する
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans/{loanId}/return.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| loanId | string(path) | Yes | 返却する貸出ID |
| X-Idempotency-Key | string(header) | Yes | 冪等キー（UUID）。再送時も同一キーを使う |
| Authorization | string(header) | Yes | `Bearer {access_token}`。司書ロールであること |
| traceparent | string(header) | No | W3C Trace Context |

リクエストボディは空オブジェクト（`{}`）とする。返却日はサーバのシステム日付で確定させ、クライアントから受け取らない。

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| loan_id | string | 返却した貸出ID |
| book_id | string | 返却された書籍ID。返却後の書籍状態更新に引き継ぐ |
| user_no | string | 貸出先の利用者番号 |
| loan_status | string | 遷移後の貸出状態。「返却済み」 |
| previous_loan_status | string | 遷移前の貸出状態（貸出中 / 延滞） |
| returned_at | string(date) | 返却日 |
| overdue_days | integer | 超過日数。期限内返却は 0 |
| user_status | string | 遷移後の利用者状態（登録済み / 取引進行中） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | X-Idempotency-Key が未指定 | `{"code":"IDEMPOTENCY_KEY_REQUIRED","message":"冪等キーが必要です"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 司書ロールではない | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 404 | 指定された貸出が存在しない | `{"code":"LOAN_NOT_FOUND","message":"該当する貸出が見つかりません"}` |
| 409 | 貸出状態が既に「返却済み」（遷移不可） | `{"code":"LOAN_ALREADY_RETURNED","message":"この貸出は既に返却済みです"}` |
| 409 | 他の窓口操作と競合し、楽観ロックのバージョンが一致しない | `{"code":"CONFLICT","message":"他の操作と競合しました。最新の状態を確認して再度お試しください"}` |

同一の X-Idempotency-Key による再送は、既処理として同じ返却結果を HTTP 200 で返す（返却日を上書きしない）。

## 非同期イベント（該当する場合）

本 UC は返却済みへの遷移により督促の対象から外れるが、督促の停止は「督促メールを送信する」側が貸出状態を条件に判定するため、本 UC からの明示的なイベント発行は行わない。返却後の書籍状態更新は後続 UC「返却後の書籍状態を更新する」を司書が実行する同期フローで行う。

## データモデル変更

### loans（E-004 貸出）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_status | VARCHAR | 貸出状態。「貸出中」または「延滞」から「返却済み」へ更新 | 変更（UPDATE） |
| returned_at | DATE | 返却日。返却登録イベントの occurred_at を日付へ射影したスナップショット列（RDRA 情報「貸出」の返却日に対応） | 追加（列追加 + UPDATE） |

### users（E-002 利用者）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_status | VARCHAR | 利用者状態。他に進行中の貸出・予約が無い場合のみ「取引進行中」から「登録済み」へ更新 | 変更（UPDATE） |
| updated_at | TIMESTAMP | 最終更新日時 | 変更（UPDATE） |

### reservations（E-005 予約）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_status | VARCHAR | 予約状態。利用者の進行中取引の判定に参照する（予約中 / 取置き中の有無） | 変更なし（SELECT） |

## ビジネスルール

- 状態遷移の整合性保証（LP-009）: 貸出状態が「貸出中」または「延滞」の貸出のみ「返却済み」へ遷移できる。既に「返却済み」の貸出への返却登録は 409 LOAN_ALREADY_RETURNED とする。
- 督促通知対象条件: 貸出状態が「返却済み」になった時点で督促を停止する。督促メール送信 UC は貸出状態が「貸出中」または「延滞」の貸出のみを対象とするため、返却登録が督促停止の実現手段となる。
- 返却日の確定: `returned_at` はサーバのシステム日付（JST）で確定する。クライアントから返却日を受け取らない（改ざん防止）。
- 超過日数の算出: `overdue_days = max(0, returned_at - due_date)`。期限内返却は 0 とする。延滞返却でも料金・ペナルティの計算は行わない（RDRA に該当する情報・条件が無いため）。
- 利用者状態の再評価: 返却後に同一利用者の `loans`（貸出状態が「貸出中」「延滞」）と `reservations`（予約状態が「予約中」「取置き中」）を検索し、いずれも 0 件なら `users.user_status` を「登録済み」へ更新する。1 件以上あれば「取引進行中」のまま維持する。
- 書籍状態は本 UC では更新しない。返却後の書籍状態は返却後状態決定条件に基づき、後続 UC「返却後の書籍状態を更新する」で決定する。
- トランザクション境界（LP-005）: usecase 層で 1 トランザクションとし、`loans` UPDATE と利用者状態の再評価・`users` UPDATE を原子的に行う。
- 冪等キー検証（LP-007）: `X-Idempotency-Key` を usecase 層で検証し、既処理のキーなら再実行せず既存の返却結果を返す。返却日の上書きや利用者状態の二重更新を防ぐ。
- 楽観ロックによる競合制御（LR-012）: `loans` の更新は `loan_status` を条件に含めた条件付き UPDATE（`WHERE loan_id = :loan_id AND loan_status IN ('貸出中','延滞')`）で行い、更新件数が 0 件なら競合と判定して 409 CONFLICT とする。
- 監査ログ（LP-006）: usecase 層で「誰が（司書の account_id）・いつ・どの貸出を返却受付したか」と超過日数を出力する。domain 層はログを出力しない（LP-010）。
- 返却対象検索 API のレスポンスに含む利用者の氏名は窓口での本人照合に必要なため返すが、連絡先（email）は返さない（LR-003）。

## ティア完了条件（BDD）

```gherkin
Feature: 返却を登録する - バックエンド API

  Scenario: 期限内の貸出を返却登録すると返却済みになる
    Given 貸出 "L-000001"（利用者番号 "U-000123"、返却期限 2026-09-16、貸出状態 "貸出中"）が存在する
    And サーバのシステム日付が 2026-09-10 である
    When 司書のトークンと冪等キー "idem-r001" で POST /api/v1/loans/L-000001/return を呼び出す
    Then HTTP 200 が返り、loan_status が "返却済み"、returned_at が "2026-09-10"、overdue_days が 0 である
    And loans の loan_status が "返却済み" に更新される

  Scenario: 延滞中の貸出を返却すると超過日数が返り督促対象から外れる
    Given 貸出 "L-000003"（利用者番号 "U-000123"、返却期限 2026-08-30、貸出状態 "延滞"）が存在する
    And サーバのシステム日付が 2026-09-02 である
    When 司書のトークンと冪等キー "idem-r002" で POST /api/v1/loans/L-000003/return を呼び出す
    Then HTTP 200 が返り、previous_loan_status が "延滞"、overdue_days が 3 である
    And 督促通知対象条件の検索結果に貸出 "L-000003" が含まれなくなる

  Scenario: 最後の進行中取引を返却すると利用者状態が登録済みへ戻る
    Given 利用者番号 "U-000123" の利用者が利用者状態 "取引進行中" である
    And 利用者番号 "U-000123" の進行中の取引が貸出 "L-000001"（貸出状態 "貸出中"）1 件だけである
    When 司書のトークンと冪等キー "idem-r003" で POST /api/v1/loans/L-000001/return を呼び出す
    Then HTTP 200 が返り、user_status が "登録済み" である
    And users の user_status が "登録済み" に更新される

  Scenario: 他の予約が残っている場合は利用者状態が取引進行中のまま維持される
    Given 利用者番号 "U-000123" の利用者が利用者状態 "取引進行中" である
    And 利用者番号 "U-000123" に予約 "R-000001"（予約状態 "予約中"）が存在する
    When 司書のトークンと冪等キー "idem-r004" で POST /api/v1/loans/L-000001/return を呼び出す
    Then HTTP 200 が返り、user_status が "取引進行中" である

  Scenario: 既に返却済みの貸出は 409 を返す
    Given 貸出 "L-000004" が貸出状態 "返却済み" で存在する
    When 司書のトークンと冪等キー "idem-r005" で POST /api/v1/loans/L-000004/return を呼び出す
    Then HTTP 409 が返り、code が "LOAN_ALREADY_RETURNED" である
    And loans の returned_at は変更されない

  Scenario: 存在しない貸出IDは 404 を返す
    Given 貸出 "L-999999" が存在しない
    When 司書のトークンと冪等キー "idem-r006" で POST /api/v1/loans/L-999999/return を呼び出す
    Then HTTP 404 が返り、code が "LOAN_NOT_FOUND" である

  Scenario: 同一冪等キーの再送で返却が二重登録されない
    Given 冪等キー "idem-r001" で貸出 "L-000001" が返却日 "2026-09-10" で返却済みになっている
    When 同じ冪等キー "idem-r001" で POST /api/v1/loans/L-000001/return を再送する
    Then HTTP 200 が返り、returned_at が "2026-09-10" のままである
    And users の user_status が二重に更新されない

  Scenario: 書籍IDで返却対象の貸出を検索できる
    Given 貸出 "L-000001"（書籍ID "B-000001"、利用者番号 "U-000123"、貸出状態 "貸出中"）が存在する
    When 司書のトークンで GET /api/v1/loans?book_id=B-000001&status=貸出中,延滞 を呼び出す
    Then HTTP 200 が返り、items に loan_id "L-000001" が含まれる
    And items の各要素に連絡先（email）のフィールドが含まれない

  Scenario: 絞り込み条件なしの検索は 400 を返す
    Given 司書のトークンが有効である
    When GET /api/v1/loans を book_id も user_no も指定せずに呼び出す
    Then HTTP 400 が返り、code が "INVALID_REQUEST" である
```
