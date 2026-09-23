---
id: "0002"
title: "テストは 4 段構成とする"
status: accepted
date: 2026-09-23
supersedes: []
superseded_by: null
basis: requirements@abc1234
nfr_refs: ["E.1.1"]
scope: [testing]
confidence: medium
rules:
  - scope: testing
    text: "UC のシナリオは features/ の Gherkin として書き、API ドライバで実行する"
---

# 背景

受入基準を機械検証する。capabilities.browser を書き忘れている (検証で検出される想定)。

# 決定

4 段テスト構成とする。

# 却下した案

- 単体テストのみ: 受入の充足を確認できない。

# 影響

ブラウザ受入の有無が config に伝わらない。
