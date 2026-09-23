---
id: "0001"
title: "ティアは backend-api の 1 構成とする"
status: accepted
date: 2026-09-23
supersedes: []
superseded_by: null
basis: requirements@abc1234
scope: [system]
confidence: high
tiers:
  - id: backend-api
    dir: apps/backend-api
    kind: backend
    lang: typescript
    provides: [api]
    consumes: [db]
datastore_owner: backend-api
rules:
  - scope: common
    text: "backend-api を単一ティアとして置く"
---

# 背景

API 処理のみで画面が無い。arch_test を持つ rule を書き忘れている (検証で検出される想定)。

# 決定

backend-api の 1 ティアにする。

# 却下した案

- 複数ティア: 現時点では過剰。

# 影響

依存方向の機械検証が付かない。
