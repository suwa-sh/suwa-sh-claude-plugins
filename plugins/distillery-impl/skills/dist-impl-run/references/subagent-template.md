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
- 引数に `manifest_sha256` が含まれる場合(S1〜S9 の stage done を書く stage のみ。
  S0 bootstrap は対象外 — `bootstrap.done.yaml` は専用スキーマ)、done ファイルの
  `manifest_sha256` にはその値を**再計算せず転記**し、`manifest_projection: v2` を
  併記してください(値の算出と受理時の照合はオーケストレータが行います)。
{additional_instructions}
完了後、生成・更新したファイル一覧と、done ファイルに記録した結果を報告してください。
```

## write-set の正本

`state-schema.md` の「書き込み権限(write-set)の正本」表を参照(ここでは二重保持しない)。
テンプレートの `{write_set}` には該当行の内容を展開して渡す。

## 長文固定指示のファイル参照方式(S2 / S4 / S5 ui-review / S9)

長文の固定指示は `references/stage-instructions/` 配下のファイルを正本とし、プロンプトに全文を埋め込まない
(tier 並列起動時にプロンプトへ複製されるトークンを削減するため)。
**ファイル名は各 stage の表の「固定部」に記載された名前が正本**(stage ID からの機械的な導出はしない):

| stage | 固定指示ファイル |
|-------|----------------|
| S2 | `stage-instructions/S2_test-scaffold.md` |
| S4 | `stage-instructions/S4_tier-impl.md` |
| S5 ui-review | `stage-instructions/S5_ui-review.md` |
| S9 | `stage-instructions/S9_review.md` |

- オーケストレータは `additional_instructions` に次の1行だけを埋める:
  `まず次のファイルを読み、記載の追加指示すべてに従ってください: {instructions_path}`
  (`{instructions_path}` は dist-impl-run 自身の `${CLAUDE_PLUGIN_ROOT}/skills/dist-impl-run/references/` 配下の上記ファイルを絶対パスに展開した値)
- 可変部(findings パス等)は同じ `additional_instructions` 内に短い行として追記する(各 stage の表を参照)
- 固定指示ファイルの読み込み失敗をサブエージェントが報告した場合、オーケストレータは stage を done にしない

## manifest_sha256 の受け渡し(done を書く全 stage 共通)

done の `manifest_sha256` は**オーケストレータが state-schema.md の projection 規則で算出**して
`skill_args` の `manifest_sha256={値}` で渡す(global stage は global projection、S4/S5 は
該当 tier の tier projection)。サブエージェントは再計算せず転記する(共通テンプレートの制約。
`targets_hash` と同じ受け渡しパターン)。オーケストレータは受理時に独立再計算して done の値と
照合する(不一致は stage failed)。

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
| skill_args | ` 引数: "mode=test-scaffold uc_id={uc_id} config={impl-config へのパス} manifest_sha256={S2 global projection hash} [tiers={scoped 再実行時の対象 tier 集合(カンマ区切り)}]"` |
| write_set | 各 tier の features/ と test/(**tiers 指定時は指定 tier のみ**)、features/uc/(**tiers 指定の scoped 再実行では spec.md 変更時を除き触れない**)、features/atdd/、stages/S2_test-scaffold.done.yaml、対象 UC の issues/(矛盾 3 条件の起票) |
| additional_instructions | 固定部: `stage-instructions/S2_test-scaffold.md`(ファイル参照方式)。可変部: なし(tiers 指定の有無は skill_args で伝わる) |

### S4: tier-impl(tier ごとに並列起動)

| 変数 | 値 |
|------|-----|
| role | {tier_id} の Implementer |
| skill_name | distillery-impl:dist-impl-implement |
| skill_args | ` 引数: "mode=tier-impl uc_id={uc_id} tier={tier_id} attempt={n} config={impl-config へのパス} manifest_sha256={当該 tier の tier projection hash}"` |
| model | impl-config の implementer_model(null なら未指定=セッション既定) |
| write_set | {tier_dir}/ 配下、attempt-{n}/S4_tier-impl.{tier_id}.done.yaml、issues/ |
| additional_instructions | 固定部: `stage-instructions/S4_tier-impl.md`(ファイル参照方式)。可変部: blocker 由来の attempt++ 直後の再実行のみ `findings パス — verify: {findings_verify_path}`(当該 tier で ui-review が dispatch されていれば ` ui-review: {findings_ui_review_path}` も併記)を追記する。stale 由来の再実行では findings パスを渡さない |

### S5: verify(tier ごとに並列起動。Implementer と別コンテキスト)

| 変数 | 値 |
|------|-----|
| role | {tier_id} の Verifier(反証専用) |
| agent_type | **`distillery-impl:impl-verifier`**(plugin 同梱 agent。disallowedTools 制約を効かせる) |
| skill_name | distillery-impl:dist-impl-verify |
| skill_args | ` 引数: "uc_id={uc_id} tier={tier_id} attempt={n} config={impl-config へのパス} manifest_sha256={当該 tier の tier projection hash}"` |
| model | **impl-config の verifier_model(必須。Agent/Task ツールの model パラメータで渡す)** |
| write_set | attempt-{n}/S5_verify.{tier_id}.done.yaml と .findings.yaml のみ |
| additional_instructions | `あなたは実装者とは独立の検証者です。実装の会話履歴は渡されません。成果物({tier_dir}/)と仕様(tier md・契約・feature)だけを突き合わせ、7 観点で反証してください。実装コードの修正は禁止です。` |

### S5: ui-review(dispatch 条件を満たす frontend tier のみ。Verifier と同一メッセージ内で並列起動)

dispatch 条件(target 集合の算出を含む)は `dist-impl-run/SKILL.md` の S5 手順を正本とする。
条件を満たす tier が無ければ本テンプレートは使わない(起動しない)。

| 変数 | 値 |
|------|-----|
| role | {tier_id} の UI Reviewer(実行ベースの反証専用) |
| agent_type | **`distillery-impl:impl-verifier`**(plugin 同梱 agent。汎用反証 agent — 呼び出す skill は下記で指定) |
| skill_name | distillery-impl:dist-impl-ui-review |
| skill_args | ` 引数: "uc_id={uc_id} tier={tier_id} attempt={n} config={impl-config へのパス} manifest_sha256={当該 tier の tier projection hash} targets={dist-impl-run が算出した executable target 集合} targets_hash={算出した canonical hash} targets_count={targets 件数} [checks={dom_snapshot,capture_review}]"`(`checks` は省略時 capability の全 check。skipped(runtime_unavailable) 復旧の再 dispatch 時のみ `checks=capture_review` を渡す — D10。`targets_hash`/`targets_count` の計算規則は state-schema.md「dispatch target の canonical hash」) |
| model | **impl-config の verifier_model(dist-impl-verify と同じ値を流用。impl-config にキーを増やさない)** |
| write_set | **通常 dispatch**: `attempt-{n}/S5_ui-review.{tier_id}.done.yaml` と `.findings.yaml`、`attempt-{n}/ui-artifacts/{tier_id}/`(capture_review が書く SSR 静的 HTML `render/` サブディレクトリ・キャプチャ画像を含む)のみ。**`checks=capture_review` の再実行時は例外**(D10 round2): `attempt-{n}/ui-artifacts/{tier_id}/staging/` のみ。canonical な done・`.findings.yaml`・`ui-artifacts/{tier_id}/`(`staging/` を除く)への書き込みは禁止 |
| additional_instructions | 固定部: `stage-instructions/S5_ui-review.md`(ファイル参照方式)。可変部: なし(targets/targets_hash/checks は skill_args で伝わる) |

### S6: uc-bdd / S7: atdd(integration writer。直列 1 エージェント)

| 変数 | 値 |
|------|-----|
| role | UC 統合テスト実行者(integration writer) |
| skill_name | distillery-impl:dist-impl-implement |
| skill_args | ` 引数: "mode=uc-bdd uc_id={uc_id} config={...} manifest_sha256={global projection hash}"`(S7 は `mode=atdd`) |
| write_set | features/uc/(S7 は features/atdd/)、その steps/、S6/S7 done |
| additional_instructions | `tier 実装は変更禁止です。step definition の実装と統合実行のみ行い、fail した場合は「どの tier の何が仕様と食い違うか」を分析して結果を返してください(修正はオーケストレータが S4 差し戻しを判断します)。S7(atdd)では uc-map の atdd_scenarios に列挙された Scenario だけを、一意タグ @atdd_{SPEC-ID}-{連番} の完全一致で選択実行してください(名前の部分一致フィルタ禁止・feature 全体を回さない)。実行された Scenario 件数が atdd_scenarios の件数と一致することを done の条件にしてください。仕様ギャップ(起票済み issue)起因で統合に必要な前提(認証ヘッダ等)が欠ける場合、steps 内でのハーネス注入を許容します。注入箇所には issue パス参照と「暫定注入・契約確定後に削除」コメントを必ず付けてください。` |

### S8: feedback

| 変数 | 値 |
|------|-----|
| role | 仕様フィードバックと学びの整理 |
| skill_name | distillery-impl:dist-impl-feedback |
| skill_args | ` 引数: "uc_id={uc_id} config={...} mode={initial|refresh|publish} manifest_sha256={global projection hash} [supersedes={feedback_id}]"` |
| write_set | initial/refresh: feedback/、learnings/、stages/S8_feedback.done.yaml / publish: feedback/draft.md、feedback-requests/、stages/S8_feedback.done.yaml、feedback_request_publish_started/published event |
| additional_instructions | `issues/ と findings を読み、仕様起因のものだけを単一feedback draftへまとめてください。pipeline内部のstage名・振り分け・stage別処理指示は書かないでください。skill・CLAUDE.mdへの学びは提案ファイルに書くだけで、既存ファイルを編集しないでください。` |

`mode=publish`では`review_approved`が参照するS9 eventと両者の`feedback_review_evidence` /
`implementation_review_evidence`を確認し、draftのfeedback ID / exact SHA-256 / request件数と
gate・open finding集約を照合してから公開契約を自己検査する。review HTML/captureのSHAは照合しない。不一致は公開せず
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
| skill_args | ` 引数: "uc_id={uc_id} config={...} manifest_sha256={global projection hash}"` |
| write_set | gitignore済みreview/index.html、stages/S9_review_generated.done.yaml |
| additional_instructions | 固定部: `stage-instructions/S9_review.md`(ファイル参照方式)。可変部: なし |
