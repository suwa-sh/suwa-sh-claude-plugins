# Git の手順 (UC ごとの branch / squash / main への取り込み / 上流の差分 / 開き直し)

v1 (dist-impl-run「UCのsquash・push・PR作成」) を次の点で簡素化した:
lease と review HTML の追跡除外を廃止 (`.distillery/runs/*/reports|traces` は .gitignore)、trailer で系譜を残す。
0.1.26 から **PR / issue を作らない** (git とファイルだけで完結する。GitHub 以外のホストや remote の無いリポでも同じ手順):
UC は squash して main へ ff merge し、課題は `docs/feedback/` のファイルにする。課題は戻し先 (`target_step`) で振り分け、上流の差分 (要求・決定・基盤) か開き直した UC の main マージが反映して消す (0.2.0。0.1.27〜0.1.36 の還流は廃止)。
**git 操作はオーケストレータ (d2-run) だけが行う** (単一コミッタ)。サブエージェントには git 禁止を必ず伝える。

## commit の attribution (0.1.30)

用語を 2 つ分ける:

- **attribution 行** = ハーネスが指定する trailer 1 行 (例 `Co-Authored-By: <モデル名> <noreply@anthropic.com>`)
- **attribution の値** = その行のキー `Co-Authored-By: ` を除いた部分 (例 `<モデル名> <noreply@anthropic.com>`)。`prTrailers.js --co-author` はこちらを受け取り、スクリプトがキーを付ける (行を渡すとキーが二重になる)

d2-run が作る**すべての commit** (簿記の commit `impl(<slug>): <stage>`・`legacy delivered`・`issues to feedback`・`delivered`・`reorder stages`、`req: initial requirements`・`decide: ...`・`foundation: ...`・`req(<slug>): scenarios` を含む) に attribution 行を trailer で付ける (0.1.28 実走 L14):

| commit の作り方 | 付け方 |
|---|---|
| `git commit -m "<件名>"` | `git commit -m "<件名>" -m "<attribution 行>"` (2 つ目の `-m` が最後の段落になり、git が trailer として扱う) |
| 本文ファイル (`git commit -F`。`req: feedback`) | trailer の末尾に attribution 行を書く |
| squash (`prTrailers.js`) | `--co-author "<attribution の値>"` (今のまま) |

## UC branch の開始と再開

1. 開始条件: `git status --porcelain=v1 --untracked-files=all` が空、detached HEAD でない、`feature/*` 上でない、
   upstream と HEAD が一致。満たさなければ勝手に stash / commit せず、整理を依頼して停止する。
   upstream が設定されていなければ (リモート無し・base を未 push。`git rev-parse --abbrev-ref @{upstream}` が失敗する)
   upstream 一致の条件は飛ばし、報告に「upstream なし」と書く (0.1.16 実走)。clean 判定の対象は d2-run SKILL.md の起動シーケンス 5 に従う
2. `use-cases.yaml` の `slug` で `git switch -c feature/<slug>`。作成直後に `runState.js open` で run を開き、その直後に `events.jsonl` へ
   `branch_started {base_branch, base_head, feature_branch}` を追記する (`models_resolved` はその後。d2-run SKILL.md ④ 冒頭。0.1.34 Q11)
3. 再開時 (main マージの done が無い) は `branch_started` の `feature_branch` と現在 branch が一致することを確認する。違う branch なら
   clean のときだけ switch。`base_head` が HEAD の祖先でなければ停止する。
   main マージ 1 の 2 で止まった後に人が feature に足した commit (UC と無関係な static の落ちの修正。d2-run SKILL.md main マージ 1) も件名は `impl(<slug>): ` なので件名の検査を通り、squash で UC の 1 commit に入る (0.1.32 実走 P1)
4. main マージの done がある UC は終わっている (feature は main マージの最後に消す。残っていれば起動時の自動選択 2 が片付ける)。remote `origin` があり `origin/main..main` に commit があれば、
   何より先に `git push origin main` をやり直す (d2-run SKILL.md の自動選択の 3。main マージ・上流の差分のどれの後でも同じ)

## 段階ごとの commit

段階の done を書いたら、その段階の write-set を `impl(<slug>): <stage>` で commit する
(例 `impl(register-loan): scaffold`)。`.distillery/runs/<slug>/` の events / done / attempt は含める。
reports / traces は .gitignore 済みで含めない。シナリオ承認は `req(<slug>): scenarios` で commit する。
main マージの done は main の上で commit する (`impl(<slug>): delivered`)。UC の課題は main マージの squash の前に feature の上で課題ファイルにして commit する (`impl(<slug>): issues to feedback`)。
上流の差分の commit (`req: feedback`・`decide: feedback`・`foundation: feedback`) と開き直しの commit (`impl(<slug>): reopen`) は main の上で作る (下の「開き直しと上流で止めるとき」)。

## squash と main への取り込みの条件

次をすべて満たすときだけ実行する。1 つでも欠ければ禁止。

- 最新のレビュー証跡に対する人の承認 (`review_approved`) が有効で、要回答の前提がすべて回答済み
- `reports/gates.json` の `result: pass`、findings の open blocker が 0
- 現在 branch が `feature_branch`、working tree と index が clean、`base_head` が HEAD の祖先
- remote `origin` があれば、`git fetch origin` の後に `origin/main` が `main` の祖先か同じ

- UC の課題がすべて課題ファイルになっている (`runState.js status` の `unfiled_issues` が空。`feedbackBatch.js file-issues <run>` が作る)

課題の反映は条件に入れない (課題は戻し先で振り分ける。保留 `feedback_deferred` は新しくは書かない)。

## 手順 (squash)

1. `git status --porcelain=v1 --untracked-files=all` が空、`git diff --quiet`、`git diff --cached --quiet`、
   `git merge-base --is-ancestor <base_head> HEAD`、`git log <base_head>..HEAD` に merge commit が無いことを確認。
   件名の検査 (`git log <base_head>..HEAD --format=%s` の件名がすべて `impl(<slug>): ` か `req(<slug>): ` で始まる。段階ごとの commit の規則。d2-run 以外が足した commit はこの形にならない) は
   **main マージ 1 の冒頭で検査済み** (SKILL.md main マージ 1。gates.json の作り直しや課題ファイルの commit より前に見る。0.1.32 N1)。
   そうでなければ (UC 外の commit が混ざっている) squash せず止まって報告する (混ざった commit の一覧を添える。整理は人が決める。0.1.29 実走 M3)。
   変更の中身が UC の範囲に収まることは各段階の受理 (write-set の逸脱検査) が commit の前に止めているので、ここでは件名だけを見る。
   止まった後の再開 (0.1.32 N3): 人が混入した commit を落とす (rebase)。残りは段階の commit なので、再開は main マージ 1 から (gates.json は常に作り直す)。`base_head` が HEAD の祖先であることは再開の判定 (上の「UC branch の開始と再開」3) で確かめる
2. 復旧用 ref `refs/distillery2/pre-squash/<slug>/<timestamp>` を `git update-ref` で現在 HEAD に作る。作れなければ squash しない。`<timestamp>` は `date -u +%Y%m%dT%H%M%SZ` (UTC。固定値を書かない。0.1.32 O3。要求の差分の `abandoned/`・旧形式の `legacy/` の `<ts>` も同じ)
3. `git reset --soft <base_head>`。`use-cases.yaml` の該当行を `status: done` にして stage する (0.1.30〜0.1.31 の `carry_over` の持ち越しは 0.1.32 でやめた。`review_approved` に残る `carry_over.carry` は読まず、main マージ後の起動の自動選択 3 が要求の差分に載せる)
4. `<skills>/d2-common/scripts/prTrailers.js --run .distillery/runs/<slug> --strict --base <base_head> --commit-message "feat: <UC 名>" --co-author "<attribution の値>"` で本文を作り
   (`--base` には 3 で使った `<base_head>` をそのまま渡す。省略時の自動選択 (origin/HEAD → main → master) は UC の開始ブランチと違うことがある。必須 trailer が
   欠けていれば exit 1 で止まる)、`git commit -F <本文ファイル>` で
   exactly 1 commit を作る。件名は `feat: <UC 名 (日本語)>`。`git rev-list --count <base_head>..HEAD` が 1 でなければ取り込まない。
   失敗したら `git reset --soft <復旧用 ref>` で戻す。本文ファイルは `<run>/reports/` (gitignore) に置く
5. 引数が `merge=hold` なら、ここで止めて報告する

## 手順 (main への取り込み)

1. `git switch main` → `git merge --ff-only feature/<slug>`。ff できなければ (main が `base_head` から進んでいる) 止まって報告する (rebase は人が判断)
2. main の上で main マージの done (`runState.js done <run> deliver '{"squash":"<フル sha>","base_head":"<base_head>"}'`。sha は短縮しない) と、④ の冒頭で遅らせた場合だけの `models_resolved` (遅らせた = run の events に解決済み ID の `models_resolved` が無い。冒頭で記録済みなら無いことはないので記録しない。0.1.29 実走 M2・0.1.32 O1) と README を
   `impl(<slug>): delivered` で commit する。**main マージ済みの正は `stages/deliver.done.yaml`** (GitHub の PR ではない)
3. remote `origin` があれば `git push origin main`。拒否されたら止まって報告する (保護された main など。force push はしない)
4. `git branch -d feature/<slug>`
5. 次の UC は main から新しい run で始める (自動では続けない)

main マージの done の commit と 4 の間で止まると、feature が残る。次の起動の自動選択 2 が「main の run に main マージの done がある feature」を main マージ済みとみなして片付ける (SKILL.md の自動選択)。

## 旧形式の片付け (0.1.25 までに PR で main マージした run)

手順の正本は SKILL.md の main マージ節「旧形式の run」。git の約束だけを書く。

- 人が「main マージ済み」と答えたら main の上で `runState.js mark-legacy-delivered` → `impl(<slug>): legacy delivered` で commit する
- 残っている `feature/<slug>` は `git update-ref refs/distillery2/legacy/<slug>/<ts> feature/<slug>` で退避してから `git branch -D feature/<slug>`。squash merge で入れた feature は main の祖先でないことがあり `-d` では消せないので、常に退避してから `-D` (0.1.28 の試し運転では祖先だった)。
  退避先を要求の差分の `abandoned/` と分けるのは、捨てた理由が違うため (main マージ済み vs 要求が変わった)

## commit trailer

`<skills>/d2-common/scripts/prTrailers.js` が run state から作る。`git interpret-trailers` 互換の `Key: value` 行。

| trailer | 値 |
|---|---|
| UC | `<業務>/<BUC>/<UC>` |
| UC-Slug | slug |
| Basis-Requirements / Basis-Adr / Basis-Contracts | 各上流ディレクトリの最終 commit sha (basis.js stamp)。**base branch との merge-base から遡る** (UC branch 上の commit は squash で消えるため。`--base` で起点を指定できる) |
| Basis-Base | Basis-* の起点 (base branch との merge-base の sha)。`--strict` では必須 (解決できなければ `--base` を渡す) |
| Basis-Changed | base 以降に UC branch で変えた上流 (`requirements adr contracts` のうち該当)。この squash commit 自身が差分を含む印 (無ければ省略) |
| Co-Authored-By | `--co-author` で渡した attribution の値 (キー無し。複数可) |
| Gates | `static=pass unit=pass contract=pass uc-bdd=pass acceptance=pass` (gates.json から) |
| Assumptions | `confirmed=<n> auto=<n> rejected=<n>` (review_approved の decisions から) |
| As-Built | `docs/as-built/<業務>/<UC>/index.md` |

課題ファイルを消す commit の trailer は次のとおり (取り込んだ記録はこの trailer だけ。UC の run のイベントには書かない):

| trailer | どの commit | 値 |
|---|---|---|
| Feedback-Consumed | 上流の差分の commit (`req: feedback`・`decide: feedback`・`foundation: feedback`)、開き直した UC の squash commit | `docs/feedback/<issue>.md` (反映して消した課題ファイル。1 件 1 行) |
| Feedback-Dismissed | 上流の差分の commit | `docs/feedback/<issue>.md` (確認ページで取り下げて消した課題ファイル) |
| Feedback-Reclassified / Feedback-Kind-Original | プラグインへ持ち帰る書き換えの commit (`FB reclassify`) | `docs/feedback/<issue>.md` (`kind: plugin` に書き換えた課題ファイル) / 元の `kind` |

0.1.27〜0.1.36 の還流の commit には `Feedback-Kind`・`Feedback-From-UC`・`Feedback-Result`・`Feedback-Stopped` もある (読むだけ。0.2.0 は書かない)。

## 要求の差分

手順の正本は SKILL.md の ① の「要求の差分」。ここには git の約束だけを書く。

- main の上で行う (進行中の UC が無いときだけ。上流で止まった UC の feature にいたら、clean なら main に切り替える)。決定の差分・基盤の差分も同じ
- 反映した課題ファイルと取り下げた課題ファイルを `git rm` し、要求の変更と同じ commit (`req: feedback`) にする。trailer は `Feedback-Consumed:` / `Feedback-Dismissed:`。
  本文は `.distillery/logs/` の本文ファイルに書いて `git commit -F` で作る (main マージの squash と同じ書き方)
- main マージ済みなのに課題ファイルにしていない run の課題 (移行) は、起動時の自動選択 (3 の 2) で `feedbackBatch.js file-issues` が課題ファイルにし、`impl(<slug>): issues to feedback` で main に commit する (要求の差分より前)
- 上流で止まった UC の feature は `git update-ref refs/distillery2/abandoned/<slug>/<ts> feature/<slug>` で退避してから `git branch -D feature/<slug>`。消さずに退避するのは、捨てた実装を後から引けるようにするため

## 開き直しと上流で止めるとき

手順の正本は d2-run の [routing.md](routing.md)。ここには git の約束だけを書く。

- 開き直し (`runState.js reopen --from <段>`) は main の上で行い、`impl(<slug>): reopen` で commit する。その UC は main から新しい feature で始まる。きっかけの課題ファイルは、その UC の main マージで `git rm` して squash の 1 commit に入れる (`Feedback-Consumed:`)
- 機能の中の巻き戻し (`runState.js rewind`) は feature の上で行い、`impl(<slug>): rewind <段>` で commit する (main は動かさない)
- 上流で止めるとき、課題ファイルは main に commit する。feature の上にいるので、一時の worktree (`.distillery/worktrees/<slug>/<issue>`、branch `feedback-req/<slug>/<issue>`) で commit し、
  `git fetch . feedback-req/<slug>/<issue>:main` で main を ff する (main を checkout しない)
- 0.1.x の途中で止まった還流のバッチは、取り込み済みなら `FB merge` で後始末、そうでなければ `FB abandon` で branch・worktree・状態を消す (課題ファイルは main に残る)
