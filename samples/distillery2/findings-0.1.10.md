# 0.1.10 フル再実走で見つかった課題

2026-09-25 に `/private/tmp/distillery2-run2/` で 0.1.10 を headless 実走 (要求 → 決定 → 基盤 → 貸出 UC の縦切り) した結果。
各段階の d2-run の報告と、実走ディレクトリの実物から拾った。「対応済み」の版は修正が入ったプラグイン版 (実走での再確認はまだ)。段階③・④の「プラグイン側の不具合」は d2-run 自身の報告を転記している。

## 段階① 要求 (10 分)

- 問題なし。UC 22 件、blocked 0。`validateUseCases.js` が途中で 1 回 exit 1 (YAML の字下げ漏れ) になり自己修正
- 前回 (0.1.0) と違い、根拠の無い UC 8 件を途中で削除している (要求 10 件・仕様 22 件)

## 段階② 決定 (9 分)

- 問題なし。ADR 9 件 (前回 8 件。業務モジュール境界 0009 が増えた)、C4 図 (graph 版)、README の ② 行にリンク
- confidence: low は認証 (OIDC) とブランド推定の 2 件

## 段階③ 基盤 (39 分)

| # | 内容 | 対応 |
|---|---|---|
| 1 | `genSkeleton.js` が作る tsconfig の配列の書き方が biome の整形と合わず、3 ティアの format_check が落ちる | 対応済み 0.1.13 |
| 2 | `genSkeleton.js` の `src/` が空で、tsc が対象ファイルを見つけられず typecheck が落ちる。空の `src/index.ts` (`export {};`) を置いて回避 | 対応済み 0.1.13 |
| 3 | 基盤 (F1〜F5) が契約の骨格より先に走るため、config と CI を契約の後で再生成する必要があった (d2-run ③ の順序) | 対応済み 0.1.13 (d2-run ③ の順序) |
| 4 | `captureStories.js` が Storybook の静的 build を `file://` で開くため画像が真っ白になる。ローカル HTTP で撮り直すスクリプトで回避 | 未対応 |
| 5 | 契約の初回 `compileContracts --check` は `@redocly/cli` 未導入 (npm install 前) で exit 1 | 対応済み 0.1.13 (npm install を契約の前に) |
| 6 | **モデルの割り当て**: `implementer: null` (セッション = Opus) と `verifier: opus` を「同じ」と判断して④が止まりかける。実際は Agent ツールの `opus` は claude-opus-4-7 に解決され別モデル (tokenReport で確認) | プロンプトで明示して回避。genConfig の既定と d2-run の解決規則を明文化する必要 |
| 7 | design: 利用者一覧画面が要求に無いのに screens.yaml に出た | 未対応 (確認材料には載る) |

## 段階④ 貸出を登録する (51 分)

| # | 内容 | 対応 |
|---|---|---|
| 1 | `runGates.js` が消費側 (frontend) にも contract ゲートを走らせる。契約テストは生成されないので vitest がテスト 0 件で exit 1。`--passWithNoTests` を手で足して回避 | 対応済み 0.1.13 (提供側だけ) |
| 2 | `genContractTests.js` の生成物が biome format を通らない。backend-api 実装者が `apps/backend-api/biome.json` で `test/contract/**` を整形対象外にして回避 (ゲートを緩める変更) | 対応済み 0.1.13 (biome-ignore-all) |
| 3 | `genContractTests.js` は認証ヘッダで決まる 401 / 403 を契約の例として書けない | 未対応 |
| 4 | `scaffold.md` の dry-run 手順に `-p dryrun` プロファイルが書かれていない (既定プロファイルは存在しない test-app を import して落ちる) | 対応済み 0.1.13 |
| 5 | unit コマンドの vitest が `test/**` も対象にするため、契約テストの失敗が unit ゲートにも出る | 対応済み 0.1.13 (設定を分離) |
| 6 | `prTrailers.js` の `Basis-Requirements` / `Basis-Contracts` が squash 前のコミットを指す (squash 後の履歴に残らない) | 対応済み 0.1.13 (merge-base から) |
| 7 | `prTrailers.js` の本文に Co-Authored-By が含まれない | 対応済み 0.1.13 (--co-author) |
| 8 | d2-run: 「還流は PR か issue にする」と headless の「push・PR を行わない」を両立する方法が無い (今回は `url: null` で保留) | 未対応 |
| 9 | d2-run: 差し戻しで tier 以降の done を消すと integrate の done も作り直しになり、コードに変更が無くても再記録が必要 | 未対応 |
| 10 | d2-asbuilt: サブエージェントに extractAsBuilt の標準出力が渡らず、計装の有無を自分で確認できない | 未対応 |
| 11 | d2-contract が書いた issue の下書き (`issues/contract-auth-responses-not-in-createLoan.md`) に front matter が無く、as-built の課題の表で「未分類」になる | 対応済み 0.1.13 (書式を明記) |
| 12 | `models_resolved.verifier` に別名と注記の長い文字列が入り、as-built の生成情報にそのまま出る。解決名 (claude-opus-4-7) は transcript からしか分からない | 対応済み 0.1.13 (Verifier が model 行を報告) |
| 13 | headless で `cd` を含むコマンドやシェルスクリプトの実行が承認待ちで止まった (コマンドを分けて回避) | ハーネス側 (allowedTools) |

## 0.1.5〜0.1.7 の新機能の確認結果

| 機能 | 結果 |
|---|---|
| title 必須 (0.1.6) | 前提 20 件・findings 26 件すべてに title が付き、`validateAssumptions.js` は一発で ok |
| 要約は表 + `checkAsBuilt.js` (0.1.6) | 「ok: 要約ブロック 3 個、違反なし」。書き直しなし |
| e2e シーケンス図と計装の範囲 (0.1.5) | frontend (screen, api-client) と backend-api (presentation, usecase, repository, gateway) が乗り、「計装なし」「正常系に部品なし」は出なかった |
| `docs/README.md` (0.1.7) | ①②③④の各段階で更新され、リンク切れで止まらなかった。UC の行が「実装済み」になり as-built へ辿れる |
| `models_resolved` (0.1.10) | 記録された (上記 12 の課題あり) |
