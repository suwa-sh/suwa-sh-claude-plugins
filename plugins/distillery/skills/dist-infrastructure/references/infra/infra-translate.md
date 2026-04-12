# Step1: Arch + NFR → MCL Product Input 変換タスク

arch-design.yaml と nfr-grade.yaml を読み取り、MCL product-design の入力形式（product-input.yaml）に変換する。

## 入力ファイル

1. `docs/arch/latest/arch-design.yaml` — アーキテクチャ設計
2. `docs/nfr/latest/nfr-grade.yaml` — NFR グレード
3. `docs/rdra/latest/システム概要.json` — システム概要（名前・説明用）
4. `specs/foundation/output/foundation-context.yaml` — Foundation コンテキスト（target_clouds 取得用）

## 変換手順

### 1. 基本情報の抽出

1. `システム概要.json` から `name` と `description` を取得
2. `foundation-context.yaml` → `organization_structure.target_clouds` から `scope: "full_stack"` のクラウドを抽出
   - full_stack のクラウドがなければ全 target_clouds を対象とする
3. `arch-design.yaml` → `event_id` を `source_refs` に記録
4. `nfr-grade.yaml` → `event_id` を `source_refs` に記録

### 2. ワークロードタイプの推論

`arch-design.yaml` → `system_architecture.tiers` を分析する:

1. 各ティアの `id` と `technology_candidates` を確認
2. `references/translation-mapping.md` のワークロードタイプ変換テーブルに従い判定
3. 複合的な場合は主要なワークロードタイプを選択（フロントエンド有は web_app 優先）

### 3. 可用性の推論

`nfr-grade.yaml` → カテゴリ A を分析する:

1. `A.1.1.1`（運用時間）の grade を取得
2. `A.2.1.1`（サーバ冗長化）の grade を取得
3. `A.1.2.1`（サービス切替時間）の grade を取得
4. `references/translation-mapping.md` の SLA 変換テーブル/フェイルオーバー変換テーブルに従い変換

### 4. レイテンシの推論

`nfr-grade.yaml` → カテゴリ B を分析する:

1. `B.1.1.1`（レスポンスタイム）の grade を取得
2. workload_type からカテゴリを判定
3. `references/translation-mapping.md` のレスポンスタイム変換テーブルに従い変換

### 5. トラフィックパターンの推論

`nfr-grade.yaml` → カテゴリ B + `arch-design.yaml` のティア構成を分析する:

1. `B.2.1.1`（オンライン TPS）の grade を取得
2. `B.2.3.1`（ピーク時 TPS 比率）の grade を取得（存在する場合）
3. worker ティアの有無、MQ の有無を確認
4. `references/translation-mapping.md` のトラフィックタイプ判定テーブルに従い変換

### 6. データ機密性の推論

`nfr-grade.yaml` → カテゴリ E + `arch-design.yaml` のデータアーキテクチャを分析する:

1. `E.5.1.1`（認証）の grade を取得
2. `E.6.1.1`（データ暗号化）の grade を取得
3. `data_architecture.entities[]` の属性名から PII を検出
4. `cross_tier_policies` に決済関連があるか確認
5. `references/translation-mapping.md` の変換ルールに従い変換

### 7. 整合性の推論

`arch-design.yaml` → `data_architecture` を分析する:

1. `entities[].model_type` の分布を確認
2. event_snapshot が主要か resource_mutable が主要かを判定
3. 決済関連エンティティがあれば strong に強制

### 8. 復旧目標の推論

`nfr-grade.yaml` → カテゴリ C を分析する:

1. `C.3.2.1`（RPO）の grade を取得
2. `C.3.2.2`（RTO）の grade を取得
3. `C.3.1.1`（バックアップ頻度）の grade を取得
4. `references/translation-mapping.md` の変換テーブルに従い変換

### 9. オブザーバビリティの推論

`nfr-grade.yaml` → カテゴリ C + `arch-design.yaml` のクロスティアポリシーを分析する:

1. `C.1`（運用監視）系の grade を確認
2. `C.6`（ログ管理）の grade を確認
3. `cross_tier_policies` のアラート/ヘルスチェック関連を確認
4. `references/translation-mapping.md` の変換ルールに従い変換

### 10. コストポスチャの推論

`nfr-grade.yaml` → カテゴリ A/B の平均 grade を計算する:

1. カテゴリ A の重要メトリクス（important: true）の平均 grade を計算
2. カテゴリ B の重要メトリクスの平均 grade を計算
3. `references/translation-mapping.md` の変換テーブルに従い変換

### 11. データベース/キャッシュ要素の抽出

`arch-design.yaml` → `data_architecture.storage_mapping` を分析する:

1. storage_type ごとにグループ化
2. `references/translation-mapping.md` のデータベース/キャッシュ要素変換テーブルに従い変換
3. technology_context.constraints にデータベース指定があればそれを優先

## 出力

`specs/product/input/product-input.yaml` を `references/translation-mapping.md` の出力フォーマットに従い生成する。

## 推論根拠の記録

変換の各ステップで、どの arch/NFR 項目からどう変換したかを記録し、`_inference.md` として保存する。

### _inference.md の構成

```markdown
# インフラ設計変換 推論根拠

## 入力サマリ

| 項目 | 値 |
|------|-----|
| arch event_id | {arch_event_id} |
| NFR event_id | {nfr_event_id} |
| システム名 | {name} |
| 対象クラウド | {clouds} |

## 変換結果

| ワークロード特性 | 推論値 | 根拠 |
|-----------------|--------|------|
| workload_type | {値} | {ティア構成からの推論根拠} |
| availability_target.sla | {値} | NFR A.1.1.1(grade {N}) + A.2.1.1(grade {N}) |
| ... | ... | ... |

## NFR グレードマッピング

| NFR ID | grade | 推論先 | 変換値 |
|--------|-------|--------|--------|
| A.1.1.1 | {N} | availability_target.sla | {値} |
| ... | ... | ... | ... |
```
