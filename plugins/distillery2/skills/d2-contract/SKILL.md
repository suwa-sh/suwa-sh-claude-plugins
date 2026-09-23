---
name: distillery2:d2-contract
description: >-
  契約 (OpenAPI / AsyncAPI / DB スキーマ) を分割 YAML で管理し、bundle と UC ごとの slice、契約テストを生成する。
  mode=skeleton (段階③: カタログ・共通コンポーネント・エラー型) と mode=uc (段階④: 1 UC 分の差分) の 2 モード。
  UC が使う operation には examples を必須にし、無ければ止めて課題にする。
---

# d2-contract

> 実装状況: P4 で v1 `distillery:dist-spec` の契約部分 (contract-catalog、compileContracts / bundleAsyncapi / compileRdbSchema、validator) を移植する。個別仕様 (spec.md / tier md) の生成は持ち込まない。

## 入出力

| mode | 入力 | 出力 |
|---|---|---|
| skeleton | `docs/adr/*`、`docs/requirements/rdra/情報.tsv` `状態.tsv` | `contracts/contracts.json`、`contracts/openapi/`、`contracts/asyncapi/`、`contracts/db/`、`contracts/generated/` |
| uc | `docs/requirements/use-cases.yaml` の該当行、`features/<業務>/<uc_slug>.feature`、RDRA の該当行 | 分割ファイルの差分、`contracts/generated/slices/<uc_slug>/`、契約テスト (d2-foundation の生成スクリプト経由) |

出力の先頭に `basis: requirements@<sha> adr@<sha>` を付ける。
