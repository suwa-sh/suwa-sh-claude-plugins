# サブエージェント指示テンプレート

各 Step のサブエージェント指示は以下のテンプレートに従う。
`{variables}` を各 Step の値で置き換えて使用する。

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
| additional_instructions | *(なし)* |

### Step2: quality-attributes

| 変数 | 値 |
|------|-----|
| role | 非機能要求グレード定義 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}` |
| skill_name | quality-attributes |
| skill_args | *(なし)* |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `対話ありの Step です。confidence が low/medium の項目、または自動推論（RDRA からの推定や M2 デフォルト等）で埋めた項目がある場合は、**必ず結果として「確認推奨項目リスト」を返してください**。オーケストレータがそれをユーザーに中継します。対話を省略して完了扱いにしないこと。` |

### Step3: architecture

| 変数 | 値 |
|------|-----|
| role | アーキテクチャ設計 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}, nfr:{nfr_event_id}` |
| skill_name | architecture |
| skill_args | *(なし)* |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id}, nfr:{nfr_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `対話ありの Step です。confidence が low/medium の項目、または自動推論で埋めた項目がある場合は、**必ず結果として「確認推奨項目リスト」を返してください**。オーケストレータがそれをユーザーに中継します。対話を省略して完了扱いにしないこと。` |

### Step4: infrastructure

| 変数 | 値 |
|------|-----|
| role | インフラ設計 |
| trigger_event_line | `前段イベント: arch:{arch_event_id}, nfr:{nfr_event_id}` |
| skill_name | infrastructure |
| skill_args | *(なし)* |
| trigger_event_instruction | `前段イベント arch:{arch_event_id}, nfr:{nfr_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | *(なし)* |

### Step5: design-system

| 変数 | 値 |
|------|-----|
| role | デザインシステム生成 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}, arch:{arch_event_id}` |
| skill_name | design-system |
| skill_args | *(なし)* |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id}, arch:{arch_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `Step8（画面確認）は特に重要です。必ず実行してください。対話ありの Step です。confidence が low/medium の項目、または自動推論で埋めた項目がある場合は、**必ず結果として「確認推奨項目リスト」を返してください**。オーケストレータがそれをユーザーに中継します。対話を省略して完了扱いにしないこと。` |

### Step6: spec

| 変数 | 値 |
|------|-----|
| role | UC 仕様生成 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}, arch:{arch_event_id}, design:{design_event_id}` |
| skill_name | spec |
| skill_args | *(なし)* |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id}, arch:{arch_event_id}, design:{design_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | *(なし)* |
