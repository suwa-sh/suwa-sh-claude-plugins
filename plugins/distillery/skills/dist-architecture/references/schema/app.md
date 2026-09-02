# arch-design.yaml スキーマ — app_architecture

> **読み込みタイミング**: Part 2 推論 subagent と Step3 出力 subagent が読む。共通構造（Policy / Rule、ID 体系、confidence、用語ガイド、決定記録）は `references/schema/common.md`、
> 目次は `references/arch-schema.md`。

## YAML 例

```yaml
app_architecture:
  tier_layers:
    - tier_id: "tier-backend-api"
      layers:
        - id: "L-backend-api-presentation"
          name: "プレゼンテーション層"
          responsibility: "HTTP リクエスト/レスポンスの変換、バリデーション"
          allowed_dependencies:
            - "L-backend-api-usecase"
          policies:
            - id: "LP-001"
              name: "入力バリデーション"
              description: "API 境界で全入力をバリデーションする"
              reason: "外部入力の安全性確保"
              source_model: "条件: キャンセルポリシー, 精算ルール"
              confidence: "high"
          rules: []
        - id: "L-backend-api-usecase"
          name: "ユースケース層"
          responsibility: "ビジネスフロー制御、トランザクション境界"
          allowed_dependencies:
            - "L-backend-api-domain"
            - "L-backend-api-repository"
          policies: []
          rules: []
        - id: "L-backend-api-domain"
          name: "ドメイン層"
          responsibility: "ビジネスルール、エンティティ、値オブジェクト"
          allowed_dependencies: []
          policies: []
          rules: []
        - id: "L-backend-api-repository"
          name: "リポジトリ層"
          responsibility: "domain のデータアクセス方法。domain/aggregate root と 1:1 で定義。gateway/adapter を利用してデータを永続化・取得する"
          allowed_dependencies:
            - "L-backend-api-domain"
            - "L-backend-api-gateway"
          policies: []
          rules:
            - id: "LR-001"
              name: "Aggregate Root 対応"
              description: "repository は domain の aggregate root と 1:1 で定義する。複数テーブルにアクセスする場合は複数の gateway/adapter を利用する"
              reason: "DDD の集約パターンに従い、データアクセスの責務を明確化"
              source_model: "なし"
              confidence: "default"
            - id: "LR-002"
              name: "Event/Snapshot 併用パターン"
              description: "event_snapshot 型エンティティの場合、repository.save(domain) は historyAdapter.insert + snapshotAdapter.upsert を実行する"
              reason: "イミュータブルデータモデルの永続化パターンを repository で隠蔽"
              source_model: "なし"
              confidence: "default"
            - id: "LR-003"
              name: "メソッド命名規約"
              description: "method 名は JPA に寄せる: save, findById, findAll, deleteById など"
              reason: "広く知られた命名規約に統一し、学習コストを低減"
              source_model: "なし"
              confidence: "default"
        - id: "L-backend-api-gateway"
          name: "ゲートウェイ層"
          responsibility: "Driven Side の入出力。adapter と client で構成。adapter は datastore model と 1:1 で定義し datastore アクセスを担う。client は datastore SDK のラッパー"
          allowed_dependencies: []
          policies: []
          rules:
            - id: "LR-004"
              name: "Adapter の責務"
              description: "adapter は RDB テーブル等の datastore model と 1:1 で定義する。adapter/client や外部ライブラリの client を利用する。method 名は datastore の操作に寄せる: insert, update, delete など。ORM 利用時は自動生成コードの配置場所となる"
              reason: "datastore モデルとの対応を明確にし、変更影響範囲を限定する"
              source_model: "なし"
              confidence: "default"
            - id: "LR-005"
              name: "Client の責務"
              description: "client は datastore を操作する SDK。外部ライブラリの使い方に共通ルールがある場合や SDK が提供されていない場合に作成する"
              reason: "SDK の利用方法を一箇所に集約し、横断的な設定変更を容易にする"
              source_model: "なし"
              confidence: "default"
      cross_layer_policies:
        - id: "CLP-001"
          name: "IF なし（直接依存）"
          description: "レイヤー間は直接依存とし、開発スピードを優先する。外部サービス API 変更や DB 製品乗り換え時に凹型（IF 導入）で依存を内側に向ける"
          reason: "新規構築のため IF による疎結合化は過剰。前提条件（外部サービスのそうそう乗り換えない等）が崩れた場合に凹型へ移行"
          source_model: "なし"
          confidence: "default"
      cross_layer_rules:
        - id: "CLR-001"
          name: "エラーハンドリング方針"
          description: "domain の例外は usecase でキャッチし、presentation で HTTP ステータスに変換する"
          reason: "レイヤー責務の分離"
          source_model: "なし"
          confidence: "default"
      diagram_mermaid: |
        graph TD
          P[presentation] --> U[usecase]
          U --> D[domain]
          U --> R[repository]
          R --> D
          R --> G[gateway]
```

## フィールド説明

### app_architecture

アプリケーションアーキテクチャ。ティアごとのレイヤリングとレイヤー間の方針・ルール。

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| tier_layers | TierLayer[] | Yes | ティアごとのレイヤー定義 |

### TierLayer

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| tier_id | string | Yes | 対象ティアID（system_architecture.tiers[].id を参照） |
| layers | Layer[] | Yes | レイヤー定義の配列（1つ以上） |
| cross_layer_policies | Policy[] | Yes | レイヤー共通の方針（ティア内） |
| cross_layer_rules | Rule[] | Yes | レイヤー共通のルール（ティア内） |
| diagram_mermaid | string | Yes | Mermaid graph TD 形式のレイヤー依存図 |

### Layer

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | レイヤーID（"L-{tier}-{name}" 形式） |
| name | string | Yes | レイヤー名（日本語） |
| responsibility | string | Yes | レイヤーの責務 |
| allowed_dependencies | string[] | Yes | 依存を許可するレイヤーID（同一ティア内） |
| policies | Policy[] | Yes | レイヤーごとの方針 |
| rules | Rule[] | Yes | レイヤーごとのルール |
