# 設計判断記録（Decision Records）

> **読み込みタイミング**: Step4f（オーケストレータ、または decisions/ 生成を担当する単一 subagent）で読む。
> Step3 の UC 生成 subagent は読まない。

全体横断 Spec（Step4）の完了後に、設計判断を Decision Record YAML として記録する。Spec 生成プロセスで行った重要な設計判断を、後続の開発者やレビュアーが理解できるように構造化する。

### 対象となる判断カテゴリ

| カテゴリ | 判断内容の例 |
|---------|------------|
| **API スタイル選定** | REST vs GraphQL vs gRPC の選定理由。ティアごとに異なるスタイルを採用した場合はそれぞれの根拠 |
| **イベント駆動パターン** | 同期/非同期の境界をどこに引いたか。どの UC 間通信を非同期にしたか（メッセージキュー、イベントバス）とその理由 |
| **データ正規化レベル** | 3NF を基本としつつ非正規化した箇所とその理由（パフォーマンス、読み取りパターン最適化など） |
| **横断関心事の解決方針** | エラーハンドリング戦略（リトライ、サーキットブレーカー）、ページネーション方式（カーソル vs オフセット）、認証伝播方式（JWT、セッション）の決定 |

### 生成タイミング

Decision Record は **cross-cutting Spec の生成完了後** に作成する。UC 単位 Spec の生成中ではなく、全体を俯瞰した段階で判断を記録する理由:

1. API スタイルは openapi.yaml / asyncapi.yaml の統合時に確定する
2. データ正規化は rdb-schema.yaml の統合時に確定する
3. 横断関心事は common-components.md やトレーサビリティマトリクスの生成時に確定する

### YAML フォーマット

```yaml
schema_version: "1.0"
artifact_type: "decision_record"
skill_type: "specification"
artifact_id: "spec-decision-{NNN}"
title: "判断タイトル"
status: "approved"
generated_at: "{ISO 8601}"
context: |
  ...問題の背景・制約...
decision: |
  ...判断内容と理由...
consequences:
  positive: [...]
  negative: [...]
alternatives_considered:
  - name: "代替案名"
    reason_rejected: "不採用理由"
```

### 出力先

```
docs/specs/events/{event_id}/decisions/
  spec-decision-001.yaml
  spec-decision-002.yaml
  ...
```

イベントあたり少なくとも1つの Decision Record を生成すること。
