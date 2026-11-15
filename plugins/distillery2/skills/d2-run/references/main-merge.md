# main マージ (deliver 段階)

UC の変更を 1 commit に squash して、main へ取り込む段階である。
手順の git の約束は [git-delivery.md](git-delivery.md)。

| 順 | すること |
|---|---|
| 1 | 件名を検査し、gates.json を作り直し、条件を確認する |
| 2 | remote の main が進んでいないことを確かめる |
| 3 | squash する |
| 4 | `merge=hold` なら、ここで止める |
| 5 | main へ ff merge する |
| 6 | main の上で、main マージの done を commit する |
| 7 | push する |
| 8 | feature の branch を消す |

## 手順 1: 3 つの作業

main マージ 1 は 3 つの作業をこの順で行う。

### 1 の 1: 件名の検査

1. **件名の検査** (最初に): `git log <base_head>..HEAD --format=%s` がすべて `impl(<slug>): ` か `req(<slug>): ` で始まる。そうでなければ UC 外の commit が混ざっているので、gates.json の作り直しも課題ファイルの commit もせず止まって報告する (混ざった commit の一覧を添える)。
   止まった後は人が混入した commit を落とし (rebase)、再開は main マージ 1 から (git-delivery.md「squash」1)

### 1 の 2: gates.json の作り直し

2. **gates.json の作り直し**: 先に**人の修正**を判定する。次に、全段を通して記録を作り直す。

人の修正の判定:
最後の `review_approved` の `head` から HEAD までに、実装のフォルダの変更があれば (`git diff --name-only <head>..HEAD -- apps packages contracts features ':!**/package.json' ':!**/package-lock.json'` が空でない)、
承認の後に人がコードを直したので `node runState.js invalidate <run> verify "<理由>" --from` で verify 以降を退避し、`runGates.js --uc <slug> --tiers <tiers>` で全段 (トレースも) を作り直してから verify からやり直す (検証・人レビュー・as-built が直した後のコードの記録を読む。依存の一覧と検査の設定だけなら次のゲートで見る)。
`head` が無い承認 (0.1.34 まで) は判定せず、完了報告に「判定できない」と書く。

記録の作り直し:
次に、古さは比べず、**常に** `runGates.js --uc <slug> --tiers <use-cases.yaml の tiers>` で全段を 1 回通して記録を作り直す (最後に全段を通した後に as-built と人レビューの commit が入るので、比べても必ず古い)。

作り直す前の控え:

- `reports/gates.json` があれば runGates の前に `reports/gates.prev.json` に写す (前の控えは上書きする)
- 無ければ (gitignore なので再開で消えていることがある)、残っている控えを `node -e "require('fs').rmSync('<run>/reports/gates.prev.json',{force:true})"` で消す (古い控えを今回の「前回」として報告しない)

作り直しの runGates が落ちたら、まず ④ の「ゲートの回し直し」(stage-uc.md) のとおり 1 回だけ回し直す (static は回し直さない)。
それでも落ちたら、**推測で直さず止まって報告する**。

報告に添えるもの:

- 落ちたゲート名と job (`gates.json` の `output_tail` / `failed_tests`)
- 指摘の対象ファイルが UC の変更 (`git diff --name-only <base_head>..HEAD`) に含まれるか。含まれなければ「UC と無関係の可能性 (検査の規則や情報の更新など。コードを変えていなくても落ちる)」と書く
- static で落ちたときは、落ちた job の検査 (qlty の plugin 名。`output_tail` に出る) が UC の変更で `.qlty/qlty.toml` に足されたかも添える (`git diff <base_head>..HEAD -- .qlty/qlty.toml` に `name = "<plugin>"` の追加があるか)

static で落ちたときの書き方:

| 分かったこと | 報告に書くこと |
|---|---|
| 足されていた | 足されていれば「この UC で検査の範囲が広がり、既存のコードや依存への指摘が初めて出た可能性」と書く |
| plugin 名が特定できない | plugin 名が `output_tail` から特定できない (出力が末尾で切れた、qlty 以外の job で落ちた) ときは「判定できない」と書き、足されたか / いないかを推測で断定しない |

人が直すときは **feature の上で** (依存の更新、または `.qlty/qlty.toml` の `[[ignore]] rules = ["<plugin>:<id>"]`) 件名 `impl(<slug>): <内容>` で commit し、main マージ 1 から再開する (コードに及べば 2 の判定で verify から、そうでなければ 2 で gates.json が作り直される)。
main で直して feature を rebase しない (`base_head` は開始時の記録のまま更新されないので、main 側の修正 commit が `<base_head>..HEAD` に入り、1 の件名の検査で止まる。通っても squash がその修正を UC の 1 commit に畳む)

### 1 の 3: 条件の確認

3. **条件の確認**: `review_approved` が有効 (= `runState.js status` で review が done、かつ events で最後の `review_approved` より後に `stage_invalidated {stage: review}` も `review_rejected` も無い)、`reports/gates.json` が `all_recorded: true` で全段 pass、findings の open blocker 0。

次に、UC の課題を課題ファイルにする。

- feature の上で `node <skills>/d2-common/scripts/feedbackBatch.js file-issues <run> --cwd <リポのルート>` を回し、UC の課題 (`issues/*.md`) を課題ファイル `docs/feedback/<issue>.md` にする (`feedback_filed` も記録する)
- `runState.js status` の `unfiled_issues` が空であることを確かめる (課題の取りこぼしはこれで確かめる。前の main マージ 1 で課題ファイルにした課題は `filed` に出ないので、止まって再開した main マージでは `filed` が空でよい)
- 結果の `filed` が空でなければ `genDocsReadme.js` を回し、`git add -A -- docs .distillery/runs/<slug>` して `impl(<slug>): issues to feedback` で commit する (squash で UC の 1 commit に入る。main に別の commit を足さない)
- `filed` が空 (課題 0 件) なら commit を作らない (`docs/feedback/` が無いことがあり、パスを名指しすると `git add` が落ちる)
- 開き直した UC (`.distillery/archive/runs/<slug>/` の最新の `reopened.json` に `issues` がある) と、run に `carried_issues` がある UC なら、その課題ファイルを `git rm` して同じく commit に入れ、squash の本文に `Feedback-Consumed: <課題>` を足す

## 手順 2〜8: squash から片付けまで

2. remote `origin` があれば `git fetch origin` し、`origin/main` が `main` の祖先か同じ (`git merge-base --is-ancestor origin/main main`) であることを確かめる。
   そうでなければ止まって報告する (他の人が main を進めた。rebase は人が判断)
3. 件名は 1 で検査済み → 復旧用 ref (`refs/distillery2/pre-squash/<slug>/<timestamp>`。`<timestamp>` は `date -u +%Y%m%dT%H%M%SZ`) → `git reset --soft <base_head>` →
   `node runState.js uc-status <リポのルート> <slug> done` で `use-cases.yaml` の該当行を `status: done` にする (手で編集しない) → stage → prTrailers で本文 → `git commit -F <本文>` (exactly 1 commit)。
   手順の詳細は git-delivery.md「squash」
4. 引数が `merge=hold` なら、ここで止めて報告する (引数なしで再開すれば 5 から)
5. `git switch main` → `git merge --ff-only feature/<slug>`。ff できなければ (main が `base_head` から進んでいる) 止まって報告する
6. main の上で、④ の冒頭で遅らせた場合だけ `models_resolved` を記録し (遅らせた = run の events に解決済み ID の `models_resolved` が無い。冒頭で記録済みなら記録しない)、`genDocsReadme.js` で `docs/README.md` を更新し (UC 一覧の状態列が `status: done` を見て「main マージ済み」になる)、
   `node runState.js done <run> deliver '{"squash":"<squash commit のフル sha (git rev-parse HEAD)>","base_head":"<base_head>"}'` を実行して、`git add -A -- docs .distillery/runs/<slug>` (main マージの done・events・README・課題一覧の README。新規と削除を含む。`docs/feedback/` は無いことがあるので名指ししない) してから
   まとめて `impl(<slug>): delivered` で commit する (main マージ済みの正は `stages/deliver.done.yaml`)
7. remote `origin` があれば `git push origin main` と `git push origin 'refs/distillery2/*:refs/distillery2/*'` (控えの ref)。拒否されたら止まって報告する (force push はしない。再開すると起動シーケンス 4 でやり直す)
8. `git branch -d feature/<slug>`

手順 3 の補足: `review_approved` に `carry_over.carry` が残る run (0.1.30 形式) でも読まずに main マージし、完了報告に「持ち越し N 件は次の起動で要求の差分に載る」と書く。
main マージ後の起動の自動選択 3 の 4 が `carry_over_pending` で拾う。

再開 (main マージの done が無いとき): feature が `base_head` から 1 commit で、その commit が main に含まれていなければ 4 から (squash 済み)。含まれていれば 6 から。

## 旧形式の run

**旧形式の run** (0.1.25 まで。還流の done があり main マージの done が無い。`runState.js status` の `legacy_order: true`): 次の段階は出ない。
確認ページで人に聞く (問い: この UC は main マージ済み (PR が merge 済み) か)。

「main マージ済み」のとき:

1. **main に切り替えて** (`git switch main`。remote `origin` があれば `git pull --ff-only origin main` で PR の merge を取り込む)
2. main 上の run に `node runState.js mark-legacy-delivered <run>` で main マージの done (`legacy: true`) を作り (起票されていない課題があれば、旧形式の還流の done も退避される。結果の `feedback_reopened`)、`impl(<slug>): legacy delivered` で main に commit する
3. `feature/<slug>` が残っていれば `git update-ref refs/distillery2/legacy/<slug>/<ts> feature/<slug>` で退避してから `git branch -D feature/<slug>` (`<ts>` は `date -u +%Y%m%dT%H%M%SZ`)
4. その後は自動選択をもう一度呼ぶ (commit と削除の間で止まっても、自動選択の `cleanup` が片付ける)

main に切り替える理由: PR は squash merge されていて feature とは別の履歴なので、feature に commit しても main に載らない。
常に退避してから `-D` で消す理由: squash merge で入れた feature は main の祖先でないことがあり `-d` では消せない。
残すと自動選択が進行中の UC とみなして毎回戻る。

main 上の run が旧形式でなければ (PR の merge がまだ取り込めていない) 止まって報告する。

「まだ」のとき:
`node runState.js invalidate <run> feedback <理由>` で還流の done を退避し、`impl(<slug>): reorder stages` で commit して、新しい順で main マージから続ける (旧形式で起票済みでない課題は還流で処理し直す)。

旧形式の還流の記録 (`feedback_filed` の `url`) は起票済みとして数える。
