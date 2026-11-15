---
name: d2-implement
description: >-
  段階④の実装者。mode=scenario (UC のシナリオを features/ に書き、人が承認) / mode=scaffold (step 骨格と最初の red 単体テスト) /
  mode=tier (ティアごとの単体 TDD。静的・単体ゲートを通し、仕様に無くて自分で決めた前提を AssumptionRecord に書く) /
  mode=integrate (UC BDD と受入の step 実装、計装の結線)。d2-run のサブエージェントとして呼ばれる。
---

# d2-implement

1 つの UC を、シナリオから結合までの 5 つの mode に分けて実装する。
mode ごとに、読むものと書くものを固定指示が決める。
個別仕様書やティア仕様書は無い。
読むのは、シナリオ、要求の該当行、契約 slice、ルール、画面部品だけである。

## 呼び出し

進行役 (d2-run) が、mode を 1 つ指定して派遣する。

```
mode=precheck|scenario|scaffold|tier|integrate uc=<slug> [tier=<tier_id>] [attempt=<n>] [findings=<path>]
```

パスの `<skills>` は、スキル群のディレクトリを指す。
定義は [../d2-common/SKILL.md](../d2-common/SKILL.md) の「パスの書き方」にある。

## mode ごとの固定指示 (正本)

| mode | 固定指示 | すること |
|---|---|---|
| precheck | [references/precheck.md](references/precheck.md) | UC の作業の前に、この UC に要る上流の決めごとの不足を洗い出す。読むだけで、結果は引き継ぎファイルに書く (ティアごと) |
| scenario | [references/scenario.md](references/scenario.md) | use-cases.yaml の行、要求、RDRA から `features/<業務>/<slug>.feature` を書く。人の承認は d2-run が取る |
| scaffold | [references/scaffold.md](references/scaffold.md) | feature と slice から、step 骨格 (pending) とティアごとの red 単体テストを書く |
| tier | [references/tier-impl.md](references/tier-impl.md) | ルール、slice、生成型、feature から `apps/<tier>/src` を実装し、AssumptionRecord を書く |
| integrate | [references/integrate.md](references/integrate.md) | 骨格と test-support から step を実装し、計装を結線する |

完了条件は固定指示にある。
要点は次のとおりである。

| mode | 完了条件の要点 |
|---|---|
| scaffold | dry-run で undefined が 0。`--expect-red unit` が通る |
| tier | 自ティアの static と unit が check-only で通る |
| integrate | `runGates.js --from uc-bdd` が通る |

## 手順 (全 mode 共通)

| 順 | すること |
|---|---|
| 1 | `.distillery/config.yaml` を読む。UC の slug から `docs/requirements/use-cases.yaml` の行を引く (業務名、spec_ids、tiers) |
| 2 | 該当 mode の固定指示ファイルを**最初に全部読む** |
| 3 | 固定指示どおりに作業し、完了条件を自分で確かめる |
| 4 | 仕様に無いことを決めたら、AssumptionRecord に書く (tier)。仕様と両立しない事実は、引き継ぎファイルの `upstream_issues` に書く |
| 5 | 報告する |

手順 2: read-set に無いものは読まない。
下の「細目の文書」の表にある共通の規約は例外である。

手順 3: 完了条件はスクリプトの exit code で判定する。
出力の目視で pass にしない。

手順 4: `upstream_issues` に書くかどうかの線は、`<skills>/d2-common/references/handoff.md` の「前のステップの課題にする線」にある。
課題のファイルは直接書かない。
進行役が引き継ぎファイルから下書きにする。

手順 5 で報告するもの:

- 生成したファイルと更新したファイルの一覧
- 完了条件の結果
- AssumptionRecord の件数と sha256 (tier)
- 引き継ぎファイルに書いた課題

## 禁止

| 禁止 | 補足 |
|---|---|
| git 操作 | コミットは d2-run が行う |
| write-set 外への書き込み | 必要なら止めて理由を返す |
| 生成物の手編集 | `packages/contracts/` の生成物と、`apps/*/test/contract/` の生成テスト |
| 要求、シナリオ、契約と矛盾する実装で通すこと | 「動くように仕様と違うことをする」は禁止 |

## 引き継ぎファイル

作業の終わりに、進行役が派遣文で渡す場所 (`{handoff}`) に引き継ぎファイルを書く。
書くのは次の 2 つである。

- 人に聞きたいこと
- 自分の書き込み範囲では直せない、前のステップの問題

報告の本文にだけ書いたことは扱われない。
推奨は条件を付けずに 1 つ書く。
書き方は [handoff.md](../d2-common/references/handoff.md) にある。

戻し先 (`target_step`) の選び方:

| 足りないもの・食い違うもの | 戻し先 |
|---|---|
| 業務の決まり・受入基準・UC の抜け (要望に照らして何をするか) | `requirements` |
| 技術の方針 (層・認可・データの持ち方・同時の更新・エラーの返し方・外部とのやり取り) が ADR に無い・矛盾する | `decide` |
| 決定はあるが、開発ルール・テスト基盤・画面部品・設定が追いついていない | `foundation` |
| この UC のシナリオ / 契約 / 他ティアの実装 | `scenario` / `contract` / `implementation` |
| distillery2 のスクリプト・手順の不具合 (リポの中では直せない) | `plugin` |

戻し先が `plugin` の課題を自分の書き込み範囲で回避したら、`workaround` に回避の仕方を書く。
この場合、UC は止まらない。

## スクリプト

| スクリプト | 用途 |
|---|---|
| `scripts/validateAssumptions.js` | AssumptionRecord と Verifier 判定の検証 (record / verdicts / evidence) |
| `scripts/checkScenario.js` | feature の静的確認 (`@uc:` タグ、受入基準の `@acceptance:` 対応、parse) |
| `<skills>/d2-common/scripts/runGates.js` | ゲート実行 (`--only unit --expect-red unit`、`--from uc-bdd` など) |

## 細目の文書

固定指示のほかに、全 mode が読んでよい共通の規約がある。

| 文書 | 読むとき | 内容 |
|---|---|---|
| [references/gates.md](references/gates.md) | ゲートを回す前 | 5 ゲートの定義 |
| [../d2-common/references/assumption-record.md](../d2-common/references/assumption-record.md) | 前提を書く前 (tier) | 前提の記録の形。d2-verify も読む |
| [../d2-common/references/handoff.md](../d2-common/references/handoff.md) | 引き継ぎファイルを書く前 | 引き継ぎファイルの形と「前のステップの課題にする線」。d2-verify も読む |
| [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) | 入出力を確かめるとき | 入出力の正本 (図は [dataflow.md](../d2-common/references/dataflow.md)) |

テストの持ち方は次のとおりである。

| テスト | 持ち方 |
|---|---|
| ティアの契約適合 | 生成された契約テスト (`apps/<tier>/test/contract/`) が担う。ティア BDD は無い |
| red baseline | 単体だけに作る。UC BDD と受入は、静的確認 (parse と dry-run) で足場を確かめる |
| 受入基準 | 別ファイルに転写しない。UC のシナリオに `@acceptance:` タグで対応させる |
