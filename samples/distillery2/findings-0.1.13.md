# 0.1.13 フル再実走で見つかった課題

2026-09-26 に `/private/tmp/distillery2-run3/` で 0.1.13 を headless 実走 (要求 → 決定 → 基盤 → 貸出 UC の縦切り) した結果。
すべての段階を claude-opus-5-5 (`--model` 明示) で実行した。0.1.10 の課題 (`findings-0.1.10.md`) の再確認と、新しい気づきを分けて書く。

## 所要時間

| 段階 | 0.1.10 | 0.1.13 |
|---|---|---|
| ① 要求 | 10 分 | 14 分 (UC 27 件、blocked 4) |
| ② 決定 | 9 分 | 10 分 (ADR 8 件) |
| ③ 基盤 | 39 分 | 40 分 |
| ④ 貸出を登録する | 51 分 | 53 分 (verify の blocker で attempt 2) |

## 0.1.10 の課題の再確認

| 課題 | 結果 |
|---|---|
| ③-1 tsconfig の整形 / ③-2 空の src / ③-3 ③-5 順序 | 再発なし。static チェックポイントは 1 回で exit 0 (quality を含む) |
| ④-1 消費側の contract ゲート | frontend は `skipped (not a provider)`、backend-api は pass |
| ④-2 契約テストの整形 | **再発**。`biome-ignore-all format` は biome 2.2.5 では効かない (実測。2.5.14 では効く)。実装者が app の biome.json で `test/contract` を除外して回避。0.1.15 でルート biome.json の除外を追加 |
| ④-4 dry-run / ④-5 unit と契約の分離 / ④-11 課題の書式 | 再発なし |
| ④-6 ④-7 trailer | `Basis-*` は base 側の sha、`Basis-Base` / `Basis-Changed: requirements contracts` / `Co-Authored-By` が付いた |
| ④-12 models_resolved | ID だけになった (`verifier: opus` → verify 段で `claude-opus-5-5` に記録し直し) |
| ③-4 captureStories の白紙 (未修正) | 再発。design サブエージェントが http 配信で撮り直し |

## 新しい気づき

### 段階① 要求

- `genUseCases.js` は既存 use-cases.yaml の `no_spec_reason` を引き継がない。再生成すると blocked の理由が消え validateUseCases が FAIL する
- メール送信 3 UC の tiers_hint から frontend を外す判断を LLM がした (業務モデルがメールを画面として持つため、スクリプトは画面ありと判定)

### 段階③ 基盤

| # | 内容 | 対応 |
|---|---|---|
| 1 | genQlty の提案に osv-scanner が無い。genQlty が npm install の前に走り lockfile が無かった | 0.1.14 (`--refresh` を npm install 後と integrate 前に) |
| 2 | npm 10 の `npm install` が `Cannot read properties of null (reading 'edgesOut')` で失敗 (optional peer: vitest → browser-playwright → jsdom → canvas)。`npx npm@11 install` で lockfile を作ると npm 10 の `npm ci` は通る | 未対応 (devDependencies の見直しか、手順に npm 11 を明記) |
| 3 | design の後に `npm install` をもう一度実行する必要があった (packages/ui が workspace に加わる) | 0.1.14 (手順に明記) |
| 4 | ③ で契約の骨格を作った後も `docs/adr/architecture.md` (C4 図) は ② の時点のままで、契約の矢印が無い (config / CI は再生成するが C4 図は再生成していない) | 未対応 (③ で genArchitectureDoc も再生成する) |
| 5 | qlty の作業ディレクトリ (`.qlty/logs` `out` `results` `plugin_cachedir`) が gitignore されず commit された (`qlty init --dry-run` は `.qlty/.gitignore` を書かない) | 未対応 (genSkeleton の .gitignore に足す) |

### 段階④ 貸出を登録する

| # | 内容 | 対応 |
|---|---|---|
| 1 | `runGates.js --uc` を `--tiers` なしで流すと、UC に関与しない worker (テスト 0 件) の unit が落ちる。d2-run が「引数なしで 1 回通す」と指示していた | 0.1.15 (`--tiers <関与ティア>` を明記) |
| 2 | **Verifier も claude-opus-5-5 に解決された**。`models.verifier: opus` (Agent ツールの別名) が今回はセッションと同じモデルになった (transcript で確認。0.1.10 では claude-opus-4-7)。独立検証の条件を ID の上で満たさない | 未対応。方針が必要 (別名をやめて ID で指定 / 解決後に同じなら別モデルへ切替 / 同じでも進める) |
| 3 | 生成される契約テストが Authorization / Idempotency-Key を送らない。提供側にテスト専用のヘッダ補完を入れるしかない (0.1.10 の ④-3 と同根) | 未対応 |
| 4 | `genApiClient.js --check` を単体で流すと exit 1 (所有タグの有無が genContractTests の出力と食い違う) | 未対応 |
| 5 | integrate 担当が計装を確かめるために `extractAsBuilt.js` を回すと `docs/as-built/` に書き、write-set の外に出る | 未対応 (dry-run か出力先指定が要る) |
| 6 | attempt 2 の integrate で結線を変える必要が無い場合の扱いが `runState status` に無い (ゲートの再実行だけで done にした) | 未対応 (0.1.10 の ④-9 と同根) |
| 7 | push / PR を禁止された実行で feedback 段をどう終えるかが未定義 (`status: deferred`、URL なしで記録) | 未対応 (0.1.10 の ④-8 と同根) |
| 8 | frontend には契約テストが無く `test:contract` を直接流すと exit 1 (runGates では skipped で実害なし) | 対応不要 |
| 9 | `$VAR` を含む Bash が headless の承認で一部拒否された (`Contains simple_expansion`) | ハーネス側 |

### 実装の質 (参考)

- attempt 1 の blocker: backend-api「拒否応答を冪等キーに保存しない」、frontend「story にある貸出日の行を黙って削った」。attempt 2 で解消
- 要求側の課題 2 件 (登録前に貸出日・返却期限を出せない / 貸出期間の日数が要求に無い → 14 日で仮置き)。契約とルールの還流 4 件は分類のみ (PR 不可)

## 0.1.11〜0.1.13 の新機能の確認結果

| 機能 | 結果 |
|---|---|
| qlty ゲート (0.1.11) | static の quality ジョブが pass。実装者が app の biome.json を直す場面が 1 回あった |
| genQlty の提案優先 (0.1.12) | 土台 suggest (actionlint / biome / ripgrep / trufflehog / zizmor)。osv-scanner の欠落は 0.1.14 で対応 |
| 仮 test-app (0.1.13) | backend-api / worker に生成され typecheck pass |
| prTrailers の base 解決 (0.1.13) | `--base <base_head>` で Basis-* が base 側の sha になった |
