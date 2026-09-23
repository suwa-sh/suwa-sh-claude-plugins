---
name: distillery2:d2-asbuilt
description: >-
  段階④の最後に、実装からドキュメントを抽出する。テスト結果・実行トレース・契約 slice・差分から UC ごとの as-built
  (docs/as-built/<業務>/<UC>/) と全体横断の追跡表 (docs/as-built/_system/) を作る。抽出 (決定論) と要約 (LLM) を節ごとに分け、
  要約は必ずコード位置を根拠に付ける。手で書かない。
---

# d2-asbuilt

> 実装状況: P7 で新規に作る (extractAsBuilt / renderSequence / buildTraceIndex)。

## 入出力

| 読むもの | 書くもの |
|---|---|
| `reports/*.json`、`traces/*.jsonl`、`docs/requirements/use-cases.yaml`、契約 slice、`git diff --name-only`、dependency-cruiser の JSON | `docs/as-built/<業務>/<UC>/{index.md, sequence.md, coverage.md}`、`docs/as-built/_system/{traceability-index.json, dependency-graph.md, api-inventory.md}` |

抽出節は同じ入力から同じ出力が出る。要約節は `<!-- 要約 -->` プレースホルダにだけ書く。
