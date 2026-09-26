---
kind: contract
title: "registerReturn の 401/403/404 を契約に入れた"
uc: "register-return"
tier: "backend-api"
---

## 事実

- シナリオ (`features/貸出業務/register-return.feature`) は、成功 3 本と「未返却の貸出が無い書籍」(409) の 1 本だけを持つ。
- 認証なし (401)・司書以外のロール (403)・存在しない書籍 (404) の応答は、シナリオにも要求にも無い。
- 前 UC で同じ欠落が課題になった。
  - `.distillery/runs/register-loan/issues/20260926T1201_register-loan-auth-responses.md` (401/403)
  - `.distillery/runs/register-loan/issues/20260926T1200_register-loan-book-not-found-404.md` (404)
- 実装者は前 UC で 401 → 403 → 400 の順に判定し、書籍不在を 404 `not_found` にした (AssumptionRecord A-004 / A-006 / A-012)。

## 選択肢

| 案 | 内容 |
|---|---|
| ⭐推奨 A | registerReturn に 401 / 403 / 404 を契約として足す。401 / 403 は共通の `components/responses` を参照する。判定順序は 401 → 403 → 400 → 404 / 409 と description に書く |
| B | シナリオに無いので契約に入れず、前 UC と同じく実装者の前提 (AssumptionRecord) に任せる |

## 決定

- 案 A を採用した (⭐推奨の自動採用、2026-09-26)。
- 401 は request example `unauthorized` (`x-headers: { Authorization: null }`) で表す。
- 403 は request example `forbidden` (`x-headers: { Authorization: "Bearer test-patron-token" }`) で表す。
- 404 は request example `notFound` (存在しない書籍ID) で表す。code は `not_found`。
- registerLoan への 401 / 403 / 404 の追加はこの UC では行わない (前 UC の課題として残す)。

## 実装への影響

- 生成された契約テスト `apps/backend-api/test/contract/registerReturn.test.ts` は、operation の `x-test-headers` により `Authorization` と `Idempotency-Key` を全 example で送る。
- 401 のテストは `Authorization` を送らない。`createTestApp()` の既定ヘッダ補完 (前 UC の A-009) が残っていると、司書のトークンが補われて 401 にならない。
  - 補完を外すか、`Authorization` の補完をやめる必要がある (registerLoan の契約テストは今も補完に頼っている)。

## 追記: registerLoan にも x-test-headers を足した。tier で補完を外す

- `contracts/openapi/paths/loans.yaml` の registerLoan に、registerReturn と同じ operation の `x-test-headers` を足した。
  - `Authorization: "Bearer test-librarian-token"`
  - `Idempotency-Key: "{uuid}"`
- API の意味 (パス・スキーマ・応答) は変えていない。
- registerLoan の responses には 401 / 403 が無い。そのため `x-headers` を付ける request example (`unauthorized` / `forbidden`) は足していない。
  - 401 / 403 を足すかどうかは前 UC の課題 `20260926T1201_register-loan-auth-responses.md` で扱う。
- 再生成した `registerLoan.test.ts` と `registerReturn.test.ts` は、全ケースで補完に頼らずヘッダを送る。401 のケースだけは `Authorization` を送らない。
- `createTestApp()` の既定ヘッダ補完 (A-009) は、backend-api の tier 段階で外す。

## 別件: 返却通知の送信依頼 (outbox) の書き手

- ADR 0005 は「返却登録と同じトランザクションで通知を送信待ちとして記録する」と定める。
- この UC のシナリオは返却通知を扱わず、UC「返却通知を送信する」(notify-reserved-book-returned) へ回している。
- ⭐推奨: registerReturn の契約 (uc-index の tables) には `notifications` を入れない。notify-reserved-book-returned の契約で、返却登録のトランザクションに通知の記録を足す。
- 採用した (⭐推奨の自動採用)。uc-index の register-return の tables は loans / loan_events / books / book_events / reservations / idempotency_keys とした。
