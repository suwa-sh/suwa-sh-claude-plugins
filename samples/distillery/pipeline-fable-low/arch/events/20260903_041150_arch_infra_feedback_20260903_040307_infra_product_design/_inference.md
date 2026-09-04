# インフラ設計フィードバック 推論根拠

入力: `docs/infra/events/20260903_040307_infra_product_design/`（MCL product-design 出力）
現在の arch: `docs/arch/latest/arch-design.yaml`（event_id: `20260903_032540_initial_arch`）

## 抽出ルール

`references/arch-feedback-rules.md` の「基本原則」に従い、以下のみを対象とした:

1. ベンダーニュートラル表現に変換して追加（ベンダー固有サービス名を残さない）
2. 既存の policy / rule / エンティティ定義は変更・削除しない（新規追加または confidence 昇格のみ）
3. `confidence: "user"` の項目には触れない（該当なし）
4. `source_model` に `"infra: {詳細}"` を設定し出自を明示、`confidence: "medium"` を付与

## 項目ごとの根拠

| # | 項目 | MCL 入力 | 判断 |
|---|------|---------|------|
| 1 | CTP-016（IdP 実現手段） | `product-decision-006`（マネージド IdP 採用の Decision Record） | arch CTP-003 は「セルフホスト IdP」を前提とするが、confidence: medium で確定値ではない。CTP-003 自体は既存項目のため書き換えず、実現手段レベルの補足方針を新規 CTP として追加した |
| 2 | CTP-017（API エッジ多層防御） | `product-decision-002`、`product-mapping-aws.yaml`（api_edge fidelity: partial） | tier-api-gateway の SP はエッジでのトークン検証を求めるが、常駐コンテナ構成では ALB+WAF がコスト効率上優位。fidelity: partial の実態を明示し、許容パターンとして横断方針を追加 |
| 3 | CTP-018（SLI/SLO 方針） | `product-observability.yaml`（sli_slo[] 6 件、slo[] 6 件） | 既存の CTP-005（構造化ログ）・CTP-006（ヘルスチェック）・CTP-010（運用監視）はいずれも SLI/SLO を明示的な横断方針として扱っていないため新規追加 |
| 4 | SP-030（tier-worker スポット適性） | `product-cost-hints.yaml`（spot_candidates: worker_consumer / worker_scheduled） | 既存 SR-013（重複送信防止）・SR-014（再実行可能性）が冪等性・再実行の前提を満たしていることを確認した上で、コスト最適化方針を tier-worker の policies に追加 |
| 5-9 | storage_mapping confidence 昇格（E-002, E-005, E-006 の cache / E-009, E-902 の rdb） | `product-mapping-aws.yaml`（key_value_cache, relational_datastore とも fidelity: exact、対象クラウドは aws の 1 クラウドのみ） | 昇格ルール「exact fidelity かつ全対象クラウドで exact」に合致。medium → high へ 1 段階昇格。high 済みの項目（E-001, E-003, E-004, E-005/E-006 の rdb 側, E-007, E-008, E-901, E-903）は対象外 |

## フィードバックしなかった項目

- `internal_web_delivery`（fidelity: partial, VPN/Direct Connect 未整備）: 既存 SP（司書向け館内経路の接続元制限）の実現手段の代替案であり、CTP-017 と同様の「許容パターン追加」の余地はあるが、今回のスコープ（product-decision-002 / 006 を優先候補として明示された範囲）では見送り、次回の Infra パイプライン実行時の検討候補として保留（todo.md へは RDRA 逸脱ではないため未登録）
- `outbound_integration_gateway`（fidelity: partial, メール配信事業者非依存アダプタ）: 既存の ACL/外部システム抽象化方針に既に整合しており追加のフィードバック価値が低いため見送り
