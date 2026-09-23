---
name: distillery2:d2-foundation
description: >-
  段階③「基盤」の機械部分。ADR から開発ルール (docs/rules/) とアーキテスト (.dependency-cruiser.cjs) を生成し、
  テスト基盤 (packages/test-support: 計装 tracer・pglite ハーネス・Cucumber support)、.distillery/config.yaml、
  CI、モノレポ骨格を冪等に作る。契約テストと DB migration は d2-contract が持つ。phase=F1..F6 | all で部分実行する。
---

# d2-foundation

段階③の「機械が検証する土台」を作る。人が決めた ADR (docs/adr) と契約 (contracts/contracts.json) を入力に、
開発ルール・アーキテスト・テスト基盤・実行設定・CI・骨格を生成する。すべて冪等で、決定論的な生成物には
`basis:` ヘッダを付ける。

通常は d2-run が呼ぶ。単体でも `phase=` を指定して動かせる。

## 引数

```
phase=F1..F6 | all      # 既定 all (F1→F5)。F6 は d2-design の後に d2-run が別途呼ぶ
adr=docs/adr            # ADR ディレクトリ
```

- スクリプトは `${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/` にある。`--cwd <repo>` で対象リポを指す。
- どの phase も再実行して安全。

## phase が読むもの・書くもの

| phase | スクリプト | 読む | 書く |
|---|---|---|---|
| F1 | `genRules.js` | ADR の `rules[]`、`tiers[].kind`、`references/rule-templates/` | `docs/rules/{index,common,testing,tier-<kind>}.md` |
| F2 | `genArchTests.js` | ADR の `rules[].arch_test` | `.dependency-cruiser.cjs` |
| F3 | `genTestSupport.js` | `templates/test-support/`、`templates/features-support/`、`templates/cucumber.js` | `packages/test-support/**`、`features/support/**`、`cucumber.js` |
| F4 | (d2-contract) | — | 契約テスト・DB migration は **d2-contract が持つ** (下記) |
| F5 | `genConfig.js` / `genSkeleton.js` / `genCi.js` | ADR の `tiers[]`・`datastore_owner`・testing `capabilities`、`contracts/contracts.json` | `.distillery/config.yaml`、`package.json`・`tsconfig.base.json`・`.gitignore`・`apps/`・`packages/`、`.github/workflows/ci.yml` |
| F6 | `importUi.js` | `--from <d2-design 出力>` の `src/` | `packages/ui/**`、`packages/ui/.imported.yaml` |

### phase=all の順

F1 → F2 → F3 → F5 (genConfig → genSkeleton → genCi)。F5 の genCi は config.yaml を読むので genConfig の後に走らせる。
F4・F6 は all に含めない (F4 は d2-contract、F6 は d2-design の後に d2-run が呼ぶ)。

## 実行 (例)

```
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genRules.js --adr docs/adr --out docs/rules --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genArchTests.js --adr docs/adr --out .dependency-cruiser.cjs --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genTestSupport.js --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genConfig.js --adr docs/adr --contracts contracts/contracts.json --out .distillery/config.yaml --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genSkeleton.js --adr docs/adr --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genCi.js --config .distillery/config.yaml --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/importUi.js --from <d2-design 出力> --cwd <repo>   # F6
```

## 冪等性のルール

- 生成物は `basis:` ヘッダ (basis.js) を持つものだけ上書き再生成する: `docs/rules/*`、`.dependency-cruiser.cjs`、
  `.distillery/config.yaml`、`packages/ui/.imported.yaml`。直したい変更は ADR・契約・design に戻す。
- 骨格とテンプレート展開 (package.json、tsconfig.base.json、apps/packages のディレクトリ、
  packages/test-support/**、features/support/**、cucumber.js) は **既存ファイルを上書きしない** (skip として報告)。
  リポ側のローカル改訂を消さないため。
- 決定論: F1・F2・F5 は同じ入力・同じ git 状態で 2 回実行すると同一出力になる (ADR id 昇順、arch_test 名昇順で並べる)。

## チェックポイント

- 空リポで F1→F5 を通した後、`runGates.js --uc <slug> --upto static` が通ること
  (コマンドが無いゲートは skip。arch test は node_modules 未インストールなら skip 相当で fail しない構成)。
- `genRules.js` を 2 回実行して diff が無いこと。

## F4 と d2-design への受け渡し

- **F4 (契約テスト・DB)** は d2-contract の担当:
  `${CLAUDE_PLUGIN_ROOT}/skills/d2-contract/scripts/genContractTests.js` が `apps/<provider>/test/contract/` を、
  `genRdbDdl.js` が `apps/<datastore_owner>/migrations/*.sql` と DB 契約テストを生成する。
  d2-foundation は骨格 (`test/contract/` ディレクトリと config の `contract` コマンド) だけ用意する。
- **F6** は d2-design が Storybook 出力を出した後に呼ぶ。`packages/test-support/README.md` が、
  実装者 (d2-implement mode=integrate) が結線する composition root (`apps/<backend>/src/test-app.ts`) の契約を書く。

## 参照

- [references/adr-inputs.md](references/adr-inputs.md) — F1/F5 が読む ADR キー
- [references/rule-templates/](references/rule-templates/) — 開発ルールの土台
- [references/test-infra.md](references/test-infra.md) — 検証済みライブラリ版と API、v1 から落としたもの
- [references/repo-layout.md](references/repo-layout.md) — 対象リポのレイアウト
- [references/ci.md](references/ci.md) — CI の job 構成
- 実行設定の形: [../d2-run/references/config-schema.md](../d2-run/references/config-schema.md)
