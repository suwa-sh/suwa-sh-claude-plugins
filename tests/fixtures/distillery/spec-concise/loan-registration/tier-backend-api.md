# 貸出を登録する - バックエンド API 仕様

## 変更概要

貸出登録 API `POST /api/v1/loans` を追加する。貸出可否条件・取置き中書籍貸出条件・資料種別利用可否条件を再判定したうえで、貸出記録を貸出状態「貸出中」で作成し、返却期限設定条件で返却期限を自動設定する。同一トランザクション内で書籍状態・利用者状態・予約状態を遷移させる。冪等キーによる二重登録防止と、楽観ロックによる競合制御を行う。実装は貸出コンテキスト（BC-003）の集約 AG-003 に置き、書籍（BC-001）・利用者（BC-002）・予約（BC-004）は Customer-Supplier で連携する。

## API 仕様

### 貸出を登録する

- **メソッド**: POST
- **パス**: `/api/v1/loans`
- **operationId**: `createLoan`（`_api-summary.yaml` の `endpoints[].operation_id` と一致する。本 UC が所有する唯一の operation）
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `司書` のみ（RBAC）。館内ネットワークからのアクセスに限定する
- **OpenAPI**: [openapi.yaml](../../legacy-pipeline/specs/latest/_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans.post` を参照

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

正本は `../../legacy-pipeline/specs/latest/_cross-cutting/datastore/kvs-schema.yaml` の `idem:api:{operation_id}:{idempotency_key}` の `behavior`
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

## データアクセス・実行条件

- **業務ルール**: [spec.md](spec.md#業務ルール) の RULE-001〜004 を RegisterLoanCommand のトランザクション内で再判定する。事前の貸出可否判定結果は時点情報として扱う。
- **操作定義**: [_model-summary.yaml](_model-summary.yaml) の tables（loans INSERT、books / users / reservations UPDATEと参照）。書誌4列の貸出時点スナップショット、設定値・更新条件を含む。DB型・制約は [rdb-schema.yaml](../../legacy-pipeline/specs/latest/_cross-cutting/datastore/rdb-schema.yaml) の同名 tables を参照する。
- **原子性**: usecase 層で上記更新を1トランザクションとして確定する（LP-005 / LP-009）。いずれかの状態遷移が不可なら全体をロールバックする。利用者が既に取引進行中なら利用者状態は変更しない。
- **予約完了**: rdb-schema.yaml の state_transition_rules「予約状態遷移規則」の「取置き中 → 貸出済み」に従う。reservation_status と hold_expires_at の同時更新、hold_started_at の保持を含む。
- **競合**: books の条件付き UPDATE は `WHERE book_id = :book_id AND book_status IN ('在庫あり','予約待ち')`。更新件数0なら 409 CONFLICT（LR-012）。books / users の updated_at は貸出登録イベントの発生時刻を使う。
- **冪等性**: 本文の「冪等キーの判定規則」を usecase 層で適用する（LP-007）。
- **監査**: usecase 層で司書の account_id・時刻・書籍・貸出先利用者を記録する（LP-006）。domain 層からログを出さない（LP-010）。
- **レスポンス**: 利用者の氏名・連絡先を含めず利用者番号だけを返す（LR-003）。

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
