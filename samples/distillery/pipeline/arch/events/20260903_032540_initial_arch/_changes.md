# 変更サマリ

- event_id: 20260903_032540_initial_arch
- trigger_event: rdra:20260903_030744_initial_build, nfr:20260903_031858_initial_nfr
- created_at: 2026-09-03T03:51:01
- mode: initial（初期構築。全セクションを「追加」として記録）
- dialogue_policy: auto_adopt（全要確認項目で ⭐推奨 Option A を採用。ユーザーによる変更なし）

## 追加

### technology_context
- languages / frameworks: 未定（ユーザー希望なし）
- constraints: クラウドベンダー未定・ベンダーニュートラル、デプロイ先未定、小規模モジュラモノリス、2 系統フロントエンド、API/ワーカーの共有ライブラリ

### domain_architecture
- subdomains: SD-001 貸出・予約・期限管理（core）, SD-002 蔵書管理（supporting）, SD-003 利用者管理（supporting）, SD-004 運営分析（supporting）, SD-005 通知配信（generic）
- bounded_contexts: BC-001 蔵書, BC-002 利用者, BC-003 貸出, BC-004 予約, BC-005 通知, BC-006 運営分析（team_ownership はすべて null）
- context_map: CM-001〜CM-010（customer_supplier 5 / ohs 3 / conformist 2。外部システム「メール配信サービス」への ACL はティア設計側で表現）
- aggregate_hypotheses: AG-001〜AG-007（すべて confidence: low。仮説）
- diagram_mermaid: BC 関係図

### system_architecture
- tiers: tier-frontend-user, tier-frontend-staff, tier-api-gateway, tier-idp, tier-backend-api, tier-worker, tier-datastore, tier-external-integration（8 ティア。SP 29 / SR 19）
- cross_tier_policies: CTP-001〜CTP-015（認証 OAuth2/OIDC、認可パターン A、セルフホスト IdP、冪等性、構造化ログ + OpenTelemetry、ヘルスチェック、i18n 日本語のみ、REST + Cache-Aside、モジュラモノリス、監視・計画停止・セキュリティ管理・基盤前提・性能テスト・サポート体制）
- cross_tier_rules: CTR-001〜CTR-008（全通信 TLS、エラー通知、API バージョニング、トークンライフサイクル、ログ PII 禁止、ログ 6 ヶ月保持、ISBN 準拠、復旧時の状態整合性確認）
- diagram_mermaid: ティア構成図

### app_architecture
- tier_layers/tier-backend-api: presentation → usecase → domain → repository → gateway の 5 層
- tier_layers/tier-worker: 5 層（domain / repository / gateway は Backend API と共有ライブラリで共有）
- tier_layers/tier-frontend-user: view/component → api client の 2 層
- tier_layers/tier-frontend-staff: view/component → api client の 2 層
- tier_layers/tier-external-integration: ACL adapter → SDK client の 2 層
- policies / rules: LP-001〜LP-042, LR-001〜LR-031, CLP-001〜CLP-015, CLR-001〜CLR-010

### data_architecture
- entities: E-001 書籍, E-002 ジャンル, E-003 利用者, E-004 貸出, E-005 貸出期間, E-006 リマインド日数, E-007 予約, E-008 通知, E-009 貸出統計（情報.tsv 由来 9 件）+ E-901 セッション, E-902 監査ログ, E-903 認証情報（NFR 由来の派生 3 件。BC の owned_entity_ids には含めない）
- storage_mapping: rdb 11 件 + cache 4 件（ジャンル・貸出期間・リマインド日数の Cache-Aside、セッションの KVS）
- diagram_mermaid: 概念モデル図（erDiagram）

### decisions
- arch-decision-001〜011（サブドメイン分類 / BC 設計 / コンテキストマップ / 集約境界仮説 / テクノロジースタック / BC:tier 対応形態 / ティアパターン / 認証方式 / 認可モデル / レイヤリング戦略 / データモデル戦略）

## 変更
- なし（初期構築）

## 削除
- なし（初期構築）

## Step3 でドラフトに加えた整合修正
- policy/rule の source_model 内の状態モデル列挙を `A / B / C` から `A, B, C` に統一（coverage レポートの状態モデル照合に合わせる。SP-018 ほか 13 件）
- LP-036（集計画面の段階表示）の source_model に「条件: 人気書籍ランキング判定, 在庫状況判定, 集計期間判定」を追加（RDRA 条件の網羅率 100% 化）
