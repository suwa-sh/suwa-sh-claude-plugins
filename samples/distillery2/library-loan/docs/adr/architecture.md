---
basis: requirements@4422a431dd381e737d643e7055432ad4b2330c9d
---

# アーキテクチャ (決めたもの)

accepted な ADR とティア構成・契約・RDRA から決定論的に描いた構成図 (C4 モデルのレベル 1 / 2)。実装の実態は `docs/as-built/_system/dependency-graph.md` を見る。

## システムコンテキスト図

```mermaid
graph LR
  actor_1(["利用者<br/>(社外)"]):::actor
  actor_2(["司書"]):::actor
  sys["図書館蔵書管理システム"]:::system
  ext_1["メール配信サービス"]:::external
  actor_1 -->|利用する| sys
  actor_2 -->|利用する| sys
  sys -->|連携する| ext_1
  classDef actor fill:#2563EB,color:#fff,stroke:none
  classDef system fill:#1E3A8A,color:#fff,stroke:none
  classDef tier fill:#3B82F6,color:#fff,stroke:none
  classDef store fill:#0EA5E9,color:#fff,stroke:none
  classDef external fill:#6B7280,color:#fff,stroke:none
```

## コンテナ図

```mermaid
graph LR
  subgraph sys["図書館蔵書管理システム"]
    backend_api["backend-api<br/>backend / typescript<br/>データストア所有 (migration)"]:::tier
    frontend["frontend<br/>frontend / typescript"]:::tier
    worker["worker<br/>worker / typescript"]:::tier
    datastore[("データストア<br/>RDB 等")]:::store
  end
  ext_1["メール配信サービス"]:::external
  backend_api -->|所有・migration| datastore
  classDef actor fill:#2563EB,color:#fff,stroke:none
  classDef system fill:#1E3A8A,color:#fff,stroke:none
  classDef tier fill:#3B82F6,color:#fff,stroke:none
  classDef store fill:#0EA5E9,color:#fff,stroke:none
  classDef external fill:#6B7280,color:#fff,stroke:none
```

契約 (contracts.json) が無いため、契約の辺は描いていない (ティアのみ)。

## コンテキストマップ

```mermaid
flowchart LR
  analytics["蔵書分析<br/>(backend-api)"]
  catalog["蔵書<br/>(backend-api)"]
  circulation["貸出予約<br/>(backend-api)"]
  notification["通知<br/>(backend-api)"]
  patron["利用者<br/>(backend-api)"]
  analytics --> |Conformist| catalog
  analytics --> |Conformist| circulation
  circulation --> |OHS| catalog
  circulation --> |OHS| patron
  notification --> |Conformist| circulation
  notification --> |OHS| patron
```
