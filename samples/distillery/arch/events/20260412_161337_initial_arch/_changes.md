# 変更サマリ

- event_id: 20260412_161337_initial_arch
- trigger_event: rdra:20260412_140535_initial_build, nfr:20260412_154304_initial_nfr

## 追加

- technology_context: TypeScript + Next.js
- system_architecture/tiers: tier-frontend（フロントエンド SSR）
- system_architecture/tiers: tier-backend-api（バックエンド API FaaS）
- system_architecture/tiers: tier-worker（バックエンドワーカー CronJob + MQ）
- system_architecture/tiers: tier-datastore（データストア RDB + KVS）
- system_architecture/tiers: tier-external（外部連携 アダプタパターン）
- system_architecture/cross_tier_policies: CTP-001〜CTP-008（認証・認可・ログ・トレーサビリティ・冪等性・ヘルスチェック・i18n・監査ログ）
- system_architecture/cross_tier_rules: CTR-001〜CTR-005（TLS・API バージョニング・エラー通知・トークン管理・OWASP）
- app_architecture/tier_layers: tier-frontend（2層: view + api-client）
- app_architecture/tier_layers: tier-backend-api（5層: presentation + usecase + domain + repository + gateway）
- app_architecture/tier_layers: tier-worker（5層: presentation + usecase + domain + repository + gateway）
- data_architecture/entities: E-001 書籍（event_snapshot / RDB）
- data_architecture/entities: E-002 利用者（event_snapshot / RDB）
- data_architecture/entities: E-003 貸出（event_snapshot / RDB）
- data_architecture/entities: E-004 予約（event_snapshot / RDB）
- data_architecture/entities: E-005 統計情報（resource_mutable / RDB）
- data_architecture/entities: E-006 セッション情報（resource_mutable / cache）
- decisions: arch-decision-001〜005

## 変更

- なし（初期構築）

## 削除

- なし（初期構築）
