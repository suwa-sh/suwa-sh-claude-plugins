# Spec 生成タスク

> **読み込みタイミング**: Step3 で使用。UC Spec 生成手順。

全入力モデル（RDRA, NFR, Arch, Design）から UC 単位の Spec を生成する。

catalog modeでは `references/specs/contract-catalog.md` の順序を使う。
手順6のsummary生成は実施済みの機械生成物を読むだけとし、手順5のAPI型表はoperation参照に置き換える。

`references/specs/implementation-readiness.md` を読み、実装時に結果を選び直す必要がないか確認する。
不足・矛盾を元出力から保持しただけでは合格にしない。

## 入力

- `docs/rdra/latest/*.tsv` — RDRA モデル
- `docs/specs/events/{event_id}/_inputs-digest.md` — Step1 生成の arch/nfr ダイジェスト（**優先**。
  NFR グレード・ティア構成・レイヤー構成・エンティティ・技術スタックの転写と、冒頭に転写済みセクションのチェックリストを含む）
- `docs/nfr/latest/nfr-grade.yaml` — NFR グレード（ダイジェストが無ければフルロード。チェックリストでセクション欠落があれば欠けた分だけ読む）
- `docs/arch/latest/arch-design.yaml` — アーキテクチャ設計（同上フォールバック）
- `docs/design/latest/design-event.yaml` — デザインシステム
- `docs/specs/latest/` — 既存の Spec（あれば）
- `references/specs/spec-template.md` — Spec フォーマット定義（共通部）
- `references/specs/tier-templates/{kind}.md` — 対象ティアの kind に一致するティア別フォーマット（該当分だけ読む）

## 出力

- `docs/specs/events/{event_id}/{業務名}/{BUC名}/{UC名}/spec.md`
- `docs/specs/events/{event_id}/{業務名}/{BUC名}/{UC名}/tier-{tier_id}.md`（arch-design.yaml の tiers ごと）

## 手順

### 1. ティア構成の確認

生成対象のティアと kind は **Step1 でオーケストレータが確定し、subagent 指示の「対象ティア」に渡される**
（選定ルールは `references/specs/tier-selection-rules.md`。subagent は読まない）。
指示に無いティアのファイルは生成しない。ティア id の一覧は `_inputs-digest.md` の `system_architecture.tiers` で確認できる。

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
- **業務ルール・状態遷移**: 条件・計算・バリエーションをルール ID でまとめる。通常のレイヤー往復図・技術スタック一覧は再掲しない
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
- **共通規約参照**: ファイル + 見出し / component 名で特定し、トークン値・共通 Props・既定値は再掲しない
- **UIロジック**: 状態の所有者、API へのバインディング、再読込・未実行・0件・送信・失敗からの復帰
- **コンポーネント設計**: Props、状態、イベントの定義
- **ティア完了条件**: 画面操作に閉じた BDD シナリオ

コンポーネント設計では、design-event.yaml のコンポーネントを「ベースコンポーネント」として参照し、この UC 固有の Props や状態を定義する。UI の実装（Storybook Story）は後続作業。

**CLI 系ティアの場合**（`references/specs/tier-templates/cli.md` のフォーマット）:
- **コマンド契約**: コマンド名、引数、オプション（型・既定値・必須）、stdin の受け付け
- **出力契約**: stdout の内容とフォーマット（table / json / plain。`_cross-cutting/ux-ui/ui-design.md` の出力規約に従う）、
  stderr のメッセージ、終了コード（成功 / 入力エラー / 業務エラー / システムエラー）
- **UC ロジック**: バリデーション、確認プロンプトの有無、冪等性
- **ティア完了条件**: コマンド実行に閉じた BDD シナリオ（Given 引数 / When 実行 / Then stdout・終了コード）
- 画面仕様・コンポーネント設計・デザイントークン参照・`screens` は**生成しない**

**API / バックエンド系ティアの場合:**
- **API 仕様**: arch-design.yaml の該当ティアのレイヤー構成から導出したエンドポイント
- **非同期イベント**: 外部システム連携や状態遷移通知で非同期が必要な場合
- **データアクセス・実行条件**: `_model-summary.yaml` の操作参照と原子性・競合・再送・副作用。DB 型表は統合スキーマへ集約
- **業務ルールの適用**: spec.md の RULE-ID と実行箇所。条件・計算の本文は再掲しない
- **ティア完了条件**: API レベルの BDD シナリオ

**非同期処理 / ワーカー系ティアの場合:**
- **イベント処理仕様**: トリガー、入出力チャネル、処理フロー
- **エラーハンドリング**: リトライ、DLQ の方針
- **データアクセス・実行条件**: `_model-summary.yaml` の操作参照と原子性・競合・再送・副作用。DB 型表は統合スキーマへ集約
- **業務ルールの適用**: spec.md の RULE-ID と実行箇所。条件・計算の本文は再掲しない
- **ティア完了条件**: イベント処理の BDD シナリオ

### 6. API サマリーの出力

tier-backend-api.md（API 系ティア）を生成した後、同じ UC ディレクトリに `_api-summary.yaml` を出力する。このファイルは後続の OpenAPI 統合生成（Step4a）の入力となり、全 tier-backend-api.md を再読込する必要をなくす。

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

RDRA の情報・条件・状態と arch のティア/レイヤー、UC の業務ルール・tier の実行条件から、同じ UC ディレクトリに `_model-summary.yaml` を出力する。このファイルは後続のデータストアレイアウト統合（Step4）の入力となる。

```yaml
# _model-summary.yaml
uc: "{UC名}"
business: "{業務名}"
buc: "{BUC名}"

# arch-design.yaml の domain_architecture から引き継ぐ (optional)
# - bounded_context_id: この UC の primary BC（実装ロジックが置かれる側）
# - aggregate_id: この UC が更新する primary aggregate
# arch-design.yaml に domain_architecture が無い場合は省略可
bounded_context_id: "BC-{NNN}"
aggregate_id: "AG-{NNN}"

models:
  - name: "{モデル/型名}"         # 入力モデルとUC責務から決定した名前
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

**注意**: `_model-summary.yaml` は UC のモデル配置・データアクセス定義を保持する。図から抽出することを前提にしない。
操作対象列・設定値・検索/更新条件・インデックス要件・KVS/Storageアクセスを省略せず、同じ内容を tier md に複写しない。
DB 型・制約は Step4b で RDRA / arch と統合して確定する。tier md に固有の型・制約の判断がある場合は
統合時にその箇所も読み、統合済みの参照先へ置き換える。

## 出力ルール

**注意**: OpenAPI/AsyncAPI yaml ファイルは UC 単位では生成しない。全 UC の API を統合した `_cross-cutting/api/openapi.yaml` と `_cross-cutting/api/asyncapi.yaml` は、全 UC の Spec 生成完了後に Step4a（全体横断 Spec 生成）で生成する。

- ディレクトリ名にスラッシュ(/)を含めない。"/" が含まれる場合は "-" に置き換える
- **BDD シナリオは必ず Given/When/Then の3キーワードをすべて含めること**。Given → Then のみ（When 省略）は不可。バリデーションで検出される
- BDD シナリオは具体的な値を含める（例: `Given 利用者「田中太郎」がログイン済み`）
- 関連 RDRA モデルは `docs/rdra/latest/*.tsv` の実際の要素名を使用する
- 推測でティアの仕様を追加しない — 入力モデルから導出できる範囲で記述する
- 1つの UC の Spec 生成は1つの subagent で完結させる（UC 間で並列実行可能）
- ティア構成は arch-design.yaml から動的に決定する — 固定のティア名をハードコードしない
- 指示で渡された対象ティア以外のファイルは生成しない（選定ルールの正本は `references/specs/tier-selection-rules.md`。オーケストレータが適用済み）
- tier-*.md 内の API 仕様テーブルや非同期イベント仕様は、後続の `_cross-cutting/api/openapi.yaml` / `asyncapi.yaml` 生成の入力になるため、具体的に記述する
- API 系ティアの生成時は `_api-summary.yaml` も出力する（手順 6 参照）
- 全 UC で `_model-summary.yaml` も出力する（手順 7 参照）。入力モデル・UC の業務ルール・tier の実行条件から導出

## 簡素化と情報保持

`references/specs/spec-template.md` の出力規約を適用する。API 本文と summary の契約形式は維持する。
BDD は UC と tier で検証する保証を分け、既存の具体的な受入条件を単に行数削減のために削らない。
summary の形式・列定義を省略して短縮しない。Step4 の統合先が未生成の間は
既存共有定義がある項目だけ参照化し、新しい共有定義は統合して参照検証を終えるまで保持する。
