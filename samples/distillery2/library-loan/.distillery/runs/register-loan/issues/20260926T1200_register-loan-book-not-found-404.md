---
kind: contract
title: "書籍不在の 404 が registerLoan に無い"
uc: "register-loan"
tier: "backend-api"
---

## 事実

- 契約 `POST /loans` (registerLoan) の responses は 201 / 400 / 409 だけである。
- 書籍IDの書籍が存在しない (論理削除済みを含む) ときの応答が契約・シナリオ・貸出可否条件 (条件.tsv) に無い。
- ProblemCode の enum には `not_found` がある。
- Verifier の指摘 F-004 (attempt-1) で、契約への還流判断が要るとされた。

## 実装側の対応 (暫定)

- 404 (code `not_found`) を返し、貸出・書籍・予約には何も書き込まない (AssumptionRecord A-004)。
- この応答も Idempotency-Key に保存し、同じキーの再送では同じ 404 を返す (A-005)。

## 求める変更

- 次のどちらかを契約で決める。
  - registerLoan の responses に 404 (Problem、code `not_found`) と example を追加する。
  - 書籍不在を貸出可否条件の拒否として 409 に寄せ、ProblemCode を追加する。
- 決まった側に実装を合わせる。
