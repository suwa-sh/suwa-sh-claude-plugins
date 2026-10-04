# サブエージェント派遣テンプレート (d2-run)

各段階の作業は fresh なサブエージェントに委譲する。**パスと最小の引数だけを渡し、ファイル本文を貼らない**
(オーケストレータのコンテキストを守るため。v1 と同じ原則)。長い固定指示は各スキルの references のファイルを
絶対パスで指し、サブエージェント側に読ませる。

## 共通テンプレート

```
あなたは {role} です。

まず Skill ツールで "{skill_name}" スキルを呼び出してください。{skill_args}

スキルの指示に従い、全ステップを完了してください。
制約:
- AskUserQuestion を使わないでください。人の判断が必要なら、質問と選択肢を結果として返してください
- git コマンド (add / commit / push / switch 等) を実行しないでください。コミットはオーケストレータが行います。
  例外: 手順書が回すスクリプトの内部の git (読み取りの rev-parse / diff / ls-files と、genQlty.js が qlty init に未追跡ファイルを見せるための一時的な `git add -N`。終わったら index を書き戻す) はそのまま回してよい
- 書き込みは次の write-set 内に限定してください: {write_set}
  それ以外への書き込みが必要になったら、作業を止めて理由を結果として返してください
- YAML を書くときは、値に `: ` や括弧を含む文字列を必ずクォートし、書き終えたら parse 確認してください
{additional_instructions}
完了後、生成・更新したファイル一覧と結果の要点を報告してください。
```

## 段階ごとの変数

| 段階 | role | skill_name / skill_args | model | write-set | additional_instructions |
|---|---|---|---|---|---|
| ① 要求 | 要求の整理役 | `distillery2:d2-requirements` `input=<要望テキスト>` (要求の差分のときは `input=<未処理の要求の課題ファイルのパス (すべて)>`) | 既定 | `docs/requirements/**` | なし |
| ② 決定 | 品質特性と設計の決定役 | `distillery2:d2-decide` | 既定 | `docs/nfr/**`、`docs/adr/**` | なし |
| ③ 基盤 (機械) | 基盤の生成役 | `distillery2:d2-foundation` `phase=all` | 既定 | `docs/rules/**`、`.dependency-cruiser.cjs`、`packages/test-support/**`、`features/support/**`、`cucumber.js`、`tsx-register.js`、`.distillery/config.yaml`、`.github/workflows/**`、`.qlty/qlty.toml`、`apps/*/`、`packages/*/`、`package.json`、`tsconfig.base.json`、`.gitignore`、`biome.json`、`package-lock.json`。例外: `npm install` が作る `node_modules/**` (gitignore) | なし |
| ③ 契約骨格 | 契約の設計役 | `distillery2:d2-contract` `mode=skeleton` | 既定 | `contracts/**` | なし |
| ③ 画面部品 | デザインシステムの生成役 | `distillery2:d2-design` | 既定 | `docs/design/**` | なし (`packages/ui/` への取り込みは d2-foundation phase=finish が F6 で行う) |
| ③ 基盤 (仕上げ) | 基盤の仕上げ役 | `distillery2:d2-foundation` `phase=finish ui=<true/false>` | 既定 | `.distillery/config.yaml`、`.github/workflows/**`、`docs/adr/architecture.md`、`packages/ui/**`、`package-lock.json`、`.qlty/qlty.toml`、`apps/*/test/contract/**`、`packages/contracts/**`、`<run>/reports/**` (チェックポイントが書く。slug は bootstrap)。例外: `npm install` が作る `node_modules/**` (gitignore) | チェックポイント (F9) が exit 0 でなければ直さずに報告して止まる |
| ④ scenario | UC シナリオの執筆役 | `distillery2:d2-implement` `mode=scenario uc=<slug>` | 既定 | `features/<業務>/<slug>.feature`、`features/acceptance/**`、`<run>/issues/**` | 固定指示: `<skills>/d2-implement/references/scenario.md` |
| ④ contract | 契約の差分役 | `distillery2:d2-contract` `mode=uc uc=<slug>` | 既定 | `contracts/**`、`apps/*/test/contract/**`、`apps/<datastore_owner>/migrations/**`、`packages/contracts/**`、`<run>/issues/**` | なし |
| ④ scaffold | テスト足場の生成役 | `distillery2:d2-implement` `mode=scaffold uc=<slug>` | 既定 | `features/step_definitions/**`、`apps/<tier>/src/**/*.test.ts`、`apps/<tier>/src/**` (テストが import する入口の最小スタブ。**新規ファイルだけ**。既存ファイルの変更・削除は不可)、`<run>/reports/**` (完了条件の `--expect-red unit` が書く。単独の段なので競合しない) | 固定指示: `<skills>/d2-implement/references/scaffold.md` |
| ④ tier (ティアごと並列) | `<tier>` の実装者 | `distillery2:d2-implement` `mode=tier uc=<slug> tier=<tier> attempt=<n>` | `models.implementer` | `apps/<tier>/**`、`<run>/attempt-<n>/assumptions.<tier>.yaml`、`<run>/issues/<ts>_<tier>_<slug>.md`。例外: ゲートの `{report}` の置き換え先に使う OS の一時ファイル (`mktemp` の結果。リポの外。使い終えたら削除) | 固定指示: `<skills>/d2-implement/references/tier-impl.md`。`runGates.js は使わない (記録付きのゲートは全ティアの受理後にオーケストレータが回す)` を追記。blocker 由来の再実行時のみ `findings: <run>/attempt-<n-1>/findings.<tier>.yaml` を追記 |
| ④ integrate | 結合の実装者 | `distillery2:d2-implement` `mode=integrate uc=<slug>` | 既定 | `features/step_definitions/**`、`features/support/**`、`<run>/reports/**`、`<run>/traces/**` (完了条件の runGates が書く。integrate は単独の段なので競合しない) | 固定指示: `<skills>/d2-implement/references/integrate.md`。attempt ≥ 2 のときは `差し戻しの再実行。結線の変更が不要なら、変えずに完了条件だけ確かめて「結線変更なし」と報告してよい` を追記。as-built から戻ったとき (`returned_to_integrate`) は `as-built の集計で計装が足りない: 計装なし <ティア> / 正常系に部品なし <ティア>。結線を足す` を追記 |
| ④ verify (ティアごと並列) | `<tier>` の Verifier | agent_type **`distillery2:d2-verifier`** / `distillery2:d2-verify` `uc=<slug> tier=<tier> attempt=<n> run=<run> assumptions=<path>` | **`models.verifier`** (implementer と同じモデルに解決されてもよい。条件は別サブエージェント + 同等以上のモデル。SKILL.md 起動シーケンス 2) | `<run>/attempt-<n>/findings.<tier>.yaml` | `変更ファイル一覧: <git diff --name-only base_head..HEAD の結果を 1 行ずつ>` と `他 UC と共有する変更ファイル (初期候補): <ファイル — 他 UC の slug を 1 行ずつ。無ければ「なし」>` (SKILL.md verify 行) |
| ④ asbuilt | as-built の抽出と要約役 | `distillery2:d2-asbuilt` `uc=<slug> run=<run>` | 既定 | `docs/as-built/<業務>/<UC>/**`、`docs/as-built/_system/**` (スクリプトの生成物。LLM が手で書くのは index.md の要約ブロックの中だけ)、`<run>/reports/**` (depcruise の結果と抽出の集計) | 依存グラフの実態 → 抽出 → 要約 → 検査までこのスキルが行う。抽出の標準出力 1 行を報告に転記する |
| 還流 (ADR) | ルールの穴の記録役 | `distillery2:d2-decide` `mode=feedback issue=<課題> result=<結果ファイル>` | 既定 | `docs/adr/**`、`.distillery/logs/feedback/<b>/<issue>.result.json` | 還流の worktree で派遣する (SKILL.md の還流節)。`作業ディレクトリ: <本体の .distillery/worktrees/feedback の絶対パス> (write-set はここからの相対。結果ファイルだけは本体のリポの絶対パス)`、`課題: <worktree の中の docs/feedback/<issue>.md の絶対パス>`、`結果ファイル: <本体の .distillery/logs/feedback/<b>/<issue>.result.json の絶対パス>` を追記 |
| 還流 (契約) | 契約の修正役 | `distillery2:d2-contract` `mode=feedback issue=<課題> result=<結果ファイル>` | 既定 | `contracts/**`、`apps/*/test/contract/**`、`apps/<datastore_owner>/migrations/**`、`packages/contracts/**`、`.distillery/logs/feedback/<b>/<issue>.result.json` | 還流の worktree で派遣する。`作業ディレクトリ: <本体の .distillery/worktrees/feedback の絶対パス> (write-set はここからの相対。結果ファイルだけは本体のリポの絶対パス)`、`課題: <worktree の中の docs/feedback/<issue>.md の絶対パス>`、`結果ファイル: <本体の .distillery/logs/feedback/<b>/<issue>.result.json の絶対パス>` を追記 |

`<run>` = `.distillery/runs/<slug>`。`<b>` = 還流のバッチ (`feedbackBatch.js start` が返す。branch `feedback/<b>`)。固定指示のパスは `<skills>/...` を絶対パスに展開して
`まず次のファイルを読み、記載の指示すべてに従ってください: <絶対パス>` の 1 行で渡す。

**残った作業の追記** (0.1.30 L10): `use-cases.yaml` の UC 行に `carry_over` (要求の差分で残った作業) があれば、④ の scenario・contract・tier・integrate の派遣文に
`要求の差分で残った作業: <項目を 1 行ずつ>。自分の write-set の中で済むものだけ行い、報告に項目ごとに「対応した (変えたファイル)」か「対応できない (理由。write-set の外など)」を書く` を追記する
(課題の起票は求めない。scaffold と integrate の write-set に `<run>/issues/` が無く、起票の指示と write-set の縛りを同時に守れないため。scaffold はテストの足場だけなので追記しない)。
d2-run は受理のとき、報告の項目ごとの対応状況を done の data の `carry_over_status` に保存する (SKILL.md ④ の冒頭)。

## サブエージェントの報告の扱い (捏造禁止)

- **サブエージェントの完了報告を自分で書かない。** 派遣した sub の実際の結果 (SendMessage / タスク通知) が返るまで待つ。「届いた体」で報告を代筆すると、実際には未完了の段階を完了扱いにして先へ進む逸脱になる (実走で発生)。
- **報告が無い = 未完了として扱う。** 完了の正は `<run>/stages/<stage>.done.yaml` と各成果物の存在・parse。done ファイルが無ければその段階は未完了。報告文の有無ではなく done と成果物で判定する。
- 報告が来ても、write-set 逸脱や必須成果物の欠落があれば受理しない (下記)。

## 受理時の検査 (d2-run が行う)

- write-set の逸脱: `git status --porcelain` で write-set 外の変更があれば退避して段階を failed にする
  (reports / traces は gitignore なので `git status` に出ない。write-set に含めない段で書かれていても検出できないため、派遣文の write-set で縛る)
- scaffold では加えて、既存の非テストファイルを変更・削除していないこと: `git diff --name-only --diff-filter=MD` に `*.test.ts` 以外の `apps/**/src/**` が無い
- 必須成果物の存在と parse (assumptions / findings は `validateAssumptions.js`)
- 基盤の仕上げと as-built は、サブの報告文ではなくファイルで受理する (SKILL.md の ③ 5 と asbuilt 行): `.distillery/runs/bootstrap/reports/gates.json` / `<run>/reports/asbuilt.json` と `checkAsBuilt.js`。どちらのファイルも派遣の前に消しておき、前回の結果で受理しない
- 還流の 2 行もファイルで受理する (SKILL.md の還流節)。「還流 (ADR)」と「還流 (契約)」は結果ファイル (`applied` / `absent` / `blocked`) で分岐し、結果ファイルは派遣の前に消す。
  write-set の逸脱は worktree の `git -C <worktree> status --porcelain` で見る (本体の作業ツリーは main のまま変わらない)。
  ルール・契約の生成物はサブが作り直しても commit しない (`feedbackBatch.js` が最後にまとめて作り直す)
- 完了報告が来なくても成果物 (done + ファイル) が正。存在と parse で完了判定してよい (検証の省略ではない)。逆に、報告だけあって done / 成果物が無ければ未完了として扱う
- 例外: ③ の画面部品 (d2-design) は完了報告 (部品を生成したか、画面を持たないため skip したか) が要る。前の実行の `docs/design/` が残っていると、成果物だけでは今回の生成と skip を区別できず、仕上げに渡す `ui=` を決められない。報告が無ければ未完了として再派遣する
- 例外: asbuilt は要約役の完了報告 (要約した 3 ブロックと、引用したコード位置の一覧) も要る。抽出は前回の要約ブロックを残すので、要約の前に止まっても集計ファイルと書式の検査は通ってしまい、成果物だけでは今回の要約を区別できない。報告が無ければ未完了として再派遣する
