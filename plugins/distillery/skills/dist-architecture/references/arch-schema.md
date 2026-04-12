# アーキテクチャ設計 YAML スキーマ定義

RDRA モデルと NFR グレードから推論したアーキテクチャ設計を YAML 形式で管理するスキーマ。
全てのテクノロジー記述はベンダーニュートラル（FaaS, CaaS(k8s), RDB, KVS 等）とし、特定クラウドベンダーのサービス名は使用しない。

## 目次

- [arch-design.yaml フォーマット](#arch-designyaml-フォーマット) — YAML サンプル全体
- [フィールド説明](#フィールド説明)
  - [トップレベル](#トップレベル)
  - [technology_context](#technology_context)
  - [system_architecture](#system_architecture)
  - [Tier](#tier)
  - [app_architecture](#app_architecture)
  - [TierLayer](#tierlayer)
  - [Layer](#layer)
  - [data_architecture](#data_architecture)
  - [Entity](#entity)
  - [Attribute](#attribute)
  - [Relationship](#relationship)
  - [StorageMapping](#storagemapping)
  - [Policy / Rule（共通構造）](#policy--rule共通構造)
- [ID プレフィックス体系](#id-プレフィックス体系)
- [confidence 値の使い分け](#confidence-値の使い分け)
- [ベンダーニュートラルな用語ガイド](#ベンダーニュートラルな用語ガイド)
- [ディレクトリ配置](#ディレクトリ配置)
- [スクリプト実装メモ](#スクリプト実装メモ)

## arch-design.yaml フォーマット

```yaml
version: "1.0"
event_id: "{YYYYMMDD_HHMMSS}_{変更名}"
created_at: "YYYY-MM-DDTHH:MM:SS"
source: "トリガーの説明（初期構築/RDRA差分更新等）"

technology_context:
  languages:
    - "TypeScript"
  frameworks:
    - "Next.js"
  constraints:
    - "モノレポ構成"

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

### トップレベル

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| version | string | Yes | スキーマバージョン（"1.0"固定） |
| event_id | string | Yes | イベントID（イベントソーシング用） |
| created_at | string | Yes | 作成日時（ISO 8601） |
| source | string | Yes | トリガーの説明 |

### technology_context

テクノロジースタック情報。ベンダー固有のサービス名は含めない。

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| languages | string[] | Yes | プログラミング言語（例: "TypeScript", "Go"） |
| frameworks | string[] | Yes | フレームワーク（例: "Next.js", "Spring Boot"） |
| constraints | string[] | Yes | 技術的制約（例: "モノレポ構成", "既存DBとの互換性"） |

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

### Policy / Rule（共通構造）

全ての policy と rule は以下の共通フィールドを持つ。

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | ID（プレフィックスで種別を区別: SP, SR, CTP, CTR, LP, LR, CLP, CLR） |
| name | string | Yes | 方針/ルール名 |
| description | string | Yes | 方針/ルールの内容 |
| reason | string | Yes | 決定根拠 |
| source_model | string | Yes | 根拠となった RDRA/NFR 要素。推論元がない場合は `"なし"` |
| confidence | string | Yes | 確信度 |

### ID プレフィックス体系

| プレフィックス | 種別 | スコープ |
|---------------|------|---------|
| SP-{NNN} | System tier Policy | ティアごとの方針 |
| SR-{NNN} | System tier Rule | ティアごとのルール |
| CTP-{NNN} | Cross-Tier Policy | ティア共通の方針 |
| CTR-{NNN} | Cross-Tier Rule | ティア共通のルール |
| LP-{NNN} | Layer Policy | レイヤーごとの方針 |
| LR-{NNN} | Layer Rule | レイヤーごとのルール |
| CLP-{NNN} | Cross-Layer Policy | レイヤー共通の方針（ティア内） |
| CLR-{NNN} | Cross-Layer Rule | レイヤー共通のルール（ティア内） |

### confidence 値の使い分け

| 値 | 意味 | Step2 での扱い |
|----|------|---------------|
| high | RDRA/NFR から明確に推論できた | 確認のみ（変更不要なら省略可） |
| medium | RDRA/NFR から間接的に推論した | 確認を推奨 |
| low | 弱い根拠での推論 | 必ず確認 |
| default | 一般的なベストプラクティスを適用 | 必要に応じて確認 |
| user | ユーザーが対話で指定した値 | 確定済み |

### ベンダーニュートラルな用語ガイド

テクノロジー候補やストレージ種別には以下のベンダーニュートラル用語を使用する。

| 用語 | 説明 | 使用不可な例 |
|------|------|------------|
| SPA | シングルページアプリケーション | - |
| SSR | サーバーサイドレンダリング | - |
| BFF | Backend for Frontend | - |
| CaaS(k8s) | コンテナオーケストレーション | EKS, AKS, GKE |
| FaaS | サーバーレス関数 | Lambda, Azure Functions, Cloud Functions |
| RDB | リレーショナルデータベース | RDS, Azure SQL, Cloud SQL |
| KVS | キーバリューストア | DynamoDB, Cosmos DB, Firestore |
| MQ | メッセージキュー | SQS, Service Bus, Pub/Sub |
| Object Storage | オブジェクトストレージ | S3, Blob Storage, Cloud Storage |
| CDN | コンテンツデリバリーネットワーク | CloudFront, Azure CDN, Cloud CDN |
| LB | ロードバランサー | ALB, Azure LB, Cloud LB |
| IdP | アイデンティティプロバイダー | Cognito, Azure AD, Firebase Auth |
| APM | アプリケーション性能監視 | CloudWatch, Azure Monitor, Cloud Monitoring |
| Container Registry | コンテナレジストリ | ECR, ACR, Artifact Registry |

### ディレクトリ配置

```
docs/arch/
  events/
    {event_id}/
      arch-design.yaml      # アーキテクチャ設計（全量）
      arch-design.md         # Markdown 表現（Mermaid 図含む）
      _inference.md          # 推論根拠サマリ
      source.txt             # トリガー説明
      decisions/             # 決定記録
        arch-decision-001.yaml
        arch-decision-002.yaml
  latest/
    arch-design.yaml         # 最新スナップショット
    arch-design.md           # 最新 Markdown
    decisions/               # 決定記録（events からコピー）
      arch-decision-001.yaml
      arch-decision-002.yaml
```

### 決定記録スキーマ

`decisions/` 配下に格納する決定記録（Decision Record）の YAML フォーマット。

```yaml
schema_version: "1.0"
artifact_type: "decision_record"
skill_type: "architecture"
artifact_id: "arch-decision-{NNN}"
title: "判断タイトル"
status: "approved"
generated_at: "YYYY-MM-DDTHH:MM:SS"
context: |
  問題の背景・制約を記述する。
  なぜこの判断が必要になったかの文脈。
decision: |
  判断内容と理由を記述する。
  何を選択し、なぜその選択が最適かの根拠。
consequences:
  positive:
    - "ポジティブな結果1"
    - "ポジティブな結果2"
  negative:
    - "ネガティブな結果・トレードオフ1"
alternatives_considered:
  - name: "代替案名"
    reason_rejected: "不採用理由"
```

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| schema_version | string | Yes | スキーマバージョン（"1.0"固定） |
| artifact_type | string | Yes | 成果物種別（"decision_record"固定） |
| skill_type | string | Yes | スキル種別（"architecture"固定） |
| artifact_id | string | Yes | 決定記録ID（"arch-decision-{NNN}" 形式、001から連番） |
| title | string | Yes | 判断タイトル（日本語） |
| status | string | Yes | ステータス（"approved"固定） |
| generated_at | string | Yes | 生成日時（ISO 8601。イベントの created_at と同じ値） |
| context | string | Yes | 問題の背景・制約 |
| decision | string | Yes | 判断内容と理由 |
| consequences.positive | string[] | Yes | ポジティブな結果（1つ以上） |
| consequences.negative | string[] | Yes | ネガティブな結果・トレードオフ（0個以上） |
| alternatives_considered | object[] | Yes | 検討した代替案（0個以上。各要素は name と reason_rejected を持つ） |

決定カテゴリ:

| カテゴリ | 内容 |
|---------|------|
| テクノロジースタック選定 | 言語・FW の選択理由 |
| ティアパターン選定 | CaaS vs FaaS 等、ティアごとの選定理由 |
| データモデル戦略 | event_snapshot vs resource_mutable の使い分け基準 |
| 認証方式選定 | OAuth2/OIDC の採用理由 |
| レイヤリング戦略 | 凹型 vs 直接依存 等 |

### スクリプト実装メモ

本スキルの scripts/ 配下のスクリプトは npm 依存なしの簡易 YAML パーサーを使用している。以下の注意事項:

- YAML のフロースタイル空配列 `[]` を正しく空配列として解析すること（`parseValue` 関数で `str === '[]'` の場合に `[]` を返す）
- `source_model` の値は文字列のみ（null は使用しない。推論元がない場合は `"なし"`）
- 新しいスクリプトを追加する場合は、既存スクリプト（validateArchDesign.js 等）のパーサーを参考にすること
