# 変更サマリ

- trigger_event: `arch:20260903_032540_initial_arch`, `nfr:20260903_031858_initial_nfr`
- event_id: `20260903_040307_infra_product_design`（初期構築）

## 追加

- `infra-event.yaml`（全フィールドの完全版）
  - translation サマリ（workload_type: web_app, availability_tier: 99%, latency_target_p99: 500ms,
    data_classification: restricted, traffic_pattern_type: scheduled, consistency_model: strong,
    cost_posture: balanced, target_clouds: [aws]）
  - mcl_execution.outputs 14 件（workload-model / mapping-aws / impl-aws / observability / cost-hints /
    decision-record ×6 / conformance / generated-md / IaC スケルトン一式）
  - arch_feedback.feedback_items 9 件（下記「Arch フィードバック」参照）
- MCL product-design 実行成果一式（`docs/mcl/product/output/`, `docs/cloud-context/`, `infra/product/aws/`）
- `docs/infra/latest/`（events/{event_id}/ の全量スナップショット）

## Arch フィードバック（`docs/arch/events/20260903_041150_arch_infra_feedback_20260903_040307_infra_product_design/`）

| # | target | action | id | 概要 | 根拠 |
|---|--------|--------|-----|------|------|
| 1 | cross_tier_policies | add | CTP-016 | IdP 実現手段はマネージド IdP を第一候補とする | product-decision-006 |
| 2 | cross_tier_policies | add | CTP-017 | API エッジは WAF レート制限、トークン検証は Backend 最外周ミドルウェアで行う多層防御方針 | product-decision-002 / product-mapping-aws.yaml（api_edge partial） |
| 3 | cross_tier_policies | add | CTP-018 | SLI/SLO ベースのオブザーバビリティ方針 | product-observability.yaml |
| 4 | tiers[tier-worker].policies | add | SP-030 | 非同期ワーカーはスポット/プリエンプティブル利用を第一候補とする | product-cost-hints.yaml（spot_candidates） |
| 5 | storage_mapping[E-002].confidence | upgrade | - | cache: medium → high | product-mapping-aws.yaml（key_value_cache: exact） |
| 6 | storage_mapping[E-005].confidence | upgrade | - | cache: medium → high | product-mapping-aws.yaml（key_value_cache: exact） |
| 7 | storage_mapping[E-006].confidence | upgrade | - | cache: medium → high | product-mapping-aws.yaml（key_value_cache: exact） |
| 8 | storage_mapping[E-009].confidence | upgrade | - | rdb: medium → high | product-mapping-aws.yaml（relational_datastore: exact） |
| 9 | storage_mapping[E-902].confidence | upgrade | - | rdb: medium → high | product-mapping-aws.yaml（relational_datastore: exact） |

既存の CTP-003（IdP 方式, confidence: medium）・SP 系ポリシーは削除・書き換えせず、
実現手段レベルの補足方針を新規 ID で追加のみ行った（arch-feedback-rules.md の「追加のみ」原則に準拠）。

## 変更なし

- なし（初期構築）
