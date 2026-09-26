# distillery2 サンプル

`distillery2` を、図書館蔵書管理システムの要望 (`samples/distillery/pipeline/input/初期要望.txt` と同じ) に対して
headless (`claude -p`) で実走した結果。要求 → 決定 → 基盤 → UC の縦切りまでは 0.1.13、2 つ目の UC (返却を登録する) の縦切りは 0.1.16。
入口は [`library-loan/docs/README.md`](library-loan/docs/README.md) (上流から下流まで辿れる)。

| ディレクトリ | 内容 |
|---|---|
| `library-loan/docs/` | README、要求 (USDM / RDRA / UC 一覧)、非機能グレード表、ADR 8 件と C4 図、開発ルール、画面一覧、as-built |
| `library-loan/contracts/` | 契約の正本 (OpenAPI / DB) と生成物 (bundle、UC slice) |
| `library-loan/features/` | 貸出 UC (6 件) と返却 UC (4 件) のシナリオ、step 定義、Cucumber の support (API ドライバ、tracer 結線) |
| `library-loan/apps/`, `packages/` | 実装 (backend-api、frontend) とテスト基盤。`packages/ui`、Storybook アプリ、スクリーンショット (156 枚) は容量の都合で除外 |
| `library-loan/.distillery/` | 実行設定と、UC の実行状態 (events、done、AssumptionRecord、findings、ゲート結果、トレース、課題)。`logs/` (ハーネス) は含めない |
| `library-loan/.qlty/qlty.toml` | qlty の設定 (qlty の提案 + distillery2 の上乗せ)。qlty の作業ディレクトリ (logs / out / results) は含めない |

## 実走の手順

段階ごとに `claude -p --model claude-opus-5-5` を 1 回ずつ起動した。プロンプトは各段階の d2-run 呼び出し
(`stage=requirements input=...` / `stage=decide` / `stage=foundation` / `uc=貸出を登録する`) に「人の承認は推奨どおり承認したものとして進める」「push・PR はしない」を添えたもの。
ハーネス (起動スクリプト・プロンプト・ログ・`--model` の記録) は対象リポの `.distillery/logs/` (git 管理外) に置く。

## どのモデルで実行したか

| 役割 | モデル | 出典 |
|---|---|---|
| オーケストレータ (d2-run) と各段階のサブエージェント | claude-opus-5-5 | ハーネスの `--model`、`models_resolved` イベント、transcript |
| 実装者 (tier / integrate / scaffold など) | claude-opus-5-5 (`models.implementer: null` = セッション既定) | `models_resolved` イベント |
| Verifier (d2-verify) | **claude-opus-5-5** (`models.verifier: opus` を Agent ツールに渡した結果。0.1.10 の実走では claude-opus-4-7 だった) | Verifier の報告 1 行目 `model:`、`models_resolved` イベント、transcript (`subagents/agent-*.jsonl`) |

実装者と Verifier が同じモデルに解決された。独立検証の条件を ID の上では満たしていない (課題。`findings-0.1.13.md`)。
as-built の付録「生成情報」に「モデル: 実装 … / 検証 … / オーケストレータ …」として転記される。

## 段階ごとの結果

| 段階 | 所要 | サブエージェント | 重み付きトークン | 結果 |
|---|---|---|---|---|
| ① 要求 | 14 分 | 6 | 1.3M | UC 27 件 (blocked 4 は要求に無い UC)。検証すべて exit 0 |
| ② 決定 | 10 分 | 1 | 0.8M | NFR (モデルシステム 1、97 項目)、ADR 8 件 (ティア 3: frontend / backend-api / worker)、C4 図 |
| ③ 基盤 | 40 分 | 3 | 1.9M | rules 6 / 依存規則 17 / test-support / 契約骨格 (API + DB) / config / CI / qlty / 画面 24 と部品。static ゲート exit 0 (1 回目) |
| ④ 縦切り (貸出を登録する) | 53 分 | 13 + Verifier 4 | 5.0M + 1.4M | シナリオ 6 → 契約 `POST /loans` → 足場 → 2 ティア並列実装 → 5 ゲート pass → 検証 blocker 2 で差し戻し → attempt 2 で blocker 0 → as-built → squash |
| ④ 縦切り (返却を登録する、0.1.16) | 42 分 | 7 + Verifier 2 | 4.5M (Verifier 込み) | シナリオ 4 → 契約 `POST /returns` (+ `x-test-headers`、401/403) → 足場 → 2 ティア並列実装 → 5 ゲート pass → 検証 blocker 0 (差し戻しなし) → as-built → squash |

貸出 UC までで 1 時間 57 分、重み付き 10.3M トークン (raw 72M、重み: input 1 / cache_creation 1.25 / cache_read 0.1 / output 0)。返却 UC は 42 分・4.5M (raw 33M)。
前回 (0.1.10、2026-09-25) は 1 時間 49 分・11.8M。時間は 7% 増 (検証の差し戻しで attempt 2)、トークンは 13% 減。

## 段階④の結果 (貸出を登録する)

| 項目 | 値 |
|---|---|
| ゲート | static (quality = qlty を含む) / unit / contract / uc-bdd / acceptance すべて pass (`all_recorded: true`)。contract は提供側 backend-api だけ (frontend は skipped: not a provider) |
| シナリオ | 6 件。受入基準 3 件をすべて網羅 |
| AssumptionRecord | 17 件 (backend-api 12 / frontend 5) + Verifier が見つけた記録漏れ 1 件。confirmed 7 / auto 11 / rejected 0 |
| findings (attempt 2) | blocker 0 / major 7 / minor 14。attempt 1 は両ティアに blocker 1 ずつ (拒否応答を冪等キーに保存しない / 画面見本の行を黙って削った) |
| 還流の課題 | 契約 3 + ルール 1 (分類のみ。headless のため PR は未起票) + 要求側 2 (登録前の日付表示、貸出期間の日数) |
| as-built | `docs/as-built/貸出業務/貸出を登録する/{index,sequence}.md` と `_system/`。`checkAsBuilt.js` ok。計装なしのティア / 正常系に部品なしのティアは無し |
| squash | `feat: 貸出を登録する` 1 commit。trailer に UC / Basis-* (base 側の sha) / Basis-Base / Basis-Changed / Gates / Assumptions / As-Built / Co-Authored-By |

## 段階④の結果 (返却を登録する、0.1.16)

| 項目 | 値 |
|---|---|
| ゲート | 5 段すべて pass。contract は backend-api だけ (frontend は skipped) |
| シナリオ | 4 件 |
| 契約 | `POST /returns` に `x-test-headers` (Authorization / Idempotency-Key `{uuid}`) と 401 / 403 の `x-headers`。生成テストがヘッダを送り、提供側のテスト用ヘッダ補完は削除 |
| findings (attempt 1) | blocker 0 / major 5 / minor 16。差し戻しなし |
| AssumptionRecord | 16 件 (backend-api 9 / frontend 7)。confirmed 5 / auto 11 |
| as-built | 2 UC 分が `_system/` にまとまる (追跡表・API 一覧・データフロー)。checkAsBuilt ok |
| qlty | integrate の `genQlty --refresh` で osv-scanner が追加 |

## 実走で見つかった課題

[`findings-0.1.13.md`](findings-0.1.13.md) に、0.1.10 の課題の再確認結果と新しい気づきを列挙した (0.1.16 の再実走での再確認と新しい気づきは [`findings-0.1.16.md`](findings-0.1.16.md))。主なもの:

- Verifier が実装者と同じ claude-opus-5-5 に解決された (`opus` 別名の解決先が変わった)
- 生成した契約テストの `biome-ignore-all format` が biome 2.2.5 では効かない (0.1.15 でルート biome.json の除外を追加)
- `runGates.js` を `--tiers` なしで流すと UC に関与しない worker の unit がテスト 0 件で落ちる (0.1.15 で手順を修正)
- genQlty の提案に osv-scanner が無い (lockfile が無い時点で走った。0.1.14 の `--refresh` で対応)
- npm 10 の `npm install` が optional peer 依存で失敗し、npm 11 で回避した

0.1.10 の実走で見つかった課題は [`findings-0.1.10.md`](findings-0.1.10.md) (0.1.13 で 12 件対応)、0.1.0 のものは [`findings-0.1.0.md`](findings-0.1.0.md) (0.1.1 で対応済み)。

## 注意

- `.distillery/runs/*/reports` と `traces` は対象リポでは gitignore されるが、サンプルとして残している
- as-built の `basis` / `code` / 付録の変更ファイルは対象リポの git から取る。このサンプルは git 履歴を含まないコピーなので、
  `extractAsBuilt.js --run` をこのコピーに当てても、それらの欄と図以外の一部は同じにならない (図・表・要約は再現する)
- パスは `<repo>` (対象リポの root) と `~` に置き換えている
