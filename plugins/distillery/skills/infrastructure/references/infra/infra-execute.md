# Step2: mcl-product-design 実行タスク

生成した product-input.yaml を使って MCL product-design スキルを実行し、インフラ設計を生成する。

## 前提

- `specs/product/input/product-input.yaml` が Step1 で生成済み
- `specs/foundation/output/foundation-context.yaml` が存在
- `specs/shared-platform/output/shared-platform-context.yaml` が存在（最小構成含む）

## 実行手順

### 1. MCL product-design スキルの呼出し

Skill ツールで `mcl-product-design` を起動する。

`specs/product/input/product-input.yaml` が存在するため、MCL のワークロードヒアリング（Step 2）はスキップされ、ファイルから入力を取得する。

MCL は以下の Step を順に実行する:
- Step 1: 上位コンテキスト読み込み（foundation + shared-platform）
- Step 2: ワークロード入力の取得（product-input.yaml から自動取得）
- Step 3: ベンダーソースの取得
- Step 4-12: 各種出力の生成

### 2. MCL 出力の確認

MCL 完了後、以下の出力が生成されていることを確認する:

| 出力 | パス | 必須 |
|------|------|------|
| ワークロードモデル | `specs/product/output/product-workload-model.yaml` | Yes |
| Vendor Mapping（対象クラウドごと） | `specs/product/output/product-mapping-{vendor}.yaml` | Yes |
| Implementation Spec（対象クラウドごと） | `specs/product/output/product-impl-{vendor}.yaml` | Yes |
| Observability Spec | `specs/product/output/product-observability.yaml` | Yes |
| コスト最適化ヒント | `specs/product/output/product-cost-hints.yaml` | Yes |
| Decision Record | `docs/cloud-context/decisions/product/` | No |
| Conformance Report | `docs/cloud-context/conformance/product/` | No |
| IaC スケルトン | `infra/product/{vendor}/` | No |
| アーキテクチャ Markdown | `docs/cloud-context/generated-md/product/` | No |

必須ファイルが欠けている場合は MCL の実行を再試行する。

### 3. infra イベントの記録

MCL 完了後、infra イベントを記録する。

#### イベント ID の生成

形式: `{YYYYMMDD_HHMMSS}_infra_product_design`

`date '+%Y%m%d_%H%M%S'` コマンドで日時を取得する。LLM が日時を推測してはならない。`created_at` も `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得する。

#### イベントファイルの生成

`docs/infra/events/{event_id}/` に以下を生成する:

**infra-event.yaml**

`references/infra-event-schema.md` に従い、以下を記録する:
- version, event_id, created_at, source
- arch_event_ref: `docs/arch/latest/arch-design.yaml` の `event_id`
- nfr_event_ref: `docs/nfr/latest/nfr-grade.yaml` の `event_id`
- foundation_context_ref: `foundation-context.yaml` の `artifact_id`
- shared_platform_context_ref: `shared-platform-context.yaml` の `artifact_id`（最小構成の場合も含む）
- translation: Step1 の変換サマリ
- mcl_execution: status + outputs リスト
- arch_feedback: Step3 完了後に追記する（この時点では空）

**product-input.yaml**

`specs/product/input/product-input.yaml` のコピー（トレーサビリティ用）。

**_inference.md**

Step1 で生成した推論根拠の Markdown。

**source.txt**

```
arch-design.yaml からのインフラ設計変換
```

### 4. バリデーション

```bash
node <skill-path>/scripts/validateInfraEvent.js docs/infra/events/{event_id}/infra-event.yaml
```

### 5. Markdown 生成

```bash
node <skill-path>/scripts/generateInfraEventMd.js docs/infra/events/{event_id}/infra-event.yaml
```

### 6. infra スナップショット更新

`references/infra/infra-snapshot-update.md` に従い、`docs/infra/latest/` を更新する。
