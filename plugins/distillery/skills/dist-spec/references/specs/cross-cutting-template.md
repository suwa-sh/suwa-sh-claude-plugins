# 全体横断 Spec テンプレート定義（全体像・API/データストア概要）

> **読み込みタイミング**: Step4a（API 統合）で概要参照。フォーマット詳細は分割ファイルを参照:
>
> | ファイル | 内容 | 使用 Step |
> |---------|------|----------|
> | `cross-cutting-ux-ui-template.md` | ux-design / ui-design / data-visualization フォーマット | Step2 / Step4c |
> | `cross-cutting-traceability-template.md` | traceability-matrix フォーマット + 網羅率算出ルール | Step4d |
> | このファイル | ディレクトリ構成 + OpenAPI/AsyncAPI/データストア概要 | Step4a / 全体把握 |

UC 単位 Spec とは異なる粒度で、システム全体を俯瞰する仕様のフォーマットを定義する。

## ディレクトリ構成

```
_cross-cutting/
  ux-ui/
    ux-design.md             # 全体横断 UX デザイン仕様
    ui-design.md             # 全体横断 UI デザイン仕様
    data-visualization.md    # データ可視化設計仕様
    common-components.md     # 共通コンポーネント設計（Step4c で生成）
  api/
    openapi.yaml             # 全 UC 統合 OpenAPI 3.1 spec（Contract First 開発用）
    asyncapi.yaml            # 全 UC 統合 AsyncAPI spec（非同期イベントがある場合のみ）
  datastore/
    rdb-schema.yaml          # RDB レイアウト
    kvs-schema.yaml          # KVS レイアウト（KVS アクセスがある場合のみ）
    object-storage-schema.yaml  # Object Storage レイアウト（アクセスがある場合のみ）
  traceability-matrix.md     # 要件トレーサビリティマトリクス
```

## openapi.yaml 概要

全 UC の API エンドポイントを統合した OpenAPI 3.1 spec。Contract First 開発のために、全エンドポイントを1ファイルに集約する。

- 各 UC の `_api-summary.yaml`（無い UC は `tier-{tier_id}.md` の API 仕様テーブル）から paths と schemas を収集・統合
- `references/specs/openapi-rules.md` のルールに従って生成
- tags で UC ごとにグルーピングする（例: `tags: [{name: "{UC名}"}]`）
- schemas はエンドポイント間で共有されるモデルを `#/components/schemas/` に集約
- 認証方式は `#/components/securitySchemes/` に定義し、arch-design.yaml の認証設定を反映

## asyncapi.yaml 概要

全 UC の非同期イベントを統合した AsyncAPI spec。非同期イベントが1つもない場合はファイルを生成しない。

- 各 UC の `_api-summary.yaml` の `async_events`（無い UC は `tier-{tier_id}.md` の非同期イベント仕様）から channels と messages を収集・統合
- `references/specs/asyncapi-rules.md` のルールに従って生成
- channels はイベントの方向（publish/subscribe）を明示
- メッセージスキーマは `#/components/messages/` に集約

## データストアレイアウト概要

全 UC の `_model-summary.yaml` を統合し、データストア別のレイアウト YAML を生成する。`references/specs/datastore-rules.md` に従う。

### rdb-schema.yaml

全テーブルの定義（カラム、型、FK、インデックス）を YAML で記述する。DDL には変換しない。

- 全 UC の `_model-summary.yaml` の `tables` を収集・マージ
- 情報.tsv の属性からカラム定義を導出
- 情報.tsv の「関連情報」列から FK を導出
- 各 UC の `indexes_needed` を集約して重複排除
- mermaid ER 図を `er_diagram` フィールドに含める

### kvs-schema.yaml

KVS のキーパターン、TTL、用途を定義する。KVS アクセスがない場合は生成しない。

### object-storage-schema.yaml

Object Storage のバケット/パス設計を定義する。Object Storage アクセスがない場合は生成しない。

## 注意事項

- OpenAPI/AsyncAPI は全 UC 統合で生成する — Contract First 開発に使える品質で、スキーマ定義・型情報を具体的に記述する
- asyncapi.yaml は非同期イベントが存在する場合のみ生成する
