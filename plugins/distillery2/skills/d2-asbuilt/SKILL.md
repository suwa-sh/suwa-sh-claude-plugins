---
name: distillery2:d2-asbuilt
description: >-
  段階④の最後に、実装からドキュメントを抽出する。テスト結果・実行トレース・契約 slice・変更ファイルから UC ごとの as-built
  (docs/as-built/<業務>/<UC>/) と全体横断の追跡表 (docs/as-built/_system/) を作る。抽出 (決定論スクリプト) と要約 (LLM) を節ごとに分け、
  要約は必ずコード位置を根拠に付ける。抽出節は手で書かない。d2-run のサブエージェントとして呼ばれる。
---

# d2-asbuilt

引数: `uc=<slug> run=<.distillery/runs/<slug> へのパス>`

前提: d2-run がこのスキルの前に `extractAsBuilt.js` を実行済み (抽出節・要約プレースホルダが揃った状態)。
このスキルの LLM の仕事は **要約ブロック 3 つを埋める** こと。抽出節は触らない。

節と情報源の正本は [references/asbuilt-format.md](references/asbuilt-format.md)。

## 段取り

1. **抽出 (スクリプト)**: d2-run が次を実行する (このスキルは実行結果を前提にしてよい)。

   ```bash
   # 依存グラフの実態を取る (.dependency-cruiser.cjs は F2 生成)。失敗しても後続は続ける。
   npx depcruise --config .dependency-cruiser.cjs --output-type json apps packages \
     > .distillery/runs/<slug>/reports/depcruise.json
   node "${CLAUDE_PLUGIN_ROOT}/skills/d2-asbuilt/scripts/extractAsBuilt.js" \
     --run .distillery/runs/<slug> --depcruise .distillery/runs/<slug>/reports/depcruise.json
   ```

   - 書くもの: `docs/as-built/<業務>/<UC>/{index.md, sequence.md}`、
     `docs/as-built/_system/{traceability-index.json, api-inventory.md, data-flow.md, dependency-graph.md, index.md}`
   - 標準出力に `計装なしのティア: …` が出たら、UC のティアがトレースに現れていない (integrate の結線漏れ)。
     d2-run に報告する (as-built の「結果」にも「計装なし」と残る)
   - 決定論。同じ入力なら同じ出力。`generated_at` だけ最新イベント ts を使う
   - 再実行しても、既存の `<!-- 要約:begin <名前> -->…<!-- 要約:end -->` の中身は名前で保存する

2. **要約 (LLM = このスキル)**: `docs/as-built/<業務>/<UC>/index.md` の 3 か所の要約ブロックだけを埋める。

   | ブロック名 | 場所 | 書くこと |
   |---|---|---|
   | `概要` | 見出し直下 | この UC が「誰の・どんな操作を・何をもって完了とするか」。**1〜2 文** |
   | `整合性` | 何を守るか | **原子性 / 競合 / 冪等 / 障害と副作用** の 4 見出し (太字) に 2〜3 文ずつ。根拠のコード位置は各見出しの末尾に 1 行でまとめる (文ごとに付けない) |
   | `課題` | 課題 | 課題 1 つにつき 背景 / 現在の実装 / 対処 を 1 文ずつ (表でよい) |

## 要約の書き方 (厳守)

- **`<!-- 要約:begin <名前> -->` と `<!-- 要約:end -->` の間だけに書く**。他の行は 1 文字も変えない
- **根拠はコード位置 `path:line`**。`整合性` は見出しごとに末尾 1 行、`課題` と `概要` は文末に付ける。根拠は次だけを読んで得る:
  - 「決めたこと」の場所列が指すコード (AssumptionRecord の `target`)
  - 付録の変更ファイル
- コードから読み取れないことは書かない。推測・一般論・「べき論」を書かない
- 抽出節 (結果 / 入口 / どう動くか / 決めたこと / 証跡 / 付録) を書き換えない。表・箇条書きの数値を直さない
- 短さを優先する。`整合性` は 4 見出し合計 12 文以内、`課題` は課題 1 つ 3 文以内

## 読んでよいもの (read-set)

| 種類 | パス |
|---|---|
| 生成済み as-built | `docs/as-built/<業務>/<UC>/index.md` (要約対象) |
| 前提 | `<run>/attempt-<n>/assumptions.<tier>.yaml` の `target` が指すコード |
| 変更ファイル | 付録に列挙された `apps/<tier>/src/...` |

契約 source の全量・他 UC・設計書は読まない (存在しない)。

## 書いてよいもの (write-set)

`docs/as-built/<業務>/<UC>/index.md` の要約ブロックの中身だけ。sequence.md / `_system/*` は
スクリプトの生成物であり、LLM は書き換えない。git を使わない。

## 報告

- 要約した 3 ブロックと、各ブロックが引用したコード位置の一覧
- 要約できなかった項目 (根拠がコードから得られなかったもの) があれば、その理由
- 抽出の標準出力に「計装なしのティア」があれば、そのまま転記する
