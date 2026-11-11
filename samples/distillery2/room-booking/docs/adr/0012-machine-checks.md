---
id: "0012"
title: "機械チェックは既定の道具で 6 観点 (生成・整形・lint・ビルド・テスト・安全) を回す"
status: accepted
date: "2026-11-04"
supersedes: []
superseded_by: null
basis: "requirements@f4263122f7f53c061d36818286bf20f7d36c4fb2"
nfr_refs: ["E.3.1.1", "C.2.1.2"]
scope: [system]
confidence: high
checks:
  repo:
    format: biome
    lint: qlty
    security: [secrets]
  tiers:
    "*":
      format: biome
      lint: biome
      build: tsc
      test: vitest
      security: [dependency-audit, sast]
rules:
  - scope: common
    text: "コミットの前に node scripts/check.mjs --mode hook が通る状態にする (hook が自動で回す)"
  - scope: common
    text: "main に入れる前は d2-run の全段のゲートで止める (生成物の鮮度と security は報告にとどめる)。main への push の後に CI が node scripts/check.mjs --mode ci で 6 観点 (generate / format / lint / build / test / security) を回し、落ちたらすぐ直す"
---

# 背景

両ティアとも TypeScript で、段階③の骨格のままのモノレポになる。外部から入力を受けるのは backend-api だけだが、規模が小さく、ティアごとに道具を変える理由は無い。

# 決定

- リポ全体: format は biome、lint は qlty、security は秘密の検出 (secrets)。
- ティア (frontend・backend-api とも同じ): format と lint は biome、build は tsc、単体テストは vitest、security は依存の監査 (dependency-audit) と SAST。
- ティアごとの上書きはしない。

# 却下した案

- frontend の SAST を外す: 画面も利用者の入力を扱う。規模が小さく、検査の時間も小さい。
- ESLint と Prettier を使う: 骨格の既定 (biome) と二重になる。

# 影響

- 依存の脆弱性の検査は、UC と関係なく脆弱性の情報の更新で落ちうる。d2-run のゲートでは報告にとどめ、CI で止める。
