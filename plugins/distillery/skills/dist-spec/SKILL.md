---
name: distillery:dist-spec
description: >
  RDRA モデル・NFR グレード・アーキテクチャ設計・デザインシステムから
  UC 単位の詳細仕様（Spec）と全体横断 UX/UI 設計仕様を生成するスキル。
  design-system スキルの後段に位置する。
  BUC/UC の階層で仕様を構造化し、RDRA トレーサビリティによる要件網羅率を算出する。
  UC 単位 Spec は spec.md（BDD + データフロー + 処理フロー）と
  tier-{tier_id}.md（arch 動的）、_model-summary.yaml（データアクセス定義）を生成する。
  BUC 単位 Spec は UC 横断データフロー・状態遷移全体図を提供する。
  全体横断の UX/UI デザイン・データ可視化・共通コンポーネント・OpenAPI/AsyncAPI を _cross-cutting/ に出力し、
  データストアレイアウト（RDB/KVS/Object Storage）を YAML で定義する。
  要件トレーサビリティマトリクスで網羅率を報告する。
  最終ステップで Storybook Story（ページ単位 + 共通コンポーネント）を生成する。
  このスキルは以下のキーワードで発動する:
  「Spec を生成」「仕様書を作成」「OpenAPI を生成」「AsyncAPI」「UC 仕様」
  「BUC 仕様」「ユースケース仕様」「UX 設計」「UI 設計」「データ可視化仕様」
  「API 仕様」「API 設計」「データベース設計」「テーブル設計」「ER図」
  「フロントエンド仕様」「バックエンド仕様」「画面設計」「画面仕様」
  「要件網羅率」「トレーサビリティ」「データフロー」「処理フロー」
  「共通コンポーネント設計」「Storybook ページ」「ページ Story」
  「KVS 設計」「Object Storage 設計」「データストア設計」
---

# Spec Generator (spec)

RDRA/NFR/Arch/Design モデルから UC 単位の詳細仕様と全体横断 UX/UI 設計仕様を生成する。

## 前提条件

### 入力ファイル

| パス | 必須 | 用途 |
|------|------|------|
| `docs/rdra/latest/BUC.tsv` | 必須 | 業務・BUC・UC・アクティビティ定義 |
| `docs/rdra/latest/アクター.tsv` | 必須 | アクター定義 |
| `docs/rdra/latest/情報.tsv` | 必須 | 情報モデル → データモデル・API 設計 |
| `docs/rdra/latest/状態.tsv` | 必須 | 状態モデル → 状態遷移仕様 |
| `docs/rdra/latest/条件.tsv` | 必須 | 条件 → バリデーション・ビジネスルール |
| `docs/rdra/latest/バリエーション.tsv` | 推奨 | バリエーション → 選択肢・フィルター |
| `docs/rdra/latest/外部システム.tsv` | 推奨 | 外部システム → API 連携・AsyncAPI |
| `docs/rdra/latest/システム概要.json` | 推奨 | システム概要 |
| `docs/nfr/latest/nfr-grade.yaml` | 必須 | NFR グレード → 非機能要件反映 |
| `docs/arch/latest/arch-design.yaml` | 必須 | アーキテクチャ設計 → 技術スタック・レイヤー構成 |
| `docs/design/latest/design-event.yaml` | 必須 | デザインシステム → コンポーネント参照・トークン参照 |

### 依存スキル

実行に必須の依存スキルはない。以下は推奨:

- `requirements` — RDRA モデルの構築元
- `quality-attributes` — NFR グレードの構築元
- `architecture` — アーキテクチャ設計の構築元
- `design-system` — デザインシステムの構築元

## 出力ディレクトリ

```
docs/specs/
  events/{event_id}/
    {業務名}/
      {BUC名}/
        buc-spec.md                    # BUC 俯瞰仕様（UC横断データフロー、状態遷移全体図）
        {UC名}/
          spec.md                      # UC 概要、データフロー、処理フロー、E2E BDD
          tier-{tier_id}.md            # ティアごとの仕様（arch-design.yaml の tiers から動的生成）
          _api-summary.yaml            # API エンドポイント中間出力（OpenAPI 統合用）
          _model-summary.yaml          # データモデル中間出力（データストアレイアウト統合用）
    _cross-cutting/
      ux-ui/                           # デザイナー・フロントエンド開発者向け
        ux-design.md                   # 全体横断 UX デザイン仕様
        ui-design.md                   # 全体横断 UI デザイン仕様
        data-visualization.md          # データ可視化設計仕様
        common-components.md           # 共通コンポーネント設計（UC完了後に抽出）
      api/                             # バックエンド開発者向け
        openapi.yaml                   # 全 UC 統合 OpenAPI 3.1 spec（Contract First 開発用）
        asyncapi.yaml                  # 全 UC 統合 AsyncAPI spec（非同期イベントがある場合のみ）
      datastore/                       # バックエンド開発者・DBA 向け
        rdb-schema.yaml                # RDB テーブル定義（カラム、FK、インデックス）
        kvs-schema.yaml                # KVS キーパターン定義（KVS使用時のみ）
        object-storage-schema.yaml     # Object Storage パス定義（使用時のみ）
        datastore-schema.md            # 統合 Markdown（generateDatastoreMd.js で生成）
      traceability-matrix.md           # 要件トレーサビリティマトリクス（網羅率）
    decisions/                         # 設計判断記録（Decision Records）
      spec-decision-001.yaml           # 判断記録（API スタイル、イベント駆動パターン等）
      ...
    spec-event.yaml                    # メタデータ（UC一覧、横断仕様サマリ）
    spec-event.md                      # Markdown 概要（generateSpecEventMd.js で生成）
    source.txt                         # トリガー説明
  latest/                              # 最新スナップショット（完全上書き）
    (events/{event_id}/ と同一構造。decisions/ 含む)
```

### ティアファイルの動的生成ルール

tier ファイルは `docs/arch/latest/arch-design.yaml` の `system_architecture.tiers` から動的に決定する。

**例**: arch-design.yaml に以下の tiers が定義されている場合:
```yaml
system_architecture:
  tiers:
    - id: "tier-frontend"
      name: "フロントエンド"
    - id: "tier-backend-api"
      name: "バックエンドAPI"
    - id: "tier-worker"
      name: "ワーカー"
```

生成されるファイル:
- `tier-frontend.md` — 画面仕様、UIロジック、コンポーネント設計
- `tier-backend-api.md` — API仕様、データモデル、ビジネスルール
- `tier-worker.md` — 非同期処理仕様

OpenAPI/AsyncAPI は `_cross-cutting/` に全 UC 統合で生成される（UC 単位では生成しない）。

**ティア種別による内容の違い**:
- **presentation 系ティア** (id に `frontend` / `presentation` / `ui` を含む): 画面仕様、UIロジック、コンポーネント設計（design-event.yaml 参照）
- **API 系ティア** (id に `backend` / `api` / `bff` を含む): API仕様、データモデル、ビジネスルール
- **非同期処理系ティア** (id に `worker` / `batch` / `event` を含む): 非同期処理仕様
- **その他**: ティアの responsibility に応じた仕様

**注意**: インフラ仕様（tier-infra.md）は生成しない。インフラ設計は前段の infrastructure スキルの責務。

### ディレクトリ命名ルール

- 業務名・BUC名・UC名のディレクトリ名にスラッシュ(/)を含めない。"/" は "-" に置き換える
- スペースはそのまま保持する（日本語名はそのまま使用）
- 業務名・BUC名は `BUC.tsv` の列から取得する

## Scripts

| スクリプト | 用途 |
|-----------|------|
| `scripts/schema-spec-event.json` | spec-event.yaml の JSON Schema |
| `scripts/validateSpecEvent.js` | Spec 構造バリデーション (exit 0/1/2) |
| `scripts/generateSpecEventMd.js` | spec-event.yaml → Markdown 生成 |
| `scripts/generateDatastoreMd.js` | rdb/kvs/object-storage-schema.yaml → 統合 Markdown 生成 |
| `scripts/validateAllYaml.js` | 全 YAML 一括構文チェック (exit 0/1/2) |
| `scripts/schema-api-summary.json` | _api-summary.yaml の JSON Schema |
| `scripts/validateApiSummary.js` | UC 単位 _api-summary.yaml バリデーション (exit 0/1/2) |
| `scripts/schema-model-summary.json` | _model-summary.yaml の JSON Schema |
| `scripts/validateModelSummary.js` | UC 単位 _model-summary.yaml バリデーション (exit 0/1/2) |
| `scripts/schema-rdb-schema.json` | rdb-schema.yaml の JSON Schema |
| `scripts/validateRdbSchema.js` | rdb-schema.yaml バリデーション + snake_case/description 必須チェック (exit 0/1/2) |
| `scripts/schema-kvs-schema.json` | kvs-schema.yaml の JSON Schema |
| `scripts/validateKvsSchema.js` | kvs-schema.yaml バリデーション (exit 0/1/2) |
| `scripts/lib/yaml-parser.js` | 簡易 YAML パーサー（全スクリプト共用、外部依存なし） |

## オーケストレーション

### Step1: モデル分析・Spec 方針決定

**読み込み:** `references/specs/spec-analyse.md`

0. **イベント ID を生成する**: `date '+%Y%m%d_%H%M%S'` コマンドでタイムスタンプを取得し、`{YYYYMMDD_HHMMSS}_spec_generation` 形式のイベント ID を決定する。以降のステップで使用する
1. 全入力モデル（RDRA, NFR, Arch, Design）を読み込む
2. BUC.tsv から業務 → BUC → UC の階層構造を抽出する
3. 各 UC について以下を整理する:
   - 関連アクター、情報、状態、条件、外部システム
   - arch-design.yaml から該当する API レイヤー・データストア
   - design-event.yaml から該当する画面・コンポーネント
4. **UC ごとの対象ティアを決定する**（`spec-generate.md` の「UC パターン別ティア選定ルール」に従う）:
   - 画面あり UC（社外アクター） → Presentation 系（user 向け） + API 系
   - 画面あり UC（社内アクター） → Presentation 系（admin 向け） + API 系
   - タイマートリガー UC → CronJob 系ワーカー + API 系（Presentation なし）
   - 自動通知 UC → FaaS 系ワーカー + API 系
   - バッチ + 画面 UC → Presentation 系 + API 系 + CronJob 系ワーカー
5. 全体横断 UX/UI 設計の方針を決定する:
   - ユーザーフロー（業務フロー横断）
   - 情報アーキテクチャ（IA）
   - データ可視化が必要な画面の特定
6. 生成対象の Spec 一覧を提示する:
   - UC 単位 Spec: `{業務名}/{BUC名}/{UC名}/` のツリー表示 + 各 UC の対象ティア一覧
   - 全体横断 Spec: `_cross-cutting/` の内容
7. `_inference.md` に分析根拠を記録する（UC ツリー、UC-ティアマッピング、全体横断設計方針）

### Step2: 全体横断 UX/UI 設計（UC の前に先行確定）

**読み込み:** `references/specs/cross-cutting-template.md`, `references/specs/data-visualization-rules.md`, `references/specs/ux-psychology-glossary.md`

**UC Spec 生成の前に**、全体横断の UX/UI 設計を先行して確定する。UX は RDRA モデルから、UI は design-event.yaml から決定できるため、UC の内容に依存しない。これにより UC Spec 生成時に一貫した設計方針を参照できる。

1. `_cross-cutting/ux-ui/ux-design.md` を生成する:
   - 業務フロー横断のユーザーフロー
   - 情報アーキテクチャ（サイトマップ、ナビゲーション構造）
   - UX 心理学に基づくインタラクション設計原則
   - アクセシビリティ方針

2. `_cross-cutting/ux-ui/ui-design.md` を生成する:
   - レイアウトパターン（ポータル別）
   - レスポンシブ戦略（ブレイクポイント、モバイル対応）
   - デザインシステム（design-event.yaml）のコンポーネント利用ガイドライン
   - ダークモード対応方針

3. `_cross-cutting/ux-ui/data-visualization.md` を生成する:
   - データ可視化が必要な画面・指標の一覧
   - チャート選定ガイドライン
   - ダッシュボード設計原則

**注意**: 共通コンポーネント設計（`common-components.md`）はここでは生成しない。各 UC の tier-frontend-*.md が出揃ってからでないとパターンが見えないため、Step4 で UC Spec 完了後に生成する。

### Step3: UC 単位 Spec 生成

**読み込み:** `references/specs/spec-template.md`, `references/specs/spec-generate.md`

UC ごとに spec.md + ティア別 md + `_api-summary.yaml` を生成する。ティアファイルは Step1 で決定した UC-ティアマッピングに従う。UC 間は独立しているため subagent で並列実行可能。OpenAPI/AsyncAPI は UC 単位では生成せず、Step4 で `_api-summary.yaml` を入力として全 UC 統合で `_cross-cutting/` に生成する。

#### subagent 分割指針

- **1 subagent あたり 8-10 UC が上限**。それ以上はコンテキスト上限でファイル生成が途中停止するリスクがある
- 業務/BUC 単位でグルーピングし、各グループが 8-10 UC に収まるように分割する
- グループ分割例（46 UC の場合）: 5-6 グループに分割
- subagent が途中停止した場合は、未生成 UC を新しい subagent で補完する

**Step2 の成果物を入力として参照する**:
- `_cross-cutting/ux-ui/ux-design.md` — ユーザーフロー・IA を参照して画面遷移を整合させる
- `_cross-cutting/ux-ui/ui-design.md` — レイアウトパターン・レスポンシブ戦略を参照

subagent への指示テンプレートは `references/specs/subagent-template.md` を参照。

#### Step3-Review: UC Spec 自己改善ループ

Step3 で生成した各 UC の出力を、**生成 subagent とは別の subagent でレビューし、指摘がなくなるまで改善する**。生成した本人がレビューすると見落としが生じるため、必ず別 subagent を使う。

**レビュー subagent の指示:**
```
あなたは UC Spec のレビュアーです。以下の UC Spec を厳密にレビューしてください。

対象: {UC Spec のパス}
参照: RDRA モデル（docs/rdra/latest/*.tsv）、arch-design.yaml、design-event.yaml

レビュー観点:
1. spec.md の RDRA トレーサビリティテーブルに漏れがないか（情報属性、条件、バリエーション、状態遷移）
2. BDD シナリオ（Given/When/Then）が具体的な値を含んでいるか（「適切な値」のような曖昧表現がないか）
3. tier-*.md にデータモデル変更・API仕様・コンポーネント設計が記述されているか
4. _api-summary.yaml の paths/schemas が tier-backend-api.md と整合しているか
5. _model-summary.yaml の tables/operations が spec.md のデータフローと整合しているか
6. mermaid ダイアグラムの構文が正しいか

指摘事項がある場合は、ファイルパスと行を特定して修正内容を具体的に提示してください。
指摘なしの場合は「LGTM」と報告してください。
```

**ループ手順:**
1. 業務単位でレビュー subagent を並列起動する（1 subagent あたり 8-10 UC）
2. 指摘があった UC について修正 subagent を起動して修正する
3. 修正後、再度レビュー subagent でチェックする
4. 「LGTM」が出るまで繰り返す（最大3回。3回目でも指摘が残る場合は残指摘をログに記録して次へ進む）

### Step3.5: BUC 単位 Spec 生成

**読み込み:** `references/specs/spec-template.md`（buc-spec.md フォーマット）

Step3 で全 UC Spec が出揃った後に、BUC 単位の俯瞰仕様を生成する。BUC 間は独立しているため subagent で並列実行可能。

各 BUC について `buc-spec.md` を生成する:
1. 所属 UC 一覧
2. UC 横断データフロー（mermaid graph + 情報 CRUD マトリクス）
3. 状態遷移全体図（mermaid stateDiagram + 状態遷移 UC マッピング）
4. BUC 内共有条件一覧（どの条件がどの UC で適用されるか）
5. BUC 内共有バリエーション一覧（どのバリエーションがどの UC で適用されるか）

**入力**: Step3 で生成した所属 UC の spec.md（RDRA トレーサビリティテーブル）を参照して集約する。

**空コンテンツ防止**: buc-spec.md は必ず上記5セクションすべてを記述すること。所属 UC が1件しかない BUC でも、UC 横断データフロー（その1件の UC のフロー）と状態遷移を記述する。セクションが空の buc-spec.md は不良品として扱う。

**BUC Spec 完了チェック**: 全 BUC の buc-spec.md が生成されたら、各ファイルの行数を確認する。10行未満のファイルはコンテンツが空と判断し、再生成する。

#### Step3.5-Review: BUC Spec 自己改善ループ

Step3-Review と同様に、生成 subagent とは別の subagent でレビューする。

**レビュー観点:**
1. 所属 UC 一覧が BUC.tsv と一致しているか
2. UC 横断データフローの mermaid に全 UC の CRUD 操作が反映されているか
3. 情報 CRUD マトリクスに全情報 x 全 UC のセルが埋まっているか
4. 状態遷移全体図に全状態遷移パスが含まれているか
5. 共有条件・共有バリエーション一覧に漏れがないか
6. **コンテンツが実質的に空でないか**（セクション見出しだけで本文がない等）

ループ: 最大3回。指摘なし（LGTM）で次へ進む。

### Step4: 全体横断統合

Step3 + Step3.5 完了後に実行。**機能別に subagent を分割して並列実行する**（単一 subagent では入力量が多くコンテキスト上限に達するリスクがある）。

#### Step4a: API 統合（OpenAPI/AsyncAPI）

**読み込み:** `references/specs/openapi-rules.md`, `references/specs/asyncapi-rules.md`

1. `_cross-cutting/api/openapi.yaml` を生成する:
   - 全 UC の API エンドポイントを統合した OpenAPI 3.1 spec
   - **Step3 で生成した各 UC の `_api-summary.yaml` を入力として paths/schemas を集約する**（tier-backend-api.md を全件再読込するより効率的）
   - `_api-summary.yaml` が存在しない UC は tier-{tier_id}.md にフォールバック
   - `references/specs/openapi-rules.md` に従って生成
   - Contract First 開発に使える品質で、スキーマ定義・型情報を具体的に記述

2. `_cross-cutting/api/asyncapi.yaml` を生成する（非同期イベントがある場合のみ）:
   - 全 UC の非同期イベントを統合した AsyncAPI spec
   - **Step3 で生成した各 UC の `_api-summary.yaml` の `async_events` セクションを入力とする**
   - `_api-summary.yaml` が存在しない UC は tier-{tier_id}.md にフォールバック
   - `references/specs/asyncapi-rules.md` に従って生成
   - 非同期イベントが1つもない場合はファイルを生成しない

OpenAPI 統合が特に重い場合は、業務単位で分割して並列生成 → 最後にマージするアプローチも有効。

#### Step4b: データストアレイアウト統合

**読み込み:** `references/specs/datastore-rules.md`

1. `_cross-cutting/datastore/rdb-schema.yaml` を生成する:
   - **Step3 で生成した各 UC の `_model-summary.yaml` の `tables` セクションを入力とする**
   - 同名テーブルをマージし、全 UC のカラム・操作を集約する
   - 情報.tsv の属性からカラム定義（名前、抽象型、制約）を導出する
   - 情報.tsv の「関連情報」列からテーブル間の FK を導出する
   - 各 UC の `indexes_needed` を集約し、重複を排除してインデックス一覧を生成する
   - mermaid ER 図を `er_diagram` フィールドに含める
   - `references/specs/datastore-rules.md` に従って生成
   - **DDL (SQL) には変換しない**。YAML で抽象型（string, integer, decimal 等）を使う

2. `_cross-cutting/datastore/kvs-schema.yaml` を生成する（KVS アクセスがある場合のみ）:
   - 各 UC の `_model-summary.yaml` の `kvs` セクションを集約する
   - キーパターン、TTL、用途を一覧化する

3. `_cross-cutting/datastore/object-storage-schema.yaml` を生成する（Object Storage アクセスがある場合のみ）:
   - 各 UC の `_model-summary.yaml` の `object_storage` セクションを集約する
   - バケット/パス設計を一覧化する

#### Step4c: 共通コンポーネント抽出

**読み込み:** `references/specs/cross-cutting-template.md`

1. `_cross-cutting/ux-ui/common-components.md` を生成する:
   - **Step3 で生成した全 UC の tier-frontend-*.md を俯瞰して**、複数 UC で共通して使われるコンポーネントパターンを抽出・設計する
   - design-event.yaml の既存コンポーネント（UI + Domain）との関係を整理する
   - 共通レイアウトシェル（ポータル別ヘッダー・サイドバー・フッター）
   - 共通フォームパターン（入力→確認→完了のウィザード等）
   - 共通一覧パターン（テーブル + フィルター + ページネーション）
   - 共通状態表示パターン（ローディング、エラー、空状態）
   - 各共通コンポーネントについて、利用する UC の一覧を明記する

#### Step4d: トレーサビリティマトリクス + 網羅率 100% 自律是正

**読み込み:** `references/specs/cross-cutting-template.md`（traceability-matrix.md フォーマット）

1. `_cross-cutting/traceability-matrix.md` を生成する:
   - RDRA の全要素（情報属性、条件、バリエーション値、状態遷移パス、外部システム）を分母として棚卸し
   - 全 UC Spec の RDRA トレーサビリティテーブルから分子（カバー済み要素）を収集
   - カテゴリ別の網羅率サマリーを算出
   - 未カバー要素一覧を生成し、対応方針（要対応/意図的除外/RDRA見直し）を提示
   - **網羅率をユーザーに報告する**
   - **BUC ↔ UC 対応表セクションを明示記録する**（RDRA の BUC と spec の UC は 1:1 対応とは限らず、複数 BUC が 1 UC にまとめられる、あるいは 1 BUC が複数 UC に分割されるケースがあるため）。以下のフォーマットで出力する:
     ```markdown
     ## BUC ↔ UC 対応表

     | BUC ID | BUC 名 | 対応する UC ID（カンマ区切り） | 関係 |
     |--------|--------|------------------------------|------|
     | BUC-001 | ... | UC-001, UC-002 | 1:N |
     | BUC-002 | ... | UC-001 | N:1（BUC-003 と統合） |
     ```

2. **網羅率が 100% 未満の場合、自律的に是正する**（人間に判断を委ねずエージェントが自走する）:

   未カバー要素それぞれについて以下を判定する:

   **パターンA: Spec 側で対応可能** — 既存 UC の Spec に未カバー要素を追記できる場合
   - 該当 UC の spec.md / tier-*.md に RDRA トレーサビリティ行と BDD シナリオを追加する
   - `_api-summary.yaml` / `_model-summary.yaml` も必要に応じて更新する
   - 修正後、トレーサビリティマトリクスを再計算する

   **パターンB: RDRA モデル側の見直しが必要** — RDRA に定義されている要素が設計上不要、または RDRA 定義自体が過剰/不足の場合
   - `_cross-cutting/rdra-feedback.md` を生成する
   - 以下のフォーマットで RDRA への変更要望を記載する:
     ```markdown
     # RDRA フィードバック（Spec 生成時の発見事項）

     ## 変更要望一覧

     | # | 種別 | 対象RDRA要素 | 変更内容 | 理由 |
     |---|------|-------------|---------|------|
     | 1 | 削除 | 情報: XX の属性 YY | 不要 | 設計上使用しない。ZZ で代替 |
     | 2 | 追加 | 条件: XX | 新規追加 | UC「AA」で必要だが RDRA に未定義 |
     | 3 | 変更 | 状態: XX の遷移 YY→ZZ | 遷移条件変更 | 実装上 WW が必要 |

     ## 対応方針
     - このフィードバックを requirements スキルで差分更新し、パイプラインを再実行する必要がある
     ```
   - トレーサビリティマトリクスの未カバー要素に「RDRA フィードバック対象」と注記する

   **是正ループ**: パターンA の修正を適用後、トレーサビリティマトリクスを再計算する。パターンA で対応可能な要素が残っている限り繰り返す。パターンB のみが残った時点でループを終了する。最終的な網羅率と `rdra-feedback.md` の有無をユーザーに報告する

#### Step4f: 設計判断記録（Decision Records）生成

Step4a〜4d の設計判断を Decision Record YAML として `docs/specs/events/{event_id}/decisions/` に記録する。イベントあたり少なくとも1つの決定記録を生成すること。

**判断カテゴリ:**

- **API スタイル選定**: REST vs GraphQL vs gRPC をティアごとに選定した理由。openapi.yaml / asyncapi.yaml の設計根拠
- **イベント駆動パターン**: 同期/非同期境界の決定。どの UC 間通信を非同期にしたか、その理由
- **データ正規化レベル**: 3NF vs 非正規化の基準。rdb-schema.yaml のテーブル設計で正規化を崩した箇所とその理由
- **横断関心事の解決方針**: エラーハンドリング戦略、ページネーション方式、認証伝播方式の決定

**YAML フォーマット:**

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

**生成手順:**
1. Step4a（API 統合）の結果から API スタイル選定の判断記録を生成する
2. Step4a（AsyncAPI）の結果からイベント駆動パターンの判断記録を生成する（非同期イベントがある場合）
3. Step4b（データストアレイアウト）の結果からデータ正規化レベルの判断記録を生成する
4. Step4c/4d の結果から横断関心事の解決方針の判断記録を生成する
5. 各判断記録を `docs/specs/events/{event_id}/decisions/spec-decision-{NNN}.yaml` として出力する（NNN は 001 から連番）

#### Step4e: 共通コンポーネント UC フィードバック

**このステップを省略してはならない**（Step4.5）。`common-components.md` の設計を各 UC の tier-frontend-*.md にフィードバックする。

1. 各 UC の tier-frontend-*.md に「共通コンポーネント参照」セクションを追加する
2. 使用する共通コンポーネント名、インポートパス (`@/components/common/{Name}`)、Props マッピングを記載
3. 共通パターンとの不整合があれば UC Spec 側を修正する
4. subagent で業務単位に並列実行可能（各 subagent が担当業務の tier-frontend-*.md を更新）

#### Step4-Review: Cross-Cutting 自己改善ループ

Step4a〜4d の各成果物を、**生成 subagent とは別の subagent でレビューし、指摘がなくなるまで改善する**。

**レビュー対象と観点:**

| 成果物 | レビュー観点 |
|--------|------------|
| `openapi.yaml` | paths が全 UC の `_api-summary.yaml` を網羅しているか、schemas のプロパティに description があるか、required が適切か |
| `asyncapi.yaml` | channels が全非同期イベントを網羅しているか、payload スキーマが具体的か |
| `rdb-schema.yaml` | 全テーブルに description があるか、全カラムに description があるか、インデックスに name があるか、ユニーク制約の検討が行われているか（ビジネスルール由来の重複防止）、FK が情報.tsv の関連情報と整合しているか |
| `kvs-schema.yaml` | キーパターンの命名規則が統一されているか、TTL が設定されているか |
| `common-components.md` | 利用 UC 一覧が正確か、design-event.yaml の既存コンポーネントとの重複がないか |
| `traceability-matrix.md` | 網羅率の分母（RDRA 全要素数）が正確か、未カバー要素の対応方針が具体的か |

**ループ手順:**
1. 機能別にレビュー subagent を並列起動する（API系、データストア系、UX/UI系、トレーサビリティ）
2. 指摘があった成果物について修正 subagent を起動して修正する
3. 修正後、再度レビュー subagent でチェックする
4. 「LGTM」が出るまで繰り返す（最大3回）

### Step5: spec-event.yaml 生成

**読み込み:** `references/spec-event-schema.md`

全 Spec のメタデータを構造化した `spec-event.yaml` を生成する:

- メタデータ（version, event_id, created_at, source）
- UC 一覧（業務/BUC/UC の階層、各 UC のファイル構成）
- 全体横断仕様のサマリー
- 生成統計（UC 数、API 数、非同期イベント数）

### Step6: バリデーション

#### 6-pre. 全 YAML 構文 + スキーマバリデーション

Spec で生成されるすべての YAML ファイルに対してバリデーションを実行する。後工程で利用できない不正 YAML を早期に検出する。

**Step 6-pre-1: 全 YAML 構文チェック（一括）**

```bash
node <skill-path>/scripts/validateAllYaml.js docs/specs/events/{event_id}
```

パースエラーがある場合は修正してから 6-pre-2 に進む。

**Step 6-pre-2: UC 単位の YAML スキーマバリデーション**

各 UC ディレクトリに対して以下を実行する:

```bash
# 各 UC ディレクトリで実行
node <skill-path>/scripts/validateApiSummary.js docs/specs/events/{event_id}/{業務名}/{BUC名}/{UC名}
node <skill-path>/scripts/validateModelSummary.js docs/specs/events/{event_id}/{業務名}/{BUC名}/{UC名}
```

- `_api-summary.yaml`: paths の method/path/summary 必須、async_events の name/channel 必須
- `_model-summary.yaml`: models の name/tier/layer/type 必須、tables の name/operations 必須

**Step 6-pre-3: Cross-Cutting YAML スキーマバリデーション**

```bash
# rdb-schema.yaml（存在する場合）
node <skill-path>/scripts/validateRdbSchema.js docs/specs/events/{event_id}/_cross-cutting/datastore/rdb-schema.yaml

# kvs-schema.yaml（存在する場合）
node <skill-path>/scripts/validateKvsSchema.js docs/specs/events/{event_id}/_cross-cutting/datastore/kvs-schema.yaml
```

- `rdb-schema.yaml`: テーブル名 snake_case、全カラム description 必須、インデックス name 空文字禁止
- `kvs-schema.yaml`: key_patterns の pattern/purpose/ttl 必須

エラーがある場合は修正してから 6a に進む。

#### 6a. Spec 構造バリデーション

```bash
node <skill-path>/scripts/validateSpecEvent.js docs/specs/events/{event_id}
```

- exit 0 (PASS) → 6b へ進む
- exit 1 (FAIL) → エラー内容を確認し修正。主な修正対象:
  - UC ディレクトリの必須ファイル（spec.md, tier-*.md, _model-summary.yaml）の欠落
  - spec.md の必須セクション（概要、関連RDRAモデル、E2E完了条件、ティア別仕様）の欠落
  - BDD シナリオ（Given/When/Then）の欠落
  - `_cross-cutting/api/openapi.yaml` の構文エラー
  - `_cross-cutting/api/asyncapi.yaml` の構文エラー（存在する場合）
  - `_cross-cutting/datastore/rdb-schema.yaml` の構文エラー（存在する場合）
  - spec-event.yaml の構造エラー
- exit 2 (システムエラー) → ファイルパス・形式を確認

#### 6b. OpenAPI リント

```bash
npx --yes @redocly/cli lint docs/specs/events/{event_id}/_cross-cutting/api/openapi.yaml
```

- エラー 0 → 6c へ進む
- エラーあり → openapi.yaml を修正。主な修正対象: 未使用スキーマ（warning は許容）、$ref 解決エラー、必須プロパティの欠落

#### 6c. AsyncAPI リント（asyncapi.yaml が存在する場合のみ）

```bash
npx --yes @asyncapi/cli validate docs/specs/events/{event_id}/_cross-cutting/api/asyncapi.yaml
```

- エラー 0 → Step7 へ進む
- エラーあり → asyncapi.yaml を修正。主な修正対象: SQS バインディングの `fifoQueue` 必須プロパティ欠落、$ref 解決エラー
- info レベル（AsyncAPI バージョン推奨等）は無視してよい

`<skill-path>` は本スキルのディレクトリパス（`${CLAUDE_PLUGIN_ROOT}/skills/spec`）。

### Step7: Markdown 生成

```bash
node <skill-path>/scripts/generateSpecEventMd.js docs/specs/events/{event_id}/spec-event.yaml
node <skill-path>/scripts/generateDatastoreMd.js docs/specs/events/{event_id}/_cross-cutting
```

- `spec-event.md` が同ディレクトリに生成される（UC 一覧、API 一覧、全体横断仕様サマリー）
- `datastore-schema.md` が `_cross-cutting/` に生成される（RDB/KVS/ObjectStorage 統合 Markdown）

### Step8: スナップショット更新

**読み込み:** `references/specs/spec-snapshot-update.md`

1. `docs/specs/latest/` を完全削除する
2. `docs/specs/events/{event_id}/` の全内容を `docs/specs/latest/` にコピーする（`decisions/` ディレクトリを含む）
3. `docs/specs/latest/README.md` を生成する（UC 一覧インデックス）

### Step9: Storybook Story 生成は spec-stories スキルで別途実施する

Storybook Story 生成は独立スキル `spec-stories` に分離されている。spec スキルは Step8 で完了とし、以下の扱いとする:

- `docs/specs/latest/spec-event.yaml` に `story_generation: required` を記録する
- Storybook Story の生成は `spec-stories` スキル（またはパイプラインの Step 6a）で別途実行する
- 本スキル内では Storybook Story の実装・ビルド検証・design イベント記録を行わない

spec-stories スキルの詳細は `${CLAUDE_PLUGIN_ROOT}/skills/dist-spec-stories/SKILL.md` を参照。

<!-- 以下、旧 Step9 の内容は spec-stories スキルに移管済み。参考のため残置するが本スキルでは実行しない。 -->

<details>
<summary>（参考）旧 Step9 の内容（spec-stories に移管済み）</summary>

Step8 でスナップショットが確定した後、Spec の内容を Storybook の Story として実装する。

#### 入力

- `docs/specs/latest/{業務名}/{BUC名}/{UC名}/tier-{tier_id}.md`（Presentation 系ティア）— コンポーネント設計・画面仕様
- `docs/specs/latest/_cross-cutting/ux-ui/ux-design.md` — ユーザーフロー・インタラクション設計
- `docs/specs/latest/_cross-cutting/ux-ui/ui-design.md` — レイアウトパターン・レスポンシブ戦略
- `docs/specs/latest/_cross-cutting/ux-ui/common-components.md` — 共通コンポーネント設計
- `docs/design/latest/design-event.yaml` — デザインシステム（トークン・コンポーネント）
- `docs/design/latest/storybook-app/` — 既存の Storybook プロジェクト

#### 出力

既存の `docs/design/latest/storybook-app/` に以下を追加する:

- `src/stories/pages/` — UC の画面を再現したページ Story
- `src/stories/components/` — Spec で定義した UC 固有コンポーネントの Story（既存コンポーネントと重複しないもの）

#### 手順

1. **共通コンポーネントの実装（最初に実施）**: `_cross-cutting/ux-ui/common-components.md` で定義された共通コンポーネントを TSX + Story として実装する。**ページ Story より先に共通コンポーネントを作る**ことで、ページ Story から参照できる
   - `src/components/common/` に TSX を配置
   - `src/stories/badges/`, `src/stories/feedback/`, `src/stories/modals/`, `src/stories/forms/`, `src/stories/data/` に Story を配置
   - 対象: StatusBadge, EmptyState, LoadingSkeleton, ErrorBanner, ProcessingState, ConfirmActionModal, EntityEditForm, SearchFilterPanel, PaginatedList
   - レイアウト Shell の Story を `src/stories/layout/` に配置（UserPortalShell, OwnerPortalShell, AdminPortalShell）
2. **対象画面の特定**: Presentation 系ティアの tier-{tier_id}.md から画面仕様（URL、コンポーネントマッピング、操作フロー）を収集する
3. **ページ Story の生成（全 UC 必須）**: 各画面を CSF3 形式の Story として実装する
   - design-event.yaml の既存コンポーネント（UI + Domain）を組み合わせて画面を構成する
   - _cross-cutting/ux-ui/ui-design.md のレイアウトパターンに従う
   - tier-{tier_id}.md のコンポーネント設計（Props、状態、イベント）を反映する
   - **全ポータルの全画面を生成する**（代表画面だけでなく、tier-frontend-*.md が存在する全 UC のページ Story を作成する）
   - **UC 全数チェック**: BUC.tsv の全 UC に対して Presentation 系ティアを持つ UC を列挙し、対応するページ Story が存在することを検証する。欠落がある場合は追加生成してから次に進む
   - UC 数が多い場合は subagent で業務単位に分割して並列生成する（1 subagent あたり 8-10 UC が上限）
4. **UC 固有コンポーネントの生成**: tier-{tier_id}.md のコンポーネント設計で、design-event.yaml に存在しない新規コンポーネントがあれば追加実装する
5. **画面確認（必須）**: design スキルの Step8 と同様に、ブラウザツールで目視確認する
   - Storybook dev server を起動 (`cd docs/design/latest/storybook-app && npm run storybook -- --no-open`)
   - 当たり前品質チェック（はみ出し、文字切れ、コントラスト、クリッカブル、色の適用）
   - 問題があれば修正 → 再確認のループ
6. **ビルド検証**: `npx storybook build` でエラーがないことを確認する
7. **design イベント記録（ハイブリッド方式）**: design スキルのイベントソーシングルールに従う。storybook-app/ は全量再ビルド対象のため events/ には含めない:
   - `date '+%Y%m%d_%H%M%S'` でイベント ID を生成
   - `docs/design/events/{event_id}/` に以下を記録する:
     - `design-event-diff.yaml` — screens/components の追加分のみ（差分）
     - `_changes.md` — 追加した共通コンポーネント・ページ Story の一覧
     - `_inference.md`、`source.txt`
   - `docs/design/latest/design-event.yaml` に差分をマージする（screens/components を追加）
   - `docs/design/latest/design-event.md` を再生成する
   - **storybook-app/ は events/ にコピーしない**（latest/ で直接開発・ビルド済み。design-event.yaml から再現可能）

#### 重要なルール

- design スキルの `design-lessons-learned.md` のルールに従う（emoji 禁止、Tailwind v4 色指定、トークン参照等）
- 既存のコンポーネント Story を壊さない — 追加のみ
- ページ Story は `stories/pages/{業務名}/{画面名}.stories.tsx` に配置する
- Storybook のカテゴリ構造: `Pages/{ポータル名}/{画面名}` でグルーピングする
- **Logo コンポーネントを利用する**: design-event.yaml の `brand.logo.variants` で定義された Logo SVG（full, icon, stacked）を、ページのヘッダー・サイドバー・ログイン画面等で積極的に使用する。既存の Logo コンポーネント（`@/components/ui/Logo`）をインポートして配置する
- _cross-cutting/ux-ui/common-components.md の共通コンポーネント設計を参照し、ページ間で一貫したレイアウトシェルを使用する

</details>

### 出力チェック

- `docs/specs/events/{event_id}/decisions/` に少なくとも1つの決定記録（spec-decision-*.yaml）が存在すること
- 各決定記録が schema_version, artifact_type, skill_type, artifact_id, title, status, generated_at, context, decision, consequences, alternatives_considered を含むこと

### タスク完了時

ユーザーに以下を**必ず**報告する:

- 生成された UC Spec の一覧（業務/BUC/UC ツリー）
- 全体横断 Spec の一覧
- OpenAPI/AsyncAPI spec のファイルパス
- `story_generation: required` が spec-event.yaml に記録されていること
- Storybook Story 生成は `spec-stories` スキル（またはパイプラインの Step 6a）で別途実施する旨の案内

## イベントソーシングルール

`references/event-sourcing-rules.md` に従う。要約:

- events/ ディレクトリは **不変**（書き込み後の変更・削除禁止）
- latest/ は **完全上書き**（マージではなく全置換）
- イベント ID フォーマット: `{YYYYMMDD_HHMMSS}_spec_generation`
- 同一秒のイベントはサフィックス `_2`, `_3` で区別

## 設計方針

1. **全体横断 UX/UI 設計を UC Spec 生成の前に確定する（Step2 → Step3）**: Step2 で UX/UI/共通コンポーネント設計を先行し、Step3 の UC Spec 生成で一貫した設計方針を参照する
2. **Presentation 系ティアはロジックとコンポーネント設計まで（Step3）、Story 実装は Step9**: Step3 では design-event.yaml のコンポーネントを参照した設計ドキュメントを生成し、Step9 で実際の Storybook Story として実装する
3. **OpenAPI/AsyncAPI は全 UC 統合で _cross-cutting/ に生成**: Contract First 開発のために全エンドポイント・全イベントを1ファイルに集約する。スキーマ定義、リクエスト/レスポンス型を実装可能な品質で具体的に記述する
4. **全体横断 Spec は _cross-cutting/ に配置**: UC 単位 Spec とは異なる粒度で、システム全体を俯瞰する設計情報を提供する
5. **RDRA モデルから導出できる範囲で記述**: 推測で仕様を追加しない
6. **BDD シナリオは具体的な値を含める**: 「適切な値」のような曖昧表現は避ける

## 実装上の注意事項

`references/impl-notes.md` を参照。subagent 分割指針、Step4e 必須（共通コンポーネント UC フィードバック省略禁止）、共通コンポーネント先行（Step9）、YAML 生成方法の4項目。

## References

| ファイル | 用途 |
|----------|------|
| `references/impl-notes.md` | 実装上の注意事項（subagent 分割・Step4e 必須・YAML 生成）|
| `references/specs/spec-analyse.md` | Step1: モデル分析タスク詳細 |
| `references/specs/cross-cutting-template.md` | Step2/Step4c/Step4d: 全体横断 UX/UI/共通コンポーネント テンプレート |
| `references/specs/data-visualization-rules.md` | Step2: データ可視化設計ルール |
| `references/specs/ux-psychology-glossary.md` | Step2: UX 心理学用語集 |
| `references/specs/spec-template.md` | Step3: UC Spec フォーマット定義（BUC は参照ポインタ） |
| `references/specs/subagent-template.md` | Step3: subagent への指示テンプレート |
| `references/specs/buc-spec-template.md` | Step3.5: BUC Spec フォーマット定義 |
| `references/specs/spec-generate.md` | Step3: UC Spec 生成タスク詳細（ティア選定ルール・API サマリー出力含む） |
| `references/specs/openapi-rules.md` | Step4a: OpenAPI 3.1 生成ルール（全 UC 統合） |
| `references/specs/asyncapi-rules.md` | Step4a: AsyncAPI 生成ルール（全 UC 統合） |
| `references/specs/datastore-rules.md` | Step3/_model-summary.yaml 出力 + Step4b: データストアレイアウト統合ルール |
| `references/spec-event-schema.md` | Step5: spec-event.yaml スキーマ定義 |
| `scripts/schema-spec-event.json` | Step6: spec-event.yaml の JSON Schema |
| `scripts/validateSpecEvent.js` | Step6: Spec バリデーション (exit 0/1/2) |
| `scripts/generateSpecEventMd.js` | Step7: spec-event.yaml → spec-event.md 生成 |
| `scripts/generateDatastoreMd.js` | Step7: rdb/kvs/object-storage-schema.yaml → datastore-schema.md 統合生成 |
| `references/specs/spec-snapshot-update.md` | Step8: スナップショット更新ルール |
| `references/event-sourcing-rules.md` | Step8: イベントソーシング不変ルール |
| `(design)references/design/design-storybook-generate.md` | Step9: Storybook 生成ルール（design スキル） |
| `(design)references/design/design-lessons-learned.md` | Step9: 実装の教訓・品質チェック（design スキル） |
| `(design)references/design/design-components-generate.md` | Step9: コンポーネント仕様生成（design スキル） |

## RDRA 整合性ルール

RDRA モデル (`docs/rdra/latest/`) に存在しないアクター / 情報 / BUC / 画面 / エンティティを
本スキルで新規追加してはならない。追加が必要と判断した場合は:

1. 追加しない
2. `node ${CLAUDE_PLUGIN_ROOT}/skills/dist-pipeline/scripts/appendTodo.js --skill dist-spec --event <spec_event_id> --type RDRA追加 --title "<タイトル>" --body "<本文>"` で `docs/todo.md` に記録
3. 確認推奨項目として返却する

## 確認推奨項目の返却（dialogue-format 準拠）

本スキルは pipeline の Step6 として **対話あり** で実行される。以下に該当する項目があれば
結果として「確認推奨項目リスト」を返す。フォーマットは
`skills/dist-pipeline/references/dialogue-format.md` に従うこと
（**3案以上 + ⭐推奨 + 一行説明 + 推奨理由**）。

- API 命名規則（REST / GraphQL / 命名スタイル）
- エラーハンドリング戦略（例外設計 / HTTP ステータスポリシー）
- RDB 正規化レベル（第3正規形 / 非正規化許容 等）
- confidence: low の項目

対話を省略して completed を返してはならない。

