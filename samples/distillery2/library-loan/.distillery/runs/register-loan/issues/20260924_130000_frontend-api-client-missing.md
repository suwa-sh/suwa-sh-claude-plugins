---
kind: contract
uc: register-loan
tier: frontend-staff
status: open
---

# frontend 向けの生成型・生成クライアントが packages/contracts/api に無い

## 事実

- `docs/rules/tier-frontend.md`: 「API 呼び出しは `packages/contracts` の生成クライアント経由。`fetch` / `axios` の直書き禁止」
- `docs/rules/tier-frontend.md`: 入力は「自ティアが consumer の契約 (OpenAPI) の生成物」
- `packages/contracts/api/` には `stubs/createLoan.{201,400,404,409}.json` しか無い。TypeScript の型 (CreateLoanRequest / Loan / Problem) も、createLoan を呼ぶクライアントも生成されていない
- `packages/contracts` には `package.json` も無く、workspace パッケージとして import できない (相対パスでのみ参照可能)

## frontend-staff での暫定対応 (attempt-1)

- 契約 slice (`contracts/generated/slices/register-loan/contract-slice.json`) の schemas を
  `apps/frontend-staff/src/api-client/loan-api-types.ts` に写した (手書きの型)
- `apps/frontend-staff/src/api-client/loan-api.ts` は HTTP 送受信を注入された `ApiTransport` に任せ、`fetch` を直接呼ばない
- 生成物ができたら、手書きの型を削除して生成型の import に置き換え、`ApiTransport` を生成クライアントに差し替える

## 確認したいこと

- d2-contract の生成対象に、consumer (frontend-patron / frontend-staff) 向けの TypeScript 型と createLoan クライアントを加えるか
- `packages/contracts` を workspace パッケージ (package.json + exports) にするか
