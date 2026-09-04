# 返却後の書籍状態を更新する - バックエンド API 仕様

## 変更概要

返却後の在庫整理 API `POST /api/v1/books/{bookId}/restock` を追加する。返却後状態決定条件により、対象書籍に予約状態が「予約中」の予約が存在すれば書籍状態を「予約待ち」へ、存在しなければ「在庫あり」へ遷移させる。予約待ちへ遷移した場合は予約順1位の予約を取置き対象候補として返す（予約状態の更新は行わず、後続の取置き通知 UC が担う）。実装ロジックは蔵書コンテキスト（BC-001）の集約 AG-001 に置き、予約は BC-004 から参照する。

## API 仕様

### 返却後の在庫を整える

- **メソッド**: POST
- **パス**: `/api/v1/books/{bookId}/restock`
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `司書` のみ（RBAC）。館内ネットワークからのアクセスに限定する
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{bookId}/restock.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| bookId | string(path) | Yes | 在庫整理の対象書籍ID |
| loan_id | string(body) | Yes | 返却受付した貸出ID。在庫整理の契機を監査ログで追跡するために受け取る |
| X-Idempotency-Key | string(header) | Yes | 冪等キー（UUID）。再送時も同一キーを使う |
| Authorization | string(header) | Yes | `Bearer {access_token}`。司書ロールであること |
| traceparent | string(header) | No | W3C Trace Context |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| book_id | string | 対象書籍ID |
| book_status | string | 遷移後の書籍状態（在庫あり / 予約待ち） |
| previous_book_status | string | 遷移前の書籍状態（貸出中） |
| active_reservation_count | integer | 予約状態が「予約中」の予約件数 |
| next_reservation | object | 予約待ちへ遷移した場合のみ。`reservation_id` / `priority` / `user_no`。在庫ありへ戻った場合は null |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | loan_id が未指定・形式不正 | `{"code":"INVALID_REQUEST","message":"在庫整理の対象指定が正しくありません"}` |
| 400 | X-Idempotency-Key が未指定 | `{"code":"IDEMPOTENCY_KEY_REQUIRED","message":"冪等キーが必要です"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 司書ロールではない | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 404 | 指定された書籍が存在しない | `{"code":"BOOK_NOT_FOUND","message":"該当する書籍が見つかりません"}` |
| 409 | 書籍状態が「貸出中」でない（遷移不可） | `{"code":"BOOK_NOT_ON_LOAN","message":"この書籍は貸出中ではないため在庫整理できません"}` |
| 409 | 他の窓口操作と競合し、楽観ロックのバージョンが一致しない | `{"code":"CONFLICT","message":"他の操作と競合しました。最新の状態を確認して再度お試しください"}` |

同一の X-Idempotency-Key による再送は、既処理として同じ結果を HTTP 200 で返す（書籍状態を二重更新しない）。

## 非同期イベント（該当する場合）

書籍状態が「予約待ち」へ遷移したことは取置き通知の契機となるが、取置き通知メールの送信は別 UC「取置き通知メールを送信する」が担う。本 UC は取置き対象候補（予約順1位の予約）をレスポンスで返すのみで、通知イベントの発行は行わない。

## データモデル変更

### books（E-001 書籍）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_status | VARCHAR | 書籍状態。「貸出中」から「在庫あり」または「予約待ち」へ更新（返却後状態決定条件） | 変更（UPDATE） |
| updated_at | TIMESTAMP | 最終更新日時。在庫整理イベントの occurred_at を射影 | 変更（UPDATE） |

### reservations（E-005 予約）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id | VARCHAR | 予約ID（主キー）。取置き対象候補の識別に使う | 変更なし（SELECT） |
| book_id | VARCHAR | 予約対象の書籍ID。対象書籍での絞り込みに使う | 変更なし（SELECT） |
| user_no | VARCHAR | 予約申込者の利用者番号。取置き対象候補として返す | 変更なし（SELECT） |
| applied_at | TIMESTAMP | 予約申込日時。同順位時の並び替えに使う | 変更なし（SELECT） |
| priority | INT | 予約順位。予約順1位の特定に使う | 変更なし（SELECT） |
| reservation_status | VARCHAR | 予約状態。「予約中」の予約だけを有効な予約として数える | 変更なし（SELECT） |

## ビジネスルール

- 返却後状態決定条件: 対象書籍に `reservation_status = '予約中'` の予約が 1 件以上存在すれば `book_status` を「予約待ち」へ、0 件なら「在庫あり」へ更新する。
- 予約状態が「取置き中」「貸出済み」「キャンセル」の予約は有効な予約として数えない。取置き中の予約が既に存在する場合は他の書籍実体に対する取置きであり、返却された書籍の状態判定には用いない。
- 状態遷移の整合性保証（LP-009）: 書籍状態が「貸出中」の書籍のみ在庫整理の対象とする。「在庫あり」「予約待ち」の書籍への在庫整理要求は 409 BOOK_NOT_ON_LOAN とする。
- 取置き対象候補の特定: 予約状態が「予約中」の予約を `priority` 昇順（同値時は `applied_at` 昇順）で並べ、先頭 1 件を `next_reservation` として返す（取置き通知対象条件の前段）。本 UC では予約状態を更新しない。「予約中 → 取置き中」の遷移は「取置き通知メールを送信する」で行う。
- トランザクション境界（LP-005）: usecase 層で 1 トランザクションとし、予約の確認と `books` UPDATE を原子的に行う。
- 冪等キー検証（LP-007）: `X-Idempotency-Key` を usecase 層で検証し、既処理のキーなら再実行せず既存の結果を返す。
- 楽観ロックによる競合制御（LR-012）: `books` の更新は `book_status` を条件に含めた条件付き UPDATE（`WHERE book_id = :book_id AND book_status = '貸出中'`）で行い、更新件数が 0 件なら競合と判定して 409 CONFLICT とする。同一書籍への同時在庫整理で状態が二重遷移しないようにする。
- 監査ログ（LP-006）: usecase 層で「誰が（司書の account_id）・いつ・どの書籍を・どの貸出の返却に伴い・どの状態へ更新したか」を出力する。domain 層はログを出力しない（LP-010）。
- レスポンスの PII 最小化（LR-003）: 取置き対象候補は利用者番号のみを返し、氏名・連絡先は含めない。

## ティア完了条件（BDD）

```gherkin
Feature: 返却後の書籍状態を更新する - バックエンド API

  Scenario: 有効な予約がない書籍は在庫ありへ遷移する
    Given 書籍ID "B-000001" が書籍状態 "貸出中" で存在する
    And 書籍ID "B-000001" に予約状態 "予約中" の予約が存在しない
    When 司書のトークンと冪等キー "idem-s001" で POST /api/v1/books/B-000001/restock に {"loan_id":"L-000001"} を送る
    Then HTTP 200 が返り、book_status が "在庫あり"、previous_book_status が "貸出中" である
    And next_reservation が null で、active_reservation_count が 0 である
    And books の book_status が "在庫あり" に更新される

  Scenario: 有効な予約がある書籍は予約待ちへ遷移し予約順1位を返す
    Given 書籍ID "B-000002" が書籍状態 "貸出中" で存在する
    And 書籍ID "B-000002" に予約 "R-000001"（利用者番号 "U-000123"、priority 1、予約状態 "予約中"）が存在する
    When 司書のトークンと冪等キー "idem-s002" で POST /api/v1/books/B-000002/restock に {"loan_id":"L-000002"} を送る
    Then HTTP 200 が返り、book_status が "予約待ち" である
    And next_reservation.reservation_id が "R-000001"、next_reservation.user_no が "U-000123" である
    And reservations の reservation_status は "予約中" のまま変わらない

  Scenario: 複数の予約があるときは予約順1位を取置き対象候補とする
    Given 書籍ID "B-000002" が書籍状態 "貸出中" で存在する
    And 予約 "R-000001"（利用者番号 "U-000123"、priority 1、予約状態 "予約中"）と予約 "R-000002"（利用者番号 "U-000456"、priority 2、予約状態 "予約中"）が存在する
    When 司書のトークンと冪等キー "idem-s003" で POST /api/v1/books/B-000002/restock に {"loan_id":"L-000002"} を送る
    Then HTTP 200 が返り、active_reservation_count が 2 である
    And next_reservation.reservation_id が "R-000001" である

  Scenario: キャンセル済みの予約は有効な予約として数えない
    Given 書籍ID "B-000002" が書籍状態 "貸出中" で存在する
    And 書籍ID "B-000002" の予約 "R-000003" が予約状態 "キャンセル" で存在する
    And 予約状態 "予約中" の予約は存在しない
    When 司書のトークンと冪等キー "idem-s004" で POST /api/v1/books/B-000002/restock に {"loan_id":"L-000002"} を送る
    Then HTTP 200 が返り、book_status が "在庫あり"、active_reservation_count が 0 である

  Scenario: 貸出中でない書籍の在庫整理は 409 を返す
    Given 書籍ID "B-000001" が書籍状態 "在庫あり" で存在する
    When 司書のトークンと冪等キー "idem-s005" で POST /api/v1/books/B-000001/restock に {"loan_id":"L-000001"} を送る
    Then HTTP 409 が返り、code が "BOOK_NOT_ON_LOAN" である
    And books の book_status は "在庫あり" のまま変わらない

  Scenario: 存在しない書籍IDは 404 を返す
    Given 書籍ID "B-999999" が存在しない
    When 司書のトークンと冪等キー "idem-s006" で POST /api/v1/books/B-999999/restock に {"loan_id":"L-000001"} を送る
    Then HTTP 404 が返り、code が "BOOK_NOT_FOUND" である

  Scenario: 同一冪等キーの再送で書籍状態が二重更新されない
    Given 冪等キー "idem-s002" で書籍ID "B-000002" が書籍状態 "予約待ち" へ更新済みである
    When 同じ冪等キー "idem-s002" で POST /api/v1/books/B-000002/restock を再送する
    Then HTTP 200 が返り、book_status が "予約待ち" のままである
    And books の updated_at は変更されない

  Scenario: 利用者ロールでは在庫整理 API を呼び出せない
    Given 利用者「田中太郎」のアクセストークン（役割 "利用者"）が有効である
    When POST /api/v1/books/B-000001/restock に {"loan_id":"L-000001"} を送る
    Then HTTP 403 が返り、code が "FORBIDDEN" である
```
