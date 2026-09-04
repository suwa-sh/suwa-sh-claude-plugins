# 貸出を登録する - バックエンド API 仕様

## 変更概要

貸出登録 API `POST /api/v1/loans` を追加する。貸出可否条件・取置き中書籍貸出条件・資料種別利用可否条件を再判定したうえで、貸出記録を貸出状態「貸出中」で作成し、返却期限設定条件で返却期限を自動設定する。同一トランザクション内で書籍状態・利用者状態・予約状態を遷移させる。冪等キーによる二重登録防止と、楽観ロックによる競合制御を行う。実装は貸出コンテキスト（BC-003）の集約 AG-003 に置き、書籍（BC-001）・利用者（BC-002）・予約（BC-004）は Customer-Supplier で連携する。

## API 仕様

### 貸出を登録する

- **メソッド**: POST
- **パス**: `/api/v1/loans`
- **operationId**: `createLoan`（`_api-summary.yaml` の `endpoints[].operation_id` と一致する。本 UC が所有する唯一の operation）
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `司書` のみ（RBAC）。館内ネットワークからのアクセスに限定する
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans.post` を参照

#### 利用者識別情報の送信方法と検証責務

`openapi.yaml` の `info.description`「利用者識別情報の送信方法」を正本とし、本 UC でも例外を設けない。

| 項目 | 内容 |
|------|------|
| 送信方法 | `Authorization: Bearer {access_token}` の JWT クレームだけ。`X-User-No` / `X-Role` 等の独自ヘッダは定義せず、送られても無視する |
| 必須クレーム | `sub`（司書のアカウントID。監査ログの操作者ID）/ `role`（`司書` であること）/ `exp` |
| `user_no` クレーム | 本 UC では使わない。貸出先の利用者番号はリクエストボディの `user_no` で受け取る（司書が他人の貸出を作る操作のため、本人限定参照ではない） |
| API Gateway の責務 | 署名・`exp`・`iss` / `aud` の検証。検証済みトークンだけをバックエンドへ透過する |
| バックエンド API の責務 | 必須クレームの存在と型の再検証 → 401、`role` の判定 → 403、`sub` を監査ログへ記録 |
| クライアント / テストの責務 | 統合テスト・スタブも同じ Bearer トークンで識別情報を渡す。テスト専用の識別ヘッダを注入しない |

401 の条件は次の 3 つだけで、いずれも `WWW-Authenticate: Bearer realm="libra", error="invalid_token", error_description="{code}"` を付与する。

| code | 条件 |
|------|------|
| `UNAUTHENTICATED` | `Authorization` ヘッダ欠落 / Bearer 以外 / 署名不正 |
| `TOKEN_EXPIRED` | `exp` 超過 |
| `IDENTITY_CLAIM_MISSING` | `sub` または `role` クレームの欠落・型不正 |

認証が成立しているが `role` が `司書` でない場合は 401 ではなく 403（`FORBIDDEN`）とする。

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id | string | Yes | 貸出対象の書籍ID |
| user_no | string | Yes | 貸出先の利用者番号 |
| loan_period_type | string | Yes | 貸出期間区分（標準 / 短期 / 長期）。返却期限の算出単位 |
| X-Idempotency-Key | string(header) | Yes | 冪等キー（UUID）。再送時も同一キーを使う |
| Authorization | string(header) | Yes | `Bearer {access_token}`。司書ロールであること |
| traceparent | string(header) | No | W3C Trace Context |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| loan_id | string | 作成された貸出ID |
| book_id | string | 貸出対象の書籍ID |
| user_no | string | 貸出先の利用者番号 |
| loan_date | string(date) | 貸出日 |
| loan_period_type | string | 貸出期間区分（標準 / 短期 / 長期） |
| due_date | string(date) | 返却期限（返却期限設定条件により自動設定） |
| loan_status | string | 貸出状態。作成直後は「貸出中」 |
| book_status | string | 遷移後の書籍状態。作成直後は「貸出中」 |
| reservation_id | string | 取置き中の予約から貸し出した場合のみ、貸出済みへ遷移した予約ID |

成功時の HTTP ステータスは 201。`Location: /api/v1/loans/{loan_id}` を返す。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | 必須パラメータ欠落、または loan_period_type がバリエーション（標準 / 短期 / 長期）外 | `{"code":"INVALID_REQUEST","message":"貸出情報の指定が正しくありません"}` |
| 400 | X-Idempotency-Key が未指定 | `{"code":"IDEMPOTENCY_KEY_REQUIRED","message":"冪等キーが必要です"}` |
| 401 | `Authorization` ヘッダ欠落 / Bearer 以外 / 署名不正 | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 401 | アクセストークンの `exp` 超過 | `{"code":"TOKEN_EXPIRED","message":"再度ログインしてください"}` |
| 401 | 必須クレーム（`sub` / `role`）の欠落・型不正 | `{"code":"IDENTITY_CLAIM_MISSING","message":"再度ログインしてください"}` |
| 403 | 司書ロールではない | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 404 | 指定された書籍が存在しない | `{"code":"BOOK_NOT_FOUND","message":"該当する書籍が見つかりません"}` |
| 404 | 指定された利用者が存在しない | `{"code":"USER_NOT_FOUND","message":"該当する利用者が見つかりません"}` |
| 409 | 書籍状態が「貸出中」（貸出可否条件を満たさない） | `{"code":"BOOK_NOT_AVAILABLE","message":"この書籍は貸出中のため貸し出せません"}` |
| 409 | 書籍状態が「予約待ち」で、要求利用者が取置き対象者でない（取置き中書籍貸出条件を満たさない） | `{"code":"BOOK_ON_HOLD_FOR_OTHER","message":"この書籍は他の利用者へ取置き中です"}` |
| 409 | 資料種別が「電子書籍」（資料種別利用可否条件を満たさない） | `{"code":"MATERIAL_TYPE_NOT_SUPPORTED","message":"電子書籍は現在ご利用いただけません"}` |
| 409 | 貸出期間区分が利用者区分の選択可能集合に含まれない（返却期限設定条件を満たさない） | `{"code":"LOAN_PERIOD_TYPE_MISMATCH","message":"この利用者区分では選択できない貸出期間区分です"}` |
| 409 | 他の窓口操作と競合し、楽観ロックのバージョンが一致しない | `{"code":"CONFLICT","message":"他の操作と競合しました。最新の状態を確認して再度お試しください"}` |
| 409 | 同一の X-Idempotency-Key で先行処理が実行中 | `{"code":"IDEMPOTENCY_KEY_IN_PROGRESS","message":"処理中です。しばらくしてからお試しください"}`（`Retry-After: 1`） |
| 409 | 同一の X-Idempotency-Key で異なる内容の要求 | `{"code":"IDEMPOTENCY_KEY_CONFLICT","message":"同じ冪等キーで異なる内容の登録は実行できません"}` |

#### 冪等キーの判定規則

正本は `_cross-cutting/datastore/kvs-schema.yaml` の `idem:api:{operation_id}:{idempotency_key}` の `behavior`
および `openapi.yaml` の `IdempotencyKeyHeader` である。本 UC ではキーを
`idem:api:createLoan:{X-Idempotency-Key}` として次のとおり判定する。

| 再送の内容 | 判定 | HTTP 応答 | 副作用 |
|---|---|---|---|
| キー未存在 | 新規要求 | 本処理どおり 201 | `loans` INSERT ほかを実行する |
| 同一キー・同一 request_fingerprint・`state=completed` | 既処理のリプレイ | 保存済みの 201 と `LoanResponse`（`Idempotency-Replayed: true`） | 実行しない。`loans` は 1 件のまま |
| 同一キー・同一 request_fingerprint・`state=in_progress` | 先行処理が未完了 | 409 `IDEMPOTENCY_KEY_IN_PROGRESS`（`Retry-After: 1`） | 実行しない |
| 同一キー・異なる request_fingerprint | キーの誤再利用 | 409 `IDEMPOTENCY_KEY_CONFLICT` | 実行しない。保存済みレコードを書き換えない |
| 先行処理が 4xx で終了した後の同一キー再送 | 冪等レコードは破棄済み | 本処理どおり | 通常どおり実行する |
| TTL 24h 経過後の同一キー再送 | 新規要求 | 本処理どおり 201 | 重複作成の防御は業務側の一意制約（`loans` の `book_id` + `loan_status`）に委ねる |

`request_fingerprint` は「`POST` + `/api/v1/loans` + 正規化 JSON ボディ（キー昇順・空白なし）」の SHA-256 とする。
`Authorization` / `traceparent` / `X-Idempotency-Key` はフィンガープリントに含めない。

## 非同期イベント（該当する場合）

本 UC 自体は非同期イベントを発行しない。貸出登録による利用者状態・書籍状態の変化は同一トランザクション内で完結する。返却期限リマインドは別 UC（返却期限接近の貸出を判定する）が日次で貸出を走査して発火する。

## データモデル変更

### loans（E-004 貸出）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR | 貸出ID（主キー） | 追加（INSERT） |
| book_id | VARCHAR | 貸出対象の書籍ID | 追加（INSERT） |
| user_no | VARCHAR | 貸出先の利用者番号 | 追加（INSERT） |
| loan_date | DATE | 貸出日。貸出登録イベントの発生日 | 追加（INSERT） |
| loan_period_type | VARCHAR | 貸出期間区分（標準 / 短期 / 長期） | 追加（INSERT） |
| due_date | DATE | 返却期限。返却期限設定条件で自動設定 | 追加（INSERT） |
| loan_status | VARCHAR | 貸出状態。作成時は「貸出中」 | 追加（INSERT） |
| book_title | VARCHAR | 書名。貸出時点の books の当該値のスナップショット | 追加（INSERT） |
| book_author | VARCHAR | 著者。貸出時点の books の当該値のスナップショット | 追加（INSERT） |
| book_isbn | VARCHAR | ISBN。貸出時点の books の当該値のスナップショット | 追加（INSERT） |
| book_genre | VARCHAR | ジャンル。貸出時点の books の当該値のスナップショット | 追加（INSERT） |

### books（E-001 書籍）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_status | VARCHAR | 書籍状態。「在庫あり」または「予約待ち」から「貸出中」へ更新 | 変更（UPDATE） |
| updated_at | TIMESTAMP | 最終更新日時。貸出登録イベントの発生時刻を射影 | 変更（UPDATE） |

### users（E-002 利用者）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_status | VARCHAR | 利用者状態。「登録済み」から「取引進行中」へ更新（既に取引進行中なら変更なし） | 変更（UPDATE） |
| updated_at | TIMESTAMP | 最終更新日時 | 変更（UPDATE） |

### reservations（E-005 予約）

遷移の正本は `_cross-cutting/datastore/rdb-schema.yaml` の `state_transition_rules`「予約状態遷移規則」の
`取置き中 → 貸出済み` の行である。同時更新列を本 UC 側で独自に定義しない。

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_status | VARCHAR | 予約状態。取置き中の予約から貸し出した場合のみ「取置き中」から「貸出済み」へ更新 | 変更（UPDATE） |
| hold_expires_at | TIMESTAMP | 取置き期限。取置きが成立して終了したため NULL へ戻す（不変条件「非 NULL は取置き中の行だけ」を満たす）。`reservation_status` と同一 UPDATE 文で更新する | 変更（UPDATE） |
| hold_started_at | TIMESTAMP | 取置き開始日時。取置きの実績として保持するため**変更しない** | 変更なし |

## ビジネスルール

- 貸出可否条件を再判定する。「書籍の貸出可否を判定する」の結果は時点情報であり、登録時点で書籍状態・利用者状態が変わっている可能性があるため、登録トランザクション内で再度評価する。
- 資料種別利用可否条件: `material_type` が「電子書籍」の書籍は貸出登録を拒否する（409 MATERIAL_TYPE_NOT_SUPPORTED）。
- 取置き中書籍貸出条件: `book_status` が「予約待ち」の場合、`reservation_status = '取置き中'` かつ `priority = 1` の予約の `user_no` と要求の利用者番号が一致するときのみ登録を許可する。
- 返却期限設定条件: `due_date = loan_date + 貸出期間区分に対応する日数`。利用者区分 → 貸出期間区分の対応表（既定と選択可能集合: 一般=既定 標準 / 選択可 標準・短期、学生=既定 長期 / 選択可 長期・標準・短期、団体=既定 長期 / 選択可 長期・標準・短期）は domain 層のドメイン規則として保持し、要求の `loan_period_type` が対象利用者の選択可能集合に含まれないときは登録を拒否する（409 `LOAN_PERIOD_TYPE_MISMATCH`）。`loan_period_type` は契約上必須（CreateLoanRequest.required）であり、既定区分はフロントエンドの初期選択で提示する。窓口貸出受付画面の ToggleGroup 初期選択・disabled は同じ対応表の UI 側の提示であり、検証の正本ではない（API を直接呼ばれても選択可能集合外の区分では貸し出せない）。
- 状態遷移の整合性保証（LP-009）: 貸出状態「貸出中」の生成、書籍状態「在庫あり / 予約待ち → 貸出中」、利用者状態「登録済み → 取引進行中」、予約状態「取置き中 → 貸出済み」を同一トランザクション内で行う。いずれかが遷移不可なら全体をロールバックする。
- 予約状態遷移の正本（S5-005）: `取置き中 → 貸出済み` の遷移元・遷移先・同時更新列は `_cross-cutting/datastore/rdb-schema.yaml` の `state_transition_rules`「予約状態遷移規則」に従う。UPDATE は `reservation_status = '貸出済み'` と `hold_expires_at = NULL` を**1 つの UPDATE 文で同時に**行い（`WHERE reservation_id = :reservation_id AND reservation_status = '取置き中'`）、`hold_started_at` は変更しない。`hold_expires_at` を残したまま `reservation_status` だけを更新すると、取置き期限切れの日次判定と取置き状況照会が貸出済みの予約を取置き中として見てしまうため、分割してはならない。
- トランザクション境界（LP-005）: usecase 層で 1 トランザクションとし、`loans` INSERT と `books` / `users` / `reservations` UPDATE を原子的に行う。
- 冪等キー検証（LP-007）: `X-Idempotency-Key` を usecase 層で検証し、既処理のキーなら新規作成せず既存の貸出を返す。
- 楽観ロックによる競合制御（LR-012）: `books` の更新は `book_status` を条件に含めた条件付き UPDATE（`WHERE book_id = :book_id AND book_status IN ('在庫あり','予約待ち')`）で行い、更新件数が 0 件なら競合と判定して 409 CONFLICT とする。窓口の同時操作で同じ書籍を二重に貸し出さない。
- 監査ログ（LP-006）: usecase 層で「誰が（司書の account_id）・いつ・どの書籍を・どの利用者へ貸し出したか」を出力する。domain 層はログを出力しない（LP-010）。
- レスポンスの PII 最小化（LR-003）: 利用者の氏名・連絡先はレスポンスに含めず、利用者番号のみを返す。

## ティア完了条件（BDD）

```gherkin
Feature: 貸出を登録する - バックエンド API

  Scenario: 在庫ありの書籍で貸出が作成され返却期限が自動設定される
    Given 書籍ID "B-000001" が書籍状態 "在庫あり"、資料種別 "紙書籍" で存在する
    And 利用者番号 "U-000123" の利用者が利用者状態 "登録済み"、利用者区分 "一般" で存在する
    And 本日が 2026-09-02 で、貸出期間区分「標準」の日数が 14 日である
    When 司書のトークンと冪等キー "idem-0001" で POST /api/v1/loans に {"book_id":"B-000001","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 201 が返り、loan_status が "貸出中"、due_date が "2026-09-16" である
    And books の book_status が "貸出中" に更新される
    And users の user_status が "取引進行中" に更新される

  Scenario: 取置き中の予約から貸し出すと予約が貸出済みになる
    Given 書籍ID "B-000002" が書籍状態 "予約待ち" で存在する
    And 書籍ID "B-000002" に利用者番号 "U-000123" の予約 "R-000001" が priority 1、予約状態 "取置き中" で存在する
    When 司書のトークンと冪等キー "idem-0002" で POST /api/v1/loans に {"book_id":"B-000002","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 201 が返り、reservation_id が "R-000001" である
    And reservations の reservation_status が "貸出済み" に更新される
    And books の book_status が "貸出中" に更新される

  Scenario: 貸出中の書籍への登録は 409 で拒否される
    Given 書籍ID "B-000003" が書籍状態 "貸出中" で存在する
    When 司書のトークンと冪等キー "idem-0003" で POST /api/v1/loans に {"book_id":"B-000003","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 409 が返り、code が "BOOK_NOT_AVAILABLE" である
    And loans にレコードは作成されない

  Scenario: 取置き対象でない利用者への登録は 409 で拒否される
    Given 書籍ID "B-000002" が書籍状態 "予約待ち" で、利用者番号 "U-000123" の予約が予約状態 "取置き中" で存在する
    When 司書のトークンと冪等キー "idem-0004" で POST /api/v1/loans に {"book_id":"B-000002","user_no":"U-000456","loan_period_type":"標準"} を送る
    Then HTTP 409 が返り、code が "BOOK_ON_HOLD_FOR_OTHER" である
    And loans にレコードは作成されない

  Scenario: 電子書籍への貸出登録は 409 で拒否される
    Given 書籍ID "B-000004" が資料種別 "電子書籍" で存在する
    When 司書のトークンと冪等キー "idem-0005" で POST /api/v1/loans に {"book_id":"B-000004","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 409 が返り、code が "MATERIAL_TYPE_NOT_SUPPORTED" である

  Scenario: 選択可能集合に含まれない貸出期間区分は 409 で拒否される
    Given 利用者番号 "U-000123" の利用者が利用者区分 "一般" で存在する
    And 書籍ID "B-000001" が書籍状態 "在庫あり" で存在する
    When 司書のトークンと冪等キー "idem-0006" で POST /api/v1/loans に {"book_id":"B-000001","user_no":"U-000123","loan_period_type":"長期"} を送る
    Then HTTP 409 が返り、code が "LOAN_PERIOD_TYPE_MISMATCH" であり、loans に行が追加されない

  Scenario: 一般利用者へ短期の貸出期間区分で貸し出せる
    Given 利用者番号 "U-000123" の利用者が利用者区分 "一般" で存在する
    And 書籍ID "B-000001" が書籍状態 "在庫あり" で存在する
    And 本日が 2026-09-02 である
    When 司書のトークンと冪等キー "idem-0007" で POST /api/v1/loans に {"book_id":"B-000001","user_no":"U-000123","loan_period_type":"短期"} を送る
    Then HTTP 201 が返り、due_date が "2026-09-09" である

  Scenario: 同一冪等キー・同一内容の再送で貸出が二重作成されない
    Given 冪等キー "idem-0001" で貸出ID "L-000001" が既に作成されている
    When 同じ冪等キー "idem-0001" で同一内容の貸出登録リクエストを再送する
    Then HTTP 201 が返り、loan_id が "L-000001" である
    And Idempotency-Replayed ヘッダが true である
    And loans のレコード件数は 1 件のままである

  Scenario: 同一冪等キー・異なる内容の再送は 409 で拒否される
    Given 冪等キー "idem-0001" で {"book_id":"B-000001","user_no":"U-000123","loan_period_type":"標準"} が処理済みである
    When 同じ冪等キー "idem-0001" で {"book_id":"B-000005","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 409 が返り、code が "IDEMPOTENCY_KEY_CONFLICT" である
    And loans のレコード件数は 1 件のままで、保存済みの冪等レコードは書き換えられない

  Scenario: 先行処理が実行中の同一冪等キー再送は 409 で待たされる
    Given 冪等キー "idem-0008" の貸出登録が実行中（state=in_progress）である
    When 同じ冪等キー "idem-0008" で同一内容のリクエストを送る
    Then HTTP 409 が返り、code が "IDEMPOTENCY_KEY_IN_PROGRESS" である
    And Retry-After ヘッダが 1 である

  Scenario: 取置き中の予約から貸し出すと取置き期限が同時にクリアされる
    Given 書籍ID "B-000002" に利用者番号 "U-000123" の予約 "R-000001" が priority 1、予約状態 "取置き中"、hold_expires_at が設定済み、hold_started_at が設定済み で存在する
    When 司書のトークンと冪等キー "idem-0009" で POST /api/v1/loans に {"book_id":"B-000002","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 201 が返る
    And reservations の reservation_status が "貸出済み"、hold_expires_at が NULL に同一 UPDATE 文で更新される
    And reservations の hold_started_at は取置き時の値のまま変わらない

  Scenario: Authorization ヘッダが無い要求は 401 で拒否される
    Given 有効な貸出登録リクエストボディがある
    When Authorization ヘッダを付けずに POST /api/v1/loans を呼び出す
    Then HTTP 401 が返り、code が "UNAUTHENTICATED" である
    And WWW-Authenticate ヘッダに Bearer realm="libra" と error_description="UNAUTHENTICATED" が含まれる

  Scenario: 期限切れトークンは 401 TOKEN_EXPIRED で拒否される
    Given exp が現在時刻より過去のアクセストークンがある
    When そのトークンで POST /api/v1/loans を呼び出す
    Then HTTP 401 が返り、code が "TOKEN_EXPIRED" である

  Scenario: role クレームが無いトークンは 401 IDENTITY_CLAIM_MISSING で拒否される
    Given 署名は有効だが role クレームを持たないアクセストークンがある
    When そのトークンで POST /api/v1/loans を呼び出す
    Then HTTP 401 が返り、code が "IDENTITY_CLAIM_MISSING" である

  Scenario: 識別用の独自ヘッダは認証結果に影響しない
    Given 利用者ロールの有効なアクセストークンがある
    When X-User-No: "U-000123" と X-Role: "司書" を付けて POST /api/v1/loans を呼び出す
    Then HTTP 403 が返り、code が "FORBIDDEN" である
    And 独自ヘッダの値は認可判定に使われない

  Scenario: 冪等キーが無い要求は 400 で拒否される
    Given 司書のトークンが有効である
    When X-Idempotency-Key を付けずに POST /api/v1/loans を呼び出す
    Then HTTP 400 が返り、code が "IDEMPOTENCY_KEY_REQUIRED" である

  Scenario: 不正な貸出期間区分は 400 で拒否される
    Given 書籍ID "B-000001" と利用者番号 "U-000123" が存在する
    When 司書のトークンで POST /api/v1/loans に {"book_id":"B-000001","user_no":"U-000123","loan_period_type":"無期限"} を送る
    Then HTTP 400 が返り、code が "INVALID_REQUEST" である

  Scenario: 同時貸出の競合は 409 で拒否される
    Given 書籍ID "B-000001" に対して 2 つの貸出登録が同時に実行される
    When 先行トランザクションが book_status を "貸出中" へ更新してコミットする
    Then 後行トランザクションは HTTP 409（code "CONFLICT" または "BOOK_NOT_AVAILABLE"）で拒否される
    And loans に作成されるレコードは 1 件だけである
```
