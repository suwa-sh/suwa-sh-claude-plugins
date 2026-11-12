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

段階③で、機械が検証する土台を作る。
入力は、人が決めた ADR (docs/adr) と契約 (contracts/contracts.json) である。
出力は、開発ルール、アーキテスト、テスト基盤、実行設定、CI、骨格である。
すべて冪等である。
決定論的な生成物には `basis:` ヘッダを付ける。

## 呼び出し

通常は d2-run が呼ぶ。
単体でも `phase=` を指定して動かせる。

```
phase=all | finish | F1..F9   # 既定 all
ui=true | false               # phase=finish だけ。今回の d2-design が部品を生成したか (F6 を回すか)。d2-run が決める
adr=docs/adr                  # ADR ディレクトリ
```

d2-run は、段階③で 2 回呼ぶ。

| 呼ぶとき | phase | 順 |
|---|---|---|
| ③ の最初 | `all` | F1 → F2 → F3 → F5 → F7 |
| 契約の骨格 (d2-contract mode=skeleton) と画面部品 (d2-design) の後 | `finish` | F8 → F6 (`ui=true` のときだけ) → F7 (F6 を回したときだけ) → F4 → F9 |

決定の差分で開発ルールとアーキテストを作り直すときは、d2-run が F1 と F2 のスクリプトを直接回す。

パスの `<skills>` は、スキル群のディレクトリを指す。
定義は [../d2-common/SKILL.md](../d2-common/SKILL.md) の「パスの書き方」にある。

## 全 phase に共通の決まり

| 決まり | 内容 |
|---|---|
| スクリプトの場所 | `<skills>/d2-foundation/scripts/` にある。`--cwd <repo>` で対象リポを指す |
| 再実行 | どの phase も、再実行して安全である |
| 他スキルのスクリプト | F4 と F8 は、他のスキルのスクリプトを呼ぶ (d2-contract の genContractTests、d2-decide の genArchitectureDoc) |
| git | 自分で git コマンドを打たない。commit は d2-run が行う |

git の例外は、genQlty.js の内部の git だけである。
読み取りと、qlty init に未追跡ファイルを見せるための一時的な `git add -N` を行う。
終わったら index を書き戻す。

## phase が読むもの・書くもの

| phase | スクリプト | 読む | 書く |
|---|---|---|---|
| F1 | `genRules.js` | `docs/adr/*.md` (`rules[]`・`tiers[].kind`)、`references/rule-templates/` | `docs/rules/{index,common,testing,tier-<kind>}.md` |
| F2 | `genArchTests.js` | `docs/adr/*.md` (`rules[].arch_test`) | `.dependency-cruiser.cjs` |
| F3 | `genTestSupport.js` | `templates/test-support/`、`templates/features-support/`、`templates/cucumber.js`、`templates/tsx-register.js` | `packages/test-support/**`、`features/support/**`、`cucumber.js`、`tsx-register.js` (cucumber.js が読む ESM ローダ) |
| F4 | `genContractTests.js` (d2-contract のスクリプト。骨格分) | `contracts/**`、`.distillery/config.yaml` | `apps/*/test/contract/**`、`packages/contracts/**` |
| F5 | `genConfig.js` / `genSkeleton.js` / `genCi.js` / `genCheck.js` / `genQlty.js` | `docs/adr/*.md` (`tiers[]`・`datastore_owner`・testing `capabilities`・機械チェックの `checks`)、`contracts/contracts.json`、`.distillery/config.yaml` (genConfig が書いたものを genCi と genCheck が読む) | `.distillery/config.yaml`、`package.json`、`tsconfig.base.json`、`.gitignore`、`biome.json`、`apps/*/` (ADR の `ui` が React の SPA・Tailwind なら frontend に画面の土台)、`packages/*/`、`.github/workflows/ci.yml`、`scripts/check.mjs`、`.githooks/**`、`.distillery/distillery2.lock.json`、`.qlty/qlty.toml` |
| F6 | `importUi.js` | `docs/design/storybook-app/src/` (d2-design の出力) | `packages/ui/**`、`packages/ui/.imported.yaml`、`packages/ui/entry.css` (画面の土台が読む CSS の入口)、`apps/*/src/styles.css` (genSkeleton が置いた形のままなら入口を読む形に替える) |
| F7 | `npm install` → `installTierPackages.js` → `genQlty.js --refresh` | `package.json`、`package-lock.json`、`.qlty/qlty.toml`、`docs/adr/*.md` (`tiers[].packages`・`dev_packages`) | `package-lock.json`、`apps/*/package.json` (依存)、`.qlty/qlty.toml` |
| F8 | `genConfig.js` → `genCi.js` → `genCheck.js` → `genArchitectureDoc.js` (d2-decide のスクリプト) | `docs/adr/*.md`、`contracts/contracts.json`、`docs/requirements/rdra/**`、`.distillery/config.yaml` | `.distillery/config.yaml`、`.github/workflows/**`、`scripts/check.mjs`、`.githooks/**`、`.distillery/distillery2.lock.json`、`docs/adr/architecture.md` |
| F9 | `runGates.js --uc bootstrap --upto static` | `.distillery/config.yaml`、`package.json`、`.qlty/qlty.toml`、`apps/*/test/contract/**`、`.dependency-cruiser.cjs`、`<run>/reports/**` | `<run>/reports/**` |

phase ごとの注意:

| phase | 注意 |
|---|---|
| F4 | 骨格分の契約テストだけを生成する。UC ごとの契約テストと DB migration は **d2-contract mode=uc が持つ** |
| F5 | `.distillery/config.yaml` の `commands.quality` が qlty ゲートである。`.github/workflows/ci.yml` は、permissions 最小と qlty で作る |
| F7 | lockfile (`package-lock.json`) の書き手は、③ ではこの phase だけである (単一 writer)。`npm install` は `node_modules/**` (gitignore) も作る |
| F9 | `<run>` は `.distillery/runs/bootstrap` (仮の slug) である。exit 0 でなければ、直さずに報告して止まる。d2-run が受理時に `reports/gates.json` を読む |

npm 10 で `npm install` が落ちたら、[references/troubleshooting.md](references/troubleshooting.md) の回避策を使い、報告に書く。

F9 で、止めない扱い (advisory) のジョブだけが落ちたときは exit 0 になる。
生成物の鮮度と security がこれに当たる。
この場合は止まらず、課題にもしない。
`docs/README.md` の古さは、d2-run が commit の前に genDocsReadme で作り直す。

`.qlty/qlty.toml` の作り方と、順番の理由は [references/phases.md](references/phases.md) にある。

## phase=all の手順

順番は F1 → F2 → F3 → F5 → F7 である。
F7 は、契約の骨格より前に済ませる (契約の骨格が使う redocly が F7 で入るため)。

```
node <skills>/d2-foundation/scripts/genRules.js --adr docs/adr --out docs/rules --cwd <repo>
node <skills>/d2-foundation/scripts/genArchTests.js --adr docs/adr --out .dependency-cruiser.cjs --cwd <repo>
node <skills>/d2-foundation/scripts/genTestSupport.js --cwd <repo>
node <skills>/d2-foundation/scripts/genConfig.js --adr docs/adr --contracts contracts/contracts.json --out .distillery/config.yaml --cwd <repo>
node <skills>/d2-foundation/scripts/genSkeleton.js --adr docs/adr --cwd <repo>
node <skills>/d2-foundation/scripts/genCi.js --config .distillery/config.yaml --cwd <repo>
node <skills>/d2-foundation/scripts/genCheck.js --cwd <repo>   # 機械チェックの一括実行 scripts/check.mjs と hook。core.hooksPath を .githooks にする (必須)
node <skills>/d2-foundation/scripts/genQlty.js --cwd <repo>   # qlty init の提案 + 上乗せ。--fallback で固定リスト、--force で作り直し
npm install                                                                               # F7 (<repo> で)
node <skills>/d2-foundation/scripts/installTierPackages.js --adr docs/adr --cwd <repo>   # F7。ADR の tiers[].packages を各ティアに入れる (npm 10 の回避策を使ったら --npm "npx npm@11")
node <skills>/d2-foundation/scripts/genQlty.js --refresh --cwd <repo>   # F7。提案で増えた plugins だけ足す
```

F5 の中の順は genConfig → genSkeleton → genCi → genCheck → genQlty である。
genCi は config.yaml を読むので、genConfig の後に走らせる。
genQlty は、F5 の **最後** に走らせる。

F1 と F2 のスクリプトは `--check` を持つ (書かずに、生成物が古ければ exit 1)。

## phase=finish の手順

契約の骨格と画面部品が揃ってから回す。
config と CI は契約 (`contracts/contracts.json`) を読む。
C4 図は、契約の矢印をこの時点で初めて描ける。

| 順 | phase | すること |
|---|---|---|
| 1 | F8 | config、CI、C4 図を、契約込みで作り直す。いずれも自分の生成物なら上書きする |
| 2 | F6 | `ui=true` なら、`docs/design/storybook-app/` を `packages/ui` に取り込む |
| 3 | F7 | `npm install` をもう一度回す (`packages/ui` が workspace に加わったので、lockfile を更新する)。続けて `installTierPackages.js` (足りない分だけ) と `genQlty.js --refresh` を回す |
| 4 | F4 | 骨格分の契約テストを生成する |
| 5 | F9 | チェックポイント。`runGates.js --uc bootstrap --upto static` が exit 0 を返す |

F6 を飛ばす条件:

- `ui=false` なら F6 と次の F7 を飛ばす。前の実行の `docs/design/` が残っていても取り込まない (画面の有無は d2-run の判断に従う)
- `ui=true` なのに出力が無ければ、F6 と F7 を飛ばし、その旨を報告する。d2-design が「画面を持たない」と判断して skip した場合である

importUi の出力の `css:` が `none` のときは、画面部品の色や書体が画面に効かない。
d2-design の出力を課題にする。
細目は [references/phases.md](references/phases.md) の「F6 と画面の土台の CSS」にある。

```
node <skills>/d2-foundation/scripts/genConfig.js --adr docs/adr --contracts contracts/contracts.json --out .distillery/config.yaml --cwd <repo>   # F8
node <skills>/d2-foundation/scripts/genCi.js --config .distillery/config.yaml --cwd <repo>   # F8
node <skills>/d2-foundation/scripts/genCheck.js --cwd <repo>   # F8 (契約込みの config から作り直す)
node <skills>/d2-decide/scripts/genArchitectureDoc.js docs/adr docs/adr/architecture.md --contracts contracts/contracts.json --rdra docs/requirements/rdra requirements=docs/requirements contracts=contracts --cwd <repo>   # F8 (basis に契約も記録する)
node <skills>/d2-foundation/scripts/importUi.js --from docs/design/storybook-app --cwd <repo>   # F6
npm install                                                                               # F7 (<repo> で。F6 を回したときだけ)
node <skills>/d2-foundation/scripts/installTierPackages.js --adr docs/adr --cwd <repo>   # F7
node <skills>/d2-foundation/scripts/genQlty.js --refresh --cwd <repo>   # F7
node <skills>/d2-contract/scripts/genContractTests.js contracts --config .distillery/config.yaml --out-root <repo>   # F4 (骨格分)
node <skills>/d2-common/scripts/runGates.js --uc bootstrap --upto static   # F9 (<repo> で)
```

## 冪等性の決まり

| 対象 | 再実行したとき | 理由 |
|---|---|---|
| `basis:` ヘッダを持つ生成物 (`docs/rules/*`、`.dependency-cruiser.cjs`、`.distillery/config.yaml`、`packages/ui/.imported.yaml`) | 上書きして再生成する | 直したい変更は、ADR、契約、design に戻す |
| 出力先にある、`basis:` ヘッダの無い手書きファイル | `genConfig.js` と `genRules.js` は上書きせず、警告して exit 1 を返す。意図的に潰すときだけ `--force` を付ける | 手書きの設定とルールを、再実行で失わないため |
| 骨格とテンプレート展開 (package.json、tsconfig.base.json、apps/packages のディレクトリ、packages/test-support/**、features/support/**、cucumber.js) | **既存ファイルを上書きしない** (skip として報告する) | リポ側のローカル改訂を消さないため |

決定論: F1、F2、F5 は、同じ入力と同じ git 状態で 2 回実行すると、同一の出力になる。
ADR id の昇順、arch_test 名の昇順で並べる。

## チェックポイント

- F9 は、F7 (`npm install`) の後に回す
- `genRules.js` を 2 回実行して、diff が無いことを確かめる

F9 を F7 の後に回す理由は次のとおりである。
static ゲートの arch test は `npx depcruise` を実行する。
`dependency-cruiser` が入っていないと fail する (未インストールでも skip はされない)。
skip されるのは、コマンド定義そのものが無いゲートだけである。

## 引き継ぎファイル

作業の終わりに、進行役が派遣文で渡す場所 (`{handoff}`) に引き継ぎファイルを書く。
書くのは、人に聞きたいことと、自分の書き込み範囲では直せない前のステップの問題である。
報告の本文にだけ書いたことは扱われない。
推奨は条件を付けずに 1 つ書く。
書き方は [handoff.md](../d2-common/references/handoff.md) にある。

## 細目の文書

| 文書 | 読むとき | 内容 |
|---|---|---|
| [references/phases.md](references/phases.md) | 順番の理由を確かめるとき、F6 の `css:` が `none` のとき | phase の順番の理由、`.qlty/qlty.toml` の作り方、F6 と画面の土台の CSS、F4 と F6 の受け渡し |
| [../d2-common/references/adr-inputs.md](../d2-common/references/adr-inputs.md) | 生成器が読む ADR のキーを確かめるとき | F1 と F5 が読む ADR キー。書き手の d2-decide と、読み手の d2-foundation が共に参照する |
| [../d2-common/references/config-schema.md](../d2-common/references/config-schema.md) | 実行設定を確かめるとき | 実行設定の形 |
| [references/rule-templates/](references/rule-templates/) | 開発ルールの土台を確かめるとき | 開発ルールの土台 |
| [references/test-infra.md](references/test-infra.md) | テスト基盤を確かめるとき | 検証済みライブラリの版と API |
| [references/repo-layout.md](references/repo-layout.md) | 配置を確かめるとき | 対象リポのレイアウト |
| [references/ci.md](references/ci.md) | CI を確かめるとき | CI の job 構成 |
| [references/troubleshooting.md](references/troubleshooting.md) | 詰まったとき | qlty と biome で踏んだ問題と回避策 |
| [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) | 入出力を確かめるとき | 入出力の正本 (図は [dataflow.md](../d2-common/references/dataflow.md)) |
