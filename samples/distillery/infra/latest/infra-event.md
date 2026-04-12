# インフラ設計イベント

| 項目 | 値 |
|------|-----|
| イベント ID | 20260412_162437_infra_product_design |
| 作成日時 | 2026-04-12T16:24:37 |
| ソース | arch-design.yaml からのインフラ設計変換 |
| Arch 参照 | 20260412_161337_initial_arch |
| NFR 参照 | 20260412_154304_initial_nfr |

## 変換サマリ

| 特性 | 値 |
|------|-----|
| ワークロードタイプ | web_app |
| 可用性 | 99.9% |
| レイテンシ p99 | 1s |
| データ分類 | restricted |
| トラフィック | scheduled |
| 整合性 | strong |
| コスト方針 | cost_optimized |
| 対象クラウド | aws |

## MCL 実行結果

| ステータス | completed |

### 出力ファイル

| パス | ステータス |
|------|-----------|
| specs/product/output/product-workload-model.yaml | generated |
| specs/product/output/product-mapping-aws.yaml | generated |
| specs/product/output/product-impl-aws.yaml | generated |
| specs/product/output/product-observability.yaml | generated |
| specs/product/output/product-cost-hints.yaml | generated |
| docs/cloud-context/decisions/product/product-decision-compute-model.yaml | generated |
| docs/cloud-context/decisions/product/product-decision-database-engine.yaml | generated |
| docs/cloud-context/conformance/product/product-conformance-aws.yaml | generated |
| docs/cloud-context/generated-md/product/architecture-overview.md | generated |
| docs/cloud-context/sources/aws/aws-well-architected-framework.md | generated |
| docs/cloud-context/sources/aws/aws-rds-postgresql.md | generated |
| docs/cloud-context/sources/aws/aws-elasticache-redis.md | generated |
| infra/product/aws/main.tf | generated |
| infra/product/aws/variables.tf | generated |
| infra/product/aws/outputs.tf | generated |

## Arch フィードバック

### フィードバック項目

| ターゲット | アクション | 説明 |
|-----------|-----------|------|
| technology_context.constraints | add | RDB 接続プール上限 100（マネージド RDB 小規模インスタンスの共通制約） |
| technology_context.constraints | add | FaaS API 連携時実行時間上限 29 秒（API ゲートウェイ連携の共通制約） |
| system_architecture.cross_tier_policies | add | SLI/SLO ベースのオブザーバビリティ方針（可用性/レイテンシ/エラー率の SLI/SLO + burn rate アラート） |
| data_architecture.storage_mapping[E-005].confidence | upgrade | default -> medium（RDB 適合確認済み、fidelity: exact） |
