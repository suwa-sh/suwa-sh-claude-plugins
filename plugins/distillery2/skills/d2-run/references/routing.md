# 振り分け: モード・人に返すとき・前のステップの課題・縦横レビュー

SKILL.md の各段から呼ぶ規則。`<H>` = `node <skills>/d2-common/scripts/handoff.js`、`<D>` = `node <skills>/d2-common/scripts/decisionLog.js`、`<RS>` = `node <skills>/d2-common/scripts/lib/runState.js`。

## モード

起動の引数 `mode=auto` (既定) / `mode=recommend`。config には置かない (③ で作り直されるため)。④ では run を開いた後に `mode_resolved {mode}` を記録する。

## 人に返すとき

| 場面 | auto | recommend |
|---|---|---|
| 選び方の問い (`choice`) で推奨がある | 推奨で決めて記録 | 推奨で決めて記録 |
| 事実が分からない問い (`unknown_fact`) | 人に返す | 推奨で仮置きして記録 (最後のまとめで「仮置き」) |
| 推奨が無い問い (`recommended: null`) | 人に返す | 進行役が推奨を作って仮置きし記録する (`<D> add ... --by recommended --provisional`。`route` の `make_recommendation`)。最後のまとめに「進行役が推奨を作った (仮置き)」で載る |
| 要求の承認 (①・要求の差分)・人レビュー | **必ず人に返す** | 推奨で承認して記録 |
| 決定・基盤の設定・シナリオ・やり直す UC の確認 | 推奨で承認して記録 (人に返す問いが 1 つでもあれば、その問いと一緒に確認ページを出す) | 同じ |
| レビューの反証で `needs_info` が残った | 人に返す | 進行役が推奨を作って仮置きし記録する (`--page page:refute:<場所>:<指摘>` に `--provisional`) |
| 上流への課題 (`target_step` が requirements / decide / foundation) | 人に返す (機能を止めて、上流を直すか取り下げるか聞く) | 推奨の直し方で上流の差分へ進み、記録する |
| 戻り道の回数の上限 (`runState.js` が exit 3) | 人に返す | 人に返す |
| レビューを回せない (`reviewStep.js` が exit 4) | 人に返す (同じモデルで代わりにレビューする / このまま進む / 止める) | 同じモデルで代わりにレビューし、`fallback: same-model` を記録する |
| ゲートが 2 回落ちた・受理の検査に落ちた (再派遣で直らない) | 人に返す | 機能の中なら `<RS> rewind <run> implementation` (回数に数える。上限で人へ)。上流の段なら人に返す |
| プラグインの不具合 (反証の結果・課題の戻し先が `plugin`。決定の差分の `reason_kind: plugin`) | 人に返す | **人に返す**: 下の「プラグインの不具合」で課題を `kind: plugin` にし、機能の中ならその機能を止める (ほかの機能は続く) |
| 終わったとき | 完了報告 | 完了報告と、推奨で決めたものの一覧の確認ページ 1 枚 (`<D> list --root . --since <起動の時刻> --format md`) |

`mode=recommend` で人に返すのは、戻り道の上限とプラグインの不具合だけ (要求の承認と人レビューも推奨で承認する)。それ以外の止まりは不具合として報告する。
人に返すときは human-html-review の確認ページを出して止まる。確認ページには、人に返す問いをすべて載せ、選択肢ごとに影響を、問いごとに推奨 (初期選択) を書く。
**推奨の無い確認ページを作らない** (推奨が決まらない問いだけは「推奨なし (理由)」と書く)。人が答えたら `--by human` で記録する。

### 確認ページの問いの ID と推奨

| 問い | ID | 推奨 |
|---|---|---|
| この要求で進めてよいか (①・要求の差分) | `page:requirements:approve` | 承認。ただし要求のレビューに FAIL が残る (2 ラウンド目でも) なら「直す点」 |
| この決定で進めてよいか | `page:decide:approve` | 承認 |
| この実行設定で基盤を確定してよいか | `page:foundation:approve` | 承認 |
| この振る舞いで合っているか (シナリオ) | `page:scenario:approve` | 承認 |
| やり直す / 後で (UC ごと) | `page:reopen:<slug>` | やり直す |
| 残った作業ごとに対応する / 無視 (要求の差分) | `page:requirements-diff:<項目>` | 対応する (候補が 1 つに決まらない前提は推奨なし) |
| 回答必須の前提ごとに 承認 / 実装を直す / 要求を直す | `page:review:assumption:<tier>:<A-id>` | 検証役の verdict が `contradicts` でなければ承認、`contradicts` なら実装を直す |
| この実装で進めてよいか (人レビュー) | `page:review:approve` | 進める (回答必須の前提に「実装を直す」が無いとき) |
| 上流への課題をどうするか | `page:upstream:<課題>` | 上流を直す (担当の推奨の直し方で) |
| 戻り道の上限を超えた | `page:limit:<slug>` | 止めて見直す (続けるなら `--override-limit`) |
| レビューを回せない | `page:review-unavailable:<場所>` | 同じモデルで代わりにレビューする |
| 途中で止まった還流 (0.1.x) | `page:migration:abandon` | 捨てる (課題ファイルは残る) |

答えは問いごとに `<D> add (--run <run> | --root .) --page <ID> --question "<問い>" --answer "<答え>" --by recommended|human [--recommended "<推奨>"]` で記録する。

## 引き継ぎファイルの処理 (担当を受理するたびに)

1. 担当の報告の本文を `.distillery/logs/report-<段>[-<tier>]-<ts>.md` に保存し、`<H> validate <handoff> --report <そのファイル>` が exit 0 (無い・不合格なら受理しない。再派遣。報告の「決めたこと」が `D<n>` で引き継ぎファイルの `decisions` と 1 対 1 か、ID の無い判断が無いかも見る)。検証役は `<H> route <findings> --findings --mode <mode>`
2. `<H> route <handoff> --mode <mode>`:
   - `decide[]`: 問いごとに `<D> add (--run <run> | --root .) --handoff <handoff> --ask <id> --answer "<answer>" --by recommended` (機能の中は `--run`、上流の段は `--root .`。検証役は `--handoff <findings>`。`unknown_fact` は自動で仮置きになる)
   - `to_human[]`: 人に返す問いとして、この段の確認ページに載せる (確認ページの無い段なら、この問いだけの確認ページを出して止まる)
   - `make_recommendation[]` (recommend だけ): 問いの選択肢から推奨を 1 つ選び、理由を添えて `<D> add ... --handoff <handoff> --ask <id> --answer "<選んだ案>" --by recommended --provisional`
   - `issues`: 下の「前のステップの課題」(`issues.plugin` は「プラグインの不具合」)
   - `needs_info[]`: auto は人に返す。recommend は進行役が推奨を作って仮置きする (上の表)
   - `plugin_findings[]`: 「プラグインの不具合」
   - 引き継ぎファイルの `decisions[]` (担当が自分で決めたこと): `D<n>` ごとに `<D> add (--run <run> | --root .) --handoff <handoff> --decision D<n> --by recommended` (同じ `D<n>` が一覧まで残る)
3. 記録の置き場: 機能の中は `<run>/handoff/`・`<run>/decisions.jsonl` (feature の commit に入る)。上流の段は `.distillery/handoff/`・`.distillery/decisions.jsonl` (その段の commit に `git add` で入れる)

## 前のステップの課題

1. 起票は引き継ぎファイルからだけ (担当は課題のファイルを直接書かない): `<H> file-drafts <handoff> --run <run>` (機能の中。`<run>/issues/` の下書き)、検証役は `<H> file-drafts <findings> --findings --run <run>`、上流の段は `<H> file-drafts <handoff> --root .` (`docs/feedback/` に直接。機能の中を戻し先にする課題には担当が `uc` を書く。無ければ exit 1 で、担当に差し戻す)。
   戻し先と題名が同じ既存の下書き・その場で直した下書き・課題ファイルがあれば書かない (結果の `duplicates`)。
   上流の差分のレビュー・反証から課題を作るときは `--chain-from <直している課題ファイル>` を付ける (連鎖の深さ `chain_depth` を数える。3 を超えた連鎖は自動選択が `limit-chain` で人に返す)
2. 戻し先で振り分ける:

| 戻し先 | 機能の作業中 | main マージ済みの機能について |
|---|---|---|
| scenario / contract / implementation | **その場で巻き戻す**: `<RS> rewind <run> <戻し先> --issue <下書き> [--issue <下書き> ...] --reason "<題名>"` (同じ戻し先の下書きはまとめて渡す)。implementation は attempt を上げて tier から。次の段からやり直す。戻し先がまだ done でない段なら巻き戻さずに `deferred: true` を返す (回数に数えない): その段の派遣文に下書き (`consumed_all`) の絶対パスを添える | 課題ファイルのまま残す。次の起動の自動選択が `reopen_targets` で開き直す |
| requirements / decide / foundation | **機能を止める**: 下書きを「上流で止めるとき」の手順で課題ファイルにして main に入れ、`blocked_on_upstream {issues}` を記録して feature に commit する (feature は消さない。上流の差分の後に写し直す) | 課題ファイルのまま。自動選択が上流の差分を選ぶ |

- 契約ゲート・結合・検証・人レビューの「実装を直す」も、同じ `rewind <run> implementation` で戻す (回数を数えるため)。as-built からの差し戻しは `return-to-integrate` (同じく数える)
- 巻き戻しも開き直しも写し直しも 3 回まで。超えたら `runState.js` / `resumeAfterUpstream.js` が exit 3 を返すので、人に返す (`page:limit:<slug>`)。人が続けると答えたら `--override-limit` を付けて回し直す

### 上流で止めるとき (要求・決定・基盤への課題)

今の feature を main に入れずに、課題だけを main に入れる。`<root>` = リポのルートの絶対パス、`<wt>` = `<root>/.distillery/worktrees/<slug>/<issue>`、`<issue>` = 課題ファイルにしていない下書きの 1 件目の名前:

0. 止める前に、反証して直すを派遣していないレビューの結果 (`<run>/reviews/<場所>[-<tier>]/<n>/round<k>.md` で、引き継ぎファイルの `refutations` が無いもの) を `<H> file-drafts <round<k>.md> --review --target <場所の段> --run <run>` で下書きにする (場所 → 段: scenario → scenario、contract → contract、implementation-<tier>・asbuilt → implementation)。指摘が止めた機能と一緒に消えないように

1. `git worktree add .distillery/worktrees/<slug>/<issue> -b feedback-req/<slug>/<issue> main`
2. `node <skills>/d2-common/scripts/feedbackBatch.js file-issues <root>/.distillery/runs/<slug> --cwd <wt>` (**run は feature の作業ツリー上の絶対パス**。下書きはすべて課題ファイルになり、`feedback_filed` は feature の run に記録される)
3. `node <skills>/d2-common/scripts/genDocsReadme.js --cwd <wt>`
4. `git -C <wt> add -A -- docs` → `git -C <wt> commit -m "impl(<slug>): issues to feedback" -m "<attribution 行>"`
5. feature のまま `git fetch . feedback-req/<slug>/<issue>:main` で main を ff する
6. `git worktree remove <wt>` → `git merge-base --is-ancestor feedback-req/<slug>/<issue> main` が exit 0 なら `git branch -D feedback-req/<slug>/<issue>`
7. remote `origin` があれば `git push origin main` (拒否されたら止まって報告する。force push はしない)
8. `<RS> event <run> blocked_on_upstream --data-file <json>` (`{"issues": [{"id": "<課題ファイルの名前 (.md を除く)>", "target": "<戻し先>", "resume_from": "<課題の resume_from。無ければ書かない>"}]}`。2 で課題ファイルにした上流の課題ごとに 1 件)
9. feature の**変更をすべて** commit する: `git add -A -- apps packages contracts features docs .distillery/runs/<slug>` (無いパスは名指ししない) → `impl(<slug>): <段> (blocked)`。commit の後に起動シーケンス 5 の clean 判定の対象が空であることを確かめる (実装の途中のコードも残す。写し直しで新しい main の上へ運ぶ)
10. 自動選択をもう一度呼んで続ける (上流の差分が選ばれ、直した後に写し直して同じ機能へ戻る)

上流で止めると、同じ run の機能の中の課題 (戻し先が scenario / contract / implementation の下書き) も課題ファイルになる (失わないため)。これは `FB scan` の `carried` に出る: その UC を写し直した後 (と、課題だけが残った UC を新しく始めるとき)、`carried_issues {issues}` を記録し、`items` の課題ごとの戻し先 (`target_step`) の段の派遣文に課題ファイルの絶対パスを添える (戻し先が違う課題を 1 つの段にまとめて渡さない)。その UC の main マージで消す (下の「課題の消し方」)。

### プラグインの不具合 (どの段でも)

直す場所がリポの中ではなく distillery2 の側だと分かったとき (反証の結果・担当の課題の戻し先が `plugin`、決定の差分の `reason_kind: plugin`):

1. 課題ファイルが既にあれば、理由をファイルに書いて `FB reclassify <issue> --reason-file <ファイル> --co-author "<attribution の値>"` (`kind: plugin` に書き換えて今の branch に commit)。下書きなら `file-drafts` が `kind: plugin` で書く
2. 機能の中なら、その機能を「上流で止めるとき」の手順で止める (`blocked_on_upstream` の課題は `{"id": "<課題>", "target": "plugin"}`)。課題ファイルが main に残る間は写し直さない。ほかの機能は自動選択が続ける
3. 人に返す (`page:plugin:<課題>`。推奨: プラグインを直してから課題ファイルを `git rm` する)。`kind: plugin` の課題は自動選択のきっかけにしない

### 課題の消し方

- 機能の中の巻き戻し: 下書きは `issues/consumed/` へ移る (課題ファイルにならない)
- 開き直し: きっかけの課題は `reopened.json` の `issues` に残る。その機能の main マージ 1 の 3 で `git rm` し、squash の 1 commit に入れる (trailer `Feedback-Consumed:`)
- 持ち越した課題 (`carried_issues`): その機能の main マージ 1 の 3 で同じく `git rm` する
- 上流の差分: 反映した課題と取り下げた課題を `git rm` して、その差分の commit に入れる (`Feedback-Consumed:` / `Feedback-Dismissed:`)

## 上流の差分

自動選択が `FB scan` の `upstream` で選ぶ (要求 → 決定 → 基盤の順に 1 つ)。要求は SKILL.md の「要求の差分」。決定と基盤は下。どれも次の「上流の差分の branch」で行う。

### 上流の差分の branch (要求・決定・基盤で共通)

main を途中の状態にしない。差分は一時の branch で行い、確定してから main を進める。

1. **始め**: clean な main で、remote `origin` があれば `git fetch origin` して `git merge --ff-only origin/main` (分岐していたら止まって報告する)。`git switch -c upstream/<1 件目の課題の名前> main` (課題が 0 件で既存の持ち越しだけなら `upstream/carry-over`)
2. **段ごとの commit**: この branch に入れる (段ごとの commit は squash しない。basis が commit の ID を使う)。
   commit のたびに `git status --porcelain --untracked-files=all` を見る。起動シーケンス 5 の clean 判定の対象が残っていれば、その差分の write-set の中なら追加の commit に入れ (`--amend` はしない)、外なら止まって報告する
3. **確定**: `git switch main` → `git merge --ff-only upstream/<名前>` → `git branch -d upstream/<名前>` → remote `origin` があれば `git push origin main`。ff できなければ (人が main に commit した) 止まって報告する
4. **途中で止まったとき** (人に返した・落ちた・起動が切れた): 自動選択が `continue-upstream` を返す。その branch に切り替え、同じ差分を最初の手順から回し直す (どの派遣も再実行して安全で、済んだ commit は残る。確認ページの答えが `.distillery/decisions.jsonl` にあれば、その答えで進める)
5. 確定の後は自動選択をもう一度呼ぶ (写し直し待ちの機能が先に選ばれる)

### 決定の差分 (`upstream.decide`)

1. 前提: 進行中の UC が無い。「上流の差分の branch」の 1 で branch を切る
2. 課題ごとに sub `d2-decide mode=feedback issue=<docs/feedback/<issue>.md> result=<.distillery/logs/decide-<issue>.result.json>` (派遣表「② 決定の差分 (ADR)」。ADR を 1 本足す。結果ファイルは派遣の前に消す)。受理: 結果が `applied`、`validateAdr.js docs/adr` が exit 0、write-set の外が変わっていない。
   結果が `blocked` なら: `reason_kind: plugin` は「プラグインの不具合」(理由をファイルに書いて `FB reclassify <issue> --reason-file <ファイル> --co-author "<attribution の値>"` でプラグインへ持ち帰る課題にする)。`reason_kind: scope` は人に返す (推奨: 戻し先を基盤にする)
3. 索引・開発ルール・アーキテストを作り直す (1 コマンドずつ): `node <skills>/d2-decide/scripts/genAdrIndex.js docs/adr docs/adr/index.md requirements=docs/requirements`、`node <skills>/d2-foundation/scripts/genRules.js --adr docs/adr --out docs/rules --cwd .`、`node <skills>/d2-foundation/scripts/genArchTests.js --adr docs/adr --out .dependency-cruiser.cjs --cwd .`。続けて `runGates.js --uc d2-feedback --only static` が通り、`contracts/` があれば `node <skills>/d2-contract/scripts/validateUcIndex.js contracts` が exit 0 (落ちたら人に返す)
4. 決定のレビュー (下の「縦・横レビュー」の `decide`。指摘のうち戻し先が decide のものは、次の決定の差分にせず、この差分の「反証して直す」で扱う) → 確認ページ (`page:decide:approve`。足した ADR と、`basis.js check` の STALE の UC を「やり直す / 後で」で載せる)
5. 2 回に分けて commit する (生成物の basis が、入力の ADR を入れた commit を指すように):
   1. `git add -A -- docs/adr` → `decide: feedback (adr)` (足した ADR と索引)
   2. 開発ルールとアーキテストを 3 と同じコマンドで作り直す (basis が 1 の commit になる) → 反映した課題を `git rm` → genDocsReadme → `git add -A -- docs .distillery .dependency-cruiser.cjs` → `decide: feedback` で commit (trailer `Feedback-Consumed:`)。「やり直す」UC は `<RS> reopen <root> <slug> --from scenario` (同じ commit に入れる)
   3. 「上流の差分の branch」の 3 で main へ確定する
6. 上流で止めた機能の feature は消さない。自動選択をもう一度呼ぶと、止めた課題がすべて main から消えた機能を `resume` で選ぶ (下の「写し直し」)

### 基盤の差分 (`upstream.foundation`)

1. 前提は決定の差分と同じ
2. 課題の推奨の直し方に合う派遣を選ぶ: 骨組み・設定・テスト基盤は sub `d2-foundation phase=<該当 phase>`、契約の骨格は sub `d2-contract mode=skeleton`、画面部品は sub `d2-design`。どの派遣も再実行して安全。
   契約の骨格か画面部品を直したら、仕上げの前に ③ の 4 と同じく `git add contracts docs/design` → `foundation: feedback (contracts and design)` で commit する (仕上げが basis に記録する入力の commit)。続けて sub `d2-foundation phase=finish ui=<true|false>`
3. 受理は ③ の 5 と同じで、`validateUcIndex.js contracts` が exit 0 も足す。基盤のレビュー → 確認ページ (`page:foundation:approve`。STALE の UC を「やり直す / 後で」で載せる)
4. 反映した課題を `git rm` → genDocsReadme → `git add -A` (起動シーケンス 5 の clean 判定の対象外のルート直下の未追跡ファイルは入れない) → `foundation: feedback` で commit → 「上流の差分の branch」の 3 で main へ確定し、自動選択をもう一度呼ぶ (決定の差分の 6 と同じ)

## 機能の最初の点検 (新しい UC の branch を切る前)

機能の途中で上流の不足が 1 件ずつ見つかって往復するのを減らす。自動選択が `uc` を返したとき、clean な main の上で行う。

1. `.distillery/logs/precheck-<slug>/` を消してから、UC の `tiers_hint` のティアごとに sub `d2-implement mode=precheck` を**同じメッセージで並列派遣**する (派遣表「④ precheck」。`{handoff}` は `.distillery/logs/precheck-<slug>/<tier>.handoff.json`)
2. 受理: 各引き継ぎファイルが `<H> validate` で exit 0、`git status --porcelain` が派遣の前と同じ (追跡ファイルを書いていない)。問いは「引き継ぎファイルの処理」と同じに振り分け、`.distillery/decisions.jsonl` に記録する
3. 上流の課題が 0 件なら `.distillery/logs/precheck-<slug>/` を消して、④ の branch を切る
4. 上流の課題があれば: 「上流の差分の branch」の 1 で `upstream/<1 件目の課題の id>` を切り、引き継ぎファイルを `.distillery/handoff/precheck-<slug>-<tier>.json` に写して `<H> file-drafts <写し> --root .` で課題ファイルにする (`uc` は無くてよい: 戻し先は上流だけ) →
   `git add -A -- docs/feedback .distillery/handoff .distillery/decisions.jsonl` → `precheck(<slug>): issues` で commit → `.distillery/logs/precheck-<slug>/` を消す → 自動選択をもう一度呼ぶ (その branch の上流の差分が `continue-upstream` で続き、直した後に同じ UC が選ばれて点検からやり直す)。
   機能の作業はまだ無いので写し直しは要らない

## 写し直し (上流で止めた機能を、上流を直した後の main の上で続ける)

自動選択が `resume` (止めた課題がすべて main から消えた) か `finish-resume` (途中で止まった写し直し) を返したとき。機能の作業は捨てない。

1. clean な main の上で `node <skills>/d2-common/scripts/resumeAfterUpstream.js run <root> <slug> --co-author "<attribution の値>"` (JSON 1 行。途中で止まっても同じコマンドで続きから終わる)。
   止めたときの feature の変更を新しい main の上へ 3 方向で統合して 1 commit にし、feature をその commit に付け替えて切り替え、続きの段 (`from_stage`) 以降の done とレビューの置き場を退避し、`resumed_after_upstream` を記録して commit する。
   統合できなかったファイル (`conflicts`) は main の側を採り、機能側の差分を `diffs` (`<run>/resume/<n>/*.diff`) に残す。作り直せる生成物 (契約の bundle・slice・契約テスト・開発ルール・アーキテスト・README) は作り直す (`regenerated`)
2. exit 3 (写し直しが 3 回) は人に返す (`page:limit:<slug>`)。exit 1 は `error` を添えて止まって報告する (処理の記録 `.distillery/logs/resume-<slug>.json` は残す。人が直したら同じコマンドで続く)
3. `runState.js status <run>` の `next_stage` (= `from_stage`) から ④ を続ける。`<base_head>` は写し直した先の main になる (`status` の `base_head`)
4. `diffs` があれば、差分のファイルを書く段の派遣文に差分ファイルの絶対パスを添える (`features/**/*.feature` は scenario、`contracts/**` と `use-cases.yaml` は contract、ほかは tier の担当。ティアはパスの `apps/<tier>/`)。
   担当は引き継ぎファイルの `resume_diffs` に差分ごとの扱い (`applied` は反映したファイルを `where` に、`dropped` は理由) を書く。受理の検査に `node <skills>/d2-common/scripts/resumeAfterUpstream.js check-diffs <run> --handoff <引き継ぎファイル>` が exit 0 を足す (足りない行があれば差し戻す)。
   `dropped` の差分は、人レビューの確認ページと最後のまとめに「写し直しで取り下げた変更」として載せる

## 縦・横レビュー

場所・観点・回し方は [`<skills>/d2-common/references/review-points.md`](../../d2-common/references/review-points.md)。進行役が行う (サブエージェントに待ちを任せない)。

1. 担当の受理と引き継ぎファイルの処理の後に `node <skills>/d2-common/scripts/reviewStep.js run --point <場所> --target <対象> ... --out <置き場>` (Bash の timeout 600000 ms)
2. `status: reviewed` で `findings` が 1 以上 → その場所の担当を **反証して直す** で派遣し直す (派遣表の「反証して直す」の行。write-set はその場所と同じ。派遣文に `round1.md` の絶対パスを添える)。引き継ぎファイルの `refutations` が全件あることを受理で確かめる
3. 2 ラウンド目: `has_fail` か、`high_or_critical` の指摘が `refutations` で `accepted` なら、`--round 2 --previous <round1.md>` で 1 回だけ回す。指摘が残れば 2 と同じく直させ、もう回さない。
   1 ラウンド目で決め済み (`decide` で記録した・人が答えた) と振り替え済み (課題にした・`plugin`) の指摘は、2 ラウンド目の反証に回さない (派遣文にそれ以外の指摘だけを書く)。回さなかったら `<D> add ... --page page:review-round2:<場所> --question "2 ラウンド目を回すか" --answer "回さない" --by rule` で残す
4. exit 4 (未レビュー) → 人に返すとき の表。recommend なら `reviewStep.js prompt` の依頼文を新しいサブエージェント (Agent ツール、同じモデル) に渡して `round1.md` を書かせ、`<D> add ... --page page:review-unavailable:<場所> --answer "同じモデルで代わりにレビューする" --by rule`
5. 結果の置き場 (`reviews/`) は追跡する。上流は `.distillery/reviews/<場所>/`、機能の中は `<run>/reviews/<場所>[-<tier>]/`

## 途中で止まった還流 (0.1.x の repo)

`FB status` の `point` が `none` 以外 (0.2.0 で還流は廃止):
- `cleanup` (取り込み済み): `FB merge` で push と片付けを終える
- それ以外: 確認ページ `page:migration:abandon` (推奨: 捨てる。課題ファイルは main に残り、戻し先で扱い直す) → `FB abandon` (課題ファイルが main に無ければ拒む)
