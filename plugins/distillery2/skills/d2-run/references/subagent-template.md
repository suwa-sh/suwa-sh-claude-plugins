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
| ④ scaffold | テスト足場の生成役 | `distillery2:d2-implement` `mode=scaffold uc=<slug>` | 既定 | `features/step_definitions/**`、各 `apps/<tier>/src/**/*.test.ts` | 固定指示: `skills/d2-implement/references/scaffold.md` |
| ④ tier (ティアごと並列) | `<tier>` の実装者 | `distillery2:d2-implement` `mode=tier uc=<slug> tier=<tier> attempt=<n>` | `models.implementer` | `apps/<tier>/**`、`<run>/attempt-<n>/assumptions.<tier>.yaml`、`<run>/issues/**` | 固定指示: `skills/d2-implement/references/tier-impl.md`。blocker 由来の再実行時のみ `findings: <run>/attempt-<n-1>/findings.<tier>.yaml` を追記 |
| ④ integrate | 結合の実装者 | `distillery2:d2-implement` `mode=integrate uc=<slug>` | 既定 | `features/step_definitions/**`、`features/support/**` | 固定指示: `skills/d2-implement/references/integrate.md` |
| ④ verify (ティアごと並列) | `<tier>` の Verifier | agent_type **`distillery2:d2-verifier`** / `distillery2:d2-verify` `uc=<slug> tier=<tier> attempt=<n> run=<run> assumptions=<path>` | **`models.verifier`** (implementer と同じなら停止) | `<run>/attempt-<n>/findings.<tier>.yaml` | `変更ファイル一覧: <git diff --name-only base_head..HEAD の結果を 1 行ずつ>` |
| ④ asbuilt | 文書抽出の要約役 | `distillery2:d2-asbuilt` `uc=<slug> run=<run>` | 既定 | `docs/as-built/<業務>/<UC>/**`、`docs/as-built/_system/**` | 抽出スクリプトは d2-run が先に実行済み。要約節だけ書く |

`<run>` = `.distillery/runs/<slug>`。固定指示のパスは `${CLAUDE_PLUGIN_ROOT}/skills/...` を絶対パスに展開して
`まず次のファイルを読み、記載の指示すべてに従ってください: <絶対パス>` の 1 行で渡す。

## 受理時の検査 (d2-run が行う)

- write-set の逸脱: `git status --porcelain` で write-set 外の変更があれば退避して段階を failed にする
- 必須成果物の存在と parse (assumptions / findings は `validateAssumptions.js`)
- 完了報告が来なくても成果物が正。存在と parse で完了判定してよい (検証の省略ではない)
