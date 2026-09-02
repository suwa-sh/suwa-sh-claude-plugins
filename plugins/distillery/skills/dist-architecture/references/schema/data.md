# arch-design.yaml スキーマ — data_architecture

> **読み込みタイミング**: Part 3 推論 subagent と Step3 出力 subagent が読む。共通構造（Policy / Rule、ID 体系、confidence、用語ガイド、決定記録）は `references/schema/common.md`、
> 目次は `references/arch-schema.md`。

## YAML 例

```yaml
data_architecture:
  entities:
    - id: "E-001"
      name: "会議室情報"
      source_info: "情報: 会議室情報"
      model_type: "event_snapshot"
      attributes:
        - name: "room_id"
          type: "string"
          description: "会議室ID"
          nullable: false
          primary_key: true
        - name: "name"
          type: "string"
          description: "会議室名"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-002"
          type: "N:1"
          description: "オーナーが複数の会議室を所有"
  storage_mapping:
    - entity_id: "E-001"
      storage_type: "rdb"
      reason: "トランザクション整合性が必要な予約・決済関連データ"
      confidence: "high"
  diagram_mermaid: |
    erDiagram
      OWNER ||--o{ ROOM : owns
      ROOM ||--o{ RESERVATION : has
      RESERVATION ||--|| PAYMENT : processes
```

## フィールド説明

### data_architecture

データアーキテクチャ。概念モデルとストレージマッピング。

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| entities | Entity[] | Yes | エンティティ定義の配列（1つ以上） |
| storage_mapping | StorageMapping[] | Yes | ストレージ種別マッピング |
| diagram_mermaid | string | Yes | Mermaid erDiagram 形式の概念モデル図 |

### Entity

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | エンティティID（"E-{NNN}" 形式） |
| name | string | Yes | エンティティ名（日本語） |
| source_info | string | Yes | 情報.tsv の参照元（"情報: {名前}" 形式） |
| model_type | string | Yes | データモデル種別: "event_snapshot", "event", "resource_scd2", "resource_mutable" |
| attributes | Attribute[] | Yes | 属性の配列 |
| relationships | Relationship[] | Yes | リレーションの配列（なければ空配列） |

model_type の意味:
- `event_snapshot`: イベント + スナップショット型。attributes はスナップショットの属性を表す
- `event`: 一度きりのイベント型。INSERT のみ、スナップショット不要
- `resource_scd2`: SCD Type 2 型。valid_from / valid_to を持つ世代管理
- `resource_mutable`: 従来型ミュータブル

### Attribute

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| name | string | Yes | 属性名（snake_case） |
| type | string | Yes | 論理型: string, integer, datetime, boolean, decimal, date, text |
| description | string | Yes | 属性の説明 |
| nullable | boolean | Yes | NULL 許容 |
| primary_key | boolean | Yes | 主キー |

### Relationship

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| target_entity | string | Yes | 対象エンティティID（"E-{NNN}" 形式） |
| type | string | Yes | カーディナリティ: "1:1", "1:N", "N:1", "N:M" |
| description | string | Yes | リレーションの説明 |

### StorageMapping

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| entity_id | string | Yes | 対象エンティティID |
| storage_type | string | Yes | ストレージ種別: "rdb", "nosql", "cache", "file", "search" |
| reason | string | Yes | ストレージ選定根拠 |
| confidence | string | Yes | 確信度 |
