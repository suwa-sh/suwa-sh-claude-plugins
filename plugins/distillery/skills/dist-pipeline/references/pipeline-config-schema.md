# pipeline-config.yaml スキーマ

`docs/pipeline/pipeline-config.yaml` のスキーマ正本。★ **モデル指定の正はこのファイル（の実体）に一本化する**
（agent 定義や SKILL.md へ埋め込まない。distillery-impl の impl-config.yaml と同じ原則）。

## 読込タイミングと生成

- pipeline の Step0（入力確認）で読み込む
- ファイルが存在しない場合は下記デフォルト値で `docs/pipeline/pipeline-config.yaml` を生成する
- 解決した step_models は実行開始時にユーザーへ報告する

## スキーマ（デフォルト値つき）

```yaml
# docs/pipeline/pipeline-config.yaml
schema_version: distillery.pipeline-config/v1

# Step 別モデル指定。null = 未指定（セッション既定モデルを使う）。
# 値は Agent/Task ツールの model パラメータにそのまま渡す（例: "sonnet", "haiku", "opus"）。
step_models:
  step0h: null      # harvest（既存プロジェクト取り込み。要求逆生成の判断が多い）
  step1: null       # requirements（要求解釈）
  step2: null       # quality-attributes（NFR 推論）
  step3: null       # architecture（設計判断）
  step4a: null      # infrastructure MCL 実行
  step4b: "sonnet"  # infrastructure イベント記録・FB（機械的作業中心のため軽量化）
  step5: null       # design-system
  step6: null       # spec
  step6a: "sonnet"  # Storybook Story 補完（規約準拠のコード量産のため軽量化）

# skip する Step（任意。省略時 = []）。UI 画面を持たないプロダクト（CLI / API / バッチのみ）向け。
# 許容値: step5（design-system）, step6a（spec-stories）。step5 を指定すると step6a も暗黙に skip される。
# ★ 自動生成時はこのキーを書かない（コメントのまま）。キーが無い = 「未判断」で、Step3 後に skip 推奨が発動する。
#   skip_steps: [] と明示すると「design を実行する」意思になり推奨は出ない。
# skip_steps: [step5, step6a]
```

## skip_steps の仕様

| 項目 | 内容 |
|------|------|
| 型 | 文字列の配列。省略時・null は `[]` と同義 |
| 許容値 | `step5`, `step6a` のみ。他の値は**警告してその値だけ無視**する（config 全体は有効） |
| 暗黙 skip | `step5` を含む場合、`step6a` も skip する（spec-stories は storybook-app を前提とするため） |
| 通常 mode | Step5 / Step6a のサブエージェントを起動せず、progress は `completed --summary "skipped (skip_steps)"` で進める。Step6（spec）は design 無しモードで実行する |
| feedback mode | `references/feedback-mode.md` F0b の begin で `--skip-stages` として planner に渡す（`step5` → `design_system`、`step6a` → `spec_stories`。対応は `feedback-stage-ownership.json` の `steps`）。closure から除外され `routing_basis.skipped_stages` に凍結される |
| 自動生成 | ファイルを新規生成するときは `skip_steps` キーを**書かない**（コメント行のみ）。書くと推奨判定が発動しなくなる |
| 推奨提示 | `skip_steps` キー自体が**未定義**で、Step3 完了後の `arch-design.yaml` の `system_architecture.tiers[].id` に `frontend` / `presentation` / `ui` を含む tier が無い場合、パイプラインが「design ステージの実行」を確認推奨項目として提示する（`SKILL.md` の「Step3 完了後: design skip 推奨判定」）。`skip_steps: []` を明示した場合は「実行する」意思とみなし提示しない |
| 書き戻し | 推奨を採用（auto_adopt の ⭐採用、または interactive で選択）した場合、パイプラインが `skip_steps` をこのファイルに書き戻す。書き戻しは lease 取得中のみ行う |

design 無しで実行された dist-spec は `docs/specs/latest/spec-event.yaml` に `story_generation: not_applicable` を記録する。
Step6a はこの値でも skip する（`skip_steps` に `step6a` が無くても）。

## 読込方法

`node <skill-path>/scripts/resolvePipelineConfig.js docs/pipeline/pipeline-config.yaml` で読む（YAML parser 経由）。
`step_models`（型を正規化）/ `skip_steps`（暗黙 skip 込み）/ `skip_steps_defined`（キーの有無）/ `warnings` を JSON で返す。
grep による行判定はインデントやコメント行を誤検出するため使わない。

## 運用ルール

- **判断の多い Step（step1/2/3/5/6）は null のまま**（セッション既定 = 上位モデル）を推奨する
- **haiku はデフォルトにしない**: step4b の YAML 整合や step6a の TSX 生成には品質リスクがある。
  コスト優先で試す場合のみユーザーが明示的に設定する
- feedback mode でも同じ config を使う（stage 実行のモデル解決は通常 mode と共通）
- 不明なキーは無視してよいが、`step_models` 配下の値は文字列または null であること。
  それ以外の型を検出したら該当 Step は null 扱いとし、警告をユーザーに報告する
- `skip_steps` が配列でない場合は `[]` 扱いとし、警告をユーザーに報告する
- 解決した `skip_steps`（暗黙 skip を含む）は step_models と同時に実行開始時にユーザーへ報告する

## 速度優先プリセット（オプトイン）

デフォルトは上記の品質優先設定を維持する。**壁時計時間とトークンコストを優先したい場合のみ**、
ユーザーが明示的に次の設定へ書き換える。

```yaml
# 速度優先プリセット（品質トレードオフあり。ユーザーが明示設定した場合のみ）
step_models:
  step0h: null      # 逆生成の判断が多いため既定のまま
  step1: null       # 要求解釈は既定のまま
  step2: "sonnet"   # NFR 推論はカタログ参照中心（nfr-inference-rules.md のルール適用）
  step3: null       # アーキテクチャは判断密度が最も高いため既定のまま
  step4a: "sonnet"  # MCL 実行はスキル手順への追従が中心
  step4b: "sonnet"  # デフォルトと同じ
  step5: "sonnet"   # design-system はトークン規約への追従中心。独自ブランド要求が強い場合は null に戻す
  step6: null       # spec は要件トレーサビリティの判断が多いため既定のまま
  step6a: "sonnet"  # デフォルトと同じ
```

適用時の注意:

- step2/step4a/step5 の sonnet 化は「ルール・カタログ・テンプレートへの追従が中心」という
  作業特性に基づく。推論の質が下がったと感じたら該当 Step だけ null に戻す
- step3（architecture）と step6（spec）は速度優先でも null を維持する。
  設計判断・トレーサビリティ判断の劣化は後続全 Step に波及するため、節約効果より手戻りリスクが大きい
