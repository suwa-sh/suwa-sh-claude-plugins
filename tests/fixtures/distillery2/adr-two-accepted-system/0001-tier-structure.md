---
id: "0001"
title: "ティアは frontend / backend-api の 2 構成とする"
status: accepted
date: 2026-09-23
supersedes: []
superseded_by: null
basis: requirements@abc1234
nfr_refs: ["A.1.1"]
scope: [system, app]
confidence: high
tiers:
  - id: frontend
    dir: apps/frontend
    kind: frontend
    lang: typescript
    provides: []
    consumes: [api]
  - id: backend-api
    dir: apps/backend-api
    kind: backend
    lang: typescript
    provides: [api]
    consumes: [db]
datastore_owner: backend-api
rules:
  - scope: common
    text: "ティアは frontend / backend-api の 2 つに分ける"
  - scope: tier:backend
    text: "backend-api の domain 層は infrastructure 層へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/infrastructure/**"
      effect: forbid
---

# 背景

画面操作と API 処理がある。

# 決定

frontend / backend-api の 2 ティアに分ける。

# 却下した案

- モノリシック 1 ティア: 画面配信と API の運用要件が異なる。

# 影響

モノレポで domain / repository を共有する。
