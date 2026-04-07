# Spec 生成タスク

> **読み込みタイミング**: Step3 で使用。UC Spec 生成手順。

全入力モデル（RDRA, NFR, Arch, Design）から UC 単位の Spec を生成する。

## 入力

- `docs/rdra/latest/*.tsv` — RDRA モデル
- `docs/nfr/latest/nfr-grade.yaml` — NFR グレード
- `docs/arch/latest/arch-design.yaml` — アーキテクチャ設計
- `docs/design/latest/design-event.yaml` — デザインシステム
- `docs/specs/latest/` — 既存の Spec（あれば）
- `references/specs/spec-template.md` — Spec フォーマット定義

## 出力

- `docs/specs/events/{event_id}/{業務名}/{BUC名}/{UC名}/spec.md`
- `docs/specs/events/{event_id}/{業務名}/{BUC名}/{UC名}/tier-{tier_id}.md`（arch-design.yaml の tiers ごと）

## 手順

### 1. ティア構成の決定

`docs/arch/latest/arch-design.yaml` を読み込み、生成対象のティアを決定する:

- `system_architecture.tiers` から全ティアの `id`, `name`, `description`, `technology_candidates` を取得する
- `app_architecture.tier_layers` から各ティアのレイヤー構成を取得する
- 各ティアの種別を判定する:
  - **Presentation 系**: `technology_candidates` に SPA, SSR, MPA, モバイルアプリ等の UI 技術が含まれる
  - **API / バックエンド系**: `technology_candidates` に REST, GraphQL, gRPC, API Gateway 等の API 技術が含まれる
  - **非同期処理 / ワーカー系**: `technology_candidates` に Worker, Consumer, Batch, FaaS 等の非同期処理技術が含まれる
- ティアの種別に応じて、`spec-template.md` の該当フォーマットを使用する

#### UC パターン別ティア選定ルール

すべての arch ティアを全 UC に生成するのではなく、UC の特性に応じて対象ティアを絞り込む。BUC.tsv の関連モデル列（画面、タイマー、イベント、外部システム）から UC パターンを判定する:

| UC パターン | 判定条件 | 対象ティア |
|------------|---------|-----------|
| **画面あり UC（外部アクター）** | 関連モデルに「画面」があり、アクターが社外 | Presentation 系（user 向け） + API 系 |
| **画面あり UC（社内アクター）** | 関連モデルに「画面」があり、アクターが社内 | Presentation 系（admin 向け） + API 系 |
| **タイマートリガー UC** | 関連モデルに「タイマー」がある（画面なし） | CronJob 系ワーカー + API 系 |
| **自動通知 UC** | UC の説明に「自動通知」「自動送信」等がある | FaaS 系ワーカー + API 系 |
| **バッチ + 画面 UC** | 関連モデルに「画面」があり、処理にバッチ実行が含まれる | Presentation 系 + API 系 + CronJob 系ワーカー |
| **外部連携 UC** | 関連モデルに「イベント」+「外部システム」がある | API 系 + 該当ワーカー系 |

**重要**: インフラティア（API Gateway, IdP, 認可サービス, データストア, Object Storage, KVS, 外部連携アダプタ）は UC 単位の Spec では生成しない。これらは全体横断（cross-cutting）の責務。

**Presentation 系ティアが複数ある場合**（例: user 向けと admin 向け）、アクターの社内外で使い分ける:
- 社外アクター（利用者、オーナー等） → user 向け Presentation ティア
- 社内アクター（運営担当者等） → admin 向け Presentation ティア

### 2. UC 情報の収集

対象 UC について、以下の情報を各ソースから収集する:

**RDRA モデルから:**
- **BUC.tsv**: UC が属する業務・BUC、関連アクター、アクティビティ、画面、情報、条件、外部システム
- **情報.tsv**: UC で参照・更新する情報の詳細（属性）
- **状態.tsv**: UC に関連する状態遷移
- **アクター.tsv**: 操作するアクターの詳細
- **条件.tsv**: 適用される条件の詳細
- **バリエーション.tsv**: 関連するバリエーション
- **外部システム.tsv**: 連携する外部システムの詳細

**NFR グレードから:**
- 可用性グレード → エラーハンドリング・リトライ仕様
- 性能グレード → ページネーション・キャッシュ・レスポンスタイム要件
- セキュリティグレード → 認証・認可・PII 処理仕様

**Arch 設計から:**
- system_architecture.tiers → 該当するティア構成
- app_architecture.tier_layers → ティアごとのレイヤー構成
- data_architecture.entities → データモデル
- technology_context → 技術スタック

**Design システムから:**
- portals → 該当するポータル
- screens → 該当する画面・ルート・コンポーネント
- components → 使用するUIコンポーネント・ドメインコンポーネント
- tokens → デザイントークン
- states → 状態モデルの表示仕様

### 3. 既存 Spec の確認

`docs/specs/latest/{業務名}/{BUC名}/{UC名}/` が存在する場合、既存の Spec を読み込み参照する。

### 4. spec.md の生成

`references/specs/spec-template.md` の spec.md フォーマットに従い、以下を記述する:

- **概要**: UC の目的と範囲
- **関連 RDRA モデル**: `docs/rdra/latest/*.tsv` の実際の要素名を使用。業務名も記載する
- **アーキテクチャコンテキスト**: arch-design.yaml から該当するティア構成と技術スタック
- **E2E 完了条件**: Gherkin 形式の BDD シナリオ
  - 正常系: 主要なユーザーフローを網羅
  - 異常系: エラーケース、バリデーション失敗、権限エラーなど
  - USDM の acceptance_criteria がある場合は対応する BDD Scenario を含める
- **ティア別仕様**: Step 1 で決定した全ティアへのリンクを動的に生成

### 5. tier-{tier_id}.md の生成（ティアごとに繰り返し）

Step 1 で決定した各ティアについて、ティア種別に応じたフォーマットで仕様を生成する:

**Presentation 系ティアの場合:**
- **画面仕様**: design-event.yaml の screens から該当画面のルート・コンポーネントを参照
- **表示要素とコンポーネントマッピング**: design-event.yaml の components（ui + domain）への参照
- **デザイントークン参照**: design-event.yaml の tokens から該当トークン
- **UIロジック**: 状態管理、バリデーション、ローディング、エラーハンドリング
- **コンポーネント設計**: Props、状態、イベントの定義
- **ティア完了条件**: 画面操作に閉じた BDD シナリオ

コンポーネント設計では、design-event.yaml のコンポーネントを「ベースコンポーネント」として参照し、この UC 固有の Props や状態を定義する。UI の実装（Storybook Story）は後続作業。

**API / バックエンド系ティアの場合:**
- **API 仕様**: arch-design.yaml の該当ティアのレイヤー構成から導出したエンドポイント
- **非同期イベント**: 外部システム連携や状態遷移通知で非同期が必要な場合
- **データモデル変更**: 情報.tsv の属性から導出
- **ビジネスルール**: 条件.tsv, バリエーション.tsv から導出
- **ティア完了条件**: API レベルの BDD シナリオ

**非同期処理 / ワーカー系ティアの場合:**
- **イベント処理仕様**: トリガー、入出力チャネル、処理フロー
- **エラーハンドリング**: リトライ、DLQ の方針
- **データモデル変更**: 情報.tsv の属性から導出
- **ビジネスルール**: 条件.tsv, バリエーション.tsv から導出
- **ティア完了条件**: イベント処理の BDD シナリオ

### 6. API サマリーの出力

tier-backend-api.md（API 系ティア）を生成した後、同じ UC ディレクトリに `_api-summary.yaml` を出力する。このファイルは後続の OpenAPI 統合生成（Step3）の入力となり、全 tier-backend-api.md を再読込する必要をなくす。

```yaml
# _api-summary.yaml
uc: "{UC名}"
business: "{業務名}"
buc: "{BUC名}"
endpoints:
  - method: "POST"
    path: "/api/v1/resources"
    summary: "{操作概要}"
    request_schema: "CreateResourceRequest"
    response_schema: "ResourceResponse"
    tags: ["{タグ名}"]
  - method: "GET"
    path: "/api/v1/resources/{id}"
    summary: "{操作概要}"
    response_schema: "ResourceResponse"
    tags: ["{タグ名}"]
async_events:
  - channel: "{チャネル名}"
    direction: "publish"
    message_schema: "{メッセージスキーマ名}"
    summary: "{イベント概要}"
schemas:
  - name: "CreateResourceRequest"
    properties:
      - name: "field_name"
        type: "string"
        required: true
  - name: "ResourceResponse"
    properties:
      - name: "id"
        type: "string"
        required: true
```

**注意**: `_api-summary.yaml` は OpenAPI/AsyncAPI 統合生成のための中間出力であり、仕様の正本は `tier-backend-api.md` である。

### 7. モデルサマリーの出力

spec.md のデータフロー（mermaid + データ変換テーブル）と tier-backend-api.md のデータモデル変更セクションから、同じ UC ディレクトリに `_model-summary.yaml` を出力する。このファイルは後続のデータストアレイアウト統合（Step4）の入力となる。

```yaml
# _model-summary.yaml
uc: "{UC名}"
business: "{業務名}"
buc: "{BUC名}"

models:
  - name: "{モデル/型名}"         # spec.md データフローのノード名
    tier: "{ティアID}"
    layer: "{レイヤー名}"
    type: "{モデル種別}"          # view-model, state, request, request-dto, command, query, entity, value-object, record
    rdra_info: "{情報.tsv の情報名}"

tables:
  - name: "{テーブル名}"
    rdra_info: "{情報.tsv の情報名}"
    operations:
      - type: "INSERT"
        columns:
          - name: "{カラム名}"
            value: "{設定値の説明}"
        where: ""
    indexes_needed:
      - columns: ["{カラム名}"]
        reason: "{必要な理由}"
        access_pattern: "{アクセスパターン}"

kvs: []                           # KVS アクセスがある場合のみ記述
object_storage: []                # Object Storage アクセスがある場合のみ記述
```

導出ルールの詳細は `references/specs/datastore-rules.md` を参照。

**注意**: `_model-summary.yaml` はデータストアレイアウト統合のための中間出力であり、仕様の正本は `spec.md` のデータフローと `tier-backend-api.md` のデータモデル変更セクションである。

## 出力ルール

**注意**: OpenAPI/AsyncAPI yaml ファイルは UC 単位では生成しない。全 UC の API を統合した `_cross-cutting/api/openapi.yaml` と `_cross-cutting/api/asyncapi.yaml` は、全 UC の Spec 生成完了後に Step3（全体横断 Spec 生成）で生成する。

- ディレクトリ名にスラッシュ(/)を含めない。"/" が含まれる場合は "-" に置き換える
- **BDD シナリオは必ず Given/When/Then の3キーワードをすべて含めること**。Given → Then のみ（When 省略）は不可。バリデーションで検出される
- BDD シナリオは具体的な値を含める（例: `Given 利用者「田中太郎」がログイン済み`）
- 関連 RDRA モデルは `docs/rdra/latest/*.tsv` の実際の要素名を使用する
- 推測でティアの仕様を追加しない — 入力モデルから導出できる範囲で記述する
- 1つの UC の Spec 生成は1つの subagent で完結させる（UC 間で並列実行可能）
- ティア構成は arch-design.yaml から動的に決定する — 固定のティア名をハードコードしない
- UC パターン別ティア選定ルール（手順 1 参照）に従い、UC に関連しないティアのファイルは生成しない
- tier-*.md 内の API 仕様テーブルや非同期イベント仕様は、後続の `_cross-cutting/api/openapi.yaml` / `asyncapi.yaml` 生成の入力になるため、具体的に記述する
- API 系ティアの生成時は `_api-summary.yaml` も出力する（手順 6 参照）
- 全 UC で `_model-summary.yaml` も出力する（手順 7 参照）。spec.md のデータフローと tier-backend-api.md から導出

## 設計判断記録（Decision Records）

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
