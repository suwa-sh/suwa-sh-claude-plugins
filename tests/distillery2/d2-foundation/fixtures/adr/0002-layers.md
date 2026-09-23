---
id: "0002"
title: レイヤ依存方向
status: accepted
scope: [backend]
nfr_refs: []
rules:
  - scope: tier:backend
    text: "domain は infrastructure に依存しない。"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/infrastructure/**"
      effect: forbid
  - scope: tier:backend
    text: "usecase は presentation に依存しない。"
    arch_test:
      from: "apps/backend-api/src/usecase/**"
      to: "apps/backend-api/src/presentation/**"
      effect: forbid
  - scope: common
    text: "エラーは利用者が直せる言葉で返す。"
---

# レイヤ依存方向

5 層の依存方向を固定する。
