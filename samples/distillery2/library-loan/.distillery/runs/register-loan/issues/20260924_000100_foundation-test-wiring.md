---
kind: rule
stage: scaffold
title: 基盤の生成物でテストの配線が抜けている (test script と cucumber.js)
---

# 基盤の生成物でテストの配線が抜けている

## 事象

scaffold で red baseline を作れなかった。原因は基盤 (d2-foundation) の生成物にある次の 3 点。

1. 各ティアの `package.json` の `test` / `test:contract` が `echo` のプレースホルダのまま
   - unit ゲートが常に exit 0 になり、red baseline が成立しない
2. `cucumber.js` が `export default { default: {...} }` になっている
   - ESM では default export そのものが default profile (cucumber-js docs/profiles.md)
   - `paths` と `import` が読まれず、step 定義がロードされない
3. `features/support/drivers/api.ts` が `apps/backend-api/src/test-app` を import する
   - integrate 段階まで存在しないため、support を読むと dry-run が `ERR_MODULE_NOT_FOUND` で落ちる

## UC branch での暫定対処 (d2-run)

- `apps/backend-api` と `apps/frontend-staff` の `test` を `vitest --dir src`、`test:contract` を `vitest --dir test/contract --passWithNoTests` にした
- `cucumber.js` を default export 直下の形に直した
- support を読まない `dryrun` profile を追加した (`cucumber-js -p dryrun --dry-run`)

## 還流の提案

- d2-foundation の genSkeleton.js が test script を vitest で生成する
- templates/cucumber.js を default export 直下の形にし、dryrun profile を持たせる
- 残りのティア (frontend-patron、worker) と format_check / lint / typecheck もプレースホルダのまま。static ゲートが空振りする
