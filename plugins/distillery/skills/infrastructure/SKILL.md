---
name: infrastructure
description: >
  アーキテクチャ設計（arch-design.yaml）から MCL product-design スキルを使って
  クラウドインフラ設計を生成し、その結果をアーキテクチャ設計にフィードバックするスキル。
  RDRA → NFR → Arch → Infra → Arch feedback パイプラインの Infra ステージを担当。
  arch-design.yaml のベンダーニュートラルなティア構成・NFR グレードを
  MCL のワークロード入力に自動変換し、mcl-product-design でベンダー別インフラ設計
  （workload model, vendor mapping, impl spec, observability, cost hints, IaC skeleton）を生成。
  生成結果からベンダーニュートラルな知見を抽出し、arch-design.yaml にフィードバックイベントとして追記する。
  イベントソーシングで履歴管理。foundation は必須、shared-platform は任意。
  「インフラ設計」「クラウド設計」「MCL 実行」「インフラからアーキへフィードバック」
  「ワークロードモデル生成」「プロダクトインフラ」「クラウドサービス選定」
  「arch から infra」「infra feedback」「MCL product-design」
  「アーキテクチャをインフラに変換」「ベンダーマッピング」などで発動。
  アーキテクチャ設計後にクラウドインフラの具体化が必要な場合にも積極的に使うこと。
---

# インフラ設計 + アーキテクチャフィードバックスキル

アーキテクチャ設計（arch-design.yaml）を MCL product-design の入力に変換し、クラウドインフラ設計を生成。
その結果からベンダーニュートラルな知見を抽出してアーキテクチャ設計にフィードバックする。

## 前提条件

### 依存スキル

本スキルは MCL（Multi-Cloud Lifecycle）スキル群に依存する。パイプライン開始前に以下のスキルが利用可能か確認すること:

```bash
# 依存スキルの存在チェック（user skill / plugin skill / repo skill 全パスを走査）
for skill in mcl-common mcl-product-design; do
  if ls ~/.claude/skills/$skill/SKILL.md \
        ~/.claude/plugins/*/plugins/*/skills/$skill/SKILL.md \
        ~/.claude/plugins/*/skills/$skill/SKILL.md \
        /Users/*/src/**/.claude/skills/$skill/SKILL.md 2>/dev/null | head -1 > /dev/null 2>&1; then
    echo "OK: $skill"
  else
    echo "MISSING: $skill"
  fi
done
```

いずれかが MISSING の場合:
1. ユーザーに「MCL スキル（mcl-common, mcl-product-design）がインストールされていません。インストールしますか？」と確認する
2. 承認後、以下のコマンドでインストールを試みる:
   ```bash
   claude plugin install suwa-sh/multi-cloud-lifecycle-skills
   ```
3. インストールに失敗した場合は、以下の手動インストール手順を提示する:
   ```
   MCL スキルの手動インストール手順:
   1. https://github.com/suwa-sh/multi-cloud-lifecycle-skills をクローン
   2. リポジトリ内の skills/ 配下の各スキルを user skill ディレクトリ（`~/.claude/skills/`）にコピー、またはプラグインとしてインストール
      - mcl-common/
      - mcl-product-design/
      - mcl-foundation-design/（foundation 実行時に必要）
      - mcl-shared-platform-design/（shared-platform 実行時に必要）
   3. コピー後、Claude Code を再起動
   ```

### 入力データ

- `docs/arch/latest/arch-design.yaml` が存在すること（architecture スキル実行済み）
- `docs/rdra/latest/*.tsv` が存在すること
- `docs/rdra/latest/システム概要.json` が存在すること
- `docs/nfr/latest/nfr-grade.yaml` が存在すること
- `specs/foundation/output/foundation-context.yaml` が存在すること（MCL foundation 実行済み）
- `specs/shared-platform/output/shared-platform-context.yaml` は**任意**（存在しない場合は Step1 で最小コンテキストを自動生成）

## ハイブリッド方式の概要

> **⚠ ハイブリッド方式**: infra スキルは成果物ごとに扱いが異なる。

| 成果物 | 方式 | events/ に含む | latest/ の更新 |
|--------|------|:-------------:|--------------|
| `infra-event.yaml` | **差分マージ** | `infra-event-diff.yaml` | フィールド単位でマージ |
| `MCL 出力`（specs/, docs/, infra/） | **★ 全量上書き** | 全量を含む | 全量で上書き |

**MCL（mcl-product-design）は差分出力をサポートしない**ため、MCL 出力は常に全量。infra-event.yaml の変換サマリやフィードバック記録は差分マージ可能。

## ディレクトリ構成

```
docs/
  infra/
    events/{event_id}/
      infra-event.yaml              # 初期構築時: 全フィールドの完全版
      infra-event-diff.yaml         # 差分更新時: 変更フィールドのみ
      infra-event.md                # Markdown 表現
      _changes.md                   # 変更サマリ（追加/変更/削除）
      _inference.md                 # 変換推論根拠
      source.txt                    # トリガー説明
      specs/                        # MCL ルートとして直接出力される
        product/
          input/product-input.yaml  # MCL 入力
          output/                   # MCL 出力（workload-model, mapping, impl, observability, cost-hints）
        foundation/output/          # foundation-context のコピー（MCL 参照用）
        shared-platform/output/     # shared-platform-context のコピー（MCL 参照用）
      docs/cloud-context/           # MCL が直接出力（decisions, conformance, generated-md, sources）
      infra/product/{vendor}/       # MCL が直接出力（IaC スケルトン）
    latest/                         # 最新スナップショット（events/{event_id}/ の全量コピー）
      infra-event.yaml
      infra-event.md
      specs/...
      docs/...
      infra/...
  arch/
    events/{feedback_event_id}/     # arch フィードバックイベント（arch 差分イベント方式に準拠）
      arch-design-diff.yaml         # フィードバックによる変更セクションのみ（差分）
      arch-design.md
      coverage-report.md
      _changes.md                   # 変更サマリ
      _inference.md
      source.txt
    latest/                         # 差分マージ後のスナップショット
```

### MCL ルートディレクトリ方式

MCL product-design スキルのプロジェクトルートを `docs/infra/events/{event_id}/` に設定する。
これにより MCL の全出力が event ディレクトリ内に直接生成される。集約や後処理は不要。

**MCL 実行前の準備**:
1. `docs/infra/events/{event_id}/specs/product/input/product-input.yaml` — Step1 で生成
2. `docs/infra/events/{event_id}/specs/foundation/output/foundation-context.yaml` — プロジェクトルートからコピー
3. `docs/infra/events/{event_id}/specs/shared-platform/output/shared-platform-context.yaml` — プロジェクトルートからコピー

## 全体フロー

```
docs/arch/latest/arch-design.yaml + docs/nfr/latest/nfr-grade.yaml
  → Step1: Arch + NFR → MCL Product Input 変換（自動マッピング）
  → Step2: mcl-product-design 実行（MCL スキル呼出し）
  → Step3: Infra フィードバック → Arch 更新（イベント記録 + スナップショット更新）
  → Step4: Infra 書き戻しチェック（Arch 変更が product-input に影響するか判定）
```

---

## Step1: Arch + NFR → MCL Product Input 変換

arch-design.yaml と nfr-grade.yaml を読み取り、MCL product-design の入力形式に変換する。

### 共通コンテキスト

以下のファイルを読み込んで理解する:

- `references/translation-mapping.md` — Arch + NFR → product-input 変換マッピング一覧
- `references/infra/infra-translate.md` — 変換タスクの詳細指示
- `references/infra-event-schema.md` — infra-event.yaml スキーマ定義
- `docs/arch/latest/arch-design.yaml` — 現在のアーキテクチャ設計
- `docs/nfr/latest/nfr-grade.yaml` — NFR グレード
- `docs/rdra/latest/システム概要.json` — システム概要（名前・説明用）
- `specs/foundation/output/foundation-context.yaml` — Foundation コンテキスト（target_clouds 取得用）

### shared-platform がない場合の処理（Step1 サブステップ 1a）

`specs/shared-platform/output/shared-platform-context.yaml` が存在しない場合、**Step1 のサブステップ 1a として**以下を実施する:

1. ユーザーに「shared-platform コンテキストが見つかりません。最小構成で進めますか？」と確認する
2. 確認後、以下の最小 shared-platform-context.yaml を **event ディレクトリ内の `specs/shared-platform/output/`**（`docs/infra/events/{event_id}/specs/shared-platform/output/`）に生成する。加えて、プロジェクトルートの `specs/shared-platform/output/` にも同じファイルを生成する（後続の実行で再利用するため）:

```yaml
schema_version: "1.0"
artifact_type: "context"
skill_type: "shared_platform"
artifact_id: "shared-platform-context"
title: "共有プラットフォーム コンテキスト（最小構成）"
status: "draft"
generated_at: "{date '+%Y-%m-%dT%H:%M:%S' コマンドで取得した現在日時}"
source_refs: []
decision_refs: []
inputs_ref:
  - "foundation-context"

available_shared_services: []
mandatory_services: []
optional_services: []
```

### タスク

1. イベント ID を生成: `date '+%Y%m%d_%H%M%S'` コマンドでタイムスタンプを取得し、`{YYYYMMDD_HHMMSS}_infra_product_design` 形式で生成する
2. イベントディレクトリを作成: `docs/infra/events/{event_id}/`
3. `references/infra/infra-translate.md` に従い、arch-design.yaml と nfr-grade.yaml から `docs/infra/events/{event_id}/specs/product/input/product-input.yaml` を生成する
4. MCL 実行に必要な上位コンテキストをイベントディレクトリにコピー:
   ```bash
   mkdir -p docs/infra/events/{event_id}/specs/foundation/output/
   mkdir -p docs/infra/events/{event_id}/specs/shared-platform/output/
   cp specs/foundation/output/foundation-context.yaml docs/infra/events/{event_id}/specs/foundation/output/
   cp specs/shared-platform/output/shared-platform-context.yaml docs/infra/events/{event_id}/specs/shared-platform/output/
   ```

### 出力

- `docs/infra/events/{event_id}/specs/product/input/product-input.yaml`
- `docs/infra/events/{event_id}/specs/foundation/output/foundation-context.yaml`（コピー）
- `docs/infra/events/{event_id}/specs/shared-platform/output/shared-platform-context.yaml`（コピー）

---

## Step2: mcl-product-design 実行

生成した product-input.yaml を使って MCL product-design スキルを実行する。

### 共通コンテキスト

- `references/infra/infra-execute.md` — MCL 実行タスクの詳細指示
- `references/event-sourcing-rules.md` — イベントソーシングルール

### MCL 出力期待値

MCL product-design が正常完了した場合、event ディレクトリ内に以下のファイルが生成される。パスは event ディレクトリ（`docs/infra/events/{event_id}/`）からの相対パス。

| カテゴリ | ファイルパス | 必須 | 説明 |
|---------|-----------|------|------|
| MCL 入力 | `specs/product/input/product-input.yaml` | Yes | Step1 で生成済み |
| ワークロードモデル | `specs/product/output/product-workload-model.yaml` | Yes | ベンダーニュートラルな canonical elements |
| ベンダーマッピング | `specs/product/output/product-mapping-{vendor}.yaml` | Yes | 対象クラウドごとに最低1ファイル |
| 実装仕様 | `specs/product/output/product-impl-{vendor}.yaml` | Yes | 対象クラウドごとに最低1ファイル |
| オブザーバビリティ | `specs/product/output/product-observability.yaml` | Yes | SLI/SLO、メトリクス、ログ、アラート |
| コストヒント | `specs/product/output/product-cost-hints.yaml` | Yes | コスト最適化戦略 |
| Decision Record | `docs/cloud-context/decisions/product/*.yaml` | No | 設計判断の記録 |
| Conformance | `docs/cloud-context/conformance/product/*.yaml` | No | 準拠レポート |
| IaC スケルトン | `infra/product/{vendor}/` | No | Terraform 等 |
| アーキテクチャ MD | `docs/cloud-context/generated-md/product/` | No | Mermaid 図付きドキュメント |

### タスク

`references/infra/infra-execute.md` に従い、以下を実行する:

1. MCL product-design スキルを呼び出す（Skill ツールで `mcl-product-design` を起動）
   - プロジェクトルートとして `docs/infra/events/{event_id}/` を指定する
   - Step1 で入力ファイルが配置済みのため、MCL のヒアリングはスキップされる
2. MCL の出力が完了したら、上記の必須ファイルが全て存在するか検証する
3. 検証後、infra イベントを記録する

### MCL スキル呼出しテンプレート

```
以下のプロジェクトで mcl-product-design スキルを実行してください:

- プロジェクトルート: {project_root}/docs/infra/events/{event_id}
- ワークロード入力: specs/product/input/product-input.yaml（既に存在）
- Foundation コンテキスト: specs/foundation/output/foundation-context.yaml（既に存在）
- 共有プラットフォームコンテキスト: specs/shared-platform/output/shared-platform-context.yaml（既に存在）

入力ファイルが全て揃っているため、ヒアリングはスキップし、直接ワークロードモデル生成から開始してください。
```

MCL の全出力は `docs/infra/events/{event_id}/` 配下に直接生成される（集約・移動の後処理は不要）。

### MCL 出力検証

MCL 完了後、event ディレクトリ内に期待される出力が存在するかを確認する:

```bash
# 必須ファイルの存在確認
test -f docs/infra/events/{event_id}/specs/product/output/product-workload-model.yaml && echo "OK: workload-model" || echo "MISSING: workload-model"
test -f docs/infra/events/{event_id}/specs/product/output/product-observability.yaml && echo "OK: observability" || echo "MISSING: observability"
test -f docs/infra/events/{event_id}/specs/product/output/product-cost-hints.yaml && echo "OK: cost-hints" || echo "MISSING: cost-hints"
ls docs/infra/events/{event_id}/specs/product/output/product-mapping-*.yaml >/dev/null 2>&1 && echo "OK: mapping" || echo "MISSING: mapping"
ls docs/infra/events/{event_id}/specs/product/output/product-impl-*.yaml >/dev/null 2>&1 && echo "OK: impl" || echo "MISSING: impl"
```

いずれかが MISSING の場合:
1. MCL 実行ログを確認し、エラーの原因を特定する
2. MCL がプロジェクトルート外（プロジェクト本体のルート）に出力した可能性を確認する
3. 出力先が異なる場合は event ディレクトリに移動する
4. MCL が失敗した場合はユーザーに報告し、再実行を提案する

### infra イベント記録

MCL 完了後、infra イベントを記録する:

1. trigger_event の特定（前段イベント ID を `arch:{arch_event_id}, nfr:{nfr_event_id}` 形式で記録）
2. `docs/infra/events/{event_id}/` にイベントファイルを生成:
   - **初期構築時**: `infra-event.yaml`（全フィールドの完全版） — イベントメタデータ（`references/infra-event-schema.md` に準拠）
   - **差分更新時**: `infra-event-diff.yaml`（変更フィールドのみ） — 変更があったフィールドのみを記録
   - `_changes.md` — 変更サマリ（追加/変更/削除を明記。trigger_event を含む）
   - `product-input.yaml` — 変換した MCL 入力のコピー（トレーサビリティ用）
   - `_inference.md` — 変換推論根拠（どの arch/NFR 項目からどうマッピングしたか）
   - `source.txt` — `"arch-design.yaml からのインフラ設計変換"`

### バリデーション

```bash
node <skill-path>/scripts/validateInfraEvent.js docs/infra/events/{event_id}/infra-event.yaml
```

- 終了コード 0（PASS）: Markdown 生成へ進む
- 終了コード 1（FAIL）: エラー内容を確認し修正

`<skill-path>` は本スキルのディレクトリパス（`${CLAUDE_PLUGIN_ROOT}/skills/infrastructure`）。

### Markdown 生成

```bash
node <skill-path>/scripts/generateInfraEventMd.js docs/infra/events/{event_id}/infra-event.yaml
```

### infra スナップショット更新

`references/infra/infra-snapshot-update.md` および `references/event-sourcing-rules.md` に従い、`docs/infra/latest/` をハイブリッドマージで更新する。

- **初期構築時**: `events/{event_id}/` の全量を `latest/` にコピーする
- **差分更新時**:
  1. `events/{event_id}/infra-event-diff.yaml` の変更フィールドを `latest/infra-event.yaml` に差分マージする
  2. MCL 出力（`events/{event_id}/specs/product/output/` 等）は `latest/` に全量上書きする
  3. `latest/product-input.yaml` を `events/{event_id}/product-input.yaml` で上書きする
  4. `latest/infra-event.md` を再生成する

### 出力

#### 初期構築時

- `docs/infra/events/{event_id}/infra-event.yaml`（完全版）
- `docs/infra/events/{event_id}/infra-event.md`
- `docs/infra/events/{event_id}/_changes.md`
- `docs/infra/events/{event_id}/product-input.yaml`
- `docs/infra/events/{event_id}/_inference.md`
- `docs/infra/events/{event_id}/source.txt`
- `docs/infra/events/{event_id}/specs/product/output/` （MCL 出力）
- `docs/infra/events/{event_id}/docs/cloud-context/` （decisions, conformance, generated-md, sources）
- `docs/infra/events/{event_id}/infra/product/{vendor}/` （IaC スケルトン）
- `docs/infra/latest/` （スナップショット。events/{event_id}/ の全量コピー）

#### 差分更新時

- `docs/infra/events/{event_id}/infra-event-diff.yaml`（変更フィールドのみ）
- `docs/infra/events/{event_id}/infra-event.md`
- `docs/infra/events/{event_id}/_changes.md`
- `docs/infra/events/{event_id}/product-input.yaml`
- `docs/infra/events/{event_id}/_inference.md`
- `docs/infra/events/{event_id}/source.txt`
- `docs/infra/events/{event_id}/specs/product/output/` （MCL 出力。全量）
- `docs/infra/latest/` （ハイブリッドマージ: infra-event 差分マージ + MCL 全量上書き）

---

## Step3: Infra フィードバック → Arch 更新

MCL product-design の出力を分析し、ベンダーニュートラルな知見をアーキテクチャ設計にフィードバックする。

### 共通コンテキスト

- `references/infra/infra-feedback.md` — フィードバック解析タスクの詳細指示
- `references/arch-feedback-rules.md` — フィードバックルール（何を戻すか/戻さないか）
- `references/event-sourcing-rules.md` — イベントソーシングルール
- MCL 出力ファイル群（`docs/infra/events/{event_id}/specs/product/output/` 配下）
- `docs/arch/latest/arch-design.yaml` — 現在のアーキテクチャ設計

### タスク

`references/infra/infra-feedback.md` に従い、以下を実行する:

1. MCL 出力を分析し、arch にフィードバックすべき知見を抽出する
2. 抽出した知見をユーザーに提示し、フィードバック内容を確認する
3. 確認後、arch-design.yaml を更新する
4. arch フィードバックイベントを記録する

### フィードバックの方針

- **ベンダーニュートラル化**: MCL 出力のベンダー固有サービス名はベンダーニュートラルな表現に変換して追加する
- **confidence: "user" は不変**: ユーザーが確定した項目は一切変更しない
- **新規項目の出自表示**: source_model に `"infra: {詳細}"` を設定、confidence は `"medium"`
- **追加のみ**: 既存の policy/rule を削除・変更しない。新規追加か confidence の昇格のみ

### arch フィードバックイベント記録

フィードバック event_id: `{YYYYMMDD_HHMMSS}_arch_infra_feedback_{infra_event_id}`（日時は `date '+%Y%m%d_%H%M%S'` コマンドで取得）

arch の差分イベント方式に準拠する（`references/event-sourcing-rules.md` の「arch フィードバックイベント」セクション参照）:

1. `arch-design-diff.yaml` 生成（フィードバックによる変更セクションのみ。差分）
2. `_changes.md` 生成（追加/変更/削除を明記。trigger_event: `infra:{infra_event_id}`）
3. `_inference.md` 生成
4. `source.txt` 生成: `"インフラ設計 {infra_event_id} に基づくアーキテクチャフィードバック"`
5. `docs/arch/latest/arch-design.yaml` に差分をマージする（arch の event-sourcing-rules.md のマージキーに従う。`confidence: "user"` の項目は上書きしない）
6. バリデーション（マージ後の latest で実行）:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/architecture/scripts/validateArchDesign.js docs/arch/latest/arch-design.yaml
   ```
7. Markdown 再生成:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/architecture/scripts/generateArchDesignMd.js docs/arch/latest/arch-design.yaml
   ```
   イベントディレクトリにもコピー:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/architecture/scripts/generateArchDesignMd.js docs/arch/events/{feedback_event_id}/arch-design-diff.yaml
   ```
8. カバレッジレポート生成:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/architecture/scripts/generateCoverageReport.js docs/rdra/latest/ docs/nfr/latest/nfr-grade.yaml docs/arch/latest/arch-design.yaml
   ```

### infra-event.yaml の arch_feedback セクション更新

フィードバック完了後、`docs/infra/events/{infra_event_id}/infra-event.yaml` の `arch_feedback` セクションに新規フィードバックを**追記**する（上書きではない。配列に追加）。infra スナップショットの `latest/infra-event.yaml` にも同様に追記する。

### 出力

- `docs/arch/events/{feedback_event_id}/arch-design-diff.yaml`（変更セクションのみ）
- `docs/arch/events/{feedback_event_id}/arch-design.md`
- `docs/arch/events/{feedback_event_id}/coverage-report.md`
- `docs/arch/events/{feedback_event_id}/_changes.md`
- `docs/arch/events/{feedback_event_id}/_inference.md`
- `docs/arch/events/{feedback_event_id}/source.txt`
- `docs/arch/latest/` （差分マージ後のスナップショット + Markdown + カバレッジレポート再生成）
- `docs/infra/events/{infra_event_id}/infra-event.yaml` （arch_feedback セクション追記）
- `docs/infra/latest/infra-event.yaml` （arch_feedback セクション追記）

---

## Step4: Infra 書き戻しチェック

Step3 で Arch にフィードバックした結果、product-input.yaml の再生成が必要になるケースがないかをチェックする。

### 共通コンテキスト

- `references/infra/infra-writeback-check.md` — 書き戻しチェックの詳細指示
- `docs/arch/latest/arch-design.yaml` — フィードバック反映後の Arch
- `docs/arch/events/{前回の arch event_id}/arch-design.yaml` — フィードバック前の Arch
- `specs/product/input/product-input.yaml` — 現在の MCL 入力

### タスク

フィードバック反映前後の arch-design.yaml を比較し、以下の **product-input に影響するフィールド** に変更があるかを判定する:

1. **ティア構成の変更**: ティアの追加・削除があった場合 → `workload_type` の再推論が必要
2. **cross_tier_policies の追加で整合性に影響するもの**:
   - 認証/認可方式の変更 → `data_sensitivity` に影響
   - DR 方針の具体化 → `recovery_target` に影響
   - 新たな外部連携追加 → `consistency_needs` や `compliance` に影響
3. **technology_context.constraints の追加で性能に影響するもの**:
   - 接続プール制限など → `traffic_pattern.baseline_rps` の上限に影響する可能性
4. **data_architecture.storage_mapping の storage_type 変更**: rdb → nosql 等 → `consistency_needs` に影響

### 判定結果

#### 書き戻し不要の場合（通常ケース）

以下のようにユーザーに報告する:

```
Step4: Infra 書き戻しチェック → 不要
  - Arch への変更は product-input.yaml の入力フィールドに影響しません
  - 追加された制約/ポリシーは MCL 出力に既に反映済みの内容です
```

#### 書き戻しが必要な場合

以下のようにユーザーに報告し、確認する:

```
Step4: Infra 書き戻しチェック → 要再実行

以下の Arch 変更が product-input.yaml に影響します:

| # | Arch 変更内容 | 影響する product-input フィールド | 影響度 |
|---|-------------|-------------------------------|--------|
| 1 | {変更内容} | {フィールド名} | {high/medium} |

推奨アクション:
1. product-input.yaml を再生成し、Step2 から再実行する
2. 影響が軽微なため今回はスキップし、次回の Infra パイプライン実行時に反映する
```

ユーザーが「1. 再実行」を選択した場合は、`references/infra/infra-writeback-check.md` の「再実行フロー」に従う:
- 新規 event_id を `{YYYYMMDD_HHMMSS}_infra_product_design_r{N}` 形式で採番する（日時は `date '+%Y%m%d_%H%M%S'` コマンドで取得）
- Step1 に戻り、フィードバック反映後の arch-design.yaml から product-input.yaml を再生成する
- Step2 以降を再実行する
- Step3 では前回フィードバックとの差分を明示する
- 再実行は最大 2 回まで（2 回超過時はアーキテクチャ設計の見直しを提案）
- 前回イベントは履歴として保持し、latest のみ新規イベントで上書きする

### 出力

- ユーザーへの判定結果レポート（テキスト出力）
- 再実行が必要な場合: Step1 からの再実行

---

## 出力チェック

パイプライン完了後、以下を確認する:

- `docs/infra/events/{event_id}/` に MCL 出力ファイルが存在すること
- 初期構築時: `docs/infra/events/{event_id}/infra-event.yaml` が存在すること
- 差分更新時: `docs/infra/events/{event_id}/infra-event-diff.yaml` が存在すること
- `docs/infra/events/{event_id}/_changes.md` が存在すること
- `docs/infra/latest/infra-event.yaml` が最新スナップショットであること
- `docs/arch/events/{feedback_event_id}/arch-design-diff.yaml` が存在すること
- `docs/arch/events/{feedback_event_id}/_changes.md` が存在すること
- `docs/arch/latest/arch-design.yaml` がフィードバック反映済みであること
- arch バリデーションスクリプトが PASS すること
- arch-design.yaml にベンダー固有のサービス名が含まれていないこと
- confidence: "user" の項目が変更されていないこと
