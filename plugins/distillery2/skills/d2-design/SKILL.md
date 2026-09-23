---
name: distillery2:d2-design
description: >-
  段階③「基盤」の画面部品。RDRA の UC と情報、ADR の UI 決定から、デザイントークンと Storybook 部品を作る。
  画面と UC の対応 (docs/design/screens.yaml) を出し、d2-foundation phase=F6 が packages/ui に取り込む。
  画面を持たないプロダクトでは呼ばれない。
---

# d2-design

> 実装状況: P5 で v1 `distillery:dist-design-system` (tokens / components / storybook の生成手順) を移植する。assets 生成・events・提案バリアントは持ち込まない。

## 入出力

| 入力 | 出力 |
|---|---|
| `docs/requirements/rdra/*`、`docs/requirements/use-cases.yaml`、`docs/adr/*` (UI 関連) | `docs/design/screens.yaml`、`packages/ui/` (tokens、components、stories) |
