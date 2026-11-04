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
- AskUserQuestion を使わないでください。人に聞きたいことと前のステップの問題は、引き継ぎファイル {handoff} に書いてください (書き方は <skills>/d2-common/references/handoff.md の絶対パス)。推奨は条件を付けずに 1 つ書いてください。報告の本文に書いただけでは扱われません
- git コマンド (add / commit / push / switch 等) を実行しないでください。コミットはオーケストレータが行います。
  例外: 手順書が回すスクリプトの内部の git (読み取りの rev-parse / diff / ls-files と、genQlty.js が qlty init に未追跡ファイルを見せるための一時的な `git add -N`。終わったら index を書き戻す) はそのまま回してよい
- 書き込みは次の write-set 内に限定してください: {write_set}   ← 下の「派遣ごとの write-set」のその段階の行 (正本から生成)。行はそのまま貼り (置き換えない。受理の検査は行の形で見る)、直後に置換部分の値を 1 行で添える (例 `<業務> = 蔵書管理業務、<slug> = register-book、<run> = .distillery/runs/register-book`。0.1.34 Q12)
  それ以外への書き込みが必要になったら、作業を止めて理由を結果として返してください。引き継ぎファイル {handoff} は write-set に関わらず書いてよい
- YAML を書くときは、値に `: ` や括弧を含む文字列を必ずクォートし、書き終えたら parse 確認してください
{additional_instructions}
完了後、生成・更新したファイル一覧と結果の要点を報告してください。自分で決めたことは、報告の「決めたこと」の見出しの下に 1 行ずつ `D<n> <要点>` で書き、引き継ぎファイルの `decisions` にも同じ `D<n>` で書いてください (ID の無い判断は受理されません)。
```

## 引き継ぎファイルの置き場 (`{handoff}`)

| 派遣 | 置き場 |
|---|---|
| run の無い段 (①②③・要求の差分) | `.distillery/handoff/<段>-<ts>.yaml` |
| 機能の各段 (④) | `<run>/handoff/<段>[-<tier>]-<ts>.yaml` |
| 検証役 (④ verify) | 渡さない (findings の `asks` と `upstream_issues` が代わり。schema 2.2) |

`<ts>` は派遣の時刻 (`date -u +%Y%m%dT%H%M%SZ`)。受理では `node <skills>/d2-common/scripts/handoff.js validate <file>` が exit 0 であること (無ければ不合格)。

## 段階ごとの変数

| 段階 | role | skill_name / skill_args | model | additional_instructions |
|---|---|---|---|---|
| ① 要求 | 要求の整理役 | `distillery2:d2-requirements` `input=<要望テキスト>` (要求の差分のときは `input=<未処理の要求の課題ファイルのパス (すべて)>`) | 既定 | 要求の差分のときだけ: `use-cases.yaml の carry_over (0.1.30〜0.1.31 の持ち越し) は廃止済み。再生成で消えてよい (手で戻さない)` (0.1.32 実走 P10)、`課題の外の論点も決めずに返さない。推奨の案で反映し「仮に決めた反映」に書く` (0.1.34 Q8) |
| ② 決定 | 品質特性と設計の決定役 | `distillery2:d2-decide` | 既定 | なし |
| ③ 基盤 (機械) | 基盤の生成役 | `distillery2:d2-foundation` `phase=all` | 既定 | なし |
| ③ 契約骨格 | 契約の設計役 | `distillery2:d2-contract` `mode=skeleton` | 既定 | なし |
| ③ 画面部品 | デザインシステムの生成役 | `distillery2:d2-design` | 既定 | なし (`packages/ui/` への取り込みは d2-foundation phase=finish が F6 で行う) |
| ③ 基盤 (仕上げ) | 基盤の仕上げ役 | `distillery2:d2-foundation` `phase=finish ui=<true/false>` | 既定 | チェックポイント (F9) が exit 0 でなければ直さずに報告して止まる |
| ④ precheck (ティアごと並列) | `<tier>` の点検役 | `distillery2:d2-implement` `mode=precheck uc=<slug> tier=<tier>` | 既定 | 固定指示: `<skills>/d2-implement/references/precheck.md`。`{handoff}` は `.distillery/logs/precheck-<slug>/<tier>.handoff.json` (git 管理外。main の上で回るので main を汚さない) |
| ④ scenario | UC シナリオの執筆役 | `distillery2:d2-implement` `mode=scenario uc=<slug>` | 既定 | 固定指示: `<skills>/d2-implement/references/scenario.md` |
| ④ contract | 契約の差分役 | `distillery2:d2-contract` `mode=uc uc=<slug>` | 既定 | なし |
| ④ scaffold | テスト足場の生成役 | `distillery2:d2-implement` `mode=scaffold uc=<slug>` | 既定 | 固定指示: `<skills>/d2-implement/references/scaffold.md` |
| ④ tier (ティアごと並列) | `<tier>` の実装者 | `distillery2:d2-implement` `mode=tier uc=<slug> tier=<tier> attempt=<n>` | `models.implementer` | 固定指示: `<skills>/d2-implement/references/tier-impl.md`。`runGates.js は使わない (記録付きのゲートは全ティアの受理後にオーケストレータが回す)` を追記。blocker 由来の再実行時のみ `findings: <run>/attempt-<n-1>/findings.<tier>.yaml` を追記 |
| ④ integrate | 結合の実装者 | `distillery2:d2-implement` `mode=integrate uc=<slug>` | 既定 | 固定指示: `<skills>/d2-implement/references/integrate.md`。attempt ≥ 2 のときは `差し戻しの再実行。結線の変更が不要なら、変えずに完了条件だけ確かめて「結線変更なし」と報告してよい` を追記。as-built から戻ったとき (`returned_to_integrate`) は `as-built の集計で計装が足りない: 計装なし <ティア> / 正常系に部品なし <ティア>。結線を足す` を追記 |
| ④ verify (ティアごと並列) | `<tier>` の Verifier | agent_type **`distillery2:d2-verifier`** / `distillery2:d2-verify` `uc=<slug> tier=<tier> attempt=<n> run=<run> assumptions=<path>` | **`models.verifier`** (implementer と同じモデルに解決されてもよい。条件は別サブエージェント + 同等以上のモデル。SKILL.md 起動シーケンス 2) | `変更ファイル一覧と他 UC と共有する変更ファイル (初期候補): <.distillery/logs/verify-<slug>-attempt-<n>.txt の絶対パス>` (d2-run が書く。1 行目から変更ファイル (`git diff --name-only base_head..HEAD` から `docs/README.md`・`docs/requirements/use-cases.yaml`・`docs/feedback/**` を除いたもの) を 1 行ずつ、空行、`共有の候補:` の後に `<ファイル> — <他 UC の slug>` を 1 行ずつ (無ければ「なし」)。件数に関わらず**常に**ファイルで渡す。SKILL.md verify 行。0.1.32 O16) と `実装者の固定指示: <パス>` (`<skills>/d2-implement/references/tier-impl.md` を絶対パスに展開して渡す。前提の照合先。d2-verify は他スキルの手順書を直接参照しないので d2-run が渡す。0.1.31) |
| ④ asbuilt | as-built の抽出と要約役 | `distillery2:d2-asbuilt` `uc=<slug> run=<run>` | 既定 | 依存グラフの実態 → 抽出 → 要約 → 検査までこのスキルが行う。抽出の標準出力 1 行を報告に転記する |
| ① 要求の差分 (画面部品) | 画面の見本の修正役 | `distillery2:d2-design` `mode=feedback items=<直すファイル (docs/design/storybook-app/src/<相対パス>。stories も部品も) と直す内容を 1 行ずつ>` | 既定 | 要求の差分の「残った作業」で人が「対応する」と選んだ `design` の項目だけ (SKILL.md 要求の差分 4)。③ の全生成はしない。報告に変えた / 消したファイルと項目ごとの「直した / 直せない (理由)」、項目が部品なら「影響する Story」(その部品から import を Story まで辿った一覧。0.1.32 実走 P11)、項目の外のファイルを変えたか消したら「項目の外の変更」(ファイルごとに、どの項目のための依存か。消したならどの項目で使われなくなったか。0.1.34 Q17)。取り込み直し (`importUi.js`) は d2-run が行う (0.1.32 J2) |
| ② 決定の差分 (ADR) | ルールの穴の記録役 | `distillery2:d2-decide` `mode=feedback issue=<課題> result=<結果ファイル>` | 既定 | 本体の作業ツリー (clean な main) で派遣する (worktree は使わない。routing.md「決定の差分」)。`課題: <docs/feedback/<issue>.md の絶対パス>`、`結果ファイル: <.distillery/logs/decide-<issue>.result.json の絶対パス>` を追記 |
| 反証して直す | レビューした場所の担当 (元の派遣と同じ役) | 元の派遣と同じ skill_name / skill_args | 元の派遣と同じ | レビューの指摘を受けて、同じ担当を派遣し直す (routing.md「縦・横レビュー」の 2)。元の派遣の additional_instructions に `レビューの指摘: <reviews の置き場の round<n>.md の絶対パス>。指摘を 1 件ずつ反証し、直すものは直して、引き継ぎファイルの refutations に全件を書く (書き方は handoff.md の「反証して直す派遣のとき」)` を足す。write-set は元の派遣の行をそのまま貼り、受理の write-set の検査も元の派遣の行で行う |

## 派遣ごとの write-set (正本から生成。手で書かない)

`{write_set}` に入れる文面。正本 (`<skills>/d2-common/references/dataflow.yaml`) の各派遣の `write_set` (断片の並び。パスに付く注記はそのパスと同じ断片) から
`node <skills>/d2-common/scripts/genDataflow.js` が生成する (0.1.31)。許可範囲 (`allowed_writes`) との整合・`notes` の包含・テストの写し (golden) との一致は `dataflow.test.js` が見る。

<!-- distillery2:dispatch-write-sets:begin -->
| 段階 | write-set |
|---|---|
| ① 要求 | `docs/requirements/**` |
| ② 決定 | `docs/nfr/**`、`docs/adr/**` |
| ③ 基盤 (機械) | `docs/rules/**`、`.dependency-cruiser.cjs`、`packages/test-support/**`、`features/support/**`、`cucumber.js`、`tsx-register.js`、`.distillery/config.yaml`、`.github/workflows/**`、`scripts/check.mjs`、`.githooks/**`、`.distillery/distillery2.lock.json`、`.qlty/qlty.toml`、`apps/*/`、`packages/*/`、`package.json`、`tsconfig.base.json`、`.gitignore`、`biome.json`、`package-lock.json`。例外: `npm install` が作る `node_modules/**` (gitignore) |
| ③ 契約骨格 | `contracts/**` |
| ③ 画面部品 | `docs/design/**` |
| ③ 基盤 (仕上げ) | `.distillery/config.yaml`、`.github/workflows/**`、`scripts/check.mjs`、`.githooks/**`、`.distillery/distillery2.lock.json`、`docs/adr/architecture.md`、`packages/ui/**`、`package-lock.json`、`apps/*/package.json`、`apps/*/src/styles.css`、`.qlty/qlty.toml`、`apps/*/test/contract/**`、`packages/contracts/**`、`<run>/reports/**` (チェックポイントが書く。slug は bootstrap)。例外: `npm install` が作る `node_modules/**` (gitignore) |
| ④ precheck (ティアごと並列) | なし (読むだけ。書くのは引き継ぎファイルだけ) |
| ④ scenario | `features/<業務>/<slug>.feature`、`features/acceptance/**` |
| ④ contract | `contracts/**`、`apps/*/test/contract/**`、`apps/<datastore_owner>/migrations/**`、`packages/contracts/**` |
| ④ scaffold | `features/step_definitions/**`、`apps/<tier>/src/**/*.test.ts`、`apps/<tier>/src/**` (テストが import する入口の最小スタブ。**新規ファイルだけ**。既存ファイルの変更・削除は不可)、`<run>/reports/**` (完了条件の `--expect-red unit` が書く。単独の段なので競合しない) |
| ④ tier | `apps/<tier>/**`、`<run>/attempt-<n>/assumptions.<tier>.yaml`。例外: ゲートの `{report}` の置き換え先に使う OS の一時ファイル (`mktemp` か `node -e` で作る。リポの外。使い終えたら削除) |
| ④ integrate | `features/step_definitions/**`、`features/support/**`、`<run>/reports/**`、`<run>/traces/**` (完了条件の runGates が書く。integrate は単独の段なので競合しない) |
| ④ verify | `<run>/attempt-<n>/findings.<tier>.yaml` |
| ④ asbuilt | `docs/as-built/<業務>/<UC>/**`、`docs/as-built/_system/**` (スクリプトの生成物。LLM が手で書くのは index.md の要約ブロックの中だけ)、`<run>/reports/**` (depcruise の結果と抽出の集計)、`<run>/issues/<ts>_asbuilt_<slug>.md` (要約の課題のうち、人レビューに載っていないものの下書き) |
| ① 要求の差分 (画面部品) | `docs/design/**` |
| ② 決定の差分 (ADR) | `docs/adr/**`、`docs/nfr/**`、`.distillery/logs/decide-<issue>.result.json` |
| 反証して直す | レビューした場所の派遣の行と同じ (その行をそのまま貼る) |
<!-- distillery2:dispatch-write-sets:end -->

`<run>` = `.distillery/runs/<slug>`。固定指示のパスは `<skills>/...` を絶対パスに展開して
`まず次のファイルを読み、記載の指示すべてに従ってください: <絶対パス>` の 1 行で渡す。

要求の差分で残った作業は ④ の派遣文に追記しない (0.1.30〜0.1.31 の「残った作業の追記」は 0.1.32 でやめた。残った作業は種類ごとの宛先 (画面の見本 → 「① 要求の差分 (画面部品)」の派遣、前提の記録 → 要求の差分で閉じる) に流す。SKILL.md 要求の差分 3〜4)。

## サブエージェントの報告の扱い (捏造禁止)

- **サブエージェントの完了報告を自分で書かない。** 派遣した sub の実際の結果 (SendMessage / タスク通知) が返るまで待つ。「届いた体」で報告を代筆すると、実際には未完了の段階を完了扱いにして先へ進む逸脱になる (実走で発生)。
- **報告が無い = 未完了として扱う。** 完了の正は `<run>/stages/<stage>.done.yaml` と各成果物の存在・parse。done ファイルが無ければその段階は未完了。報告文の有無ではなく done と成果物で判定する。
- 報告が来ても、write-set 逸脱や必須成果物の欠落があれば受理しない (下記)。

## 受理時の検査 (d2-run が行う)

- write-set の逸脱: `git status --porcelain` で write-set 外の変更があれば退避して段階を failed にする (引き継ぎファイル `{handoff}` は write-set の外でも逸脱にしない)
  (reports / traces は gitignore なので `git status` に出ない。write-set に含めない段で書かれていても検出できないため、派遣文の write-set で縛る)
- scaffold では加えて、既存の非テストファイルを変更・削除していないこと: `git diff --name-only --diff-filter=MD` に `*.test.ts` 以外の `apps/**/src/**` が無い
- 必須成果物の存在と parse (assumptions / findings は `validateAssumptions.js`)
- 基盤の仕上げと as-built は、サブの報告文ではなくファイルで受理する (SKILL.md の ③ 5 と asbuilt 行): `.distillery/runs/bootstrap/reports/gates.json` / `<run>/reports/asbuilt.json` と `checkAsBuilt.js`。どちらのファイルも派遣の前に消しておき、前回の結果で受理しない
- 「② 決定の差分 (ADR)」もファイルで受理する (routing.md「決定の差分」)。結果ファイル `.distillery/logs/decide-<issue>.result.json` の `status` (`applied` / `blocked`) で分岐し、結果ファイルは派遣の前に消す。
  `applied` なら `validateAdr.js docs/adr` が exit 0 であることも見る。開発ルールとアーキテストは担当に作り直させない (受理の後に d2-run が作り直す)
- 「反証して直す」は、元の派遣の受理の検査に加えて、引き継ぎファイルの `refutations` がレビューの指摘の全件を持つことを見る
- 完了報告が来なくても成果物 (done + ファイル) が正。存在と parse で完了判定してよい (検証の省略ではない)。逆に、報告だけあって done / 成果物が無ければ未完了として扱う
- 例外: ③ の画面部品 (d2-design) は完了報告 (部品を生成したか、画面を持たないため skip したか) が要る。前の実行の `docs/design/` が残っていると、成果物だけでは今回の生成と skip を区別できず、仕上げに渡す `ui=` を決められない。報告が無ければ未完了として再派遣する
- 例外: asbuilt は要約役の完了報告 (要約した 3 ブロックと、引用したコード位置の一覧) も要る。抽出は前回の要約ブロックを残すので、要約の前に止まっても集計ファイルと書式の検査は通ってしまい、成果物だけでは今回の要約を区別できない。報告が無ければ未完了として再派遣する
