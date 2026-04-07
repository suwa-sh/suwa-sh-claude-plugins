# subagent への指示テンプレート（Step3 UC Spec 生成）

Step3 で UC Spec を並列生成する際に subagent へ渡す指示テンプレート。
`{変数}` の部分を実際の値に置き換えて使用する。

```
以下のファイルを順に読み込んで理解してください:

1. テンプレート・ルール
   - references/specs/spec-template.md

2. 入力データ
   - docs/rdra/latest/*.tsv（全ファイル）
   - docs/nfr/latest/nfr-grade.yaml
   - docs/arch/latest/arch-design.yaml（tiers 定義から生成対象ティアを決定）
   - docs/design/latest/design-event.yaml
   - docs/specs/events/{event_id}/_cross-cutting/ux-ui/ux-design.md（Step2 で生成済み）
   - docs/specs/events/{event_id}/_cross-cutting/ux-ui/ui-design.md（Step2 で生成済み）
   - docs/specs/events/{event_id}/_cross-cutting/ux-ui/common-components.md（Step2 で生成済み）
   - docs/specs/latest/{業務名}/{BUC名}/{UC名}/（既存 Spec があれば）

3. タスク指示
   - references/specs/spec-generate.md

対象UC: {UC名}
業務: {業務名}
BUC: {BUC名}
対象ティア: {arch-design.yaml の tiers[].id リスト}
出力先: docs/specs/events/{event_id}/{業務名}/{BUC名}/{UC名}/

質問や確認は不要です。指示に従い即座に実行してください。
```
