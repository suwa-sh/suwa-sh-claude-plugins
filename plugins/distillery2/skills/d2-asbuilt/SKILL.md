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
このスキルの LLM の仕事は **要約節だけを埋める** こと。抽出節は触らない。

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

   - 書くもの: `docs/as-built/<業務>/<UC>/{index.md, sequence.md, coverage.md}`、
     `docs/as-built/_system/{traceability-index.json, api-inventory.md, dependency-graph.md, index.md}`
   - `dependency-graph.md` は depcruise JSON があれば「実態 (dependency-cruiser)」を、無ければ config の
     ティア・契約から「決定からの図」を描く (どちらのラベルか本文に明記され、ファイルは空にならない)
   - 決定論。同じ入力なら同じ出力。`generated_at` だけ最新イベント ts を使う
   - 再実行しても、既存の `<!-- 要約:begin -->…<!-- 要約:end -->` の中身は保存する

2. **要約 (LLM = このスキル)**: `docs/as-built/<業務>/<UC>/index.md` の 2 か所の要約ブロックだけを埋める。

   - 5. 整合性の守り方: 原子性の境界・冪等キー・競合判定・再送と障害回復・副作用
   - 9. 逸脱と既知の課題: 既知の課題の背景と対処方針

## 要約の書き方 (厳守)

- **`<!-- 要約:begin -->` と `<!-- 要約:end -->` の間だけに書く**。他の行は 1 文字も変えない
- **すべての文にコード位置 `path:line` を付ける**。根拠は次だけを読んで得る:
  - 節 5 のヒスト (AssumptionRecord の `target`)、節 8 の前提の `target`
  - 変更ファイル (節 2 の入口ファイル一覧)
- コードから読み取れないことは書かない。推測・一般論・「べき論」を書かない
- 抽出節 (1〜4, 6〜8, 9 の抽出部分) を書き換えない。表・箇条書きの数値を直さない

## 読んでよいもの (read-set)

| 種類 | パス |
|---|---|
| 生成済み as-built | `docs/as-built/<業務>/<UC>/index.md` (要約対象) |
| 前提 | `<run>/attempt-<n>/assumptions.<tier>.yaml` の `target` が指すコード |
| 変更ファイル | 節 2 に列挙された `apps/<tier>/src/...` |

契約 source の全量・他 UC・設計書は読まない (存在しない)。

## 書いてよいもの (write-set)

`docs/as-built/<業務>/<UC>/index.md` の要約ブロックの中身だけ。sequence.md / coverage.md / `_system/*` は
スクリプトの生成物であり、LLM は書き換えない。git を使わない。

## 報告

- 要約した節 (5 / 9) と、各文が引用したコード位置の一覧
- 要約できなかった項目 (根拠がコードから得られなかったもの) があれば、その理由
