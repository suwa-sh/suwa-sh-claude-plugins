# Git 配送 (UC ごとの branch / squash / PR)

v1 (dist-impl-run「UCのsquash・push・PR作成」) を次の点で簡素化した:
lease と review HTML の追跡除外を廃止 (`.distillery/runs/*/reports|traces` は .gitignore)、
還流 (feedback) は別 branch の PR か issue にして UC の PR と混ぜない、trailer で系譜を残す。
**git 操作はオーケストレータ (d2-run) だけが行う** (単一コミッタ)。サブエージェントには git 禁止を必ず伝える。

## UC branch の開始と再開

1. 開始条件: `git status --porcelain=v1 --untracked-files=all` が空、detached HEAD でない、`feature/*` 上でない、
   upstream と HEAD が一致。満たさなければ勝手に stash / commit せず、整理を依頼して停止する
2. `use-cases.yaml` の `slug` で `git switch -c feature/<slug>`。作成直後に `events.jsonl` へ
   `branch_started {base_branch, base_head, feature_branch}` を追記する
3. 再開時は `branch_started` の `feature_branch` と現在 branch が一致することを確認する。違う branch なら
   clean のときだけ switch。`base_head` が HEAD の祖先でなければ停止する

## 段階ごとの commit

段階の done を書いたら、その段階の write-set を `impl(<slug>): <stage>` で commit する
(例 `impl(register-loan): scaffold`)。`.distillery/runs/<slug>/` の events / done / attempt は含める。
reports / traces は .gitignore 済みで含めない。シナリオ承認は `req(<slug>): scenarios` で commit する。

## squash・push・PR の条件

次をすべて満たすときだけ実行する。1 つでも欠ければ禁止。

- 最新のレビュー証跡に対する人の承認 (`review_approved`) が有効で、要回答の前提がすべて回答済み
- `reports/gates.json` の `result: pass`、findings の open blocker が 0
- 還流の要否が分類済み (rule / contract は別 branch の PR、requirement は issue を作成済み)
- 現在 branch が `feature_branch`、working tree と index が clean、`base_head` が HEAD の祖先

## 手順

1. `git status --porcelain=v1 --untracked-files=all` が空、`git diff --quiet`、`git diff --cached --quiet`、
   `git merge-base --is-ancestor <base_head> HEAD`、`git log <base_head>..HEAD` に merge commit が無いことを確認
2. 復旧用 ref `refs/distillery2/pre-squash/<slug>/<timestamp>` を `git update-ref` で現在 HEAD に作る。作れなければ squash しない
3. `git reset --soft <base_head>`。staged が当該 UC の変更だけであることを確認する
4. `scripts/prTrailers.js --run .distillery/runs/<slug> --strict --commit-message "feat: <UC 名>" --co-author "<ハーネスの attribution 行>"` で本文を作り (必須 trailer が
   欠けていれば exit 1 で止まる)、`git commit -F <本文ファイル>` で
   exactly 1 commit を作る。件名は `feat: <UC 名 (日本語)>`。`git rev-list --count <base_head>..HEAD` が 1 でなければ push しない。
   失敗したら `git reset --soft <復旧用 ref>` で戻す
5. `gh auth status` を確認し `git push -u origin feature/<slug>`。force push はしない
6. `gh pr list --state all --head feature/<slug> --json number,url,state` で既存 PR を確認。無ければ
   `gh pr create --base <base_branch> --head feature/<slug> --title "feat: <UC 名>" --body-file <本文>`。
   本文は UC の目的、主な変更、ゲート結果、承認した前提、as-built のパス、既知の制約を人が読める名前で書く
7. 配送の記録は **commit に入れない** (squash 後に追跡ファイルを書くと tree が汚れ、PR に 2 個目の commit が要るため)。
   `reports/delivered.json` (`.distillery/runs/*/reports` は gitignore 済み) に `{pr_url, recovery_ref, head, at}` を書き、
   PR URL と復旧用 ref を報告して終了する。**配送済みかどうかの正は GitHub** (`gh pr list --head feature/<slug>`)。
   再開時は `gh pr list` を先に照合し、PR があれば deliver 段階を完了扱いにする (done ファイルは作らない)。
   次の UC へ自動継続しない (PR が merge され base branch を fetch した後の新しい run で始める)

## commit trailer

`scripts/prTrailers.js` が run state から作る。`git interpret-trailers` 互換の `Key: value` 行。

| trailer | 値 |
|---|---|
| UC | `<業務>/<BUC>/<UC>` |
| UC-Slug | slug |
| Basis-Requirements / Basis-Adr / Basis-Contracts | 各上流ディレクトリの最終 commit sha (basis.js stamp)。**base branch との merge-base から遡る** (UC branch 上の commit は squash で消えるため。`--base` で起点を指定できる) |
| Basis-Changed | base 以降に UC branch で変えた上流 (`requirements adr contracts` のうち該当)。この squash commit 自身が差分を含む印 (無ければ省略) |
| Co-Authored-By | `--co-author` で渡した行 (ハーネスが指定する attribution をそのまま。複数可) |
| Gates | `static=pass unit=pass contract=pass uc-bdd=pass acceptance=pass` (gates.json から) |
| Assumptions | `confirmed=<n> auto=<n> rejected=<n>` (review_approved の decisions から) |
| As-Built | `docs/as-built/<業務>/<UC>/index.md` |
| Feedback | 還流ごとに `rule:<pr_url>` / `contract:<pr_url>` / `requirement:<issue_url>` (無ければ省略) |

## 還流の PR / issue

- rule / contract 起因: `feedback/<slug>-<n>` branch を `base_branch` から切り、ADR の追記 (→ rules 再生成) または
  契約の分割ファイル修正だけを commit し、PR を作る。trailer は `Feedback-Kind:`, `Feedback-From-UC:`, `Feedback-Issue:` (issues/ のパス)
- requirement 起因: `gh issue create` で要求の穴を起票する。本文は issues/ の Markdown。UC の PR 本文からリンクする
- UC の feature branch には還流の変更を混ぜない
