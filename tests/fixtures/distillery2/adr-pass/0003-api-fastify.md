---
id: "0003"
title: "API ティアは Fastify で実装する"
status: accepted
date: 2026-09-23
supersedes: ["0001"]
superseded_by: null
basis: requirements@def5678
nfr_refs: ["B.1.1"]
scope: [app]
confidence: medium
rules:
  - scope: tier:backend
    text: "backend-api は Fastify でルーティングを実装する"
---

# 背景

性能要件の見直しで、スキーマ駆動の検証が欲しくなった。

# 決定

Fastify に切り替える。0001 を置き換える。

# 却下した案

- Express 継続: JSON Schema 検証を別途組む必要がある。

# 影響

ルーティング定義を書き換える。
