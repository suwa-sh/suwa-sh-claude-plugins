# Jev 実測ハーネス 実行手順

設計の正本は `DESIGN.md`。ここでは実行コマンドだけをまとめる。

## テスト（ネットワーク不使用）

```bash
node --test experiments/jev/test/*.test.js
```

注意: このリポジトリの Node バージョン（v22.17.0 で確認）では、`node --test experiments/jev/test/` の
ようにディレクトリを直接渡すと再帰探索されず `MODULE_NOT_FOUND` で失敗する。シェルのグロブでファイル一覧に
展開してから渡す（上記コマンド、または `tests/run-tests.js` のように明示的なファイルリストを渡す方式）。

## 質問文のドライラン確認（API を呼ばない）

```bash
node experiments/jev/run.js --docs samples/distillery/pipeline --name library --lang en --judge patterns --dry-run
node experiments/jev/run.js --docs samples/distillery/pipeline --name library --lang ja --judge model-types --dry-run
```

## 実測実行（実 API を呼ぶ。TYPESAFE_API_KEY が必要）

```bash
node experiments/jev/run.js --docs samples/distillery/pipeline --name library --lang en --judge patterns
node experiments/jev/run.js --docs samples/distillery/pipeline --name library --lang ja --judge patterns
node experiments/jev/run.js --docs samples/distillery/pipeline --name library --lang en --judge model-types
node experiments/jev/run.js --docs samples/distillery/pipeline --name library --lang ja --judge model-types
```

結果は `experiments/jev/results/<name>-<judge>-<lang>.json` に保存される。

## レポート生成

```bash
node experiments/jev/report.js experiments/jev/results/*.json --hi 0.8 --lo 0.2 > experiments/jev/results/report.md
```

## 実装の詳細

`patterns/patterns.json` の件数（30 件）、`decisions/*` の扱い、`numericGates`/`codeSignals` の分け方、
正解の候補の 3 値化（applied/not_applied/ambiguous）等は `DESIGN.md` に統合済み。実装との差分はない。

## 既知の限界

1パターンにつき `combine`（`all`/`any`）を1つしか持てないため、根拠の文が「(数値条件 A かつ 意味条件 B) または
(独立した意味条件 C)」という入れ子の論理になっているパターンは、独立シグナル（C）だけが成り立つ案件で非適用側に
倒れる（偽陰性）。該当するのは event-sourcing と backends-for-frontends の2パターン。詳細と該当箇所は
`DESIGN.md` の「既知の限界」節を参照。
