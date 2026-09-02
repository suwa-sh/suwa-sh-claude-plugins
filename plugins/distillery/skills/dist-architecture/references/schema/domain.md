# arch-design.yaml スキーマ — domain_architecture（optional）

> **読み込みタイミング**: Part 0 推論 subagent と、domain_architecture を出力する Step3 subagent が読む。domain 無しモードでは読まない。共通構造（Policy / Rule、ID 体系、confidence、用語ガイド、決定記録）は `references/schema/common.md`、
> 目次は `references/arch-schema.md`。

## YAML 例

```yaml
# domain_architecture は optional（既存スナップショットでは無くてもよい）
# 新規構築時は最低 1 subdomain + 1 BC を含めることを推奨
domain_architecture:
  subdomains:
    - id: "SD-001"
      name: "会議室予約"
      type: "core"
      investment_policy: "最優先で深いモデリングと継続的リファクタリングに投資"
      related_buc_ids:
        - "BUC-001"
        - "BUC-002"
      reason: "BUC「会議室利用業務」が事業の中核であり競争優位の源泉"
      source_model: "BUC: 会議室利用業務, システム概要: 差別化要因"
      confidence: "medium"
    - id: "SD-002"
      name: "決済処理"
      type: "generic"
      investment_policy: "外部 SaaS 採用、自作回避"
      related_buc_ids:
        - "BUC-003"
      reason: "決済機関連携は汎用機能で差別化要因ではない"
      source_model: "外部システム: 決済機関"
      confidence: "high"
  bounded_contexts:
    - id: "BC-001"
      name: "予約コンテキスト"
      ubiquitous_language:
        - term: "予約"
          definition: "利用者が会議室の使用権を確保した状態。確定/キャンセル/変更のライフサイクルを持つ"
        - term: "会議室"
          definition: "予約対象となる物理的な部屋。請求コンテキストでの「課金対象施設」とは区別される"
      related_subdomain_id: "SD-001"
      owned_entity_ids:
        - "E-001"
        - "E-003"
      owned_buc_ids:
        - "BUC-001"
      team_ownership: null
      reason: "言語の境界: 「会議室」が予約文脈と請求文脈で別物として扱われる"
      source_model: "BUC: 会議室利用業務, 情報: 会議室情報, 状態: 予約状態"
      confidence: "medium"
    - id: "BC-002"
      name: "請求コンテキスト"
      ubiquitous_language:
        - term: "課金対象施設"
          definition: "請求文脈における料金計算の単位。物理的な部屋とは別概念"
      related_subdomain_id: "SD-002"
      owned_entity_ids:
        - "E-004"
      owned_buc_ids:
        - "BUC-003"
      team_ownership: null
      reason: "決済処理サブドメインに対応した独立 BC"
      source_model: "外部システム: 決済機関"
      confidence: "high"
  context_map:
    - id: "CM-001"
      from_bc_id: "BC-001"
      to_bc_id: "BC-002"
      pattern: "acl"
      direction: "downstream"
      translator_description: "BC-001（予約）が BC-002（請求）の外部モデルを ACL で隔離し、自身のドメイン用語に翻訳"
      integration_events: []
      reason: "外部決済機関の汚いモデルを予約コンテキストに持ち込まない"
      source_model: "外部システム: 決済機関"
      confidence: "medium"
  aggregate_hypotheses:
    - id: "AG-001"
      bounded_context_id: "BC-001"
      root_entity_id: "E-003"
      member_entity_ids: []
      invariants:
        - "予約期間が同一会議室の他予約と重複しない"
        - "キャンセル期限を過ぎた予約は変更不可"
      note: "仮説。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 予約情報, 状態: 予約状態, 条件: キャンセルポリシー"
      confidence: "low"
  diagram_mermaid: |
    graph LR
      BC1["予約コンテキスト"]
      BC2["請求コンテキスト"]
      BC1 -->|ACL| BC2
```

## フィールド説明

### domain_architecture（optional）

DDD 戦略的設計の観点（サブドメイン分類 / 境界づけられたコンテキスト / コンテキストマップ / 集約境界仮説）。

**セクション自体の有無**:
- **トップレベルで domain_architecture セクション自体は optional**。既存の `latest/arch-design.yaml` に存在しない場合、バリデータは WARN（exit 0）で通過させる
- 新規構築時は最低 1 subdomain + 1 BC を含めることを推奨

**セクション内のフィールド**（domain_architecture を含める場合）:
- **subdomains, bounded_contexts, context_map, aggregate_hypotheses は schema-arch-design.json で required（必須キー）**
- ただし**空配列 `[]` は許容**される（例: 小規模システムで context_map: [] / aggregate_hypotheses: []）
- これは「キー自体は必ず宣言、中身は空でも可」というポリシー（schema 安定性と柔軟性の両立）

DDD 戦略設計は RDRA からの推論を補助とし、最終判断は Phase 0 の対話でユーザーに確認する。本スキルは DDD 完全準拠を主張せず、RDRA から導出可能な戦略設計の **仮説生成** に留める。詳細な原典は ddd プラグインの `${CLAUDE_PLUGIN_ROOT}/../ddd/skills/ddd-architecture/references/`（subdomain.md / bounded-context.md / context-map.md / strategy-to-tactics.md）を参照（任意）。

| フィールド | 型 | キー必須 | 説明 |
|-----------|---|:------:|------|
| subdomains | Subdomain[] | Yes（空配列可）| サブドメイン定義（Core/Supporting/Generic） |
| bounded_contexts | BoundedContext[] | Yes（空配列可）| 境界づけられたコンテキスト定義 |
| context_map | ContextMapRelation[] | Yes（空配列可）| コンテキスト間の統合パターン |
| aggregate_hypotheses | AggregateHypothesis[] | Yes（空配列可）| 集約境界の仮説。最終確定は別スキル |
| diagram_mermaid | string | No（optional） | Mermaid graph 形式の BC 関係図 |

### Subdomain

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | サブドメイン ID（"SD-{NNN}" 形式） |
| name | string | Yes | サブドメイン名（日本語） |
| type | string | Yes | 分類: "core" / "supporting" / "generic" |
| investment_policy | string | Yes | 投資方針（Core は最優先 / Supporting は good enough / Generic は買う・借りる） |
| related_buc_ids | string[] | Yes | 該当サブドメインに属する BUC ID の配列 |
| reason | string | Yes | 分類根拠 |
| source_model | string | Yes | 根拠となった RDRA/NFR 要素 |
| confidence | string | Yes | 確信度（**Core は medium 上限。自動推論で high を付与しない**） |

### BoundedContext

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | BC ID（"BC-{NNN}" 形式） |
| name | string | Yes | BC 名（日本語） |
| ubiquitous_language | UbiquitousLanguageEntry[] | Yes | 核語彙（最低 1 件）。同名異義語があれば BC 別の意味を明示 |
| related_subdomain_id | string | Yes | 該当 BC が属する Subdomain ID |
| owned_entity_ids | string[] | Yes | この BC が所有する Entity ID の配列（`data_architecture.entities[].id` を参照）。**唯一の正規参照**（Entity 側に bounded_context_id は持たない） |
| owned_buc_ids | string[] | Yes | この BC が扱う BUC ID の配列 |
| team_ownership | string \| null | Yes | チーム所有者（Conway の法則に基づく）。RDRA から推論できないため対話で確認。不明なら null |
| reason | string | Yes | BC 分割の根拠（言語境界 / チーム境界 / 外部システム境界等） |
| source_model | string | Yes | 根拠となった RDRA 要素 |
| confidence | string | Yes | 確信度（**BC 分割は medium 上限**） |

### UbiquitousLanguageEntry

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| term | string | Yes | 用語（業務で使われる呼び名） |
| definition | string | Yes | この BC での意味の定義 |

### ContextMapRelation

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | 関係 ID（"CM-{NNN}" 形式） |
| from_bc_id | string | Yes | 関係の起点 BC ID |
| to_bc_id | string | Yes | 関係の終点 BC ID |
| pattern | string | Yes | 統合パターン: "shared_kernel" / "customer_supplier" / "conformist" / "acl" / "ohs" / "published_language" |
| direction | string | Yes | 依存方向: "upstream" / "downstream" / "symmetric" |
| translator_description | string | Yes | 翻訳責務の説明（ACL なら隔離内容、OHS なら公開 API 等） |
| integration_events | string[] | Yes | この BC 境界で発生する統合イベント名の配列（具体化は dist-spec で実施。空配列可） |
| reason | string | Yes | パターン選定の根拠 |
| source_model | string | Yes | 根拠となった RDRA 要素 |
| confidence | string | Yes | 確信度 |

### AggregateHypothesis

戦略段階の **仮説**として扱う。最終確定は dist-spec or ddd-tactical-implementation の責務。よって BC 境界との整合性は **SHOULD**（推奨）レベルで、違反は validator で WARN（exit 0）に留まる。MUST にしたい場合は validator のロジックを ERROR に変更する必要がある。

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | 集約 ID（"AG-{NNN}" 形式） |
| bounded_context_id | string | Yes | 所属 BC ID |
| root_entity_id | string | Yes | aggregate root の Entity ID（**SHOULD: BC.owned_entity_ids に含まれているべき**。違反時は validator が WARN） |
| member_entity_ids | string[] | Yes | aggregate のメンバー Entity ID の配列（**SHOULD: BC.owned_entity_ids に含まれているべき**。違反時は validator が WARN。空配列可） |
| invariants | string[] | Yes | 集約内で保つべき不変条件の配列（条件.tsv 由来）。空配列可 |
| note | string | Yes | 補足。「仮説。最終確定は dist-spec or ddd-tactical-implementation で行う」等 |
| source_model | string | Yes | 根拠となった RDRA 要素 |
| confidence | string | Yes | 確信度（**aggregate は low 上限**。戦略段階の仮説として扱う） |
