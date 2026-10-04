---
name: d2-foundation
description: >-
  段階③「基盤」の機械部分。ADR から開発ルール (docs/rules/) とアーキテスト (.dependency-cruiser.cjs) を生成し、
  テスト基盤 (packages/test-support: 計装 tracer・pglite ハーネス・Cucumber support)、.distillery/config.yaml、
  CI、モノレポ骨格を冪等に作り、依存を入れる。契約の骨格と画面部品の後に、仕上げ (契約込みの再生成・画面部品の取り込み・
  契約テストの生成・チェックポイント) も行う。
  phase=all | finish | F1..F9 で部分実行する。
---

# d2-foundation

入出力の正本: [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) (図: [dataflow.md](../d2-common/references/dataflow.md))

段階③の「機械が検証する土台」を作る。人が決めた ADR (docs/adr) と契約 (contracts/contracts.json) を入力に、
開発ルール・アーキテスト・テスト基盤・実行設定・CI・骨格を生成する。すべて冪等で、決定論的な生成物には
`basis:` ヘッダを付ける。

通常は d2-run が呼ぶ。単体でも `phase=` を指定して動かせる。

## 引数

```
phase=all | finish | F1..F9   # 既定 all
ui=true | false               # phase=finish だけ。今回の d2-design が部品を生成したか (F6 を回すか)。d2-run が決める
adr=docs/adr                  # ADR ディレクトリ
```

d2-run は段階③で 2 回呼ぶ (還流の開発ルールとアーキテストの作り直しは、d2-run が回す `feedbackBatch.js` が F1・F2 のスクリプトを直接回す)。

| 呼ぶとき | phase | 順 |
|---|---|---|
| ③ の最初 | `all` | F1 → F2 → F3 → F5 → F7 |
| 契約の骨格 (d2-contract mode=skeleton) と画面部品 (d2-design) の後 | `finish` | F8 → F6 (`ui=true` のときだけ) → F7 (F6 を回したときだけ) → F4 → F9 |

- スクリプトは `${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/` にある。`--cwd <repo>` で対象リポを指す。
- どの phase も再実行して安全。
- F4 と F8 は他のスキルのスクリプト (d2-contract の genContractTests、d2-decide の genArchitectureDoc) を呼ぶ。
- git について: 自分で git コマンドを打たない (commit は d2-run が行う)。genQlty.js の内部の git (読み取りと、qlty init に未追跡ファイルを見せるための一時的な `git add -N`。終わったら index を書き戻す) は例外。

## phase が読むもの・書くもの

| phase | スクリプト | 読む | 書く |
|---|---|---|---|
| F1 | `genRules.js` | `docs/adr/*.md` (`rules[]`・`tiers[].kind`)、`references/rule-templates/` | `docs/rules/{index,common,testing,tier-<kind>}.md` |
| F2 | `genArchTests.js` | `docs/adr/*.md` (`rules[].arch_test`) | `.dependency-cruiser.cjs` |
| F3 | `genTestSupport.js` | `templates/test-support/`、`templates/features-support/`、`templates/cucumber.js`、`templates/tsx-register.js` | `packages/test-support/**`、`features/support/**`、`cucumber.js`、`tsx-register.js` (cucumber.js が読む ESM ローダ) |
| F4 | `genContractTests.js` (d2-contract のスクリプト。骨格分) | `contracts/**`、`.distillery/config.yaml` | `apps/*/test/contract/**`、`packages/contracts/**` |
| F5 | `genConfig.js` / `genSkeleton.js` / `genCi.js` / `genQlty.js` | `docs/adr/*.md` (`tiers[]`・`datastore_owner`・testing `capabilities`)、`contracts/contracts.json`、`.distillery/config.yaml` (genConfig が書いたものを genCi が読む) | `.distillery/config.yaml`、`package.json`、`tsconfig.base.json`、`.gitignore`、`biome.json`、`apps/*/`、`packages/*/`、`.github/workflows/ci.yml`、`.qlty/qlty.toml` |
| F6 | `importUi.js` | `docs/design/storybook-app/src/` (d2-design の出力) | `packages/ui/**`、`packages/ui/.imported.yaml` |
| F7 | `npm install` → `genQlty.js --refresh` | `package.json`、`package-lock.json`、`.qlty/qlty.toml` | `package-lock.json`、`.qlty/qlty.toml` |
| F8 | `genConfig.js` → `genCi.js` → `genArchitectureDoc.js` (d2-decide のスクリプト) | `docs/adr/*.md`、`contracts/contracts.json`、`docs/requirements/rdra/**`、`.distillery/config.yaml` | `.distillery/config.yaml`、`.github/workflows/**`、`docs/adr/architecture.md` |
| F9 | `runGates.js --uc bootstrap --upto static` | `.distillery/config.yaml`、`package.json`、`.qlty/qlty.toml`、`apps/*/test/contract/**`、`.dependency-cruiser.cjs`、`<run>/reports/**` | `<run>/reports/**` |

- F4: 骨格分の契約テストだけ。UC ごとの契約テストと DB migration は **d2-contract mode=uc が持つ** (下記)
- F5: `.distillery/config.yaml` の `commands.quality` が qlty ゲート。`.github/workflows/ci.yml` は permissions 最小 + qlty。
  `.qlty/qlty.toml` は **qlty 自身の提案 (`qlty init --dry-run`) を土台**に distillery2 の上乗せ (biome 版固定・生成物の除外・radarlint を low)。qlty CLI が無ければ固定リスト
- F7: lockfile (`package-lock.json`) の書き手は ③ ではこの phase だけ (単一 writer)。`npm install` は `node_modules/**` (gitignore) も作る。
  npm 10 で落ちたら [references/troubleshooting.md](references/troubleshooting.md) の回避策を使い、報告に書く
- F9: `<run>` = `.distillery/runs/bootstrap` (仮の slug)。exit 0 でなければ直さずに報告して止まる (d2-run が受理時に `reports/gates.json` を読む)

### phase=all の順

F1 → F2 → F3 → F5 (genConfig → genSkeleton → genCi → genQlty) → F7 (npm install → genQlty --refresh)。F5 の genCi は config.yaml を読むので genConfig の後に走らせる。
genQlty は qlty init の自動検出に package.json / biome.json / workflow を見せるため F5 の **最後** に走らせる (未追跡ファイルは一時的に `git add -N` して戻す)。
提案はその時点でリポにあるファイル種別で決まる (lockfile が無いと osv-scanner が入らない、python が増えると ruff が入る) ので、
F7 で npm install の後に `genQlty.js --refresh` で増えた分を足す (減らさない)。各 UC の integrate の後は d2-run が同じ `--refresh` を回す。
契約の骨格は redocly (F7 で入る) を使うので、F7 は契約の骨格より前に済ませる。

### phase=finish の順

契約の骨格と画面部品が揃ってから回す。config / CI は契約 (`contracts/contracts.json`) を読み、C4 図は契約の矢印をこの時点で初めて描ける (0.1.10 実走 ③-3 / ③-5、0.1.13 実走 ③-4)。

1. F8: config・CI・C4 図を契約込みで作り直す (いずれも自分の生成物なら上書きする)
2. F6: `ui=true` なら `docs/design/storybook-app/` を `packages/ui` に取り込む。`ui=false` なら F6 と次の F7 を飛ばす
   (前の実行の `docs/design/` が残っていても取り込まない。画面の有無は d2-run の判断に従う)。`ui=true` なのに出力が無ければ
   (d2-design が「画面を持たない」と判断して skip した) F6 と F7 を飛ばし、その旨を報告する
3. F7: `packages/ui` が workspace に加わったので `npm install` をもう一度 (lockfile を更新) → `genQlty.js --refresh`
4. F4: 骨格分の契約テストを生成する
5. F9: チェックポイント。`runGates.js --uc bootstrap --upto static` が exit 0

## 実行 (例)

```
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genRules.js --adr docs/adr --out docs/rules --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genArchTests.js --adr docs/adr --out .dependency-cruiser.cjs --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genTestSupport.js --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genConfig.js --adr docs/adr --contracts contracts/contracts.json --out .distillery/config.yaml --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genSkeleton.js --adr docs/adr --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genCi.js --config .distillery/config.yaml --cwd <repo>
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genQlty.js --cwd <repo>   # qlty init の提案 + 上乗せ。--fallback で固定リスト、--force で作り直し
npm install                                                                               # F7 (<repo> で)
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genQlty.js --refresh --cwd <repo>   # F7。提案で増えた plugins だけ足す
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genConfig.js --adr docs/adr --contracts contracts/contracts.json --out .distillery/config.yaml --cwd <repo>   # F8
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genCi.js --config .distillery/config.yaml --cwd <repo>   # F8
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/genArchitectureDoc.js docs/adr docs/adr/architecture.md --contracts contracts/contracts.json --rdra docs/requirements/rdra requirements=docs/requirements contracts=contracts --cwd <repo>   # F8 (basis に契約も記録する)
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/importUi.js --from docs/design/storybook-app --cwd <repo>   # F6
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-contract/scripts/genContractTests.js contracts --config .distillery/config.yaml --out-root <repo>   # F4 (骨格分)
node ${CLAUDE_PLUGIN_ROOT}/scripts/runGates.js --uc bootstrap --upto static   # F9 (<repo> で)
```

F1・F2 のスクリプトは `--check` (書かずに、生成物が古ければ exit 1) を持つ。

## 冪等性のルール

- 生成物は `basis:` ヘッダ (basis.js) を持つものだけ上書き再生成する: `docs/rules/*`、`.dependency-cruiser.cjs`、
  `.distillery/config.yaml`、`packages/ui/.imported.yaml`。直したい変更は ADR・契約・design に戻す。
  `genConfig.js` / `genRules.js` は、出力先に `basis:` ヘッダの無い手書きファイルがあると上書きせず警告して exit 1 する
  (意図的に潰すときだけ `--force`)。手書き設定・ルールを phase 再実行で失わないため。
- 骨格とテンプレート展開 (package.json、tsconfig.base.json、apps/packages のディレクトリ、
  packages/test-support/**、features/support/**、cucumber.js) は **既存ファイルを上書きしない** (skip として報告)。
  リポ側のローカル改訂を消さないため。
- 決定論: F1・F2・F5 は同じ入力・同じ git 状態で 2 回実行すると同一出力になる (ADR id 昇順、arch_test 名昇順で並べる)。

## チェックポイント

- F9 は F7 (`npm install`) の後に回すこと。
  static ゲートの arch test は `npx depcruise` を実行するため、`dependency-cruiser` が入っていないと fail する
  (未インストールでも skip はされない)。コマンド定義そのものが無いゲートだけ skip される。
- `genRules.js` を 2 回実行して diff が無いこと。

## F4 と d2-design への受け渡し

- **F4 (契約テスト)**: d2-foundation が回すのは骨格分だけ (phase=finish)。スクリプトは d2-contract のもの:
  `${CLAUDE_PLUGIN_ROOT}/skills/d2-contract/scripts/genContractTests.js` が `apps/<provider>/test/contract/` を生成する。
  UC ごとの契約テストと、`genRdbDdl.js` による `apps/<datastore_owner>/migrations/*.sql` と DB 契約テストは d2-contract mode=uc が持つ。
- **F6** は d2-design が Storybook 出力を出した後に phase=finish の中で回す。`packages/test-support/README.md` が、
  実装者 (d2-implement mode=integrate) が結線する composition root (`apps/<backend>/src/test-app.ts`) の契約を書く。

## 参照

- [references/adr-inputs.md](references/adr-inputs.md) — F1/F5 が読む ADR キー
- [references/rule-templates/](references/rule-templates/) — 開発ルールの土台
- [references/test-infra.md](references/test-infra.md) — 検証済みライブラリ版と API、v1 から落としたもの
- [references/repo-layout.md](references/repo-layout.md) — 対象リポのレイアウト
- [references/ci.md](references/ci.md) — CI の job 構成
- [references/troubleshooting.md](references/troubleshooting.md) — qlty / biome で踏んだ問題と回避策
- 実行設定の形: [../d2-run/references/config-schema.md](../d2-run/references/config-schema.md)
