---
basis: requirements@c99a17fdd8915399a17cdd205937316c051e9e02 adr@2f9d373dc26f6467cf0f95c62a65831fce0f9659 contracts@c99a17fdd8915399a17cdd205937316c051e9e02
generated_at: 2026-09-24T00:10:02.802Z
code: b8ff4cc3f2d200fdacc78f34ab5b3309197f7a7c
uc: 貸出を登録する
slug: register-loan
---

# 貸出業務 / 貸出を登録する (as-built)

## 1. 見出し (抽出)

- 業務 / BUC / UC: 貸出業務 / 貸出フロー / 貸出を登録する
- いつ (generated_at): 2026-09-24T00:10:02.802Z
- 何を基に (code): b8ff4cc3f2d200fdacc78f34ab5b3309197f7a7c
- 実行試行 (attempt): 1
- 上流 (basis): requirements@c99a17fdd8915399a17cdd205937316c051e9e02 adr@2f9d373dc26f6467cf0f95c62a65831fce0f9659 contracts@c99a17fdd8915399a17cdd205937316c051e9e02

## 2. 実現の経路 (抽出)

- 関与ティア: backend-api, frontend-staff
- API operation:
  - createLoan (POST /loans)
- 画面: なし
- 発行イベント: なし
- 購読イベント: なし
- 入口ファイル (変更):
  - backend-api:
    - apps/backend-api/migrations/0001_schema.sql
    - apps/backend-api/package.json
    - apps/backend-api/src/domain/loan/due-date.test.ts
    - apps/backend-api/src/domain/loan/due-date.ts
    - apps/backend-api/src/domain/loan/errors.ts
    - apps/backend-api/src/domain/loan/loan-period.test.ts
    - apps/backend-api/src/domain/loan/loan-period.ts
    - apps/backend-api/src/domain/loan/loan-registration-repository.ts
    - apps/backend-api/src/domain/loan/loan.test.ts
    - apps/backend-api/src/domain/loan/loan.ts
    - apps/backend-api/src/domain/shared/business-date.ts
    - apps/backend-api/src/gateway/clock/clocks.ts
    - apps/backend-api/src/gateway/db/sql-client.ts
    - apps/backend-api/src/gateway/log/access-log-writers.ts
    - apps/backend-api/src/presentation/http/app.test.ts
    - apps/backend-api/src/presentation/http/app.ts
    - apps/backend-api/src/presentation/http/authenticator.ts
    - apps/backend-api/src/presentation/http/http-io.ts
    - apps/backend-api/src/presentation/http/loans/create-loan-handler.ts
    - apps/backend-api/src/presentation/http/loans/create-loan-request.test.ts
    - apps/backend-api/src/presentation/http/loans/create-loan-request.ts
    - apps/backend-api/src/presentation/http/problem.ts
    - apps/backend-api/src/repository/loan/pg-loan-registration-repository.test.ts
    - apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts
    - apps/backend-api/src/test-app.test.ts
    - apps/backend-api/src/test-app.ts
    - apps/backend-api/src/testing/contract-fixture.ts
    - apps/backend-api/src/testing/test-authenticator.ts
    - apps/backend-api/src/usecase/auth/principal.ts
    - apps/backend-api/src/usecase/loan/register-loan.test.ts
    - apps/backend-api/src/usecase/loan/register-loan.ts
    - apps/backend-api/src/usecase/ports/access-log.ts
    - apps/backend-api/test/contract/createLoan.test.ts
    - apps/backend-api/test/contract/db-schema.test.ts
    - apps/backend-api/tsconfig.json
  - frontend-staff:
    - apps/frontend-staff/package.json
    - apps/frontend-staff/src/api-client/loan-api-types.ts
    - apps/frontend-staff/src/api-client/loan-api.test.ts
    - apps/frontend-staff/src/api-client/loan-api.ts
    - apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.test.ts
    - apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts
    - apps/frontend-staff/src/screens/loan-checkout/submit-loan-checkout.test.ts
    - apps/frontend-staff/src/screens/loan-checkout/submit-loan-checkout.ts
    - apps/frontend-staff/tsconfig.json

## 3. シーケンス (抽出)

- シナリオ数: 9
- [シーケンス図](sequence.md)

## 4. データの読み書き (抽出)

| シナリオ | 読み | 書き | 発行 |
|---|---|---|---|
| register-loan#延滞中の貸出を持つ利用者には貸し出せない | books, loans, patrons, reservations | - | - |
| register-loan#在庫ありの書籍を登録済みの利用者に貸し出す | books, loans, patrons, reservations | book_events, books, loan_events, loans | - |
| register-loan#削除済みの書籍は貸し出せない | books, loans, patrons, reservations | - | - |
| register-loan#削除済みの利用者には貸し出せない | books, loans, patrons, reservations | - | - |
| register-loan#取置の書籍は取置中の予約を持たない利用者には貸し出せない | books, loans, patrons, reservations | - | - |
| register-loan#取置中の予約を持つ予約順 1 位の利用者には取置の書籍を貸し出せる | books, loans, patrons, reservations | book_events, books, loan_events, loans, reservation_events, reservations | - |
| register-loan#貸出を登録すると返却期限が自動で設定される | books, loans, patrons, reservations | book_events, books, loan_events, loans | - |
| register-loan#貸出中の書籍は同じ書籍として貸し出せない | books, loans, patrons, reservations | - | - |
| register-loan#利用者は貸出を登録できない | - | - | - |

## 5. 整合性の守り方 (要約)

<!-- 要約: 原子性の境界・冪等キー・競合判定・再送と障害回復・副作用。根拠はコード位置 path:line -->

ヒント (AssumptionRecord から。要約の手がかり):
- [data_format] 貸出期間は利用者区分 (一般・児童・学生) と媒体種別 (紙・電子) のすべての組み合わせで 14 日とする — apps/backend-api/src/domain/loan/loan-period.ts:20
- [error_handling] 貸出可否の判定は 利用者の存在 → 書籍の存在 → 書籍状態 (貸出中・取置) → 利用者の延滞 の順に行い、最初に満たさない条件の code だけを返す — apps/backend-api/src/domain/loan/loan.ts:89
- [error_handling] 削除済みでなく存在しない書籍・利用者も 404 (code book-not-found / patron-not-found) とし、detail を「指定した書籍は見つかりません」「指定した利用者は見つかりません」とする — apps/backend-api/src/domain/loan/errors.ts:27
- [data_format] 業務日付 (貸出日) は Asia/Tokyo の暦日で決める。テストの固定時計は発生日時を業務日付の 09:00+09:00 とする — apps/backend-api/src/gateway/clock/clocks.ts:6
- [error_handling] 想定外の失敗は 500 と Problem (type .../internal-error、title サーバでエラーが発生しました) で返し、例外の内容は応答に出さない — apps/backend-api/src/presentation/http/problem.ts:58
- [error_handling] 入力検証 (400) を認可判定 (403) より先に行う。利用者ロールが不正な本文を送ると 400 になる — apps/backend-api/src/presentation/http/loans/create-loan-handler.ts:43
- [persistence] イベント payload は JSON で、BookLoaned は status・loanId・patronNumber、LoanCreated は貸出の全項目と pickedUpReservationId、ReservationPickedUp は status・loanId、QueueAdvanced は繰り上げ前後の予約順を持つ。貸出の版番号は 1 から始める — apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:96
- [persistence] 貸出可否の判定に使う読み取りはトランザクションの外で行い、書き込みトランザクションで書籍の版番号に加えて受取済みにする予約の版番号と取置中の状態も照合し、どちらかが変わっていれば 409 version-conflict で全体を巻き戻す — apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:165
- [error_handling] createLoan が 404 (削除済みの書籍・利用者) を返したとき、貸出受付画面は 409 と同じ notLendable variant にする — apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:70
- [error_handling] createLoan が 400 / 404 / 409 / 201 以外 (401 / 403 / 5xx など) を返したとき、error variant にし、Alert の本文には Problem.detail (無ければ title) をそのまま出す — apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:144
- [error_handling] notLendable のとき、Problem.code が patron-not-found / patron-has-overdue-loan なら利用者番号欄 (patronError) に、それ以外 (book-* と version-conflict) なら書籍 ID 欄 (bookError) に Problem.detail を出す — apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:91
- [error_handling] notLendable の Alert は story の固定文言ではなく、サーバの Problem.title を見出し、Problem.detail を本文にする — apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:89
- [data_format] 貸出完了時の DueDateDisplay の daysLeft は、登録直後なので loanPeriodDays と同じ値にする (端末の時計は使わない) — apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:133
- [data_format] 貸出完了メッセージは利用者の氏名ではなく利用者番号で「利用者 P000123 に貸し出しました」と出し、貸出内容に利用者区分を出さない — apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:124

<!-- 要約:begin -->
**原子性の境界**

- 書籍の貸出中化・貸出の登録・予約の受取済み化は、1 回の `db.transaction` の中で行う (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:71)。
- 各スナップショット更新 (books / loans / reservations) と、対応するイベント追記 (book_events / loan_events / reservation_events) は同じトランザクション内で行う (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:89, apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:136, apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:171)。
- 取置の受取では、後続予約の繰り上げも同じトランザクション内で行う (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:177)。
- 繰り上げは一意制約 (book_id, queue_position) に触れないよう、予約順の小さい順に 1 件ずつ更新する (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:176)。
- 変更ファイルに含まれる `transaction()` の実装は SAVEPOINT 版だけで、失敗時は SAVEPOINT まで巻き戻す (apps/backend-api/src/gateway/db/sql-client.ts:19, apps/backend-api/src/gateway/db/sql-client.ts:30)。
- 貸出可否の判定に使う利用者・書籍・取置予約の読み取りは、トランザクションの外で行う (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:28)。

**競合判定 (楽観ロック)**

- 書籍は、判定時に読んだ版番号 `expectedBookVersion` と一致するときだけ更新する (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:83, apps/backend-api/src/domain/loan/loan.ts:104)。
- 受取済みにする予約は、版番号の一致に加えて状態が `on_hold` のときだけ更新する (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:165)。
- 繰り上げ対象の予約も、版番号が一致するときだけ更新する (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:184)。
- どの更新も 0 行なら `VersionConflict` を投げ、トランザクション全体を巻き戻す (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:88, apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:170, apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:189)。
- `VersionConflict` は 409 (code `version-conflict`、title「他の操作と競合しました」) で返す (apps/backend-api/src/presentation/http/loans/create-loan-handler.ts:72, apps/backend-api/src/presentation/http/problem.ts:53)。
- 新しい貸出の版番号は 1 から始める (apps/backend-api/src/domain/loan/loan.ts:102)。

**冪等キー**

- リクエストのコマンドは利用者番号と書籍 ID だけを持ち、冪等キーを受け取らない (apps/backend-api/src/usecase/loan/register-loan.ts:8)。
- 貸出 ID はリクエストごとに `newId()` で新しく採番する (apps/backend-api/src/usecase/loan/register-loan.ts:55)。
- 同じ書籍への再送は、1 回目の登録で書籍状態が `on_loan` になるため、2 回目は 409 `book-on-loan` で拒否される (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:83, apps/backend-api/src/domain/loan/loan.ts:129)。

**判定の順序と拒否**

- 貸出可否は、利用者の存在 → 書籍の存在 → 書籍状態 (貸出中・取置) → 利用者の延滞 の順に判定し、最初に満たさない条件の例外だけを投げる (apps/backend-api/src/domain/loan/loan.ts:87, apps/backend-api/src/domain/loan/loan.ts:90)。
- 取置の書籍は、予約順 1 位の取置予約の利用者と一致するときだけ貸し出す (apps/backend-api/src/domain/loan/loan.ts:132)。
- 入力検証 (400) は、ユースケースの認可判定 (403) より先に行う (apps/backend-api/src/presentation/http/loans/create-loan-handler.ts:43, apps/backend-api/src/usecase/loan/register-loan.ts:48)。
- 返却期限は、業務日付 (Asia/Tokyo の暦日) を貸出日として算出する (apps/backend-api/src/gateway/clock/clocks.ts:6, apps/backend-api/src/usecase/loan/register-loan.ts:55)。

**再送と障害回復**

- 想定外の例外は `onUnexpectedError` に通知し、500 の Problem を返し、例外の内容は応答に出さない (apps/backend-api/src/presentation/http/app.ts:32, apps/backend-api/src/presentation/http/problem.ts:58)。
- サーバ側に自動リトライの処理は無い (apps/backend-api/src/presentation/http/app.ts:32)。
- 画面は通信例外を `network-error` とし、「通信に失敗しました。貸出は登録されていません。」と表示する (apps/frontend-staff/src/api-client/loan-api.ts:53, apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:64)。
- この表示は、サーバ側の登録有無を確かめずに出す (apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:113)。
- 画面は 404 と 409 を同じ `notLendable` にし、code が利用者起因なら利用者番号欄、それ以外 (`version-conflict` を含む) なら書籍 ID 欄に detail を出す (apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:70, apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:91)。

**副作用**

- 外部へのメッセージ発行は無く、書き込みは RDB のスナップショットとイベントテーブルに限られる (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:19)。
- データアクセスログは、成功を保存の後に、拒否 (`LoanRegistrationError`) を例外の捕捉時に、権限不足を判定時に記録する (apps/backend-api/src/usecase/loan/register-loan.ts:57, apps/backend-api/src/usecase/loan/register-loan.ts:63, apps/backend-api/src/usecase/loan/register-loan.ts:49)。
- `LoanRegistrationError` 以外の例外では、データアクセスログを記録しない (apps/backend-api/src/usecase/loan/register-loan.ts:63)。
<!-- 要約:end -->

## 6. 画面 (抽出)

画面定義なし。

## 7. 検証の証跡 (抽出)

| シナリオ | タグ | 結果 | 時間(ms) |
|---|---|---|---|
| 延滞中の貸出を持つ利用者には貸し出せない | @uc:register-loan | passed | 8 |
| 在庫ありの書籍を登録済みの利用者に貸し出す | @acceptance @acceptance:SPEC-002-01-1 @uc:register-loan | passed | 1108 |
| 削除済みの書籍は貸し出せない | @uc:register-loan | passed | 9 |
| 削除済みの利用者には貸し出せない | @uc:register-loan | passed | 6 |
| 取置の書籍は取置中の予約を持たない利用者には貸し出せない | @uc:register-loan | passed | 7 |
| 取置中の予約を持つ予約順 1 位の利用者には取置の書籍を貸し出せる | @uc:register-loan | passed | 12 |
| 貸出を登録すると返却期限が自動で設定される | @acceptance @acceptance:SPEC-003-01-1 @uc:register-loan | passed | 11 |
| 貸出受付画面で貸出中の書籍を貸し出そうとすると貸出できない旨が表示される | @acceptance @acceptance:SPEC-002-01-2 @browser @uc:register-loan | passed | 0 |
| 貸出中の書籍は同じ書籍として貸し出せない | @acceptance @acceptance:SPEC-002-01-2 @uc:register-loan | passed | 9 |
| 利用者は貸出を登録できない | @uc:register-loan | passed | 7 |

ゲート:

| ゲート | 結果 |
|---|---|
| static | pass |
| unit | pass |
| contract | pass |
| uc-bdd | pass |
| acceptance | pass |
| (総合) | pass |
| (全ゲート記録 all_recorded) | yes |

単体・契約テスト件数:

| ティア | 単体 (pass/total) | 契約 (pass/total) |
|---|---|---|
| frontend-patron | - | - |
| frontend-staff | 22/22 | 0/0 |
| backend-api | 45/45 | 20/22 |
| worker | - | - |

## 8. 補った前提と処遇 (転記)

| id | ティア | 分類 | 前提 | 判定 | 処遇 |
|---|---|---|---|---|---|
| A-001 | backend-api | data_format | 貸出期間は利用者区分 (一般・児童・学生) と媒体種別 (紙・電子) のすべての組み合わせで 14 日とする | spec_absent | auto_confirmed |
| A-002 | backend-api | input_validation | 利用者区分ごとの貸出上限冊数は判定せず、上限による貸出拒否を行わない | spec_absent | auto_confirmed |
| A-003 | backend-api | error_handling | 貸出可否の判定は 利用者の存在 → 書籍の存在 → 書籍状態 (貸出中・取置) → 利用者の延滞 の順に行い、最初に満たさない条件の code だけを返す | spec_absent | auto_confirmed |
| A-004 | backend-api | error_handling | 削除済みでなく存在しない書籍・利用者も 404 (code book-not-found / patron-not-found) とし、detail を「指定した書籍は見つかりません」「指定した利用者は見つかりません」とする | spec_absent | auto_confirmed |
| A-005 | backend-api | security | テスト用 composition root では Authorization ヘッダが無いリクエストを司書 (subject test-staff) とみなし、Bearer test-staff:<sub> / test-patron:<利用者番号> を検証済みトークンとして扱う | spec_absent | auto_confirmed |
| A-006 | backend-api | data_format | 業務日付 (貸出日) は Asia/Tokyo の暦日で決める。テストの固定時計は発生日時を業務日付の 09:00+09:00 とする | spec_absent | auto_confirmed |
| A-007 | backend-api | security | データアクセスログは action=loan.register、操作者の subject とロール、対象の書籍ID・利用者番号・貸出ID、結果 (succeeded / denied / rejected と理由 code) を 1 行 JSON で記録し、氏名・連絡先は載せない | spec_absent | auto_confirmed |
| A-008 | backend-api | error_handling | 想定外の失敗は 500 と Problem (type .../internal-error、title サーバでエラーが発生しました) で返し、例外の内容は応答に出さない | spec_absent | auto_confirmed |
| A-009 | backend-api | input_validation | リクエスト本文は 64 KiB を上限とし、超過や JSON として読めない本文は 400 ValidationProblem (field body) で返す | spec_absent | auto_confirmed |
| A-010 | backend-api | error_handling | 入力検証 (400) を認可判定 (403) より先に行う。利用者ロールが不正な本文を送ると 400 になる | spec_absent | confirmed |
| A-011 | backend-api | persistence | イベント payload は JSON で、BookLoaned は status・loanId・patronNumber、LoanCreated は貸出の全項目と pickedUpReservationId、ReservationPickedUp は status・loanId、QueueAdvanced は繰り上げ前後の予約順を持つ。貸出の版番号は 1 から始める | spec_absent | confirmed |
| A-012 | backend-api | persistence | 貸出可否の判定に使う読み取りはトランザクションの外で行い、書き込みトランザクションで書籍の版番号に加えて受取済みにする予約の版番号と取置中の状態も照合し、どちらかが変わっていれば 409 version-conflict で全体を巻き戻す | spec_absent | confirmed |
| A-001 | frontend-staff | error_handling | createLoan が 404 (削除済みの書籍・利用者) を返したとき、貸出受付画面は 409 と同じ notLendable variant にする | spec_absent | auto_confirmed |
| A-002 | frontend-staff | input_validation | createLoan が 400 を返したとき、画面は default variant のまま ValidationProblem.errors の patronNumber / bookId を CounterLookup の patronError / bookError に出し、対応する項目エラーが 1 件も無ければ error variant にする | spec_absent | auto_confirmed |
| A-003 | frontend-staff | error_handling | createLoan が 400 / 404 / 409 / 201 以外 (401 / 403 / 5xx など) を返したとき、error variant にし、Alert の本文には Problem.detail (無ければ title) をそのまま出す | spec_absent | auto_confirmed |
| A-004 | frontend-staff | error_handling | notLendable のとき、Problem.code が patron-not-found / patron-has-overdue-loan なら利用者番号欄 (patronError) に、それ以外 (book-* と version-conflict) なら書籍 ID 欄 (bookError) に Problem.detail を出す | spec_absent | auto_confirmed |
| A-005 | frontend-staff | error_handling | notLendable の Alert は story の固定文言ではなく、サーバの Problem.title を見出し、Problem.detail を本文にする | spec_absent | auto_confirmed |
| A-006 | frontend-staff | data_format | 貸出完了時の DueDateDisplay の daysLeft は、登録直後なので loanPeriodDays と同じ値にする (端末の時計は使わない) | spec_absent | auto_confirmed |
| A-007 | frontend-staff | data_format | 貸出完了メッセージは利用者の氏名ではなく利用者番号で「利用者 P000123 に貸し出しました」と出し、貸出内容に利用者区分を出さない | spec_absent | auto_confirmed |
| A-008 | frontend-staff | input_validation | 読み取った利用者番号と書籍 ID は前後の空白だけを除いて送り、形式 (^P[0-9]{6}$ / uuid) の事前検証は画面でせずサーバの 400 に任せる | spec_absent | auto_confirmed |

## 9. 逸脱と既知の課題 (抽出 + 要約)

未解決の課題 (issues):
- [rule] 基盤の生成物でテストの配線が抜けている (test script と cucumber.js)
- [rule] 計装の基盤が日本語のシナリオ名と usecase の計装に対応していない
- [contract] 20260924_090000_register-loan
- [requirement] 20260924_120000_loan-period-mapping
- [requirement] 20260924_120001_loan-limit-count
- [contract] 20260924_130000_frontend-api-client-missing
- [rule] 20260924_130001_frontend-staff-toolchain

Verifier の指摘:
- [minor] 貸出期間の利用者区分×媒体種別対応表は要求に値が無く、全組み合わせ 14 日を仮置きしている (backend-api, apps/backend-api/src/domain/loan/loan-period.ts:20)
- [minor] 貸出可否条件の『利用者区分ごとの貸出上限冊数を超えない』を実装していない (値が要求に無い) (backend-api, apps/backend-api/src/domain/loan/loan.ts:81)
- [minor] 貸出可否条件の複数条件を満たさない場合の判定順序 (存在→書籍状態→延滞) は要求に明記が無い (backend-api, apps/backend-api/src/domain/loan/loan.ts:89)
- [minor] 未登録 (未削除でなく存在しない) 書籍・利用者の 404 文言は契約に規定が無い (backend-api, apps/backend-api/src/domain/loan/errors.ts:27)
- [major] 本番用 OIDC 検証 Authenticator の実装は無く、テスト専用の代替認証だけが存在する (backend-api, apps/backend-api/src/testing/test-authenticator.ts:10)
- [minor] 業務日付のタイムゾーン (Asia/Tokyo) は契約・ルールに規定が無い (backend-api, apps/backend-api/src/gateway/clock/clocks.ts:6)
- [major] データアクセスログの出力項目・拒否時の記録有無・除外項目は ADR に規定が無い (backend-api, apps/backend-api/src/usecase/loan/register-loan.ts:25)
- [minor] 想定外失敗時の 500 応答形式は契約に規定が無い (backend-api, apps/backend-api/src/presentation/http/problem.ts:58)
- [minor] リクエスト本文サイズ上限 (64KiB) は契約に規定が無い (backend-api, apps/backend-api/src/presentation/http/http-io.ts:5)
- [major] 入力検証 (400) と認可判定 (403) の優先順位は契約・ルールに規定が無く、権限チェックの位置の判断にあたる (backend-api, apps/backend-api/src/presentation/http/loans/create-loan-handler.ts:43)
- [major] イベント payload の項目構成と貸出の初期版番号は契約に規定が無い (backend-api, apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:96)
- [major] 読み取りのトランザクション境界と予約側版番号の楽観ロック照合は ADR 0004 に明記が無い (backend-api, apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:165)
- [minor] A-010 の category (error_handling) と Verifier 独立判定の verified_category (security) が不一致 (backend-api, apps/backend-api/src/presentation/http/loans/create-loan-handler.ts:43)
- [major] docs/rules/tier-frontend.md の必須指示『API 呼び出しは packages/contracts の生成クライアント経由。fetch / axios の直書き禁止』『入力: 自ティアが consumer の契約 (OpenAPI) の生成物』に反し、契約の生成型・生成クライアントが存在しないため、contract-slice.json の schemas を手書きで写した型 (loan-api-types.ts) と手書きの API クライアント (loan-api.ts) を使っている。 (frontend-staff, apps/frontend-staff/src/api-client/loan-api-types.ts, apps/frontend-staff/src/api-client/loan-api.ts)
- [minor] 404 → notLendable variant の割当は仕様に明示が無い真の前提 (spec_absent)。 (frontend-staff, apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:70)
- [minor] 400 の画面表示先 (default variant + 項目エラー) は仕様に明示が無い真の前提 (spec_absent)。 (frontend-staff, apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:101)
- [minor] 401/403/5xx 等その他ステータスの表示方針は仕様に明示が無い真の前提 (spec_absent)。 (frontend-staff, apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:144)
- [minor] Problem.code から入力欄 (患者/書籍) への割当は仕様に明示が無い真の前提 (spec_absent)。実装が使う code 集合は契約の実コード一覧と一致することを確認した。 (frontend-staff, apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:91)
- [minor] notLendable Alert の文言をサーバ Problem から組み立てる方針は仕様に明示が無い真の前提 (spec_absent)。 (frontend-staff, apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:89)
- [minor] daysLeft = loanPeriodDays の算出は仕様に明示が無い真の前提 (spec_absent)。当該シナリオの前提 (本日=貸出日) の範囲では矛盾しない。 (frontend-staff, apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:133)
- [minor] 完了メッセージに氏名でなく利用者番号を使い利用者区分を表示しない方針は仕様に明示が無い真の前提 (spec_absent)。createLoan 応答に該当フィールドが無いことを確認した。 (frontend-staff, apps/frontend-staff/src/screens/loan-checkout/loan-checkout-state.ts:124)
- [minor] trim のみで形式の事前検証をしない方針は仕様に明示が無い真の前提 (spec_absent)。 (frontend-staff, apps/frontend-staff/src/screens/loan-checkout/submit-loan-checkout.ts:9)

<!-- 要約: 既知の課題の背景と対処方針。根拠はコード位置 path:line -->
<!-- 要約:begin -->
**既知の制約 (要求の未決事項)**

| 課題 | 背景 | 現在の実装 | 対処方針 |
|---|---|---|---|
| 貸出期間の対応表 | 要求は「利用者区分と媒体種別に応じた貸出期間 (7・14・21 日)」だけを定め、対応表の値が無い (apps/backend-api/src/domain/loan/loan-period.ts:15) | 全組み合わせを 14 日で仮置きする (apps/backend-api/src/domain/loan/loan-period.ts:20) | 対応表が決まったら `LOAN_PERIOD_TABLE` の 1 箇所だけを直す (apps/backend-api/src/domain/loan/loan-period.ts:18) |
| 貸出上限冊数 | 利用者区分ごとの上限冊数の値が未決である (apps/backend-api/src/domain/loan/loan.ts:79) | 上限冊数を判定せず、上限による拒否をしない (apps/backend-api/src/domain/loan/loan.ts:81) | 値が決まったら貸出可否の判定 `registerLoan` に条件を加える (apps/backend-api/src/domain/loan/loan.ts:81) |

**Verifier の major 指摘**

- 本番用の OIDC 検証は無く、変更ファイルにある認証はテスト専用の `TestAuthenticator` だけである (apps/backend-api/src/testing/test-authenticator.ts:4)。
- `TestAuthenticator` は Authorization ヘッダが無いリクエストを司書とみなす (apps/backend-api/src/testing/test-authenticator.ts:10)。
- HTTP の入口は `Authenticator` を注入で受け取るため、本番用の実装を差し込める (apps/backend-api/src/presentation/http/app.ts:15)。
- データアクセスログは、action・操作者の subject とロール・結果・対象 ID・理由 code を記録し、項目は ADR の規定ではなく実装で決めている (apps/backend-api/src/usecase/loan/register-loan.ts:37)。
- 入力検証 (400) を認可判定 (403) より先に行うため、利用者ロールが不正な本文を送ると 400 になる (apps/backend-api/src/presentation/http/loans/create-loan-handler.ts:43)。
- イベント payload の項目構成は契約の規定ではなく実装で決めている (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:96, apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:143)。
- 判定用の読み取りをトランザクション外で行い、予約側も版番号で照合する方式は ADR 0004 に明記が無い (apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:28, apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:165)。
- 上の 4 件 (ログ項目・400/403 の順序・payload・読み取り境界) は、レビューで confirmed として承認済みである (apps/backend-api/src/usecase/loan/register-loan.ts:37, apps/backend-api/src/presentation/http/loans/create-loan-handler.ts:43, apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:96, apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts:165)。
- frontend-staff は契約の生成クライアントが無いため、手書きの型と API クライアントを使う (apps/frontend-staff/src/api-client/loan-api.ts:4)。
- 手書きクライアントは fetch を直接呼ばず、注入された `ApiTransport` に送受信を任せる (apps/frontend-staff/src/api-client/loan-api.ts:6)。
- 生成クライアントが用意されたら、`ApiTransport` の実装を差し替える方針である (apps/frontend-staff/src/api-client/loan-api.ts:7)。

**仕様に無い前提の主なもの (minor)**

- 存在しない書籍・利用者の 404 文言は、実装で「指定した書籍は見つかりません」「指定した利用者は見つかりません」と決めている (apps/backend-api/src/domain/loan/errors.ts:27, apps/backend-api/src/domain/loan/errors.ts:36)。
- リクエスト本文の上限 64 KiB は、実装で決めている (apps/backend-api/src/presentation/http/http-io.ts:5)。
- 画面は形式の事前検証をせず、前後の空白だけを除いてサーバの 400 に任せる (apps/frontend-staff/src/screens/loan-checkout/submit-loan-checkout.ts:9)。
<!-- 要約:end -->
