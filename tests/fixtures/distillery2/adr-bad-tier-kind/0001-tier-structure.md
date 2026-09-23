---
id: "0001"
title: "ティア構成を決める"
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
    kind: middleware
    lang: typescript
    provides: [api]
    consumes: [db]
datastore_owner: backend-api
rules:
  - scope: common
    text: "backend-api を置く"
---

# 背景

API ティアを 1 つ置く。

# 決定

backend-api を置く。

# 却下した案

- なし。

# 影響

なし。
