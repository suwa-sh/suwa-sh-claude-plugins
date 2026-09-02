# arch-design.yaml スキーマ — system_architecture

> **読み込みタイミング**: Part 1 推論 subagent と Step3 出力 subagent が読む。共通構造（Policy / Rule、ID 体系、confidence、用語ガイド、決定記録）は `references/schema/common.md`、
> 目次は `references/arch-schema.md`。

## YAML 例

```yaml
system_architecture:
  tiers:
    - id: "tier-frontend"
      name: "フロントエンド"
      description: "利用者・オーナー向け Web UI"
      technology_candidates:
        - "SPA"
        - "SSR"
      policies:
        - id: "SP-001"
          name: "レスポンシブデザイン"
          description: "モバイル・デスクトップ両対応のレスポンシブ UI を提供する"
          reason: "利用者がモバイルからも予約操作を行うため"
          source_model: "BUC: 会議室利用業務"
          confidence: "medium"
      rules:
        - id: "SR-001"
          name: "API 経由のデータアクセス"
          description: "フロントエンドからデータストアへの直接アクセスを禁止し、必ず Backend API を経由する"
          reason: "セキュリティとデータ整合性の確保"
          source_model: "なし"
          confidence: "default"
  cross_tier_policies:
    - id: "CTP-001"
      name: "認証方式"
      description: "OAuth2/OIDC ベースの認証を全ティア共通で採用する"
      reason: "外部アクターが利用するため、標準的な認証プロトコルが必要"
      source_model: "アクター: 利用者, 会議室オーナー"
      confidence: "high"
  cross_tier_rules:
    - id: "CTR-001"
      name: "構造化ログ"
      description: "全ティアで JSON 形式の構造化ログを出力する"
      reason: "分散システムの横断的なトレーサビリティ確保"
      source_model: "なし"
      confidence: "default"
  diagram_mermaid: |
    graph TD
      FE[Frontend] -->|REST/GraphQL| API[Backend API]
      API --> DS[(Datastore)]
      API -->|非同期| WK[Worker]
      WK --> DS
      API -->|連携| EXT[External System]
```

## フィールド説明

### system_architecture

システムアーキテクチャ。ティア構成とティア間の方針・ルール。

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| tiers | Tier[] | Yes | ティア定義の配列（1つ以上） |
| cross_tier_policies | Policy[] | Yes | ティア共通の方針 |
| cross_tier_rules | Rule[] | Yes | ティア共通のルール |
| diagram_mermaid | string | Yes | Mermaid graph TD 形式のティア構成図 |

### Tier

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | ティアID（"tier-{name}" 形式） |
| name | string | Yes | ティア名（日本語） |
| description | string | Yes | ティアの説明 |
| technology_candidates | string[] | Yes | テクノロジー候補（ベンダーニュートラル: SPA, SSR, CaaS(k8s), FaaS, RDB, KVS 等） |
| policies | Policy[] | Yes | ティアごとの方針 |
| rules | Rule[] | Yes | ティアごとのルール |
