---
name: d2-run
description: >-
  distillery2 のオーケストレータ。要求→決定→基盤→UC 縦切りの段階を振り分け、サブエージェントを派遣し、
  ゲートを安い順に実行し、人の判断が要る場面だけ確認ページ (toolbox:human-html-review) を出す。
  UC 単位で 1 commit に squash して PR を作る。通常はこのスキルだけ呼べばよい。
  「要求から実装まで回して」「次の UC を実装して」「<UC 名> を実装して」などで発動。
---

# d2-run

## 引数

```
/distillery2:d2-run                                   # 次に必要な段階を自動で選ぶ
/distillery2:d2-run stage=requirements input=<要望テキスト>
/distillery2:d2-run stage=decide | stage=foundation
/distillery2:d2-run uc=<slug | UC 名>                 # 指定 UC の縦切り (中断からの再開も同じ)
```

自動選択の順: `docs/requirements/use-cases.yaml` が無ければ ①、`docs/adr/` が無ければ ②、`.distillery/config.yaml` が無ければ ③、
それ以外は `use-cases.yaml` の先頭から `status` が `done` でない最初の UC を ④ で進める。

## 原則

- `docs/README.md` は上流から下流まで辿る入口。`${CLAUDE_PLUGIN_ROOT}/scripts/genDocsReadme.js` が既存の正本から生成する
  (管理ブロックの中だけ。人が書いた部分と distillery2 以外の文書は触らず、名前だけ列挙する)。各段階の commit 前に更新する

- **自分では本文をほぼ読まない**。読むのは `.distillery/config.yaml`、`use-cases.yaml`、run の events / done / reports、
  サブエージェントの報告だけ。各段階は fresh なサブエージェントに委譲する ([references/subagent-template.md](references/subagent-template.md))
- **git 操作は自分だけが行う** (単一コミッタ)。サブエージェントには git 禁止を必ず伝える ([references/git-delivery.md](references/git-delivery.md))
- 実行状態は `.distillery/runs/<slug>/` の events + done ([references/run-state.md](references/run-state.md))。
  操作は `${CLAUDE_PLUGIN_ROOT}/scripts/lib/runState.js` を通す。status ファイルは持たない
- 人に確認するときは **必ず `toolbox:human-html-review`** で確認ページを作り、showme の URL とローカルパスを示す。
  内部 ID (uc_id、SPEC-xxx、段階名) を本文に出さず名前で呼ぶ。回答は選択肢からコピーできる形にする
- 上流 (要求・ADR・契約) の再生成はしない。ズレは `basis.js check` で見つけ、差分 PR か issue にする

詰まったら各スキルの `references/troubleshooting.md` (環境依存の症状と回避策) を見る: [d2-run](references/troubleshooting.md) / [d2-foundation](../d2-foundation/references/troubleshooting.md) / [d2-contract](../d2-contract/references/troubleshooting.md)。手順に無い回避策を使ったら報告に書く。

## d2-run が直接読み書きするもの

サブエージェントに任せず、d2-run 自身と d2-run が回すスクリプトが読み書きするもの (処理ごとに 1 行)。`<run>` = `.distillery/runs/<slug>` (③ のチェックポイントは slug `bootstrap`)。入出力の正本は
[../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) (図は [dataflow.md](../d2-common/references/dataflow.md))。

| 処理 | 読む | 書く |
|---|---|---|
| ① ② の確認ページ | `docs/requirements/_review-summary.md`、`docs/adr/_review-summary.md` | — |
| ① ② の genDocsReadme.js | `.distillery/config.yaml`、`docs/requirements/rdra/**`、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`contracts/contracts.json`、`contracts/uc-index.yaml`、`docs/design/**`、`docs/as-built/_system/**`、`docs/as-built/<業務>/<UC>/**`、`docs/adr/*.md`、`docs/nfr/**`、`docs/rules/**` | `docs/README.md` |
| ③ の確認ページ | `.distillery/config.yaml` | — |
| ③ の npm install | `package.json` | `package-lock.json` |
| ③ の genQlty.js --refresh | `package.json`、`package-lock.json`、`.qlty/qlty.toml` | `.qlty/qlty.toml` |
| ③ の genConfig.js | `docs/adr/*.md`、`contracts/contracts.json` | `.distillery/config.yaml` |
| ③ の genCi.js | `.distillery/config.yaml` | `.github/workflows/**` |
| ③ の genArchitectureDoc.js | `docs/adr/*.md`、`contracts/contracts.json`、`docs/requirements/rdra/**` | `docs/adr/architecture.md` |
| ③ の importUi.js (F6) | `docs/design/**` | `packages/ui/**` |
| ③ の genContractTests.js | `contracts/**`、`.distillery/config.yaml` | `apps/*/test/contract/**`、`packages/contracts/**` |
| ③ の runGates.js --uc bootstrap | `.distillery/config.yaml`、`package.json`、`.qlty/qlty.toml`、`apps/*/test/contract/**`、`.dependency-cruiser.cjs`、`<run>/reports/**` | `<run>/reports/**` |
| ③ の genDocsReadme.js | `.distillery/config.yaml`、`docs/requirements/rdra/**`、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`contracts/contracts.json`、`contracts/uc-index.yaml`、`docs/design/**`、`docs/as-built/_system/**`、`docs/as-built/<業務>/<UC>/**`、`docs/adr/*.md`、`docs/nfr/**`、`docs/rules/**` | `docs/README.md` |
| ④ の段階の進行・確認ページ・還流 | `.distillery/config.yaml`、`docs/requirements/use-cases.yaml`、`<run>/events.jsonl`、`<run>/reports/**`、`<run>/attempt-<n>/findings.<tier>.yaml`、`<run>/attempt-<n>/assumptions.<tier>.yaml`、`<run>/issues/**`、`<run>/issues/<ts>_<tier>_<slug>.md`、`contracts/uc-index.yaml`、`docs/as-built/_system/**` | `<run>/events.jsonl`、`docs/requirements/use-cases.yaml`、GitHub の PR と issue |
| ④ の checkScenario.js | `features/<業務>/<slug>.feature`、`features/acceptance/**`、`docs/requirements/use-cases.yaml`、`docs/requirements/requirements.yaml` | — |
| ④ の compileContracts.js --check | `contracts/**` | — |
| ④ の compileRdbSchema.js --check | `contracts/**` | — |
| ④ の validateUcIndex.js | `contracts/uc-index.yaml`、`contracts/**` | — |
| ④ の classifyContractChanges.js | `contracts/uc-index.yaml`、`apps/*/test/contract/**`、`packages/contracts/**`、`apps/<tier>/migrations/**`、`contracts/generated/slices/<slug>/**` | — |
| ④ の runGates.js | `.distillery/config.yaml`、`package.json`、`package-lock.json`、`cucumber.js`、`.qlty/qlty.toml`、`apps/<tier>/src/**`、`apps/*/test/contract/**`、`apps/<tier>/migrations/**`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`features/step_definitions/**`、`features/support/**`、`.dependency-cruiser.cjs`、`<run>/reports/**` | `<run>/reports/**`、`<run>/traces/**` |
| ④ の genQlty.js --refresh | `package.json`、`package-lock.json`、`.qlty/qlty.toml`、`apps/<tier>/src/**` | `.qlty/qlty.toml` |
| ④ の depcruise | `.dependency-cruiser.cjs`、`apps/<tier>/src/**` | `<run>/reports/**` |
| ④ の extractAsBuilt.js | `.distillery/config.yaml`、`docs/requirements/use-cases.yaml`、`docs/requirements/requirements.yaml`、`docs/adr/*.md`、`<run>/reports/**`、`<run>/traces/**`、`<run>/attempt-<n>/assumptions.<tier>.yaml`、`<run>/attempt-<n>/findings.<tier>.yaml`、`<run>/events.jsonl`、`<run>/issues/**`、`<run>/issues/<ts>_<tier>_<slug>.md`、`contracts/generated/slices/<slug>/**`、`contracts/**`、`docs/design/**`、`features/<業務>/<slug>.feature`、`docs/as-built/<業務>/<UC>/**`、`docs/as-built/<業務>/<UC>/index.md`、`docs/as-built/_system/**` | `docs/as-built/<業務>/<UC>/**`、`docs/as-built/<業務>/<UC>/index.md`、`docs/as-built/_system/**` |
| ④ の checkAsBuilt.js | `docs/as-built/<業務>/<UC>/index.md` | — |
| ④ の genDocsReadme.js | `.distillery/config.yaml`、`docs/requirements/rdra/**`、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`contracts/contracts.json`、`contracts/uc-index.yaml`、`docs/design/**`、`docs/as-built/_system/**`、`docs/as-built/<業務>/<UC>/**`、`docs/adr/*.md`、`docs/nfr/**`、`docs/rules/**` | `docs/README.md` |
| ④ の prTrailers.js と配送 | `docs/requirements/use-cases.yaml`、`<run>/reports/**`、`<run>/events.jsonl` | GitHub の PR と issue、`<run>/reports/**` |

## 起動シーケンス

1. 引数を解釈し、段階を決める (上の自動選択)
2. `.distillery/config.yaml` があれば読み、`models.implementer` と `models.verifier` を解決する。`implementer: null` はセッション既定モデルなので、**実際のモデル名に解決してから** verifier と並べて記録する。`verifier` は `opus` などの短い別名で書く (フル ID は `model` パラメータとして無効)。
   **独立検証の条件は「別のサブエージェント (文脈が新しい) で、実装役と同等以上のモデル」**。同じモデル ID に解決されても止めない (記録だけ残す。2026-09-26 のユーザー方針)。
   止めるのは verifier が実装役より明らかに弱い別名 (例: 実装役が opus で verifier が haiku) のときだけ
3. ④ なら UC を解決する: 引数が slug なら `use-cases.yaml` と照合、UC 名なら NFC 正規化して一意に一致する行を探す (複数なら候補を示して選ばせる)
4. 作業ツリーの clean 判定 (④ の開始時。再開時は branch 一致を確認): `git status --porcelain` のうち、**追跡済みの変更**と、**未追跡でも `docs/` `apps/` `packages/` `contracts/` `features/` `.distillery/` 配下のファイル**だけを対象にする。これらがあれば勝手に stash / commit せず整理を依頼して停止する。それ以外のルート直下の未追跡ファイル (ハーネスの `run-stage.sh` などの実行スクリプト) は clean 判定に含めず、**報告に一覧として載せて無視**する (実走でハーネスのファイルが clean 条件を満たせなかったため)。`.git/info/exclude` への書き込みは前提にしない (権限で拒否されうる)

## ① 要求

1. sub `d2-requirements` (input=<要望テキスト>) を派遣する
2. 完了後、`docs/requirements/_review-summary.md` を材料に human-html-review で確認ページを作る
   (UC 一覧、業務ルール、状態遷移、受入基準。判断は「この要求で進めてよいか / 直す点」)
3. 承認されたら `node ${CLAUDE_PLUGIN_ROOT}/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add docs && git commit -m "req: initial requirements"`。差し戻しなら指摘を input に足して 1 に戻る

## ② 決定

1. sub `d2-decide` を派遣する
2. `docs/adr/_review-summary.md` を材料に確認ページ (非機能グレード表の要点、各決定と却下した案、confidence: low の決定は選択肢として提示)
3. 承認されたら `node ${CLAUDE_PLUGIN_ROOT}/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add docs && git commit -m "decide: nfr and adr"`。選択が変わった決定は ADR を直して (sub に戻す) 再提示

## ③ 基盤

順序は「骨格 → 依存 → 契約 → 契約込みの config / CI → design → 契約テスト」。契約の骨格は redocly (npm install 後) が要り、
config / CI は契約 (`contracts/contracts.json`) を読むので、契約の後にもう一度生成する (0.1.10 実走 ③-3 / ③-5)。

1. sub `d2-foundation phase=all` (F1→F5。この時点の genConfig は `contracts: []` の警告付きでよい)
2. 依存を入れる (`npm install`。オーケストレータが単一 writer として行う)。続けて
   `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genQlty.js --refresh --cwd .` (lockfile ができたので osv-scanner 等の提案が増える。増えた分だけ足す)
3. sub `d2-contract mode=skeleton` (compile に redocly を使う)
4. config・CI・C4 図を契約込みで再生成する (いずれも自分の生成物なら上書きする。C4 図は契約の矢印がこの時点で初めて描ける。0.1.13 実走 ③-4):
   `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genConfig.js --adr docs/adr --contracts contracts/contracts.json --out .distillery/config.yaml --cwd .`
   → `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genCi.js --config .distillery/config.yaml --cwd .`
   → `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/genArchitectureDoc.js docs/adr docs/adr/architecture.md --contracts contracts/contracts.json --rdra docs/requirements/rdra requirements=docs/requirements --cwd .`
5. (frontend ティアがあれば) sub `d2-design` → `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/importUi.js --from docs/design/storybook-app --cwd .` (F6)
   → `packages/ui` が workspace に加わるので `npm install` をもう一度 (lockfile を更新)
6. `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-contract/scripts/genContractTests.js contracts --config .distillery/config.yaml --out-root .` (骨格分)
7. チェックポイント: `node ${CLAUDE_PLUGIN_ROOT}/scripts/runGates.js --uc bootstrap --upto static` が exit 0
   (`bootstrap` は仮の slug。reports は捨ててよい)
8. `.distillery/config.yaml` の tiers / contracts / commands / capabilities を確認ページで人に見せ、承認後に `node ${CLAUDE_PLUGIN_ROOT}/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add -A && git commit -m "foundation: rules, tests, contracts, config"`

## ④ UC の縦切り

`<run>` = `.distillery/runs/<slug>`。`node runState.js open . <slug>` で開き、`node runState.js status <run>` で次の段階を決める。
開いた直後 (再開時も) に、起動シーケンス 2 で解決したモデル名を記録する (as-built の生成情報とトークン集計で「どのモデルで実行したか」を示すため):
`node runState.js event <run> models_resolved '{"session":"<このセッションのモデル名>","implementer":"<実装者の解決名>","verifier":"<Verifier の解決名>"}'`
値は **モデル ID だけ** (例 `claude-opus-4-7`)。別名の説明や注記を混ぜない (as-built の生成情報にそのまま出る。0.1.10 実走 ④-12)。
Agent ツールの別名 (`opus` 等) しか分からないときは別名のまま書き、verify 段で Verifier の報告 1 行目 `model: <ID>` を得たら
同じイベントを解決済みの ID で記録し直す (最後の models_resolved が有効)。
各段階の done を書いたら `impl(<slug>): <stage>` で commit する。

| 段階 | すること | done の条件 |
|---|---|---|
| **scenario** | branch `feature/<slug>` を切る (git-delivery.md)。sub `d2-implement mode=scenario`。`checkScenario.js` が ok。human-html-review でシナリオを確認 (問い: この振る舞いで合っているか)。承認を `scenario_approved` に記録し、`node ${CLAUDE_PLUGIN_ROOT}/scripts/genDocsReadme.js` で README のシナリオ列を更新して `git add docs features && git commit -m "req(<slug>): scenarios"` | 承認済み |
| **contract** | sub `d2-contract mode=uc uc=<slug>`。`compileContracts.js contracts --check`、`compileRdbSchema.js contracts --check`、`validateUcIndex.js contracts` が exit 0。examples 不足で止まったら issue を確認ページで見せ、契約を補うか要求に戻すかを選ばせる。受理時に `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-contract/scripts/classifyContractChanges.js --uc <slug> --json` で変わった契約の生成物を own / other_uc / shared に分け、結果を done の `contract_changes` に書く (契約は UC 間で共有するので、enum の追加などで他 UC のテストや共有の型も書き換わる。0.1.16 実走) | slice と契約テストが生成済み、`contract_changes` 記録済み |
| **scaffold** | sub `d2-implement mode=scaffold`。受理時に既存の非テストファイルを変えていないことを確かめる (subagent-template.md「受理時の検査」)。`runGates.js --uc <slug> --tiers <関与ティア> --only unit --expect-red unit` が exit 0、dry-run で undefined step 0 | red baseline |
| **tier** | attempt = `currentAttempt`。関与ティア (下記「関与ティアの決め方」) ごとに sub `d2-implement mode=tier` を**同じメッセージで並列派遣** (model = implementer)。実装者は runGates を使わず commands を直接回す (記録なし)。受理時に `validateAssumptions.js record` を全ティアで実行し、全ティアの受理後に**自分が 1 回だけ** `runGates.js --uc <slug> --tiers <関与ティア> --upto unit` を回す (記録の単一 writer。runGates は gates.json をゲート名単位で置き換えるので、並列の実装者に回させると互いの記録を消す)。落ちたティアは同じ attempt のまま再派遣する | 全ティアの assumptions が ok、上の runGates で static / unit が pass |
| **contract-gate** | `runGates.js --uc <slug> --tiers <関与ティア> --upto contract`。落ちたら提供側ティアだけ attempt++ で tier に戻る (他ティアはそのまま) | contract まで pass |
| **integrate** | sub `d2-implement mode=integrate`。続けて `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/genQlty.js --refresh --cwd .` (実装で増えたファイル種別に対する qlty の提案を足す。追加した plugins を報告に書く)。`runGates.js --uc <slug> --tiers <関与ティア> --from static` (増えた plugins の指摘は static に出る。落ちたら報告の分析に従い該当ティアを attempt++ で tier に戻る。verify / review / as-built はこの後なので、直した実装も検証と記録の対象になる)。attempt ≥ 2 (差し戻しの後) も sub は**必ず派遣**する (ティアの入口や注入対象が変わっていれば結線の更新が要る)。sub が「結線の変更は不要」と判断し、integrate.md の完了条件 (runGates `--from uc-bdd`、受入の網羅、計装範囲の `extractAsBuilt --dry-run`) を満たしたと報告すれば、`features/` に差分が無くても done にしてよい。done に `wiring_changed: false` を書く | static から acceptance まで pass |
| **verify** | ティアごとに sub `d2-verify` を**同じメッセージで並列派遣** (agent_type `distillery2:d2-verifier`、model = verifier、変更ファイル一覧を渡す)。あわせて「他 UC と共有する変更ファイル」の初期候補を渡す: 変更ファイル一覧と `docs/as-built/_system/traceability-index.json` の `ucs[<他の slug>].files` の共通部分 (他 UC の slug つき。追跡表が無ければ「なし」)。追跡表の files は各 UC が**変更した**ファイルなので、基盤から在る共通コードは拾えない。Verifier が import 元を辿って足す (viewpoints.md「他 UC への波及」)。受理時に `validateAssumptions.js verdicts`。報告 1 行目の `model: <ID>` が models_resolved.verifier と違えば models_resolved を記録し直す。blocker があれば該当ティアを attempt++ で tier に戻る (最大 3 回。超えたら人に報告して停止) | 全ティアの findings が ok で blocker 0 |
| **review** | 下記「人レビュー」 | `review_approved` 記録済み |
| **asbuilt** | 依存グラフの実態を取る: `npx depcruise --config .dependency-cruiser.cjs --output-type json apps packages > <run>/reports/depcruise.json` (`.dependency-cruiser.cjs` は F2 生成)。続けて `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-asbuilt/scripts/extractAsBuilt.js --run <run> --depcruise <run>/reports/depcruise.json` → sub `d2-asbuilt` (要約ブロック 3 つ。extractAsBuilt の標準出力 1 行を派遣文に添える) → `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-asbuilt/scripts/checkAsBuilt.js docs/as-built/<業務>/<UC>/index.md` が exit 0 (違反があれば d2-asbuilt に差し戻す) → `node ${CLAUDE_PLUGIN_ROOT}/scripts/genDocsReadme.js` (docs/README.md の UC 一覧に実装の記録を載せる。リンク切れなら exit 1)。commit。depcruise が失敗/未実行でも extractAsBuilt は config から「決定からの図」を描く (空にならない)。標準出力に「計装なしのティア」か「正常系に部品 (call) が無いティア」が出たら integrate の結線漏れ: integrate へ戻して結線を足す (図に出ないティア・部品は as-built の価値を落とす) | as-built が生成済み、計装なし / 正常系に部品なしのティアが無い |
| **feedback** | 下記「還流」 | 全 issue が起票済み (`feedback_filed`) か保留 (`feedback_deferred`) |
| **deliver** | 先に `node runState.js status <run> --json` の `pending_feedback` (起票されていない還流) を見る。空でなければ、push と `gh auth status` が通ることを確かめて還流節の手順で起票し、`feedback_filed {kind, url, issue_path}` を記録して `impl(<slug>): feedback filed` で commit する。通らなければ deliver せず、保留の一覧を報告して停止する (feedback の done は戻さない。push できる環境で再開すれば、ここから続く)。`pending_feedback` が空になってから git-delivery.md の手順で squash → push → PR。配送の記録は commit に入れず `reports/delivered.json` に書く。`use-cases.yaml` の `status: done` は PR merge 後の次 run で更新する | `gh pr list --head feature/<slug>` に PR がある (done ファイルは作らない) |

verify と review の前提: `reports/gates.json` が `all_recorded: true` で全段 pass。部分実行の後は
`runGates.js --uc <slug> --tiers <関与ティア>` で 1 回通し、全段の証跡を揃えてから verify に進む
(`--tiers` を省くと config の全ティアに unit が走り、UC に関与しないティア (テスト 0 件) で落ちる。0.1.13 の実走で worker が落ちた)。

attempt++ のとき: 戻すティアの `tier` 以降の done を `runState.js invalidate` で退避し、`attemptDir(n+1)` を作り、
前 attempt の findings パスを tier の派遣に渡す。戻さないティアの assumptions は新 attempt に複製し (carry-forward)、
複製したファイルの `attempt` フィールドを新しい番号に書き換える (hash の対象外なので値は変わらない)。複製後に全ティアで
`validateAssumptions.js record --attempt <n+1>` を再実行して ok を確認してから verify に進む。

**関与ティアの決め方** (scaffold / tier / contract-gate / integrate / 全段の証跡の `--tiers` と派遣先に使う。正は 1 か所):
contract 段階の完了時に、契約 slice の provider / consumers (`contracts.json` と `uc-index.yaml`) から関与ティアを確定し、
`use-cases.yaml` の該当行の `tiers` に書き戻す (d2-run の write-set)。以後はこの `tiers` だけを読む。
`tiers_hint` (要求段階の推定) は slice が無い間の仮値であり、slice と食い違えば slice を優先する。
red baseline は関与する全ティアが落ちなければ成立しない (unit コマンド未定義のティアがあれば fail)。

## 人レビュー (review 段階)

1. 材料: `reports/gates.json`、全ティアの findings (major / minor。「他 UC への波及」の `cross_uc_change` を含む)、AssumptionRecord と verdict、`issues/`、
   contract の done の `contract_changes` のうち「他の UC にも効く変更」(`also_used_by` の付いた own、`other_uc`、`shared`)
2. `validateAssumptions.js evidence <tier>:<assumptions_sha256>:<verdicts_sha256> ...` で `assumption_evidence_sha256` を算出する
3. human-html-review で確認ページを作る。問いの順:
   - 何を作ったか (シナリオの結果、ゲートの結果)
   - **回答必須の前提** (verdict が spec_absent / unlisted で、category か verified_category が security / persistence のもの)。
     1 件ずつ「承認 / 実装を直す / 要求を直す」を選ばせる
   - 回答任意の前提 (未回答は auto_confirmed)
   - Verifier の major / minor と issues (還流の分類案 rule / contract / requirement を添える)
   - 他の UC にも効く変更 (共有の契約の生成物と、前の UC の振る舞いが変わる箇所)
   - 判断: 「この実装で進めてよいか」
4. 回答を受けたら:
   - 「実装を直す」が 1 件でもあれば `review_rejected {rejected_assumptions}` を記録し、該当ティアを attempt++ で tier に戻る
   - 「要求を直す」があれば `issues/` に下書き (`kind: requirement`) を書き、**その場で**還流節の requirement の手順で起票する (`feedback_filed`)。
     起票できない実行 (push 禁止・`gh` 未認証・リモート無し) では `feedback_deferred` を記録する。どちらも `blocked_on_requirement` を記録して停止する
     (review は done にしない。要求の反映後は scenario からやり直す。PR は作らない)
   - 承認なら、全ティアの `record` / `verdicts` を再実行して hash が一致することを確認してから
     `review_approved {assumption_decisions[], assumption_evidence_sha256, gates_result}` を記録する。不一致なら承認を記録せず verify から再実行
5. 回答は `events.jsonl` にだけ記録する (review-notes ファイルは持たない)

## 還流 (feedback 段階)

`issues/*.md` の front matter `kind` で分類する。

| kind | 誰が | 経路 |
|---|---|---|
| rule | 自分 (d2-run) | `feedback/<slug>-<n>` branch を base から切り、ADR を追記 (`docs/adr/`) → `genRules.js` で rules 再生成 → PR (`Feedback-Kind: rule` trailer)。UC branch に戻る |
| contract | 自分 | 同上で契約の分割ファイルを直し `compileContracts.js` → PR (`Feedback-Kind: contract`)。UC 側は merge 後に contract 段階から再実行 |
| requirement | 人 | `gh issue create`。本文は issue の Markdown。UC は反映待ち (`blocked_on_requirement` イベント) で停止 |

各 PR / issue の URL を `feedback_filed {kind, url, issue_path}` に記録する (`issue_path` は `issues/<file>.md`)。上流の再生成はしない。

**PR / issue を作れない実行** (push 禁止の headless・`gh` 未認証・リモート無し) では、各 issue を
`feedback_deferred {kind, issue_path, reason}` に記録して feedback を done にする (URL の無い `feedback_filed` は書かない)。
保留は deliver の前に必ず解消する (deliver 行)。未解消の保留は `runState.js status` の `pending_feedback` に出る
(0.1.18 以前の記録の「url が空の `feedback_filed`」も保留として数える)。

## 完了報告

段階ごとに: 何をしたか、ゲート結果、人の判断が要るなら確認ページの URL、次にすること。
④ の deliver 後は PR URL と復旧用 ref を報告して終了する (次の UC へ自動継続しない)。

## 参照

- [references/config-schema.md](references/config-schema.md) — `.distillery/config.yaml`
- [references/run-state.md](references/run-state.md) — events / done / attempt
- [references/subagent-template.md](references/subagent-template.md) — 派遣の変数と write-set
- [references/git-delivery.md](references/git-delivery.md) — branch / squash / PR / trailer
- [references/troubleshooting.md](references/troubleshooting.md) — 実行環境 (headless の許可、npm、補助スクリプト) で踏んだ問題と回避策
- `${CLAUDE_PLUGIN_ROOT}/scripts/runGates.js`、`prTrailers.js`、`tokenReport.js`
