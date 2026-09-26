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

## 中身

| ファイル | 内容 |
|---|---|
| [references/dataflow.yaml](references/dataflow.yaml) | **入出力の正本**。処理 (スキル・mode・d2-run・スクリプト) と、読み書きするファイル (store) と、段階の順 |
| [references/dataflow.md](references/dataflow.md) | 正本から生成した DFD (Mermaid)。全体図・段階ごとの詳細図・ファイルの一覧。手で直さない |
| `scripts/dataflow.js` | 正本の読み込みとパス照合 (図の生成と整合性テストが使う) |
| `scripts/genDataflow.js` | `dataflow.md` の生成。`--check` で古ければ exit 1 |

## 正本を直すとき

手順書 (派遣表の write-set、各スキルの読む / 書く、基盤の phase 表、d2-run の直接の読み書き) の入出力を変えたら、
同じ変更を `references/dataflow.yaml` に入れ、`node scripts/genDataflow.js` で図を作り直す。
食い違いはリポジトリの `tests/distillery2/integration/dataflow.test.js` が検出する。

- `writes` は実際に書くもの、`allowed_writes` は派遣文で許す範囲 (writes を含む)
- 派遣表の write-set にあるパスでない制約・例外は、`notes` に同じ文字列で持つ
- 並列に動く処理が書くファイルは、パスに `<tier>` を含めてティアごとに分ける
- 手順書の略記 (`rdb-slice.yaml` など) は store の `aliases` に足す
