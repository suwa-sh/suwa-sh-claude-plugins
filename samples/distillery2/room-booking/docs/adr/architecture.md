---
basis: requirements@64517f420b568ea1a4536b71b9dbbb357bd66460 contracts@0ff5299f454e51558068882d06530ff940c50f62
---

# アーキテクチャ (決めたもの)

accepted な ADR とティア構成・契約・RDRA から決定論的に描いた構成図 (C4 モデルのレベル 1 / 2)。実装の実態は `docs/as-built/_system/dependency-graph.md` を見る。

## システムコンテキスト図

```mermaid
graph LR
  actor_1(["社員"]):::actor
  sys["会議室予約システム"]:::system
  ext_1["社内の認証基盤"]:::external
  actor_1 -->|利用する| sys
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
  subgraph sys["会議室予約システム"]
    backend_api["backend-api<br/>backend / typescript<br/>データストア所有 (migration)"]:::tier
    frontend["frontend<br/>frontend / typescript"]:::tier
    datastore[("データストア<br/>RDB 等")]:::store
  end
  ext_1["社内の認証基盤"]:::external
  frontend -->|"api (openapi)"| backend_api
  backend_api -->|所有・migration| datastore
  classDef actor fill:#2563EB,color:#fff,stroke:none
  classDef system fill:#1E3A8A,color:#fff,stroke:none
  classDef tier fill:#3B82F6,color:#fff,stroke:none
  classDef store fill:#0EA5E9,color:#fff,stroke:none
  classDef external fill:#6B7280,color:#fff,stroke:none
```
