# インフラフィードバック 推論根拠

## 入力サマリ

| 項目 | 値 |
|------|-----|
| feedback event_id | 20260902_144724_arch_infra_feedback_20260902_142349_infra_product_design |
| infra event_id | 20260902_142349_infra_product_design |
| arch event_id（フィードバック前） | 20260902_133544_initial_arch |

読み方: `docs/arch/latest/arch-design.yaml` の該当セクション（system_architecture.cross_tier_policies /
cross_tier_rules / tiers[tier-worker], data_architecture.storage_mapping）と、MCL 出力
（product-observability.yaml, product-cost-hints.yaml, product-mapping-aws.yaml, product-impl-aws.yaml）
を照合して抽出した。`references/arch-feedback-rules.md` の基本原則（ベンダーニュートラル化・追加のみ・
confidence: "user" 不変・source_model による出自明示・confidence: "medium"）に従った。

## フィードバック項目ごとの根拠

### CTP-018: SLI/SLO ベースのオブザーバビリティ方針（追加）

- 根拠ファイル: `product-observability.yaml` の `slis` / `slos`
- SLI-001〜006（可用性 2 件・レイテンシ 1 件・エラー率 1 件・スループット 2 件）と対応する SLO・エラーバジェットが定義されている
- arch-design.yaml には SLI/SLO という運用フレームワークの記述がなく、CTP-002（エラー通知）や SR-021（劣化兆候ログ）はあるが数値目標に基づく運用判断の方針は未定義だったため、アーキテクチャレベルの方針として追加
- ベンダー固有サービス名（CloudWatch, X-Ray 等）はベンダーニュートラルな記述に変換した

### CTP-019: コスト最適化方針（追加）

- 根拠ファイル: `product-cost-hints.yaml` の `rightsizing` / `non_production` / `commitment_discounts` / `prioritized_actions`
- cost_posture=balanced（可用性・性能の重要メトリクス平均が中位）に基づき、ライトサイジングの継続レビュー・
  非本番環境の縮退・中断許容ワークロードへの割引適用という一貫した方針が MCL 出力から具体化された
- 個別の割引施策名（Savings Plans, Reserved Instance 等）はベンダー固有のためフィードバックせず、方針レベルに抽象化した

### CTR-012: Gateway トークン検証責務の委譲許容（追加）

- 根拠ファイル: `product-mapping-aws.yaml` の `mappings[canonical_element_id=api_edge]`
- fidelity: "partial"。gap_description に「エッジでの JWT 検証を ALB 単体では行えない」「トークン検証をアプリケーション層に配置した」とあり、既存の SP-008「セキュリティオフロード」（Gateway にトークン検証を集約する記述）と実装上のギャップが生じる
- ベンダーニュートラルなルールとして「Gateway 実装がエッジ検証を提供しない場合はアプリケーション層への委譲を許容する」という条件付き許容ルールを追加し、実装選択の幅を明示した
- fidelity → confidence マッピングテーブルでは partial は confidence 昇格対象外だが、本項目は confidence 昇格ではなく新規ルール追加のため対象外ではない

### CTR-013: 館内ネットワーク限定の代替実現方式の許容（追加）

- 根拠ファイル: `product-mapping-aws.yaml` の `mappings[canonical_element_id=internal_web_delivery]`
- fidelity: "partial"。gap_description に「VPN/Direct Connect が未整備の場合、接続元 IP 制限による論理的な制限にとどまる」とある
- 既存の SP-005「館内ネットワーク限定公開」は実現手段を規定していないため、IP 制限による代替を許容する旨を明記するルールを追加した
- なお、この論点はすでに `docs/todo.md` の DIST-026（Phase1/2 で登録済み、confidence: low の仮採用）として要確認登録済みであり、本フィードバックはその仮採用内容をアーキテクチャレベルのルールとして明文化するものである（重複登録はしない）

### SP-032: 中断許容インフラの優先適用（tier-worker へ追加）

- 根拠ファイル: `product-cost-hints.yaml` の `spot_candidates`
- worker_consumer / worker_scheduled が中断許容ワークロードとして特定され、前提条件として「冪等消費（REQ-MQ-001 / SR-018 で担保済み）」「重複実行検知（REQ-WRK-001）」が明記されている
- 既存の SR-018（重複実行・重複消費の検知）と整合する形で、コスト最適化の方針をティア固有ポリシーとして追加した
- 具体的な混在比率（Fargate Spot weight 3 : FARGATE weight 1 等）はベンダー固有の実装詳細のためフィードバックせず、方針レベルに抽象化した

### storage_mapping confidence 昇格（E-001/cache, E-007/rdb, E-902/cache）

- `references/arch-feedback-rules.md` の fidelity → confidence マッピングテーブルに従い、`product-mapping-aws.yaml`
  で fidelity: "exact" と判定された canonical element に対応する storage_mapping の confidence を medium → high に昇格した
  - E-001/cache ← `key_value_cache`（fidelity: exact）
  - E-007/rdb ← `relational_datastore`（fidelity: exact）
  - E-902/cache ← `key_value_cache`（fidelity: exact）
- 対象クラウドは aws のみのため「全対象クラウドで exact」の条件を満たす
- E-001/rdb, E-002〜E-006/rdb, E-901/cache は既に confidence: high のため昇格対象外（変更なし）
- internal_web_delivery / api_edge / outbound_integration_gateway は fidelity: "partial" のため、対応する
  storage_mapping エントリは存在せず（tier マッピングのみ）confidence 昇格の対象外

## フィードバックしなかった項目とその理由

- **ベンダー固有サービス名**: Amazon ECS, RDS for PostgreSQL, ElastiCache for Valkey, SQS, SES 等はいずれも
  arch-design.yaml のティア構成（`technology_candidates`: CaaS(k8s)/FaaS, RDB, KVS, MQ 等）に既にベンダー
  ニュートラルな形で反映済みのため、個別サービス名はフィードバックしない
- **outbound_integration_gateway の fidelity: partial**: gap_description は「外部メール配信事業者が SES 以外の
  場合はアダプタ実装が変わる」という運用上の留意点であり、既存の tier-external-gateway の
  technology_candidates: "ACL アダプタ" が既にこの前提（事業者非依存な抽象化層）を織り込み済みのため、
  重複するフィードバックは追加しない
- **IaC の詳細設定**（CIDR, サブネット構成, タスク定義の vCPU/メモリ値等）: ルール「IaC の詳細設定はフィード
  バックしない」に該当するため対象外
- **割引プランの具体的な施策名**（Savings Plans, Reserved Instance）: ルール「ベンダー固有の料金モデルは
  フィードバックしない」に該当するため、CTP-019 では方針レベルに抽象化した
- **ティア構成の変更・分割提案**: MCL 出力（product-impl-aws.yaml）を確認した結果、単一ティア内に根本的に
  異なる実行モデル（CaaS(k8s) と FaaS の混在等）が判明するケースはなかったため、ティア分割の提案は行わない

## 書き戻し影響判定（Phase5 の根拠）

`references/infra/infra-writeback-check.md` の判定観点に沿って、フィードバック前後の arch-design.yaml を比較した。

| 判定観点 | 該当有無 | 判定根拠 |
|---|---|---|
| ティア構成の追加・削除 | 無 | tiers[] の要素数・id は変更なし（tier-worker に policies を 1 件追加したのみ） |
| 認証/認可方式の変更（data_sensitivity 影響） | 無 | CTR-012 は Gateway 実装の選択肢を明示したのみで、認証方式（IdP/OIDC）自体は変更していない |
| DR 方針の具体化（recovery_target 影響） | 無 | RPO/RTO/backup に関する変更なし |
| 新たな外部連携追加（consistency_needs/compliance 影響） | 無 | 新規の外部システムは追加していない |
| technology_context.constraints の追加で性能に影響 | 無 | technology_context.constraints への追加は行っていない |
| storage_mapping の storage_type 変更（rdb→nosql 等） | 無 | confidence の昇格のみで storage_type 自体（rdb/cache）は変更していない |

いずれの観点にも該当しないため、Step4（書き戻しチェック）の判定は **不要**。`product-input.yaml` の
再生成・Step1〜2 の再実行は行わない。
