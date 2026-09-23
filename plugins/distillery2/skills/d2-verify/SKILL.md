---
name: distillery2:d2-verify
description: >-
  段階④の独立検証。実装者とは別モデルの Verifier が、ゲート結果・テストレポート・実行トレース・AssumptionRecord を読み、
  「UC の意図どおりか」「実装者が補った前提が要求・契約・ルールと矛盾しないか」の 2 観点だけで findings を書く。
  テストを再実行しない。コードを直さない。
---

# d2-verify

> 実装状況: P6 で v1 `distillery-impl:dist-impl-verify` の観点 §1 (縮小) と §8 (前提整合) を移植する。ペルソナは `agents/d2-verifier.md`。

## 入出力

| 読むもの | 書くもの |
|---|---|
| `.distillery/runs/<slug>/reports/gates.json` と各テストの JSON レポート、`traces/*.jsonl`、`attempt-<n>/assumptions.*.yaml`、feature、要求の該当行、`docs/rules/*`、契約 slice、変更ファイル一覧 | `.distillery/runs/<slug>/attempt-<n>/findings.yaml` |

findings の verdict は `consistent | spec_absent | contradicts | unlisted`。`contradicts` は blocker。
