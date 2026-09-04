# 変更サマリ

- trigger_event: `infra:20260903_040307_infra_product_design`
- event_id: `20260903_041150_arch_infra_feedback_20260903_040307_infra_product_design`

## 追加

### cross_tier_policies（system_architecture）

| ID | 名前 | 概要 |
|----|------|------|
| CTP-016 | IdP 実現手段の方針 | マネージド IdP を第一候補、セルフホストを代替候補とする |
| CTP-017 | API エッジの多層防御方針 | WAF レート制限 + Backend 最外周ミドルウェアでのトークン検証を許容パターン化 |
| CTP-018 | SLI/SLO ベースのオブザーバビリティ方針 | 可用性/性能/信頼性の SLI とアラートしきい値の導出方針 |

### tiers[tier-worker].policies

| ID | 名前 | 概要 |
|----|------|------|
| SP-030 | 中断許容ワークロードとしてのコスト最適化 | ワーカーのスポット/プリエンプティブル利用を第一候補化 |

## 変更（confidence 昇格。storage_mapping）

| エンティティ | storage_type | 変更前 | 変更後 |
|------------|--------------|--------|--------|
| E-002 | cache | medium | high |
| E-005 | cache | medium | high |
| E-006 | cache | medium | high |
| E-009 | rdb | medium | high |
| E-902 | rdb | medium | high |

## 削除

- なし（既存の policy / rule / エンティティ定義は一切変更していない）

## 反映方法

- `docs/arch/latest/arch-design.yaml` に本差分を全量マージ済み（`event_id` / `created_at` / `source` も本イベントに更新）
- バリデーション: `validateArchDesign.js` PASS（Tiers: 8, Policies+Rules: 173, Entities: 12）
- Markdown・カバレッジレポートを再生成済み
