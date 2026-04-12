# 変換推論根拠

## arch-design.yaml → product-input.yaml 変換マッピング

### workload_type: "web_app"

- **根拠**: arch-design.yaml の tier 構成がフロントエンド（SSR）+ バックエンド API + ワーカー + データストア + 外部連携の 5 ティア構成。Web UI を持つアプリケーションであり web_app が適切。
- **参照**: tier-frontend (SSR), tier-backend-api (REST API)

### availability_target: 99.9%, failover: manual

- **根拠**: NFR A.1.1.1 運用時間 Lv2（9時〜21時）、A.2.1.1 サーバ冗長化 Lv4（完全冗長化・自動切替）、ただし災害対策 Lv0。99.9% SLA は CTP-015 の同時アクセス Lv1 規模と整合。手動フェイルオーバーは CTP-010 サービス切替方針（24時間以内復旧）に基づく。
- **参照**: CTP-010, CTP-014, NFR A.1.1.1

### latency_sensitivity: interactive, target_p99: 1s

- **根拠**: CTP-016 レスポンスタイム方針（10秒以内）。SSR による初回表示最適化を考慮し、p99 を 1s に設定。バックエンド API の p99 を 1s に抑えれば、SSR 含めて 10s 以内は十分達成可能。
- **参照**: CTP-016, NFR B.2.1.1

### data_sensitivity: restricted, pii: true

- **根拠**: SP-009 個人情報暗号化（利用者情報: 氏名・連絡先・メールアドレス）。個人情報を扱うため restricted。compliance は RDRA に規制要件の記載がないため空配列。
- **参照**: SP-009, NFR E.6.1.1, NFR E.1.2.1

### traffic_pattern: scheduled, baseline_rps: 1, spike_multiplier: 2

- **根拠**: CTP-015 同時アクセス 100 ユーザー以下、スループット 10 TPS 以下。運用時間 9時〜21時であり scheduled パターン。baseline_rps 1 は NFR B.1.1.3 リクエスト件数 Lv1（~1,000/日）から算出（1000件/12時間/3600秒 ≈ 0.02 RPS、余裕を持って 1 RPS）。spike_multiplier 2 は NFR B.1.2.1 ピーク時 Lv1（1.5倍）に安全マージンを加えて設定。
- **参照**: CTP-015, NFR B.1.1.1, NFR B.1.1.3, NFR B.1.2.1

### consistency_needs: strong

- **根拠**: SP-007 トランザクション整合性（書籍貸出状態 4状態5遷移、予約状態 4状態4遷移）。状態遷移の整合性保証に強整合性が必要。
- **参照**: SP-007, 状態モデル

### recovery_target: rpo: 72h, rto: 72h

- **根拠**: CTP-014 RTO 方針（1営業日以内）を時間換算。NFR A.4.1.1 RPO Lv1（前日の最終バックアップまで）。SR-004 RPO 日次。最大72時間（金曜夜の障害→月曜復旧）を考慮。
- **参照**: CTP-014, SR-004, NFR A.4.1.1, NFR A.4.1.2

### cost_posture: cost_optimized

- **根拠**: 小規模システム（同時100ユーザー、1,000リクエスト/日）であり、コスト最適化が適切。NFR に高性能要件の記載なし。
- **参照**: CTP-015, CTP-016

### elements マッピング

| canonical element | arch 参照元 | 変換根拠 |
|---|---|---|
| database (rdb) | tier-datastore, SP-007, SP-008, SP-009 | PostgreSQL。トランザクション整合性、日次バックアップ、個人情報暗号化 |
| cache (kvs) | tier-datastore, CTP-005 | Redis。セッション管理、冪等キー一時ストア |
| message_queue (mq) | tier-worker, SP-006 | 督促通知・予約通知の非同期処理 |
| cron (scheduled_task) | tier-worker, SP-005 | 延滞検出バッチ（日次） |
| identity (idp) | CTP-001, CTP-002 | マネージド IdP（OAuth2/OIDC）、2ロール RBAC |
| email (external_service) | tier-external, SP-010, SR-005 | メール送信サービス連携（アダプタパターン） |
