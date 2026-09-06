# 貸出を登録する - バックエンド API 仕様

## 変更概要

貸出登録 API `POST /api/v1/loans` を追加する。貸出可否条件・取置き中書籍貸出条件・資料種別利用可否条件を再判定したうえで、貸出記録を貸出状態「貸出中」で作成し、返却期限設定条件で返却期限を自動設定する。同一トランザクション内で書籍状態・利用者状態・予約状態を遷移させる。冪等キーとDB取引ロックで二重登録・競合を制御する。実装は貸出コンテキスト（BC-003）の集約 AG-003 に置き、書籍（BC-001）・利用者（BC-002）・予約（BC-004）は Customer-Supplier で連携する。

## API 仕様

### 貸出を登録する

- **メソッド**: POST
- **パス**: `/api/v1/loans`
- **operationId**: `createLoan`（`_api-summary.yaml` の `endpoints[].operation_id` と一致する。本 UC が所有する唯一の operation）
- **認証**: OAuth2/OIDC アクセストークン（Bearer）。ロール `司書` のみ（RBAC）。館内ネットワークからのアクセスに限定する
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans.post` を参照

#### 利用者識別情報の送信方法と検証責務

`openapi.yaml` の `info.description`「利用者識別情報の送信方法」を正本とし、本 UC でも例外を設けない。

| 項目 | 内容 |
|------|------|
| 送信方法 | `Authorization: Bearer {access_token}` の JWT クレームだけ。`X-User-No` / `X-Role` 等の独自ヘッダは定義せず、送られても無視する |
| 必須クレーム | `sub`（司書のアカウントID。監査ログの操作者ID）/ `role`（`司書` であること）/ `exp` |
| `user_no` クレーム | 利用者ロールのトークンでは共有認証により存在・型を検証するが、貸出先の決定には使わない。貸出先の利用者番号はリクエストボディの `user_no` で受け取る（司書が他人の貸出を作る操作のため、本人限定参照ではない） |
| API Gateway の責務 | 署名・`exp`・`iss` / `aud` の検証。検証済みトークンだけをバックエンドへ透過する |
| バックエンド API の責務 | 必須クレームの存在と型の再検証 → 401、`role` の判定 → 403、`sub` を監査ログへ記録 |
| クライアント / テストの責務 | 統合テスト・スタブも同じ Bearer トークンで識別情報を渡す。テスト専用の識別ヘッダを注入しない |

401 の条件は次の 3 つだけで、いずれも `WWW-Authenticate: Bearer realm="libra", error="invalid_token", error_description="{code}"` を付与する。

| code | 条件 |
|------|------|
| `UNAUTHENTICATED` | `Authorization` ヘッダ欠落 / Bearer 以外 / 署名不正 |
| `TOKEN_EXPIRED` | `exp` 超過 |
| `IDENTITY_CLAIM_MISSING` | `sub` または `role`（利用者ロールなら `user_no` も）の欠落・型不正 |

認証が成立しているが `role` が `司書` でない場合は 401 ではなく 403（`FORBIDDEN`）とする。

#### 入出力の正本

型・必須項目・列挙値・HTTPヘッダは[_contract-slice.json](_contract-slice.json)のcreateLoanと参照schemaを読む。
人が変更する正本は共有[contracts.json](../../../_cross-cutting/api/contracts.json)。summaryは索引、sliceとOpenAPIは生成物である。
型表は本文に再掲しない。成功値の作り方は_model-summary.yaml、永続化・再送の意味はloan-commit.mdで定義する。

#### エラーレスポンス

下表のJSONはcode/messageを示す。409の完全な応答にはreasons: [message]を必ず付ける。任意のdetails/trace_idはこのサンプルでは省略する。

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
| 409 | 必要な業務行の排他ロックを取得できない | `{"code":"CONFLICT","message":"他の操作と競合しました。最新の状態を確認して再度お試しください"}` |
| 409 | 同一の X-Idempotency-Key で先行処理が実行中 | `{"code":"IDEMPOTENCY_KEY_IN_PROGRESS","message":"処理中です。しばらくしてからお試しください"}`（`Retry-After: 1`） |
| 409 | 同一の X-Idempotency-Key で異なる内容の要求 | `{"code":"IDEMPOTENCY_KEY_CONFLICT","message":"同じ冪等キーで異なる内容の登録は実行できません"}` |

## データアクセス・実行条件

- 業務判定: [spec.md](spec.md#業務ルール)のRULE-001〜004。
- 更新列: [_model-summary.yaml](_model-summary.yaml)のtables。型・制約は共有rdb-schema.yamlと追加テーブル定義。
- 順序・排他・原子性・再送・監査: [loan-commit.md](../../../_cross-cutting/datastore/loan-commit.md)を唯一の正本とする。
- 利用者状態が登録済み/取引進行中以外の保存データは409 USER_NOT_LOANABLE。「この利用者には貸し出せません」を返す。
- 不正UUID v4は400 INVALID_REQUEST。「貸出情報の指定が正しくありません」を返す。
- DB等の一時障害は503 TEMPORARILY_UNAVAILABLE。「結果を確認できません。同じ操作を再送してください」を返す。
- 新しい非同期イベントは発行しない。返却期限通知は別UCが日次で対象を走査する。

## ティア完了条件（BDD）

```gherkin
Feature: 貸出を登録する - バックエンド API

  Background:
    Given 各Scenarioは独立した初期DBから始まる
    And 省略された本文は有効な3項目、認証は有効な司書トークンである
    And 明示的に欠落または上書きしない限りUUID v4 "00000000-0000-4000-8000-000000000099" を送る

  Scenario: 在庫ありの書籍で貸出が作成され返却期限が自動設定される
    Given 書籍ID "B-000001" が書籍状態 "在庫あり"、資料種別 "紙書籍" で存在する
    And 利用者番号 "U-000123" の利用者が利用者状態 "登録済み"、利用者区分 "一般" で存在する
    And 本日が 2026-09-02 で、貸出期間区分「標準」の日数が 14 日である
    When 司書のトークンと冪等キー "00000000-0000-4000-8000-000000000001" で POST /api/v1/loans に {"book_id":"B-000001","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 201 が返り、loan_status が "貸出中"、due_date が "2026-09-16" である
    And books の book_status が "貸出中" に更新される
    And users の user_status が "取引進行中" に更新される

  Scenario: 取置き中の予約から貸し出すと予約が貸出済みになる
    Given 書籍ID "B-000002" が書籍状態 "予約待ち" で存在する
    And 書籍ID "B-000002" に利用者番号 "U-000123" の予約 "R-000001" が priority 1、予約状態 "取置き中" で存在する
    When 司書のトークンと冪等キー "00000000-0000-4000-8000-000000000002" で POST /api/v1/loans に {"book_id":"B-000002","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 201 が返り、reservation_id が "R-000001" である
    And reservations の reservation_status が "貸出済み" に更新される
    And books の book_status が "貸出中" に更新される

  Scenario: 貸出中の書籍への登録は 409 で拒否される
    Given 書籍ID "B-000003" が書籍状態 "貸出中" で存在する
    When 司書のトークンと冪等キー "00000000-0000-4000-8000-000000000003" で POST /api/v1/loans に {"book_id":"B-000003","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 409 が返り、code が "BOOK_NOT_AVAILABLE" である
    And loans にレコードは作成されない

  Scenario: 取置き対象でない利用者への登録は 409 で拒否される
    Given 書籍ID "B-000002" が書籍状態 "予約待ち" で、利用者番号 "U-000123" の予約が予約状態 "取置き中" で存在する
    When 司書のトークンと冪等キー "00000000-0000-4000-8000-000000000004" で POST /api/v1/loans に {"book_id":"B-000002","user_no":"U-000456","loan_period_type":"標準"} を送る
    Then HTTP 409 が返り、code が "BOOK_ON_HOLD_FOR_OTHER" である
    And loans にレコードは作成されない

  Scenario: 電子書籍への貸出登録は 409 で拒否される
    Given 書籍ID "B-000004" が資料種別 "電子書籍" で存在する
    When 司書のトークンと冪等キー "00000000-0000-4000-8000-000000000005" で POST /api/v1/loans に {"book_id":"B-000004","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 409 が返り、code が "MATERIAL_TYPE_NOT_SUPPORTED" である

  Scenario: 選択可能集合に含まれない貸出期間区分は 409 で拒否される
    Given 利用者番号 "U-000123" の利用者が利用者区分 "一般" で存在する
    And 書籍ID "B-000001" が書籍状態 "在庫あり" で存在する
    When 司書のトークンと冪等キー "00000000-0000-4000-8000-000000000006" で POST /api/v1/loans に {"book_id":"B-000001","user_no":"U-000123","loan_period_type":"長期"} を送る
    Then HTTP 409 が返り、code が "LOAN_PERIOD_TYPE_MISMATCH" であり、loans に行が追加されない

  Scenario: 一般利用者へ短期の貸出期間区分で貸し出せる
    Given 利用者番号 "U-000123" の利用者が利用者区分 "一般" で存在する
    And 書籍ID "B-000001" が書籍状態 "在庫あり" で存在する
    And 本日が 2026-09-02 である
    When 司書のトークンと冪等キー "00000000-0000-4000-8000-000000000007" で POST /api/v1/loans に {"book_id":"B-000001","user_no":"U-000123","loan_period_type":"短期"} を送る
    Then HTTP 201 が返り、due_date が "2026-09-09" である

  Scenario: 同一冪等キー・同一内容の再送で貸出が二重作成されない
    Given 冪等キー "00000000-0000-4000-8000-000000000001" で貸出ID "L-000001" が既に作成されている
    When 同じ冪等キー "00000000-0000-4000-8000-000000000001" で同一内容の貸出登録リクエストを再送する
    Then HTTP 201 が返り、loan_id が "L-000001" である
    And Idempotency-Replayed ヘッダが true である
    And loans のレコード件数は 1 件のままである

  Scenario: 同一冪等キー・異なる内容の再送は 409 で拒否される
    Given 冪等キー "00000000-0000-4000-8000-000000000001" で {"book_id":"B-000001","user_no":"U-000123","loan_period_type":"標準"} が処理済みである
    When 同じ冪等キー "00000000-0000-4000-8000-000000000001" で {"book_id":"B-000005","user_no":"U-000123","loan_period_type":"標準"} を送る
    Then HTTP 409 が返り、code が "IDEMPOTENCY_KEY_CONFLICT" である
    And loans のレコード件数は 1 件のままで、保存済みの冪等レコードは書き換えられない

  Scenario: 先行処理が実行中の同一冪等キー再送は 409 で待たされる
    Given 冪等キー "00000000-0000-4000-8000-000000000008" の貸出登録が実行中（同じ操作の取引ロックを保持中）である
    When 同じ冪等キー "00000000-0000-4000-8000-000000000008" で同一内容のリクエストを送る
    Then HTTP 409 が返り、code が "IDEMPOTENCY_KEY_IN_PROGRESS" である
    And Retry-After ヘッダが 1 である

  Scenario: 取置き中の予約から貸し出すと取置き期限が同時にクリアされる
    Given 書籍ID "B-000002" に利用者番号 "U-000123" の予約 "R-000001" が priority 1、予約状態 "取置き中"、hold_expires_at が設定済み、hold_started_at が設定済み で存在する
    When 司書のトークンと冪等キー "00000000-0000-4000-8000-000000000009" で POST /api/v1/loans に {"book_id":"B-000002","user_no":"U-000123","loan_period_type":"標準"} を送る
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

  Scenario: 先行貸出のコミット後は貸出中として拒否する
    Given 書籍ID "B-000001" に対して先行の貸出登録が実行される
    When 先行トランザクションのコミットとロック解放後に別キーで後行要求がbooksを読み取る
    Then 後行トランザクションは HTTP 409（code "BOOK_NOT_AVAILABLE"）で拒否される
    And loans に作成されるレコードは 1 件だけである
```

```gherkin
Scenario: UUID v4でないキーは入力エラーになる
  Given 有効な司書トークンと有効な3項目の本文がある
  When X-Idempotency-Keyに"idem-0001"を送る
  Then 400 INVALID_REQUESTで業務更新も成功記録も残らない

Scenario: 取引ロックが保持されている書籍は競合になる
  Given 別の取引が対象books行の排他ロックを保持している
  When 別の冪等キーで貸出を登録する
  Then 409 CONFLICTで業務更新はない
```

通信切断・返却後の再送は共有loan-commit.mdの障害BDDをこのUCの受入条件に含める。

```gherkin
Scenario: 貸出済みの予約を除外して後続順位を繰り上げる
  Given 同じ書籍に取置き中の順位1と予約中の順位2・3がある
  When 順位1の利用者へ貸し出す
  Then 順位1は貸出済みになり後続は申込日時順に順位1・2となる
  And これらと貸出と成功記録を同一取引で確定する
```
