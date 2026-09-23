---
id: "0002"
title: "ティアは frontend / backend-api / worker の 3 構成とする"
status: accepted
date: 2026-09-23
supersedes: []
superseded_by: null
basis: requirements@abc1234
nfr_refs: ["A.1.1", "B.1.1"]
scope: [system]
confidence: high
rules:
  - scope: common
    text: "ティアは frontend / backend-api / worker の 3 つに分ける"
  - scope: tier:backend
    text: "backend-api の domain 層は infrastructure 層へ依存してはならない"
    arch_test:
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/infrastructure/**"
      effect: forbid
---

# 背景

社外利用者の画面操作と、タイマー起動の非同期処理が両方ある。

# 決定

frontend / backend-api / worker の 3 ティアに分ける。

# 却下した案

- モノリシック 1 ティア: 非同期処理と画面配信の運用要件が異なる。

# 影響

モノレポで domain / repository を共有する。
