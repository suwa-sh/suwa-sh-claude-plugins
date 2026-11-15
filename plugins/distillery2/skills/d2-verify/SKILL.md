---
name: d2-verify
description: >-
  段階④の独立検証。実装者とは別モデルの Verifier が、ゲート結果・テストレポート・実行トレース・AssumptionRecord を読み、
  「UC の意図どおりか」「実装者が補った前提が要求・契約・ルールと矛盾しないか」の 2 観点だけで findings を書く。
  テストを再実行しない。コードを直さない。d2-run のサブエージェント (agents/d2-verifier.md) として呼ばれる。
---

# d2-verify

実装者とは別のエージェントが、1 つの UC の 1 つのティアの実装を検証する。
見るのは次の 2 点だけである。

| 観点 | 確かめること |
|---|---|
| 1. UC の意図 (`uc_intent`) | 実装が、シナリオと要求のとおりに振る舞うか |
| 2. 前提の適合 (`assumption_conformance`) | 実装者が仕様に無くて自分で決めた前提が、要求、契約、開発ルールと矛盾しないか |

テストは再実行しない。
コードは直さない。
git は使わない。
書くのは検証結果のファイル (findings) 1 つだけである。

## 呼び出し

進行役 (d2-run) が、5 つのゲートがすべて通った後に、ティアごとに派遣する。

| 引数 | 内容 |
|---|---|
| `uc` | UC の slug |
| `tier` | ティアの ID |
| `attempt` | 何回目の実装か |
| `run` | `.distillery/runs/<slug>` へのパス |
| `assumptions` | 実装者の前提のファイル (`attempt-<n>/assumptions.<tier>.yaml`) へのパス |

パスの `<skills>` は、スキル群のディレクトリを指す。
定義は [../d2-common/SKILL.md](../d2-common/SKILL.md) の「パスの書き方」にある。

## 手順

観点ごとの突き合わせ方と findings の形は [references/viewpoints.md](references/viewpoints.md) にある。
手順 2 の前に全部読む。

| 順 | すること | 次へ進む条件 |
|---|---|---|
| 1 | `reports/gates.json` を読み、5 ゲートの結果を `gates_read` に転記する | `all_recorded: true` で、全段が pass である。`missing` の段や pass でない段があれば、呼び出し側の誤りとして停止する |
| 2 | 観点 1 を、viewpoints.md の突き合わせ表どおりに行う。この間、前提のファイルは開かない | 根拠を findings の `evidence` に書いた。仕様に根拠の無い判断を、候補として控えた |
| 3 | 観点 2 を、viewpoints.md の blind join の手順どおりに行う。ここで初めて前提のファイルを開く | 控えた候補と前提を突き合わせた |
| 4 | findings を `<run>/attempt-<n>/findings.<tier>.yaml` に書き、下の検査を実行する | 検査が ok を返す。ok でなければ直す |
| 5 | 結果を報告する | blocker、major、minor の件数と、`requires_answer` の件数を書いた。blocker があれば、戻すべきティアと理由も書いた |

手順 2 の根拠には、レポートの該当箇所、トレースの行、要求の行のどれかを書く。

手順 4 で findings に書く値:

| 値 | 書き方 |
|---|---|
| `verified_at` | findings を書いた時刻。`date -u +%Y-%m-%dT%H:%M:%SZ` の出力を書く (推測で書かない) |
| `assumptions_sha256` | 手順 4 の検査の前に、前提のファイルを `validateAssumptions.js record` で検査した結果の `sha256` (下のコマンド) |
| 前の attempt の指摘 | 書かない。findings は今の attempt の実装だけを判定する。前の attempt で指摘して今は直っているものは、指摘にしない (直ったことは `viewpoints_checked.uc_intent.note` に 1 行で書く) |
| 前の attempt から減った前提 | 今の前提のファイルにある A-id だけに verdict を付ける。無くなった A-id には付けない (契約や要求に明示されて前提でなくなったものは、実装者が外す) |

手順 4 の検査の前に回す、前提のファイルの検査 (読むだけ。`sha256` を得る):

```
node <skills>/d2-implement/scripts/validateAssumptions.js record <assumptions> --uc <slug> --tier <tier> --attempt <n>
```

手順 4 の検査:

```
node <skills>/d2-implement/scripts/validateAssumptions.js verdicts <findings> --assumptions <assumptions> --uc <slug> --tier <tier> --attempt <n>
```

## 読んでよいもの (read-set)

設計書や個別仕様書は存在しない。
下の表に無いものは読まない。
他の UC、関与しない契約、契約の source の全量も読まない (表の最後の行の例外を除く)。

| 種類 | パス |
|---|---|
| ゲート結果 | `<run>/reports/gates.json` と各ゲートの JSON レポート (`unit.<tier>.json`、`contract.<tier>.json`、`uc-bdd.json`、`acceptance-api.json`) |
| トレース | `<run>/traces/*.jsonl` |
| 前提 | 引数の assumptions ファイル `<run>/attempt-<n>/assumptions.<tier>.yaml` (**観点 1 を終えてから開く**) |
| シナリオ | `features/<業務>/<slug>.feature` (`docs/requirements/use-cases.yaml` の該当行で業務名を引く) |
| 要求 | `docs/requirements/requirements.yaml` の該当 spec_ids、`docs/requirements/rdra/条件.tsv` / `状態.tsv` の該当行 |
| ルール | `docs/rules/common.md`、`docs/rules/tier-<kind>.md`、`docs/rules/testing.md` |
| 契約 | `contracts/generated/slices/<slug>/contract-slice.json` (と rdb-slice.yaml) |
| 画面 (画面を持つティア) | `docs/design/screens.yaml` の該当画面、`packages/ui/` の部品と story |
| 実装 | `git diff --name-only <base_head>..HEAD` の変更ファイルと、commit 前の変更 (呼び出し側が一覧を渡す)。自ティアの `apps/<tier>/`。変更前との差分 (呼び出し側が渡す差分ファイル。git を使わずに、変更前のコードと比べる材料にする) |
| 固定指示 | 派遣文で渡された「実装者の固定指示」のパス (`<skills>/<実装者のスキル>/references/<固定指示>.md` の形)。前提の照合先として読む。このスキルから他スキルの手順書を直接参照しない |
| 他 UC への波及 (例外) | 呼び出し側が渡す「他 UC と共有する変更ファイル」、自ティアの変更ファイルの import 元 (`rg` で辿る)、`contracts/uc-index.yaml`、`docs/as-built/_system/traceability-index.json`、候補に紐づく他 UC のシナリオ (`features/<業務>/<他 slug>.feature`) |

## 書いてよいもの (write-set)

`<run>/attempt-<n>/findings.<tier>.yaml` だけである。
実装コード、テスト、契約、ルールは書き換えない。

## 判定の決まり

| 決まり | 扱い |
|---|---|
| 根拠の無い severity を付けない | レポート、トレース、要求の行のどれかを必ず指す |
| 一般論を指摘しない | 可読性、性能、運用性は、ルールに書かれているときだけ指摘する。機械のゲートが見るものは繰り返さない |
| 仕様の側に立つ | 「動くように仕様と違うことをしている」は `contradicts` で blocker にする。仕様の側が間違っていると思っても同じである |
| 仕様の問題は前のステップの課題にする | findings の `upstream_issues` に、戻し先を付けて書く。振り分けは進行役が行う |

`upstream_issues` に書くのは、`<skills>/d2-common/references/handoff.md` の「前のステップの課題にする線」に当たるものだけである。
線に当たらない仕様の空白は、前提の判定 (`spec_absent` / `unlisted`) に留める。
実装者が決めた前提や、黙って下した判断がこれに当たる。
これらは人レビューの入口で扱う。
`upstream_issues` に書くと UC が止まり、写し直しが増えるためである。
`spec_absent` / `unlisted` の前提でも、線の 1〜3 のどれか (業務の値の欠けを含む) に当たれば書く。

## 細目の文書

| 文書 | 読むとき | 内容 |
|---|---|---|
| [references/viewpoints.md](references/viewpoints.md) | 手順 2 の前 | 観点の正本。2 つの観点の突き合わせ方と findings の形 |
| [../d2-common/references/assumption-record.md](../d2-common/references/assumption-record.md) | 手順 3 の前 | 前提の正本。前提の記録の形 |
| [../d2-common/references/handoff.md](../d2-common/references/handoff.md) | `upstream_issues` を書く前 | 「前のステップの課題にする線」の正本。read-set の外だが、手順書として読む |
| [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) | 入出力を確かめるとき | 入出力の正本 (図は [dataflow.md](../d2-common/references/dataflow.md)) |
