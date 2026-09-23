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
rules:
  - scope: common
    text: "ティアは frontend / backend-api / worker の 3 つに分ける"
---

# 背景

画面操作と非同期処理がある。

# 決定

3 ティアに分ける。

# 却下した案

- モノリシック 1 ティア: 運用要件が異なる。

# 影響

モノレポで共有する。
