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
- done/findings 等の YAML は、値に `: ` や括弧を含む文字列を必ずクォートし、flow mapping `{...}`
  内に block scalar(`>-`)を書かないでください。書き終えたら `yaml.safe_load` で parse 確認してから
  完了としてください。
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

### S1: uc-init / S3: contracts(dist-impl-run 自身が実行する。サブエージェント委譲しない)

S1(input-preflight・uc_id 解決・input-manifest 固定・UC→ATDD マッピング確認)はユーザー対話を含むため、
S3(契約ごとの lock 照合 + 実装時検証。不整合時の縮退判断はユーザー対話)は当該 UC 範囲に閉じて
軽量なため、オーケストレータが直接実行する(SKILL.md 参照)。
S3 で stale を検知した場合のみ、bootstrap を
`引数: "phase=contracts force=true contract_id={不一致の契約 id}"` で
サブエージェント起動する(S0 の行と同じテンプレート。write_set は該当契約の
packages/contracts/ 出力 dir と contracts.lock.yaml の該当エントリと
**bootstrap.done.yaml(P4 の記録と該当契約の入力ハッシュのみ更新)**)。

### S2: test-scaffold

| 変数 | 値 |
|------|-----|
| role | 4 段テスト足場の生成 |
| skill_name | distillery-impl:dist-impl-implement |
| skill_args | ` 引数: "mode=test-scaffold uc_id={uc_id} config={impl-config へのパス}"` |
| write_set | 各 tier の features/ と test/、features/uc/、features/atdd/、stages/S2_test-scaffold.done.yaml |
| additional_instructions | `gherkin は仕様から意訳せず転写してください(実装リポの docs/dev-rules/test-strategy.md)。ATDD は uc-map の atdd_scenarios に列挙された Scenario だけを対象にし(skeleton と red baseline の確認も同範囲)、生成済みの共有 feature 本文は変更しないでください。done 条件は red baseline(全 4 段が「未実装を理由に」fail)です。fail 理由がパースエラー・設定ミスの場合は done にせず失敗を報告してください。` |

### S4: tier-impl(tier ごとに並列起動)

| 変数 | 値 |
|------|-----|
| role | {tier_id} の Implementer |
| skill_name | distillery-impl:dist-impl-implement |
| skill_args | ` 引数: "mode=tier-impl uc_id={uc_id} tier={tier_id} attempt={n} config={impl-config へのパス}"` |
| model | impl-config の implementer_model(null なら未指定=セッション既定) |
| write_set | {tier_dir}/ 配下、attempt-{n}/S4_tier-impl.{tier_id}.done.yaml、issues/ |
| additional_instructions | `入力(read-set)は該当 UC の {tier_id}.md(例 tier-frontend.md)、_api-summary.yaml、_model-summary.yaml、実装リポの docs/dev-rules/、packages/contracts/ と契約 source のうち impl-config の contracts[] で自 tier が provider または consumers に含まれる契約のもの(生成物 dir は docs/impl/latest/contracts.lock.yaml の該当契約の generated[] のうち audience が自 tier の role または both で、lang 指定があれば自 tier の lang と一致するもの。契約 source は lock の source_read が none 以外の契約のみ・scope 指定時は scope 範囲)、さらに tier 種別の追加入力(tier-rules.md。例: frontend は packages/ui/ と design-event.yaml の該当 screen)。それ以外(他 UC・関与しない契約・契約 source の全量読み)は読まないでください。attempt={n} が 2 以上の場合は前回の findings({findings パス})の blocker を修正対象に含めてください。formatter/lint は check-only で実行してください。` |

### S5: verify(tier ごとに並列起動。Implementer と別コンテキスト)

| 変数 | 値 |
|------|-----|
| role | {tier_id} の Verifier(反証専用) |
| agent_type | **`distillery-impl:impl-verifier`**(plugin 同梱 agent。disallowedTools 制約を効かせる) |
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
| additional_instructions | `tier 実装は変更禁止です。step definition の実装と統合実行のみ行い、fail した場合は「どの tier の何が仕様と食い違うか」を分析して結果を返してください(修正はオーケストレータが S4 差し戻しを判断します)。S7(atdd)では uc-map の atdd_scenarios に列挙された Scenario だけを、一意タグ @atdd_{SPEC-ID}-{連番} の完全一致で選択実行してください(名前の部分一致フィルタ禁止・feature 全体を回さない)。実行された Scenario 件数が atdd_scenarios の件数と一致することを done の条件にしてください。仕様ギャップ(起票済み issue)起因で統合に必要な前提(認証ヘッダ等)が欠ける場合、steps 内でのハーネス注入を許容します。注入箇所には issue パス参照と「暫定注入・契約確定後に削除」コメントを必ず付けてください。` |

### S8: feedback

| 変数 | 値 |
|------|-----|
| role | 仕様フィードバックと学びの整理 |
| skill_name | distillery-impl:dist-impl-feedback |
| skill_args | ` 引数: "uc_id={uc_id} config={...} mode={initial|refresh|publish} [supersedes={feedback_id}]"` |
| write_set | initial/refresh: feedback/、learnings/、stages/S8_feedback.done.yaml / publish: feedback/draft.md、feedback-requests/、stages/S8_feedback.done.yaml、feedback_request_publish_started/published event |
| additional_instructions | `issues/ と findings を読み、仕様起因のものだけを単一feedback draftへまとめてください。pipeline内部のstage名・振り分け・stage別処理指示は書かないでください。skill・CLAUDE.mdへの学びは提案ファイルに書くだけで、既存ファイルを編集しないでください。` |

`mode=publish`では`review_approved`が参照するS9 eventと両者の`feedback_review_evidence` /
`implementation_review_evidence`を確認し、draftのfeedback ID / exact SHA-256 / request件数と
review HTML SHA / gate・open finding集約を照合してから公開契約を自己検査する。不一致は公開せず
S8 refresh → S9再レビューへ戻す。別pluginへの曖昧なscript pathやproducer独自parserは使わない。
draft/公開先の全親componentをlstat/realpathしcanonical UC root containment・non-symlinkを確認する。
draftはregular/non-symlink、公開先は未存在、両親はsame-filesystemでなければ停止し、rename直前にも
device/inode/sizeとpath条件を再検証して、同じbytesのまま`feedback-requests/{feedback_id}.md`へatomic
renameする。review/approval/publish eventの一意性と順序を検証し、既存publishedはcanonical pathの
containment・regular/non-symlink・SHA・件数・lineageのexact一致時だけno-opにする。review情報を本文へ追加しない。

### S9: review

| 変数 | 値 |
|------|-----|
| role | レビュー資料の生成 |
| skill_name | distillery-impl:dist-impl-review |
| skill_args | ` 引数: "uc_id={uc_id} config={...}"` |
| write_set | review/index.html、stages/S9_review_generated.done.yaml |
| additional_instructions | `前提知識ゼロの読者が実装の合否を判断できる構成にしてください(review-html-template.md)。仕様起因の残課題はfeedback ID/件数/pathと、各CRの事実・問題・要求・完了条件を全文（details可）で示しますが、pipeline内部の所有stage・振り分け・個別処理指示・承認hashはHTMLへ生成しないでください。表示したdraftのfeedback ID / exact bytes SHA-256 / request件数は内部のfeedback_review_evidence、HTML SHA / gate結果 / open blocker・major件数はimplementation_review_evidenceとしてS9 doneへ記録してください。生成後のプレビュー表示と承認対話はオーケストレータが行います。` |
