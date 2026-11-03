# 振り分け: モード・人に返すとき・前のステップの課題・縦横レビュー

SKILL.md の各段から呼ぶ規則。`<H>` = `node <skills>/d2-common/scripts/handoff.js`、`<D>` = `node <skills>/d2-common/scripts/decisionLog.js`、`<RS>` = `node <skills>/d2-common/scripts/lib/runState.js`。

## モード

起動の引数 `mode=auto` (既定) / `mode=recommend`。config には置かない (③ で作り直されるため)。④ では run を開いた後に `mode_resolved {mode}` を記録する。

## 人に返すとき

| 場面 | auto | recommend |
|---|---|---|
| 選び方の問い (`choice`) で推奨がある | 推奨で決めて記録 | 推奨で決めて記録 |
| 事実が分からない問い (`unknown_fact`) | 人に返す | 推奨で仮置きして記録 (最後のまとめで「仮置き」) |
| 推奨が無い問い (`recommended: null`) | 人に返す | 人に返す |
| 要求の承認 (①・要求の差分)・人レビュー | **必ず人に返す** | 推奨で承認して記録 |
| 決定・基盤の設定・シナリオ・やり直す UC の確認 | 推奨で承認して記録 (人に返す問いが 1 つでもあれば、その問いと一緒に確認ページを出す) | 同じ |
| レビューの反証で `needs_info` が残った | 人に返す | 人に返す |
| 上流への課題 (`target_step` が requirements / decide / foundation) | 人に返す (機能を止めて、上流を直すか取り下げるか聞く) | 推奨の直し方で上流の差分へ進み、記録する |
| 戻り道の回数の上限 (`runState.js` が exit 3) | 人に返す | 人に返す |
| レビューを回せない (`reviewStep.js` が exit 4) | 人に返す (同じモデルで代わりにレビューする / このまま進む / 止める) | 同じモデルで代わりにレビューし、`fallback: same-model` を記録する |
| ゲートが 2 回落ちた・受理の検査に落ちた (再派遣で直らない) | 人に返す | 人に返す |
| 終わったとき | 完了報告 | 完了報告と、推奨で決めたものの一覧の確認ページ 1 枚 (`<D> list --root . --since <起動の時刻> --format md`) |

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

1. `<H> validate <handoff>` が exit 0 (無い・不合格なら受理しない。再派遣)。検証役は `<H> route <findings> --findings --mode <mode>`
2. `<H> route <handoff> --mode <mode>`:
   - `decide[]`: 問いごとに `<D> add --handoff <handoff> --ask <id> --answer "<answer>" --by recommended [--provisional]`
   - `to_human[]`: 人に返す問いとして、この段の確認ページに載せる (確認ページの無い段なら、この問いだけの確認ページを出して止まる)
   - `issues`: 下の「前のステップの課題」
   - `needs_info[]`: 人に返す
3. 記録の置き場: 機能の中は `<run>/handoff/`・`<run>/decisions.jsonl` (feature の commit に入る)。上流の段は `.distillery/handoff/`・`.distillery/decisions.jsonl` (その段の commit に `git add` で入れる)

## 前のステップの課題

1. 起票: `<H> file-drafts <handoff> --run <run>` (機能の中。`<run>/issues/` の下書き)、検証役は `<H> file-drafts <findings> --findings --run <run>`、上流の段は `<H> file-drafts <handoff> --root .` (`docs/feedback/` に直接。機能の中を戻し先にする課題には担当が `uc` を書く。無ければ exit 1 で、担当に差し戻す)
2. 戻し先で振り分ける:

| 戻し先 | 機能の作業中 | main マージ済みの機能について |
|---|---|---|
| scenario / contract / implementation | **その場で巻き戻す**: `<RS> rewind <run> <戻し先> --issue <下書き> --reason "<題名>"`。implementation は attempt を上げて tier から。次の段からやり直す | 課題ファイルのまま残す。次の起動の自動選択が `reopen_targets` で開き直す |
| requirements / decide / foundation | **機能を止める**: 下書きを「上流で止めるとき」の手順で課題ファイルにして main に入れ、`blocked_on_upstream {target, issues}` を記録して feature に commit して停止 | 課題ファイルのまま。次の起動の自動選択が上流の差分を選ぶ |

- 契約ゲート・結合・検証・人レビューの「実装を直す」も、同じ `rewind <run> implementation` で戻す (回数を数えるため)。as-built からの差し戻しは `return-to-integrate` (同じく数える)
- 巻き戻しも開き直しも 3 回まで。超えたら `runState.js` が exit 3 を返すので、人に返す (`page:limit:<slug>`)。人が続けると答えたら `--override-limit` を付けて回し直す

### 上流で止めるとき (要求・決定・基盤への課題)

今の feature を main に入れずに、課題だけを main に入れる。`<root>` = リポのルートの絶対パス、`<wt>` = `<root>/.distillery/worktrees/<slug>/<issue>`、`<issue>` = 課題ファイルにしていない下書きの 1 件目の名前:

1. `git worktree add .distillery/worktrees/<slug>/<issue> -b feedback-req/<slug>/<issue> main`
2. `node <skills>/d2-common/scripts/feedbackBatch.js file-issues <root>/.distillery/runs/<slug> --cwd <wt>` (**run は feature の作業ツリー上の絶対パス**。下書きはすべて課題ファイルになり、`feedback_filed` は feature の run に記録される)
3. `node <skills>/d2-common/scripts/genDocsReadme.js --cwd <wt>`
4. `git -C <wt> add -A -- docs` → `git -C <wt> commit -m "impl(<slug>): issues to feedback" -m "<attribution 行>"`
5. feature のまま `git fetch . feedback-req/<slug>/<issue>:main` で main を ff する
6. `git worktree remove <wt>` → `git merge-base --is-ancestor feedback-req/<slug>/<issue> main` が exit 0 なら `git branch -D feedback-req/<slug>/<issue>`
7. remote `origin` があれば `git push origin main` (拒否されたら止まって報告する。force push はしない)
8. `<RS> event <run> blocked_on_upstream '{"target":"<戻し先>","issues":["docs/feedback/<id>.md"]}'` → feature で `git add -A -- .distillery/runs/<slug>` → `impl(<slug>): <段> (blocked)` で commit して停止

上流で止めると、同じ run の機能の中の課題 (戻し先が scenario / contract / implementation の下書き) も課題ファイルになる (失わないため)。これは `FB scan` の `carried` に出る: その UC を次に始めるとき (上流の差分の後の新しい run)、`carried_issues {issues}` を記録し、戻し先の段の派遣文に課題ファイルの絶対パスを添える。その UC の main マージで消す (下の「課題の消し方」)。

### 課題の消し方

- 機能の中の巻き戻し: 下書きは `issues/consumed/` へ移る (課題ファイルにならない)
- 開き直し: きっかけの課題は `reopened.json` の `issues` に残る。その機能の main マージ 1 の 3 で `git rm` し、squash の 1 commit に入れる (trailer `Feedback-Consumed:`)
- 持ち越した課題 (`carried_issues`): その機能の main マージ 1 の 3 で同じく `git rm` する
- 上流の差分: 反映した課題と取り下げた課題を `git rm` して、その差分の commit に入れる (`Feedback-Consumed:` / `Feedback-Dismissed:`)

## 上流の差分

自動選択が `FB scan` の `upstream` で選ぶ (要求 → 決定 → 基盤の順に 1 つ)。要求は SKILL.md の「要求の差分」。決定と基盤:

### 決定の差分 (`upstream.decide`)

1. 前提: 進行中の UC が無い、clean な main
2. 課題ごとに sub `d2-decide mode=feedback issue=<docs/feedback/<issue>.md> result=<.distillery/logs/decide-<issue>.result.json>` (派遣表「② 決定の差分 (ADR)」。ADR を 1 本足す。結果ファイルは派遣の前に消す)。受理: 結果が `applied`、`validateAdr.js docs/adr` が exit 0、write-set の外が変わっていない。
   結果が `blocked` なら: `reason_kind: plugin` は理由をファイルに書いて `FB reclassify <issue> --reason-file <ファイル> --co-author "<attribution の値>"` (プラグインへ持ち帰る課題にする)。`reason_kind: scope` は人に返す (推奨: 戻し先を基盤にする)
3. 索引・開発ルール・アーキテストを作り直す (1 コマンドずつ): `node <skills>/d2-decide/scripts/genAdrIndex.js docs/adr docs/adr/index.md requirements=docs/requirements`、`node <skills>/d2-foundation/scripts/genRules.js --adr docs/adr --out docs/rules --cwd .`、`node <skills>/d2-foundation/scripts/genArchTests.js --adr docs/adr --out .dependency-cruiser.cjs --cwd .`。続けて `runGates.js --uc d2-feedback --only static` が通る (落ちたら人に返す)
4. 決定のレビュー (下の「縦・横レビュー」の `decide`) → 確認ページ (`page:decide:approve`。足した ADR と、`basis.js check` の STALE の UC を「やり直す / 後で」で載せる)
5. 反映した課題を `git rm` → genDocsReadme → `git add -A -- docs .distillery` → `decide: feedback` で commit (trailer `Feedback-Consumed:`)。「やり直す」UC は `<RS> reopen <root> <slug> --from scenario` (同じ commit に入れる)
6. `blocked_on_upstream` で止めた feature を退避する (`git update-ref refs/distillery2/abandoned/<slug>/<ts> feature/<slug>` → `git branch -D feature/<slug>`)。その UC は main から新しい run で始まる

### 基盤の差分 (`upstream.foundation`)

1. 前提は決定の差分と同じ
2. 課題の推奨の直し方に合う派遣を選ぶ: 骨組み・設定・テスト基盤は sub `d2-foundation phase=<該当 phase>`、契約の骨格は sub `d2-contract mode=skeleton`、画面部品は sub `d2-design`。どの派遣も再実行して安全。続けて sub `d2-foundation phase=finish ui=<true|false>`
3. 受理は ③ の 5 と同じ。基盤のレビュー → 確認ページ (`page:foundation:approve`。STALE の UC を「やり直す / 後で」で載せる)
4. 消費・commit (`foundation: feedback`)・退避は決定の差分の 5〜6 と同じ

## 縦・横レビュー

場所・観点・回し方は [`<skills>/d2-common/references/review-points.md`](../../d2-common/references/review-points.md)。進行役が行う (サブエージェントに待ちを任せない)。

1. 担当の受理と引き継ぎファイルの処理の後に `node <skills>/d2-common/scripts/reviewStep.js run --point <場所> --target <対象> ... --out <置き場>` (Bash の timeout 600000 ms)
2. `status: reviewed` で `findings` が 1 以上 → その場所の担当を **反証して直す** で派遣し直す (派遣表の「反証して直す」の行。write-set はその場所と同じ。派遣文に `round1.md` の絶対パスを添える)。引き継ぎファイルの `refutations` が全件あることを受理で確かめる
3. 2 ラウンド目: `has_fail` か、`high_or_critical` の指摘が `refutations` で `accepted` なら、`--round 2 --previous <round1.md>` で 1 回だけ回す。指摘が残れば 2 と同じく直させ、もう回さない。回さなかったら `<D> add ... --page page:review-round2:<場所> --question "2 ラウンド目を回すか" --answer "回さない" --by rule` で残す
4. exit 4 (未レビュー) → 人に返すとき の表。recommend なら `reviewStep.js prompt` の依頼文を新しいサブエージェント (Agent ツール、同じモデル) に渡して `round1.md` を書かせ、`<D> add ... --page page:review-unavailable:<場所> --answer "同じモデルで代わりにレビューする" --by rule`
5. 結果の置き場 (`reviews/`) は追跡する。上流は `.distillery/reviews/<場所>/`、機能の中は `<run>/reviews/<場所>[-<tier>]/`

## 途中で止まった還流 (0.1.x の repo)

`FB status` の `point` が `none` 以外 (0.2.0 で還流は廃止):
- `cleanup` (取り込み済み): `FB merge` で push と片付けを終える
- それ以外: 確認ページ `page:migration:abandon` (推奨: 捨てる。課題ファイルは main に残り、戻し先で扱い直す) → `FB abandon` (課題ファイルが main に無ければ拒む)
