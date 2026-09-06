# 変更サマリ

- event_id: 20260902_133544_initial_arch
- trigger_event: rdra:20260902_130741_initial_build, nfr:20260902_132551_initial_nfr
- created_at: 2026-09-02T14:11:27
- mode: initial（初期構築 — 全要素が「追加」）

## 追加

### technology_context

- languages: TypeScript（1 件）
- frameworks: SPA フレームワーク / サーバサイド Web フレームワーク / OpenAPI 準拠 API 定義 / RDB マイグレーションツール（4 件）
- constraints: モノレポ構成 / モジュラモノリス / ベンダーニュートラル / マネージド IdP + RBAC 作り込み / 日本語のみ / 司書機能は館内 NW 限定（6 件）

### domain_architecture

- subdomains（5 件）: SD-001 蔵書貸出・予約(core) / SD-002 蔵書目録(supporting) / SD-003 利用者管理(supporting) / SD-004 通知配信(generic) / SD-005 蔵書分析(supporting)
- bounded_contexts（7 件）: BC-001 蔵書 / BC-002 利用者 / BC-003 貸出 / BC-004 予約 / BC-005 通知 / BC-006 蔵書分析 / BC-007 メール配信
- context_map（11 件）: CM-001〜CM-011（ACL / Customer-Supplier / OHS+Published Language 等）
- aggregate_hypotheses（6 件）: AG-001〜AG-006（すべて confidence: low の仮説）
- diagram_mermaid: BC 関係図 1 件

### system_architecture

- tiers（9 件）: tier-frontend-patron / tier-frontend-staff / tier-api-gateway / tier-idp / tier-backend-api / tier-worker / tier-messaging / tier-datastore / tier-external-gateway
- ティア方針・ルール: SP 30 件 / SR 31 件
- cross_tier_policies（17 件）/ cross_tier_rules（11 件）
- diagram_mermaid: ティア構成図 1 件

### app_architecture

- tier_layers（5 件）: tier-backend-api(5 層) / tier-worker(5 層) / tier-frontend-staff(3 層) / tier-frontend-patron(2 層) / tier-external-gateway(2 層)
- layers 合計 17 件、レイヤー方針・ルール: LP 34 件 / LR 38 件
- cross_layer_policies（17 件）/ cross_layer_rules（10 件）
- diagram_mermaid: レイヤー依存図 5 件

### data_architecture

- entities（9 件）: E-001 書籍 / E-002 利用者 / E-003 利用者アカウント / E-004 貸出 / E-005 予約 / E-006 通知 / E-007 統計レポート / E-901 セッション情報 / E-902 通知送信冪等キー
- storage_mapping（10 件）: RDB 8 件 + Cache(KVS) 2 件（E-001 は RDB + Cache の 2 マッピング）
- diagram_mermaid: 概念モデル図 1 件

### decisions

- arch-decision-001〜010（10 件）

## 変更

- なし（初期構築のため）

## 削除

- なし（初期構築のため）

## Step2 で反映した確定内容（dialogue_policy: auto_adopt）

Step1 の各要約 md の要確認項目 30 件について、すべて ⭐推奨（Option A）を採用した。
セクションドラフト yaml に対する明示的な Edit は以下の 2 点のみ。

| 対象 | 変更内容 | 根拠 |
|------|---------|------|
| domain_architecture / BC-002 利用者コンテキスト | owned_entity_ids に E-901（セッション情報）を追加 | 03-data.md 要確認 6 Option A |
| domain_architecture / BC-005 通知コンテキスト | owned_entity_ids に E-902（通知送信冪等キー）を追加 | 03-data.md 要確認 6 Option A |

加えて、カバレッジ 100% 達成のため以下の source_model を補記した。

| 対象 | 追記した RDRA 要素 |
|------|------------------|
| app_architecture / LP-007 | 条件: 予約可否条件 |
| app_architecture / LR-015 | 条件: 在庫状況集計条件 |
| app_architecture / LR-030 | BUC: 蔵書管理業務 |

## 整合性確認

- 全 entity（E-001〜E-007, E-901, E-902 の 9 件）が いずれかの BC.owned_entity_ids に含まれる（BC への entity 割当率 100%）
- validateArchDesign.js: PASS（mode: initial、WARN なし）
- RDRA モデル網羅率: 40/40 = 100%
- NFR グレード網羅率（重要メトリクス）: 44/44 = 100%
