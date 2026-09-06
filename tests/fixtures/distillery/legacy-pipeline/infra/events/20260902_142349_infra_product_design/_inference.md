# インフラ設計変換 推論根拠

## 入力サマリ

| 項目 | 値 |
|------|-----|
| infra event_id | 20260902_142349_infra_product_design |
| arch event_id | 20260902_133544_initial_arch |
| NFR event_id | 20260902_132551_initial_nfr |
| システム名 | 図書館蔵書管理システム |
| 対象クラウド | aws（foundation-context 最小構成の target_clouds / scope: full_stack） |
| モデルシステム | model2（社外アクター + 個人情報、社会的影響は限定的） |

読み方: 正本（arch-design.yaml / nfr-grade.yaml）は丸読みせず、`docs/arch/latest/_digest/` と
`docs/nfr/latest/_digest/` の必要セクション（technology_context / system_architecture /
data_architecture、category-A/B/C/E/F、model_system）のみを参照した。

## 変換結果

| ワークロード特性 | 推論値 | 根拠 |
|-----------------|--------|------|
| workload_type | `web_app` | `system_architecture.tiers` に tier-frontend-patron / tier-frontend-staff（SPA）と tier-backend-api が存在。フロントエンド有 + バックエンド有 → web_app（tier-worker / tier-messaging があるが、境界ケース表「frontend + backend-api + MQ 中心 → web_app」に従う） |
| availability_target.sla | `99%` | A.1.1.1 運用時間 grade 3 + A.2.1.1 サーバ内の冗長化 grade 3 → SLA 変換テーブル「3 以下 / 3 以下 → 99%」 |
| availability_target.failover | `warm_standby` | A.1.2.1 サービス切替時間 grade 3（60 分未満） → warm_standby |
| latency_sensitivity.category | `interactive` | workload_type = web_app |
| latency_sensitivity.target_p99 | `500ms` | B.2.1.1 レスポンスタイム grade 3（5 秒以内） → 変換テーブル「3 → 500ms」 |
| traffic_pattern.type | `scheduled` | tier-worker の SP-019「日次タイマージョブ」（返却期限接近判定・期限超過判定）がタイマー系。トラフィックタイプ判定テーブル「worker ティアがタイマー系 BUC を持つ → scheduled」 |
| traffic_pattern.baseline_rps | `10` | B.1.1.3 オンラインリクエスト件数 grade 2 → 10 |
| traffic_pattern.spike_multiplier | `3` | B.1.2.1 ピーク時同時アクセス数 grade 2 → 3 |
| data_sensitivity.classification | `restricted` | CTP-001 認証方式「OAuth2/OIDC ベース」+ PII 保持（E-002 利用者の氏名・連絡先） → 「OIDC + PII → restricted」 |
| data_sensitivity.pii | `true` | data_architecture E-002「氏名」「連絡先（メールアドレス）」、E-006「宛先メールアドレス」が PII 検出パターンに一致 |
| data_sensitivity.encryption | `at_rest_and_in_transit` | E.6.1.2 通信時暗号化 grade 2「全通信暗号化（内部通信を含む）」+ E.6.1.1 保管時暗号化 grade 1 の grade_description「機密データのみ暗号化（氏名・連絡先・パスワード・貸出履歴）」。保管時暗号化が明示的に要求されているため、grade 数値ベースの `in_transit_only` ではなく保守的に at_rest_and_in_transit を採用（下記「テーブル逸脱の記録」参照） |
| data_sensitivity.compliance | `[]` | data_architecture のエンティティにカード番号・CVV・有効期限の属性なし。決済機関との連携も存在しない → PCI DSS 対象外 |
| data_sensitivity.data_residency | `japan` | E.1.2.1「個人情報保護法・不正アクセス禁止法に準拠（図書館の貸出履歴は思想信条を推知しうる）」。foundation-context の allowed_regions.aws = ap-northeast-1 と整合 |
| consistency_needs.type | `strong` | data_architecture の model_type 分布: event_snapshot 6 件（E-001/002/004/005/006/007）vs resource_mutable 3 件（E-003/901/902）。event_snapshot が主要 → strong。SP-017「在庫整合のトランザクション境界」とも整合 |
| recovery_target.rpo | `4h` | A.4.1.1 RPO grade 2、grade_description「数時間前まで」 → 数時間 = 4h（テーブルの grade 2 → 24h より保守的。下記「テーブル逸脱の記録」参照） |
| recovery_target.rto | `2h` | A.4.1.2 RTO grade 3、grade_description「2時間以内」（テーブルの grade 3 → 4h より保守的） |
| recovery_target.backup | `daily` | C.1.2.1 バックアップ方式 grade 2、grade_description「フル+差分バックアップ（日次）」（テーブルの grade 2 → weekly より保守的） |
| observability_needs.metrics | 7 種 | C.1.3.1 監視範囲 grade 3「サーバ＋ネットワーク＋アプリケーション監視」 → grade 3 以上のフルセット |
| observability_needs.logs | 4 種 | C.6.1.2 ログ種別 grade 3「アクセスログ＋操作ログ＋エラーログ＋監査ログ」、CTP-004 構造化ログと分散トレーシング、CTR-006 ログ保管とマスキング |
| observability_needs.sli | 4 種 | C.1.3.1 grade 3 → availability / latency / error_rate / throughput |
| observability_needs.alerting | 3 種 | CTP-003 ヘルスチェック（shallow / deep の 2 深度）、CTR-002 エラー通知とエスカレーション、SR-020 DLQ 退避時アラート |
| cost_posture.strategy | `balanced` | important: true メトリクスの平均 grade — カテゴリ A = 2.27、カテゴリ B = 2.12。変換テーブルの「4 以上/4 以上」「3 以上/3 以上」「2 以下/2 以下」のいずれにも該当しないため既定値 balanced |

## NFR グレードマッピング

| NFR ID | 名称 | grade | 推論先 | 変換値 |
|--------|------|-------|--------|--------|
| A.1.1.1 | 運用時間（通常） | 3 | availability_target.sla | 99% |
| A.2.1.1 | サーバ内の冗長化 | 3 | availability_target.sla | 99% |
| A.1.2.1 | サービス切替時間 | 3 | availability_target.failover | warm_standby |
| A.3.1.1 | 災害対策の範囲 | 1 | （リージョン方針） | 単一リージョン + マルチ AZ |
| A.4.1.1 | RPO | 2 | recovery_target.rpo | 4h |
| A.4.1.2 | RTO | 3 | recovery_target.rto | 2h |
| B.1.1.3 | オンラインリクエスト件数 | 2 | traffic_pattern.baseline_rps | 10 |
| B.1.2.1 | ピーク時同時アクセス数 | 2 | traffic_pattern.spike_multiplier | 3 |
| B.2.1.1 | レスポンスタイム | 3 | latency_sensitivity.target_p99 | 500ms |
| C.1.2.1 | バックアップ方式 | 2 | recovery_target.backup | daily |
| C.1.3.1 | 監視範囲 | 3 | observability_needs.metrics / sli | フルセット |
| C.6.1.1 | ログ保管期間 | 3 | （foundation logging retention_days） | 180 日（6ヶ月） |
| C.6.1.2 | ログ種別 | 3 | observability_needs.logs | 4 種 |
| E.1.2.1 | 準拠すべき法規・基準 | 2 | data_sensitivity.data_residency | japan |
| E.5.1.1 | 認証方式 | 2 | data_sensitivity.classification | restricted（CTP-001 OIDC と併せて判定） |
| E.5.3.1 | 利用制限 | 1 | tiers[tier-frontend-staff].exposure | internal_network_only |
| E.6.1.1 | データ暗号化（保管時） | 1 | data_sensitivity.encryption | at_rest（機密データ） |
| E.6.1.2 | データ暗号化（通信時） | 2 | data_sensitivity.encryption | in_transit（全通信） |

## Arch → storage_elements マッピング

| storage_type | 件数 | エンティティ | MCL element category | 推奨エンジン |
|---|---:|---|---|---|
| rdb | 7 | E-001 書籍 / E-002 利用者 / E-003 利用者アカウント / E-004 貸出 / E-005 予約 / E-006 通知 / E-007 統計レポート | database | PostgreSQL |
| cache | 3 | E-001 書籍（Cache-Aside） / E-901 セッション情報 / E-902 通知送信冪等キー | cache | Redis |
| （tier-datastore の technology_candidates） | - | - | storage | Object Storage |

`technology_context.constraints` にデータベース製品の指定はないため、translation-mapping.md の推奨
（rdb → PostgreSQL、cache → Redis）を採用した。

## テーブル逸脱の記録

`references/translation-mapping.md` の grade → 値の変換テーブルより、NFR の `grade_description`
（実際に定義された水準）を優先した箇所を以下に明示する。いずれも**より保守的な（要求の厳しい）方向**への逸脱である。

| 項目 | テーブル値 | 採用値 | 理由 |
|---|---|---|---|
| recovery_target.rpo | 24h（grade 2） | 4h | grade_description「数時間前まで」。reason に「日次バックアップ（Lv1）では不足」と明記 |
| recovery_target.rto | 4h（grade 3） | 2h | grade_description「2時間以内」 |
| recovery_target.backup | weekly（grade 2） | daily | grade_description「フル+差分バックアップ（日次）」 |
| data_sensitivity.encryption | in_transit_only（E.6.1.1 grade 1） | at_rest_and_in_transit | grade_description が機密データの保管時暗号化を明示的に要求 |

## 補足: NFR ID の読み替え

`references/translation-mapping.md` は `B.1.1.1` をレスポンスタイム、`B.2.1.1` をオンライン TPS として
参照しているが、本プロジェクトの nfr-grade.yaml では `B.1.1.1` = 同時アクセス数、`B.2.1.1` = レスポンスタイム
である。ID ではなく**メトリクス名で意味的に対応付け**て変換した。

## 前提条件の補完

`docs/mcl/foundation/output/foundation-context.yaml` が存在しなかったため（mcl-foundation-design 未実行）、
dist-infrastructure が最小構成の foundation-context を自動生成した。
target_clouds / allowed_regions は auto_adopt の⭐推奨採用値（confidence: low、todo.md に登録済み）。
