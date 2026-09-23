---
id: "0001"
title: "API ティアは Express で実装する"
status: superseded
date: 2026-09-23
supersedes: []
superseded_by: "0003"
basis: requirements@abc1234
nfr_refs: ["B.1.1"]
scope: [app]
confidence: low
rules:
  - scope: tier:backend
    text: "backend-api は Express でルーティングを実装する"
---

# 背景

小規模・薄い API 層のため軽量フレームワークが妥当。

# 決定

Express を採用する。

# 却下した案

- 素の http モジュール: ルーティングとミドルウェアを自作するコストが高い。

# 影響

依存が増えるが実装が速い。
