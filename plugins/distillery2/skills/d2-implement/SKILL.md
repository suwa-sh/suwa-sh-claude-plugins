---
name: d2-implement
description: >-
  段階④の実装者。mode=scenario (UC のシナリオを features/ に書き、人が承認) / mode=scaffold (step 骨格と最初の red 単体テスト) /
  mode=tier (ティアごとの単体 TDD。静的・単体ゲートを通し、仕様に無くて自分で決めた前提を AssumptionRecord に書く) /
  mode=integrate (UC BDD と受入の step 実装、計装の結線)。d2-run のサブエージェントとして呼ばれる。
---

# d2-implement

入出力の正本: [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) (図: [dataflow.md](../d2-common/references/dataflow.md))

引数: `mode=scenario|scaffold|tier|integrate uc=<slug> [tier=<tier_id>] [attempt=<n>] [findings=<path>]`

v1 (distillery-impl:dist-impl-implement) からの変更点:

- 個別仕様書・ティア仕様書を読まない。読むのは シナリオ・要求の該当行・契約 slice・ルール・画面部品 だけ
- ティア BDD が無い。ティアの契約適合は生成された契約テスト (`apps/<tier>/test/contract/`) が担う
- red baseline は単体だけ。UC BDD と受入は静的確認 (parse + dry-run) で足場を確かめる
- 受入基準は別ファイルに転写せず、UC のシナリオに `@acceptance:` タグで対応させる

## mode ごとの固定指示 (正本)

| mode | 固定指示 | 読むもの / 書くもの の要点 |
|---|---|---|
| scenario | [references/scenario.md](references/scenario.md) | use-cases.yaml の行 + 要求 + RDRA → `features/<業務>/<slug>.feature`。人の承認は d2-run が取る |
| scaffold | [references/scaffold.md](references/scaffold.md) | feature + slice → step 骨格 (pending) + ティアごとの red 単体テスト。完了条件は dry-run で undefined 0 と `--expect-red unit` |
| tier | [references/tier-impl.md](references/tier-impl.md) | rules + slice + 生成型 + feature → `apps/<tier>/src`、AssumptionRecord。自ティアの static / unit を check-only で通す |
| integrate | [references/integrate.md](references/integrate.md) | 骨格 + test-support → step 実装、計装の結線。`runGates.js --from uc-bdd` が通る |

共通の規約: [references/gates.md](references/gates.md) (5 ゲート)、[references/assumption-record.md](references/assumption-record.md) (前提の記録)。

## 手順 (全 mode 共通)

1. `.distillery/config.yaml` を読み、UC の slug から `docs/requirements/use-cases.yaml` の行を引く (業務名・spec_ids・tiers)
2. 該当 mode の固定指示ファイルを**最初に全部読む**。read-set に無いものは読まない
3. 固定指示どおりに作業し、完了条件を自分で確かめる (スクリプトの exit code で判定する。出力の目視で pass にしない)
4. 仕様に無いことを決めたら AssumptionRecord に (tier)、仕様と両立しない事実は `issues/` に (`kind: rule | contract | requirement`)
5. 報告: 生成・更新したファイル一覧、完了条件の結果、AssumptionRecord の件数と sha256 (tier)、起票した issue

## 禁止

- git 操作 (コミットは d2-run)
- write-set 外への書き込み (必要なら止めて理由を返す)
- `packages/contracts/` の生成物と `apps/*/test/contract/` の生成テストの手編集
- 要求・シナリオ・契約と矛盾する実装で通すこと。「動くように仕様と違うことをする」は禁止

## スクリプト

| スクリプト | 用途 |
|---|---|
| `scripts/validateAssumptions.js` | AssumptionRecord と Verifier 判定の検証 (record / verdicts / evidence) |
| `scripts/checkScenario.js` | feature の静的確認 (`@uc:` タグ、受入基準の `@acceptance:` 対応、parse) |
| `${CLAUDE_PLUGIN_ROOT}/scripts/runGates.js` | ゲート実行 (`--only unit --expect-red unit`、`--from uc-bdd` など) |
