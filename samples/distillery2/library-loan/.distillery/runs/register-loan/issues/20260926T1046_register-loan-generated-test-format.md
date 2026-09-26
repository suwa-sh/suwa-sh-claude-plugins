---
kind: rule
title: "生成契約テストが biome format で落ちる"
uc: "register-loan"
tier: "backend-api"
---

## 事実

- `apps/backend-api/test/contract/*.test.ts` (生成物) は先頭付近に `// biome-ignore-all format: generated (do not edit)` を持つ。
- それでも `npm run format:check -w apps/backend-api` (`biome format .`、Biome 2.2.5) はこの 2 ファイル (`db-schema.test.ts` / `registerLoan.test.ts`) を整形差分ありとして exit 1 にする。
- 実装前 (scaffold の時点) から format_check ゲートが落ちる状態だった。生成物は手で直せない。

## 実装側の対応 (暫定)

- `apps/backend-api/biome.json` を追加した。`"root": false` と `"extends": "//"` でルート設定を継承し、`files.includes` に `"!test/contract"` (Biome 2.2 のフォルダ除外の形。`/**` を付けると useBiomeIgnoreFolder に当たる) を足して生成テストだけを検査対象から外した。
- ルートの `biome.json` が `packages/contracts` と `contracts/generated` を外しているのと同じ扱いにした。

## 求める変更

- d2-foundation / d2-contract 側で、ルートの `biome.json` の `files.includes` に `!!apps/*/test/contract` を足す。または生成器の出力を Biome の整形済みにする。
- どちらかが入れば `apps/backend-api/biome.json` は消せる。frontend / worker の生成契約テストも同じ状態の可能性がある。
