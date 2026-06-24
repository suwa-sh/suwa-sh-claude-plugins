# Step3: アーキテクチャ設計 YAML 出力

対話で確定したアーキテクチャ設計を YAML ファイルとして出力し、イベント記録 + スナップショット更新を行うタスク。

## 入力

- Step2 で確定したアーキテクチャ設計情報（内部データ）
- `references/arch-schema.md` — 出力スキーマ
- `references/event-sourcing-rules.md` — イベントソーシングルール

## タスク手順

### 1. イベント ID の生成

形式: `{YYYYMMDD_HHMMSS}_{変更名}`

**日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない。** `created_at` も同じタイミングで `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得する。

- 初期構築: `{timestamp}_initial_arch`
- RDRA 差分起因: `{timestamp}_arch_update_for_{rdra_event_id}`
- NFR 変更起因: `{timestamp}_arch_update_for_nfr_{nfr_event_id}`
- 手動更新: `{timestamp}_arch_manual_update`

### 2. arch-design.yaml / arch-design-diff.yaml の生成

モード判定:

- **初期構築モード**（`docs/arch/latest/arch-design.yaml` が存在しないか空）: `arch-design.yaml` に全セクション完全版を出力する
- **差分更新モード**（既存スナップショットあり）: `arch-design-diff.yaml` に変更セクションのみを出力する。マージキー・追加/変更/削除の扱いは `references/event-sourcing-rules.md` を参照

`arch-schema.md` に従い、対象セクション（technology_context, system_architecture, app_architecture, data_architecture）を生成する。

#### 生成ルール

##### 初期構築モード（arch-design.yaml）

- 全ティア・全レイヤー・全エンティティを含める（省略しない）

##### 差分更新モード（arch-design-diff.yaml）

- 変更があったセクションのみ含める
- マージキーで照合される単位（tier.id / tier_layers.tier_id / entities.name / policies.name 等）で部分出力する
- 削除対象は `_changes.md` の削除セクションで管理する（diff yaml 内には削除フラグを置かない）
- `meta:` ブロックに `event_id`, `trigger_event`, `created_at` を含める（`event-sourcing-rules.md` の例参照）

##### 共通ルール
- 各方針/ルールに以下を設定:
  - `id`: プレフィックス付き連番（SP-001, SR-001, CTP-001 等）
  - `name`: 方針/ルール名（日本語）
  - `description`: 内容の説明
  - `reason`: 決定根拠
  - `source_model`: 根拠となった RDRA/NFR 要素（推論元がない場合は null）
  - `confidence`: 確信度
- Mermaid 図は `diagram_mermaid` フィールドに YAML ブロックスカラー（`|`）で格納
- テクノロジー候補はベンダーニュートラルな用語のみ
- 全ての policy/rule の `source_model` に、根拠となった NFR メトリクス ID を `"NFR {ID}"` 形式で明記する（例: `"NFR A.1.1.1"`）。複数の場合はカンマ区切り
- 推論元がない場合は `"なし"` を設定する（null は使用しない）
- カバレッジレポートで全重要 NFR メトリクスがカバーされることを目標とする

#### reason の記述ルール

- RDRA 推論の場合: 「BUC「{BUC名}」に{特徴}があるため」「情報「{名前}」が{特徴}のため」
- NFR 推論の場合: 「NFR {カテゴリ}{ID} {name}(Lv{N}) への対応」
- ユーザー指定の場合: 「ユーザー指定: {指定理由}」
- デフォルトの場合: 「一般的なベストプラクティスとして適用」

### 3. _inference.md の生成

推論根拠サマリを `arch-inference-rules.md` の出力形式に従い生成する:

```markdown
# アーキテクチャ推論根拠サマリ

- event_id: {event_id}
- created_at: {created_at}

## RDRA/NFR モデル分析結果

### 分析した RDRA 要素

| モデル | 要素数 | 主な特徴 |
|--------|--------|---------|
| BUC | {N} | {特徴} |
| アクター | {N} | {特徴} |
| 外部システム | {N} | {特徴} |
| 情報 | {N} | {特徴} |
| 状態 | {N} | {特徴} |
| 条件 | {N} | {特徴} |

### 参照した NFR グレード

| カテゴリ | 平均Lv | 主な影響 |
|---------|--------|---------|
| A. 可用性 | {N} | {影響} |
| B. 性能・拡張性 | {N} | {影響} |
| C. 運用・保守性 | {N} | {影響} |
| D. セキュリティ | {N} | {影響} |
| E. 移行性 | {N} | {影響} |
| F. 環境 | {N} | {影響} |

## 設計判断サマリ

### システムアーキテクチャ

| ティア | テクノロジー候補 | confidence | 根拠 |
|--------|----------------|-----------|------|
| {tier} | {candidates} | {conf} | {reason} |

### アプリケーションアーキテクチャ

(ティアごとのレイヤー表)

### データアーキテクチャ

| エンティティ | ストレージ | confidence | 根拠 |
|-------------|----------|-----------|------|
| {entity} | {storage} | {conf} | {reason} |

## ユーザー確認による変更

| 対象 | 項目 | 推論値 | 確定値 | 変更理由 |
|------|------|--------|--------|---------|
| ... | ... | ... | ... | ... |

## confidence 内訳

| セクション | high | medium | low | default | user | 合計 |
|-----------|:----:|:------:|:---:|:-------:|:----:|:----:|
| システムアーキテクチャ | {N} | {N} | {N} | {N} | {N} | {N} |
| アプリケーションアーキテクチャ | {N} | {N} | {N} | {N} | {N} | {N} |
| データアーキテクチャ | {N} | {N} | {N} | {N} | {N} | {N} |
| 合計 | {N} | {N} | {N} | {N} | {N} | {N} |
```

### 4. source.txt の生成

トリガーの説明を記録する:

- 初期構築: 「RDRA モデルと NFR グレードからの初期アーキテクチャ設計」
- 差分更新: 「RDRA 差分 {rdra_event_id} に基づくアーキテクチャ再評価」
- NFR 変更起因: 「NFR 変更 {nfr_event_id} に基づくアーキテクチャ再評価」
- 手動更新: 「ユーザー要望によるアーキテクチャ設計更新」

### 5. ファイル出力

モードに応じて以下のファイルを生成する:

#### 初期構築モード

```
docs/arch/events/{event_id}/
  arch-design.yaml      # 全セクションの完全なアーキテクチャ設計
  _inference.md          # 推論根拠サマリ
  source.txt             # トリガー説明
```

#### 差分更新モード

```
docs/arch/events/{event_id}/
  arch-design-diff.yaml  # 変更セクションのみ
  _changes.md            # 追加/変更/削除の明細
  _inference.md          # 推論根拠サマリ
  source.txt             # トリガー説明
```

`_changes.md` のフォーマットは `references/event-sourcing-rules.md` を参照。

### 6. 決定記録生成

対話で確定した設計判断を決定記録（Decision Record）として YAML ファイルに出力する。

#### 出力先

```
docs/arch/events/{event_id}/decisions/
  arch-decision-001.yaml
  arch-decision-002.yaml
  ...
```

#### 決定記録のフォーマット

```yaml
schema_version: "1.0"
artifact_type: "decision_record"
skill_type: "architecture"
artifact_id: "arch-decision-{NNN}"
title: "判断タイトル"
status: "approved"
generated_at: "{created_at と同じタイムスタンプ}"
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

`generated_at` にはイベントの `created_at` と同じタイムスタンプを使用する。

#### 記録すべき決定カテゴリ

以下のカテゴリから、該当する判断を全て記録する。1イベントにつき少なくとも1つの決定記録を生成すること。Phase 番号は新対話順序（Phase 0 ドメイン → Phase 1 テクノロジー → Phase 2 システム → Phase 3 アプリ → Phase 4 データ → Phase 5 最終）に従う。

| カテゴリ | 内容 | 対応する対話 Phase |
|---------|------|-------------------|
| サブドメイン分類 | Subdomain.type（Core/Supporting/Generic）の選定理由、投資配分方針 | Phase 0.1 |
| BC 設計 | 境界づけられたコンテキストの分割理由、ユビキタス言語、team_ownership | Phase 0.2 |
| コンテキストマップ統合方式 | BC 間の統合パターン（ACL/OHS/Conformist 等）選定理由 | Phase 0.3 |
| 集約境界仮説 | aggregate root / member / invariants の仮説。仮説止まりであることを明記 | Phase 0.4 |
| テクノロジースタック選定 | 言語・FW の選択理由 | Phase 1 |
| BC : tier 対応形態 | モノリス / モジュラモノリス / マイクロサービス の選定理由 | Phase 2 冒頭 |
| ティアパターン選定 | CaaS vs FaaS 等、ティアごとの選定理由 | Phase 2 |
| 認証方式選定 | OAuth2/OIDC の採用理由 | Phase 2 |
| レイヤリング戦略 | 凹型 vs 直接依存 等 | Phase 3 |
| データモデル戦略 | event_snapshot vs resource_mutable の使い分け基準 | Phase 4 |

##### ドメインアーキテクチャ系の決定記録の特記事項

「サブドメイン分類」「BC 設計」「集約境界仮説」の決定記録は以下の点を明記する:

- **`context`**: なぜこの判断が経営判断またはドメイン判断を含むのか（RDRA から自動推論できない理由）
- **`decision`**: 採用した分類 / 境界 / 仮説の具体内容と confidence（特に「集約境界仮説」は `low` 確定）
- **`alternatives_considered`**: Phase 0 の対話で提示した Option B / Option C を必ず代替案として記載
- **集約境界仮説の `consequences.negative`**: 「これは戦略段階の仮説であり、最終確定は dist-spec or ddd-tactical-implementation で行う」旨を明記

#### 生成ルール

- `artifact_id` は `arch-decision-001` から連番
- `title` は日本語で簡潔に（例: 「TypeScript 統一スタック採用」「API ティアに CaaS(k8s) を選定」）
- `context` には問題の背景と制約を記述する
- `decision` には判断内容と根拠を記述する
- `consequences.positive` / `consequences.negative` はそれぞれ文字列の配列
- `alternatives_considered` には検討した代替案と不採用理由を記載する（代替案がない場合は空配列）
- ユーザーが対話で変更した項目は特に重要な決定記録として記録する

### 7. バリデーション

> **既知の制約（TODO）**: 現状の `validateArchDesign.js` は **完全版スキーマ（`arch-design.yaml`）** のみを正式サポートする。`arch-design-diff.yaml`（差分モード）に対しても同じスキーマで検証するため、必須トップレベルキーが欠落していると ERROR になる。差分専用スキーマ（部分構造を許容）への分離は将来 PR で対応する。当面の運用は以下:
>
> - **差分モードのバリデーション**: validator にかける前に、`latest/arch-design.yaml` とマージしてから検証する（マージ後の yaml は完全版）
> - **直接 diff yaml を検証したい場合**: `--mode=diff` オプションで起動するが、現状は構造チェックの一部のみ機能する
> - 詳細トラッキング: `docs/todo.md`（dist-architecture: diff schema 分離）

出力後、スキーマバリデータを実行して arch-design.yaml の構造を検証する:

```bash
node <skill-path>/scripts/validateArchDesign.js docs/arch/events/{event_id}/arch-design.yaml
```

- 終了コード 0（PASS）: Markdown 生成へ進む
- 終了コード 1（FAIL）: エラー内容を確認し、arch-design.yaml を修正してから再度バリデーション

`<skill-path>` は `${CLAUDE_PLUGIN_ROOT}/skills/dist-architecture`。

### 8. Markdown 表の生成

バリデーション通過後、Markdown を生成する。生成対象はモードによって異なる。

- **初期構築モード**: events 配下の完全版 yaml を Markdown 化する

  ```bash
  node <skill-path>/scripts/generateArchDesignMd.js docs/arch/events/{event_id}/arch-design.yaml
  ```

  これにより `docs/arch/events/{event_id}/arch-design.md` が生成される。

- **差分更新モード**: events 配下には diff yaml のみ存在し全量 Markdown は生成しない。Markdown はスナップショット更新後に `latest/arch-design.yaml`（マージ結果）から生成する（次の Step 9 参照）。

このスクリプトは決定論的（同一入力 → 同一出力）なため、LLM に依存せずバンドルスクリプトで実行する。

### 9. スナップショット更新

`references/arch/arch-snapshot-update.md` に従い、`docs/arch/latest/` を更新する。

スナップショット更新後、latest にも Markdown を生成する:

```bash
node <skill-path>/scripts/generateArchDesignMd.js docs/arch/latest/arch-design.yaml
```

スナップショット更新時、`decisions/` ディレクトリは **`artifact_id` 単位の upsert（マージ）** で更新する。**全置換ではない**（過去イベントで確定した有効な判断を破壊しないため）。詳細は `references/event-sourcing-rules.md`「decisions/ のスナップショット更新」を参照。

## 出力ファイル一覧

### 初期構築モード

| ファイル | 内容 |
|---------|------|
| `docs/arch/events/{event_id}/arch-design.yaml` | イベント: 完全なアーキテクチャ設計 |
| `docs/arch/events/{event_id}/arch-design.md` | イベント: Markdown 表現 |
| `docs/arch/events/{event_id}/_inference.md` | イベント: 推論根拠サマリ |
| `docs/arch/events/{event_id}/source.txt` | イベント: トリガー説明 |
| `docs/arch/events/{event_id}/decisions/arch-decision-{NNN}.yaml` | イベント: 決定記録（1つ以上） |
| `docs/arch/latest/arch-design.yaml` | スナップショット: 最新アーキテクチャ設計 |
| `docs/arch/latest/arch-design.md` | スナップショット: 最新 Markdown |
| `docs/arch/latest/decisions/arch-decision-{NNN}.yaml` | スナップショット: 最新決定記録 |

### 差分更新モード

| ファイル | 内容 |
|---------|------|
| `docs/arch/events/{event_id}/arch-design-diff.yaml` | イベント: 変更セクションのみ |
| `docs/arch/events/{event_id}/_changes.md` | イベント: 追加/変更/削除の明細 |
| `docs/arch/events/{event_id}/_inference.md` | イベント: 推論根拠サマリ |
| `docs/arch/events/{event_id}/source.txt` | イベント: トリガー説明 |
| `docs/arch/events/{event_id}/decisions/arch-decision-{NNN}.yaml` | イベント: 決定記録（差分起因のもの） |
| `docs/arch/latest/arch-design.yaml` | スナップショット: マージ後の最新設計 |
| `docs/arch/latest/arch-design.md` | スナップショット: 最新 Markdown |
| `docs/arch/latest/decisions/arch-decision-{NNN}.yaml` | スナップショット: 最新決定記録 |

## 注意事項

- 初期構築時は arch-design.yaml に全セクションを含める。差分更新時は arch-design-diff.yaml に変更セクションのみ含める（部分出力は差分モードのみ許可）
- YAML の文字列はダブルクォートで囲む
- 日本語の文字列は UTF-8
- null は YAML の null（クォートなし）
- Mermaid 図は YAML ブロックスカラー（`|`）で格納する
- テクノロジー候補にクラウドベンダー固有のサービス名を含めない
