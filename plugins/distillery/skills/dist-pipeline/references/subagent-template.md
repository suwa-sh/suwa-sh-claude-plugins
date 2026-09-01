# サブエージェント指示テンプレート

各 Step のサブエージェント指示は以下のテンプレートに従う。
`{variables}` を各 Step の値で置き換えて使用する。

**全 Step 共通ルール（確認推奨項目の作成必須）:**
全 Step で `confidence: low` の項目があれば、
**必ず** `skills/dist-pipeline/references/dialogue-format.md` のフォーマット（3案以上 + ⭐推奨 +
一行説明 + 推奨理由）で「確認推奨項目リスト」を作成する。
その後の扱いは `{dialogue_policy_instructions}`（下記）に従う:
- `interactive`: リストを結果として返す。対話を省略して completed を返してはならない
- `auto_adopt`: ⭐推奨を採用して続行し、採用一覧を完了報告に含める（リスト作成自体は省略不可）

**モデル指定（全 Step 共通）:**
各 Step のサブエージェント起動時、`docs/pipeline/pipeline-config.yaml` の `step_models.stepN` を
Agent/Task ツールの `model` パラメータに渡す（`null` なら model パラメータを指定しない = セッション既定）。
正本は pipeline-config のみ（`references/pipeline-config-schema.md` 参照）。agent 定義には書かない。

**RDRA 整合性ルール:** RDRA モデル (`docs/rdra/latest/`) に存在しないアクター/情報/BUC/
画面/エンティティを、Step3 以降で新規追加してはならない。追加が必要と判断した場合は
`node ${CLAUDE_PLUGIN_ROOT}/skills/dist-pipeline/scripts/appendTodo.js` で `docs/todo.md` に提案を記録し、
確認推奨項目として「RDRA への追加是非」を返却する。

## 共通テンプレート

```
あなたは {role} の実行エージェントです。

{trigger_event_line}

まず Skill ツールで "{skill_name}" スキルを呼び出してください。{skill_args}

スキルの指示に従い、全ステップを完了してください。
{trigger_event_instruction}
重要: AskUserQuestion ツールは使わないでください。ユーザーへの質問が必要な場合は、質問内容と選択肢を結果として返してください。
{dialogue_policy_instructions}
{additional_instructions}
{feedback_instructions}
全ステップ完了後、最終的な出力ファイル一覧と最新イベントIDを報告してください。
```

## dialogue_policy 共通変数

通常 mode のデフォルトは `auto_adopt`。`--interactive` 指定時と feedback mode は `interactive`。

- `interactive` 時の `{dialogue_policy_instructions}`:

  ```text
  dialogue_policy: interactive
  確認推奨項目（confidence: low、曖昧要望の解釈、RDRA への自動追加など）があれば、
  dialogue-format.md 準拠のリストを結果として返してください。対話を省略して completed を返さないでください。
  ```

- `auto_adopt` 時の `{dialogue_policy_instructions}`:

  ```text
  dialogue_policy: auto_adopt
  確認推奨項目は dialogue-format.md 準拠（3案以上+⭐推奨+一行説明+推奨理由）で作成した上で、
  ユーザーへ中継せず⭐推奨を採用してそのまま続行してください。
  confidence: low の項目は保守的な⭐推奨を仮採用し、
  node ${CLAUDE_PLUGIN_ROOT}/skills/dist-pipeline/scripts/appendTodo.js で docs/todo.md に登録してください。
  完了報告に dialogue-format.md「自動採用モード」の採用一覧
  （採用済み high/medium と仮採用 low を項目/採用値/confidence/推奨理由/他の選択肢つきで列挙。
  0 件なら「採用一覧: なし」）を必ず含めてください。
  ユーザーが事前に個別指定した値は confidence にかかわらずその値を採用してください。
  ```

## feedback mode 共通変数

- 通常 mode: `{feedback_instructions}` は空
- feedback mode: `references/feedback-mode.md`「subagent への `{feedback_instructions}`」の本文をそのまま埋める
  （feedback 入力を検出したときだけ読む。RDRA に無い要素が必要になった場合の `deferred` 規則も同節に記載）

## 各 Step の変数値

### Step0h: harvest（既存プロジェクトの取り込み・任意）

入力が既存プロジェクトの場合のみ、Step1 の代わりに実行する（dist-harvest が requirements 構築を内包する）。

| 変数 | 値 |
|------|-----|
| role | 既存プロジェクトからの要求逆生成 |
| trigger_event_line | *(なし)* |
| skill_name | distillery:dist-harvest |
| skill_args | ` 引数: "{対象リポジトリのパス（複数可）}"` |
| model | pipeline-config の step_models.step0h（null なら未指定=セッション既定） |
| trigger_event_instruction | *(なし)* |
| additional_instructions | `既存プロジェクトを解析し USDM + RDRA を初期構築する Step です。dist-harvest 内部で USDM 逆生成 + RDRA フルビルドまで完了させてください。対話ありの Step です。confidence: low の項目（推測で補完した理由・モデル要素）は必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案＋⭐推奨＋一行説明＋推奨理由）で作成し、dialogue_policy に従って処理してください。完了後、docs/rdra/latest/ と docs/usdm/latest/ の event_id を報告してください（後段 Step2 以降が引き継ぎます）。` |

### Step1: requirements

| 変数 | 値 |
|------|-----|
| role | USDM-RDRA パイプライン |
| trigger_event_line | *(なし)* |
| skill_name | distillery:dist-requirements |
| skill_args | 通常: ` 引数: "{要望テキストのパス}"` / feedback: ` 引数: "feedback_packet={stage_packet_path}"` |
| model | pipeline-config の step_models.step1（null なら未指定=セッション既定） |
| trigger_event_instruction | *(なし)* |
| additional_instructions | `対話ありの Step です。USDM 分解で解釈が曖昧な要望、RDRA にアクター/情報を自動追加した項目があれば、必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案＋⭐推奨＋一行説明）で作成し、dialogue_policy に従って処理してください。` |

### Step2: quality-attributes

| 変数 | 値 |
|------|-----|
| role | 非機能要求グレード定義 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}` |
| skill_name | distillery:dist-quality-attributes |
| skill_args | 通常: *(なし)* / feedback: ` 引数: "feedback_packet={stage_packet_path}"` |
| model | pipeline-config の step_models.step2（null なら未指定=セッション既定） |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `対話ありの Step です。confidence が low の項目がある場合は、**必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案以上＋⭐推奨＋一行説明＋推奨理由）で作成し、dialogue_policy に従って処理してください**。RDRA に存在しない要素を追加したい場合は appendTodo.js で docs/todo.md に登録し、確認推奨項目として扱うこと（自動追加禁止）。` |

### Step3: architecture

| 変数 | 値 |
|------|-----|
| role | アーキテクチャ設計 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}, nfr:{nfr_event_id}` |
| skill_name | distillery:dist-architecture |
| skill_args | 通常: *(なし)* / feedback: ` 引数: "feedback_packet={stage_packet_path}"` |
| model | pipeline-config の step_models.step3（null なら未指定=セッション既定） |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id}, nfr:{nfr_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `対話ありの Step です。confidence が low の項目がある場合は、**必ず「確認推奨項目リスト」を作成し dialogue_policy に従って処理してください**（3案以上＋⭐推奨＋一行説明＋推奨理由）。RDRA に存在しない要素を追加したい場合は appendTodo.js で docs/todo.md に登録し、確認推奨項目として扱うこと（自動追加禁止）。**出力の分割書き出し**: arch-design.yaml（差分更新時は arch-design-diff.yaml）は一括 Write せず、dist-architecture SKILL.md の「分割書き出し」手順に従い arch-design.parts/（差分時は arch-design-diff.parts/）へセクション単位で小分けに書き出してから mergeArchDesignParts.js で連結し、バリデーション PASS 後に parts を削除すること（大出力の Write 失敗防止）。` |

### Step4a: infrastructure（MCL実行）

| 変数 | 値 |
|------|-----|
| role | インフラ設計（MCL実行） |
| trigger_event_line | `前段イベント: arch:{arch_event_id}, nfr:{nfr_event_id}` |
| skill_name | distillery:dist-infrastructure |
| skill_args | 通常: *(なし)* / feedback: ` 引数: "feedback_packet={stage_packet_path}"` |
| model | pipeline-config の step_models.step4a（null なら未指定=セッション既定） |
| trigger_event_instruction | `前段イベント arch:{arch_event_id}, nfr:{nfr_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `Phase1 (product-input 生成) と Phase2 (MCL product-design 実行) のみを実行してください。Phase3〜5 は別サブエージェントが担当するので実行しないでください。MCL 成果物の生成が完了したら、イベントディレクトリパスとイベントIDを報告して完了してください。対話ありの Step です。クラウドベンダー選択、リージョン、コスト方針など confidence: low の項目は必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案＋⭐推奨＋一行説明）で作成し、dialogue_policy に従って処理してください。RDRA に存在しない要素を追加する場合は appendTodo.js で docs/todo.md に登録してください。` |

### Step4b: infrastructure（イベント記録・Arch フィードバック）

| 変数 | 値 |
|------|-----|
| role | インフラ設計（イベント記録・Arch フィードバック） |
| trigger_event_line | *(なし — Step4a の結果から取得)* |
| skill_name | distillery:dist-infrastructure（ただしスキル呼び出しは不要。直接 Phase3〜5 を実行） |
| skill_args | *(なし。feedback時はStep4aの同じstage packetを直接読む)* |
| model | pipeline-config の step_models.step4b（既定 "sonnet"。イベント記録中心のため軽量化） |
| trigger_event_instruction | *(なし)* |
| additional_instructions | `Step4a が生成した MCL 成果物をもとに以下を実行してください: Phase3: infra-event.yaml 生成 + docs/infra/latest/ スナップショット / Phase4: arch-design.yaml へのフィードバック（新規 arch event 生成） / Phase5: write-back check。skills/dist-infrastructure/SKILL.md の Phase3〜5 セクションを参照すること。対話ありの Step です。confidence: low の項目は必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案＋⭐推奨＋一行説明）で作成し、dialogue_policy に従って処理してください。RDRA に存在しない要素を追加する場合は appendTodo.js で docs/todo.md に登録してください。` |

### Step5: design-system

| 変数 | 値 |
|------|-----|
| role | デザインシステム生成 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}, arch:{arch_event_id}` |
| skill_name | distillery:dist-design-system |
| skill_args | 通常: ` 引数: "design_generation=required"` / feedback: ` 引数: "feedback_packet={stage_packet_path} design_generation=required"`（pipeline が Step5 を起動する = config で実行が確定しているため、dist-design-system 側の「UI 無し → skip 推奨で終了」を抑止する） |
| model | pipeline-config の step_models.step5（null なら未指定=セッション既定） |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id}, arch:{arch_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `Step8（画面確認）は特に重要です。必ず実行してください。対話ありの Step です。confidence が low の項目がある場合は、**必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案以上＋⭐推奨＋一行説明＋推奨理由）で作成し、dialogue_policy に従って処理してください**。RDRA に存在しない要素を追加したい場合は appendTodo.js で docs/todo.md に登録し、確認推奨項目として扱うこと（自動追加禁止）。` |

### Step6: spec

> **design 無し版**（`skip_steps` に step5 がある、または `docs/design/latest/design-event.yaml` が無い場合）:
> `trigger_event_line` と `trigger_event_instruction` から `design:{design_event_id}` を外し、
> skill_args に ` 引数: "design_available=false"`（feedback: `"feedback_packet=... design_available=false"`）を渡し、
> additional_instructions の先頭に次を追記する:
> `デザインシステムはこの実行では使用しません（design_available=false。docs/design/latest/ が残っていても読まないこと）。dist-spec SKILL.md の「design 無しモード」で実行し、画面仕様・コンポーネント設計・screens は生成せず、spec-event.yaml に story_generation: not_applicable を記録してください。`
>
> design あり版では skill_args に ` 引数: "design_available=true"` を渡す。

| 変数 | 値 |
|------|-----|
| role | UC 仕様生成 |
| trigger_event_line | `前段イベント: rdra:{rdra_event_id}, arch:{arch_event_id}, design:{design_event_id}` |
| skill_name | distillery:dist-spec |
| skill_args | 通常: *(なし)* / feedback: ` 引数: "feedback_packet={stage_packet_path}"` |
| model | pipeline-config の step_models.step6（null なら未指定=セッション既定） |
| trigger_event_instruction | `前段イベント rdra:{rdra_event_id}, arch:{arch_event_id}, design:{design_event_id} を trigger_event としてイベントに記録してください。` |
| additional_instructions | `対話ありの Step です。API 命名規則、エラーハンドリング戦略、RDB 正規化レベルなど confidence: low の項目は必ず「確認推奨項目リスト」を dialogue-format.md 準拠（3案＋⭐推奨＋一行説明）で作成し、dialogue_policy に従って処理してください。RDRA に存在しないエンティティを追加する場合は appendTodo.js で docs/todo.md に登録し、自動追加しないこと。**並列実行必須**: UC 単位 Spec 生成・レビューは dist-spec SKILL.md の並列指示（1 subagent 8-10 UC）に従い、複数 subagent を**単一メッセージで同時起動**すること。直列処理は禁止（例外: 実行環境で Agent/Task ツールが利用できない場合のみ、その旨を完了報告に明記した上で順次処理してよい）。` |
