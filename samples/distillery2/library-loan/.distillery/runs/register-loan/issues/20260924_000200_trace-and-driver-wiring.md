---
kind: rule
stage: integrate
title: 計装の基盤が日本語のシナリオ名と usecase の計装に対応していない
---

# 計装の基盤が日本語のシナリオ名と usecase の計装に対応していない

## 事象

1. `packages/test-support/src/tracer.ts` の `sanitizeScenarioId` が英数字以外を `_` に置き換える
   - 日本語のシナリオ名がほぼ同じファイル名に潰れ、9 シナリオのトレースが 2 ファイルに混ざった
   - as-built の `buildTraceIndex.js` は 1 ファイル = 1 シナリオとして読むため、シナリオ単位の図が崩れる
2. 基盤テンプレートの `features/support/drivers/api.ts` が日本語のシナリオ名をそのまま `x-scenario-id` ヘッダに入れる
   - `ERR_INVALID_CHAR` で送信が落ちる
3. `apps/backend-api/src/test-app.ts` の `createTestApp` に usecase を包む口が無い
   - `traced('RegisterLoan', …)` を結線できず、as-built のシーケンス図に usecase の呼び出しが出ない

## UC branch での対処

- 1: d2-run が `sanitizeScenarioId` を Unicode の文字と数字を残す形 (`/[^\p{L}\p{N}._#-]+/gu`) に直した
- 2: integrate の実装者がドライバ側で URI エンコードし、受け側で復号するようにした
- 3: 未対処 (backend-api の次の attempt か、次の UC で TestAppDeps に option を足す)

## 還流の提案

- d2-foundation の genTestSupport.js のテンプレート (tracer.ts / drivers/api.ts) に 1 と 2 の修正を入れる
- tier-impl.md に「test-app は usecase を包む計装の口を持つ」ことを明記する
