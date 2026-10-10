---
name: d2-run
description: >-
  distillery2 のオーケストレータ。要求→決定→基盤→UC 縦切りの段階を振り分け、サブエージェントを派遣し、
  ゲートを安い順に実行し、人の判断が要る場面だけ確認ページ (toolbox:human-html-review) を出す。
  UC 単位で 1 commit に squash して main へ取り込む (PR / issue は作らない。git とファイルだけで完結する)。通常はこのスキルだけ呼べばよい。
  「要求から実装まで回して」「次の UC を実装して」「<UC 名> を実装して」などで発動。
---

# d2-run

パスの `<skills>` の意味は [../d2-common/SKILL.md](../d2-common/SKILL.md) の「パスの書き方」(スキル群のディレクトリ。読込時に表示されるこのスキルの場所の 1 つ上)。

## 引数

```
/distillery2:d2-run                                   # 次に必要な段階を自動で選ぶ
/distillery2:d2-run stage=requirements input=<要望テキスト>
/distillery2:d2-run stage=decide | stage=foundation
/distillery2:d2-run stage=feedback                    # 溜まった課題ファイルをまとめて直す (還流。中断からの再開も同じ)
/distillery2:d2-run uc=<slug | UC 名>                 # 指定 UC の縦切り (中断からの再開も同じ)
/distillery2:d2-run uc=<slug | UC 名> merge=hold      # main へ取り込む手前で止める (headless 用。引数なしで再開すると取り込みから続く。stage=feedback にも付けられる)
```

`merge=hold` を config に置かない理由: config は追跡ファイルで ③ の仕上げで再生成されるため、書き換えると作業ツリーが汚れ、再生成で値が戻る。

自動選択の順 (起動時に作業 branch と段階を決める):

1. `docs/requirements/use-cases.yaml` が無ければ ①、`docs/adr/` が無ければ ②、`.distillery/config.yaml` が無ければ ③
2. **進行中の UC** があれば、その UC の ④ を続ける。進行中 = ローカルに `feature/<slug>` branch があり、その branch の run の最後の止まりが `blocked_on_requirement` でない UC
   (`git show feature/<slug>:.distillery/runs/<slug>/events.jsonl` で読む。checkout しない)。
   ただし **main 上のその UC の run に配送の done があれば配送済み** (配送の 7〜8 か旧形式の片付けの途中で止まった) なので進行中とみなさず、feature を片付けて 3 へ:
   その feature を checkout していれば先に clean を確かめて `git switch main` する (checkout 中の branch は消せない)。
   done が `legacy: true` なら `git update-ref refs/distillery2/legacy/<slug>/<ts> feature/<slug>` で退避してから `git branch -D feature/<slug>`、そうでなければ ff 済みなので `git branch -d feature/<slug>`。
   **`uc=<slug>` の名指し起動でも、この 2 の片付け (main 上の run に配送の done がある feature の退避・削除) をすべての `feature/*` について先に行う** (名指しの UC 以外も。0.1.28 実走 L1・0.1.29 実走 M10)。
   名指しの UC 自身が配送済み (main 上の run に配送の done がある) なら、片付けた後に「配送済み」と報告して終わる (再開する段階は無い)
3. それ以外は **clean な main に切り替えてから** (要求で止まった UC の feature にいても。clean でなければ整理を依頼して止まる)、`node <skills>/d2-common/scripts/feedbackBatch.js scan --cwd <リポのルート>` の結果で決める:
   1. remote `origin` があり `git rev-list --count origin/main..main` が 0 でなければ、何より先に `git push origin main` をやり直す (配送・要求の差分・還流の push が拒否されて止まった後の再開。拒否されたら止まって報告する。force push はしない)
   1.5. **旧形式**: `legacy_runs` (0.1.25 までの順の run。`runState.js status` の `legacy_order: true`。配送の done の有無で除外しない: 片付けの途中で止まった run も拾う) があれば、run ごとに配送の節「旧形式の run」の確認ページ (配送済みか) から片付ける。片付けてから `FB scan` をやり直す
      (0.1.28〜0.1.31 の 4 回の実走で、main にだけ残る旧形式の run がどの分岐にも乗らず、LLM が自分で当てていた。0.1.32 N7・O7)
   2. **移行**: `unfiled_runs` (配送済みなのに課題ファイルにしていない課題がある run。0.1.26 で `merge=hold` で止めた run や、旧形式の片付けで還流の done を退避した run) があれば、run ごとに
      `FB file-issues <run>` → `genDocsReadme.js` → `git add -A -- docs .distillery/runs/<slug>` → `impl(<slug>): issues to feedback` で main に commit する (remote `origin` があれば push)。終わったら `FB scan` をやり直す
      (`FB` は還流節の定義。課題を数える前に課題ファイルにするので、旧形式の要求の課題も同じ回の要求の差分に乗る)
   3. `batch.point` が `none` 以外 (途中の還流。main へ取り込んだ後の後始末の前に止まった場合を含む) → 還流の続き
   4. `requirement` が空でないか、**既存の持ち越しが残っている** (`carry_over_rows` (`use-cases.yaml` の `carry_over` の行) か `carry_over_pending` が空でない。0.1.30〜0.1.31 形式の残った作業。要求の課題が 0 件でも) → ① の「要求の差分」
   5. `feedback_due` が true (止まっていないルール・契約の課題がある) → 還流
   6. それ以外 → `use-cases.yaml` の先頭から `status` が `done` でない最初の UC の ④。要求で止まった UC (`feature/<slug>` が残っているもの) は飛ばす
      (その UC の要求の課題は保留中 (`hold`)。後の要求の差分で課題を反映・取り下げたときに feature が退避され、次の起動で main から新しい run で始まる)

止まった課題 (課題ファイルの `stopped: true`) は 3 の 4・5 のきっかけにしない (きっかけにすると、止まった課題だけで起動のたびに戻り、UC へ進めない)。ほかの課題で回すときに一緒に読む。
プラグインへ持ち帰る課題 (`kind: plugin`。還流節) もきっかけにしない (`scan` の `plugin` は報告に載せるだけ)。
要求の差分と還流は main を進める。進行中の UC の feature は古い main から切られているので、先に main を進めると配送の ff merge ができなくなる。
`stage=requirements` (要求の差分) と `stage=feedback` を直接指定しても、進行中の UC があれば止まって報告する。直接指定でも 3 の 1〜2 (push のやり直し・旧形式の片付け・移行) は行う。
`uc=<slug>` で要求で止まった UC を直接指定したら、保留中のその UC の要求の課題を示して止まって報告する (要求の差分で反映するか取り下げるまで再開できない)。

## 原則

- `docs/README.md` は上流から下流まで辿る入口。`<skills>/d2-common/scripts/genDocsReadme.js` が既存の正本から生成する
  (管理ブロックの中だけ。人が書いた部分と distillery2 以外の文書は触らず、名前だけ列挙する)。各段階の commit 前に更新する

- **自分では本文をほぼ読まない**。読むのは `.distillery/config.yaml`、`use-cases.yaml`、run の events / done / reports、
  サブエージェントの報告だけ。各段階は fresh なサブエージェントに委譲する ([references/subagent-template.md](references/subagent-template.md))
- **git 操作は自分だけが行う** (単一コミッタ)。サブエージェントには git 禁止を必ず伝える ([references/git-delivery.md](references/git-delivery.md))。
  自分が作るすべての commit に attribution 行を trailer で付ける (git-delivery.md「commit の attribution」。0.1.28 実走 L14)
- 実行状態は `.distillery/runs/<slug>/` の events + done ([references/run-state.md](references/run-state.md))。
  操作は `<skills>/d2-common/scripts/lib/runState.js` を通す。status ファイルは持たない
- 人に確認するときは **必ず `toolbox:human-html-review`** で確認ページを作り、showme の URL とローカルパスを示す。
  内部 ID (uc_id、SPEC-xxx、段階名) を本文に出さず名前で呼ぶ。回答は選択肢からコピーできる形にする。
  headless などで事前に与えられた回答が、その確認ページの問いで選べない (例: ゲートが落ちたときの「すべて取り込む」) ときは、推測で別の回答にせず止まって報告する (0.1.29 実走 M4)
- 上流 (要求・ADR・契約) の再生成はしない。ズレは `basis.js check` で見つけ、課題ファイル `docs/feedback/` にする (要求の課題は要求の差分が、ルール・契約の課題は還流が、持ち主のスキルで直して main へ取り込む)

詰まったら各スキルの `references/troubleshooting.md` (環境依存の症状と回避策) を見る: 索引は [../d2-common/references/troubleshooting.md](../d2-common/references/troubleshooting.md) (d2-run / d2-foundation / d2-contract)。手順に無い回避策を使ったら報告に書く。

## d2-run が直接読み書きするもの

サブエージェントに任せず、d2-run 自身と d2-run が回すスクリプトが読み書きするもの (処理ごとに 1 行)。`<run>` = `.distillery/runs/<slug>` (③ のチェックポイントは slug `bootstrap`)。入出力の正本は
[../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) (図は [dataflow.md](../d2-common/references/dataflow.md))。

| 処理 | 読む | 書く |
|---|---|---|
| ① ② の確認ページ | `docs/requirements/_review-summary.md`、`docs/adr/_review-summary.md` | — |
| ① の要求の差分の取り込み | `docs/feedback/*.md`、`<run>/events.jsonl` (要求で止まった UC の feature の run。`git show` で読む。配送済み UC の run の `carry_over_pending`)、`docs/requirements/use-cases.yaml` (既存の `carry_over` の行)、`docs/design/**` (残った作業 `design` の取り込み直し: importUi.js が `docs/design/storybook-app` を読む) | `docs/feedback/<issue>.md` (反映・取り下げた課題ファイルを消す。外して残す課題には `feedbackBatch.js hold` が止まった印を書く)、`docs/requirements/use-cases.yaml` (課題 0 件で要求担当を派遣しないときの genUseCases.js の再生成。`carry_over` の行が消える)、`<run>/events.jsonl` (残った作業 `assumption` の `assumption_resolved`、既存の持ち越しを流した `carry_over_migrated`。runState.js)、`packages/ui/**` (importUi.js の取り込み直し)、`<run>/reports/**` (取り込み直しの後の既存 UC の frontend の unit の回帰。runGates.js。validateScreens.js は読むだけ) |
| ① ② の genDocsReadme.js | `.distillery/config.yaml`、`docs/requirements/rdra/**`、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`contracts/contracts.json`、`contracts/uc-index.yaml`、`docs/design/**`、`docs/as-built/_system/**`、`docs/as-built/<業務>/<UC>/**`、`docs/adr/*.md`、`docs/nfr/**`、`docs/rules/**`、`docs/feedback/*.md` | `docs/README.md`、`docs/feedback/README.md` (課題の一覧。0 件なら消す) |
| ③ の確認ページ | `.distillery/config.yaml`、`<run>/reports/**` (受理時の検査で bootstrap の gates.json を読む) | `<run>/reports/**` (仕上げの派遣前に bootstrap の gates.json を消す) |
| ③ の genContractTests.js --check | `contracts/**`、`.distillery/config.yaml`、`apps/*/test/contract/**`、`packages/contracts/**` | — |
| ③ の genDocsReadme.js | `.distillery/config.yaml`、`docs/requirements/rdra/**`、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`contracts/contracts.json`、`contracts/uc-index.yaml`、`docs/design/**`、`docs/as-built/_system/**`、`docs/as-built/<業務>/<UC>/**`、`docs/adr/*.md`、`docs/nfr/**`、`docs/rules/**`、`docs/feedback/*.md` | `docs/README.md`、`docs/feedback/README.md` (課題の一覧。0 件なら消す) |
| ④ の段階の進行・確認ページ | `.distillery/config.yaml`、`docs/requirements/use-cases.yaml`、`<run>/events.jsonl`、`<run>/reports/**`、`<run>/reports/asbuilt.json`、`<run>/attempt-<n>/findings.<tier>.yaml`、`<run>/attempt-<n>/assumptions.<tier>.yaml`、`<run>/issues/**`、`<run>/issues/<ts>_<tier>_<slug>.md`、`contracts/uc-index.yaml`、`docs/as-built/_system/**`、`features/<業務>/<slug>.feature`、`features/acceptance/**` (scenario の承認の `runState.js scenario-approve` がハッシュを計算する) | `<run>/events.jsonl`、`<run>/invalidated/**` (差し戻しで退避した done と findings)、`docs/requirements/use-cases.yaml`、`<run>/reports/asbuilt.json` (asbuilt の派遣前に消す)、`docs/feedback/<issue>.md` (review で要求を直すときの課題ファイル)、`.distillery/worktrees/<slug>/<issue>` (そのときの一時の worktree) |
| ④ の feedbackBatch.js file-issues | `<run>/issues/**`、`<run>/issues/<ts>_<tier>_<slug>.md`、`<run>/events.jsonl` | `docs/feedback/<issue>.md` (UC の課題を課題ファイルにする)、`<run>/events.jsonl` (`feedback_filed`) |
| 起動時の feedbackBatch.js file-issues (移行) | `<run>/issues/**`、`<run>/issues/<ts>_<tier>_<slug>.md`、`<run>/events.jsonl` | `docs/feedback/<issue>.md` (配送済みなのに課題ファイルにしていない run の課題。自動選択の 3 の 2)、`<run>/events.jsonl` (`feedback_filed`) |
| 起動時の genDocsReadme.js (移行) | `.distillery/config.yaml`、`docs/requirements/rdra/**`、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`contracts/contracts.json`、`contracts/uc-index.yaml`、`docs/design/**`、`docs/as-built/_system/**`、`docs/as-built/<業務>/<UC>/**`、`docs/adr/*.md`、`docs/nfr/**`、`docs/rules/**`、`docs/feedback/*.md` | `docs/README.md`、`docs/feedback/README.md` (課題の一覧。0 件なら消す) |
| ④ の checkScenario.js | `features/<業務>/<slug>.feature`、`features/acceptance/**`、`docs/requirements/use-cases.yaml`、`docs/requirements/requirements.yaml` | — |
| ④ の compileContracts.js --check | `contracts/**` | — |
| ④ の compileRdbSchema.js --check | `contracts/**` | — |
| ④ の validateUcIndex.js | `contracts/uc-index.yaml`、`contracts/**` | — |
| ④ の classifyContractChanges.js | `contracts/uc-index.yaml`、`apps/*/test/contract/**`、`packages/contracts/**`、`apps/<tier>/migrations/**`、`contracts/generated/slices/<slug>/**` | — |
| ④ の runGates.js | `.distillery/config.yaml`、`package.json`、`package-lock.json`、`cucumber.js`、`tsx-register.js`、`.qlty/qlty.toml`、`apps/<tier>/src/**`、`apps/*/test/contract/**`、`apps/<tier>/migrations/**`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`features/step_definitions/**`、`features/support/**`、`.dependency-cruiser.cjs`、`<run>/reports/**` | `<run>/reports/**`、`<run>/traces/**` |
| ④ の genQlty.js --refresh | `package.json`、`package-lock.json`、`.qlty/qlty.toml`、`apps/<tier>/src/**` | `.qlty/qlty.toml` |
| ④ の checkAsBuilt.js | `docs/as-built/<業務>/<UC>/index.md` (asbuilt の受理時の検査) | — |
| ④ の genDocsReadme.js | `.distillery/config.yaml`、`docs/requirements/rdra/**`、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`contracts/contracts.json`、`contracts/uc-index.yaml`、`docs/design/**`、`docs/as-built/_system/**`、`docs/as-built/<業務>/<UC>/**`、`docs/adr/*.md`、`docs/nfr/**`、`docs/rules/**`、`docs/feedback/*.md` | `docs/README.md`、`docs/feedback/README.md` (課題の一覧。0 件なら消す) |
| ④ の prTrailers.js と配送 | `docs/requirements/use-cases.yaml`、`<run>/reports/**`、`<run>/events.jsonl` | `<run>/reports/**` (commit の本文)、`docs/requirements/use-cases.yaml` (`status: done`) |
| 還流の進行・確認ページ | `.distillery/config.yaml`、`docs/requirements/use-cases.yaml`、`contracts/uc-index.yaml`、`docs/feedback/*.md`、`.distillery/logs/feedback/<b>/**` (feedbackBatch の状態)、`.distillery/logs/feedback/<b>/<issue>.result.json` (派遣の結果) | `.distillery/logs/feedback/<b>/<issue>.reason.txt` (止まった理由。stop-issue に渡す) |
| 還流の feedbackBatch.js | `docs/feedback/*.md`、`docs/adr/*.md`、`references/rule-templates/`、`contracts/**`、`.distillery/config.yaml`、`.distillery/logs/feedback/<b>/**` | `.distillery/worktrees/feedback`、`.distillery/logs/feedback/<b>/**`、`.distillery/logs/feedback/<b>/<issue>.failed.diff`、`docs/feedback/<issue>.md` (課題の commit で消す・止まった印・`kind: plugin` への書き換え)、`docs/adr/*.md` (原本の commit と索引)、`docs/rules/**`、`.dependency-cruiser.cjs`、`contracts/contracts.json`、`contracts/generated/slices/<slug>/**`、`apps/*/test/contract/**`、`packages/contracts/**`、`apps/<tier>/migrations/**`、`docs/README.md`、`docs/feedback/README.md` |
| 還流の runGates.js | `.distillery/config.yaml`、`package.json`、`package-lock.json`、`cucumber.js`、`tsx-register.js`、`.qlty/qlty.toml`、`apps/<tier>/src/**`、`apps/*/test/contract/**`、`apps/<tier>/migrations/**`、`features/<業務>/<slug>.feature`、`features/acceptance/**`、`features/step_definitions/**`、`features/support/**`、`.dependency-cruiser.cjs`、`<run>/reports/**` | `<run>/reports/**`、`<run>/traces/**` (課題ごとの static は slug `d2-feedback`) |
| 還流の validateAdr.js (受理) | `docs/adr/*.md` | — |
| 還流の genContractTests.js --check (受理) | `contracts/**`、`.distillery/config.yaml`、`apps/*/test/contract/**`、`packages/contracts/**` | — |
| 還流の genRdbDdl.js --check (受理) | `contracts/**`、`.distillery/config.yaml`、`apps/<tier>/migrations/**`、`apps/*/test/contract/**`、`packages/contracts/**` | — |

## 起動シーケンス

1. 引数を解釈し、段階を決める (上の自動選択。main への切り替えと push のやり直しを含む。`uc=` の名指しでも自動選択 2 の片付けを先に行う)
2. `.distillery/config.yaml` があれば読み、`models.implementer` と `models.verifier` を解決する。`implementer: null` はセッション既定モデルなので、**実際のモデル名に解決してから** verifier と並べて記録する。`verifier` は `opus` などの短い別名で書く (フル ID は `model` パラメータとして無効)。
   **独立検証の条件は「別のサブエージェント (文脈が新しい) で、実装役と同等以上のモデル」**。同じモデル ID に解決されても止めない (記録だけ残す。2026-09-26 のユーザー方針)。
   止めるのは verifier が実装役より明らかに弱い別名 (例: 実装役が opus で verifier が haiku) のときだけ
3. ④ なら UC を解決する: 引数が slug なら `use-cases.yaml` と照合、UC 名なら NFC 正規化して一意に一致する行を探す (複数なら候補を示して選ばせる)
4. (④ の再開時) `runState.js status` が `legacy_order: true` (0.1.25 までの順の run) なら、配送の節の「旧形式の run」に従う。その UC の run (feature の `git show`) に `blocked_on_requirement` があれば再開しない (要求の反映待ち。自動選択 2 と同じ。scenario で止めた run も同じ。0.1.32 J1)
5. 作業ツリーの clean 判定 (④・要求の差分・還流の開始時。④ の再開時は branch 一致を確認する (feature)): `git status --porcelain` のうち、**追跡済みの変更**と、**未追跡でも `docs/` `apps/` `packages/` `contracts/` `features/` `.distillery/` 配下のファイル**だけを対象にする。これらがあれば勝手に stash / commit せず整理を依頼して停止する。それ以外のルート直下の未追跡ファイル (ハーネスの `run-stage.sh` などの実行スクリプト) は clean 判定に含めず、**報告に一覧として載せて無視**する (実走でハーネスのファイルが clean 条件を満たせなかったため)。`.git/info/exclude` への書き込みは前提にしない (権限で拒否されうる)

## ① 要求

1. sub `d2-requirements` (input=<要望テキスト>) を派遣する
2. 完了後、`docs/requirements/_review-summary.md` を材料に human-html-review で確認ページを作る
   (UC 一覧、業務ルール、状態遷移、受入基準。判断は「この要求で進めてよいか / 直す点」)
3. 承認されたら `node <skills>/d2-common/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add docs && git commit -m "req: initial requirements" -m "<attribution 行>"`。差し戻しなら指摘を input に足して 1 に戻る

### 要求の差分 (未処理の要求の課題があるとき)

UC の実装で見つかった要求の穴 (課題ファイルの `kind: requirement`) を要求に反映する。自動選択の 3 か `stage=requirements` で入る。
既存の持ち越し (0.1.30〜0.1.31 形式の残った作業: `FB scan` の `carry_over_rows` (`use-cases.yaml` の `carry_over` の行) と `carry_over_pending`) が残っているときは、要求の課題が 0 件でも入る (3 で宛先へ流す)。

1. 前提: 進行中の UC が無い、作業 branch が clean な main。remote `origin` があれば `git fetch origin` して `git merge --ff-only origin/main` (分岐していたら止まって報告する)。
   **既存の持ち越しを先に控える**: `FB scan` の `carry_over_rows` (slug と items) と `carry_over_pending` (slug と items) を 3 の材料として書き留める (2 の再生成 (要求担当の差分更新も `genUseCases.js` も) は `carry_over` の行を引き継がず消すので、2 の後には読めない。差分レビュー 2 ラウンド目)
2. sub `d2-requirements` (`input=<feedbackBatch.js scan の requirement_all の課題ファイルのパス (すべて)>`。差分更新)。課題の本文は自分では読まない。
   報告の「残った作業」(要求担当の write-set の外で必要になった作業。種類 `design` / `assumption` と対象付き)、「決定と違う反映」(課題の決定と違う反映にした課題・決定・実際の反映・理由)、
   「仮に決めた反映」(課題に決定が無く要求担当が案を選んだもの: 課題・選んだ案・理由。0.1.32 N10・O8) を 3 の材料に控える。
   要求の課題が 0 件 (既存の持ち越しだけ) なら要求担当は派遣せず、`node <skills>/d2-requirements/scripts/genUseCases.js` を回して `use-cases.yaml` を再生成する (決定論。`carry_over` の行が消える。他の変更は無い)
3. ① と同じ材料で確認ページを作る (課題ごとに反映した要求・仕様を添える)。**承認は一括** (差分更新はインプレースなので、課題ごとに切り分けられない)。
   加えて載せる: **「決定と違う反映」** (課題ごとに決定・反映・理由。無ければ「なし」。違いを戻すなら「直す点」で 2 から。0.1.28 実走 L11)、
   **「仮に決めた反映」** (課題ごとに選んだ案・理由。無ければ「なし」。「決定と違う反映」と並べて載せる。違う案にするなら「直す点」で 2 から)、
   **「残った作業」** を種類ごとに載せ、1 件ずつ「**対応する / 無視**」で聞く (0.1.32 J2。「次の UC で拾う」は無い。UC への持ち越しはやめた):
   - `design` (画面の見本): 要求担当の報告の項目。項目のファイルは `docs/design/storybook-app/src/<相対パス>` で指す。報告が `packages/ui/<相対パス>` (取り込み先) で書いていたら `docs/design/storybook-app/src/<相対パス>` に読み替え、実在を確かめる。無ければ「対応づけられない」と出して派遣しない (人は無視を選ぶ)
   - `assumption` (前提の記録を閉じる): UC の slug・ティア・attempt・`A-xxx` の id と、閉じる決定の要点。項目に slug か attempt が無ければ (既存の持ち越しは「frontend の A-004」のようにしか書いていない)、d2-run が候補を列挙して載せる:
     `grep -l "id: A-xxx" .distillery/runs/*/attempt-*/assumptions.<tier>.yaml` で id を持つ (slug, attempt) の組をすべて出し、1 件なら確定、複数なら確認ページで人に選ばせる (同じ id が別の UC・別の attempt にあるので推測しない)。候補が 0 件か人が選ばなければ「無視」(報告に「特定できなかった項目」として残す)。
     1 つの項目に複数の id (例「A-004 / A-005 / A-006」) があれば **id ごとに分けて**候補を列挙し、id ごとの選択から `targets` の要素を 1 つずつ組む (id ごとに attempt が違ってよい)
   - 既存の持ち越し (1 で控えた `carry_over_rows` と `carry_over_pending` の `items`) も同じ一覧に載せる (種類は人が `design` / `assumption` / 無視 を選ぶ。`assumption` の候補は上と同じに列挙する。黙って失わない)
   問い: 「この差分で進めてよいか / 直す点 / 外す課題 / 残った作業ごとに対応するか無視か」。直す点は指摘を input に足して 2 から。
   外す課題があれば、変更を捨てて (`git checkout -- docs/requirements` と `git clean -fd -- docs/requirements`) その課題を除いて 2 から。外した課題は「取り下げる / 残す」を聞く。
   残す課題は理由をファイルに書いて `feedbackBatch.js hold <issue> --reason-file <ファイル>` (止まった印を付ける。止まった課題だけでは要求の差分を始めない)
4. 承認されたら、まず「対応する」残った作業を種類ごとの宛先に流す (0.1.32 J2):
   - `design`: sub `d2-design mode=feedback items=<項目のファイル (docs/design/storybook-app/src/<相対パス>。stories も部品も) と直す内容を 1 行ずつ>` (派遣表「① 要求の差分 (画面部品)」。項目が部品なら、報告の「影響する Story」(その部品から import を Story まで辿った一覧) を完了報告に転記する。0.1.32 実走 P11)。受理の条件: 報告に `npx storybook build` が通ったこと、
     d2-run が回す `node <skills>/d2-design/scripts/validateScreens.js docs/design/screens.yaml --app docs/design/storybook-app/src --use-cases docs/requirements/use-cases.yaml` が exit 0 (Story を消したときの `screens.yaml` の参照漏れを拾う)、write-set (`docs/design/**`) の外が変わっていない、
     **項目がすべて「直した」** (報告に「直せない (理由)」が 1 件でもあれば受理せず、変更を捨てて (`git checkout -- docs/design` と `git clean -fd -- docs/design`) 止まって報告する。人が項目を直すか「無視」に変えて 3 からやり直す。既存の持ち越しは再生成で消えるので、黙って先へ進まない。差分レビュー 3 ラウンド目)。
     受理後に `node <skills>/d2-foundation/scripts/importUi.js --from docs/design/storybook-app --cwd .` で `packages/ui/**` に取り込み直す (前回の一覧にあって消えたファイルは消える)。
     続けて、配送済み UC (`status: done`) のうち `tiers` に frontend を含むものごとに `runGates.js --uc <slug> --tiers frontend --only unit` を回す (取り込んだ部品を使う既存 UC の回帰)。落ちたら止まって報告する (design の差し戻し。commit しない)
   - `assumption`: 対象の UC の run (main) に `node runState.js event .distillery/runs/<slug> assumption_resolved --data-file <json>` を追記する。JSON は `{"targets": [{"tier": "<tier>", "attempt": <n>, "id": "A-xxx"}], "decision": "<要求の差分の決定の要点>", "by": "req: feedback"}`
     (`runState.js` が各 target を `attempt-<n>/assumptions.<tier>.yaml` で確かめ、無い組は拒む。最新でない attempt の前提も閉じられる。AssumptionRecord の yaml は変えない)
   - 既存の持ち越しを流したら、`carry_over_pending` の run には `node runState.js event .distillery/runs/<slug> carry_over_migrated --data-file <json>` (`{"items": [...], "to": "req: feedback"}`) を追記する (再び移行の対象にしない)。`use-cases.yaml` の `carry_over` の行は 2 の再生成 (要求担当の差分更新か `genUseCases.js`) で消える
   次に、1 で控えた `carry_over_rows` が空でなく `use-cases.yaml` に `carry_over` の行が残っていれば (要求担当を派遣したが再生成しなかった) `node <skills>/d2-requirements/scripts/genUseCases.js` を回す (決定論の再生成。`carry_over` の行が消える。他の変更は無い。0.1.32 実走 P18)。
   反映した課題ファイルと取り下げた課題ファイルを `git rm` し、genDocsReadme → `git add -A -- docs packages/ui .distillery/runs` (`packages/ui` は design の作業があったときだけ。無いパスを名指ししない) → 本文ファイル (`.distillery/logs/req-feedback-<ts>.txt`。1 行目 `req: feedback`、空行、trailer) を書いて `git commit -F <本文ファイル>` (配送 3 と同じ書き方)。
   trailer は反映した課題ごとに `Feedback-Consumed: docs/feedback/<issue>.md`、取り下げた課題ごとに `Feedback-Dismissed: docs/feedback/<issue>.md`、最後に attribution 行 (git-delivery.md「commit の attribution」)。remote があれば push
5. 反映・取り下げた課題の `from_uc` が要求で止まった UC (自動選択の 2 の判定) なら、その feature を `git update-ref refs/distillery2/abandoned/<slug>/<ts> feature/<slug>` で退避してから `git branch -D feature/<slug>`。
   次にその UC を回すと main から新しい run で始まる (feature の上の run は main に無い。要求が変わったのでシナリオからやり直す)
6. 決定・契約への波及は `node <skills>/d2-common/scripts/lib/basis.js check <対象ファイル…> requirements=docs/requirements adr=docs/adr contracts=contracts` で見つける。
   対象ファイルは存在するものだけ: `docs/adr/[0-9]*.md` (決定の本文。`_review-summary.md` と `index.md` は生成物なので渡さない。渡すと STALE に出る。0.1.32 実走 P13)、`docs/adr/architecture.md`、`docs/as-built/*/*/index.md` (as-built がまだ無ければ省く。無いパスを渡すと読み込みで落ちる)。
   STALE は完了報告に載せるだけで、自動では追随しない (as-built はその UC を次に回したときに作り直す)。
   閉じた前提 (`assumption_resolved`) も同じ: 完了報告に「閉じた前提 (UC・ティア・attempt・id) と、as-built は次にその UC を回したときに反映 (最新でない attempt の前提は as-built に出ない)」を書く
7. 自動選択の 3 の 2〜5 をやり直す (移行 → 途中の還流 → 要求の差分 → 還流)。還流が要らなければ完了報告して終了する。**同じ起動で次の UC (3 の 6) には進まない**

## ② 決定

1. sub `d2-decide` を派遣する
2. `docs/adr/_review-summary.md` を材料に確認ページ (非機能グレード表の要点、各決定と却下した案、confidence: low の決定は選択肢として提示)
3. 承認されたら `node <skills>/d2-common/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add docs && git commit -m "decide: nfr and adr" -m "<attribution 行>"`。選択が変わった決定は ADR を直して (sub に戻す) 再提示

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
4. 仕上げの前に、契約の骨格と画面部品だけを先に commit する: `git add contracts docs/design && git commit -m "foundation: contracts and design" -m "<attribution 行>"`
   (`docs/design` が無ければ `contracts` だけ。変更が無ければ飛ばす)。仕上げが作る config・C4 図・画面部品の取り込み記録は、
   入力を最後に commit した commit を basis に記録する。未 commit のままだと basis が空になり、契約や画面が変わっても古さを検出できない (0.1.22 の試し運転)
5. `.distillery/runs/bootstrap/reports/gates.json` があれば消してから、sub `d2-foundation phase=finish ui=<true|false>` (F8→F6→F7→F4→F9)。
   受理時の検査: `.distillery/runs/bootstrap/reports/gates.json` があり、`uc` が `bootstrap`、`result` が `pass`、`gates` (`{name, status}` の配列) のうち `name` が `static` の要素の `status` が `pass` (読むだけ。runGates を回し直さない)。加えて `node <skills>/d2-contract/scripts/genContractTests.js contracts --config .distillery/config.yaml --out-root . --check` が exit 0 (骨格分の契約テストが今の契約から生成済み。static のゲートは契約テストの生成を見ないため)。
   満たさなければ報告を添えて人に見せ、先へ進まない
6. `.distillery/config.yaml` の tiers / contracts / commands / capabilities を確認ページで人に見せ、承認後に `node <skills>/d2-common/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add -A && git commit -m "foundation: rules, tests, config" -m "<attribution 行>"`
   (差し戻しで契約の骨格や design をやり直したら、4 から繰り返す)

## ④ UC の縦切り

`<run>` = `.distillery/runs/<slug>`。`node runState.js open . <slug>` で開き、`node runState.js status <run>` で次の段階を決める。
開いた直後に、起動シーケンス 2 で解決したモデル名を記録する (as-built の生成情報とトークン集計で「どのモデルで実行したか」を示すため)。再開時は、run の `models_resolved` に同じ ID が記録済みなら記録しない (別名しか無いときだけ解決済みの ID で記録し直す。0.1.30 実走 N2)。
ただし squash 済みで配送の done が無い再開 (`merge=hold` で止めた後など) では、記録を配送の 6 まで遅らせ、配送の done と同じ commit に含める
(追跡ファイルの `events.jsonl` が変わると feature が clean でなくなり、main へ取り込めない):
`node runState.js event <run> models_resolved '{"session":"<このセッションのモデル名>","implementer":"<実装者の解決名>","verifier":"<Verifier の解決名>"}'`
値は **モデル ID だけ** (例 `claude-opus-4-7`)。別名の説明や注記を混ぜない (as-built の生成情報にそのまま出る。0.1.10 実走 ④-12)。
Agent ツールの別名 (`opus` 等) の解決先が分かっていれば (ハーネスの指示、過去の run の `models_resolved`、Verifier の報告) 最初から ID で書く (0.1.32 実走 P17)。分からないときだけ別名のまま書き、verify 段で Verifier の報告 1 行目 `model: <ID>` を得たら
同じイベントを解決済みの ID で記録し直す (最後の models_resolved が有効)。
再開時や配送 6 で記録するときは、run の `models_resolved` に解決済みの ID があればそれを流用し、別名で記録し直さない (0.1.28 実走 L2)。
各段階の done を書いたら `impl(<slug>): <stage>` で commit する (attribution 行を付ける。git-delivery.md「commit の attribution」)。
`runState.js done` / `event` の data は argv の JSON で渡す。長い JSON (日本語の一覧など) は `.distillery/logs/<name>.json` に書いて `--data-file <ファイル>` で渡す (argv と排他。0.1.32 O18)。
要求の差分で残った作業は ④ に持ち込まない (0.1.30〜0.1.31 の `carry_over` の派遣文への追記と done への対応状況の記録は 0.1.32 でやめた。残った作業は要求の差分が種類ごとの宛先に流す)。

| 段階 | すること | done の条件 |
|---|---|---|
| **scenario** | branch `feature/<slug>` を切る (git-delivery.md)。sub `d2-implement mode=scenario`。`node <skills>/d2-implement/scripts/checkScenario.js features/<業務>/<slug>.feature --use-cases docs/requirements/use-cases.yaml --requirements docs/requirements/requirements.yaml --uc <slug> --acceptance-dir features/acceptance` を回し、結果 (JSON 1 行。`ok` / `missing` / `covered` / `unknown_tags` / `errors`。0.1.32 実走 P15) を読む。**`missing` (対応づかない受入基準) があれば ok の前に分岐する** (`missing` があると `ok: false` で exit 1): 執筆役の報告がそれを**他 UC の振る舞い**と判断していれば、**要求の課題にして止まる** (0.1.32 J1): 執筆役が `<run>/issues/` に書いた下書き (`kind: requirement`。無ければ d2-run が書く: 対応づかない受入基準と、どの UC の振る舞いか、「仕様を UC 単位に分ける」) を還流節「課題ファイル」の「要求を直す」のコマンド列どおりに課題ファイルにして main に入れ (一時の worktree。人レビュー 4 と同じ手順)、`feedback_filed {kind, ref, issue_path}` (file-issues が記録する) と `blocked_on_requirement {stage: scenario}` を記録してから、feature の上で下書きと `<run>` (イベントを含む) を `git add -A -- features .distillery/runs/<slug>` して `impl(<slug>): scenario (blocked)` で 1 回の commit に入れて停止する (記録 → commit の順。次の起動は `git show feature/<slug>:.distillery/runs/<slug>/events.jsonl` で止まった状態を読む。scenario は done にしない。次の起動で要求の差分が仕様を UC 単位に分け、この feature を退避する。UC は main から新しい run でやり直す)。執筆役が「この UC の振る舞い」と判断していれば (書き漏れ) 執筆役に差し戻す。`missing` が無く ok なら human-html-review でシナリオを確認 (問い: この振る舞いで合っているか)。承認を `node runState.js scenario-approve <run> --feature features/<業務>/<slug>.feature --acceptance-dir features/acceptance` で記録する (feature の bytes の sha256 と、`@uc:<slug>` を持つ受入 feature の sha256 を計算して `scenario_approved {feature, feature_sha256, acceptance: {<path>: <sha256>}}` を書く。受入の feature が無ければ `acceptance: {}`。進行役が自分で計算しない。0.1.32 O14・実走 P16)。次に `node runState.js done <run> scenario '{"feature": "<path>"}'`、`node <skills>/d2-common/scripts/genDocsReadme.js` で README のシナリオ列を更新して `git add docs features .distillery/runs/<slug> && git commit -m "req(<slug>): scenarios" -m "<attribution 行>"` | 承認済み |
| **contract** | sub `d2-contract mode=uc uc=<slug>`。`compileContracts.js contracts --check`、`compileRdbSchema.js contracts --check`、`validateUcIndex.js contracts` が exit 0。examples 不足で止まったら issue を確認ページで見せ、契約を補うか要求に戻すかを選ばせる。受理時に `node <skills>/d2-contract/scripts/classifyContractChanges.js --uc <slug> --json` で変わった契約の生成物を own / other_uc / shared に分け、結果を done の `contract_changes` に書く (契約は UC 間で共有するので、enum の追加などで他 UC のテストや共有の型も書き換わる。0.1.16 実走) | slice と契約テストが生成済み、`contract_changes` 記録済み |
| **scaffold** | sub `d2-implement mode=scaffold`。受理時に既存の非テストファイルを変えていないことを確かめる (subagent-template.md「受理時の検査」)。`runGates.js --uc <slug> --tiers <関与ティア> --only unit --expect-red unit` が exit 0、dry-run で undefined step 0 | red baseline |
| **tier** | attempt = `currentAttempt`。関与ティア (下記「関与ティアの決め方」) ごとに sub `d2-implement mode=tier` を**同じメッセージで並列派遣** (model = implementer)。実装者は runGates を使わず commands を直接回す (記録なし)。受理時に `validateAssumptions.js record` を全ティアで実行し、全ティアの受理後に**自分が 1 回だけ** `runGates.js --uc <slug> --tiers <関与ティア> --upto unit` を回す (記録の単一 writer。runGates は gates.json をゲート名単位で置き換えるので、並列の実装者に回させると互いの記録を消す)。落ちたティアは同じ attempt のまま再派遣する | 全ティアの assumptions が ok、上の runGates で static / unit が pass |
| **contract-gate** | `runGates.js --uc <slug> --tiers <関与ティア> --upto contract`。落ちたら提供側ティアだけ attempt++ で tier に戻る (他ティアはそのまま) | contract まで pass |
| **integrate** | sub `d2-implement mode=integrate`。続けて `node <skills>/d2-foundation/scripts/genQlty.js --refresh --cwd .` (実装で増えたファイル種別に対する qlty の提案を足す。追加した plugins を報告に書く)。`runGates.js --uc <slug> --tiers <関与ティア> --from static` (増えた plugins の指摘は static に出る。落ちたら報告の分析に従い該当ティアを attempt++ で tier に戻る。verify / review / as-built はこの後なので、直した実装も検証と記録の対象になる)。attempt ≥ 2 (差し戻しの後) も sub は**必ず派遣**する (ティアの入口や注入対象が変わっていれば結線の更新が要る)。sub が「結線の変更は不要」と判断し、integrate.md の完了条件 (runGates `--from uc-bdd`、受入の網羅、計装範囲の `extractAsBuilt --dry-run`) を満たしたと報告すれば、`features/` に差分が無くても done にしてよい。done に `wiring_changed: false` を書く。**他 UC への回帰は d2-run が回す** (0.1.32 O15): 受理して done を書き `impl(<slug>): integrate` で commit した後、`git diff --name-only <base_head>..HEAD -- features/support features/step_definitions` (commit 済みの変更だけを見るので、commit の前に回さない) に変更があれば、配送済み UC (`status: done`) ごとに `runGates.js --uc <他 slug> --only uc-bdd` を回し (他 UC の `<run>/traces/**` と `<run>/reports/**` は d2-run の runGates が書く。gitignore。as-built はその UC を次に回したときに作り直す)、落ちたら報告の分析に従い該当ティアを attempt++ で tier に戻る (integrate の write-set は自分の UC の reports / traces だけなので、実装者には回させない) | static から acceptance まで pass、共有の補助を変えたなら配送済み UC の uc-bdd も pass |
| **verify** | ティアごとに sub `d2-verify` を**同じメッセージで並列派遣** (agent_type `distillery2:d2-verifier`、model = verifier、変更ファイル一覧のファイルのパスと実装者の固定指示のパス (`<skills>/d2-implement/references/tier-impl.md` の絶対パス。前提の照合先) を渡す)。変更ファイル一覧と「他 UC と共有する変更ファイル」の初期候補は**常に** `.distillery/logs/verify-<slug>-attempt-<n>.txt` (gitignore) に書いてパスで渡す (件数で渡し方を変えない。0.1.32 O16): 変更ファイル = `git diff --name-only <base_head>..HEAD` から `docs/README.md`・`docs/requirements/use-cases.yaml`・`docs/feedback/**` (どの UC も書く簿記のファイル) を除いたもの。初期候補 = 変更ファイルと `docs/as-built/_system/traceability-index.json` の `ucs[<他の slug>].files` の共通部分 (他 UC の slug つき。追跡表が無ければ「なし」)。追跡表の files は各 UC が**変更した**ファイルなので、基盤から在る共通コードは拾えない。Verifier が import 元を辿って足す (viewpoints.md「他 UC への波及」)。受理時に `validateAssumptions.js verdicts`。報告 1 行目の `model: <ID>` が models_resolved.verifier と違えば models_resolved を記録し直す。blocker があれば該当ティアを attempt++ で tier に戻る (最大 3 回。超えたら人に報告して停止) | 全ティアの findings が ok で blocker 0 |
| **review** | 下記「人レビュー」 | `review_approved` 記録済み |
| **asbuilt** | `<run>/reports/asbuilt.json` があれば消してから (再開・差し戻しの後に前回の集計で受理しないため)、sub `d2-asbuilt` を派遣する (依存グラフの実態 → `extractAsBuilt.js` の抽出 → 要約 → `checkAsBuilt.js` の検査まで、要約役が通しで行う)。受理時の検査 (読むだけ): `node <skills>/d2-asbuilt/scripts/checkAsBuilt.js docs/as-built/<業務>/<UC>/index.md` が exit 0、かつ `<run>/reports/asbuilt.json` があり、`slug` が今回の UC、`attempt` が `runState.js status` の attempt と一致する。さらに要約役の完了報告 (要約した 3 ブロックと引用したコード位置) が届いている (抽出は前回の要約を残すので、成果物だけでは今回の要約を区別できない。subagent-template.md の例外)。どれかを満たさなければ d2-asbuilt に差し戻す。集計の `instrumentation_gaps` (計装なしのティア) か `instrumentation_happy_gaps` (正常系に部品 (call) が無いティア) が空でなければ integrate の結線漏れ: asbuilt を done にせず integrate へ戻して結線を足す (図に出ないティア・部品は as-built の価値を落とす。要約役の報告文ではなく集計ファイルで判断する)。戻し方: `node runState.js return-to-integrate <run> '{"instrumentation_gaps":[...],"instrumentation_happy_gaps":[...]}'` を 1 回だけ実行し、commit する (同じ attempt の Verifier の結果 `findings.<tier>.yaml` を `<run>/invalidated/<ts>_attempt-<n>_findings.<tier>.yaml` へ移し、integrate 以降の done (verify・review を含む) をまとめて退避し、`returned_to_integrate {from, instrumentation_gaps, instrumentation_happy_gaps, moved_findings}` を記録する。findings を先に移すので、途中で止まっても再検証の前の結果は残らない。再開したら同じ判断からもう一度実行してよい)。attempt は上げない (計装の結線は integrate の担当で、ティアのコードは変えない)。integrate の派遣文に集計の 2 つの一覧を添える。verify と review もやり直す (結線を変えるとゲートの結果と承認の根拠が変わる)。受理したら `node <skills>/d2-common/scripts/genDocsReadme.js` (docs/README.md の UC 一覧に実装の記録を載せる。リンク切れなら exit 1)。commit。depcruise が失敗/未実行でも extractAsBuilt は config から「決定からの図」を描く (空にならない) | as-built が生成済み、集計の計装なし / 正常系に部品なしのティアが空 |
| **deliver** | 下記「配送」。UC の課題を課題ファイルにし、squash して main へ ff merge し、main の上で配送の done を commit する (PR を作らない)。UC はここで終わる (課題は次の UC の前の還流がまとめて直す) | `stages/deliver.done.yaml` が main にあり、`runState.js status` の `unfiled_issues` が空 |

verify と review の前提: `reports/gates.json` が `all_recorded: true` で全段 pass。部分実行の後は
`runGates.js --uc <slug> --tiers <関与ティア>` で 1 回通し、全段の証跡を揃えてから verify に進む
(`--tiers` を省くと config の全ティアに unit が走り、UC に関与しないティア (テスト 0 件) で落ちる。0.1.13 の実走で worker が落ちた)。

**ゲートの回し直し**: 記録付きのゲート (runGates) が落ちたら、コードも commit も変えずに同じコマンドを **1 回だけ**回し直してよい (順番や並列に左右される不安定なテストの切り分け。0.1.29 実走 M5)。
回し直す前に 1 回目の `<run>/reports/gates.json` を `<run>/reports/gates.failed-1.json` に写す (runGates は回し直した段を上書きするので、1 回目の `failed_tests` が消える)。
回し直して通ったら、完了報告に 1 回目に落ちたゲートとテスト名 (写しの `failed_tests`) を書く。2 回目も落ちたら落ちた扱い (推測で直さない・課題を外さない)。3 回目は回さない。
落ちた内容は出力をファイルに保存せず (headless では保存が拒まれる) gates.json の job の `output_tail` と `failed_tests` で読む (0.1.29 実走 M1・M6)。

attempt++ のとき: 戻すティアの `tier` 以降の done を `runState.js invalidate` で退避し、`attemptDir(n+1)` を作り、
前 attempt の findings パスを tier の派遣に渡す。戻さないティアの assumptions は新 attempt に複製し (carry-forward)、
複製したファイルの `attempt` フィールドを新しい番号に書き換える (hash の対象外なので値は変わらない)。複製後に全ティアで
`validateAssumptions.js record --attempt <n+1>` を再実行して ok を確認してから verify に進む。

**関与ティアの決め方** (scaffold / tier / contract-gate / integrate / 全段の証跡の `--tiers` と派遣先に使う。正は 1 か所。`--tiers` にはカンマ区切りで渡す。例 `--tiers frontend,backend-api`。0.1.28 実走 L9):
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
   - 「要求を直す」があれば `issues/` に下書き (`kind: requirement`) を書き、**その場で**課題ファイルにして main に入れる (還流節「課題ファイル」の「要求を直す」のコマンド列。
     UC は配送しないので、feature ではなく一時の worktree から main へ入れる)。`feedback_filed {kind, ref, issue_path}` と `blocked_on_requirement {stage: review}` を記録し、commit して停止する
     (review は done にしない。次の起動で要求の差分が課題を反映し、この feature を退避する。UC は main から新しい run でやり直す)
   - 承認なら、全ティアの `record` / `verdicts` を再実行して hash が一致することを確認してから
     `review_approved {assumption_decisions[], assumption_evidence_sha256, gates_result}` を記録する。不一致なら承認を記録せず verify から再実行
5. 回答は `events.jsonl` にだけ記録する (review-notes ファイルは持たない)

## 配送 (deliver 段階)

手順の git の約束は [references/git-delivery.md](references/git-delivery.md)。

1. 配送 1 は 3 つの作業をこの順で行う (0.1.32 N1・O4):
   1. **件名の検査** (最初に): `git log <base_head>..HEAD --format=%s` がすべて `impl(<slug>): ` か `req(<slug>): ` で始まる。そうでなければ UC 外の commit が混ざっているので、gates.json の作り直しも課題ファイルの commit もせず止まって報告する (混ざった commit の一覧を添える。0.1.29 実走 M3)。
      止まった後は人が混入した commit を落とし (rebase)、再開は配送 1 から (git-delivery.md「squash」1)
   2. **gates.json の作り直し**: `reports/gates.json` が**無ければ作り直す** (gitignore なので再開で消えていることがある。比較はしない)。あれば **古い**かを**時刻として**比べる: feature の先頭の commit の committer 日時 `git log -1 --format=%cI` (rebase や cherry-pick で更新される) が gates.json の `finished_at` より後なら古い (文字列で比べない。`%cI` は時差付き、`finished_at` は UTC `Z` なので `node -e "console.log(new Date('<%cI>') > new Date('<finished_at>'))"` で比べる。0.1.32 実走 P2)。無いか古ければ `runGates.js --uc <slug> --tiers <use-cases.yaml の tiers>` で全段を 1 回通して記録を作り直す (0.1.32 N5)。
      作り直しの runGates が落ちたら、**推測で直さず止まって報告する** (0.1.32 実走 P1)。報告に添えるもの: 落ちたゲート名と job (`gates.json` の `output_tail` / `failed_tests`)、指摘の対象ファイルが UC の変更 (`git diff --name-only <base_head>..HEAD`) に含まれるか。含まれなければ「UC と無関係の可能性 (依存の脆弱性情報の更新など。コードを変えていなくても落ちる)」と書く。
      人が直すときは **feature の上で** (依存の更新、または `.qlty/qlty.toml` の `[[ignore]] rules = ["<plugin>:<id>"]`) 件名 `impl(<slug>): <内容>` で commit し、配送 1 から再開する (gates.json はこの 2 の「古い」判定で作り直される)。main で直して feature を rebase しない (`base_head` は開始時の記録のまま更新されないので、main 側の修正 commit が `<base_head>..HEAD` に入り、1 の件名の検査で止まる。通っても squash がその修正を UC の 1 commit に畳む)
   3. **条件の確認**: `review_approved` が有効 (= `runState.js status` で review が done、かつ events で最後の `review_approved` より後に `stage_invalidated {stage: review}` も `review_rejected` も無い。0.1.32 実走 P5)、`reports/gates.json` が `all_recorded: true` で全段 pass、findings の open blocker 0。
      次に feature の上で `node <skills>/d2-common/scripts/feedbackBatch.js file-issues <run> --cwd <リポのルート>` を回し、UC の課題 (`issues/*.md`) を課題ファイル `docs/feedback/<issue>.md` にする (`feedback_filed` も記録する)。
      `runState.js status` の `unfiled_issues` が空であることを確かめる。結果の `filed` が空でなければ `genDocsReadme.js` を回し、`git add -A -- docs .distillery/runs/<slug>` して `impl(<slug>): issues to feedback` で commit する (squash で UC の 1 commit に入る。main に別の commit を足さない)。
      `filed` が空 (課題 0 件) なら commit を作らない (`docs/feedback/` が無いことがあり、パスを名指しすると `git add` が落ちる)
2. remote `origin` があれば `git fetch origin` し、`origin/main` が `main` の祖先か同じ (`git merge-base --is-ancestor origin/main main`) であることを確かめる。
   そうでなければ止まって報告する (他の人が main を進めた。rebase は人が判断)
3. 件名は 1 で検査済み → 復旧用 ref (`refs/distillery2/pre-squash/<slug>/<timestamp>`。`<timestamp>` は `date -u +%Y%m%dT%H%M%SZ`。0.1.32 O3) → `git reset --soft <base_head>` →
   `use-cases.yaml` の該当行を `status: done` にする (0.1.30〜0.1.31 の `carry_over` の持ち越しは 0.1.32 でやめた。`review_approved` に `carry_over.carry` が残る run (0.1.30 形式) でも読まずに配送し、完了報告に「持ち越し N 件は次の起動で要求の差分に載る」と書く。配送後の起動の自動選択 3 の 4 が `carry_over_pending` で拾う) → stage → prTrailers で本文 → `git commit -F <本文>` (exactly 1 commit)。
   手順の詳細は git-delivery.md「squash」
4. 引数が `merge=hold` なら、ここで止めて報告する (引数なしで再開すれば 5 から)
5. `git switch main` → `git merge --ff-only feature/<slug>`。ff できなければ (main が `base_head` から進んでいる) 止まって報告する
6. main の上で、④ の冒頭で遅らせた場合だけ `models_resolved` を記録し (遅らせた = run の events に解決済み ID の `models_resolved` が無い。冒頭で記録済みなら記録しない。0.1.29 実走 M2・0.1.32 O1)、`genDocsReadme.js` で `docs/README.md` を更新し (UC 一覧の状態列が `status: done` を見て「配送済み」になる。0.1.32 実走 P6)、
   `node runState.js done <run> deliver '{"squash":"<squash commit のフル sha (git rev-parse HEAD)>","base_head":"<base_head>"}'` を実行して、`git add -A -- docs .distillery/runs/<slug>` (配送の done・events・README・課題一覧の README。新規と削除を含む。`docs/feedback/` は無いことがあるので名指ししない) してから
   まとめて `impl(<slug>): delivered` で commit する (配送済みの正は `stages/deliver.done.yaml`)
7. remote `origin` があれば `git push origin main`。拒否されたら止まって報告する (force push はしない。再開すると起動シーケンス 4 でやり直す)
8. `git branch -d feature/<slug>`

再開 (配送の done が無いとき): feature が `base_head` から 1 commit で、その commit が main に含まれていなければ 4 から (squash 済み)。含まれていれば 6 から。

**旧形式の run** (0.1.25 まで。還流の done があり配送の done が無い。`runState.js status` の `legacy_order: true`): 次の段階は出ない。
確認ページで人に聞く (問い: この UC は配送済み (PR が merge 済み) か)。「配送済み」なら **main に切り替えて** (`git switch main`。remote `origin` があれば `git pull --ff-only origin main` で
PR の merge を取り込む)、main 上の run に `node runState.js mark-legacy-delivered <run>` で配送の done (`legacy: true`) を作り (起票されていない課題があれば、旧形式の還流の done も退避される。結果の `feedback_reopened`)、
`impl(<slug>): legacy delivered` で main に commit する。`feature/<slug>` が残っていれば `git update-ref refs/distillery2/legacy/<slug>/<ts> feature/<slug>` で退避してから `git branch -D feature/<slug>` (`<ts>` は `date -u +%Y%m%dT%H%M%SZ`。0.1.32 O3)
(squash merge で入れた feature は main の祖先でないことがあり `-d` では消せないので、常に退避してから `-D`。残すと自動選択の 2 が進行中の UC とみなして毎回戻る)。その後は自動選択の 3 からやり直す (移行 → 判定。commit と削除の間で止まっても、次の起動の自動選択 2 が片付ける)
(PR は squash merge されていて feature とは別の履歴なので、feature に commit しても main に載らない)。main 上の run が旧形式でなければ (PR の merge がまだ取り込めていない) 止まって報告する。「まだ」なら `node runState.js invalidate <run> feedback <理由>` で還流の done を退避し、`impl(<slug>): reorder stages` で commit して、新しい順で配送から続ける (旧形式で起票済みでない課題は還流で処理し直す)。
旧形式の還流の記録 (`feedback_filed` の `url`) は起票済みとして数える。

## 還流 (独立した段階)

UC の外の段階。溜まった課題ファイル (`docs/feedback/`) のうちルール・契約の課題を、**まとめて 1 回で**直して main へ取り込む。自動選択の 3 か `stage=feedback` で入る。
**上流の文書 (ADR・契約) は自分で書き換えない**。持ち主のスキルを worktree で派遣し、git の状態遷移は `feedbackBatch.js` に任せる (自分で worktree・branch・cherry-pick・merge を組まない)。
自分が行うのは、派遣・受理の検査・ゲート・確認ページだけ。PR / issue は作らない。

| kind | 誰が直すか | 行き先 |
|---|---|---|
| rule | d2-decide `mode=feedback` (ADR を 1 本足す) | 番号付きの ADR を課題ごとに commit。開発ルールとアーキテストは最後に feedbackBatch がまとめて作り直す |
| contract | d2-contract `mode=feedback` (分割ファイルを直す) | 分割ファイルを課題ごとに commit。契約の生成物は最後にまとめて作り直す |
| requirement | 人 (要求の差分) | 還流では扱わない (① の「要求の差分」が読む) |
| plugin | 人 (distillery2 のリポジトリで直す) | 還流では扱わない。還流で「直す場所がプラグイン側」と分かった課題を `FB reclassify` がこの種類にする (下の「止まったとき」)。対象リポジトリには残り、プラグインを直した人が消す |

`<b>` = バッチ (branch `feedback/<b>`)。`<wt>` = `.distillery/worktrees/feedback` (gitignore)。`<fb>` = `.distillery/logs/feedback/<b>` (gitignore)。
`FB` = `node <skills>/d2-common/scripts/feedbackBatch.js --cwd <リポのルート>` (サブコマンドは `FB` の直後)。どのサブコマンドも JSON 1 行を返す。終了コードが 0 でなければ JSON の `error` を報告して止まる (3 と 4 は 11 の扱い)。
受理のスクリプトは持ち主のスキルのもの: `<skills>/d2-decide/scripts/validateAdr.js`、
`<skills>/d2-contract/scripts/{compileContracts,compileRdbSchema,validateUcIndex,genContractTests,genRdbDdl}.js`。

1. **前提**: 進行中の UC が無い (自動選択の 2)、作業 branch が clean な main、`FB scan` の `unfiled_runs` が空 (移行は自動選択の 3 の 2 で済ませる)
2. (0.1.28 で移行を自動選択の 3 の 2 へ移した。番号は据え置き)
3. **再開の判定**: `FB status` の `point` で続きを決める

   | point | 続き |
   |---|---|
   | `none` | 4 |
   | `issues` | 5 (`pending` と `needs_static` の課題から。`needs_static` は 5 の 4 から。`worktree_dirty` なら先に `FB discard`) |
   | `gate` | 7 (`confirm: true` なら 8 から) |
   | `rebuild` | 9 |
   | `merge` | 10 |
   | `cleanup` | 11 の `FB merge` (取り込み済み。push と後始末だけ行う) |
   | `broken` | `.distillery/worktrees/feedback` だけがあり branch が無いとき (`error` が「worktree だけがあり branch が無い」): `git -C <wt> status --porcelain` に出力が無く `git -C <wt> log main..HEAD --oneline` も空 (中身の無い残骸。準備のコピー元に由来することがある。0.1.30 実走 N6) なら、そのディレクトリを消して `git worktree prune` し、`FB status` が `none` になれば 4 から。差分か commit があれば消さずに止まって報告する。それ以外の `broken` も止まって報告 |

4. **切り出し**: `FB start --co-author "<attribution の値>"` (main から worktree と branch を作り、node_modules を symlink する。`--co-author` は batch に残り、還流の全 commit に `Co-Authored-By:` の trailer として付く。git-delivery.md「commit の attribution」)。`started: false` (対象の課題が無い) なら終わり。返った `issues` の順に 5 を回す (rule が先)
5. **課題ごとに** (1 件ずつ、同じ worktree で):
   1. `git -C <wt> status --porcelain` が空であることを確かめる。`<fb>/<issue>.result.json` を消してから派遣する: rule は sub d2-decide `mode=feedback` (派遣表「還流 (ADR)」)、contract は sub d2-contract `mode=feedback` (派遣表「還流 (契約)」)。課題は `<wt>/docs/feedback/<issue>.md`
   2. 受理 (`<wt>` で): 結果ファイルが `applied` で、rule は `validateAdr.js docs/adr`、contract は `compileContracts.js contracts --check`、`compileRdbSchema.js contracts --check`、`validateUcIndex.js contracts`、
      `genContractTests.js contracts --config .distillery/config.yaml --out-root . --check`、`genRdbDdl.js contracts --config .distillery/config.yaml --out-root . --check` がすべて exit 0。write-set の外が変わっていない (`git -C <wt> status --porcelain`)。
      検査は 1 コマンドずつ回す (1 つの sh にまとめない。headless の許可で止まる。0.1.27・0.1.28 実走)。
      契約のスクリプトに `--cwd` は無いので、コマンドの実行ディレクトリを `<wt>` にして回す (`cd <wt> && node <skills>/d2-contract/scripts/compileContracts.js contracts --check` の形。リポのルートから回すと main の契約を検査してしまう。0.1.30 実走 N8)
   3. `FB commit-issue <issue>`: 原本 (rule は番号付きの ADR。索引は含めない。contract は分割ファイル) と課題ファイルの削除を 1 commit にする (trailer `Feedback-Consumed:`・`Feedback-Kind:`・`Feedback-From-UC:`)。
      `result` が `already-applied` (契約の分割ファイルに差分が無い。課題の指摘が既に main にある) なら次の課題へ (5 の 4・5 は飛ばす。static は回さず、派遣が作り直した生成物はスクリプトが捨てる (`discarded: true`)。確認ページにも載せるだけで聞かない)
   4. `FB regen` → `runGates.js --uc d2-feedback --only static` (`<wt>` で。全ティア)。通れば `FB record-static <issue>`
   5. `FB discard` (成功でも失敗でも、作り直した生成物を捨てる。生成物は 6 でまとめて作る)
   6. 1〜4 のどこかで止まったら (下の「止まったとき」): 理由を `<fb>/<issue>.reason.txt` に書き、`FB stop-issue <issue> --reason-file <fb>/<issue>.reason.txt` (差分を残し、課題の commit を落とし、worktree を clean にする)。次の課題へ進む (ほかの課題は巻き込まない)
6. **仕上げ**: `FB finalize` (原本全体の検査 → 止まった課題の書き足し → ADR の索引 → 生成物と README。最後の commit は必ず `feedback(<b>): regenerate`)。落ちたら (`output_tail` に検査の出力) 止まって報告する
7. **最後のゲート 1 回** (`<wt>` で。main を壊さないことを確かめる。main の CI は push の後にしか走らない): `runGates.js --uc d2-feedback --only static` (全ティア)。
   契約の課題を取り込んだときは加えて、**変えた契約を使う UC ごとに** `runGates.js --uc <その UC> --tiers <その UC の use-cases.yaml の tiers をカンマ区切りで。例 frontend,backend-api>` (全段: unit・contract・uc-bdd・acceptance)。
   変えた契約を使う UC = `FB finalize` (再開なら `FB status`) の `slices_changed` (main との差分で `contracts/generated/slices/<slug>/**` が変わった UC) のうち、`use-cases.yaml` で `status` が `done` の UC すべて
   (slice は UC ごとに契約から作り直すので、`info` などの共通部分を変えると全 UC の slice が変わり、全 UC を回す。0.1.28 実走 L7・0.1.29 実走 M7)。d2-contract の報告の「他の UC への影響」は照合の補助にだけ使い、`slices_changed` を狭めない。
   UC の `tiers` は実装済みでテストがあるティアなので、関与しないティアがテスト 0 件で落ちることはない。ルールの課題だけなら static だけ (ルールはコードを変えず、アーキテストだけが変わる)。
   落ちたら ④ の「ゲートの回し直し」のとおり、同じ branch の先頭で 1 回だけ回し直す (写しは `<wt>/.distillery/runs/<その UC か d2-feedback>/reports/gates.failed-1.json`。落ちた UC ごと)。
   結果を記録する (branch の先頭の sha と一緒に残る): 1 回目で全部通れば `FB record-gate --result pass` (`--detail` は付けない)。回し直して全部通れば `FB record-gate --result pass --retried --detail <1 回目の写しをカンマ区切りで>`。
   1 つでも 2 回目も落ちたら `FB record-gate --result fail --detail <落ちた runGates の gates.json をカンマ区切りで (<wt>/.distillery/runs/<その UC か d2-feedback>/reports/gates.json。複数の UC が落ちたら全部)>`
   (`--detail` は gates.json の落ちた段の落ちたテスト名と出力の末尾を要約する。出力をファイルに保存しない。0.1.29 実走 M1・M6)。落ちても原因を推測で課題を外さない (8 で人に見せる)
8. **確認ページ 1 回** (human-html-review)。次のどれかがあれば出す: 取り込む課題 (`commit-issue` の `result` が `committed`)、2 回目以上止まった課題 (課題ファイルの `stopped_count` が 1 以上で、今回も止まった)、ゲートの落ち。
   どれも無ければ (取り込み済みと 1 回目の停止だけ) 出さずに `FB decide --auto` で記録する (`merge=hold` で止めた後の再開で、ゲートを回し直さないため。取り込む候補か 2 回目以上止まった課題があれば `--auto` は拒まれる)。
   載せるもの: 課題ごとに直した内容の要点 (足した ADR・変えた契約)、contract なら他の UC への影響と回した UC (`slices_changed`) ごとのゲートの結果、止まった課題とその理由、取り込み済みの課題、プラグインへ持ち帰る課題 (`reclassify` した課題。載せるだけで聞かない)、
   ゲートの結果 (落ちていれば `FB status` の `gate.detail` から落ちたゲート・落ちたテスト名・出力の末尾を UC ごとに。回し直して通ったなら 1 回目に落ちたテスト名)、生成物の commit が 2 つ (ADR の索引 → ルールと契約の生成物) であること。
   問い: 取り込む課題ごとに「取り込む / 今回は外す / 取り下げる」(今回は外す = 止まった課題として次の還流で再挑戦。取り下げる = 直し方が要らないので課題ファイルを消す)、2 回目以上止まった課題ごとに「取り下げる / 残す」。ゲートが落ちていれば「すべて取り込む」は選べない (外すか取り下げる課題を選ぶか、バッチ全体を止める)。
   取り込む候補が無い (全部止まったか取り込み済み) のにゲートが落ちたときは、原因は課題ではない (main か生成物の作り直し) ので、回答を聞かずに止まって報告する (`FB decide` も拒む)。
   headless などの事前回答がこの問いで選べない回答 (ゲートが落ちたときの「すべて取り込む」など) なら、`FB decide` を記録せず止まって報告する (原則の項。0.1.29 実走 M4)。
   回答は `FB decide --take <課題,…> --drop <課題,…> --dismiss <課題,…>` (全体を止めるときは `FB decide --abandon`) で記録する。取り込む候補 (原本を commit した課題) はすべて `--take`・`--drop`・`--dismiss` のどれか一方に入れる (漏れ・重なりは拒まれる。転記漏れで人が選んでいない課題を取り込まないため)。`--dismiss` は止まった課題と取り込む候補だけ。外す課題も取り下げも無ければ 10 へ
9. **組み直し**: `FB rebuild` (main の先端から、取り込む課題の原本の commit を順に cherry-pick → 取り下げの削除 → 仕上げ。外した課題は「確認ページで外した」で止まった課題になる)。
   cherry-pick が衝突したら (exit 1、`conflict`) 止まって報告する (branch は組み直しの前に戻る)。承認し直しはしない (原本の commit の本文は変わらない)。7 へ戻る
10. 引数が `merge=hold` なら止めて報告する (worktree・branch・`<fb>` は残す。引数なしの再開で `FB status` が `merge` を返し、11 から)
11. **取り込み**: まず `FB status` を回し、その結果 (ゲートの記録 `gate`・回答 `decision`) と止まった課題の理由を完了報告用に控える (`FB merge` は `<fb>` と worktree を消す。止まった理由は取り込みの前は還流 branch の課題ファイル `<wt>/docs/feedback/*.md` に、取り込み済みの再開 (`cleanup`) なら main の課題ファイルにある)。
    次に `FB merge` (ゲートの通った記録が branch の先頭と一致しなければ拒む → remote があれば fetch して main を origin/main へ ff → `git merge --ff-only` → push → worktree と branch と `<fb>` を消す)。
    exit 3 (main が進み、還流 branch の祖先でない) → 9 の組み直し (リベース) → 7 → 11。
    exit 4 (push の拒否) → 止まって報告する (main は取り込み済み。force push はしない。人が remote との合わせ方を決めた後の再開で、`FB status` が `cleanup` を返す)

### 止まったとき

課題 1 件の止まり方 (5 の 6 で理由ファイルに書く)。成り立った理由は**すべて**並べ、それぞれの証拠を書く:

| 止まり方 | 理由ファイルに書くこと |
|---|---|
| 結果ファイルが `blocked` で `reason_kind` が `plugin` | **止めない**。直す場所がプラグイン側 (生成器・テンプレート・設定ファイルの生成・手順書) なので、結果ファイルの `reason` を理由ファイルに書いて `FB reclassify <issue> --reason-file <fb>/<issue>.reason.txt` (課題ファイルを `kind: plugin` に書き換えて commit。止まった印は外す。還流の対象から外れる)。次の課題へ |
| 結果ファイルが `applied` で分割ファイル (contract) に差分が無い | **止めない**。課題の指摘が既に main の契約にある。`FB commit-issue` が `already-applied` と判定する (d2-contract の規定どおり。5 の 3)。次の課題へ (0.1.30 実走 N11) |
| 結果ファイルが `blocked` (`reason_kind` が `scope` か無い) | 結果ファイルの `reason` |
| contract の結果ファイルが `absent` | 「対象の operation / message / table が main の契約に無い」+ `targets` |
| 受理の検査か課題ごとの static で落ちた | 落ちた検査・ゲートの名前と、出力の末尾 20 行 |
| write-set の外が変わった | 「派遣が書き込み範囲の外を変えた」+ はみ出したパス |
| 結果ファイルが無い | 「派遣の結果ファイルが無い」 |

止まった課題は、仕上げで課題ファイルに書き足されて main に残る (`stopped: true`・`stopped_count`・題名の頭に「止まった: 」・本文の先頭に止まった理由と差分の中身)。
確認ページで外した課題も同じ (理由「確認ページで外した」)。次の還流で再挑戦する。止まった課題だけでは還流を始めない (自動選択の 3)。

### 課題ファイル

- 置き場所: `docs/feedback/<issue>.md`。front matter は `kind`・`title`・`from_uc` (slug)・`status: open`・`created` (日時)、止まったら `stopped: true` と `stopped_count`。本文は課題の本文
- `kind: plugin` (プラグインへ持ち帰る課題。`kind_original` に元の種類): 還流の対象ではなく、自動選択のきっかけにもしない。対象リポジトリでは何もしない。distillery2 を直した後に人が `git rm` して commit する。完了報告に一覧を載せる (`scan` の `plugin`)
- UC の課題は配送のときに `feedbackBatch.js file-issues` が課題ファイルにする (squash の 1 commit に入る)
- **「要求を直す」のコマンド列** (review の人レビュー 4 と ④ scenario の「他 UC の振る舞い」で止まるとき。UC は配送しない。作業 branch は feature なので feature に混ぜない。0.1.32 実走 P7・P8)。`<root>` = リポのルートの絶対パス、`<wt>` = `<root>/.distillery/worktrees/<slug>/<issue>`:
  1. `git worktree add .distillery/worktrees/<slug>/<issue> -b feedback-req/<slug>/<issue> main` (一時の worktree を main から作る。`feedback/` は還流のバッチの名前なので使わない)
  2. `node <skills>/d2-common/scripts/feedbackBatch.js file-issues <root>/.distillery/runs/<slug> --cwd <wt>` (**run は feature の作業ツリー上の絶対パスで渡す**。相対パスだと `--cwd` の worktree の中を見て `filed: []` で空振りする。課題ファイルは `<wt>/docs/feedback/` に書かれ、`feedback_filed` は feature の run に記録される)
  3. `node <skills>/d2-common/scripts/genDocsReadme.js --cwd <wt>` (課題の一覧 `docs/feedback/README.md` を同じ commit に入れる)
  4. `git -C <wt> add -A -- docs` → `git -C <wt> commit -m "impl(<slug>): issues to feedback" -m "<attribution 行>"`
  5. feature のまま `git fetch . feedback-req/<slug>/<issue>:main` で main を ff する (main を checkout しない)
  6. `git worktree remove <wt>` → `git merge-base --is-ancestor feedback-req/<slug>/<issue> main` が exit 0 であることを確かめて `git branch -D feedback-req/<slug>/<issue>` (feature にいる間は `-d` が通らない)
  7. remote `origin` があれば `git push origin main` (拒否されたら止まって報告する。force push はしない)
- 一覧 `docs/feedback/README.md` は genDocsReadme が生成する (`docs/README.md` には件数と種類ごとの内訳と一覧へのリンクだけ)
- 消すのは取り込む段階: ルール・契約は還流 (課題の commit で消す。trailer `Feedback-Consumed:`)、要求は要求の差分、取り下げは確認ページ (trailer `Feedback-Dismissed:`)。中身は git の履歴に残る

## 完了報告

段階ごとに: 何をしたか、ゲート結果、人の判断が要るなら確認ページの URL、次にすること。
④ の配送の後は、main に入った commit・課題ファイルにした課題・復旧用 ref を報告して終了する (次の段階へ自動継続しない。次の起動で、溜まった課題があれば要求の差分か還流、無ければ次の UC)。
要求の差分の後は、自動選択の 3 の 2〜5 をやり直す (還流が要れば続ける)。還流が要らなければ報告して終了する。同じ起動で次の UC には進まない。
要求の差分の報告には、残った作業の処遇 (対応した `design` の項目と変えた / 消したファイル、閉じた前提、無視した項目、対応づけられなかった項目)、「仮に決めた反映」と「決定と違う反映」も載せる。
還流の後は、取り込んだ課題・止まった課題とその理由・取り下げた課題・プラグインへ持ち帰る課題 (`scan` の `plugin`)・main に入った commit を報告して終了する。

## 参照

- [../d2-common/references/config-schema.md](../d2-common/references/config-schema.md) — `.distillery/config.yaml` (0.1.31 で d2-common へ)
- [references/run-state.md](references/run-state.md) — events / done / attempt
- [references/subagent-template.md](references/subagent-template.md) — 派遣の変数と write-set
- [references/git-delivery.md](references/git-delivery.md) — branch / squash / main への取り込み / worktree / trailer
- [references/troubleshooting.md](references/troubleshooting.md) — 実行環境 (headless の許可、npm、補助スクリプト) で踏んだ問題と回避策
- `<skills>/d2-common/scripts/runGates.js`、`prTrailers.js`、`tokenReport.js`
