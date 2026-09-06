# インフラ設計イベント

| 項目 | 値 |
|------|-----|
| イベント ID | 20260902_142349_infra_product_design |
| 作成日時 | 2026-09-02T14:23:49 |
| ソース | arch-design.yaml からのインフラ設計変換 |
| Arch 参照 | 20260902_133544_initial_arch |
| NFR 参照 | 20260902_132551_initial_nfr |

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
| docs/mcl/product/input/product-input.yaml | generated |
| docs/mcl/product/output/product-workload-model.yaml | generated |
| docs/mcl/product/output/product-mapping-aws.yaml | generated |
| docs/mcl/product/output/product-impl-aws.yaml | generated |
| docs/mcl/product/output/product-observability.yaml | generated |
| docs/mcl/product/output/product-cost-hints.yaml | generated |
| docs/cloud-context/decisions/product/ | generated |
| docs/cloud-context/conformance/product/ | generated |
| docs/cloud-context/generated-md/product/ | generated |
| infra/product/aws/ | generated |

## Arch フィードバック

### フィードバック項目

| ターゲット | アクション | 説明 |
|-----------|-----------|------|
| system_architecture.cross_tier_policies | add | SLI/SLO ベースのオブザーバビリティ方針（可用性・レイテンシ・エラー率・スループットの SLI を定義し、エラーバジェットで運用判断する）を追加 |
| system_architecture.cross_tier_policies | add | コスト最適化方針（ライトサイジングの継続レビュー、非本番環境の縮退、中断許容ワークロードへの割引適用）を追加 |
| system_architecture.cross_tier_rules | add | Gateway 実装がリバースプロキシ/WAF 型でエッジトークン検証を提供しない場合、トークン検証責務を Backend API 層へ委譲することを許容するルールを追加（Gateway 実装選択によるフィデリティギャップの明記） |
| system_architecture.cross_tier_rules | add | 館内ネットワーク限定公開は、VPN/専用線が未整備の段階では接続元 IP アドレス許可リストによる論理的な制限で代替できることを明記するルールを追加 |
| system_architecture.tiers[tier-worker].policies | add | 冪等消費が保証された非同期処理（通知送信・日次バッチ）に対し、中断許容インフラ（プリエンプティブル/スポット相当）を優先的に適用するコスト方針を追加 |
| data_architecture.storage_mapping[E-001].confidence（storage_type: cache） | upgrade | medium → high（key_value_cache が全対象クラウドで fidelity: exact） |
| data_architecture.storage_mapping[E-007].confidence（storage_type: rdb） | upgrade | medium → high（relational_datastore が全対象クラウドで fidelity: exact） |
| data_architecture.storage_mapping[E-902].confidence（storage_type: cache） | upgrade | medium → high（key_value_cache が全対象クラウドで fidelity: exact） |
