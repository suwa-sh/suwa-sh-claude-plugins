---
name: d2-asbuilt
description: >-
  段階④の最後に、実装からドキュメントを抽出する。テスト結果・実行トレース・契約 slice・変更ファイルから UC ごとの as-built
  (docs/as-built/<業務>/<UC>/) と全体横断の追跡表 (docs/as-built/_system/) を作る。抽出 (決定論スクリプト) と要約 (LLM) を節ごとに分け、
  要約は必ずコード位置を根拠に付ける。抽出節は手で書かない。依存グラフの実態・抽出・要約・書式の検査までを通しで行う。
  d2-run のサブエージェントとして呼ばれる。
---

# d2-asbuilt

入出力の正本: [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) (図: [dataflow.md](../d2-common/references/dataflow.md))

引数: `uc=<slug> run=<.distillery/runs/<slug> へのパス>`

このスキルが抽出のスクリプトを回し、要約ブロック 3 つを埋め、書式の検査が ok になるまで直す (0.1.22 から。以前は抽出と検査を d2-run が回していた)。
LLM が手で書くのは **要約ブロックの中だけ**。抽出節はスクリプトの生成物なので触らない。

節と情報源の正本は [references/asbuilt-format.md](references/asbuilt-format.md)。

git: 自分で git コマンドを打たない (commit は d2-run が行う)。抽出スクリプトの内部の git の読み取り (`rev-parse`・`diff`。変更ファイルと HEAD を得る) は例外。

## 段取り

1. **依存グラフの実態 (スクリプト)**: `.dependency-cruiser.cjs` は F2 の生成物。失敗しても後続は続ける (抽出は config から「決定からの図」を描く)。

   ```bash
   npx depcruise --config .dependency-cruiser.cjs --output-type json apps packages \
     > .distillery/runs/<slug>/reports/depcruise.json
   ```

2. **抽出 (スクリプト)**:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/d2-asbuilt/scripts/extractAsBuilt.js" \
     --run .distillery/runs/<slug> --depcruise .distillery/runs/<slug>/reports/depcruise.json
   ```

   - 書くもの: `docs/as-built/<業務>/<UC>/{index.md, sequence.md}`、
     `docs/as-built/_system/{traceability-index.json, api-inventory.md, data-flow.md, dependency-graph.md, index.md}`、
     集計 `.distillery/runs/<slug>/reports/asbuilt.json` (slug・attempt・計装なしのティア。d2-run が受理時に読む)
   - 標準出力 1 行をそのまま報告に転記する。`計装なしのティア: …` (トレースに現れないティア) か `正常系に部品 (call) が無いティア: …` (正常系のトレースに部品が無いティア) が出たら、
     integrate の結線漏れ。要約はそのまま進めてよい (integrate へ戻す判断は d2-run が集計ファイルで行う)
   - 決定論。同じ入力なら同じ出力。`generated_at` だけ最新イベント ts を使う
   - 再実行しても、既存の `<!-- 要約:begin <名前> -->…<!-- 要約:end -->` の中身は名前で保存する

3. **要約 (LLM = このスキル)**: `docs/as-built/<業務>/<UC>/index.md` の 3 か所の要約ブロックだけを埋める。
   **すべて表で書く。文章で書かない。**

   | ブロック名 | 場所 | 表の形 | 行 |
   |---|---|---|---|
   | `概要` | 見出し直下 | `\| 項目 \| 内容 \| 根拠 \|` | 誰が / 何をする / 完了の条件 の 3 行 |
   | `整合性` | 何を守るか | `\| 守ること \| 手段 \| 根拠 \|` | 原子性 / 競合 / 冪等 / 障害と副作用 の 4 行。手段が複数なら `<br>` で 1 行 1 手段 |
   | `課題` | 課題 | `\| 課題 \| 背景 \| 今の実装 \| 対処 \| 根拠 \|` | 課題 1 つ 1 行 |

4. **検査 (スクリプト)**: 書いたら必ず実行し、ok になるまで要約を直す。

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/d2-asbuilt/scripts/checkAsBuilt.js" docs/as-built/<業務>/<UC>/index.md
   ```

   検査する規則: ブロックが空でない / 表がある / セル 1 行 40 字以内 / 表の外に文を書かない / 見出しを使わない。
   根拠列とコード位置 `path:line` は字数に数えない (`code` の中身と句読点は数える)。
   0.1.5 以前の要約 (文章) を引き継いだときも違反になるので、表に書き直す (extractAsBuilt の標準出力に件数が出る)。

## 要約の書き方 (厳守)

- **`<!-- 要約:begin <名前> -->` と `<!-- 要約:end -->` の間だけに書く**。他の行は 1 文字も変えない
- **一文一義**。1 セルに 1 つの事柄。条件や例外は別の行 (`<br>`) にする。列挙は「A・B・C」でなく行を分ける
- **根拠はコード位置 `path:line`** を根拠列に書く (文中に書かない)。根拠は次だけを読んで得る:
  - 「決めたこと」の場所列が指すコード (AssumptionRecord の `target`)
  - 付録の変更ファイル
- コードから読み取れないことは書かない。推測・一般論・「べき論」を書かない
- 抽出節 (結果 / 入口 / どう動くか / 決めたこと / 証跡 / 付録) を書き換えない。表・箇条書きの数値を直さない
- 用語は要求・契約・コードにある名前を使う (言い換えない)

## 読んでよいもの (read-set)

要約 (LLM) が読むもの。抽出スクリプトが読むものは正本の「as-built の抽出」を見る。

| 種類 | パス |
|---|---|
| 生成済み as-built | `docs/as-built/<業務>/<UC>/index.md` (要約対象) |
| 前提 | `<run>/attempt-<n>/assumptions.<tier>.yaml` の `target` が指すコード |
| 変更ファイル | 付録に列挙された `apps/<tier>/src/...` |

契約 source の全量・他 UC・設計書は読まない (存在しない)。

## 書いてよいもの (write-set)

| 書き手 | パス |
|---|---|
| depcruise | `<run>/reports/**` (依存グラフの JSON) |
| extractAsBuilt.js | `docs/as-built/<業務>/<UC>/**`、`docs/as-built/_system/**`、`<run>/reports/asbuilt.json` |
| LLM (このスキル) | `docs/as-built/<業務>/<UC>/index.md` の要約ブロックの中身だけ |

sequence.md と _system 配下はスクリプトの生成物であり、LLM は書き換えない。

## 報告

- extractAsBuilt の標準出力 1 行 (そのまま)
- 要約した 3 ブロックと、各ブロックが引用したコード位置の一覧、`checkAsBuilt.js` の結果 (ok であること)
- 要約できなかった項目 (根拠がコードから得られなかったもの) があれば、その理由
- depcruise が失敗したら、その旨とエラーの 1 行
