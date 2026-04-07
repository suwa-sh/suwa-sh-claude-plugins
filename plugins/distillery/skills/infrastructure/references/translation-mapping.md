# Arch + NFR → MCL Product Input 変換マッピング

arch-design.yaml と nfr-grade.yaml の各フィールドを MCL product-input.yaml のワークロード特性にマッピングするルール一覧。

## 基本情報の変換

| ソース | ターゲット | 変換ルール |
|--------|------------|------------|
| `docs/rdra/latest/システム概要.json` → name | `workload.name` | そのまま使用 |
| `docs/rdra/latest/システム概要.json` → description | `workload.description` | そのまま使用 |
| `specs/foundation/output/foundation-context.yaml` → `organization_structure.target_clouds` | `workload.target_clouds` | scope が `full_stack` のクラウドを抽出。なければ全クラウドを対象 |

## ワークロードタイプの変換

arch-design.yaml の `system_architecture.tiers` からワークロードタイプを推論する。

| ティア構成パターン | workload_type |
|-------------------|---------------|
| frontend + backend-api ティアが存在 | `web_app` |
| backend-api のみ（frontend なし） | `api` |
| worker ティアが主要（backend-api が補助的） | `batch` |
| MQ + worker が中心 | `event_driven` |
| 上記に該当しない場合 | `web_app`（デフォルト） |

### 判定ロジック

1. `tiers[].id` に `tier-frontend` を含むティアがあれば → フロントエンド有
2. `tiers[].id` に `tier-worker` か `tier-batch` を含むティアがあれば → ワーカー有
3. `tiers[].technology_candidates` に `MQ` を含むティアがあれば → メッセージング有
4. フロントエンド有 + バックエンド有 → `web_app`
5. フロントエンド無 + バックエンド有 → `api`
6. ワーカーが主要（BUC の半数以上がバッチ系） → `batch`
7. メッセージング有 + ワーカー有 → `event_driven`

### 境界ケースの処理

| ケース | 判定 | 理由 |
|---|---|---|
| frontend + backend-api + 大規模 worker | `web_app` | フロントエンド有は web_app 優先。worker の存在は MCL のコスト最適化で考慮される |
| frontend + backend-api + MQ 中心 | `web_app` | MQ はバックエンド内部の実装詳細。全体としては web_app |
| API Gateway のみ（frontend なし）+ worker | `api` | フロントエンドがないため API。worker はバッチ処理として MCL に反映 |
| 判定困難な場合 | ユーザーに確認 | ティア構成を提示し、`web_app` / `api` / `batch` / `event_driven` から選択してもらう |

## 可用性の変換

NFR カテゴリ A（可用性）から可用性ターゲットを変換する。

| NFR ソース | ターゲット | 変換ルール |
|-----------|------------|------------|
| `A.1.1.1` 運用時間 grade + `A.2.1.1` 冗長化 grade | `availability_target.sla` | 下表参照 |
| `A.1.2.1` サービス切替時間 grade | `availability_target.failover` | 下表参照 |

### SLA 変換テーブル

| A.1.1.1 grade | A.2.1.1 grade | SLA |
|--------------|--------------|-----|
| 4（24h 運用） | 4（N+1 自動切替） | `"99.9%"` |
| 4（24h 運用） | 5（N+2 以上） | `"99.95%"` |
| 3 以下 | 4 以上 | `"99.9%"` |
| 3 以下 | 3 以下 | `"99%"` |
| 5（無停止） | 5（N+2 以上） | `"99.99%"` |
| **NFR 不在時** | **NFR 不在時** | `"99%"`（デフォルト） |

### フェイルオーバー変換テーブル

| A.1.2.1 grade | failover |
|--------------|----------|
| 4（10 分未満） | `"hot_standby"` |
| 3（60 分未満） | `"warm_standby"` |
| 2（12 時間未満） | `"cold_standby"` |
| 1 以下 | `"manual"` |
| **NFR 不在時** | `"manual"`（デフォルト） |

## レイテンシの変換

| NFR ソース | ターゲット | 変換ルール |
|-----------|------------|------------|
| `B.1.1.1` レスポンスタイム grade | `latency_sensitivity.target_p99` | 下表参照 |
| workload_type | `latency_sensitivity.category` | web_app/api → `"interactive"`, batch → `"batch"`, event_driven → `"real-time"` |

### レスポンスタイム変換テーブル

| B.1.1.1 grade | target_p99 |
|--------------|------------|
| 4 以上（3 秒以内） | `"200ms"` |
| 3（5 秒以内） | `"500ms"` |
| 2（10 秒以内） | `"1s"` |
| 1 以下 | `"none"` |
| **NFR 不在時** | `"1s"`（デフォルト） |

## トラフィックパターンの変換

| NFR ソース | ターゲット | 変換ルール | NFR 不在時デフォルト |
|-----------|------------|------------|-------------------|
| `B.2.1.1` オンライン TPS grade | `traffic_pattern.baseline_rps` | grade 4 → 100+, grade 3 → 50, grade 2 → 10, grade 1 → 1 | `10` |
| `B.2.3.1` ピーク時 TPS 比率 grade | `traffic_pattern.spike_multiplier` | grade 4 → 10, grade 3 → 5, grade 2 → 3, grade 1 → 2 | `2` |
| worker ティアの有無 + バッチ系 BUC の割合 | `traffic_pattern.type` | 下表参照 | `"steady"` |

### トラフィックタイプ判定

| 条件 | type |
|------|------|
| worker ティアがタイマー系 BUC を持つ | `"scheduled"` |
| MQ ティアが存在 + イベント駆�� | `"event_driven"` |
| NFR B.2.3.1 grade 3 以上（ピーク 5 倍以上） | `"spike"` |
| 上記に該当しない | `"steady"` |

## データ機密性の変換

| ソース | ターゲット | 変換ルール | NFR 不在時デフォルト |
|--------|------------|------------|-------------------|
| NFR `E.5.1.1` 認証 grade | `data_sensitivity.classification` | OIDC + PII 情報エンティティ → `"restricted"`, それ以外 → `"internal"` | `"internal"` |
| `data_architecture.entities[]` に個人情報属性 | `data_sensitivity.pii` | 氏名/メール/電話/住所 属性があれば `true` | `false` |
| NFR `E.6.1.1` データ暗号化 grade | `data_sensitivity.encryption` | grade 2 以上 → `"at_rest_and_in_transit"`, grade 1 → `"in_transit_only"` | `"in_transit_only"` |
| `data_architecture.entities[]` + `system_architecture.cross_tier_policies` | `data_sensitivity.compliance` | 下記「コンプライアンス判定ルール」参照 | `[]` |
| NFR `E.5.1.1` + `E.6` の全体 | `data_sensitivity.data_residency` | 特段の制約がなければ `"none"` | `"none"` |

### PII 属性検出パターン

情報.tsv のエンティティ属性名に以下が含まれる場合に PII と判定:
- `氏名`, `名前`, `メール`, `メールアドレス`, `電話`, `電話番号`, `住所`, `生年月日`, `マイナンバー`

### コンプライアンス判定ルール

決済関連のコンプライアンス（PCI DSS 等）は、自システムがカード情報を保持・処理するかどうかで判定する。外部の決済機関に処理を委託し、カード情報が自システムを通過しない場合は PCI DSS の対象外となる。

| 条件 | compliance | 根拠 |
|------|-----------|------|
| `data_architecture.entities[]` にカード番号・CVV・有効期限の属性がある | `["PCI_DSS"]` を追加 | 自システムでカード情報を保持 |
| 外部システムとして決済機関が定義されているが、エンティティにカード情報属性がない | `[]`（対象外） | 決済処理は外部委託。カード情報は自システムを通過しない |
| 判断が困難な場合 | ユーザーに確認 | 「決済機関との連携でカード情報を自システムで保持しますか？」と確認する |

**カード情報属性の検出パターン**:
- `カード番号`, `クレジットカード`, `card_number`, `cvv`, `有効期限`（決済コンテキストで使用される場合）

## 整合性の変換

| ソース | ターゲット | 変換ルール |
|--------|------------|------------|
| `data_architecture` の model_type 分布 | `consistency_needs.type` | event_snapshot が主要 → `"strong"`, resource_mutable が主要 → `"eventual"` |
| 決済関連エンティティの有無 | 整合性の補強 | 決済エンティティあり → `"strong"` に強制 |

## 復旧目標の変換

### NFR ID 優先順位ルール

NFR グレードでは RPO/RTO が複数箇所に定義される場合がある:
- **カテゴリ A（可用性）**: `A.4.1.1`（RPO）、`A.4.1.2`（RTO）
- **カテゴリ C（運用・保守性）**: `C.3.2.1`（RPO）、`C.3.2.2`（RTO）

両方が存在する場合は **カテゴリ A を優先する**（可用性要件はビジネス要求に直結するため）。カテゴリ A のみ存在する場合はそれを使用し、カテゴリ C のみ存在する場合はそれを使用する。

| NFR ソース（優先順） | ターゲット | 変換ルール | NFR 不在時デフォルト |
|-----------|------------|------------|-------------------|
| `A.4.1.1` > `C.3.2.1` RPO grade | `recovery_target.rpo` | grade 4 → `"0h"`, grade 3 → `"1h"`, grade 2 → `"24h"`, grade 1 → `"72h"` | `"24h"` |
| `A.4.1.2` > `C.3.2.2` RTO grade | `recovery_target.rto` | grade 4 → `"1h"`, grade 3 → `"4h"`, grade 2 → `"24h"`, grade 1 → `"72h"` | `"24h"` |
| `C.1.2.1` バックアップ方式 grade | `recovery_target.backup` | grade 4 → `"realtime"`, grade 3 → `"daily"`, grade 2 → `"weekly"`, grade 1 → `"manual"` | `"weekly"` |

## オブザーバビリティの変換

| ソース | ターゲット | 変換ルール |
|--------|------------|------------|
| NFR `C.1` 運用監視系全体 | `observability_needs.metrics` | grade 3 以上 → `["cpu", "memory", "disk", "network", "latency", "error_rate", "throughput"]` |
| NFR `C.6` ログ管理 | `observability_needs.logs` | grade 3 以上 → `["access", "audit", "diagnostic", "dependency"]`（arch のログ方針に準拠） |
| `system_architecture.cross_tier_policies` にアラート関連 | `observability_needs.alerting` | ヘルスチェック方針があれば `["health_check", "error_rate", "latency_p99"]` |
| NFR `C.1.3` 監視範囲 | `observability_needs.sli` | grade 3 以上 → `["availability", "latency", "error_rate", "throughput"]` |

## コストポスチャの変換

| ソース | ターゲット | 変換ルール |
|--------|------------|------------|
| NFR A（可用性）の平均 grade + NFR B（性能）の平均 grade | `cost_posture.strategy` | 下表参照 |

| 可用性平均 | 性能平均 | strategy |
|-----------|---------|----------|
| 4 以上 | 4 以上 | `"performance_optimized"` |
| 3 以上 | 3 以上 | `"balanced"` |
| 2 以下 | 2 以下 | `"cost_optimized"` |
| 上記以外 | | `"balanced"`（デフォルト） |

## データベース/キャッシュ要素の変換

arch-design.yaml の `data_architecture.storage_mapping` から MCL の elements を生成する。

| storage_type | MCL element category | 補足 |
|-------------|---------------------|------|
| `rdb` | `database` | PostgreSQL を推奨（technology_context.constraints で指定がない限り） |
| `cache` / `nosql`（KVS 用途） | `cache` | Redis を推奨 |
| `nosql`（ドキュメントストア用途） | `database` (NoSQL) | DynamoDB/CosmosDB/Firestore |
| `file` | `storage` | Object Storage |
| `search` | `search` | Elasticsearch/OpenSearch |

## 出力フォーマット

生成する `product-input.yaml` は以下の構造に従う:

```yaml
schema_version: "1.0"
artifact_type: "product_input"
skill_type: "product"
artifact_id: "product-{system-name}-input"
title: "{システム名} ワークロード入力"
status: "draft"
generated_at: "{ISO8601}"
source_refs:
  - "arch-design:{arch_event_id}"
  - "nfr-grade:{nfr_event_id}"
decision_refs: []
inputs_ref:
  - "foundation-context"
  - "shared-platform-context"  # 存在する場合のみ

workload:
  name: "{システム名}"
  description: "{システム概要}"
  target_clouds:
    - "{cloud1}"

workload_type: "{推論結果}"
availability_target:
  sla: "{推論結果}"
  failover: "{推論結果}"
latency_sensitivity:
  category: "{推論結果}"
  target_p99: "{推論結果}"
data_sensitivity:
  classification: "{推論結果}"
  pii: {true/false}
  encryption: "{推論結果}"
  compliance: ["{推論結果}"]
  data_residency: "{推論結果}"
traffic_pattern:
  type: "{推論結果}"
  baseline_rps: {数値}
  spike_multiplier: {数値}
consistency_needs:
  type: "{推論結果}"
recovery_target:
  rpo: "{推論結果}"
  rto: "{推論結果}"
  backup: "{推論結果}"
observability_needs:
  metrics: ["{推論結果}"]
  logs: ["{推論結果}"]
  sli: ["{推論結果}"]
  alerting: ["{推論結果}"]
cost_posture:
  strategy: "{推論結果}"
```
