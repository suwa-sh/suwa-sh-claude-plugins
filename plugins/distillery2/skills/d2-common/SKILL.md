---
name: d2-common
description: >-
  distillery2 の他のスキル (d2-run、d2-implement、d2-verify など) が相対パスで参照する共通定義。
  処理と入出力ファイルの正本 (DFD) を持つ。ユーザーの依頼で直接起動するスキルではない。
  distillery2 のスキル群の整合性を確かめるとき、どのスキルがどのファイルを読み書きするかを調べるときに読む。
---

# d2-common

distillery2 の各スキルが共通に参照する定義の置き場。単独では何も実行しない。
各スキルからは `../d2-common/...` の相対パスで参照する (スキルが兄弟ディレクトリとして並んでいる前提。プラグインでも `~/.agents/skills/` でも同じ)。

## パスの書き方

手順書のスクリプトと手順書の参照は `<skills>/<skill>/...` と書く (例 `node <skills>/d2-common/scripts/runGates.js`、`<skills>/d2-implement/references/tier-impl.md`)。

- `<skills>` = スキル群のディレクトリ (このスキルの `SKILL.md` がある場所の 1 つ上)。スキルを読み込んだときに表示されるこのスキルの場所 (Base directory) から決める
- コマンドに渡すときと、サブエージェントの派遣文に書くときは、絶対パスに展開する
- Claude Code のプラグインとして入れたときは `<skills>` = `${CLAUDE_PLUGIN_ROOT}/skills`。`~/.agents/skills/` に平置きしたときは `<skills>` = `~/.agents/skills`
- 共通のスクリプト (下の表) はすべて `<skills>/d2-common/scripts/` にある。プラグインの直下には置かない (スキルだけを別の場所に置いても届くように。0.1.29)
- 他のスキルの `SKILL.md` は、冒頭でこの節を参照する (単独で読み込まれても定義にたどり着く)

## 参照の向き (0.1.31)

d2-run (全スキルを派遣する入口) と d2-common 以外のスキルは、**他スキルの手順書 (`SKILL.md`・`references/**`・`templates/**`) を参照しない**。
複数スキルが読む定義は d2-common の `references/` に置き、各スキルは `../d2-common/references/<file>` (手順書の中では `<skills>/d2-common/references/<file>`) で参照する。

- 他スキルの**スクリプト**を `<skills>/<skill>/scripts/...` で呼ぶのはよい (生成器は持ち主のスキルに置く。0.1.22 の決め。例: d2-foundation の仕上げが d2-decide の `genArchitectureDoc.js` と d2-contract の `genContractTests.js` を回す)
- 派遣文で渡されたパスを読むのもよい (d2-run が渡す。例: d2-verify が照合に使う「実装者の固定指示」)
- トラブルシューティングの他スキルの項目は [references/troubleshooting.md](references/troubleshooting.md) (索引) から辿る
- この規則はリポジトリの `tests/distillery2/integration/plugin-layout.test.js` が検査する (相対パス・`<skills>/` 記法・接頭辞の無い `d2-<他>/references/` の形)

## 中身

| ファイル | 内容 |
|---|---|
| [references/dataflow.yaml](references/dataflow.yaml) | **入出力の正本**。処理 (スキル・mode・d2-run・スクリプト) と、読み書きするファイル (store) と、段階の順 |
| [references/dataflow.md](references/dataflow.md) | 正本から生成した DFD (Mermaid)。全体図 3 枚 (① 〜 ④ / ④ 実装まで / ④ 検証と as-built)・処理ごとの図・ファイルの一覧。手で直さない |
| [references/config-schema.md](references/config-schema.md) | `.distillery/config.yaml` (実行設定) の形。書き手は d2-foundation (`genConfig.js`)、読み手は d2-run・runGates・d2-implement (0.1.31 で d2-run から移した) |
| [references/assumption-record.md](references/assumption-record.md) | AssumptionRecord (実装者が仕様に無くて自分で決めた前提の記録) の形。書き手は d2-implement (tier)、読み手は d2-verify と `validateAssumptions.js` (0.1.31 で d2-implement から移した) |
| [references/adr-inputs.md](references/adr-inputs.md) | ADR の front matter のうち基盤の生成器が読むキー。書き手は d2-decide、読み手は d2-foundation (`adr.js`) (0.1.31 で d2-foundation から移した) |
| [references/troubleshooting.md](references/troubleshooting.md) | 各スキルのトラブルシューティングの索引 |
| `scripts/dataflow.js` | 正本の読み込みとパス照合 (図の生成と整合性テストが使う) |
| `scripts/genDataflow.js` | `dataflow.md` と、d2-run の派遣表の「派遣ごとの write-set」(管理ブロック) の生成。`--check` で古ければ exit 1 (0.1.31) |
| `scripts/runGates.js` | ゲートの実行と記録 (`<run>/reports/gates.json`)。d2-run が回す |
| `scripts/feedbackBatch.js` | 還流の git の状態遷移。d2-run が回す |
| `scripts/genDocsReadme.js` | `docs/README.md` と課題の一覧の生成。d2-run が各段階の commit 前に回す |
| `scripts/prTrailers.js` | 配送の squash commit の本文 (trailer) |
| `scripts/carryOver.js` | 要求の差分で残った作業 (`use-cases.yaml` の `carry_over`) の書き換え (0.1.30) |
| `scripts/tokenReport.js` | headless 実行のトークン集計 (開発時の計測) |
| `scripts/lib/` | 共通ライブラリ (`basis`・`canonicalJson`・`gherkin`・`resolveDep`・`runState`・`schemaValidate`・`yaml`)。各スキルのスクリプトは `../../d2-common/scripts/lib/<x>` で require する |

## 正本を直すとき

手順書 (各スキルの読む / 書く、基盤の phase 表、d2-run の直接の読み書き) の入出力を変えたら、
同じ変更を `references/dataflow.yaml` に入れ、`node scripts/genDataflow.js` で図と派遣表の write-set を作り直す。
食い違いはリポジトリの `tests/distillery2/integration/dataflow.test.js` が検出する。
派遣表の write-set は手で書かない: 正本の各派遣の `write_set` (派遣文の文面の断片。注記はパスと同じ断片) を直し、生成し直し、テストの写し `tests/distillery2/integration/fixtures/allowed-writes.golden.json` も意図して更新する (0.1.31)。
**照合の限界**: テストはバッククォートで書かれたパス表記だけを照合する。文章 (条件・例外) は照合しない。パスの表記は store の `path` か `aliases` のどれかに合うこと。

- `writes` は実際に書くもの、`allowed_writes` は派遣文で許す範囲 (writes を含む)
- 派遣文の write-set にあるパスでない制約・例外は、`notes` に同じ文字列で持ち、`write_set` の断片の中にも書く
- 並列に動く処理が書くファイルは、パスに `<tier>` を含めてティアごとに分ける
- 手順書の略記 (`rdb-slice.yaml` など) は store の `aliases` に足す。使われなくなった alias はテスト (d2) が落とすよう求める
- store を足したら `group` (`store_groups` のどれか) を付ける。図はファイル群の単位でまとめて描く
  (全体図は段階を箱・受け渡しを矢印にしてラベルにファイル群を書く。処理ごとの図はファイルが 8 を超えるとファイル群にまとめる)。
  各図は箱 9 以下・矢印 12 以下をテストで守る。超えたら図の分け方を見直す
