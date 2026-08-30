# subagent への指示テンプレート（Step3 UC Spec 生成）

Step3 で UC Spec を並列生成する際に subagent へ渡す指示テンプレート。
`{変数}` の部分を実際の値に置き換えて使用する。

```
以下のファイルを順に読み込んで理解してください:

1. テンプレート・ルール
   - references/specs/spec-template.md

2. 入力データ
   - docs/rdra/latest/*.tsv（全ファイル）
   - docs/specs/events/{event_id}/_inputs-digest.md（Step1 生成の arch/nfr ダイジェスト。tiers 定義から生成対象ティアを決定）
     - ファイル自体が存在しない場合は docs/nfr/latest/nfr-grade.yaml と docs/arch/latest/arch-design.yaml をフルロードする
     - 冒頭のチェックリストで `元ファイル参照` のセクションがある場合は、そのセクションだけを元ファイルから読む（`not_applicable` = 元ファイルに存在しないセクションは読みに行かない）
   - docs/design/latest/design-event.yaml（**`_inputs-digest.md` 冒頭が `design_available: true` の場合のみ**読む。
     `design_available: false` ならファイルが存在しても開かない = design 無しモード: 画面仕様・コンポーネント設計・
     デザイントークン参照・screens を生成しない。spec-template.md「design 無しモード」参照）
   - docs/specs/events/{event_id}/_cross-cutting/ux-ui/ux-design.md（Step2 で生成済み）
   - docs/specs/events/{event_id}/_cross-cutting/ux-ui/ui-design.md（Step2 で生成済み）
   - docs/specs/latest/_cross-cutting/ux-ui/common-components.md（`design_available: true` かつ latest に存在する場合のみ参照。
     common-components.md は Step4c で生成されるため、初回実行時は未生成。design 無しモードでは旧 latest に残っていても読まない）
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
