---
name: distillery2:d2-requirements
description: >-
  段階①「要求」。要望テキストを USDM (要求・仕様・受入基準) と RDRA (アクター・業務・UC・情報・状態・条件) に分解し、
  UC 一覧 (docs/requirements/use-cases.yaml) を作る。受入基準は 1 行 Gherkin としてここで人が確認する。
  UC 単位のシナリオは書かない (UC 着手時に d2-implement mode=scenario が書く)。
---

# d2-requirements

> 実装状況: P1 で v1 `distillery:dist-requirements` から移植する (USDM 分解・RDRA 構築・validator)。events/ と latest/ の仕組みは持ち込まない。

## 入出力

| 入力 | 出力 |
|---|---|
| 要望テキスト (例: `docs/input/初期要望.txt`) | `docs/requirements/requirements.yaml` / `.md` (USDM)、`docs/requirements/rdra/*.tsv` と `views/`、`docs/requirements/use-cases.yaml` |

出力の先頭に `basis:` は付けない (この段階が最上流)。
