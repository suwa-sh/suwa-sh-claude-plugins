---
id: "0004"
title: キャッシュ層 (未採用)
status: proposed
scope: [backend]
nfr_refs: []
rules:
  - scope: common
    text: "この行は proposed なので rules に出てはいけない。"
  - scope: tier:backend
    text: "この arch_test も出てはいけない。"
    arch_test:
      from: "apps/backend-api/src/cache/**"
      to: "apps/backend-api/src/domain/**"
      effect: forbid
---

# キャッシュ層 (未採用)

status: proposed。基盤は無視する。
