---
name: distillery2:d2-decide
description: >-
  段階②「決定」。RDRA と USDM から非機能要求グレード表 (docs/nfr/) を推論し、アーキテクチャの決定記録 (docs/adr/) を書く。
  設計書は書かない。ADR の front matter に機械可読の rules を持たせ、段階③がルール文書とアーキテストを生成する。
  非機能グレード表は決定の根拠として ADR とは別に残す。
---

# d2-decide

> 実装状況: P2 で v1 `distillery:dist-quality-attributes` を移植し、ADR スキーマと候補カタログ (v1 dist-architecture の推論規則を要約) を追加する。

## 入出力

| 入力 | 出力 |
|---|---|
| `docs/requirements/requirements.yaml`、`docs/requirements/rdra/*.tsv`、`docs/requirements/use-cases.yaml` | `docs/nfr/nfr-grade.yaml` / `.md`、`docs/adr/NNNN-<slug>.md`、`docs/adr/index.md` |

出力の先頭に `basis: requirements@<sha>` を付ける。
