# Step3: NFR グレード表 YAML 出力

Step2 で確定した NFR グレードを単一の YAML スナップショットとして出力するタスク。履歴は Git で管理するため、イベント記録やスナップショットのマージは行わない。
Step2 が auto-adopt モードなら推奨値を自動採用した結果（仮採用は `confidence: low`）、対話モードなら対話で確定した結果を入力とする。

## 入力

- Step2 で確定した NFR グレード情報（内部データ。auto-adopt / 対話のいずれか）
- `references/nfr-grade-schema.md` — 出力スキーマ（v2）

## タスク手順

### 1. basis のスタンプ

`scripts/lib/basis.js` で、この評価が基にした上流コミットを 1 行の文字列として取得する:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/lib/basis.js stamp requirements=docs/requirements
```

出力（例: `basis: requirements@<sha>`）を nfr-grade.yaml の先頭フィールド `basis` に転記する。

### 2. nfr-grade.yaml の生成

`nfr-grade-schema.md` に従い、全6大項目・全メトリクスを含む完全な YAML を生成する。

#### 生成ルール

- **先頭フィールドは `basis`**（Step1 でスタンプした `requirements@<sha>`）
- 続いて `version: "2.0"`、`model_system`、`categories`
- 全カテゴリ（A〜F）を順序通りに含める
- 全中項目・小項目・メトリクスを含める（省略しない）
- 各メトリクスに以下を設定:
  - `grade`: 確定レベル（0〜5）
  - `reason`: レベル決定根拠（日本語、1文）
  - `source_model`: 根拠となった RDRA モデル要素（推論元がない場合は空文字列 `""`）
  - `confidence`: 確信度

#### reason の記述ルール

- RDRA 推論の場合: 「BUC「{BUC名}」が{特徴}のため」「情報「{情報名}」に{属性}が含まれるため」
- ユーザー指定の場合: 「ユーザー指定: {指定理由}」
- デフォルトの場合: 「モデルシステム{N}のデフォルト値を適用」

### 3. バリデーション

出力後、スキーマバリデータを実行して nfr-grade.yaml の構造を検証する:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/validateNfrGrade.js docs/nfr/nfr-grade.yaml
```

- 終了コード 0（PASS）: Markdown 生成へ進む
- 終了コード 1（FAIL）: エラー内容を確認し、nfr-grade.yaml を修正してから再度バリデーション

### 4. Markdown 表の生成

バリデーション通過後、nfr-grade.yaml を IPA 非機能要求グレード活用シート形式の Markdown 表に変換する:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/generateNfrGradeMd.js docs/nfr/nfr-grade.yaml
```

これにより `docs/nfr/nfr-grade.md` が生成される。このスクリプトは決定論的（同一入力 → 同一出力）なため、LLM に依存せずバンドルスクリプトで実行する。

## 出力ファイル一覧

| ファイル | 内容 |
|---------|------|
| `docs/nfr/nfr-grade.yaml` | 完全な NFR グレード（basis を先頭に持つ） |
| `docs/nfr/nfr-grade.md` | nfr-grade.yaml から生成した Markdown 表 |

## 注意事項

- nfr-grade.yaml はカタログの全メトリクス（validateNfrGrade が件数を検査する）を含む完全版であること（部分出力は不可）
- 先頭フィールドは必ず `basis`
- YAML の文字列はダブルクォートで囲む
- 日本語の文字列は UTF-8
- grade の値は整数（0〜5）
- 履歴はイテレーション 1 では持たない（差分モードは次イテレーション）。過去の版は Git のコミット履歴で追う
