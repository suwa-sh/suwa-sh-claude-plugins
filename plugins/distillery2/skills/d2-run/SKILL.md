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
| ③ の確認ページ | `.distillery/config.yaml`、`<run>/reports/**` (受理時の検査で bootstrap の gates.json を読む) | `<run>/reports/**` (仕上げの派遣前に bootstrap の gates.json を消す) |
| ③ の genContractTests.js --check | `contracts/**`、`.distillery/config.yaml`、`apps/*/test/contract/**`、`packages/contracts/**` | — |
| ③ の genDocsReadme.js | `.distillery/config.yaml`、`docs/requirements/rdra/**`、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`contracts/contracts.json`、`contracts/uc-index.yaml`、`docs/design/**`、`docs/as-built/_system/**`、`docs/as-built/<業務>/<UC>/**`、`docs/adr/*.md`、`docs/nfr/**`、`docs/rules/**` | `docs/README.md` |
| ④ の段階の進行・確認ページ・還流 | `.distillery/config.yaml`、`docs/requirements/use-cases.yaml`、`<run>/events.jsonl`、`<run>/reports/**`、`<run>/reports/asbuilt.json`、`<run>/attempt-<n>/findings.<tier>.yaml`、`<run>/attempt-<n>/assumptions.<tier>.yaml`、`<run>/issues/**`、`<run>/issues/<ts>_<tier>_<slug>.md`、`contracts/uc-index.yaml`、`docs/as-built/_system/**`、`.distillery/logs/feedback/<slug>/<issue>.result.json` (還流の派遣の結果)、`.distillery/logs/feedback/<slug>/<issue>.untracked.txt`、`.distillery/logs/feedback/<slug>/<issue>.issue.md` (gh issue create --body-file が読む) | `<run>/events.jsonl`、`<run>/invalidated/**` (差し戻しで退避した done と findings)、`docs/requirements/use-cases.yaml`、GitHub の PR と issue、`<run>/reports/asbuilt.json` (asbuilt の派遣前に消す)、`.distillery/logs/feedback/<slug>/<issue>.md` (還流の課題の写し)、`.distillery/logs/feedback/<slug>/<issue>.failed.diff` (止まった還流の差分)、`.distillery/logs/feedback/<slug>/<issue>.untracked.txt` (派遣の直前の未追跡ファイル)、`.distillery/logs/feedback/<slug>/<issue>.issue.md` (止まった課題の issue の本文) |
| ④ の checkScenario.js | `features/<業務>/<slug>.feature`、`features/acceptance/**`、`docs/requirements/use-cases.yaml`、`docs/requirements/requirements.yaml` | — |
| ④ の compileContracts.js --check | `contracts/**` | — |
| ④ の compileRdbSchema.js --check | `contracts/**` | — |
| ④ の validateUcIndex.js | `contracts/uc-index.yaml`、`contracts/**` | — |
| ④ の classifyContractChanges.js | `contracts/uc-index.yaml`、`apps/*/test/contract/**`、`packages/contracts/**`、`apps/<tier>/migrations/**`、`contracts/generated/slices/<slug>/**` | — |
| ④ の runGates.js | `.distillery/config.yaml`、`package.json`、`package-lock.json`、`cucumber.js`、`tsx-register.js`、`.qlty/qlty.toml`、`apps/<tier>/src/**`、`apps/*/test/contract/**`、`apps/<tier>/migrations/**`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`features/step_definitions/**`、`features/support/**`、`.dependency-cruiser.cjs`、`<run>/reports/**` | `<run>/reports/**`、`<run>/traces/**` |
| ④ の genQlty.js --refresh | `package.json`、`package-lock.json`、`.qlty/qlty.toml`、`apps/<tier>/src/**` | `.qlty/qlty.toml` |
| ④ の checkAsBuilt.js | `docs/as-built/<業務>/<UC>/index.md` (asbuilt の受理時の検査) | — |
| ④ の genDocsReadme.js | `.distillery/config.yaml`、`docs/requirements/rdra/**`、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`contracts/contracts.json`、`contracts/uc-index.yaml`、`docs/design/**`、`docs/as-built/_system/**`、`docs/as-built/<業務>/<UC>/**`、`docs/adr/*.md`、`docs/nfr/**`、`docs/rules/**` | `docs/README.md` |
| ④ の validateAdr.js (還流の受理) | `docs/adr/*.md` | — |
| ④ の genRules.js --check (還流の受理) | `docs/adr/*.md`、`references/rule-templates/`、`docs/rules/**` | — |
| ④ の genArchTests.js --check (還流の受理) | `docs/adr/*.md`、`.dependency-cruiser.cjs` | — |
| ④ の genContractTests.js --check (還流の受理) | `contracts/**`、`.distillery/config.yaml`、`apps/*/test/contract/**`、`packages/contracts/**` | — |
| ④ の genRdbDdl.js --check (還流の受理) | `contracts/**`、`.distillery/config.yaml`、`apps/<tier>/migrations/**`、`apps/*/test/contract/**`、`packages/contracts/**` | — |
| ④ の prTrailers.js と配送 | `docs/requirements/use-cases.yaml`、`<run>/reports/**`、`<run>/events.jsonl` | GitHub の PR と issue、`<run>/reports/**` |

## 起動シーケンス

1. 引数を解釈し、段階を決める (上の自動選択)
2. `.distillery/config.yaml` があれば読み、`models.implementer` と `models.verifier` を解決する。`implementer: null` はセッション既定モデルなので、**実際のモデル名に解決してから** verifier と並べて記録する。`verifier` は `opus` などの短い別名で書く (フル ID は `model` パラメータとして無効)。
   **独立検証の条件は「別のサブエージェント (文脈が新しい) で、実装役と同等以上のモデル」**。同じモデル ID に解決されても止めない (記録だけ残す。2026-09-26 のユーザー方針)。
   止めるのは verifier が実装役より明らかに弱い別名 (例: 実装役が opus で verifier が haiku) のときだけ
3. ④ なら UC を解決する: 引数が slug なら `use-cases.yaml` と照合、UC 名なら NFC 正規化して一意に一致する行を探す (複数なら候補を示して選ばせる)
4. (④ の再開時) 現在の branch が還流 branch (`feedback/<slug>/<issue>`。還流節) なら、clean 判定より先に還流節の「止まったとき」の a〜c を行って feature branch に戻る
   (リモートに同じ branch があれば c は branch を消さない。push 済みの commit は捨てない)
   (還流の派遣の途中で止まると、サブの書きかけが残った還流 branch の上で再開することになる。そのまま clean 判定をすると後始末の前に止まる)。
   その課題は還流節の 1 からやり直す
5. 作業ツリーの clean 判定 (④ の開始時。再開時は branch 一致を確認): `git status --porcelain` のうち、**追跡済みの変更**と、**未追跡でも `docs/` `apps/` `packages/` `contracts/` `features/` `.distillery/` 配下のファイル**だけを対象にする。これらがあれば勝手に stash / commit せず整理を依頼して停止する。それ以外のルート直下の未追跡ファイル (ハーネスの `run-stage.sh` などの実行スクリプト) は clean 判定に含めず、**報告に一覧として載せて無視**する (実走でハーネスのファイルが clean 条件を満たせなかったため)。`.git/info/exclude` への書き込みは前提にしない (権限で拒否されうる)

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

順序は「骨格・依存 → 契約の骨格 → design → 仕上げ (契約込みの config / CI / C4 図・画面部品の取り込み・契約テスト・チェックポイント)」。
契約の骨格は redocly (npm install 後) が要り、config / CI は契約 (`contracts/contracts.json`) を読むので、契約の後にもう一度生成する (0.1.10 実走 ③-3 / ③-5)。
design は config も契約も読まないので、契約の骨格の直後に回し、仕上げを 1 回の派遣にまとめる (0.1.22)。
スクリプトは d2-foundation が回す (phase の中身は d2-foundation の SKILL.md)。d2-run は派遣と受理だけを行う。どの派遣も再実行して安全 (中断したら同じ手順から再開する)。

1. sub `d2-foundation phase=all` (F1→F2→F3→F5→F7。骨格・設定・依存を入れる・qlty の提案を足す。この時点の genConfig は `contracts: []` の警告付きでよい)
2. sub `d2-contract mode=skeleton` (compile に redocly を使う)
3. (frontend ティアがあれば) sub `d2-design`。design が部品を生成したときだけ次の仕上げに `ui=true` を渡す。
   frontend ティアが無い (design を派遣しない) か、design が「画面を持たないプロダクトのため skip」と報告したら `ui=false`
   (前の実行の `docs/design/` が残っていても取り込ませない)。design の完了報告が届くまで仕上げに進まない (subagent-template.md の例外)
4. 仕上げの前に、契約の骨格と画面部品だけを先に commit する: `git add contracts docs/design && git commit -m "foundation: contracts and design"`
   (`docs/design` が無ければ `contracts` だけ。変更が無ければ飛ばす)。仕上げが作る config・C4 図・画面部品の取り込み記録は、
   入力を最後に commit した commit を basis に記録する。未 commit のままだと basis が空になり、契約や画面が変わっても古さを検出できない (0.1.22 の試し運転)
5. `.distillery/runs/bootstrap/reports/gates.json` があれば消してから、sub `d2-foundation phase=finish ui=<true|false>` (F8→F6→F7→F4→F9)。
   受理時の検査: `.distillery/runs/bootstrap/reports/gates.json` があり、`uc` が `bootstrap`、`result` が `pass`、`gates` (`{name, status}` の配列) のうち `name` が `static` の要素の `status` が `pass` (読むだけ。runGates を回し直さない)。加えて `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-contract/scripts/genContractTests.js contracts --config .distillery/config.yaml --out-root . --check` が exit 0 (骨格分の契約テストが今の契約から生成済み。static のゲートは契約テストの生成を見ないため)。
   満たさなければ報告を添えて人に見せ、先へ進まない
6. `.distillery/config.yaml` の tiers / contracts / commands / capabilities を確認ページで人に見せ、承認後に `node ${CLAUDE_PLUGIN_ROOT}/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add -A && git commit -m "foundation: rules, tests, config"`
   (差し戻しで契約の骨格や design をやり直したら、4 から繰り返す)

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
| **asbuilt** | `<run>/reports/asbuilt.json` があれば消してから (再開・差し戻しの後に前回の集計で受理しないため)、sub `d2-asbuilt` を派遣する (依存グラフの実態 → `extractAsBuilt.js` の抽出 → 要約 → `checkAsBuilt.js` の検査まで、要約役が通しで行う)。受理時の検査 (読むだけ): `node ${CLAUDE_PLUGIN_ROOT}/skills/d2-asbuilt/scripts/checkAsBuilt.js docs/as-built/<業務>/<UC>/index.md` が exit 0、かつ `<run>/reports/asbuilt.json` があり、`slug` が今回の UC、`attempt` が `runState.js status` の attempt と一致する。さらに要約役の完了報告 (要約した 3 ブロックと引用したコード位置) が届いている (抽出は前回の要約を残すので、成果物だけでは今回の要約を区別できない。subagent-template.md の例外)。どれかを満たさなければ d2-asbuilt に差し戻す。集計の `instrumentation_gaps` (計装なしのティア) か `instrumentation_happy_gaps` (正常系に部品 (call) が無いティア) が空でなければ integrate の結線漏れ: asbuilt を done にせず integrate へ戻して結線を足す (図に出ないティア・部品は as-built の価値を落とす。要約役の報告文ではなく集計ファイルで判断する)。戻し方: `node runState.js return-to-integrate <run> '{"instrumentation_gaps":[...],"instrumentation_happy_gaps":[...]}'` を 1 回だけ実行し、commit する (同じ attempt の Verifier の結果 `findings.<tier>.yaml` を `<run>/invalidated/<ts>_attempt-<n>_findings.<tier>.yaml` へ移し、integrate 以降の done (verify・review を含む) をまとめて退避し、`returned_to_integrate {from, instrumentation_gaps, instrumentation_happy_gaps, moved_findings}` を記録する。findings を先に移すので、途中で止まっても再検証の前の結果は残らない。再開したら同じ判断からもう一度実行してよい)。attempt は上げない (計装の結線は integrate の担当で、ティアのコードは変えない)。integrate の派遣文に集計の 2 つの一覧を添える。verify と review もやり直す (結線を変えるとゲートの結果と承認の根拠が変わる)。受理したら `node ${CLAUDE_PLUGIN_ROOT}/scripts/genDocsReadme.js` (docs/README.md の UC 一覧に実装の記録を載せる。リンク切れなら exit 1)。commit。depcruise が失敗/未実行でも extractAsBuilt は config から「決定からの図」を描く (空にならない) | as-built が生成済み、集計の計装なし / 正常系に部品なしのティアが空 |
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

`issues/*.md` の front matter `kind` で分ける。**上流の文書 (ADR・開発ルール・契約) は自分で書き換えない**。持ち主のスキルを派遣し、自分は branch・受理・commit・PR だけを行う。

| kind | 誰が書き換えるか | 経路 |
|---|---|---|
| rule | d2-decide `mode=feedback` (ADR を 1 本足す) → d2-foundation `phase=rules` (開発ルールとアーキテストを作り直す) | 還流 branch → PR (`Feedback-Kind: rule` trailer)。派遣が止まったら理由つきの issue (下の「止まったとき」) |
| contract | d2-contract `mode=feedback` (分割ファイルを直し、生成物を作り直す) | 還流 branch → PR (`Feedback-Kind: contract`)。UC 側は merge 後に contract 段階から再実行。派遣が止まったら理由つきの issue (下の「止まったとき」) |
| requirement | 人 | `gh issue create`。本文は issue の Markdown。UC は反映待ち (`blocked_on_requirement` イベント) で停止 |

各 PR / issue の URL を `feedback_filed {kind, url, issue_path}` に記録する (`issue_path` は `issues/<file>.md`)。上流の再生成はしない。

### rule / contract の手順 (課題 1 件ごと)

`<issue>` = 課題のファイル名 (拡張子なし)。還流 branch = `feedback/<slug>/<issue>`。`<fb>` = `.distillery/logs/feedback/<slug>` (gitignore。branch を切り替えても残る)。
受理のスクリプトは持ち主のスキルのもの: `${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/validateAdr.js`、`${CLAUDE_PLUGIN_ROOT}/skills/d2-foundation/scripts/{genRules,genArchTests}.js`、
`${CLAUDE_PLUGIN_ROOT}/skills/d2-contract/scripts/{compileContracts,compileRdbSchema,validateUcIndex,genContractTests,genRdbDdl}.js`。

1. feature branch の上 (clean) で、課題を `<fb>/<issue>.md` に写す。還流 branch には `issues/` も run ディレクトリも無い (UC の開始点から切るため)
2. 再開の判定 (上から順に):
   - `gh pr list --state all --head <還流 branch>` に PR がある → 8 へ
   - リモートに還流 branch があり、ローカルの還流 branch と同じ commit か、ローカルに無い (push の後に中断) → 7 の PR 作成だけへ (push は飛ばす)
   - リモートに還流 branch があり、ローカルの commit が違う → 止まって報告する (force push はしない)
   - ローカルにだけ還流 branch がある (push の前に中断) → 下の「止まったとき」の a〜c で捨ててから 3 へ
   - どれも無い → 3 へ
3. 未追跡ファイルの一覧を `<fb>/<issue>.untracked.txt` に書いてから (branch を切った直後に中断しても後始末できるように)、
   `git switch -c <還流 branch> <base_head>` (`base_head` は `branch_started` のもの)。以後も**各派遣の直前**に
   `git status --porcelain --untracked-files=all` の未追跡ファイルの一覧を `<fb>/<issue>.untracked.txt` に書く (中断して別のセッションで再開しても後始末に使える)。
   d2-decide と d2-contract の派遣の直前には、`<fb>/<issue>.result.json` も消す (結果ファイルを書くのはこの 2 つだけ)
4. 派遣と受理 (受理の `--check` は**生成物を commit する前に**回す。生成物の basis の行まで比べるので、commit の後では古いと判定される):
   - rule:
     1. sub d2-decide `mode=feedback` (派遣表「④ 還流 (ADR)」)。結果ファイルが `applied` で、`validateAdr.js docs/adr` が exit 0 なら受理し、
        `git add docs/adr && git commit -m "feedback(<slug>): adr"`
     2. sub d2-foundation `phase=rules` (派遣表「④ 還流 (ルールの再生成)」)。ADR の commit の後に回すので、ルールの basis が新しい ADR を指す。
        結果ファイルは使わない (このサブは書かない)。`genRules.js --adr docs/adr --out docs/rules --check` と `genArchTests.js --adr docs/adr --out .dependency-cruiser.cjs --check` が exit 0 で、
        write-set の外が変わっていなければ受理
   - contract: sub d2-contract `mode=feedback` (派遣表「④ 還流 (契約)」)。結果ファイルが `applied` で、`compileContracts.js contracts --check`、
     `compileRdbSchema.js contracts --check`、`validateUcIndex.js contracts`、`genContractTests.js contracts --config .distillery/config.yaml --out-root . --check`、
     `genRdbDdl.js contracts --config .distillery/config.yaml --out-root . --check` がすべて exit 0 なら受理
   - d2-decide / d2-contract の結果ファイルが `applied` 以外 (無いときも)、どれかの検査が落ちた、write-set の外が変わった (`git status --porcelain`) → 下の「止まったとき」
5. `genDocsReadme.js` で `docs/README.md` を更新する
6. commit: rule は `git add docs/rules .dependency-cruiser.cjs docs/README.md && git commit -m "feedback(<slug>): rules"`、
   contract は `git add contracts apps packages docs/README.md && git commit -m "feedback(<slug>): contracts"`
7. `git push -u origin <還流 branch>` → `gh pr create --base <base_branch> --head <還流 branch>`。本文に課題の要点と、contract なら d2-contract の報告の「他の UC への影響」を書く。
   trailer は `Feedback-Kind:`、`Feedback-From-UC:`、`Feedback-Issue:` (issues/ のパス)。PR の URL を控える
8. `git switch feature/<slug>` (還流 branch が clean なことを確かめてから)。**記録は feature に戻ってから書く** (run ディレクトリは還流 branch に無い)
9. `feedback_filed {kind, url, issue_path}` を記録し、`impl(<slug>): feedback filed` で commit する

### 止まったとき

a. 差分を `<fb>/<issue>.failed.diff` に保存する (`git diff <base_head>` (commit 済みの ADR も含む) と、`<fb>/<issue>.untracked.txt` に無い未追跡ファイルの一覧)。
   一覧のファイルが無い (控える前に止まった) なら、未追跡ファイルは消さずに一覧を報告して止まる
b. 還流 branch の変更を捨てる: `git restore --staged --worktree .` と、**派遣の直前に控えた一覧 (`<fb>/<issue>.untracked.txt`) に無かった未追跡ファイルだけ**を消す
   (write-set の外に作られたものも含む。ignore 済みは対象外)。消せないものがあれば feature に戻らず、止まって報告する
c. `git switch feature/<slug>` → リモートに同じ名前の branch が**無いときだけ** `git branch -D <還流 branch>` (push の前なので失うものは無い。ADR だけ commit 済みでも branch ごと捨てる)。
   リモートにあれば push 済みなので消さない (再開の判定 2 が PR 作成から続ける)
d. 止まった課題は、種類を問わず**理由を添えて issue にする** (保留にしない。保留は配送を止め続けるため。0.1.24 の試し運転):
   1. 止まった理由を決める。成り立った理由は**すべて**並べ、それぞれの証拠を書く:

      | 止まり方 | issue に書く理由 |
      |---|---|
      | 結果ファイルが `blocked` | 結果ファイルの `reason` |
      | contract の結果ファイルが `absent` で、`targets` の名前がどれも開始点の契約に無い (`git grep -q <名前> <base_head> -- contracts/` がすべて exit 1) | 「いま実装中の UC 自身の契約の穴 (対象: `targets`)。UC の merge 後に契約を直す」 |
      | `absent` だが、開始点の契約に名前が 1 つでもある | 「対象は開始点の契約にあるが、派遣の結果は absent だった」+ 対象と見つかった場所 (`git grep` の出力) |
      | 受理の検査で落ちた | 落ちた検査の名前と、出力の末尾 20 行 |
      | write-set の外が変わった | 「派遣が書き込み範囲の外を変えた」+ はみ出したパス |
      | 結果ファイルが無い (d2-decide / d2-contract の派遣) | 「派遣の結果ファイルが無い」 |

   2. 重複の照合: `gh issue list --state all --search "distillery2-feedback: <slug>/<issue>" --json url,body` で、本文に印の行 `distillery2-feedback: <slug>/<issue>` がある issue を探す。
      あれば作らずにその URL を使う (issue を作った直後・記録の前に中断した再開)
   3. 無ければ `gh issue create`。題は課題の `title` の後ろに「(還流で止まった)」。本文は、印の行 → 「## 止まった理由」(1 の理由と、差分の置き場所 `<fb>/<issue>.failed.diff`) → 課題の本文。
      本文は `<fb>/<issue>.issue.md` に書いて `--body-file` で渡す
   4. `feedback_filed {kind, url, issue_path}` を記録する (`kind` は元の課題のまま。`issue_path` は元の `issues/<file>.md`)。
      UC の PR 本文の「還流」に並び、trailer では `rule:<issue_url>` / `contract:<issue_url>` になる
   5. 2 の照合か 3 の起票が失敗したら、issue を作らず `feedback_deferred {kind, issue_path, reason}` を記録する
      (reason に止まった理由と、照合・起票できなかった理由。同じ `issue_path` の `feedback_filed` で解消する)。照合できないまま作ると、再開で重複しうる

issue にしない場面は 2 つ: 再開の判定 2 の「リモートの還流 branch とローカルの commit が違う」と、上の a・b の「一覧が無い / 消せないものがある」。
どちらも課題ではなく作業ツリーや branch の状態の問題なので、止まって報告する (課題は次の再開で 1 からやり直す)。

### PR / issue を作れない実行

**PR / issue を作れない実行** (push 禁止の headless・`gh` 未認証・リモート無し) では、還流 branch も派遣も作らず、各 issue を
`feedback_deferred {kind, issue_path, reason}` に記録して feedback を done にする (URL の無い `feedback_filed` は書かない)。
保留は deliver の前に必ず解消する (deliver 行。解消は上の手順を 1 から行う)。未解消の保留は `runState.js status` の `pending_feedback` に出る
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
