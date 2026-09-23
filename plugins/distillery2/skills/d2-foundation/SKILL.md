---
name: distillery2:d2-foundation
description: >-
  段階③「基盤」の機械部分。ADR から開発ルール (docs/rules/) とアーキテスト (依存方向) を生成し、テスト基盤
  (packages/test-support: 計装 tracer・pglite・Cucumber support)、契約テストの生成、DB migration、.distillery/config.yaml、
  CI、モノレポ骨格を冪等に作る。phase=F1..F6 で部分実行できる。
---

# d2-foundation

> 実装状況: P3 (F1〜F5) と P4 (契約テスト・DB)、P5 (F6) で v1 `distillery-impl:dist-impl-bootstrap` を再構成する。

## phase

| phase | 作るもの |
|---|---|
| F1 | `docs/rules/{index,common,tier-<kind>,testing}.md` (ADR の `rules:` + テンプレートから生成) |
| F2 | `.dependency-cruiser.cjs` とレイヤ規約テスト |
| F3 | `packages/test-support/` (tracer、pglite harness、Cucumber World と hooks)、`features/support/` |
| F4 | 契約テストの生成 (`apps/<provider>/test/contract/`)、DB migration と DB 契約テスト |
| F5 | `.distillery/config.yaml`、CI、`package.json` (workspaces)、`apps/`・`packages/` の骨格 |
| F6 | `d2-design` の Storybook 出力を `packages/ui` に取り込む |

出力の先頭に `basis: adr@<sha> contracts@<sha>` を付ける。
