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
