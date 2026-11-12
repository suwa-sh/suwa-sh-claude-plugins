---
name: d2-run
description: >-
  distillery2 のオーケストレータ。要求→決定→基盤→UC 縦切りの段階を振り分け、サブエージェントを派遣し、
  ゲートを安い順に実行し、人の判断が要る場面だけ確認ページ (human-html-review) を出す。
  UC 単位で 1 commit に squash して main へ取り込む (PR / issue は作らない。git とファイルだけで完結する)。通常はこのスキルだけ呼べばよい。
  「要求から実装まで回して」「次の UC を実装して」「<UC 名> を実装して」などで発動。
---

# d2-run

distillery2 の進行役である。
要求から main マージまでを、段階ごとの担当 (サブエージェント) に派遣して進める。
自分は、派遣、受理の検査、ゲートの実行、git の操作、人への確認だけを行う。

通常は、このスキルだけを呼べばよい。
PR / issue は作らない。
git とファイルだけで完結する。

## 引数

```
/d2-run                                   # 次に必要な段階を自動で選ぶ
/d2-run stage=requirements input=<要望テキスト>
/d2-run stage=decide | stage=foundation
/d2-run uc=<slug | UC 名>                 # 指定 UC の縦切り (中断からの再開も同じ)
/d2-run uc=<slug | UC 名> merge=hold      # main へ取り込む手前で止める (headless 用。引数なしで再開すると取り込みから続く)
/d2-run ... mode=auto | mode=recommend    # どの起動にも付けられる。既定 auto
```

| mode | 進み方 |
|---|---|
| `auto` (既定) | 推奨で進み、不明点と課題は人に返す |
| `recommend` | 推奨で進めて、最後にまとめて見せる |

mode の細目は [references/routing.md](references/routing.md) にある。

`merge=hold` を config に置かない理由: config は追跡ファイルで、③ の仕上げで再生成される。
書き換えると作業ツリーが汚れ、再生成で値が戻る。

パスの `<skills>` は、スキル群のディレクトリを指す。
定義は [../d2-common/SKILL.md](../d2-common/SKILL.md) の「パスの書き方」にある。

## 全体の流れ

| 段階 | すること | 手順 |
|---|---|---|
| ① 要求 | 要望を要求に分解し、人が承認する | [references/stage-requirements.md](references/stage-requirements.md) |
| ② 決定 | 非機能グレード表と ADR を作る | [references/stage-decide.md](references/stage-decide.md) |
| ③ 基盤 | 開発ルール、テスト基盤、契約の骨格、画面部品を作る | [references/stage-foundation.md](references/stage-foundation.md) |
| ④ UC の縦切り | UC を 1 つずつ、シナリオから main マージまで進める | [references/stage-uc.md](references/stage-uc.md) |

④ の中の段階は scenario → contract → scaffold → tier → contract-gate → integrate → verify → review → asbuilt → deliver である。
review の手順は [references/review.md](references/review.md)、deliver の手順は [references/main-merge.md](references/main-merge.md) にある。

どの段階を行うかは、下の「自動選択」が決める。
選ばれた段階の手順の文書を、その段階を始める前に全部読む。

## 自動選択

自動選択 (起動時に作業 branch と段階を決める): `node <skills>/d2-common/scripts/nextAction.js <リポのルート> [--uc <slug>] [--stage <段>]` を呼ぶ (読むだけ。JSON 1 行の `action`)。
下の表の手順を行ったら、**起動を終えずにもう一度呼ぶ** (上流の差分・写し直しの後も同じ起動で続ける)。
名指し (`uc=` / `stage=`) は片付けの後に、進行中・途中・写し直し待ちのものが別にあれば `refuse` になる。
止まるのは `refuse`・`none`・人に返す場面だけ。

| action | すること |
|---|---|
| `requirements` / `decide` / `foundation` | ① / ② / ③ |
| `cleanup` | `features` ごとに、その feature を checkout していれば clean を確かめて `git switch main`。`legacy: true` なら `git update-ref refs/distillery2/legacy/<slug>/<ts> feature/<slug>` で退避してから `git branch -D`、それ以外は `git branch -d`。`upstream` の branch は `git branch -d` |
| `continue-feature` | その UC の ④ を続ける (起動シーケンス 4〜5) |
| `resume` / `finish-resume` | 写し直し (routing.md「写し直し」)。終わったらその UC の ④ を続ける |
| `continue-upstream` | その branch で上流の差分を続ける (routing.md「上流の差分」) |
| `switch-main` | clean なら `git switch main` (clean でなければ整理を依頼して止まる) |
| `push` | `git push origin main` → `git push origin 'refs/distillery2/*:refs/distillery2/*'` (控えの ref も残す。拒否されたら止まって報告する。force push はしない) |
| `legacy` / `migrate` / `batch` | main-merge.md「旧形式の run」/ 下の「移行」/ routing.md「途中で止まった還流」 |
| `limit-chain` | 人に返す (`page:limit:chain:<chain>`。推奨は止めて見直す。続けるなら答えを「続ける」で記録する) |
| `requirements-diff` / `decide-diff` / `foundation-diff` | stage-requirements.md「要求の差分」/ routing.md「上流の差分」 |
| `reopen` | `node runState.js reopen <リポのルート> <uc> --from <from> --issue <docs/feedback/<id>.md> ...` を `impl(<uc>): reopen` で commit して、その UC の ④ (exit 3 は人に返す) |
| `uc` | その UC の ④ (`reopened: true` は stage-requirements.md「やり直し」) |
| `delivered` / `refuse` / `none` | 報告して終わる (`delivered` で `notes.uncovered_done` に入っていれば stage-requirements.md「やり直し」。`refuse` は `pending` か `waiting_on` を添える。`none` は `notes` の `uncovered_done`・`plugin`・`paused` を載せる) |

判定の順 (進行中の機能 → 途中の写し直し・上流の直し → push → 写し直し待ち → 旧形式・移行 → 連鎖の上限 → 上流の課題 → 開き直し → 次の機能) はスクリプトの冒頭が正。

移行 (`migrate`): run ごとに `FB file-issues <run>` → `genDocsReadme.js` → `git add -A -- docs .distillery/runs/<slug>` → `impl(<slug>): issues to feedback` で main に commit する (remote `origin` があれば push)。
`FB` = `node <skills>/d2-common/scripts/feedbackBatch.js --cwd <リポのルート>` である。
サブコマンドは `FB` の直後に書き、JSON 1 行を返す。

課題の振り分け:

- 課題は戻し先のステップ (`target_step`。無い古い課題は `kind` から) で振り分ける (routing.md「前のステップの課題」)。0.1.x の還流で止まった課題 (`stopped: true`) も同じに扱う
- 要求の差分で人が「残す」とした課題 (`hold`) は、その差分のきっかけにしない (ほかの課題で回すときに一緒に読む)
- プラグインへ持ち帰る課題 (`kind: plugin`) はきっかけにしない (`scan` の `plugin` は報告に載せるだけ)
- 上流の差分は main を進める。上流で止めた機能は、止めた課題がすべて main から消えたら (反映か取り下げ) 新しい main の上に写し直して続ける (`resume`)

## 原則

| 原則 | 内容 |
|---|---|
| 入口の文書を更新する | `docs/README.md` は上流から下流まで辿る入口。`<skills>/d2-common/scripts/genDocsReadme.js` が既存の正本から生成する。各段階の commit 前に更新する |
| 本文を読まない | **自分では本文をほぼ読まない**。読むのは `.distillery/config.yaml`、`use-cases.yaml`、run の events / done / reports、サブエージェントの報告だけ |
| 委譲する | 各段階は fresh なサブエージェントに委譲する ([references/subagent-template.md](references/subagent-template.md)) |
| git は自分だけ | **git 操作は自分だけが行う** (単一コミッタ)。サブエージェントには git 禁止を必ず伝える ([references/git-delivery.md](references/git-delivery.md)) |
| attribution を付ける | 自分が作るすべての commit に attribution 行を trailer で付ける (git-delivery.md「commit の attribution」) |
| 実行状態はファイルに持つ | 実行状態は `.distillery/runs/<slug>/` の events + done ([references/run-state.md](references/run-state.md))。操作は `<skills>/d2-common/scripts/lib/runState.js` を通す。status ファイルは持たない |
| 人への確認は確認ページで | 人に確認するときは **必ず `human-html-review`** で確認ページを作り、showme の URL とローカルパスを示す |
| 引き継ぎファイルを処理する | 担当を受理するたびに引き継ぎファイル (人に聞くこと・前のステップの課題) を処理する (routing.md「引き継ぎファイルの処理」)。報告の本文に書かれただけの問いや課題は扱わない |
| レビューを回す | 成果物ごとに 7 か所で、別系統のモデルの縦・横レビューを回す (routing.md「縦・横レビュー」) |
| 上流を再生成しない | 上流 (要求・ADR・契約) の再生成はしない。ズレは `basis.js check` で見つけ、戻し先付きの課題にして routing.md の振り分けで直す |

`genDocsReadme.js` が書き換えるのは、管理ブロックの中だけである。
人が書いた部分と distillery2 以外の文書は触らず、名前だけ列挙する。

確認ページの決まり:

- 内部 ID (uc_id、SPEC-xxx、段階名) を本文に出さず名前で呼ぶ
- 回答は選択肢からコピーできる形にする
- 人に返すかどうかはモードで決める ([references/routing.md](references/routing.md)「人に返すとき」)
- どの確認ページの問いにも推奨 (初期選択) を書き、推奨で決めたものも人が答えたものも `decisionLog.js` で記録する

詰まったら各スキルの `references/troubleshooting.md` (環境依存の症状と回避策) を見る: 索引は [../d2-common/references/troubleshooting.md](../d2-common/references/troubleshooting.md) (d2-run / d2-foundation / d2-contract)。
手順に無い回避策を使ったら報告に書く。
手順書に書いていない場面で迷ったら、d2-run の troubleshooting の「手順書に書いていない扱い」を見る。

## d2-run が直接読み書きするもの

サブエージェントに任せず、d2-run 自身と d2-run が回すスクリプトが読み書きするものは [references/direct-io.md](references/direct-io.md) (処理ごとに 1 行)。
入出力の正本は [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) (図は [dataflow.md](../d2-common/references/dataflow.md))。

## 起動シーケンス

| 順 | すること |
|---|---|
| 1 | 引数を解釈し、上の自動選択で段階を決める (`uc=` / `stage=` の名指しも `nextAction.js` に渡す) |
| 2 | `.distillery/config.yaml` があれば読み、`models.implementer` と `models.verifier` を解決する |
| 3 | ④ なら UC を解決する |
| 4 | ④ の再開で、旧形式の run なら「旧形式の run」に従う |
| 5 | 作業ツリーの clean 判定をする (④ と上流の差分の開始時) |

手順 2〜5 の細目は [references/startup.md](references/startup.md) にある。
起動のたびに、手順 2 を行う前に読む。

## 完了報告

段階ごとに: 何をしたか、ゲート結果、人の判断が要るなら確認ページの URL、次にすること。

| 場面 | 報告に載せるもの |
|---|---|
| ④ の main マージの後 | main に入った commit・課題ファイルにした課題・復旧用 ref・依存の脆弱性 (gates.json の `advisory`。あれば)・レビューの結果 (場所ごとの判定と、反証した / 直した指摘の数。未レビューと同じモデルの代わりがあれば必ず) を報告して終了する |
| 上流の差分と写し直しの後 | 報告を控えて自動選択をもう一度呼んで続ける (止めた機能へ同じ起動で戻る) |
| 要求の差分 | 残った作業の処遇 (対応した `design` の項目と変えた / 消したファイル、閉じた前提、無視した項目、対応づけられなかった項目)、「仮に決めた反映」と「決定と違う反映」も載せる |
| 決定・基盤の差分の後 | 反映した課題・取り下げた課題・やり直す UC・プラグインへ持ち帰る課題 (`scan` の `plugin`)・依存の脆弱性 (static の gates.json の `advisory`。あれば)・main に入った commit を報告に控える |

④ の main マージの後は、次の機能へは自動で続けない。
次の起動の自動選択が、溜まった課題があれば上流の差分か開き直し、無ければ次の UC を選ぶ。

`reports/gates.prev.json` (main マージ 1 の 2 の控え) があり、その中で落ちていたゲート・job があれば、今回の gates.json でそれぞれ pass かも書く (無ければ書かない)。

`mode=recommend` で起動したときは、どの段でも完了報告の最後に、推奨で決めたものの一覧の確認ページ 1 枚 (`decisionLog.js list --root . --since <起動の時刻> --format md` を材料に。仮置きと、同じモデルで代わりにレビューしたものを目立たせる) を出す。

## 細目の文書

| 文書 | 読むとき | 内容 |
|---|---|---|
| [references/startup.md](references/startup.md) | 起動のたび (起動シーケンスの手順 2 の前) | モデルの解決、UC の解決、作業ツリーの clean 判定 (④ と上流の差分の開始時) |
| [references/stage-requirements.md](references/stage-requirements.md) | ① 要求、要求の差分、やり直しの前 | 要求の段階の手順 |
| [references/stage-decide.md](references/stage-decide.md) | ② 決定の前 | 決定の段階の手順 |
| [references/stage-foundation.md](references/stage-foundation.md) | ③ 基盤の前 | 基盤の段階の手順と、仕上げの受理時の検査 |
| [references/stage-uc.md](references/stage-uc.md) | ④ UC の縦切りの前 | 段階ごとの派遣、受理の検査、done の条件。ゲートの回し直し、関与ティアの決め方 |
| [references/review.md](references/review.md) | review 段階の前 | 人レビューの材料、問いの順、回答の扱い |
| [references/main-merge.md](references/main-merge.md) | deliver 段階の前 | main マージの手順、再開、旧形式の run |
| [references/issues.md](references/issues.md) | 課題ファイルを扱うとき | 課題ファイルの置き場所、形、消し方 |
| [references/routing.md](references/routing.md) | 人に返すか迷うとき、担当を受理するとき、課題を振り分けるとき | モード・人に返すとき・引き継ぎファイル・前のステップの課題・上流の差分・縦横レビュー |
| [references/subagent-template.md](references/subagent-template.md) | 派遣する前 | 派遣の変数と write-set |
| [references/run-state.md](references/run-state.md) | 実行状態を読み書きするとき | events / done / attempt |
| [references/git-delivery.md](references/git-delivery.md) | git を操作する前 | branch / squash / main への取り込み / worktree / trailer |
| [references/direct-io.md](references/direct-io.md) | 入出力を確かめるとき | d2-run が直接読み書きするもの (処理ごと) |
| [references/troubleshooting.md](references/troubleshooting.md) | 詰まったとき | 実行環境 (headless の許可、npm、補助スクリプト) で踏んだ問題と回避策 |
| [../d2-common/references/config-schema.md](../d2-common/references/config-schema.md) | 実行設定を読むとき | `.distillery/config.yaml` |

使うスクリプト: `<skills>/d2-common/scripts/runGates.js`、`prTrailers.js`、`tokenReport.js`、`handoff.js`、`decisionLog.js`、`reviewStep.js`
