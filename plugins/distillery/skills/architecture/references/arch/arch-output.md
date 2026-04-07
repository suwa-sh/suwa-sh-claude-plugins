# Step3: アーキテクチ���設計 YAML 出力

対話で確定したアー��テクチャ設計を YAML ファイルとして出力し、イベント記録 + スナップショット更新を行うタスク。

## 入力

- Step2 で確定したアーキテクチャ設計情報（内部データ）
- `references/arch-schema.md` — 出��スキーマ
- `references/event-sourcing-rules.md` — イベントソーシングルール

## タスク手順

### 1. イベント ID の生成

形式: `{YYYYMMDD_HHMMSS}_{変更名}`

**日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない。** `created_at` も同じタイミングで `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得する。

- 初期構築: `{timestamp}_initial_arch`
- RDRA 差分起因: `{timestamp}_arch_update_for_{rdra_event_id}`
- NFR 変更起因: `{timestamp}_arch_update_for_nfr_{nfr_event_id}`
- 手動更新: `{timestamp}_arch_manual_update`

### 2. arch-design.yaml の生成

`arch-schema.md` に従い、全セクション（technology_context, system_architecture, app_architecture, data_architecture）を含む完全な YAML を生成する。

#### 生成ルール

- 全ティア・全レイヤー・全エンティティを含める（省略しない）
- 各方針/ルールに以下を設定:
  - `id`: プレフィックス付き連番（SP-001, SR-001, CTP-001 等）
  - `name`: 方針/ルール名（日本語）
  - `description`: 内容の説明
  - `reason`: 決定根拠
  - `source_model`: 根拠となった RDRA/NFR 要素（推論元がない場合は null）
  - `confidence`: 確信度
- Mermaid 図は `diagram_mermaid` フィールドに YAML ブロックスカラー（`|`）で格納
- テクノロジー候補は��ンダーニュートラルな用語のみ
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
# アーキテ���チャ推論根拠サマリ

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

以下のファイルを生成する:

```
docs/arch/events/{event_id}/
  arch-design.yaml      # 全セクションの完全なアーキテクチャ設計
  _inference.md          # 推論根拠サマリ
  source.txt             # トリガー説明
```

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

以下のカテゴリから、該当する判断を全て記録する。1イベントにつき少なくとも1つの決定記録を生成すること。

| カテゴリ | 内容 | 対応する対話 Phase |
|---------|------|-------------------|
| テクノロジースタック選定 | 言語・FW の選択理由 | Phase 0 |
| ティアパターン選定 | CaaS vs FaaS 等、ティアごとの選定理由 | Phase 1 |
| データモデル戦略 | event_snapshot vs resource_mutable の使い分け基準 | Phase 3 |
| 認証方式選定 | OAuth2/OIDC の採用理由 | Phase 1 |
| レイヤリング戦略 | 凹型 vs 直接依存 等 | Phase 2 |

#### 生成ルール

- `artifact_id` は `arch-decision-001` から連番
- `title` は日本語で簡潔に（例: 「TypeScript 統一スタック採用」「API ティアに CaaS(k8s) を選定」）
- `context` には問題の背景と制約を記述する
- `decision` には判断内容と根拠を記述する
- `consequences.positive` / `consequences.negative` はそれぞれ文字列の配列
- `alternatives_considered` には検討した代替案と不採用理由を記載する（代替案がない場合は空配列）
- ユーザーが対話で変更した項目は特に重要な決定記録として記録する

### 7. バリデーション

出力後、スキーマバリデータを実行して arch-design.yaml の構造を検証する:

```bash
node <skill-path>/scripts/validateArchDesign.js docs/arch/events/{event_id}/arch-design.yaml
```

- 終了コード 0（PASS）: Markdown 生成へ進む
- ���了コード 1（FAIL）: エラー内容を確認し、arch-design.yaml を修正してから再度バリデーション

`<skill-path>` は `${CLAUDE_PLUGIN_ROOT}/skills/architecture`。

### 8. Markdown 表の生成

バリデーション通過後、arch-design.yaml を Markdown 形式に変換する:

```bash
node <skill-path>/scripts/generateArchDesignMd.js docs/arch/events/{event_id}/arch-design.yaml
```

これにより `docs/arch/events/{event_id}/arch-design.md` が生成される。このスクリプトは決定論的（同一入力 → 同一出力）なため、LLM に依存せずバンドルスクリプトで実行する。

### 9. スナップショット更新

`references/arch/arch-snapshot-update.md` に従い、`docs/arch/latest/` を更新する。

スナップショット更新後、latest にも Markdown を生成する:

```bash
node <skill-path>/scripts/generateArchDesignMd.js docs/arch/latest/arch-design.yaml
```

スナップショット更新時、`decisions/` ディレクトリも `events/{event_id}/decisions/` から `latest/decisions/` に全置換でコピーする（マージではなく全置換）。

## 出力ファイル一覧

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

## 注意事項

- arch-design.yaml は全セクションを含む完全版であること（部分出力は不可）
- YAML の文字列はダブルクォートで囲む
- 日本語の文字列は UTF-8
- null は YAML の null（クォートなし）
- Mermaid 図は YAML ブロックスカラー（`|`）で格納する
- テクノロジー候補にクラウドベンダー固有のサービス名を含めない
