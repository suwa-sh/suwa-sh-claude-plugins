---
name: d2-verify
description: >-
  段階④の独立検証。実装者とは別モデルの Verifier が、ゲート結果・テストレポート・実行トレース・AssumptionRecord を読み、
  「UC の意図どおりか」「実装者が補った前提が要求・契約・ルールと矛盾しないか」の 2 観点だけで findings を書く。
  テストを再実行しない。コードを直さない。d2-run のサブエージェント (agents/d2-verifier.md) として呼ばれる。
---

# d2-verify

入出力の正本: [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) (図: [dataflow.md](../d2-common/references/dataflow.md))

引数: `uc=<slug> tier=<tier_id> attempt=<n> run=<.distillery/runs/<slug> へのパス> assumptions=<attempt-<n>/assumptions.<tier>.yaml へのパス>`

観点の正本は [references/viewpoints.md](references/viewpoints.md)。前提の正本は
`../d2-implement/references/assumption-record.md`。

## 読んでよいもの (read-set)

| 種類 | パス |
|---|---|
| ゲート結果 | `<run>/reports/gates.json` と各ゲートの JSON レポート (`unit.<tier>.json`、`contract.<tier>.json`、`uc-bdd.json`、`acceptance-api.json`) |
| トレース | `<run>/traces/*.jsonl` |
| 前提 | 引数の assumptions ファイル `<run>/attempt-<n>/assumptions.<tier>.yaml` (**観点 1 を終えてから開く**) |
| シナリオ | `features/<業務>/<slug>.feature` (`docs/requirements/use-cases.yaml` の該当行で業務名を引く) |
| 要求 | `docs/requirements/requirements.yaml` の該当 spec_ids、`docs/requirements/rdra/条件.tsv` / `状態.tsv` の該当行 |
| ルール | `docs/rules/common.md`、`docs/rules/tier-<kind>.md`、`docs/rules/testing.md` |
| 契約 | `contracts/generated/slices/<slug>/contract-slice.json` (と rdb-slice.yaml) |
| 実装 | `git diff --name-only <base_head>..HEAD` の変更ファイル (呼び出し側が一覧を渡す)。自ティアの `apps/<dir>/` |
| 固定指示 | `${CLAUDE_PLUGIN_ROOT}/skills/d2-implement/references/tier-impl.md` (前提の照合先として) |
| 他 UC への波及 (例外) | 呼び出し側が渡す「他 UC と共有する変更ファイル」、自ティアの変更ファイルの import 元 (`rg` で辿る)、`contracts/uc-index.yaml`、`docs/as-built/_system/traceability-index.json`、候補に紐づく他 UC のシナリオ (`features/<業務>/<他 slug>.feature`) |

設計書や個別仕様書は存在しない。上の「他 UC への波及」の例外を除き、他 UC・関与しない契約・契約 source の全量は読まない。

## 手順

1. `reports/gates.json` を読み、5 ゲートの結果を `gates_read` に転記する。`all_recorded: true` でない (`missing` の段がある)、
   または pass でない段があれば、呼び出し側の誤りとして停止する (Verifier は全段 pass の後にだけ動く)
2. 観点 1 (uc_intent) を viewpoints.md の突き合わせ表どおりに行う。根拠 (レポートの該当箇所・トレースの行・要求の行) を
   findings の `evidence` に書く。この間、前提ファイルは開かない。候補 (仕様に根拠の無い判断) を控える
3. 観点 2 (assumption_conformance) を blind join の手順どおりに行う
4. `findings.yaml` を `<run>/attempt-<n>/findings.<tier>.yaml` に書く (形は viewpoints.md)。書き終えたら
   `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-implement/scripts/validateAssumptions.js verdicts <findings> --assumptions <assumptions> --uc <slug> --tier <tier> --attempt <n>`
   を実行し ok を確認する。ok でなければ直す
5. 結果を報告する: blocker / major / minor の件数、`requires_answer` の件数、blocker があれば戻すべきティアと理由

## 書いてよいもの (write-set)

`<run>/attempt-<n>/findings.<tier>.yaml` だけ。実装コード・テスト・契約・ルールは書き換えない。git を使わない。

## 判定の原則

- 根拠のない severity を付けない。レポート・トレース・要求の行を必ず指す
- 一般論 (可読性・性能・運用性) はルールに書かれていなければ指摘しない。機械のゲートが見るものは繰り返さない
- 「動くように仕様と違うことをしている」は `contradicts` で blocker。仕様側が間違っていると思っても Verifier は仕様側に立つ
  (仕様の問題は finding の evidence に書き、人レビューで還流に振り分けられる)
