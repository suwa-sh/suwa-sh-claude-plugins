# distillery2 サンプル

`distillery2` 0.1.10 を、図書館蔵書管理システムの要望 (`samples/distillery/pipeline/input/初期要望.txt` と同じ) に対して
headless (`claude -p`) で実走した結果。要求 → 決定 → 基盤 → UC 1 つ (貸出を登録する) の縦切りまで。
入口は [`library-loan/docs/README.md`](library-loan/docs/README.md) (上流から下流まで辿れる)。

| ディレクトリ | 内容 |
|---|---|
| `library-loan/docs/` | README、要求 (USDM / RDRA / UC 一覧)、非機能グレード表、ADR 9 件と C4 図、開発ルール、画面一覧、as-built |
| `library-loan/contracts/` | 契約の正本 (OpenAPI / DB) と生成物 (bundle、UC slice) |
| `library-loan/features/` | 貸出 UC のシナリオ (6 件)、step 定義、Cucumber の support (API ドライバ、tracer 結線) |
| `library-loan/apps/`, `packages/` | 実装 (backend-api、frontend) とテスト基盤。`packages/ui`、Storybook アプリ、スクリーンショット (164 枚) は容量の都合で除外 |
| `library-loan/.distillery/` | 実行設定と、UC の実行状態 (events、done、AssumptionRecord、findings、ゲート結果、トレース、課題)。`logs/` (ハーネス) は含めない |

## 実走の手順

段階ごとに `claude -p --model claude-opus-5-5` を 1 回ずつ起動した。プロンプトは各段階の d2-run 呼び出し
(`stage=requirements input=...` / `stage=decide` / `stage=foundation` / `uc=貸出を登録する`) に「人の承認は推奨どおり承認したものとして進める」「push・PR はしない」を添えたもの。
ハーネス (起動スクリプト・プロンプト・ログ・`--model` の記録) は対象リポの `.distillery/logs/` (git 管理外) に置く。

## どのモデルで実行したか

| 役割 | モデル | 出典 |
|---|---|---|
| オーケストレータ (d2-run) と各段階のサブエージェント | claude-opus-5-5 | ハーネスの `--model`、`models_resolved` イベント、transcript |
| 実装者 (tier / integrate / scaffold など) | claude-opus-5-5 (`models.implementer: null` = セッション既定) | `models_resolved` イベント |
| Verifier (d2-verify) | claude-opus-4-7 (`models.verifier: opus` を Agent ツールに渡した結果) | transcript (`tokenReport.js`)。イベントには別名 `opus` と注記が残る |

as-built の付録「生成情報」に「モデル: 実装 … / 検証 … / オーケストレータ …」として転記される。

## 段階ごとの結果

| 段階 | 所要 | サブエージェント | 重み付きトークン | 結果 |
|---|---|---|---|---|
| ① 要求 | 10 分 | 22 | 2.1M | UC 22 件 (blocked 0)。検証すべて exit 0 |
| ② 決定 | 9 分 | 1 | 0.9M | NFR (モデルシステム 1)、ADR 9 件 (ティア 3: frontend / backend-api / worker)、C4 図 |
| ③ 基盤 | 39 分 | 3 | 2.6M | rules 6 / 依存規則 16 / test-support / 契約骨格 (API + DB) / config / CI / 画面 19 と部品。static ゲート exit 0 (2 回目) |
| ④ 縦切り | 51 分 | 12 + Verifier 4 | 5.0M + 1.2M | シナリオ 6 → 契約 `POST /loans` → 足場 → 2 ティア並列実装 (frontend は差し戻し 1 回) → 5 ゲート pass → 検証 blocker 0 → as-built → squash |

合計 1 時間 49 分、重み付き 11.8M トークン (raw 74M、重み: input 1 / cache_creation 1.25 / cache_read 0.1 / output 0)。
前回 (0.1.0、2026-09-24) は 2 時間 25 分・9.2M。時間は 25% 減、トークンは 28% 増 (画面部品の生成 1.9M と frontend の再実装・再検証が主因)。

## 段階④の結果

| 項目 | 値 |
|---|---|
| ゲート | static / unit / contract / uc-bdd / acceptance すべて pass (`all_recorded: true`) |
| シナリオ | 6 件。受入基準 4 件をすべて網羅 |
| AssumptionRecord | 20 件 (backend-api 14 / frontend 6)、すべて title 付き (schema 2.1)。Verifier の未申告 3 件 |
| findings (attempt 2) | blocker 0 / major 8 / minor 16。attempt 1 は frontend に blocker 1 (画面見本との食い違いを未起票) |
| 還流の課題 | 3 件 (contract 2 + front matter 無しの下書き 1)。headless のため PR / issue は未起票 |
| as-built | `docs/as-built/貸出業務/貸出を登録する/{index,sequence}.md` と `_system/` 5 ファイル。`checkAsBuilt.js` ok。計装の範囲は frontend (screen, api-client) と backend-api (presentation, usecase, repository, gateway) |
| squash | `feat: 貸出を登録する` 1 commit。trailer に UC / Basis / Gates / Assumptions / As-Built |

## 実走で見つかった課題

[`findings-0.1.10.md`](findings-0.1.10.md) に段階ごとに列挙した。主なもの:

- 消費側ティアにも contract ゲートが走り、テスト 0 件で落ちる (`runGates.js`)
- 生成した契約テストが biome format を通らない (`genContractTests.js`)
- `genSkeleton.js` の tsconfig と空の `src/` で static ゲートが 1 回目に落ちる
- `captureStories.js` が `file://` で開くため画像が真っ白
- `models.verifier: opus` とセッション既定が「同じ」と判断されて④が止まりかける
- `prTrailers.js` の Basis が squash 前のコミットを指す

0.1.0 の実走で見つかった課題は [`findings-0.1.0.md`](findings-0.1.0.md) (0.1.1 で対応済み)。

## 注意

- `.distillery/runs/*/reports` と `traces` は対象リポでは gitignore されるが、サンプルとして残している
- as-built の `basis` / `code` / 付録の変更ファイルは対象リポの git から取る。このサンプルは git 履歴を含まないコピーなので、
  `extractAsBuilt.js --run` をこのコピーに当てても、それらの欄と図以外の一部は同じにならない (図・表・要約は再現する)
- パスは `<repo>` (対象リポの root) と `~` に置き換えている
