# サブエージェント指示テンプレート

各 Step のサブエージェント指示は以下のテンプレートに従う。
`{variables}` を各 Step の値で置き換えて使用する。

**全 Step 共通ルール（confirm 必須）:**
全 Step で `confidence: low/medium` または自動推論で埋めた項目があれば、
**必ず** 結果として「確認推奨項目リスト」を返す。リストは
`skills/dist-pipeline/references/dialogue-format.md` のフォーマット（3案以上 + ⭐推奨 +
一行説明 + 推奨理由）に従うこと。対話を省略して completed を返してはならない。

**RDRA 整合性ルール:** RDRA モデル (`docs/rdra/latest/`) に存在しないアクター/情報/BUC/
画面/エンティティを、Step3 以降で新規追加してはならない。追加が必要と判断した場合は
`node skills/dist-pipeline/scripts/appendTodo.js` で `docs/todo.md` に提案を記録し、
確認推奨項目として「RDRA への追加是非」を返却する。

## 共通テンプレート

```
あなたは {role} の実行エージェントです。

{trigger_event_line}

まず Skill ツールで "{skill_name}" スキルを呼び出してください。{skill_args}

スキルの指示に従い、全ステップを完了してください。
{trigger_event_instruction}
重要: AskUserQuestion ツールは使わないでください。ユーザーへの質問が必要な場合は、質問内容と選択肢を結果として返してください。
{additional_instructions}
全ステップ完了後、最終的な出力ファイル一覧と最新イベントIDを報告してください。
```

## 各 Step の変数値

### Step1: requirements

| 変数 | 値 |
|------|-----|
| role | USDM-RDRA パイプライン |
| trigger_event_line | *(なし)* |
| skill_name | requirements |
| skill_args | ` 引数: "{要望テキストのパス}"` |
| trigger_event_instruction | *(なし)* |
| additional_instructions | `対話ありの Step です。USDM 分解で解釈が曖昧な要望、RDRA にアクター/情報を自動追加した項目があれば、必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案＋⭐推奨＋一行説明）で返してください。` |

### Step2: quality-attributes

| 変数 | 値 |
|------|-----|
| role | 非機能要求グレード定義 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}` |
| skill_name | quality-attributes |
| skill_args | *(なし)* |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `対話ありの Step です。confidence が low/medium の項目、または自動推論（RDRA からの推定や M2 デフォルト等）で埋めた項目がある場合は、**必ず結果として「確認推奨項目リスト」を返してください**。オーケストレータがそれをユーザーに中継します。対話を省略して完了扱いにしないこと。返却値は dialogue-format.md 準拠（3案以上＋⭐推奨＋一行説明＋推奨理由）。RDRA に存在しない要素を追加したい場合は appendTodo.js で docs/todo.md に登録し、確認推奨項目として返すこと（自動追加禁止）。` |

### Step3: architecture

| 変数 | 値 |
|------|-----|
| role | アーキテクチャ設計 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}, nfr:{nfr_event_id}` |
| skill_name | architecture |
| skill_args | *(なし)* |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id}, nfr:{nfr_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `対話ありの Step です。confidence が low/medium の項目、または自動推論で埋めた項目がある場合は、**必ず結果として「確認推奨項目リスト」を返してください**。オーケストレータがそれをユーザーに中継します。対話を省略して完了扱いにしないこと。返却値は dialogue-format.md 準拠（3案以上＋⭐推奨＋一行説明＋推奨理由）。RDRA に存在しない要素を追加したい場合は appendTodo.js で docs/todo.md に登録し、確認推奨項目として返すこと（自動追加禁止）。` |

### Step4a: infrastructure（MCL実行）

| 変数 | 値 |
|------|-----|
| role | インフラ設計（MCL実行） |
| trigger_event_line | `前段イベント: arch:{arch_event_id}, nfr:{nfr_event_id}` |
| skill_name | infrastructure |
| skill_args | *(なし)* |
| trigger_event_instruction | `前段イベント arch:{arch_event_id}, nfr:{nfr_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `Phase1 (product-input 生成) と Phase2 (MCL product-design 実行) のみを実行してください。Phase3〜5 は別サブエージェントが担当するので実行しないでください。MCL 成果物の生成が完了したら、イベントディレクトリパスとイベントIDを報告して完了してください。対話ありの Step です。クラウドベンダー選択、リージョン、コスト方針など confidence: low/medium の項目は必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案＋⭐推奨＋一行説明）で返してください。RDRA に存在しない要素を追加する場合は appendTodo.js で docs/todo.md に登録してください。` |

### Step4b: infrastructure（イベント記録・Arch フィードバック）

| 変数 | 値 |
|------|-----|
| role | インフラ設計（イベント記録・Arch フィードバック） |
| trigger_event_line | *(なし — Step4a の結果から取得)* |
| skill_name | infrastructure（ただしスキル呼び出しは不要。直接 Phase3〜5 を実行） |
| skill_args | *(なし)* |
| trigger_event_instruction | *(なし)* |
| additional_instructions | `Step4a が生成した MCL 成果物をもとに以下を実行してください: Phase3: infra-event.yaml 生成 + docs/infra/latest/ スナップショット / Phase4: arch-design.yaml へのフィードバック（新規 arch event 生成） / Phase5: write-back check。skills/dist-infrastructure/SKILL.md の Phase3〜5 セクションを参照すること。対話ありの Step です。confidence: low/medium の項目は必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案＋⭐推奨＋一行説明）で返してください。RDRA に存在しない要素を追加する場合は appendTodo.js で docs/todo.md に登録してください。` |

### Step5: design-system

| 変数 | 値 |
|------|-----|
| role | デザインシステム生成 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}, arch:{arch_event_id}` |
| skill_name | design-system |
| skill_args | *(なし)* |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id}, arch:{arch_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `Step8（画面確認）は特に重要です。必ず実行してください。対話ありの Step です。confidence が low/medium の項目、または自動推論で埋めた項目がある場合は、**必ず結果として「確認推奨項目リスト」を返してください**。オーケストレータがそれをユーザーに中継します。対話を省略して完了扱いにしないこと。返却値は dialogue-format.md 準拠（3案以上＋⭐推奨＋一行説明＋推奨理由）。RDRA に存在しない要素を追加したい場合は appendTodo.js で docs/todo.md に登録し、確認推奨項目として返すこと（自動追加禁止）。` |

### Step6: spec

| 変数 | 値 |
|------|-----|
| role | UC 仕様生成 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}, arch:{arch_event_id}, design:{design_event_id}` |
| skill_name | spec |
| skill_args | *(なし)* |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id}, arch:{arch_event_id}, design:{design_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `対話ありの Step です。API 命名規則、エラーハンドリング戦略、RDB 正規化レベルなど confidence: low/medium の項目は必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案＋⭐推奨＋一行説明）で返してください。RDRA に存在しないエンティティを追加する場合は appendTodo.js で docs/todo.md に登録し、自動追加しないこと。` |
