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
/distillery2:d2-run uc=<slug | UC 名>                 # 指定 UC の縦切り (中断からの再開も同じ)
/distillery2:d2-run uc=<slug | UC 名> merge=hold      # main へ取り込む手前で止める (headless 用。引数なしで再開すると取り込みから続く)
/distillery2:d2-run ... mode=auto | mode=recommend    # どの起動にも付けられる。既定 auto (推奨で進み、不明点・課題は人に返す)。recommend は推奨で進めて最後にまとめて見せる ([references/routing.md](references/routing.md))
```

`merge=hold` を config に置かない理由: config は追跡ファイルで ③ の仕上げで再生成されるため、書き換えると作業ツリーが汚れ、再生成で値が戻る。

自動選択 (起動時に作業 branch と段階を決める): `node <skills>/d2-common/scripts/nextAction.js <リポのルート> [--uc <slug>] [--stage <段>]` を呼ぶ (読むだけ。JSON 1 行の `action`)。
下の表の手順を行ったら、**起動を終えずにもう一度呼ぶ** (上流の差分・写し直しの後も同じ起動で続ける)。判定の順 (進行中の機能 → 途中の写し直し・上流の直し → push → 写し直し待ち → 旧形式・移行 → 連鎖の上限 → 上流の課題 → 開き直し → 次の機能) はスクリプトの冒頭が正。
名指し (`uc=` / `stage=`) は片付けの後に、進行中・途中・写し直し待ちのものが別にあれば `refuse` になる。止まるのは `refuse`・`none`・人に返す場面だけ。

| action | すること |
|---|---|
| `requirements` / `decide` / `foundation` | ① / ② / ③ |
| `cleanup` | `features` ごとに、その feature を checkout していれば clean を確かめて `git switch main`。`legacy: true` なら `git update-ref refs/distillery2/legacy/<slug>/<ts> feature/<slug>` で退避してから `git branch -D`、それ以外は `git branch -d`。`upstream` の branch は `git branch -d` |
| `continue-feature` | その UC の ④ を続ける (起動シーケンス 4〜5) |
| `resume` / `finish-resume` | 写し直し (routing.md「写し直し」)。終わったらその UC の ④ を続ける |
| `continue-upstream` | その branch で上流の差分を続ける (routing.md「上流の差分」) |
| `switch-main` | clean なら `git switch main` (clean でなければ整理を依頼して止まる) |
| `push` | `git push origin main` (拒否されたら止まって報告する。force push はしない) |
| `legacy` / `migrate` / `batch` | main マージの節「旧形式の run」/ 下の「移行」/ routing.md「途中で止まった還流」 |
| `limit-chain` | 人に返す (`page:limit:chain:<chain>`。推奨は止めて見直す。続けるなら答えを「続ける」で記録する) |
| `requirements-diff` / `decide-diff` / `foundation-diff` | ① の「要求の差分」/ routing.md「上流の差分」 |
| `reopen` | `node runState.js reopen <リポのルート> <uc> --from <from> --issue <docs/feedback/<id>.md> ...` を `impl(<uc>): reopen` で commit して、その UC の ④ (exit 3 は人に返す) |
| `uc` | その UC の ④ (`reopened: true` は「やり直し」の節) |
| `delivered` / `refuse` / `none` | 報告して終わる (`delivered` で `notes.uncovered_done` に入っていれば「やり直し」の節。`refuse` は `pending` か `waiting_on` を添える。`none` は `notes` の `uncovered_done`・`plugin`・`paused` を載せる) |

移行 (`migrate`): run ごとに `FB file-issues <run>` → `genDocsReadme.js` → `git add -A -- docs .distillery/runs/<slug>` → `impl(<slug>): issues to feedback` で main に commit する (remote `origin` があれば push)
(`FB` = `node <skills>/d2-common/scripts/feedbackBatch.js --cwd <リポのルート>`。サブコマンドは `FB` の直後で、JSON 1 行を返す)。

課題は戻し先のステップ (`target_step`。無い古い課題は `kind` から) で振り分ける (routing.md「前のステップの課題」)。0.1.x の還流で止まった課題 (`stopped: true`) も同じに扱う。
要求の差分で人が「残す」とした課題 (`hold`) は、その差分のきっかけにしない (ほかの課題で回すときに一緒に読む)。プラグインへ持ち帰る課題 (`kind: plugin`) はきっかけにしない (`scan` の `plugin` は報告に載せるだけ)。
上流の差分は main を進める。上流で止めた機能は、止めた課題がすべて main から消えたら (反映か取り下げ) 新しい main の上に写し直して続ける (`resume`)。

## 原則

- `docs/README.md` は上流から下流まで辿る入口。`<skills>/d2-common/scripts/genDocsReadme.js` が既存の正本から生成する
  (管理ブロックの中だけ。人が書いた部分と distillery2 以外の文書は触らず、名前だけ列挙する)。各段階の commit 前に更新する

- **自分では本文をほぼ読まない**。読むのは `.distillery/config.yaml`、`use-cases.yaml`、run の events / done / reports、
  サブエージェントの報告だけ。各段階は fresh なサブエージェントに委譲する ([references/subagent-template.md](references/subagent-template.md))
- **git 操作は自分だけが行う** (単一コミッタ)。サブエージェントには git 禁止を必ず伝える ([references/git-delivery.md](references/git-delivery.md))。
  自分が作るすべての commit に attribution 行を trailer で付ける (git-delivery.md「commit の attribution」)
- 実行状態は `.distillery/runs/<slug>/` の events + done ([references/run-state.md](references/run-state.md))。
  操作は `<skills>/d2-common/scripts/lib/runState.js` を通す。status ファイルは持たない
- 人に確認するときは **必ず `toolbox:human-html-review`** で確認ページを作り、showme の URL とローカルパスを示す。
  内部 ID (uc_id、SPEC-xxx、段階名) を本文に出さず名前で呼ぶ。回答は選択肢からコピーできる形にする。
  人に返すかどうかはモードで決める ([references/routing.md](references/routing.md)「人に返すとき」)。どの確認ページの問いにも推奨 (初期選択) を書き、推奨で決めたものも人が答えたものも `decisionLog.js` で記録する
- 担当を受理するたびに引き継ぎファイル (人に聞くこと・前のステップの課題) を処理する (routing.md「引き継ぎファイルの処理」)。報告の本文に書かれただけの問いや課題は扱わない
- 成果物ごとに 7 か所で、別系統のモデルの縦・横レビューを回す (routing.md「縦・横レビュー」)
- 上流 (要求・ADR・契約) の再生成はしない。ズレは `basis.js check` で見つけ、戻し先付きの課題にして routing.md の振り分けで直す

詰まったら各スキルの `references/troubleshooting.md` (環境依存の症状と回避策) を見る: 索引は [../d2-common/references/troubleshooting.md](../d2-common/references/troubleshooting.md) (d2-run / d2-foundation / d2-contract)。手順に無い回避策を使ったら報告に書く。手順書に書いていない場面で迷ったら、d2-run の troubleshooting の「手順書に書いていない扱い」を見る。

## d2-run が直接読み書きするもの

サブエージェントに任せず、d2-run 自身と d2-run が回すスクリプトが読み書きするものは [references/direct-io.md](references/direct-io.md) (処理ごとに 1 行)。
入出力の正本は [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) (図は [dataflow.md](../d2-common/references/dataflow.md))。

## 起動シーケンス

1. 引数を解釈し、上の自動選択で段階を決める (`uc=` / `stage=` の名指しも `nextAction.js` に渡す)
2. `.distillery/config.yaml` があれば読み、`models.implementer` と `models.verifier` を解決する。`implementer: null` はセッション既定モデルなので、**実際のモデル名に解決してから** verifier と並べて記録する。`verifier` は `opus` などの短い別名で書く (フル ID は `model` パラメータとして無効)。
   **独立検証の条件は「別のサブエージェント (文脈が新しい) で、実装役と同等以上のモデル」**。同じモデル ID に解決されても止めない (記録だけ残す。2026-09-26 のユーザー方針)。
   止めるのは verifier が実装役より明らかに弱い別名 (例: 実装役が opus で verifier が haiku) のときだけ
3. ④ なら UC を解決する: 引数が slug なら `use-cases.yaml` と照合、UC 名なら NFC 正規化して一意に一致する行を探す (複数なら候補を示して選ばせる)
4. (④ の再開時) `runState.js status` が `legacy_order: true` (0.1.25 までの順の run) なら、main マージの節の「旧形式の run」に従う。上流で止めた UC は再開しない (自動選択が `resume` を返したときだけ写し直して続ける)
5. 作業ツリーの clean 判定 (④・上流の差分の開始時。④ の再開時は branch 一致を確認する (feature)): `git status --porcelain` のうち、**追跡済みの変更**と、**未追跡でも `docs/` `apps/` `packages/` `contracts/` `features/` `.distillery/` 配下のファイル**だけを対象にする。これらがあれば勝手に stash / commit せず整理を依頼して停止する。それ以外のルート直下の未追跡ファイル (ハーネスの `run-stage.sh` などの実行スクリプト) は clean 判定に含めず、**報告に一覧として載せて無視**する (ハーネスのファイルで clean 条件を満たせなくなるため)。`.git/info/exclude` への書き込みは前提にしない (権限で拒否されうる)。
   ④ の再開では、対象の変更がすべて `runState.js status` の `next_stage` の派遣の書き込み範囲 (派遣表) の中なら、止まった段の成果物なので整理を依頼せず、その段の受理の検査からやり直す (範囲の外が 1 つでもあれば止まる。引き継ぎファイル `<run>/handoff/**` は範囲の外でも数えない)

## ① 要求

1. sub `d2-requirements` (input=<要望テキスト>) を派遣する
2. 引き継ぎファイルを処理し、要求のレビュー (routing.md。`--point requirements`) を回す。その後 `docs/requirements/_review-summary.md` を材料に human-html-review で確認ページを作る
   (UC 一覧、業務ルール、状態遷移、受入基準、人に返す問い、レビューの結果。判断は「この要求で進めてよいか / 直す点」。auto でも必ず人に返す。recommend は推奨で承認して記録)
3. 承認されたら `node <skills>/d2-common/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add -A -- docs .distillery && git commit -m "req: initial requirements" -m "<attribution 行>"` (引き継ぎファイル・決めたことの記録・レビューの結果も入れる)。差し戻しなら指摘を input に足して 1 に戻る

### 要求の差分 (未処理の要求の課題があるとき)

UC の実装で見つかった要求の穴 (戻し先が requirements の課題ファイル) を要求に反映する。自動選択の `requirements-diff` で入る (`stage=requirements` の直接指定も同じ)。
既存の持ち越し (0.1.30〜0.1.31 形式の残った作業: `FB scan` の `carry_over_rows` (`use-cases.yaml` の `carry_over` の行) と `carry_over_pending`) が残っているときは、要求の課題が 0 件でも入る (3 で宛先へ流す)。

1. 前提: 進行中の UC が無い、作業 branch が clean な main。remote `origin` があれば `git fetch origin` して `git merge --ff-only origin/main` (分岐していたら止まって報告する)。
   **既存の持ち越しを先に控える**: `FB scan` の `carry_over_rows` (slug と items) と `carry_over_pending` (slug と items) を 3 の材料として書き留める (2 の再生成 (要求担当の差分更新も `genUseCases.js` も) は `carry_over` の行を引き継がず消すので、2 の後には読めない)
2. sub `d2-requirements` (`input=<feedbackBatch.js scan の upstream.requirements と requirement_all の課題ファイルのパス (すべて)>`。差分更新)。課題の本文は自分では読まない。
   報告の「残った作業」(要求担当の write-set の外で必要になった作業。種類 `design` / `assumption` と対象付き)、「決定と違う反映」(課題の決定と違う反映にした課題・決定・実際の反映・理由)、
   「仮に決めた反映」(課題に決定が無く要求担当が案を選んだもの: 課題・選んだ案・理由。課題の決定の外の論点を要求担当が選んだもの: 課題・論点・選んだ案・理由) を 3 の材料に控える。
   決めずに返した論点は引き継ぎファイルの問いとして routing.md で振り分ける。続けて要求のレビュー (`--point requirements`) を回す
   要求の課題が 0 件 (既存の持ち越しだけ) なら要求担当は派遣せず、`node <skills>/d2-requirements/scripts/genUseCases.js` を回して `use-cases.yaml` を再生成する (決定論。`carry_over` の行が消える。他の変更は無い)
   要求担当を派遣した後も、1 で控えた `carry_over_rows` が空でなく `use-cases.yaml` に `carry_over` の行が残っていれば (要求担当が再生成しなかった)、3 の確認ページの前に `node <skills>/d2-requirements/scripts/genUseCases.js` を回す (`carry_over` の行が消える。要求が変わっていれば `spec_ids` も変わり得るので、確認ページはこの再生成の後の差分で作る)
3. ① と同じ材料で確認ページを作る (課題ごとに反映した要求・仕様を添える。auto でも必ず人に返す)。**承認は一括** (差分更新はインプレースなので、課題ごとに切り分けられない)。
   加えて載せる: **「決定と違う反映」** (課題ごとに決定・反映・理由。無ければ「なし」。違いを戻すなら「直す点」で 2 から)、
   **「仮に決めた反映」** (課題ごとに選んだ案・理由。無ければ「なし」。「決定と違う反映」と並べて載せる。課題の決定の外の論点は論点も添える。違う案にするなら「直す点」で 2 から)、
   **「残った作業」** を種類ごとに載せ、1 件ずつ「**対応する / 無視**」で聞く (「次の UC で拾う」は無い):
   - `design` (画面の見本): 要求担当の報告の項目。項目のファイルは `docs/design/storybook-app/src/<相対パス>` で指す。報告が `packages/ui/<相対パス>` (取り込み先) で書いていたら `docs/design/storybook-app/src/<相対パス>` に読み替え、実在を確かめる。無ければ「対応づけられない」と出して派遣しない (人は無視を選ぶ)。
     対応づいた項目の推奨 (初期選択) は「対応する」(要求担当が要求の変更に合わせて必要とした作業なので)。「無視」の横に影響を書く: 要求と画面の見本が食い違ったまま次の UC に入り、そのシナリオか実装で同じ課題がまた出る見込み (既存の持ち越しを `design` に振る項目も同じ)
   - `assumption` (前提の記録を閉じる): UC の slug・ティア・attempt・`A-xxx` の id と、閉じる決定の要点。項目に slug か attempt が無ければ (既存の持ち越しは「frontend の A-004」のようにしか書いていない)、d2-run が候補を列挙して載せる:
     `grep -l "id: A-xxx" .distillery/runs/*/attempt-*/assumptions.<tier>.yaml` で id を持つ (slug, attempt) の組をすべて出し、1 件なら確定、複数なら確認ページで人に選ばせる (同じ id が別の UC・別の attempt にあるので推測しない)。候補が 0 件か人が選ばなければ「無視」(報告に「特定できなかった項目」として残す)。
     1 つの項目に複数の id (例「A-004 / A-005 / A-006」) があれば **id ごとに分けて**候補を列挙し、id ごとの選択から `targets` の要素を 1 つずつ組む (id ごとに attempt が違ってよい)。
     同じ (slug, tier, attempt, id) を指す項目が複数あれば (要求担当の項目と既存の持ち越しが重なったときなど)、1 件にまとめて聞き (まとめた元の項目を添える)、`targets` には 1 回だけ入れる。閉じる決定の要点が項目ごとに違えば、まとめずに両方の決定を並べて載せ、どちらで閉じるか (または無視) を人に選ばせる (`assumption_resolved` の `decision` は 1 つなので推測で選ばない)
   - 既存の持ち越し (1 で控えた `carry_over_rows` と `carry_over_pending` の `items`) も同じ一覧に載せる (種類は人が `design` / `assumption` / 無視 を選ぶ。`assumption` の候補は上と同じに列挙する。黙って失わない)
   - **やり直す UC**: 要求担当の反映の後の作業ツリーで `FB scan` を回し、`uncovered_done` の UC ごとに網羅されていない受入基準を載せる。「やり直す / 後で」で聞く (「やり直し」の節)
   問い: 「この差分で進めてよいか / 直す点 / 外す課題 / 残った作業ごとに対応するか無視か / やり直す UC」。直す点は指摘を input に足して 2 から。
   外す課題があれば、変更を捨てて (`git checkout -- docs/requirements` と `git clean -fd -- docs/requirements`) その課題を除いて 2 から。外した課題は「取り下げる / 残す」を聞く。
   残す課題は理由をファイルに書いて `feedbackBatch.js hold <issue> --reason-file <ファイル>` (止まった印を付ける。止まった課題だけでは要求の差分を始めない)
4. 承認されたら、まず「対応する」残った作業を種類ごとの宛先に流す:
   - `design`: sub `d2-design mode=feedback items=<項目のファイル (docs/design/storybook-app/src/<相対パス>。stories も部品も) と直す内容を 1 行ずつ>` (派遣表「① 要求の差分 (画面部品)」。項目が部品なら、報告の「影響する Story」(その部品から import を Story まで辿った一覧) を完了報告に転記する)。受理の条件: 報告に `npx storybook build` が通ったこと、
     d2-run が回す `node <skills>/d2-design/scripts/validateScreens.js docs/design/screens.yaml --app docs/design/storybook-app/src --use-cases docs/requirements/use-cases.yaml` が exit 0 (Story を消したときの `screens.yaml` の参照漏れを拾う)、write-set (`docs/design/**`) の外が変わっていない、
     `git status --porcelain --untracked-files=all -- docs/design` の変わったファイル (変更・追加・削除を 1 ファイルずつ) がすべて、項目のファイルか、報告の「項目の外の変更」に項目との対応付きで載っているか、`docs/design/screens.yaml` (Story か画面を消す項目があるときだけ) のどれかに入る (入らないファイルがあれば、理由の無い削除も含めて受理せず、下と同じく変更を捨てて止まって報告する)、
     **項目がすべて「直した」** (報告に「直せない (理由)」が 1 件でもあれば受理せず、変更を捨てて (`git checkout -- docs/design` と `git clean -fd -- docs/design`) 止まって報告する。人が項目を直すか「無視」に変えて 3 からやり直す。既存の持ち越しは再生成で消えるので、黙って先へ進まない)。
     受理後に `node <skills>/d2-foundation/scripts/importUi.js --from docs/design/storybook-app --cwd .` で `packages/ui/**` に取り込み直す (前回の一覧にあって消えたファイルは消える)。
     続けて、main マージ済み UC (`status: done`) のうち `tiers` に frontend を含むものごとに `runGates.js --uc <slug> --tiers frontend --only unit` を回す (取り込んだ部品を使う既存 UC の回帰)。落ちたら止まって報告する (design の差し戻し。commit しない)
   - `assumption`: 3 でまとめた (slug, tier, attempt, id) ごとに 1 回だけ、対象の UC の run (main) に `node runState.js event .distillery/runs/<slug> assumption_resolved --data-file <json>` を追記する。JSON は `{"targets": [{"tier": "<tier>", "attempt": <n>, "id": "A-xxx"}], "decision": "<要求の差分の決定の要点>", "by": "req: feedback"}`
     (`runState.js` が各 target を `attempt-<n>/assumptions.<tier>.yaml` で確かめ、無い組は拒む。最新でない attempt の前提も閉じられる。AssumptionRecord の yaml は変えない)
   - 既存の持ち越しを流したら、`carry_over_pending` の run には `node runState.js event .distillery/runs/<slug> carry_over_migrated --data-file <json>` (`{"items": [...], "to": "req: feedback"}`) を追記する (再び移行の対象にしない)。`use-cases.yaml` の `carry_over` の行は 2 の再生成 (要求担当の差分更新か `genUseCases.js`) で消える
   - やり直す UC: 「やり直し」の節の `reopen` を UC ごとに回す
   次に、反映した課題ファイルと取り下げた課題ファイルを `git rm` し、genDocsReadme → `git add -A -- docs packages/ui .distillery` (`packages/ui` は design の作業があったときだけ。無いパスを名指ししない) → 本文ファイル (`.distillery/logs/req-feedback-<ts>.txt`。1 行目 `req: feedback`、空行、trailer) を書いて `git commit -F <本文ファイル>` (main マージ 3 と同じ書き方)。
   trailer は反映した課題ごとに `Feedback-Consumed: docs/feedback/<issue>.md`、取り下げた課題ごとに `Feedback-Dismissed: docs/feedback/<issue>.md`、最後に attribution 行 (git-delivery.md「commit の attribution」)。remote があれば push
5. 上流で止めた UC の feature は消さない (止めた課題がすべて main から消えると、次の自動選択が `resume` を返して写し直す。要求の課題は scenario から続く)
6. 決定・契約への波及は `node <skills>/d2-common/scripts/lib/basis.js check <対象ファイル…> requirements=docs/requirements adr=docs/adr contracts=contracts` で見つける。
   対象ファイルは存在するものだけ: `docs/adr/[0-9]*.md` (決定の本文。`_review-summary.md` と `index.md` は生成物なので渡さない。渡すと STALE に出る)、`docs/adr/architecture.md`、`docs/as-built/*/*/index.md` (as-built がまだ無ければ省く。無いパスを渡すと読み込みで落ちる)。
   STALE は完了報告に載せるだけで、自動では追随しない (as-built はその UC を次に回したときに作り直す)。
   閉じた前提 (`assumption_resolved`) も同じ: 完了報告に「閉じた前提 (UC・ティア・attempt・id) と、as-built は次にその UC を回したときに反映 (最新でない attempt の前提は as-built に出ない)」を書く
7. 自動選択をもう一度呼んで続ける (写し直し待ちの機能・次の上流の差分・次の UC)

### やり直し (main マージ済みの UC に新しい受入基準が付いたとき)

`FB scan` の `uncovered_done` は、`status: done` の UC のうち、シナリオ (`features/**/<slug>.feature`) が UC の仕様の受入基準を網羅しないもの (`checkScenario.js` の `missing`) と、
受入基準の文面が main マージの時点から変わったもの (`acceptance_changed: true`。main マージの done の受入基準の指紋と比べる。0.1.34 までに main マージした UC は指紋が無いので、番号が増えたときだけ出る)。`error` 付きの UC は feature が無いか検査が落ちた UC で、やり直さずに報告する。

1. **聞く**: 確認ページで UC ごとに「やり直す / 後で」。推奨は「やり直す」。「後で」の影響: 付いた仕様は実装されないまま残り、起動のたびに完了報告に載る (`uc=<slug>` の名指しでやり直せる)
2. **退避**: 「やり直す」なら main の上で `node runState.js reopen <リポのルート> <slug> --from scenario --data-file <scan の uncovered_done のその UC の記録 (missing と acceptance_changed) の json>` を回す
   (run を `.distillery/archive/runs/<slug>/<ts>/` へ移し、`reports/`・`traces/` は消し、`use-cases.yaml` の `status` を `planned` にする。進行中の UC は拒む)。
   要求の差分の中なら、要求担当の反映の後の作業ツリー (未 commit) のまま回し、同じ `req: feedback` の commit に入れる。名指しの起動なら clean な main で回し、`genDocsReadme.js` → `git add -A -- docs .distillery/runs .distillery/archive` → `req(<slug>): reopen` で commit する
3. **回す**: 自動選択がやり直し中の UC を次の機能より先に選ぶ (名指しの起動ならそのまま続ける)。④ は main から新しい run で始まり、段ごとに次が変わる。派遣文に `reopened.json` の `missing` と `acceptance_changed` を添える (文面だけが変わった UC は `missing` が空で `acceptance_changed: true`):
   - scenario: 既存の feature に、網羅されていない受入基準のシナリオを足す (`acceptance_changed` なら、UC の受入基準をすべて既存のシナリオと照らし合わせ、文面が変わった受入基準のシナリオを直す。網羅の検査は番号しか見ないので、照らし合わせた結果を報告に書く)
   - contract: 既存の operation も直してよい (d2-contract の UC モード)
   - scaffold: 既存の `<slug>.steps.ts` は残し、足りない step だけ pending で足す。red は新しい受入基準を実装するティアだけに求め、`runGates.js --uc <slug> --only unit --expect-red unit --tiers <そのティア>` で確かめる (scaffold の報告のティア)
   - tier 以降: 新しい UC と同じ

## ② 決定

1. sub `d2-decide` を派遣する
2. 引き継ぎファイルを処理し、決定のレビュー (`--point decide`) を回してから、`docs/adr/_review-summary.md` を材料に確認ページ (非機能グレード表の要点、各決定と却下した案、confidence: low の決定は選択肢として提示。モードの規則で人に返す問いがあるときだけ止まり、無ければ推奨で承認して記録)
3. 承認されたら `node <skills>/d2-common/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add -A -- docs .distillery && git commit -m "decide: nfr and adr" -m "<attribution 行>"`。選択が変わった決定は ADR を直して (sub に戻す) 再提示

## ③ 基盤

順序は「骨格・依存 → 契約の骨格 → design → 仕上げ (契約込みの config / CI / C4 図・画面部品の取り込み・契約テスト・チェックポイント)」。
契約の骨格は redocly (npm install 後) が要り、config / CI は契約 (`contracts/contracts.json`) を読むので、契約の後にもう一度生成する。
design は config も契約も読まないので、契約の骨格の直後に回し、仕上げを 1 回の派遣にまとめる。
スクリプトは d2-foundation が回す (phase の中身は d2-foundation の SKILL.md)。d2-run は派遣と受理だけを行う。どの派遣も再実行して安全 (中断したら同じ手順から再開する)。

1. sub `d2-foundation phase=all` (F1→F2→F3→F5→F7。骨格・設定・依存を入れる・qlty の提案を足す。この時点の genConfig は `contracts: []` の警告付きでよい)
2. sub `d2-contract mode=skeleton` (compile に redocly を使う)
3. (frontend ティアがあれば) sub `d2-design`。design が部品を生成したときだけ次の仕上げに `ui=true` を渡す。
   frontend ティアが無い (design を派遣しない) か、design が「画面を持たないプロダクトのため skip」と報告したら `ui=false`
   (前の実行の `docs/design/` が残っていても取り込ませない)。design の完了報告が届くまで仕上げに進まない (subagent-template.md の例外)
4. 仕上げの前に、契約の骨格と画面部品だけを先に commit する: `git add contracts docs/design && git commit -m "foundation: contracts and design" -m "<attribution 行>"`
   (`docs/design` が無ければ `contracts` だけ。変更が無ければ飛ばす)。仕上げが作る config・C4 図・画面部品の取り込み記録は、
   入力を最後に commit した commit を basis に記録する。未 commit のままだと basis が空になり、契約や画面が変わっても古さを検出できない
5. `.distillery/runs/bootstrap/reports/gates.json` があれば消してから、sub `d2-foundation phase=finish ui=<true|false>` (F8→F6→F7→F4→F9)。
   受理時の検査: `.distillery/runs/bootstrap/reports/gates.json` があり、`uc` が `bootstrap`、`result` が `pass`、`gates` (`{name, status}` の配列) のうち `name` が `static` の要素の `status` が `pass` (読むだけ。runGates を回し直さない)。加えて `node <skills>/d2-contract/scripts/genContractTests.js contracts --config .distillery/config.yaml --out-root . --check` が exit 0 (骨格分の契約テストが今の契約から生成済み。static のゲートは契約テストの生成を見ないため)。
   満たさなければ報告を添えて人に見せ、先へ進まない
6. 3 つの派遣 (骨格・契約の骨格・画面部品・仕上げ) の引き継ぎファイルを処理し、基盤のレビュー (`--point foundation`) を回す。`.distillery/config.yaml` の tiers / contracts / commands / capabilities を確認ページに載せ (モードの規則で人に返す問いがあるときだけ止まり、無ければ推奨で承認して記録)、承認後に `node <skills>/d2-common/scripts/genDocsReadme.js` で `docs/README.md` を更新し、`git add -A && git commit -m "foundation: rules, tests, config" -m "<attribution 行>"`
   (差し戻しで契約の骨格や design をやり直したら、4 から繰り返す)

## ④ UC の縦切り

`<run>` = `.distillery/runs/<slug>`。`<base_head>` = `runState.js status <run>` の `base_head` (有効な分岐元。写し直した後は写し直した先の main)。新しい UC は `git switch -c feature/<slug>` (git-delivery.md「UC branch の開始と再開」2) → `node runState.js open . <slug>` → `branch_started` の追記 → `models_resolved` の記録、の順に行う (run のイベントは open の後に書く)。再開は `node runState.js status <run>` で次の段階を決める。
開いた直後に、起動シーケンス 2 で解決したモデル名を記録する (as-built の生成情報とトークン集計で「どのモデルで実行したか」を示すため)。再開時は、run の `models_resolved` に同じ ID が記録済みなら記録しない (別名しか無いときだけ解決済みの ID で記録し直す)。
ただし squash 済みで main マージの done が無い再開 (`merge=hold` で止めた後など) では、記録を main マージの 6 まで遅らせ、main マージの done と同じ commit に含める
(追跡ファイルの `events.jsonl` が変わると feature が clean でなくなり、main へ取り込めない):
`node runState.js event <run> models_resolved '{"session":"<このセッションのモデル名>","implementer":"<実装者の解決名>","verifier":"<Verifier の解決名>"}'`
値は **モデル ID だけ** (例 `claude-opus-4-7`)。別名の説明や注記を混ぜない (as-built の生成情報にそのまま出る)。
Agent ツールの別名 (`opus` 等) の解決先が分かっていれば (ハーネスの指示、過去の run の `models_resolved`、Verifier の報告) 最初から ID で書く。分からないときだけ別名のまま書き、verify 段で Verifier の報告 1 行目 `model: <ID>` を得たら
同じイベントを解決済みの ID で記録し直す (最後の models_resolved が有効)。
再開時や main マージ 6 で記録するときは、run の `models_resolved` に解決済みの ID があればそれを流用し、別名で記録し直さない。
各段階の done を書いたら `impl(<slug>): <stage>` で commit する (attribution 行を付ける。git-delivery.md「commit の attribution」)。
`runState.js done` / `event` の data は argv の JSON で渡す。長い JSON (日本語の一覧など) は `.distillery/logs/<name>.json` に書いて `--data-file <ファイル>` で渡す (argv と排他)。
要求の差分で残った作業は ④ に持ち込まない (要求の差分が種類ごとの宛先に流す)。
run を開いたら `mode_resolved {mode}` を記録し、`FB scan` の `carried` にこの UC があれば routing.md のとおり `carried_issues` を記録して戻し先の段の派遣文に添える。各段の担当を受理するたびに引き継ぎファイルを処理する (routing.md)。前のステップの課題で巻き戻したら、`runState.js status` の `next_stage` から続ける。

| 段階 | すること | done の条件 |
|---|---|---|
| **scenario** | (④ 冒頭で切った branch の上で) sub `d2-implement mode=scenario`。`node <skills>/d2-implement/scripts/checkScenario.js features/<業務>/<slug>.feature --use-cases docs/requirements/use-cases.yaml --requirements docs/requirements/requirements.yaml --uc <slug> --acceptance-dir features/acceptance` を回し、結果 (JSON 1 行。`ok` / `missing` / `covered` / `unknown_tags` / `errors`。`features/acceptance/` が無ければ受入は読まず、UC の feature だけで判定する。エラーにしない) を読む。**`missing` (対応づかない受入基準) があれば ok の前に分岐する** (`missing` があると `ok: false` で exit 1): 執筆役の報告がそれを**他 UC の振る舞い**と判断していれば、**要求の課題にして止まる**: 執筆役が `<run>/issues/` に書いた下書き (`target_step: requirements`。無ければ d2-run が書く: 対応づかない受入基準と、どの UC の振る舞いか、「仕様を UC 単位に分ける」) で routing.md「上流で止めるとき」の手順で止める (scenario は done にしない。要求の差分が仕様を UC 単位に分けた後、写し直して scenario から続ける)。執筆役が「この UC の振る舞い」と判断していれば (書き漏れ) 執筆役に差し戻す。`missing` が無く ok なら、シナリオのレビュー (`--point scenario`、対象は feature と受入の feature) を回してから、シナリオの確認 (問い: この振る舞いで合っているか。モードの規則で人に返す問いがあるときだけ確認ページで止まり、無ければ推奨で承認して記録)。承認を `node runState.js scenario-approve <run> --feature features/<業務>/<slug>.feature --acceptance-dir features/acceptance` で記録する (feature の bytes の sha256 と、`@uc:<slug>` を持つ受入 feature の sha256 を計算して `scenario_approved {feature, feature_sha256, acceptance: {<path>: <sha256>}}` を書く。受入の feature が無ければ `acceptance: {}`。進行役が自分で計算しない)。次に `node runState.js done <run> scenario '{"feature": "<path>"}'`、`node <skills>/d2-common/scripts/genDocsReadme.js` で README のシナリオ列を更新して `git add -A -- docs features .distillery/runs/<slug> && git commit -m "req(<slug>): scenarios" -m "<attribution 行>"` | 承認済み |
| **contract** | sub `d2-contract mode=uc uc=<slug>`。`compileContracts.js contracts --check`、`compileRdbSchema.js contracts --check`、`validateUcIndex.js contracts` が exit 0。examples が書けずに止まったら、担当の引き継ぎファイルの前のステップの課題を routing.md で振り分ける (要求に戻すなら上流で止める)。受理の後に契約のレビュー (`--point contract`、対象は `git diff <base_head> -- contracts/` の変わったファイル) を回す。受理時に `node <skills>/d2-contract/scripts/classifyContractChanges.js --uc <slug> --json` で変わった契約の生成物を own / other_uc / shared に分け、結果を done の `contract_changes` に書く (契約は UC 間で共有するので、enum の追加などで他 UC のテストや共有の型も書き換わる) | slice と契約テストが生成済み、`contract_changes` 記録済み |
| **scaffold** | sub `d2-implement mode=scaffold`。受理時に既存の非テストファイルを変えていないことを確かめる (subagent-template.md「受理時の検査」)。`runGates.js --uc <slug> --tiers <関与ティア> --only unit --expect-red unit` が exit 0、dry-run で undefined step 0 | red baseline |
| **tier** | attempt = `currentAttempt`。関与ティア (下記「関与ティアの決め方」) ごとに sub `d2-implement mode=tier` を**同じメッセージで並列派遣** (model = implementer)。実装者は runGates を使わず commands を直接回す (記録なし)。受理時に `validateAssumptions.js record` を全ティアで実行し、全ティアの受理後に**自分が 1 回だけ** `runGates.js --uc <slug> --tiers <関与ティア> --upto unit` を回す (記録の単一 writer。runGates は gates.json をゲート名単位で置き換えるので、並列の実装者に回させると互いの記録を消す)。落ちたティアは同じ attempt のまま再派遣する | 全ティアの assumptions が ok、上の runGates で static / unit が pass |
| **contract-gate** | `runGates.js --uc <slug> --tiers <関与ティア> --upto contract`。落ちたら `runState.js rewind <run> implementation` で tier に戻し、提供側ティアだけ再派遣する (他ティアは下の carry-forward。上限の exit 3 は人に返す) | contract まで pass |
| **integrate** | sub `d2-implement mode=integrate`。続けて `node <skills>/d2-foundation/scripts/genQlty.js --refresh --cwd .` (実装で増えたファイル種別に対する qlty の提案を足す。追加した plugins を報告に書く)。`runGates.js --uc <slug> --tiers <関与ティア> --from static` (増えた plugins の指摘は static に出る。落ちたら報告の分析に従い `rewind <run> implementation` で該当ティアを tier に戻す。verify / review / as-built はこの後なので、直した実装も検証と記録の対象になる)。attempt ≥ 2 (差し戻しの後) も sub は**必ず派遣**する (ティアの入口や注入対象が変わっていれば結線の更新が要る)。sub が「結線の変更は不要」と判断し、integrate.md の完了条件 (runGates `--from uc-bdd`、受入の網羅、計装範囲の `extractAsBuilt --dry-run`) を満たしたと報告すれば、`features/` に差分が無くても done にしてよい。done に `wiring_changed: false` を書く。**他 UC への回帰は d2-run が回す**: 受理して done を書き `impl(<slug>): integrate` で commit した後、`git diff --name-only <base_head>..HEAD -- features/support features/step_definitions` (commit 済みの変更だけを見るので、commit の前に回さない) に変更があれば、main マージ済み UC (`status: done`) ごとに、そうでなくても contract の done の `contract_changes` に他の UC にも効く変更 (`also_used_by` の付いた own、`other_uc`、`shared`) があれば、その UC ごとに、`runGates.js --uc <他 slug> --only uc-bdd` を回し (他 UC の `<run>/traces/**` と `<run>/reports/**` は d2-run の runGates が書く。gitignore。as-built はその UC を次に回したときに作り直す)、落ちたら報告の分析に従い `rewind <run> implementation` で該当ティアを tier に戻す (integrate の write-set は自分の UC の reports / traces だけなので、実装者には回させない) | static から acceptance まで pass、共有の補助を変えたなら main マージ済み UC の uc-bdd も pass |
| **verify** | ティアごとに sub `d2-verify` を**同じメッセージで並列派遣** (agent_type `distillery2:d2-verifier`、model = verifier、変更ファイル一覧のファイルのパスと実装者の固定指示のパス (`<skills>/d2-implement/references/tier-impl.md` の絶対パス。前提の照合先) を渡す)。変更ファイル一覧と「他 UC と共有する変更ファイル」の初期候補は**常に** `.distillery/logs/verify-<slug>-attempt-<n>.txt` (gitignore) に書いてパスで渡す (件数で渡し方を変えない): 変更ファイル = `git diff --name-only <base_head>..HEAD` から `docs/README.md`・`docs/requirements/use-cases.yaml`・`docs/feedback/**` (どの UC も書く簿記のファイル) を除いたもの。初期候補 = 変更ファイルと `docs/as-built/_system/traceability-index.json` の `ucs[<他の slug>].files` の共通部分 (他 UC の slug つき。追跡表が無ければ「なし」)。追跡表の files は各 UC が**変更した**ファイルなので、基盤から在る共通コードは拾えない。Verifier が import 元を辿って足す (viewpoints.md「他 UC への波及」)。受理時に `validateAssumptions.js verdicts`。報告 1 行目の `model: <ID>` が models_resolved.verifier と違えば models_resolved を記録し直す。blocker があれば `rewind <run> implementation` で該当ティアを tier に戻す (回数の上限は rewind が数える)。findings の `upstream_issues` と `asks` も routing.md で振り分ける。検証役の派遣と並べて、実装のレビュー (`--point implementation`、ティアごとに 1 依頼。対象は verify の変更ファイル一覧のそのティアの分。置き場 `<run>/reviews/implementation-<tier>/`) を回す | 全ティアの findings が ok で blocker 0、実装のレビューを反証して直した |
| **review** | 下記「人レビュー」 | `review_approved` 記録済み |
| **asbuilt** | `<run>/reports/asbuilt.json` があれば消し、`node runState.js set-aside-asbuilt-drafts <run>` で課題ファイルにしていない要約役の下書き (`issues/*_asbuilt_*.md`) を `invalidated/` へ移してから (再開・差し戻しの後に前回の集計や下書きで受理しないため。asbuilt を含む差し戻しの `invalidate --from` と `return-to-integrate` も同じく移す)、sub `d2-asbuilt` を派遣する (依存グラフの実態 → `extractAsBuilt.js` の抽出 → 要約 → `checkAsBuilt.js` の検査まで、要約役が通しで行う)。受理時の検査 (読むだけ): `node <skills>/d2-asbuilt/scripts/checkAsBuilt.js docs/as-built/<業務>/<UC>/index.md` が exit 0、かつ `<run>/reports/asbuilt.json` があり、`slug` が今回の UC、`attempt` が `runState.js status` の attempt と一致する。さらに要約役の完了報告 (要約した 3 ブロックと引用したコード位置、課題の下書きの一覧) が届いていて、一覧の下書きのファイルが `<run>/issues/` にあり、「下書きにした課題」と「下書きにしなかった行」の件数の合計が `checkAsBuilt.js` の出力の「課題の行」と同じ (as-built は人レビューの後なので、要約役が見つけた課題は下書きにして main マージ 1 の 3 で課題ファイルにする) (抽出は前回の要約を残すので、成果物だけでは今回の要約を区別できない。subagent-template.md の例外)。どれかを満たさなければ d2-asbuilt に差し戻す。集計の `instrumentation_gaps` (計装なしのティア) か `instrumentation_happy_gaps` (正常系に部品 (call) が無いティア) が空でなければ integrate の結線漏れ: asbuilt を done にせず integrate へ戻して結線を足す (図に出ないティア・部品は as-built の価値を落とす。要約役の報告文ではなく集計ファイルで判断する)。戻し方: `node runState.js return-to-integrate <run> '{"instrumentation_gaps":[...],"instrumentation_happy_gaps":[...]}'` を 1 回だけ実行し、commit する (同じ attempt の Verifier の結果 `findings.<tier>.yaml` を `<run>/invalidated/<ts>_attempt-<n>_findings.<tier>.yaml` へ移し、integrate 以降の done (verify・review を含む) をまとめて退避し、`returned_to_integrate {from, instrumentation_gaps, instrumentation_happy_gaps, moved_findings}` を記録する。findings を先に移すので、途中で止まっても再検証の前の結果は残らない。再開したら同じ判断からもう一度実行してよい)。attempt は上げない (計装の結線は integrate の担当で、ティアのコードは変えない)。integrate の派遣文に集計の 2 つの一覧を添える。verify と review もやり直す (結線を変えるとゲートの結果と承認の根拠が変わる)。受理したら as-built のレビュー (`--point asbuilt`) を回し、`node <skills>/d2-common/scripts/genDocsReadme.js` (docs/README.md の UC 一覧に実装の記録を載せる。リンク切れなら exit 1)。commit。depcruise が失敗/未実行でも extractAsBuilt は config から「決定からの図」を描く (空にならない) | as-built が生成済み、集計の計装なし / 正常系に部品なしのティアが空 |
| **deliver** | 下記「main マージ」。UC の課題を課題ファイルにし、squash して main へ ff merge し、main の上で main マージの done を commit する (PR を作らない)。UC はここで終わる (課題は次の起動の自動選択が戻し先で振り分ける) | `stages/deliver.done.yaml` が main にあり、`runState.js status` の `unfiled_issues` が空 |

verify と review の前提: `reports/gates.json` が `all_recorded: true` で全段 pass。部分実行の後は
`runGates.js --uc <slug> --tiers <関与ティア>` で 1 回通し、全段の証跡を揃えてから verify に進む
(`--tiers` を省くと config の全ティアに unit が走り、UC に関与しないティア (テスト 0 件) で落ちる)。

**ゲートの回し直し**: 記録付きのゲート (runGates) が落ちたら、コードも commit も変えずに同じコマンドを **1 回だけ**回し直してよい (順番や並列に左右される不安定なテストの切り分け)。**static は回し直さない** (検査器の決定論的な指摘で、順番や並列に左右されない。④ のどこでも同じ)。
回し直す前に 1 回目の `<run>/reports/gates.json` を `<run>/reports/gates.failed-1.json` に写す (runGates は回し直した段を上書きするので、1 回目の `failed_tests` が消える)。
回し直して通ったら、完了報告に 1 回目に落ちたゲートとテスト名 (写しの `failed_tests`) を書く。2 回目も落ちたら落ちた扱い (推測で直さない・課題を外さない)。3 回目は回さない。
落ちた内容は出力をファイルに保存せず (headless では保存が拒まれる) gates.json の job の `output_tail` と `failed_tests` で読む。

**依存の脆弱性** (どの段階の runGates でも): static の quality が依存の脆弱性の指摘 (osv-scanner) だけで落ちたときは、runGates が通して job に `advisory` を残す (脆弱性情報の更新で UC と無関係に毎回落ちるため。CI は `commands.quality` をそのまま回すので、main の CI では落ちる)。`advisory` は止めずに、人レビューの材料と完了報告 (④ の main マージ) に載せる

**static の落ちの戻り先** (tier・integrate の runGates): 指摘の対象ファイル (`output_tail`) の書き込み範囲 (派遣表) で決める。
あるティアの範囲 → tier の行・integrate の行の手順のとおり (ティアの再派遣か attempt++)。integrate の範囲 (`features/step_definitions/**`・`features/support/**` など) → integrate の担当に差し戻す (attempt は上げない)。
どの派遣の範囲でもない (依存の一覧・検査の設定・ワークフローなど) → main マージ 1 の 2 と同じく、推測で直さず材料を添えて止まる (人が feature に `impl(<slug>): <内容>` で commit して再開)

attempt++ は `runState.js rewind <run> implementation` で行う (`tier` 以降の done の退避と attempt-<n+1> の作成をまとめて行い、戻った回数を数える)。
前 attempt の findings パスを tier の派遣に渡す。戻さないティアの assumptions は新 attempt に複製し (carry-forward)、
複製したファイルの `attempt` フィールドを新しい番号に書き換える (hash の対象外なので値は変わらない)。複製後に全ティアで
`validateAssumptions.js record --attempt <n+1>` を再実行して ok を確認してから verify に進む。

**関与ティアの決め方** (scaffold / tier / contract-gate / integrate / 全段の証跡の `--tiers` と派遣先に使う。正は 1 か所。`--tiers` にはカンマ区切りで渡す。例 `--tiers frontend,backend-api`):
contract 段階の完了時に、契約 slice の provider / consumers (`contracts.json` と `uc-index.yaml`) から関与ティアを確定し、
`use-cases.yaml` の該当行の `tiers` に書き戻す (d2-run の write-set)。以後はこの `tiers` だけを読む。
`tiers_hint` (要求段階の推定) は slice が無い間の仮値であり、slice と食い違えば slice を優先する。
red baseline は関与する全ティアが落ちなければ成立しない (unit コマンド未定義のティアがあれば fail)。

## 人レビュー (review 段階)

1. 材料: `reports/gates.json` (static の `advisory` があれば依存の脆弱性として載せる)、全ティアの findings (major / minor。「他 UC への波及」の `cross_uc_change` を含む)、AssumptionRecord と verdict、`issues/`、
   contract の done の `contract_changes` のうち「他の UC にも効く変更」(`also_used_by` の付いた own、`other_uc`、`shared`)
2. `validateAssumptions.js evidence <tier>:<assumptions_sha256>:<verdicts_sha256> ...` で `assumption_evidence_sha256` を算出する
3. human-html-review で確認ページを作る (auto でも必ず人に返す。recommend は下の推奨で答えて記録し、最後のまとめに載せる)。問いの順:
   - 何を作ったか (シナリオの結果、ゲートの結果)
   - **回答必須の前提** (verdict が spec_absent / unlisted で、category か verified_category が security / persistence のもの)。
     1 件ずつ「承認 / 実装を直す / 要求を直す」を選ばせる (推奨: 検証役の verdict が `contradicts` でなければ承認、`contradicts` なら実装を直す)
   - 回答任意の前提 (未回答は auto_confirmed)
   - Verifier の major / minor と issues (戻し先の案を添える)、レビューで反証した指摘と直した指摘、人に返す問い
   - 他の UC にも効く変更 (共有の契約の生成物と、前の UC の振る舞いが変わる箇所)
   - 判断: 「この実装で進めてよいか」
4. 回答を受けたら:
   - 「実装を直す」が 1 件でもあれば `review_rejected {rejected_assumptions}` を記録し、`rewind <run> implementation` で該当ティアを tier に戻す
   - 「要求を直す」があれば `issues/` に下書き (`target_step: requirements`) を書き、routing.md「上流で止めるとき」の手順で止める
     (review は done にしない。要求の差分が課題を反映した後、写し直して scenario から続ける)
   - 承認なら、全ティアの `record` / `verdicts` を再実行して hash が一致することを確認してから
     `review_approved {assumption_decisions[], assumption_evidence_sha256, gates_result, head}` を記録する (`head` は承認した時点の `git rev-parse HEAD`。main マージ 1 の人の修正の判定に使う)。不一致なら承認を記録せず verify から再実行
5. 回答は `events.jsonl` と決めたことの記録 (`decisionLog.js add --run <run> --page page:review:...`) に記録する (review-notes ファイルは持たない)

## main マージ (deliver 段階)

手順の git の約束は [references/git-delivery.md](references/git-delivery.md)。

1. main マージ 1 は 3 つの作業をこの順で行う:
   1. **件名の検査** (最初に): `git log <base_head>..HEAD --format=%s` がすべて `impl(<slug>): ` か `req(<slug>): ` で始まる。そうでなければ UC 外の commit が混ざっているので、gates.json の作り直しも課題ファイルの commit もせず止まって報告する (混ざった commit の一覧を添える)。
      止まった後は人が混入した commit を落とし (rebase)、再開は main マージ 1 から (git-delivery.md「squash」1)
   2. **gates.json の作り直し**: 先に**人の修正**を判定する: 最後の `review_approved` の `head` から HEAD までに、実装のフォルダの変更があれば (`git diff --name-only <head>..HEAD -- apps packages contracts features ':!**/package.json' ':!**/package-lock.json'` が空でない)、
      承認の後に人がコードを直したので `node runState.js invalidate <run> verify "<理由>" --from` で verify 以降を退避し、`runGates.js --uc <slug> --tiers <tiers>` で全段 (トレースも) を作り直してから verify からやり直す (検証・人レビュー・as-built が直した後のコードの記録を読む。依存の一覧と検査の設定だけなら次のゲートで見る)。`head` が無い承認 (0.1.34 まで) は判定せず、完了報告に「判定できない」と書く。
      次に、古さは比べず、**常に** `runGates.js --uc <slug> --tiers <use-cases.yaml の tiers>` で全段を 1 回通して記録を作り直す (最後に全段を通した後に as-built と人レビューの commit が入るので、比べても必ず古い)。
      作り直す前の控え: `reports/gates.json` があれば runGates の前に `reports/gates.prev.json` に写す (前の控えは上書きする)。無ければ (gitignore なので再開で消えていることがある)、残っている控えを `node -e "require('fs').rmSync('<run>/reports/gates.prev.json',{force:true})"` で消す (古い控えを今回の「前回」として報告しない)。
      作り直しの runGates が落ちたら、まず ④ の「ゲートの回し直し」のとおり 1 回だけ回し直す (static は回し直さない)。
      それでも落ちたら、**推測で直さず止まって報告する**。報告に添えるもの: 落ちたゲート名と job (`gates.json` の `output_tail` / `failed_tests`)、指摘の対象ファイルが UC の変更 (`git diff --name-only <base_head>..HEAD`) に含まれるか。含まれなければ「UC と無関係の可能性 (検査の規則や情報の更新など。コードを変えていなくても落ちる)」と書く。
      static で落ちたときは、落ちた job の検査 (qlty の plugin 名。`output_tail` に出る) が UC の変更で `.qlty/qlty.toml` に足されたかも添える (`git diff <base_head>..HEAD -- .qlty/qlty.toml` に `name = "<plugin>"` の追加があるか)。足されていれば「この UC で検査の範囲が広がり、既存のコードや依存への指摘が初めて出た可能性」と書く。plugin 名が `output_tail` から特定できない (出力が末尾で切れた、qlty 以外の job で落ちた) ときは「判定できない」と書き、足されたか / いないかを推測で断定しない。
      人が直すときは **feature の上で** (依存の更新、または `.qlty/qlty.toml` の `[[ignore]] rules = ["<plugin>:<id>"]`) 件名 `impl(<slug>): <内容>` で commit し、main マージ 1 から再開する (コードに及べば 2 の判定で verify から、そうでなければ 2 で gates.json が作り直される)。main で直して feature を rebase しない (`base_head` は開始時の記録のまま更新されないので、main 側の修正 commit が `<base_head>..HEAD` に入り、1 の件名の検査で止まる。通っても squash がその修正を UC の 1 commit に畳む)
   3. **条件の確認**: `review_approved` が有効 (= `runState.js status` で review が done、かつ events で最後の `review_approved` より後に `stage_invalidated {stage: review}` も `review_rejected` も無い)、`reports/gates.json` が `all_recorded: true` で全段 pass、findings の open blocker 0。
      次に feature の上で `node <skills>/d2-common/scripts/feedbackBatch.js file-issues <run> --cwd <リポのルート>` を回し、UC の課題 (`issues/*.md`) を課題ファイル `docs/feedback/<issue>.md` にする (`feedback_filed` も記録する)。
      `runState.js status` の `unfiled_issues` が空であることを確かめる (課題の取りこぼしはこれで確かめる。前の main マージ 1 で課題ファイルにした課題は `filed` に出ないので、止まって再開した main マージでは `filed` が空でよい)。結果の `filed` が空でなければ `genDocsReadme.js` を回し、`git add -A -- docs .distillery/runs/<slug>` して `impl(<slug>): issues to feedback` で commit する (squash で UC の 1 commit に入る。main に別の commit を足さない)。
      `filed` が空 (課題 0 件) なら commit を作らない (`docs/feedback/` が無いことがあり、パスを名指しすると `git add` が落ちる)。
      開き直した UC (`.distillery/archive/runs/<slug>/` の最新の `reopened.json` に `issues` がある) と、run に `carried_issues` がある UC なら、その課題ファイルを `git rm` して同じく commit に入れ、squash の本文に `Feedback-Consumed: <課題>` を足す
2. remote `origin` があれば `git fetch origin` し、`origin/main` が `main` の祖先か同じ (`git merge-base --is-ancestor origin/main main`) であることを確かめる。
   そうでなければ止まって報告する (他の人が main を進めた。rebase は人が判断)
3. 件名は 1 で検査済み → 復旧用 ref (`refs/distillery2/pre-squash/<slug>/<timestamp>`。`<timestamp>` は `date -u +%Y%m%dT%H%M%SZ`) → `git reset --soft <base_head>` →
   `node runState.js uc-status <リポのルート> <slug> done` で `use-cases.yaml` の該当行を `status: done` にする (手で編集しない。`review_approved` に `carry_over.carry` が残る run (0.1.30 形式) でも読まずに main マージし、完了報告に「持ち越し N 件は次の起動で要求の差分に載る」と書く。main マージ後の起動の自動選択 3 の 4 が `carry_over_pending` で拾う) → stage → prTrailers で本文 → `git commit -F <本文>` (exactly 1 commit)。
   手順の詳細は git-delivery.md「squash」
4. 引数が `merge=hold` なら、ここで止めて報告する (引数なしで再開すれば 5 から)
5. `git switch main` → `git merge --ff-only feature/<slug>`。ff できなければ (main が `base_head` から進んでいる) 止まって報告する
6. main の上で、④ の冒頭で遅らせた場合だけ `models_resolved` を記録し (遅らせた = run の events に解決済み ID の `models_resolved` が無い。冒頭で記録済みなら記録しない)、`genDocsReadme.js` で `docs/README.md` を更新し (UC 一覧の状態列が `status: done` を見て「main マージ済み」になる)、
   `node runState.js done <run> deliver '{"squash":"<squash commit のフル sha (git rev-parse HEAD)>","base_head":"<base_head>"}'` を実行して、`git add -A -- docs .distillery/runs/<slug>` (main マージの done・events・README・課題一覧の README。新規と削除を含む。`docs/feedback/` は無いことがあるので名指ししない) してから
   まとめて `impl(<slug>): delivered` で commit する (main マージ済みの正は `stages/deliver.done.yaml`)
7. remote `origin` があれば `git push origin main`。拒否されたら止まって報告する (force push はしない。再開すると起動シーケンス 4 でやり直す)
8. `git branch -d feature/<slug>`

再開 (main マージの done が無いとき): feature が `base_head` から 1 commit で、その commit が main に含まれていなければ 4 から (squash 済み)。含まれていれば 6 から。

**旧形式の run** (0.1.25 まで。還流の done があり main マージの done が無い。`runState.js status` の `legacy_order: true`): 次の段階は出ない。
確認ページで人に聞く (問い: この UC は main マージ済み (PR が merge 済み) か)。「main マージ済み」なら **main に切り替えて** (`git switch main`。remote `origin` があれば `git pull --ff-only origin main` で
PR の merge を取り込む)、main 上の run に `node runState.js mark-legacy-delivered <run>` で main マージの done (`legacy: true`) を作り (起票されていない課題があれば、旧形式の還流の done も退避される。結果の `feedback_reopened`)、
`impl(<slug>): legacy delivered` で main に commit する。`feature/<slug>` が残っていれば `git update-ref refs/distillery2/legacy/<slug>/<ts> feature/<slug>` で退避してから `git branch -D feature/<slug>` (`<ts>` は `date -u +%Y%m%dT%H%M%SZ`)
(squash merge で入れた feature は main の祖先でないことがあり `-d` では消せないので、常に退避してから `-D`。残すと自動選択が進行中の UC とみなして毎回戻る)。その後は自動選択をもう一度呼ぶ (commit と削除の間で止まっても、自動選択の `cleanup` が片付ける)
(PR は squash merge されていて feature とは別の履歴なので、feature に commit しても main に載らない)。main 上の run が旧形式でなければ (PR の merge がまだ取り込めていない) 止まって報告する。「まだ」なら `node runState.js invalidate <run> feedback <理由>` で還流の done を退避し、`impl(<slug>): reorder stages` で commit して、新しい順で main マージから続ける (旧形式で起票済みでない課題は還流で処理し直す)。
旧形式の還流の記録 (`feedback_filed` の `url`) は起票済みとして数える。

## 課題ファイル

- 置き場所: `docs/feedback/<issue>.md`。front matter は `kind` (互換)・`target_step` (戻し先: requirements / decide / foundation / scenario / contract / implementation)・`title`・`from_uc` (slug)・`status: open`・`created`。本文は課題の本文
- 振り分けは [references/routing.md](references/routing.md)「前のステップの課題」。上流 (要求・決定・基盤) は上流の差分、main マージ済みの UC への課題は開き直し (`reopen_targets`)
- `kind: plugin` (プラグインへ持ち帰る課題): 自動選択のきっかけにしない。distillery2 を直した後に人が `git rm` して commit する。完了報告に一覧を載せる (`scan` の `plugin`)
- UC の課題は main マージのときに `feedbackBatch.js file-issues` が課題ファイルにする (squash の 1 commit に入る)。上流で止めるときは routing.md「上流で止めるとき」の手順で一時の worktree から main へ入れる。課題の `resume_from` (scenario / contract / implementation) は写し直した後に続ける段
- 一覧 `docs/feedback/README.md` は genDocsReadme が生成する (`docs/README.md` には件数と種類ごとの内訳と一覧へのリンクだけ)
- 消すのは反映したとき (routing.md「課題の消し方」)。中身は git の履歴に残る

## 完了報告

段階ごとに: 何をしたか、ゲート結果、人の判断が要るなら確認ページの URL、次にすること。
④ の main マージの後は、main に入った commit・課題ファイルにした課題・復旧用 ref・依存の脆弱性 (gates.json の `advisory`。あれば)・レビューの結果 (場所ごとの判定と、反証した / 直した指摘の数。未レビューと同じモデルの代わりがあれば必ず) を報告して終了する。`reports/gates.prev.json` (main マージ 1 の 2 の控え) があり、その中で落ちていたゲート・job があれば、今回の gates.json でそれぞれ pass かも書く (無ければ書かない) (次の機能へは自動で続けない。次の起動の自動選択が、溜まった課題があれば上流の差分か開き直し、無ければ次の UC を選ぶ)。
上流の差分と写し直しの後は、報告を控えて自動選択をもう一度呼んで続ける (止めた機能へ同じ起動で戻る)。
要求の差分の報告には、残った作業の処遇 (対応した `design` の項目と変えた / 消したファイル、閉じた前提、無視した項目、対応づけられなかった項目)、「仮に決めた反映」と「決定と違う反映」も載せる。
決定・基盤の差分の後は、反映した課題・取り下げた課題・やり直す UC・プラグインへ持ち帰る課題 (`scan` の `plugin`)・依存の脆弱性 (static の gates.json の `advisory`。あれば)・main に入った commit を報告に控える。
`mode=recommend` で起動したときは、どの段でも完了報告の最後に、推奨で決めたものの一覧の確認ページ 1 枚 (`decisionLog.js list --root . --since <起動の時刻> --format md` を材料に。仮置きと、同じモデルで代わりにレビューしたものを目立たせる) を出す。

## 参照

- [../d2-common/references/config-schema.md](../d2-common/references/config-schema.md) — `.distillery/config.yaml`
- [references/run-state.md](references/run-state.md) — events / done / attempt
- [references/direct-io.md](references/direct-io.md) — d2-run が直接読み書きするもの (処理ごと)
- [references/subagent-template.md](references/subagent-template.md) — 派遣の変数と write-set
- [references/routing.md](references/routing.md) — モード・人に返すとき・引き継ぎファイル・前のステップの課題・上流の差分・縦横レビュー
- [references/git-delivery.md](references/git-delivery.md) — branch / squash / main への取り込み / worktree / trailer
- [references/troubleshooting.md](references/troubleshooting.md) — 実行環境 (headless の許可、npm、補助スクリプト) で踏んだ問題と回避策
- `<skills>/d2-common/scripts/runGates.js`、`prTrailers.js`、`tokenReport.js`、`handoff.js`、`decisionLog.js`、`reviewStep.js`
