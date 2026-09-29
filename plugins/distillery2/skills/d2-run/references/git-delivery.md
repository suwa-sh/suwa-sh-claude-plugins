# Git 配送 (UC ごとの branch / squash / main への取り込み / 還流の worktree)

v1 (dist-impl-run「UCのsquash・push・PR作成」) を次の点で簡素化した:
lease と review HTML の追跡除外を廃止 (`.distillery/runs/*/reports|traces` は .gitignore)、trailer で系譜を残す。
0.1.26 から **PR / issue を作らない** (git とファイルだけで完結する。GitHub 以外のホストや remote の無いリポでも同じ手順):
UC は squash して main へ ff merge し、還流は worktree で作って確認ページの承認の後に main へ ff merge し、課題は `docs/feedback/` のファイルにする。
**git 操作はオーケストレータ (d2-run) だけが行う** (単一コミッタ)。サブエージェントには git 禁止を必ず伝える。

## UC branch の開始と再開

1. 開始条件: `git status --porcelain=v1 --untracked-files=all` が空、detached HEAD でない、`feature/*` 上でない、
   upstream と HEAD が一致。満たさなければ勝手に stash / commit せず、整理を依頼して停止する。
   upstream が設定されていなければ (リモート無し・base を未 push。`git rev-parse --abbrev-ref @{upstream}` が失敗する)
   upstream 一致の条件は飛ばし、報告に「upstream なし」と書く (0.1.16 実走)。clean 判定の対象は d2-run SKILL.md の起動シーケンス 5 に従う
2. `use-cases.yaml` の `slug` で `git switch -c feature/<slug>`。作成直後に `events.jsonl` へ
   `branch_started {base_branch, base_head, feature_branch}` を追記する
3. 再開時 (配送の done が無い) は `branch_started` の `feature_branch` と現在 branch が一致することを確認する。違う branch なら
   clean のときだけ switch。`base_head` が HEAD の祖先でなければ停止する
4. 再開時 (配送の done がある) は作業 branch が main (feature は配送で消えている)。remote `origin` があり `origin/main..main` に commit があれば、
   何より先に `git push origin main` をやり直す (d2-run SKILL.md の起動シーケンス 4)

## 段階ごとの commit

段階の done を書いたら、その段階の write-set を `impl(<slug>): <stage>` で commit する
(例 `impl(register-loan): scaffold`)。`.distillery/runs/<slug>/` の events / done / attempt は含める。
reports / traces は .gitignore 済みで含めない。シナリオ承認は `req(<slug>): scenarios` で commit する。
配送の done と還流の記録は main の上で commit する (`impl(<slug>): delivered` / `impl(<slug>): feedback filed`)。

## squash と main への取り込みの条件

次をすべて満たすときだけ実行する。1 つでも欠ければ禁止。

- 最新のレビュー証跡に対する人の承認 (`review_approved`) が有効で、要回答の前提がすべて回答済み
- `reports/gates.json` の `result: pass`、findings の open blocker が 0
- 現在 branch が `feature_branch`、working tree と index が clean、`base_head` が HEAD の祖先
- remote `origin` があれば、`git fetch origin` の後に `origin/main` が `main` の祖先か同じ

還流の記録は条件に入れない (0.1.26 から還流は配送の後。保留 `feedback_deferred` は新しくは書かない)。

## 手順 (squash)

1. `git status --porcelain=v1 --untracked-files=all` が空、`git diff --quiet`、`git diff --cached --quiet`、
   `git merge-base --is-ancestor <base_head> HEAD`、`git log <base_head>..HEAD` に merge commit が無いことを確認
2. 復旧用 ref `refs/distillery2/pre-squash/<slug>/<timestamp>` を `git update-ref` で現在 HEAD に作る。作れなければ squash しない
3. `git reset --soft <base_head>`。staged が当該 UC の変更だけであることを確認する。`use-cases.yaml` の該当行を `status: done` にして stage する
4. `scripts/prTrailers.js --run .distillery/runs/<slug> --strict --base <base_head> --commit-message "feat: <UC 名>" --co-author "<ハーネスの attribution 行>"` で本文を作り
   (`--base` には 3 で使った `<base_head>` をそのまま渡す。省略時の自動選択 (origin/HEAD → main → master) は UC の開始ブランチと違うことがある。必須 trailer が
   欠けていれば exit 1 で止まる)、`git commit -F <本文ファイル>` で
   exactly 1 commit を作る。件名は `feat: <UC 名 (日本語)>`。`git rev-list --count <base_head>..HEAD` が 1 でなければ取り込まない。
   失敗したら `git reset --soft <復旧用 ref>` で戻す。本文ファイルは `<run>/reports/` (gitignore) に置く
5. 引数が `merge=hold` なら、ここで止めて報告する

## 手順 (main への取り込み)

1. `git switch main` → `git merge --ff-only feature/<slug>`。ff できなければ (main が `base_head` から進んでいる) 止まって報告する (rebase は人が判断)
2. main の上で配送の done (`runState.js done <run> deliver '{"squash":"<sha>","base_head":"<base_head>"}'`) と、遅らせていた `models_resolved` と README を
   `impl(<slug>): delivered` で commit する。**配送済みの正は `stages/deliver.done.yaml`** (GitHub の PR ではない)
3. remote `origin` があれば `git push origin main`。拒否されたら止まって報告する (保護された main など。force push はしない)
4. `git branch -d feature/<slug>`
5. 次の UC は main から新しい run で始める (自動では続けない)

## commit trailer

`scripts/prTrailers.js` が run state から作る。`git interpret-trailers` 互換の `Key: value` 行。

| trailer | 値 |
|---|---|
| UC | `<業務>/<BUC>/<UC>` |
| UC-Slug | slug |
| Basis-Requirements / Basis-Adr / Basis-Contracts | 各上流ディレクトリの最終 commit sha (basis.js stamp)。**base branch との merge-base から遡る** (UC branch 上の commit は squash で消えるため。`--base` で起点を指定できる) |
| Basis-Base | Basis-* の起点 (base branch との merge-base の sha)。`--strict` では必須 (解決できなければ `--base` を渡す) |
| Basis-Changed | base 以降に UC branch で変えた上流 (`requirements adr contracts` のうち該当)。この squash commit 自身が差分を含む印 (無ければ省略) |
| Co-Authored-By | `--co-author` で渡した行 (ハーネスが指定する attribution をそのまま。複数可) |
| Gates | `static=pass unit=pass contract=pass uc-bdd=pass acceptance=pass` (gates.json から) |
| Assumptions | `confirmed=<n> auto=<n> rejected=<n>` (review_approved の decisions から) |
| As-Built | `docs/as-built/<業務>/<UC>/index.md` |

還流は配送の後なので、UC の squash commit に還流の trailer は付けない。還流の commit は `Feedback-Kind:`、`Feedback-From-UC:`、`Feedback-Issue:` (issues/ のパス) を持つ。

## 還流の worktree と課題ファイル

手順の正本は SKILL.md の「還流」節。ここには git の約束だけを書く。

- rule / contract: 還流 branch `feedback/<slug>/<issue>` を **main から** `git worktree add .distillery/worktrees/<slug>/<issue> -b <還流 branch> main` で切る
  (配送の後なので、この UC の契約・課題・run ディレクトリがそろっている)。本体の作業ツリーは main のまま動かさない
- worktree には依存が無いので、本体の `node_modules` (ルートと各ワークスペース) を同じ相対パスに symlink する。`.gitignore` の `node_modules` (末尾スラッシュ無し) が symlink も無視する
- rule は ADR と開発ルールを 2 commit に分ける (`feedback(<slug>): adr` → `feedback(<slug>): rules`)。ルールの basis は docs/adr の最終 commit を記録するので、
  ADR を commit してから作り直さないと古い ADR を指す
- 受理の `--check` は生成物を commit する前に回す (basis の行まで比べるので、commit の後では古いと判定される)
- main へ入れる前に、main を壊さないことのゲートを worktree で回す (rule は static、contract は static と変えた契約を使う UC ごとの全段)
- 取り込みは `git merge --ff-only`。ff できなければ **rebase しない** (rule の basis が古くなる)。worktree を捨てて最新の main から作り直す
- 止まったら差分を `.distillery/logs/feedback/<slug>/<issue>.failed.diff` に残し、`git worktree remove --force` と `git branch -D` で捨てる (main は変わらない)
- 課題ファイル `docs/feedback/<issue>.md` は main に commit する。feature の上にいるとき (review で「要求を直す」) は一時の worktree で commit し、
  `git fetch . feedback/<slug>/<issue>:main` で main を ff する (main を checkout しない)
- UC の feature branch には還流の変更を混ぜない
