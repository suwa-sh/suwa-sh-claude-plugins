# フィードバック推論根拠

## 1. 技術制約の抽出

### RDB 接続プール上限 100

- **MCL 出力**: product-impl-aws.yaml > rds_postgresql > configuration > parameter_group > max_connections: 100
- **ベンダーニュートラル化**: "RDS max_connections 100" → "RDB 接続プール上限 100"
- **理由**: db.t4g.micro（2 vCPU, 1 GB RAM）の実効的な接続数上限。アプリケーション設計でコネクションプーリングを考慮する必要がある。Lambda の reserved_concurrency: 10 との整合性も確認済み（10 同時接続 × 複数コネクション = 100 以内）。
- **1 クラウドのみ（AWS）のため、その値をそのままベンダーニュートラル化して追加**

### FaaS API 連携時実行時間上限 29 秒

- **MCL 出力**: product-impl-aws.yaml > lambda_backend > configuration > timeout: 29
- **ベンダーニュートラル化**: "Lambda timeout 29s (API Gateway integration)" → "FaaS API 連携時実行時間上限 29 秒"
- **理由**: API ゲートウェイの統合タイムアウト（29 秒）が実質的な上限。これは AWS API Gateway 固有の制約だが、他クラウドでも API ゲートウェイには同様のタイムアウト制約がある（Azure APIM: 240s, GCP API Gateway: 15min）。最も厳しい値として 29 秒を採用。
- **注意**: バッチ処理（Lambda worker: 900s）はこの制約の対象外

## 2. SLI/SLO ベースのオブザーバビリティ方針

- **MCL 出力**: product-observability.yaml > sli_definitions (3 SLI), slo_definitions (2 SLO)
- **抽出内容**:
  - 可用性 SLI: API 成功率（5xx 除外）→ SLO 99.9%（30 日ローリング）
  - レイテンシ SLI: p99 < 1s → SLO 99%
  - エラー率 SLI: Lambda エラー率 < 5%
  - Burn rate アラート: fast burn 14.4x/1h, slow burn 3x/6h
- **arch への追加理由**: 既存 CTP にオブザーバビリティの「何を監視するか」（CTP-003 構造化ログ, CTP-004 トレーサビリティ）はあるが、「目標値をどう設定し、違反時にどう対処するか」の方針がない。SLI/SLO + burn rate アラートは全ティア横断の方針として CTP に追加すべき。
- **confidence**: medium（MCL 出力に基づく推論。ユーザー確認推奨）

## 3. ストレージマッピング confidence 昇格

### E-005（統計情報）: default → medium

- **MCL 出力**: product-mapping-aws.yaml > database_primary の fidelity: "exact"
- **昇格ルール**: default → medium（MCL で適合確認）
- **理由**: 統計情報を RDB で管理する設計が MCL の AWS 実装で exact fidelity で適合確認された。PostgreSQL の集計関数で統計クエリに対応可能。

### E-001〜E-004, E-006: 昇格なし

- E-001〜E-004: 既に confidence: "high"（昇格不要）
- E-006: 既に confidence: "high"（昇格不要）

## 4. フィードバック対象外の判断

### スポット/プリエンプティブル適性

- product-cost-hints.yaml > spot_preemptible_candidates: []
- 全コンポーネントが Serverless/マネージドサービスのためスポット対象なし → フィードバック不要

### CDN キャッシュ方針

- product-cost-hints.yaml > data_transfer_optimization に "CloudFront による静的アセットのキャッシュ（将来的な最適化）" とあるが、「将来的」であり現時点では追加不要

### ティア分割の検討

- MCL impl spec を確認した結果、ティア内で根本的に異なる実行モデルの混在は検出されなかった:
  - tier-worker: CronJob（延滞検出バッチ）と MQ（メール送信ワーカー）は両方とも Lambda で実装。スケーリング特性が異なるが、いずれも FaaS ベースで課金モデルは同一。分割不要。
- ティア分割の提案は不要

## 5. 横断的関心事のチェック

### 冪等性

- MCL impl: Lambda backend で X-Idempotency-Key ヘッダ対応、RDS で UNIQUE 制約、SQS FIFO で content_based_deduplication
- arch: CTP-005（冪等性方針）が全ティア横断で定義済み。CLR-001, CLR-003 でフロントエンド・ワーカーの具体策も定義済み
- **結果**: 追加フィードバック不要（既に十分カバー）

### トレーサビリティ

- MCL impl: X-Ray Active tracing、OpenTelemetry Layer
- arch: CTP-004（トレーサビリティ ID 体系）で trace_id + span_id + session_id + user_id を定義済み
- **結果**: 追加フィードバック不要

### エラーハンドリング

- MCL impl: SQS DLQ（max_receive_count: 3）、Lambda reserved_concurrency
- arch: CTR-003（エラー通知）で 5xx メール通知を定義済み
- **結果**: DLQ のリトライ方針は MCL impl の詳細であり arch レベルのフィードバック不要

### 認証/認可の一貫性

- MCL impl: Cognito（OAuth2/OIDC, RBAC, トークン有効期限）
- arch: CTP-001（認証方式）, CTP-002（認可方式）, CTR-004（トークンライフサイクル）で定義済み
- **結果**: 整合性確認済み。追加フィードバック不要
