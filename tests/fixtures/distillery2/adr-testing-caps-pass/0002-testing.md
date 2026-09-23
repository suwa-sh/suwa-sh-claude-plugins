---
id: "0002"
title: "テストは 4 段構成、受入はブラウザで確認する"
status: accepted
date: 2026-09-23
supersedes: []
superseded_by: null
basis: requirements@abc1234
nfr_refs: ["E.1.1"]
scope: [testing]
confidence: medium
capabilities:
  browser: true
rules:
  - scope: testing
    text: "UC のシナリオは features/ の Gherkin として書き、API ドライバとブラウザドライバで実行する"
---

# 背景

社外利用者の画面操作を受入基準で確かめる。

# 決定

4 段テスト構成とし、@browser タグの受入シナリオをブラウザドライバで実行する。

# 却下した案

- API ドライバのみ: 画面の受入を確認できない。

# 影響

CI にブラウザ受入ジョブを組む。
