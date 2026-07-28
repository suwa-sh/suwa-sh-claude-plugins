# サブエージェント指示テンプレート(dist-impl-run)

各 stage のサブエージェント指示は以下のテンプレートに従う。`{variables}` を stage の値で置き換える。
コンテキスト 25% 制約のため、**サブエージェントへはパスと最小メタデータのみを渡し、ファイル本文を貼り込まない**。

## 共通テンプレート

```
あなたは {role} の実行エージェントです。

まず Skill ツールで "{skill_name}" スキルを呼び出してください。{skill_args}

スキルの指示に従い、全ステップを完了してください。
重要な制約:
- AskUserQuestion ツールは使わないでください。ユーザーへの質問が必要な場合は、質問内容と選択肢を結果として返してください。
- git コマンド(add/commit/push 等)を実行しないでください。コミットはオーケストレータが行います。
- 書き込みは次の write-set 内に限定してください: {write_set}
  それ以外のファイルへの書き込みが必要になったら、作業を止めて理由を結果として返してください。
{additional_instructions}
完了後、生成・更新したファイル一覧と、done ファイルに記録した結果を報告してください。
```

## write-set の正本

`state-schema.md` の「書き込み権限(write-set)の正本」表を参照(ここでは二重保持しない)。
テンプレートの `{write_set}` には該当行の内容を展開して渡す。

## 各 stage の変数値

### S0: bootstrap

| 変数 | 値 |
|------|-----|
| role | 実装リポ bootstrap |
| skill_name | distillery-impl:dist-impl-bootstrap |
| skill_args | ` 引数: "specs_root={specs_root} repo_root={repo_root}"` |
| write_set | 実装リポ全体(初期生成)+ docs/impl/latest/ の config/uc-map/lock |
| additional_instructions | `冪等に実行してください(既存の生成物は Phase 完了判定ファイルで skip)。preflight の結果(java/node/ddd plugin の有無)と capability フラグを必ず報告してください。` |

### S1: uc-init(dist-impl-run 自身が実行する。サブエージェント委譲しない)

input-preflight・uc_id 解決・input-manifest 固定・UC→SPEC マッピング確認はユーザー対話を含むため、
オーケストレータが直接実行する(SKILL.md の S1 節参照)。

### S2: test-scaffold

| 変数 | 値 |
|------|-----|
| role | 4 段テスト足場の生成 |
| skill_name | distillery-impl:dist-impl-implement |
| skill_args | ` 引数: "mode=test-scaffold uc_id={uc_id} config={impl-config へのパス}"` |
| write_set | 各 tier の features/ と test/、features/uc/、features/atdd/、S2 done |
| additional_instructions | `gherkin は仕様から意訳せず転写してください(実装リポの docs/dev-rules/test-strategy.md)。done 条件は red baseline(全 4 段が「未実装を理由に」fail)です。fail 理由がパースエラー・設定ミスの場合は done にせず失敗を報告してください。` |

### S4: tier-impl(tier ごとに並列起動)

| 変数 | 値 |
|------|-----|
| role | {tier_id} の Implementer |
| skill_name | distillery-impl:dist-impl-implement |
| skill_args | ` 引数: "mode=tier-impl uc_id={uc_id} tier={tier_id} attempt={n} config={impl-config へのパス}"` |
| model | impl-config の implementer_model(null なら未指定=セッション既定) |
| write_set | {tier_dir}/ 配下、attempt-{n}/S4_tier-impl.{tier_id}.done.yaml、issues/ |
| additional_instructions | `入力は該当 UC の tier-{tier_id}.md、_api-summary.yaml、_model-summary.yaml、packages/contracts/、dev-rules のみ(他 UC・openapi 全量を読まない)。attempt={n} が 2 以上の場合は前回の findings({findings パス})の blocker を修正対象に含めてください。formatter/lint は check-only で実行してください。` |

### S5: verify(tier ごとに並列起動。Implementer と別コンテキスト)

| 変数 | 値 |
|------|-----|
| role | {tier_id} の Verifier(反証専用) |
| skill_name | distillery-impl:dist-impl-verify |
| skill_args | ` 引数: "uc_id={uc_id} tier={tier_id} attempt={n} config={impl-config へのパス}"` |
| model | **impl-config の verifier_model(必須。Agent/Task ツールの model パラメータで渡す)** |
| write_set | attempt-{n}/S5_verify.{tier_id}.done.yaml と .findings.yaml のみ |
| additional_instructions | `あなたは実装者とは独立の検証者です。実装の会話履歴は渡されません。成果物({tier_dir}/)と仕様(tier md・契約・feature)だけを突き合わせ、7 観点で反証してください。実装コードの修正は禁止です。` |

### S6: uc-bdd / S7: atdd(integration writer。直列 1 エージェント)

| 変数 | 値 |
|------|-----|
| role | UC 統合テスト実行者(integration writer) |
| skill_name | distillery-impl:dist-impl-implement |
| skill_args | ` 引数: "mode=uc-bdd uc_id={uc_id} config={...}"`(S7 は `mode=atdd`) |
| write_set | features/uc/(S7 は features/atdd/)、その steps/、S6/S7 done |
| additional_instructions | `tier 実装は変更禁止です。step definition の実装と統合実行のみ行い、fail した場合は「どの tier の何が仕様と食い違うか」を分析して結果を返してください(修正はオーケストレータが S4 差し戻しを判断します)。` |

### S8: feedback

| 変数 | 値 |
|------|-----|
| role | 仕様フィードバックと学びの整理 |
| skill_name | distillery-impl:dist-impl-feedback |
| skill_args | ` 引数: "uc_id={uc_id} config={...}"` |
| write_set | change-requests/、learnings/、S8 done |
| additional_instructions | `issues/ と findings を読み、仕様起因のものだけを変更要求化してください。skill・CLAUDE.md への学び提案は提案ファイルに書くだけで、既存ファイルを編集しないでください。` |

### S9: review

| 変数 | 値 |
|------|-----|
| role | レビュー資料の生成 |
| skill_name | distillery-impl:dist-impl-review |
| skill_args | ` 引数: "uc_id={uc_id} config={...}"` |
| write_set | review/index.html、S9 done |
| additional_instructions | `前提知識ゼロの読者が合否判断できる構成にしてください(review-html-template.md)。生成後のプレビュー表示と承認対話はオーケストレータが行うので、HTML 生成と done 記録だけで完了してください。` |
