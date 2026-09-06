# インフラ設計イベント

| 項目 | 値 |
|------|-----|
| イベント ID | 20260903_040307_infra_product_design |
| 作成日時 | 2026-09-03T04:03:07 |
| ソース | arch-design.yaml からのインフラ設計変換 |
| Arch 参照 | 20260903_032540_initial_arch |
| NFR 参照 | 20260903_031858_initial_nfr |

## 変換サマリ

| 特性 | 値 |
|------|-----|
| ワークロードタイプ | web_app |
| 可用性 | 99% |
| レイテンシ p99 | 500ms |
| データ分類 | restricted |
| トラフィック | scheduled |
| 整合性 | strong |
| コスト方針 | balanced |
| 対象クラウド | aws |

## MCL 実行結果

| ステータス | completed |

### 出力ファイル

| パス | ステータス |
|------|-----------|
| docs/mcl/product/output/product-workload-model.yaml | generated |
| docs/mcl/product/output/product-mapping-aws.yaml | generated |
| docs/mcl/product/output/product-impl-aws.yaml | generated |
| docs/mcl/product/output/product-observability.yaml | generated |
| docs/mcl/product/output/product-cost-hints.yaml | generated |
| docs/cloud-context/decisions/product/product-decision-001.yaml | generated |
| docs/cloud-context/decisions/product/product-decision-002.yaml | generated |
| docs/cloud-context/decisions/product/product-decision-003.yaml | generated |
| docs/cloud-context/decisions/product/product-decision-004.yaml | generated |
| docs/cloud-context/decisions/product/product-decision-005.yaml | generated |
| docs/cloud-context/decisions/product/product-decision-006.yaml | generated |
| docs/cloud-context/conformance/product/product-conformance-aws.yaml | generated |
| docs/cloud-context/generated-md/product/product-architecture.md | generated |
| infra/product/aws/ | generated |

## Arch フィードバック

### フィードバック項目

| ターゲット | アクション | 説明 |
|-----------|-----------|------|
| system_architecture.cross_tier_policies | add | IdP の実現手段はマネージド IdP を第一候補、セルフホストを代替候補とする（IdP ティアの責務・OAuth2/OIDC 境界は CTP-003 を維持したまま、実現手段のみの方針を補足） |
| system_architecture.cross_tier_policies | add | API エッジでの認証は WAF によるレート制限・マネージドルールでの防御を基本とし、トークン検証は Backend 最外周ミドルウェアで行う多層防御方針とする（エッジでの JWT 検証が困難な構成を採る場合の代替パターン） |
| system_architecture.cross_tier_policies | add | SLI/SLO ベースのオブザーバビリティ方針（可用性・応答時間・エラー率・送信成功率・バッチ完遂率の SLI を定義し、アラートしきい値を SLO から導出する）を採用する |
| system_architecture.tiers[tier-worker].policies | add | 非同期ワーカー（キュー消費・スケジュール実行）は中断許容ワークロードとしてスポット/プリエンプティブルインスタンスの利用を第一候補とし、冪等消費と再実行可能性（SR-013/SR-014）を前提にコストを最適化する |
| data_architecture.storage_mapping[E-002].confidence | upgrade | cache: medium → high（MCL mapping で key_value_cache が exact fidelity 確認済み） |
| data_architecture.storage_mapping[E-005].confidence | upgrade | cache: medium → high（MCL mapping で key_value_cache が exact fidelity 確認済み） |
| data_architecture.storage_mapping[E-006].confidence | upgrade | cache: medium → high（MCL mapping で key_value_cache が exact fidelity 確認済み） |
| data_architecture.storage_mapping[E-009].confidence | upgrade | rdb: medium → high（MCL mapping で relational_datastore が exact fidelity 確認済み） |
| data_architecture.storage_mapping[E-902].confidence | upgrade | rdb: medium → high（MCL mapping で relational_datastore が exact fidelity 確認済み） |
