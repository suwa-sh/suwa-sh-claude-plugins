---
kind: contract
title: "registerLoan に 401/403 の応答が無い"
uc: "register-loan"
tier: "backend-api"
---

## 事実

- 契約 `POST /loans` (registerLoan) は `security: bearerAuth` と「librarian ロールだけが呼べる」を定める。
- responses は 201 / 400 / 409 だけで、401 / 403 が宣言されていない。
- ProblemCode の enum には `unauthorized` / `forbidden` がある。
- tier-backend.md ADR 0006 は、認可を usecase でロール判定すると定める。
- Verifier の指摘 F-006 (attempt-1, major) で、security のため人の確認が要るとされた。

## 実装側の対応 (暫定)

- トークンが無い・検証できないときは 401 (`unauthorized`) を返す (AssumptionRecord A-006)。
- librarian 以外のロールは usecase で 403 (`forbidden`) を返す (A-006)。
- 401 は本文・Idempotency-Key の入力検証 (400) より先に判定する (A-012)。
- 401 / 403 / 400 は Idempotency-Key に保存しない (A-005)。

## 求める変更

- registerLoan (と bearerAuth を要求する他の operation) の responses に 401 / 403 (Problem) と example を追加する。
- 共通の `components/responses` として定義し、各 operation から参照する形を推奨する。
- 400 と 401 が同時に当てはまるときの優先順位も契約か共通ルールに書く。
