---
name: d2-common
description: >-
  distillery2 の他のスキル (d2-run、d2-implement、d2-verify など) が相対パスで参照する共通定義。
  処理と入出力ファイルの正本 (DFD) を持つ。ユーザーの依頼で直接起動するスキルではない。
  distillery2 のスキル群の整合性を確かめるとき、どのスキルがどのファイルを読み書きするかを調べるときに読む。
---

# d2-common

distillery2 の各スキルが共通に参照する定義とスクリプトの置き場である。
単独では何も実行しない。
各スキルは `../d2-common/...` の相対パスで参照する。
スキルが兄弟ディレクトリとして並んでいることが前提である (プラグインでも `~/.agents/skills/` でも同じ)。

この文書が決めるのは次の 3 つである。

| 節 | 決めること |
|---|---|
| パスの書き方 | 手順書の中の `<skills>` の意味 |
| 参照の向き | どのスキルが、どのスキルの手順書を参照してよいか |
| 正本を直すとき | 入出力を変えたときに、合わせて直すもの |

## パスの書き方

手順書の中のスクリプトと手順書は、`<skills>/<skill>/...` と書く。
例: `node <skills>/d2-common/scripts/runGates.js`、`<skills>/d2-implement/references/tier-impl.md`

- `<skills>` = スキル群のディレクトリ (このスキルの `SKILL.md` がある場所の 1 つ上)。スキルを読み込んだときに表示される、このスキルの場所 (Base directory) から決める
- Claude Code のプラグインとして入れたときは `<skills>` = `${CLAUDE_PLUGIN_ROOT}/skills`
- `~/.agents/skills/` に平置きしたときは `<skills>` = `~/.agents/skills`
- コマンドに渡すときと、サブエージェントの派遣文に書くときは、絶対パスに展開する
- 共通のスクリプトは、すべて `<skills>/d2-common/scripts/` にある。プラグインの直下には置かない (スキルだけを別の場所に置いても届くようにするため)
- 他のスキルの `SKILL.md` は、この節を参照する (単独で読み込まれても定義にたどり着く)

## 参照の向き

d2-run と d2-common 以外のスキルは、**他スキルの手順書 (`SKILL.md`・`references/**`・`templates/**`) を参照しない**。
d2-run は、全スキルを派遣する入口なので例外である。

複数のスキルが読む定義は、d2-common の `references/` に置く。
各スキルは `../d2-common/references/<file>` で参照する (手順書の中では `<skills>/d2-common/references/<file>`)。

| してよいこと | 例 |
|---|---|
| 他スキルの**スクリプト**を `<skills>/<skill>/scripts/...` で呼ぶ | d2-foundation の仕上げが、d2-decide の `genArchitectureDoc.js` と d2-contract の `genContractTests.js` を回す。生成器は持ち主のスキルに置く |
| 派遣文で渡されたパスを読む | d2-verify が照合に使う「実装者の固定指示」。d2-run が渡す |
| 他スキルのトラブルシューティングを索引から辿る | [references/troubleshooting.md](references/troubleshooting.md) |

この規則は、リポジトリの `tests/distillery2/integration/plugin-layout.test.js` が検査する。
検査するのは、相対パス、`<skills>/` 記法、接頭辞の無い `d2-<他>/references/` の形である。

## 中身

### 定義

| ファイル | 内容 |
|---|---|
| [references/dataflow.yaml](references/dataflow.yaml) | **入出力の正本**。処理 (スキル・mode・d2-run・スクリプト)、読み書きするファイル (store)、段階の順 |
| [references/dataflow.md](references/dataflow.md) | 正本から生成した DFD (Mermaid)。全体図 3 枚、処理ごとの図、ファイルの一覧。手で直さない |
| [references/config-schema.md](references/config-schema.md) | `.distillery/config.yaml` (実行設定) の形。書き手は d2-foundation (`genConfig.js`)、読み手は d2-run・runGates・d2-implement |
| [references/assumption-record.md](references/assumption-record.md) | AssumptionRecord (実装者が仕様に無くて自分で決めた前提の記録) の形。書き手は d2-implement (tier)、読み手は d2-verify と `validateAssumptions.js` |
| [references/adr-inputs.md](references/adr-inputs.md) | ADR の front matter のうち、基盤の生成器が読むキー。書き手は d2-decide、読み手は d2-foundation (`adr.js`) |
| [references/handoff.md](references/handoff.md) | 担当の引き継ぎファイルの形と、「前のステップの課題にする線」 |
| [references/review-points.md](references/review-points.md) | 成果物の縦・横レビューの観点 |
| [references/writing.md](references/writing.md) | 人が読む文章の書き方の決まり。文章を書くすべての担当が読む (派遣文が渡す) |
| [references/troubleshooting.md](references/troubleshooting.md) | 各スキルのトラブルシューティングの索引 |

### スクリプト

| スクリプト | 用途 |
|---|---|
| `scripts/dataflow.js` | 正本の読み込みとパス照合。図の生成と整合性テストが使う |
| `scripts/genDataflow.js` | `dataflow.md` と、d2-run の派遣表の「派遣ごとの write-set」(管理ブロック) の生成。`--check` で古ければ exit 1 |
| `scripts/runGates.js` | ゲートの実行と記録 (`<run>/reports/gates.json`)。d2-run が回す |
| `scripts/feedbackBatch.js` | 課題ファイルの作成 (`file-issues`)、振り分けの材料 (`scan`)、0.1.x の途中の還流の片付け。d2-run が回す |
| `scripts/handoff.js` | 担当の引き継ぎファイルの検査、振り分け、課題の下書き |
| `scripts/decisionLog.js` | 決めたことの記録。推奨で決めたものも、人が答えたものも記録する |
| `scripts/reviewStep.js` | 成果物の縦・横レビュー (別系統のモデル) |
| `scripts/genDocsReadme.js` | `docs/README.md` と課題の一覧の生成。d2-run が各段階の commit 前に回す |
| `scripts/prTrailers.js` | main マージの squash commit の本文 (trailer) |
| `scripts/tokenReport.js` | headless 実行のトークン集計 (開発時の計測) |
| `scripts/lib/` | 共通ライブラリ (`basis`・`canonicalJson`・`gherkin`・`resolveDep`・`runState`・`schemaValidate`・`yaml`) |

各スキルのスクリプトは、共通ライブラリを `../../d2-common/scripts/lib/<x>` で require する。

## 正本を直すとき

手順書の入出力を変えたら、同じ変更を `references/dataflow.yaml` に入れる。
対象は、各スキルの読む / 書く、基盤の phase 表、d2-run の直接の読み書きである。

| 順 | すること |
|---|---|
| 1 | `references/dataflow.yaml` を直す |
| 2 | `node scripts/genDataflow.js` で、図と派遣表の write-set を作り直す |
| 3 | 派遣の書き込み範囲を変えたときは、テストの写し `tests/distillery2/integration/fixtures/allowed-writes.golden.json` も意図して更新する |

食い違いは、リポジトリの `tests/distillery2/integration/dataflow.test.js` が検出する。

派遣表の write-set は手で書かない。
正本の各派遣の `write_set` を直して、生成し直す。
`write_set` は派遣文の文面の断片である (注記もパスと同じ断片に書く)。

**照合の限界**: テストは、バッククォートで書かれたパス表記だけを照合する。
文章 (条件・例外) は照合しない。
パスの表記は、store の `path` か `aliases` のどれかに合わせる。

正本の書き方:

| 項目 | 決まり |
|---|---|
| `writes` と `allowed_writes` | `writes` は実際に書くもの。`allowed_writes` は派遣文で許す範囲で、`writes` を含む |
| パスでない制約と例外 | `notes` に同じ文字列で持ち、`write_set` の断片の中にも書く |
| 並列に動く処理が書くファイル | パスに `<tier>` を含めて、ティアごとに分ける |
| 手順書の略記 (`rdb-slice.yaml` など) | store の `aliases` に足す。使われなくなった alias は、テストが落とすよう求める |
| store を足すとき | `group` (`store_groups` のどれか) を付ける。図はファイル群の単位でまとめて描く |
| 図の大きさ | 各図は箱 9 以下、矢印 12 以下をテストで守る。超えたら図の分け方を見直す |

図のまとめ方は次のとおりである。
全体図は、段階を箱に、受け渡しを矢印にして、ラベルにファイル群を書く。
処理ごとの図は、ファイルが 8 を超えるとファイル群にまとめる。
