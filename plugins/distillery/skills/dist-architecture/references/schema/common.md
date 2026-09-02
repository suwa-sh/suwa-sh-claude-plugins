# arch-design.yaml スキーマ — 共通部

> **読み込みタイミング**: 全 Part の推論 subagent と Step3 出力 subagent が読む。共通構造（Policy / Rule、ID 体系、confidence、用語ガイド、決定記録）は `references/schema/common.md`、
> 目次は `references/arch-schema.md`。

## トップレベルと technology_context（YAML 例）

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
| SD-{NNN} | Subdomain | サブドメイン分類 |
| BC-{NNN} | Bounded Context | 境界づけられたコンテキスト |
| CM-{NNN} | Context Map Relation | BC 間の統合関係 |
| AG-{NNN} | Aggregate Hypothesis | 集約境界の仮説 |
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
    coverage-report.md       # 要件カバレッジレポート
    decisions/               # 決定記録（events からコピー）
      arch-decision-001.yaml
      arch-decision-002.yaml
```

差分更新時のイベントには `arch-design.yaml`（全量）の代わりに `arch-design-diff.yaml`（変更要素のみ）と `_changes.md` を置く。

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
