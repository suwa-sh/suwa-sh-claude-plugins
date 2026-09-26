---
basis: requirements@d1987660054f32fca4d1af3a7f36b312eb6e6518
---

# アーキテクチャ (決めたもの)

accepted な ADR とティア構成・契約・RDRA から決定論的に描いた構成図 (C4 モデルのレベル 1 / 2)。実装の実態は `docs/as-built/_system/dependency-graph.md` を見る。

## システムコンテキスト図

```mermaid
graph LR
  actor_1(["利用者<br/>(社外)"]):::actor
  actor_2(["司書"]):::actor
  sys["図書館蔵書管理システム"]:::system
  ext_1["メール配信システム"]:::external
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
  ext_1["メール配信システム"]:::external
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
  analytics["蔵書分析コンテキスト<br/>(backend-api)"]
  catalog["蔵書コンテキスト<br/>(backend-api)"]
  loan["貸出コンテキスト<br/>(backend-api)"]
  notification["通知コンテキスト<br/>(backend-api)"]
  patron["利用者コンテキスト<br/>(backend-api)"]
  reservation["予約コンテキスト<br/>(backend-api)"]
  analytics --> |Conformist| catalog
  analytics --> |Conformist| loan
  loan --> |Customer-Supplier| catalog
  loan --> |Customer-Supplier| patron
  loan --> |Partnership| reservation
  notification --> |Customer-Supplier| loan
  notification --> |Customer-Supplier| patron
  notification --> |Customer-Supplier| reservation
  reservation --> |Customer-Supplier| catalog
  reservation --> |Customer-Supplier| patron
```
