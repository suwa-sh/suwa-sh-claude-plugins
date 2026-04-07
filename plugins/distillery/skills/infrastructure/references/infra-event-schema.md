# infra-event.yaml スキーマ定義

infra イベントのメタデータ、変換サマリ、MCL 実行結果、arch フィードバック記録を格納する YAML のスキーマ。

## スキーマ

```yaml
# === 必須フィールド ===
version: "1.0"                          # スキーマバージョン
event_id: string                        # イベント ID（{YYYYMMDD_HHMMSS}_infra_product_design）
created_at: string                      # ISO 8601 日時
source: string                          # トリガー説明

# === トレーサビリティ参照 ===
arch_event_ref: string                  # 入力とした arch イベント ID
nfr_event_ref: string                   # 入力とした NFR イベント ID
foundation_context_ref: string          # Foundation コンテキストの artifact_id
shared_platform_context_ref: string     # Shared Platform コンテキストの artifact_id（"none" も可）

# === 変換サマリ ===
translation:
  workload_type: string                 # web_app | api | batch | event_driven
  availability_tier: string             # 99% | 99.9% | 99.95% | 99.99%
  latency_target_p99: string            # 200ms | 500ms | 1s | none
  data_classification: string           # public | internal | restricted
  traffic_pattern_type: string          # steady | spike | scheduled | event_driven
  consistency_model: string             # strong | eventual
  cost_posture: string                  # cost_optimized | balanced | performance_optimized
  target_clouds:                        # 対象クラウド一覧
    - string                            # aws | azure | gcp

# === MCL 実行結果 ===
mcl_execution:
  status: string                        # completed | partial | failed
  completed_at: string                  # ISO 8601 日時（完了した場合）
  outputs:                              # 生成されたファイル一覧
    - path: string                      # 出力ファイルパス（プロジェクトルートからの相対）
      status: string                    # generated | skipped | failed
      description: string              # 出力内容の説明（任意）

# === Arch フィードバック記録 ===
# Step3 完了前: null（未実行）
# Step3 完了後（フィードバックなし）: feedback_items が空配列
# Step3 完了後（フィードバックあり）: feedback_items に項目が入る
arch_feedback:                          # null | object
  arch_feedback_event_id: string        # arch フィードバックイベント ID
  feedback_items:                       # フィードバック項目一覧（空配列可）
    - target: string                    # arch-design.yaml 内のターゲットパス
      action: string                    # add | upgrade
      id: string                        # policy/rule の場合の ID（任意）
      description: string               # フィードバック内容
      source: string                    # MCL 出力ファイル名
```

## フィールド詳細

### version

固定値 `"1.0"`。

### event_id

形式: `{YYYYMMDD_HHMMSS}_infra_product_design`

例: `20260328_140000_infra_product_design`

### source

典型的な値:
- `"arch-design.yaml からのインフラ設計変換"`
- `"アーキテクチャ設計のインフラ具体化"`

### translation

Step1 で arch + NFR から推論した MCL 入力のサマリ。各フィールドの推論根拠は `_inference.md` に記載する。

### mcl_execution

MCL product-design スキルの実行結果。outputs には生成された全ファイルをリストする。

典型的な outputs:
```yaml
outputs:
  - path: "specs/product/output/product-workload-model.yaml"
    status: "generated"
  - path: "specs/product/output/product-mapping-aws.yaml"
    status: "generated"
  - path: "specs/product/output/product-impl-aws.yaml"
    status: "generated"
  - path: "specs/product/output/product-observability.yaml"
    status: "generated"
  - path: "specs/product/output/product-cost-hints.yaml"
    status: "generated"
```

## 必須出力ファイル

MCL 実行完了時（`mcl_execution.status: "completed"`）に、以下のファイルが event ディレクトリ内に存在することを検証する。パスは event ディレクトリからの相対パス。

| カテゴリ | 必須ファイルパターン | 説明 |
|---------|-------------------|------|
| MCL 入力 | `specs/product/input/product-input.yaml` | ワークロード入力 |
| ワークロードモデル | `specs/product/output/product-workload-model.yaml` | ベンダーニュートラルモデル |
| ベンダーマッピング | `specs/product/output/product-mapping-*.yaml` | 最低1ファイル |
| 実装仕様 | `specs/product/output/product-impl-*.yaml` | 最低1ファイル |
| オブザーバビリティ | `specs/product/output/product-observability.yaml` | オブザーバビリティ仕様 |
| コストヒント | `specs/product/output/product-cost-hints.yaml` | コスト最適化ヒント |

`mcl_execution.status` が `"completed"` 以外の場合、必須ファイルチェックはスキップする。

### arch_feedback

Step3 でフィードバックが完了した後に追記する。

#### feedback_items[].target

arch-design.yaml 内のターゲットパス:
- `"technology_context.constraints"` — 技術制約の追加
- `"system_architecture.cross_tier_policies"` — クロスティアポリシーの追加
- `"system_architecture.cross_tier_rules"` — クロスティアルールの追加
- `"system_architecture.tiers[tier-xxx].policies"` — ティア固有ポリシーの追加
- `"data_architecture.storage_mapping[E-xxx].confidence"` — confidence の昇格

#### feedback_items[].action

- `"add"` — 新規項目の追加
- `"upgrade"` — 既存項目の confidence 昇格（medium → high 等）

## 例

```yaml
version: "1.0"
event_id: "20260328_140000_infra_product_design"
created_at: "2026-03-28T14:00:00"
source: "arch-design.yaml からのインフラ設計変換"

arch_event_ref: "20260328_120000_initial_arch"
nfr_event_ref: "20260328_100000_virtual_room_nfr"
foundation_context_ref: "foundation-context"
shared_platform_context_ref: "shared-platform-context"

translation:
  workload_type: "web_app"
  availability_tier: "99.9%"
  latency_target_p99: "200ms"
  data_classification: "restricted"
  traffic_pattern_type: "spike"
  consistency_model: "strong"
  cost_posture: "balanced"
  target_clouds:
    - "aws"

mcl_execution:
  status: "completed"
  completed_at: "2026-03-28T14:30:00"
  outputs:
    - path: "specs/product/output/product-workload-model.yaml"
      status: "generated"
    - path: "specs/product/output/product-mapping-aws.yaml"
      status: "generated"
    - path: "specs/product/output/product-impl-aws.yaml"
      status: "generated"
    - path: "specs/product/output/product-observability.yaml"
      status: "generated"
    - path: "specs/product/output/product-cost-hints.yaml"
      status: "generated"

arch_feedback:
  arch_feedback_event_id: "20260328_143000_arch_infra_feedback_20260328_140000_infra_product_design"
  feedback_items:
    - target: "technology_context.constraints"
      action: "add"
      description: "RDB 接続プール上限 200（マネージド RDB 共通制約）"
      source: "product-impl-aws.yaml"
    - target: "system_architecture.cross_tier_policies"
      action: "add"
      id: "CTP-020"
      description: "SLI/SLO ベースのオブザーバビリティ方針"
      source: "product-observability.yaml"
    - target: "data_architecture.storage_mapping[E-001].confidence"
      action: "upgrade"
      description: "medium → high（RDB 適合確認済み）"
      source: "product-mapping-aws.yaml"
```
