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
```

## 運用ルール

- **判断の多い Step（step1/2/3/5/6）は null のまま**（セッション既定 = 上位モデル）を推奨する
- **haiku はデフォルトにしない**: step4b の YAML 整合や step6a の TSX 生成には品質リスクがある。
  コスト優先で試す場合のみユーザーが明示的に設定する
- feedback mode でも同じ config を使う（stage 実行のモデル解決は通常 mode と共通）
- 不明なキーは無視してよいが、`step_models` 配下の値は文字列または null であること。
  それ以外の型を検出したら該当 Step は null 扱いとし、警告をユーザーに報告する
