# 変更サマリ

- event_id: 20260412_164019_arch_infra_feedback
- trigger_event: infra:20260412_162437_infra_product_design

## 種別: インフラ設計からのアーキテクチャフィードバック

### 追加: technology_context.constraints

| # | 制約 | 根拠 |
|---|------|------|
| 1 | RDB 接続プール上限 100（マネージド RDB 小規模インスタンスの共通制約） | product-impl-aws.yaml: max_connections: 100 |
| 2 | FaaS API 連携時実行時間上限 29 秒（API ゲートウェイ連携の共通制約） | product-impl-aws.yaml: Lambda timeout: 29 |

### 追加: cross_tier_policies

| # | ID | 名前 | 説明 | 根拠 |
|---|-----|------|------|------|
| 1 | CTP-034 | SLI/SLO ベースのオブザーバビリティ方針 | 可用性/レイテンシ/エラー率の SLI/SLO 定義と burn rate アラート | product-observability.yaml |

### 変更: data_architecture.storage_mapping confidence 昇格

| # | エンティティ | 変更前 | 変更後 | 根拠 |
|---|------------|--------|--------|------|
| 1 | E-005（統計情報） | default | medium | product-mapping-aws.yaml: fidelity = exact |

### 変更なし

- confidence: "user" の項目はすべて不変
- 既存 policy/rule の削除・変更なし
- ティア構成の変更なし
- ベンダー固有サービス名の混入なし
