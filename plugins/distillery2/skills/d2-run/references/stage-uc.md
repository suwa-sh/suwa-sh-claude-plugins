# ④ UC の縦切り

UC を 1 つ、シナリオから main マージまで進める。

| 記号 | 意味 |
|---|---|
| `<run>` | `.distillery/runs/<slug>` |
| `<base_head>` | `runState.js status <run>` の `base_head` (有効な分岐元。写し直した後は写し直した先の main) |

## 始めるとき

新しい UC は branch を切る前に機能の最初の点検 (routing.md「機能の最初の点検」) を行い、上流の課題が無ければ `git switch -c feature/<slug>` (git-delivery.md「UC branch の開始と再開」2) → `node runState.js open . <slug>` → `branch_started` の追記 → `models_resolved` の記録、の順に行う (run のイベントは open の後に書く)。
再開は `node runState.js status <run>` で次の段階を決める。

run を開いたら `mode_resolved {mode}` を記録し、`FB scan` の `carried` にこの UC があれば routing.md のとおり `carried_issues` を記録して戻し先の段の派遣文に添える。

## 全段に共通の決まり

- 各段階の done を書いたら `impl(<slug>): <stage>` で commit する (attribution 行を付ける。git-delivery.md「commit の attribution」)
- 各段の担当を受理するたびに引き継ぎファイルを処理する (routing.md)
- 前のステップの課題で巻き戻したら、巻き戻しの commit (routing.md「前のステップの課題」) をしてから、`runState.js status` の `next_stage` から続ける
- `runState.js status` の `deferred_issues` (巻き戻さずに先送りした課題で、その段がまだ done でないもの) は、その段の派遣文に添える
- `runState.js done` / `event` の data は argv の JSON で渡す。長い JSON (日本語の一覧など) は `.distillery/logs/<name>.json` に書いて `--data-file <ファイル>` で渡す (argv と排他)
- 要求の差分で残った作業は ④ に持ち込まない (要求の差分が種類ごとの宛先に流す)

## モデル名の記録

開いた直後に、起動シーケンス 2 (startup.md) で解決したモデル名を記録する (as-built の生成情報とトークン集計で「どのモデルで実行したか」を示すため)。

`node runState.js event <run> models_resolved '{"session":"<このセッションのモデル名>","implementer":"<実装者の解決名>","verifier":"<Verifier の解決名>"}'`

値は **モデル ID だけ** (例 `claude-opus-4-7`)。別名の説明や注記を混ぜない (as-built の生成情報にそのまま出る)。

| 場面 | 扱い |
|---|---|
| 別名の解決先が分かっている | Agent ツールの別名 (`opus` 等) の解決先が分かっていれば (ハーネスの指示、過去の run の `models_resolved`、Verifier の報告) 最初から ID で書く |
| 別名の解決先が分からない | 分からないときだけ別名のまま書き、verify 段で Verifier の報告 1 行目 `model: <ID>` を得たら同じイベントを解決済みの ID で記録し直す (最後の models_resolved が有効) |
| 再開 | 再開時は、run の `models_resolved` に同じ ID が記録済みなら記録しない (別名しか無いときだけ解決済みの ID で記録し直す) |
| squash 済みで main マージの done が無い再開 (`merge=hold` で止めた後など) | 記録を main マージの 6 まで遅らせ、main マージの done と同じ commit に含める |

遅らせる理由: 追跡ファイルの `events.jsonl` が変わると feature が clean でなくなり、main へ取り込めない。

再開時や main マージ 6 で記録するときは、run の `models_resolved` に解決済みの ID があればそれを流用し、別名で記録し直さない。

## 段階の一覧

| 段階 | すること | done の条件 |
|---|---|---|
| **scenario** | シナリオを書かせ、網羅を検査し、レビューして、承認を記録する | 承認済み |
| **contract** | 契約を書かせ、検査し、レビューして、変わった生成物を分類する | slice と契約テストが生成済み、`contract_changes` 記録済み |
| **scaffold** | step 骨格と red 単体テストを書かせる | red baseline |
| **tier** | ティアごとに並列で実装させ、自分が 1 回だけゲートを回す | 全ティアの assumptions が ok、上の runGates で static / unit が pass |
| **contract-gate** | 契約のゲートを回す | contract まで pass |
| **integrate** | 結合させ、全段のゲートと、他 UC への回帰を回す | static から acceptance まで pass、共有の補助を変えたなら回帰の相手 (main マージ済みの UC と開き直した UC) の uc-bdd も pass |
| **verify** | 実装のレビューを回して直してから、ティアごとに並列で検証させる | 実装のレビューを反証して直した、全ティアの findings が ok で blocker 0 |
| **review** | 人レビュー ([review.md](review.md)) | `review_approved` 記録済み |
| **asbuilt** | 実装の記録を作らせ、検査し、レビューする | as-built が生成済み、集計の計装なし / 正常系に部品なしのティアが空 |
| **deliver** | main マージ ([main-merge.md](main-merge.md)) | `stages/deliver.done.yaml` が main にあり、`runState.js status` の `unfiled_issues` が空 |

verify と review の前提: `reports/gates.json` が `all_recorded: true` で全段 pass。部分実行の後は
`runGates.js --uc <slug> --tiers <関与ティア>` で 1 回通し、全段の証跡を揃えてから verify に進む
(`--tiers` を省くと config の全ティアに unit が走り、UC に関与しないティア (テスト 0 件) で落ちる)。

## 段階ごとの手順

### scenario の手順

(④ 冒頭で切った branch の上で) sub `d2-implement mode=scenario`。

`node <skills>/d2-implement/scripts/checkScenario.js features/<業務>/<slug>.feature --use-cases docs/requirements/use-cases.yaml --requirements docs/requirements/requirements.yaml --uc <slug> --acceptance-dir features/acceptance` を回し、結果 (JSON 1 行。`ok` / `missing` / `covered` / `unknown_tags` / `errors`。`features/acceptance/` が無ければ受入は読まず、UC の feature だけで判定する。エラーにしない) を読む。

**`missing` (対応づかない受入基準) があれば ok の前に分岐する** (`missing` があると `ok: false` で exit 1):

- 執筆役の報告がそれを**他 UC の振る舞い**と判断していれば、**要求の課題にして止まる**: 執筆役が `<run>/issues/` に書いた下書き (`target_step: requirements`。無ければ d2-run が書く: 対応づかない受入基準と、どの UC の振る舞いか、「仕様を UC 単位に分ける」) で routing.md「上流で止めるとき」の手順で止める (scenario は done にしない。要求の差分が仕様を UC 単位に分けた後、写し直して scenario から続ける)
- 執筆役が「この UC の振る舞い」と判断していれば (書き漏れ) 執筆役に差し戻す

`missing` が無く ok なら、次の順に進める。

1. シナリオのレビュー (`--point scenario`、対象は feature と受入の feature) を回す
2. シナリオの確認 (問い: この振る舞いで合っているか。モードの規則で人に返す問いがあるときだけ確認ページで止まり、無ければ推奨で承認して記録)
3. 承認を `node runState.js scenario-approve <run> --feature features/<業務>/<slug>.feature --acceptance-dir features/acceptance` で記録する
4. `node runState.js done <run> scenario '{"feature": "<path>"}'`
5. `node <skills>/d2-common/scripts/genDocsReadme.js` で README のシナリオ列を更新して `git add -A -- docs features .distillery/runs/<slug> && git commit -m "req(<slug>): scenarios" -m "<attribution 行>"`

手順 3 の `scenario-approve` は、feature の bytes の sha256 と、`@uc:<slug>` を持つ受入 feature の sha256 を計算して `scenario_approved {feature, feature_sha256, acceptance: {<path>: <sha256>}}` を書く。
受入の feature が無ければ `acceptance: {}`。
進行役が自分で計算しない。

### contract の手順

sub `d2-contract mode=uc uc=<slug>`。

受理の検査: `compileContracts.js contracts --check`、`compileRdbSchema.js contracts --check`、`validateUcIndex.js contracts` が exit 0。

examples が書けずに止まったら、担当の引き継ぎファイルの前のステップの課題を routing.md で振り分ける (要求に戻すなら上流で止める)。

受理の後に契約のレビュー (`--point contract`、対象は `git diff <base_head> -- contracts/` の変わったファイル) を回す。

受理時に `node <skills>/d2-contract/scripts/classifyContractChanges.js --uc <slug> --base <base_head> --json` で変わった契約の生成物 (`--base` で commit 済みの変更も数える。写し直しの後は機能の変更が commit 済みになる)を own / other_uc / shared に分け、結果を done の `contract_changes` に書く (契約は UC 間で共有するので、enum の追加などで他 UC のテストや共有の型も書き換わる)

done を書く前に `node runState.js uc-tiers . <slug>` で関与ティアを `use-cases.yaml` に書き戻す (下記「関与ティアの決め方」)。

### scaffold の手順

sub `d2-implement mode=scaffold`。

受理の検査:

- 受理時に既存の非テストファイルを変えていないことを確かめる (subagent-template.md「受理時の検査」)
- `runGates.js --uc <slug> --tiers <関与ティア> --only unit --expect-red unit` が exit 0、dry-run で undefined step 0

**実装が既にあるとき** (`<run>/invalidated/` に tier の done の退避 `*_tier.done.yaml` がある。巻き戻し・写し直しで、実装を終えた後に scenario か contract へ戻った run):

- 派遣文に `実装が既にある。この段より前で変わったファイル: <git diff --name-only <前回の scaffold の done の commit>..HEAD -- features contracts の一覧>` を添える (前回の scaffold の commit は `git log -1 --format=%H --grep "^impl(<slug>): scaffold"`)
- red は、変わった振る舞いを実装するティアにだけ求める。担当の報告の「red を書いたティア」で `runGates.js --uc <slug> --tiers <そのティア> --only unit --expect-red unit` を回す
- 担当が「red を書いたティア: なし」(変わった振る舞いが無い。説明文だけの変更など) と報告したら、`--expect-red` を回さずに `runGates.js --uc <slug> --tiers <関与ティア> --only unit` が exit 0 (既存のテストが緑のまま) を確かめ、done に `red_tiers: []` を書く
- 既存の非テストファイルを変えていないことは同じに確かめる (契約の変更で既存の実装が合わなくなった分は、tier の段が直す)

### tier の手順

attempt = `currentAttempt`。関与ティア (下記「関与ティアの決め方」) ごとに sub `d2-implement mode=tier` を**同じメッセージで並列派遣** (model = implementer)。
実装者は runGates を使わず commands を直接回す (記録なし)。

受理時に `node <skills>/d2-implement/scripts/validateAssumptions.js record <run>/attempt-<n>/assumptions.<tier>.yaml --uc <slug> --tier <tier> --attempt <n>` を全ティアで実行し、全ティアの受理後に**自分が 1 回だけ** `runGates.js --uc <slug> --tiers <関与ティア> --upto unit` を回す (記録の単一 writer。runGates は gates.json をゲート名単位で置き換えるので、並列の実装者に回させると互いの記録を消す)。
落ちたティアは同じ attempt のまま再派遣する

### contract-gate の手順

`runGates.js --uc <slug> --tiers <関与ティア> --upto contract`。
落ちたら `runState.js rewind <run> implementation` で tier に戻し、提供側ティアだけ再派遣する (他ティアは下の carry-forward。上限の exit 3 は人に返す)

### integrate の手順

1. sub `d2-implement mode=integrate`
2. 続けて `node <skills>/d2-foundation/scripts/genQlty.js --refresh --cwd .` (実装で増えたファイル種別に対する qlty の提案を足す。追加した plugins を報告に書く)
3. `runGates.js --uc <slug> --tiers <関与ティア> --from static` (増えた plugins の指摘は static に出る。落ちたら報告の分析に従い `rewind <run> implementation` で該当ティアを tier に戻す。verify / review / as-built はこの後なので、直した実装も検証と記録の対象になる)
4. 受理して done を書き `impl(<slug>): integrate` で commit する
5. 他 UC への回帰を回す (下)

差し戻しの後 (attempt ≥ 2) の扱い:
attempt ≥ 2 (差し戻しの後) も sub は**必ず派遣**する (ティアの入口や注入対象が変わっていれば結線の更新が要る)。
sub が「結線の変更は不要」と判断し、integrate.md の完了条件 (runGates `--from uc-bdd`、受入の網羅、計装範囲の `extractAsBuilt --dry-run`) を満たしたと報告すれば、`features/` に差分が無くても done にしてよい。done に `wiring_changed: false` を書く。

**他 UC への回帰は d2-run が回す**: 受理して done を書き `impl(<slug>): integrate` で commit した後、`git diff --name-only <base_head>..HEAD -- features/support features/step_definitions` (commit 済みの変更だけを見るので、commit の前に回さない) に変更があれば、回帰の相手 (`node runState.js regression-targets . --except <slug>` の全件。`status: done` の UC と、開き直した UC。開き直した UC は status が `planned` に戻るが、コードは main に残る) ごとに、そうでなくても contract の done の `contract_changes` に他の UC にも効く変更 (`also_used_by` の付いた own、`other_uc`、`shared`) があれば、その UC ごとに、`runGates.js --uc <他 slug> --only uc-bdd` を回し (他 UC の `<run>/traces/**` と `<run>/reports/**` は d2-run の runGates が書く。gitignore。as-built はその UC を次に回したときに作り直す)、落ちたら報告の分析に従い `rewind <run> implementation` で該当ティアを tier に戻す (integrate の write-set は自分の UC の reports / traces だけなので、実装者には回させない)

### verify の手順

実装のレビューを先に回し、直しを終えてから検証役を派遣する。
レビューと検証を同時に回すと、レビューの直しで前提やコードが変わり、検証の結果が古くなって検証役を派遣し直すことになる。

| 順 | すること |
|---|---|
| 1 | 変更ファイルの一覧を書く |
| 2 | 実装のレビューを、ティアごとに順に回す |
| 3 | 指摘があれば反証して直させ、ゲートを回し直して commit し、一覧を書き直す |
| 4 | ティアごとに検証役を並列で派遣する |
| 5 | 受理する |

1. `node runState.js verify-list <run>` で、変更ファイルの一覧 `.distillery/logs/verify-<slug>-attempt-<n>.txt` と、変更前との差分 `.distillery/logs/verify-<slug>-attempt-<n>.diff` を書く (どちらも gitignore。件数で渡し方を変えず、**常に**ファイルで渡す)。
   結果の `uncommitted` が 0 でなければ、先に commit する (verify の前の段の変更が残っている。作業ツリーが clean の状態で検証させる)
2. 実装のレビュー (`--point implementation`) を、ティアごとに 1 依頼を順に回す: `reviewStep.js run --point implementation --targets-file <一覧> --prefix apps/<tier>/ --out <run>/reviews/implementation-<tier>` (対象は一覧のそのティアの分)
3. 指摘があれば routing.md「縦・横レビュー」のとおり、そのティアの担当を「反証して直す」で派遣する。
   引き継ぎファイルの `refutations` に `accepted` が 1 件でもあれば (コードか前提が変わった)、全ティアで `validateAssumptions.js record` を回し直し、`runGates.js --uc <slug> --tiers <関与ティア>` で全段を回し直して pass を確かめ、`impl(<slug>): review fixes` で commit し、1 の `verify-list` を回し直す
4. ティアごとに sub `d2-verify` を**同じメッセージで並列派遣** (agent_type `distillery2:d2-verifier`、model = verifier)。派遣文に、変更ファイルの一覧のパス、変更前との差分のパス、実装者の固定指示のパス (`<skills>/d2-implement/references/tier-impl.md` の絶対パス。前提の照合先) を渡す
5. 受理時の作業 (下)

一覧の中身:

- 変更ファイル = `<base_head>` から今の作業ツリーまでの差分 (`git diff --name-only <base_head>..HEAD` に、commit 前の変更と未追跡のファイルを足したもの) から `docs/README.md`・`docs/requirements/use-cases.yaml`・`docs/feedback/**` (どの UC も書く簿記のファイル) を除いたもの
- 「他 UC と共有する変更ファイル」の初期候補 = 変更ファイルと `docs/as-built/_system/traceability-index.json` の `ucs[<他の slug>].files` の共通部分 (他 UC の slug つき。追跡表が無ければ「なし」)

追跡表の files は各 UC が**変更した**ファイルなので、基盤から在る共通コードは拾えない。Verifier が import 元を辿って足す (viewpoints.md「他 UC への波及」)。

受理時の作業:

- 受理時に `validateAssumptions.js verdicts` (前に、そのティアの `validateAssumptions.js record` が ok であること。verdicts は record の sha256 と照らす)
- 報告 1 行目の `model: <ID>` が models_resolved.verifier と違えば models_resolved を記録し直す
- blocker があれば `rewind <run> implementation` で該当ティアを tier に戻す (回数の上限は rewind が数える)
- findings の `upstream_issues` と `asks` も routing.md で振り分ける

### asbuilt の手順

1. `<run>/reports/asbuilt.json` があれば消し、`node runState.js set-aside-asbuilt-drafts <run>` で課題ファイルにしていない要約役の下書き (`issues/*_asbuilt_*.md`) を `invalidated/` へ移す
2. sub `d2-asbuilt` を派遣する (依存グラフの実態 → `extractAsBuilt.js` の抽出 → 要約 → `checkAsBuilt.js` の検査まで、要約役が通しで行う)
3. 受理時の検査をする (下)
4. 受理したら as-built のレビュー (`--point asbuilt`) を回し、`node <skills>/d2-common/scripts/genDocsReadme.js` (docs/README.md の UC 一覧に実装の記録を載せる。リンク切れなら exit 1)。commit

手順 1 の理由: 再開・差し戻しの後に前回の集計や下書きで受理しないため。
asbuilt を含む差し戻しの `invalidate --from` と `return-to-integrate` も同じく移す。

受理時の検査 (読むだけ):

- `node <skills>/d2-asbuilt/scripts/checkAsBuilt.js docs/as-built/<業務>/<UC>/index.md` が exit 0
- `<run>/reports/asbuilt.json` があり、`slug` が今回の UC、`attempt` が `runState.js status` の attempt と一致する
- 要約役の完了報告 (要約した 3 ブロックと引用したコード位置、課題の下書きの一覧) が届いている
- 一覧の下書きのファイルが `<run>/issues/` にあり、「下書きにした課題」と「下書きにしなかった行」の件数の合計が `checkAsBuilt.js` の出力の「課題の行」と同じ

どれかを満たさなければ d2-asbuilt に差し戻す。

要約役の完了報告を待つ理由: 抽出は前回の要約を残すので、成果物だけでは今回の要約を区別できない (subagent-template.md の例外)。
下書きの件数を照合する理由: as-built は人レビューの後なので、要約役が見つけた課題は下書きにして main マージ 1 の 3 で課題ファイルにする。

depcruise が失敗/未実行でも extractAsBuilt は config から「決定からの図」を描く (空にならない)

#### 計装の結線漏れ (integrate へ戻す)

集計の `instrumentation_gaps` (計装なしのティア) か `instrumentation_happy_gaps` (正常系に部品 (call) が無いティア) が空でなければ integrate の結線漏れ: asbuilt を done にせず integrate へ戻して結線を足す (図に出ないティア・部品は as-built の価値を落とす。要約役の報告文ではなく集計ファイルで判断する)。

戻し方: `node runState.js return-to-integrate <run> '{"instrumentation_gaps":[...],"instrumentation_happy_gaps":[...]}'` を 1 回だけ実行し、commit する。

このコマンドがすること:

- 同じ attempt の Verifier の結果 `findings.<tier>.yaml` を `<run>/invalidated/<ts>_attempt-<n>_findings.<tier>.yaml` へ移す
- integrate 以降の done (verify・review を含む) をまとめて退避する
- `returned_to_integrate {from, instrumentation_gaps, instrumentation_happy_gaps, moved_findings}` を記録する

findings を先に移すので、途中で止まっても再検証の前の結果は残らない。
再開したら同じ判断からもう一度実行してよい。

attempt は上げない (計装の結線は integrate の担当で、ティアのコードは変えない)。
integrate の派遣文に集計の 2 つの一覧を添える。
verify と review もやり直す (結線を変えるとゲートの結果と承認の根拠が変わる)。

### deliver の手順

[main-merge.md](main-merge.md) のとおり。
UC の課題を課題ファイルにし、squash して main へ ff merge し、main の上で main マージの done を commit する (PR を作らない)。
UC はここで終わる (課題は次の起動の自動選択が戻し先で振り分ける)

## ゲートが落ちたとき

**ゲートの回し直し**: 記録付きのゲート (runGates) が落ちたら、コードも commit も変えずに同じコマンドを **1 回だけ**回し直してよい (順番や並列に左右される不安定なテストの切り分け)。**static は回し直さない** (検査器の決定論的な指摘で、順番や並列に左右されない。④ のどこでも同じ)。

| 順 | すること |
|---|---|
| 1 | 回し直す前に 1 回目の `<run>/reports/gates.json` を `<run>/reports/gates.failed-1.json` に写す (runGates は回し直した段を上書きするので、1 回目の `failed_tests` が消える) |
| 2 | 同じコマンドを 1 回だけ回し直す |
| 3 | 回し直して通ったら、完了報告に 1 回目に落ちたゲートとテスト名 (写しの `failed_tests`) を書く |
| 4 | 2 回目も落ちたら落ちた扱い (推測で直さない・課題を外さない)。3 回目は回さない |

落ちた内容は出力をファイルに保存せず (headless では保存が拒まれる) gates.json の job の `output_tail` と `failed_tests` で読む。

**依存の脆弱性** (どの段階の runGates でも。ティアごとの `security` と生成物の鮮度の `generate` も、落ちたら job に `advisory` を残して通す。CI と hook は止める): static の quality が依存の脆弱性の指摘 (osv-scanner) だけで落ちたときは、runGates が通して job に `advisory` を残す (脆弱性情報の更新で UC と無関係に毎回落ちるため。CI は `commands.quality` をそのまま回すので、main の CI では落ちる)。`advisory` は止めずに、人レビューの材料と完了報告 (④ の main マージ) に載せる

**static の落ちの戻り先** (tier・integrate の runGates): 指摘の対象ファイル (`output_tail`) の書き込み範囲 (派遣表) で決める。

| 指摘の対象ファイルの範囲 | 戻り先 |
|---|---|
| あるティアの範囲 | 「tier の手順」「integrate の手順」のとおり (ティアの再派遣か attempt++) |
| integrate の範囲 (`features/step_definitions/**`・`features/support/**` など) | integrate の担当に差し戻す (attempt は上げない) |
| どの派遣の範囲でもない (依存の一覧・検査の設定・ワークフローなど) | main マージ 1 の 2 と同じく、推測で直さず材料を添えて止まる (人が feature に `impl(<slug>): <内容>` で commit して再開) |

## attempt を上げるとき

attempt++ は `runState.js rewind <run> implementation` で行う (`tier` 以降の done の退避と attempt-<n+1> の作成をまとめて行い、戻った回数を数える)。

| 順 | すること |
|---|---|
| 1 | 前 attempt の findings パスを tier の派遣に渡す |
| 2 | 戻さないティアの assumptions は `node runState.js carry-assumptions <run> --tiers <戻さないティア>` で新 attempt に複製する (carry-forward。複製したファイルの `attempt` フィールドを新しい番号に書き換える。hash の対象外なので値は変わらない) |
| 3 | 複製後に全ティアで `validateAssumptions.js record <assumptions> --uc <slug> --tier <tier> --attempt <n+1>` を再実行して ok を確認してから verify に進む |

## 関与ティアの決め方

**関与ティアの決め方** (scaffold / tier / contract-gate / integrate / 全段の証跡の `--tiers` と派遣先に使う。正は 1 か所。`--tiers` にはカンマ区切りで渡す。例 `--tiers frontend,backend-api`):

- contract 段階の完了時に、`node runState.js uc-tiers . <slug>` で関与ティアを確定し、`use-cases.yaml` の該当行の `tiers` に書き戻す (d2-run の write-set)。以後はこの `tiers` だけを読む。
  決め方: `contracts/uc-index.yaml` のその UC の operations / messages / tables が空でない種別の契約について、`contracts.json` の provider と consumers を集め、config の tiers の順に並べる。
  結果に `ambiguous` (同じ種別の契約が 2 つ以上ある) が出たら、contract の担当の報告と照らして `tiers` を確かめ、違えば手で直す
- `tiers_hint` (要求段階の推定) は slice が無い間の仮値であり、slice と食い違えば slice を優先する
- red baseline は関与する全ティアが落ちなければ成立しない (unit コマンド未定義のティアがあれば fail)
