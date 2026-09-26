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
- git コマンド (add / commit / push / switch 等) を実行しないでください。コミットはオーケストレータが行います
- 書き込みは次の write-set 内に限定してください: {write_set}
  それ以外への書き込みが必要になったら、作業を止めて理由を結果として返してください
- YAML を書くときは、値に `: ` や括弧を含む文字列を必ずクォートし、書き終えたら parse 確認してください
{additional_instructions}
完了後、生成・更新したファイル一覧と結果の要点を報告してください。
```

## 段階ごとの変数

| 段階 | role | skill_name / skill_args | model | write-set | additional_instructions |
|---|---|---|---|---|---|
| ① 要求 | 要求の整理役 | `distillery2:d2-requirements` `input=<要望テキスト>` | 既定 | `docs/requirements/**` | なし |
| ② 決定 | 品質特性と設計の決定役 | `distillery2:d2-decide` | 既定 | `docs/nfr/**`、`docs/adr/**` | なし |
| ③ 基盤 (機械) | 基盤の生成役 | `distillery2:d2-foundation` `phase=F1..F5` | 既定 | `docs/rules/**`、`.dependency-cruiser.cjs`、`packages/test-support/**`、`features/support/**`、`.distillery/config.yaml`、`.github/workflows/**`、`apps/*/`・`packages/*/` の骨格、root `package.json` 等 | なし |
| ③ 契約骨格 | 契約の設計役 | `distillery2:d2-contract` `mode=skeleton` | 既定 | `contracts/**` | なし |
| ③ 画面部品 | デザインシステムの生成役 | `distillery2:d2-design` | 既定 | `docs/design/**`、`packages/ui/**` | なし |
| ④ scenario | UC シナリオの執筆役 | `distillery2:d2-implement` `mode=scenario uc=<slug>` | 既定 | `features/<業務>/<slug>.feature`、`features/acceptance/**`、`<run>/issues/**` | 固定指示: `skills/d2-implement/references/scenario.md` |
| ④ contract | 契約の差分役 | `distillery2:d2-contract` `mode=uc uc=<slug>` | 既定 | `contracts/**`、`apps/*/test/contract/**`、`apps/<datastore_owner>/migrations/**`、`packages/contracts/**`、`<run>/issues/**` | なし |
| ④ scaffold | テスト足場の生成役 | `distillery2:d2-implement` `mode=scaffold uc=<slug>` | 既定 | `features/step_definitions/**`、各 `apps/<tier>/src/**/*.test.ts`、テストが import する入口の最小スタブ (`apps/<tier>/src/**` の**新規ファイルだけ**。既存ファイルの変更・削除は不可)、`<run>/reports/**` (完了条件の `--expect-red unit` が書く。単独の段なので競合しない) | 固定指示: `skills/d2-implement/references/scaffold.md` |
| ④ tier (ティアごと並列) | `<tier>` の実装者 | `distillery2:d2-implement` `mode=tier uc=<slug> tier=<tier> attempt=<n>` | `models.implementer` | `apps/<tier>/**`、`<run>/attempt-<n>/assumptions.<tier>.yaml`、`<run>/issues/**`。例外: ゲートの `{report}` の置き換え先に使う OS の一時ファイル (`mktemp` の結果。リポの外。使い終えたら削除) | 固定指示: `skills/d2-implement/references/tier-impl.md`。`runGates.js は使わない (記録付きのゲートは全ティアの受理後にオーケストレータが回す)` を追記。blocker 由来の再実行時のみ `findings: <run>/attempt-<n-1>/findings.<tier>.yaml` を追記 |
| ④ integrate | 結合の実装者 | `distillery2:d2-implement` `mode=integrate uc=<slug>` | 既定 | `features/step_definitions/**`、`features/support/**`、`<run>/reports/**`、`<run>/traces/**` (完了条件の runGates が書く。integrate は単独の段なので競合しない) | 固定指示: `skills/d2-implement/references/integrate.md`。attempt ≥ 2 のときは `差し戻しの再実行。結線の変更が不要なら、変えずに完了条件だけ確かめて「結線変更なし」と報告してよい` を追記 |
| ④ verify (ティアごと並列) | `<tier>` の Verifier | agent_type **`distillery2:d2-verifier`** / `distillery2:d2-verify` `uc=<slug> tier=<tier> attempt=<n> run=<run> assumptions=<path>` | **`models.verifier`** (implementer と同じモデルに解決されてもよい。条件は別サブエージェント + 同等以上のモデル。SKILL.md 起動シーケンス 2) | `<run>/attempt-<n>/findings.<tier>.yaml` | `変更ファイル一覧: <git diff --name-only base_head..HEAD の結果を 1 行ずつ>` と `他 UC と共有する変更ファイル (初期候補): <ファイル — 他 UC の slug を 1 行ずつ。無ければ「なし」>` (SKILL.md verify 行) |
| ④ asbuilt | 文書抽出の要約役 | `distillery2:d2-asbuilt` `uc=<slug> run=<run>` | 既定 | `docs/as-built/<業務>/<UC>/**`、`docs/as-built/_system/**` | 抽出スクリプトは d2-run が先に実行済み。要約節だけ書く。`extractAsBuilt の標準出力: <1 行をそのまま>` を追記 (計装の有無と書式違反を要約役が自分で確かめられるように。0.1.10 実走 ④-10) |

`<run>` = `.distillery/runs/<slug>`。固定指示のパスは `${CLAUDE_PLUGIN_ROOT}/skills/...` を絶対パスに展開して
`まず次のファイルを読み、記載の指示すべてに従ってください: <絶対パス>` の 1 行で渡す。

## サブエージェントの報告の扱い (捏造禁止)

- **サブエージェントの完了報告を自分で書かない。** 派遣した sub の実際の結果 (SendMessage / タスク通知) が返るまで待つ。「届いた体」で報告を代筆すると、実際には未完了の段階を完了扱いにして先へ進む逸脱になる (実走で発生)。
- **報告が無い = 未完了として扱う。** 完了の正は `<run>/stages/<stage>.done.yaml` と各成果物の存在・parse。done ファイルが無ければその段階は未完了。報告文の有無ではなく done と成果物で判定する。
- 報告が来ても、write-set 逸脱や必須成果物の欠落があれば受理しない (下記)。

## 受理時の検査 (d2-run が行う)

- write-set の逸脱: `git status --porcelain` で write-set 外の変更があれば退避して段階を failed にする
  (reports / traces は gitignore なので `git status` に出ない。write-set に含めない段で書かれていても検出できないため、派遣文の write-set で縛る)
- scaffold では加えて、既存の非テストファイルを変更・削除していないこと: `git diff --name-only --diff-filter=MD` に `*.test.ts` 以外の `apps/**/src/**` が無い
- 必須成果物の存在と parse (assumptions / findings は `validateAssumptions.js`)
- 完了報告が来なくても成果物 (done + ファイル) が正。存在と parse で完了判定してよい (検証の省略ではない)。逆に、報告だけあって done / 成果物が無ければ未完了として扱う
