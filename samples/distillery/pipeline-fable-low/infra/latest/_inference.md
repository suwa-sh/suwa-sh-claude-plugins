# インフラ設計変換 推論根拠

## 入力サマリ

| 項目 | 値 |
|------|-----|
| arch event_id | 20260903_032540_initial_arch |
| NFR event_id | 20260903_031858_initial_nfr |
| システム名 | 図書館蔵書管理システム |
| 対象クラウド | aws（foundation-context 未整備のため最小構成を自動生成。confidence: low） |
| foundation-context | dist-infrastructure が最小構成で自動生成（`docs/mcl/foundation/output/foundation-context.yaml`） |
| shared-platform-context | 最小構成を仮採用（dialogue_policy: auto_adopt） |

## 変換結果

| ワークロード特性 | 推論値 | 根拠 |
|-----------------|--------|------|
| workload_type | web_app | tier-frontend-user / tier-frontend-staff（SPA）+ tier-backend-api が存在。worker + MQ はバックエンド内部の実装詳細（境界ケース「frontend + backend-api + MQ 中心」→ web_app） |
| availability_target.sla | 99% | NFR A.1.1.1（運用時間）grade 3 + A.2.1.1（サーバ内冗長化）grade 3 → SLA 変換表「3 以下 / 3 以下」 |
| availability_target.failover | warm_standby | NFR A.1.2.1（サービス切替時間）grade 3「60 分未満」 |
| latency_sensitivity.category | interactive | workload_type = web_app |
| latency_sensitivity.target_p99 | 500ms | NFR B.2.1.1（レスポンスタイム）grade 3「5 秒以内」→ 変換表 grade 3 |
| traffic_pattern.type | scheduled | tier-worker がアクター「タイマー」の日次バッチ（リマインド・延滞判定）を持つ |
| traffic_pattern.baseline_rps | 10 | NFR B.2.1.2（スループット）grade 2「〜50 TPS」→ 変換表 grade 2 = 10。上限 50 TPS は MCL の性能テスト前提（CTP-014）で補う |
| traffic_pattern.spike_multiplier | 2 | NFR B.1.2.1（ピーク時同時アクセス数）grade 2「通常の 2 倍」。grade_description の明示値を採用（変換表既定 3 より優先） |
| data_sensitivity.classification | restricted | NFR E.5.1.1 認証 grade 2 + CTP-001 OAuth2/OIDC + 個人情報エンティティ（利用者: 氏名・メール・電話・住所） |
| data_sensitivity.pii | true | data_architecture.entities「利用者」に氏名・メールアドレス・電話番号・住所、「通知」に送信先メールアドレス |
| data_sensitivity.encryption | at_rest_and_in_transit | NFR E.6.1.1 grade 1「機密データのみ暗号化」（保管時暗号化あり）+ E.6.1.2 grade 2「全通信暗号化」 |
| data_sensitivity.compliance | [] | カード情報属性なし・決済機関連携なし。個人情報保護法準拠（CTP-012）は data_residency と暗号化で担保 |
| data_sensitivity.data_residency | japan | 1 館の図書館・個人情報の正本を保持。保守的に国内リージョン限定（confidence: low） |
| consistency_needs.type | strong | entities の model_type は event_snapshot が主要（書籍/利用者/貸出/予約）+ SP「RDB を正本とする強整合」 |
| recovery_target.rpo | 4h | NFR A.4.1.1 grade 2「数時間前まで」（カテゴリ A を優先）。grade_description の「数時間」を 4h と解釈 |
| recovery_target.rto | 2h | NFR A.4.1.2 grade 3「2 時間以内」（カテゴリ A を優先） |
| recovery_target.backup | daily | NFR C.1.2.1 grade 2「フル + 差分バックアップ（日次）」。grade_description の「日次」を採用（変換表既定 weekly より優先） |
| observability_needs.metrics | 7 種 | NFR C.1.1.1 grade 3 / C.1.3.1 grade 3（サーバ + ネットワーク + アプリ監視） |
| observability_needs.logs | access / audit / diagnostic / dependency | NFR C.6.1.1 grade 3（6 ヶ月）+ CTR-006 4 種別のログ + CTP-005 構造化ログ |
| observability_needs.sli | availability / latency / error_rate / throughput | NFR C.1.3.1 grade 3 |
| observability_needs.alerting | health_check / error_rate / latency_p99 | CTP-006 ヘルスチェック + CTR-002 エラー通知 + CTP-010 運用監視とアラート |
| cost_posture.strategy | balanced | NFR A 重要メトリクス平均 grade ≈ 2.3、B 重要メトリクス平均 grade ≈ 2.1 → 変換表「上記以外」= balanced |

## NFR グレードマッピング

| NFR ID | 名称 | grade | 推論先 | 変換値 |
|--------|------|-------|--------|--------|
| A.1.1.1 | 運用時間（通常） | 3 | availability_target.sla | 99% |
| A.2.1.1 | サーバ内の冗長化 | 3 | availability_target.sla | 99% |
| A.1.2.1 | サービス切替時間 | 3 | availability_target.failover | warm_standby |
| A.4.1.1 | RPO | 2 | recovery_target.rpo | 4h |
| A.4.1.2 | RTO | 3 | recovery_target.rto | 2h |
| B.2.1.1 | レスポンスタイム | 3 | latency_sensitivity.target_p99 | 500ms |
| B.2.1.2 | スループット | 2 | traffic_pattern.baseline_rps | 10 |
| B.1.2.1 | ピーク時同時アクセス数 | 2 | traffic_pattern.spike_multiplier | 2 |
| B.2.2.1 | バッチ処理時間 | 2 | tiers[tier-worker].note | 夜間 8 時間枠 |
| C.1.2.1 | バックアップ方式 | 2 | recovery_target.backup | daily |
| C.1.1.1 / C.1.3.1 | 運用監視時間 / 監視範囲 | 3 / 3 | observability_needs.metrics / sli | 全種 |
| C.6.1.1 | ログ保管期間 | 3 | observability_needs.logs | 4 種 |
| E.5.1.1 | 認証方式 | 2 | data_sensitivity.classification | restricted |
| E.6.1.1 | データ暗号化（保管時） | 1 | data_sensitivity.encryption | at_rest_and_in_transit |
| E.6.1.2 | データ暗号化（通信時） | 2 | data_sensitivity.encryption | at_rest_and_in_transit |

## 変換表と NFR ID の対応注記

translation-mapping.md の NFR ID 想定（B.1.1.1 = レスポンスタイム、B.2.1.1 = TPS 等）と本 nfr-grade.yaml の採番
（B.1.1.1 = 同時アクセス数、B.2.1.1 = レスポンスタイム、B.2.1.2 = スループット、B.1.2.1 = ピーク時同時アクセス数）が異なるため、
`_digest/index.md` の名称で対応付けて変換した。

## 確認推奨項目（dialogue_policy: auto_adopt で⭐推奨を採用）

### 1: クラウドベンダー
- **Option A** (⭐推奨): aws — 国内リージョン・マネージド RDB/KVS/MQ が揃い、小規模 Web の実績が最多。ベンダーロックインは CaaS(k8s) 前提で緩和
- **Option B**: gcp — Cloud Run 等でコンテナ運用が簡素。国内リージョンあり。マネージド IdP 選択肢は少ない
- **Option C**: azure — 自治体系での採用実績。Entra ID と統合しやすいが小規模では割高になりやすい

**推奨理由**: low — arch technology_context.constraints「クラウドベンダー未定・ベンダーニュートラル」で RDRA/NFR に指定なし。MCL 実行に 1 ベンダーが必要なため保守的に aws を仮採用（docs/todo.md 登録済み）

### 2: リージョン / マルチリージョン方針
- **Option A** (⭐推奨): ap-northeast-1 単一リージョン + マルチ AZ — 個人情報の国内保持と N+1 冗長（A.2.1.1）を満たしコスト最小
- **Option B**: ap-northeast-1 + ap-northeast-3 のバックアップ複製 — 遠隔地バックアップ（A.3.1.1）を別リージョンで実現。コスト +10%
- **Option C**: 東京 / 大阪のアクティブ-スタンバイ — RTO 短縮。DR grade 1 の要件には過剰でコスト +50%

**推奨理由**: low — foundation-context 未整備。NFR A.3.1.1 / A.3.1.2（災害対策）grade 1 と 1 館運用から単一リージョン + マルチ AZ を仮採用（docs/todo.md 登録済み）

### 3: データレジデンシー
- **Option A** (⭐推奨): japan — 個人情報保護法準拠（CTP-012）と利用者の個人情報保持のため国内限定
- **Option B**: none — 制約なし。海外リージョンのマネージドサービスも利用可能
- **Option C**: japan + バックアップのみ海外可 — 遠隔地保管の柔軟性は増すが越境移転の説明責任が発生

**推奨理由**: low — RDRA/NFR に明示的なレジデンシー要件はなく、個人情報保有からの保守的推論（docs/todo.md 登録済み）

### 4: コスト方針
- **Option A** (⭐推奨): balanced — 可用性 99% / 応答 5 秒を満たしつつマネージドサービスで運用工数を抑える
- **Option B**: cost_optimized — 単一 AZ・小インスタンス。1 館規模には十分だが N+1 冗長（A.2.1.1）を満たしにくい
- **Option C**: performance_optimized — 予約リザーブ・上位インスタンス。50 TPS 規模には過剰

**推奨理由**: medium — NFR A/B の重要メトリクス平均 grade（≈2.3 / ≈2.1）から変換表で balanced

### 5: shared-platform コンテキスト
- **Option A** (⭐推奨): 最小構成（共有サービスなし） — 単独システムとして MCL を実行。後で mcl-shared-platform-design で置換可能
- **Option B**: 共通監視・ログ基盤を mandatory に定義 — 組織共通基盤がある場合に整合。現時点で情報なし
- **Option C**: 共通 IdP を shared service に定義 — CTP-003 はセルフホスト IdP 前提のため不整合

**推奨理由**: medium — shared-platform-context が存在せず、1 館単独運用のため最小構成
