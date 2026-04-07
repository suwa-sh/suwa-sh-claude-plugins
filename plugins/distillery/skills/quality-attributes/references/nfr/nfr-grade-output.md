# Step3: NFR グレード表 YAML 出力

対話で確定した NFR グレードを YAML ファイルとして出力し、イベント記録 + スナップショット更新を行うタスク。

## 入力

- Step2 で確定した NFR グレード情報（内部データ）
- `references/nfr-grade-schema.md` — 出力スキーマ
- `references/event-sourcing-rules.md` — イベントソーシングルール

## タスク手順

### 1. イベント ID の生成

形式: `{YYYYMMDD_HHMMSS}_{変更名}`

**日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない。** `created_at` も同じタイミングで `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得する。

- 初期構築: `{timestamp}_initial_nfr`
- RDRA 差分起因: `{timestamp}_nfr_update_for_{rdra_event_id}`
- 手動更新: `{timestamp}_nfr_manual_update`

### 2. nfr-grade.yaml の生成

`nfr-grade-schema.md` に従い、全6大項目・全メトリクスを含む完全な YAML を生成する。

#### 生成ルール

- 全カテゴリ（A〜F）を順序通りに含める
- 全中項目・小項目・メトリクスを含める（省略しない）
- 各メトリクスに以下を設定:
  - `grade`: 確定レベル（0〜5）
  - `reason`: レベル決定根拠（日本語、1文）
  - `source_model`: 根拠となった RDRA モデル要素（推論元がない場合は null）
  - `confidence`: 確信度

#### reason の記述ルール

- RDRA 推論の場合: 「BUC「{BUC名}」が{特徴}のため」「情報「{情報名}」に{属性}が含まれるため」
- ユーザー指定の場合: 「ユーザー指定: {指定理由}」
- デフォルトの場合: 「モデルシステム{N}のデフォルト値を適用」

### 3. _inference.md の生成

推論根拠サマリを以下の形式で生成する:

```markdown
# NFR 推論根拠サマリ

- event_id: {event_id}
- created_at: {created_at}
- model_system: {type} (confidence: {confidence})
- model_system_reason: {reason}

## RDRA モデル分析結果

### 分析した RDRA 要素

| モデル | 要素数 | 主な特徴 |
|--------|--------|---------|
| BUC | {N} | {特徴} |
| アクター | {N} | {特徴} |
| 外部システム | {N} | {特徴} |
| 情報 | {N} | {特徴} |
| 状態 | {N} | {特徴} |
| 条件 | {N} | {特徴} |

## カテゴリ別推論結果

### A. 可用性

| ID | メトリクス | Lv | confidence | 根拠 |
|----|----------|-----|-----------|------|
| A.1.1.1 | 運用時間（通常） | 3 | high | BUC「〜」 |
| ... | ... | ... | ... | ... |

### B. 性能・拡張性
（同形式で全カテゴリ）

## ユーザー確認による変更

| ID | メトリクス | 推論Lv | 確定Lv | 変更理由 |
|----|----------|--------|--------|---------|
| ... | ... | ... | ... | ... |

## デフォルト適用項目数

| カテゴリ | 推論確定 | ユーザー確定 | デフォルト | 合計 |
|---------|---------|------------|----------|------|
| A. 可用性 | {N} | {N} | {N} | {N} |
| ... | ... | ... | ... | ... |
| 合計 | {N} | {N} | {N} | 238 |
```

### 4. source.txt の生成

トリガーの説明を記録する:

- 初期構築: 「RDRA モデルからの初期 NFR グレード構築」
- 差分更新: 「RDRA 差分 {rdra_event_id} に基づく NFR 再評価」
- 手動更新: 「ユーザー要望による NFR グレード更新」

### 5. ファイル出力

以下のファイルを生成する:

```
docs/nfr/events/{event_id}/
  nfr-grade.yaml       # 全カテゴリの完全な NFR グレード
  _inference.md         # 推論根拠サマリ
  source.txt            # トリガー説明
```

### 6. バリデーション

出力後、スキーマバリデータを実行して nfr-grade.yaml の構造を検証する:

```bash
node <skill-path>/scripts/validateNfrGrade.js docs/nfr/events/{event_id}/nfr-grade.yaml
```

- 終了コード 0（PASS）: スナップショット更新へ進む
- 終了コード 1（FAIL）: エラー内容を確認し、nfr-grade.yaml を修正してから再度バリデーション

`<skill-path>` は `${CLAUDE_PLUGIN_ROOT}/skills/quality-attributes`。

### 7. Markdown 表の生成

バリデーション通過後、nfr-grade.yaml を IPA 非機能要求グレード活用シート形式の Markdown 表に変換する:

```bash
node <skill-path>/scripts/generateNfrGradeMd.js docs/nfr/events/{event_id}/nfr-grade.yaml
```

これにより `docs/nfr/events/{event_id}/nfr-grade.md` が生成される。このスクリプトは決定論的（同一入力 → 同一出力）なため、LLM に依存せずバンドルスクリプトで実行する。

### 8. スナップショット更新

`references/nfr/nfr-snapshot-update.md` に従い、`docs/nfr/latest/nfr-grade.yaml` を更新する。

スナップショット更新後、latest にも Markdown 表を生成する:

```bash
node <skill-path>/scripts/generateNfrGradeMd.js docs/nfr/latest/nfr-grade.yaml
```

## 出力ファイル一覧

| ファイル | 内容 |
|---------|------|
| `docs/nfr/events/{event_id}/nfr-grade.yaml` | イベント: 完全な NFR グレード |
| `docs/nfr/events/{event_id}/_inference.md` | イベント: 推論根拠サマリ |
| `docs/nfr/events/{event_id}/source.txt` | イベント: トリガー説明 |
| `docs/nfr/latest/nfr-grade.yaml` | スナップショット: 最新 NFR グレード |

## 注意事項

- nfr-grade.yaml は全238メトリクスを含む完全版であること（部分出力は不可）
- YAML の文字列はダブルクォートで囲む
- 日本語の文字列は UTF-8
- grade の値は整数（0〜5）
- null は YAML の null（クォートなし）
