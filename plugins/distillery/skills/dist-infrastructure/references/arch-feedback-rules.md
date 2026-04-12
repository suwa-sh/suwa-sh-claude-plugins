# Arch フィードバックルール

MCL product-design の出力からアーキテクチャ設計にフィードバックする際のルール。
何をフィードバックするか、何をフィードバックしないか、どのように表現するかを規定する。

## 基本原則

1. **ベンダーニュートラル**: arch-design.yaml にベンダー固有サービス名を入れない
2. **追加のみ**: 既存の policy/rule/constraint を削除・変更しない
3. **confidence: "user" は不変**: ユーザー確定値は一切変更しない
4. **出自の明示**: フィードバック項目は `source_model: "infra: {詳細}"` で出自を明示する
5. **confidence は "medium"**: フィードバック項目の confidence は `"medium"` とする（ユーザー確認推奨の位置づけ）

## フィードバック対象（何を戻すか）

### 1. 技術制約の追加 → `technology_context.constraints[]`

MCL impl spec で判明したベンダー共通の技術制約を追加する。

**対象となるパターン**:
- DB 接続プール上限（マネージド RDB 共通の制約）
- MQ メッセージサイズ上限（MQ サービス共通の制約）
- FaaS 実行時間上限（サーバーレス共通の制約）
- Object Storage オブジェクトサイズ上限
- API Gateway リクエストサイズ上限

**ベンダーニュートラル化の例**:
- NG: "RDS pg.r6g.xlarge max connections = 200"
- OK: "RDB 接続プール上限 200（マネージド RDB 共通制約）"

### 2. クロスティアポリシーの追加 → `system_architecture.cross_tier_policies[]`

MCL observability spec や cost hints から導出されるアーキテクチャレベルの方針を追加する。

**対象となるパターン**:
- SLI/SLO ベースのオブザーバビリティ方針（MCL observability → arch CTP）
- コスト最適化方針（MCL cost-hints → arch CTP）
- DR 方針の具体化（MCL impl の冗長構成 → arch CTP）

### 3. クロスティアルールの追加 → `system_architecture.cross_tier_rules[]`

MCL mapping の fidelity gap から導出されるアーキテクチャレベルのルールを追加する。

**対象となるパターン**:
- fidelity = "partial" のサービスに関する制約ルール
- fidelity = "gap" のサービスに対する代替手段のルール
- fidelity = "workaround" のサービスに対する追加考慮事項

### 4. ティア固有ポリシーの追加 → `system_architecture.tiers[].policies[]`

MCL impl spec や cost hints からティア固有の方針を追加する。

**対象となるパターン**:
- Worker ティアのスポット/プリエンプティブル利用方針
- Frontend ティアの CDN キャッシュ方針
- Backend API ティアのオートスケーリング方針

### 5. ストレージマッピング confidence の昇格 → `data_architecture.storage_mapping[].confidence`

MCL mapping で storage_type が exact fidelity で適合確認された場合、confidence を昇格する。

**昇格ルール**:
- `"low"` → `"medium"`（MCL で適合確認）
- `"medium"` → `"high"`（MCL で exact fidelity 確認）
- `"default"` → `"medium"`（MCL で適合確認）
- `"high"` → 変更なし（既に最高）
- `"user"` → 変更なし（ユーザー確定値）

### fidelity → confidence マッピングテーブル

MCL mapping の fidelity 値に基づき、arch-design.yaml の storage_mapping の confidence を昇格する。

| MCL fidelity | arch confidence 昇格先 | 条件 |
|---|---|---|
| `"exact"` | 現在値から 1 段階昇格 | 全対象クラウドで exact |
| `"partial"` | 昇格なし | 部分適合のため現状維持 |
| `"workaround"` | 昇格なし | 回避策のため現状維持 |
| `"gap"` | 昇格なし | 適合不可のため現状維持 |

複数クラウド対象時: 全クラウドで `"exact"` の場合のみ昇格。1 つでも `"partial"` 以下があれば昇格しない。

## フィードバック対象外（何を戻さないか）

### 絶対にフィードバックしないもの

1. **ベンダー固有サービス名**: AWS/Azure/GCP の具体的なサービス名（RDS, Cloud SQL, etc.）
2. **confidence: "user" の項目**: ユーザーが対話で確定した項目
3. **ティア構成の変更（原則）**: ティアの追加・削除・名前変更。ただし下記「ティア分割の提案」を例外とする
4. **レイヤー構成の変更**: レイヤーの追加・削除・依存関係変更
5. **エンティティ定義の変更**: エンティティの追加・削除・属性変更
6. **既存 policy/rule の削除・内容変更**: 既存項目は不変
7. **IaC の詳細設定**: Terraform モジュール構造、具体的なパラメータ値
8. **ベンダー固有の料金モデル**: リザーブドインスタンス、Savings Plans 等の具体的な料金施策

### ティア分割の提案（例外ルール）

MCL の実装仕様で、単一ティア内に根本的に異なる実行モデルが混在していることが判明した場合、ティア分割をユーザーに提案する。これは「ティア構成の変更は原則フィードバックしない」の例外である。

**分割を提案すべきパターン**:
- 同一ティア内に CaaS(k8s) と FaaS が混在し、制約・スケーリング特性・課金モデルが根本的に異なる場合
- 同一ティア内に同期処理と非同期処理が混在し、可用性・レイテンシ要件が大きく異なる場合
- 同一ティア内に長時間バッチと短時間イベント駆動が混在する場合

**提案時の手順**:
1. 混在している実行モデルとその差異を明示する
2. 分割案（新しいティア名・責務・technology_candidates）を提示する
3. ユーザーに分割の要否を確認する（自動では分割しない）
4. 承認後、分割に伴うレイヤー構成・ポリシー/ルールの振り分けも行う

### 判断が必要なケース

以下のケースはユーザーに確認してからフィードバックする:

1. **新しいクロスティアポリシーが既存のポリシーと重複する可能性がある場合**
   → ユーザーに既存ポリシーとの関係を説明し、追加 or スキップを選択してもらう

2. **storage_mapping の storage_type 自体を変更したい場合**（rdb → nosql 等）
   → これはフィードバックの範囲を超えるため、ユーザーに arch スキルでの再設計を提案する

## policy/rule ID の採番ルール

新規 policy/rule の ID は、既存の最大 ID に +1 して採番する。

例: 既存の cross_tier_policies の最大 ID が `CTP-015` の場合、新規は `CTP-016` から採番。

ID プレフィックス（既存の arch-schema.md に準拠）:
- **SP-{NNN}**: ティア Policy
- **SR-{NNN}**: ティア Rule
- **CTP-{NNN}**: クロスティア Policy
- **CTR-{NNN}**: クロスティア Rule

## フィードバック項目の表現テンプレート

### 技術制約

```yaml
# technology_context.constraints に追加
- "{ベンダーニュートラルな制約記述}（{根拠の要約}）"
```

### Policy

```yaml
- id: "CTP-{NNN}"
  name: "{方針名}"
  description: "{方針の説明}"
  reason: "インフラ設計（MCL product-design）の結果に基づく: {具体的な根拠}"
  source_model: "infra: {MCL 出力ファイル名} → {該当セクション}"
  confidence: "medium"
```

### Rule

```yaml
- id: "CTR-{NNN}"
  name: "{ルール名}"
  description: "{ルールの説明}"
  reason: "インフラ設計（MCL product-design）の結果に基づく: {具体的な根拠}"
  source_model: "infra: {MCL 出力ファイル名} → {該当セクション}"
  confidence: "medium"
```
