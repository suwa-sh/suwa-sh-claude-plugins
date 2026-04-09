---
name: quality-attributes
description: >
  RDRA モデルから IPA 非機能要求グレードを推論・対話・出力するスキル。
  requirements スキルで構築した RDRA モデル（docs/rdra/latest/）を入力とし、
  6大項目（可用性・性能・運用・移行・セキュリティ・環境）のグレードを自動推論。
  対話で確認・調整し、nfr-grade.yaml として出力する。
  イベントソーシングで履歴管理し、将来のシステムアーキテクチャ設計への入力となる。
  「非機能要求を整理」「NFRグレードを作成」「非機能要件を定義」「可用性・性能要件」などで発動。
---

# 非機能要求グレードスキル

RDRA モデルから IPA 非機能要求グレード 2018 に基づき、非機能要求を推論・対話・出力する。

## 前提条件

- `docs/rdra/latest/*.tsv` が存在すること（requirements スキル実行済み）
- `docs/rdra/latest/システム概要.json` が存在すること

## ディレクトリ構成

```
docs/
  nfr/
    events/{event_id}/
      nfr-grade.yaml       # 初期構築時: 全メトリクスの完全版
      nfr-grade-diff.yaml  # 差分更新時: 変更メトリクスのみ
      _changes.md           # 変更サマリ（追加/変更/削除）
      _inference.md         # 推論根拠サマリ
      source.txt            # トリガー説明
    latest/
      nfr-grade.yaml        # 最新スナップショット（マージ結果）
      nfr-grade.md          # Markdown 表現
```

## 全体フロー

```
docs/rdra/latest/*.tsv（RDRA モデル）
  → Step1: RDRA モデルから NFR 推論（自動マッピング）
  → Step2: 対話で確認・調整（モデルシステム選定 + グレード調整）
  → Step3: NFR グレード表 YAML 出力（イベント記録 + スナップショット更新）
```

## モード判定

パイプライン開始時に `docs/nfr/latest/nfr-grade.yaml` の状態を確認する:

- **初期構築モード**: `docs/nfr/latest/nfr-grade.yaml` が存在しないか空
  → Step1-3 をフル実行（全メトリクスを推論）
- **差分更新モード**: `docs/nfr/latest/nfr-grade.yaml` が存在する
  → RDRA 差分に基づき関連項目のみ再推論、差分を対話で確認

---

## Step1: RDRA モデルからの NFR 推論

RDRA モデルを読み取り、非機能要求グレードを推論する。

### 共通コンテキスト

以下のファイルを読み込んで理解する:

- `references/nfr-grade-catalog.md` — IPA 非機能要求グレード 6大項目カタログ
- `references/nfr-inference-rules.md` — RDRA → NFR 推論ルール
- `references/nfr-grade-schema.md` — NFR グレード YAML スキーマ
- `docs/rdra/latest/*.tsv` — 現在の RDRA モデル（全ファイル）
- `docs/rdra/latest/システム概要.json` — システム概要
- `docs/nfr/latest/nfr-grade.yaml`（差分更新モード時のみ）— 既存の NFR グレード

### タスク

`references/nfr/nfr-infer.md` に従い、RDRA モデルから NFR グレードを推論する。

### 出力

このステップではファイル出力を行わない。推論結果を内部データとして保持し、Step2 に渡す。

---

## Step2: 対話による NFR グレード確認・調整

Step1 の推論結果をユーザーに提示し、対話で確認・調整する。

### タスク

`references/nfr/nfr-dialogue.md` に従い、以下の順で対話を行う:

1. **モデルシステムの確認**: model1/model2/model3 の推定結果を提示し確認
2. **重要項目の確認**: confidence が high/medium の重要メトリクスをカテゴリ別に提示
3. **要確認項目のヒアリング**: 推論不能項目（移行性、環境等）をヒアリング
4. **最終確認**: 確定内容のサマリを提示

### 出力

対話で確定した NFR グレード情報を Step3 に渡す。ファイル出力はこのステップでは行わない。

---

## Step3: NFR グレード表 YAML 出力

確定した NFR グレードを YAML ファイルとして出力し、イベント記録 + スナップショット更新を行う。

### 共通コンテキスト

- `references/nfr-grade-schema.md` — 出力スキーマ
- `references/event-sourcing-rules.md` — イベントソーシングルール

### タスク

`references/nfr/nfr-grade-output.md` に従い、以下を生成する:

1. イベント ID の生成（`date '+%Y%m%d_%H%M%S'` コマンドでタイムスタンプ取得）
2. trigger_event の特定（前段 RDRA イベント ID を `rdra:{rdra_event_id}` 形式で記録）
3. **初期構築時**: `nfr-grade.yaml`（全6大項目・全メトリクス含む完全版）を events/ に記録
4. **差分更新時**: `nfr-grade-diff.yaml`（変更メトリクスのみ）を events/ に記録
5. `_changes.md` の生成（追加/変更/削除を明記。trigger_event を含む）
6. `_inference.md` の生成（推論根拠サマリ）
7. `source.txt` の生成（トリガー説明）

### 出力

#### 初期構築時

- `docs/nfr/events/{event_id}/nfr-grade.yaml`（完全版）
- `docs/nfr/events/{event_id}/_changes.md`
- `docs/nfr/events/{event_id}/_inference.md`
- `docs/nfr/events/{event_id}/source.txt`

#### 差分更新時

- `docs/nfr/events/{event_id}/nfr-grade-diff.yaml`（変更メトリクスのみ）
- `docs/nfr/events/{event_id}/_changes.md`
- `docs/nfr/events/{event_id}/_inference.md`
- `docs/nfr/events/{event_id}/source.txt`

### バリデーション

出力後、スキーマバリデータを実行して nfr-grade.yaml の構造を検証する:

```bash
node <skill-path>/scripts/validateNfrGrade.js docs/nfr/events/{event_id}/nfr-grade.yaml
```

- 終了コード 0（PASS）: スナップショット更新へ進む
- 終了コード 1（FAIL）: エラー内容を確認し、nfr-grade.yaml を修正してから再度バリデーションを実行する

`<skill-path>` は本スキルのディレクトリパス（`${CLAUDE_PLUGIN_ROOT}/skills/quality-attributes`）。

### Markdown 表の生成

バリデーション通過後、nfr-grade.yaml を IPA 非機能要求グレード活用シート形式の Markdown 表に変換する:

```bash
node <skill-path>/scripts/generateNfrGradeMd.js docs/nfr/events/{event_id}/nfr-grade.yaml
```

これにより `docs/nfr/events/{event_id}/nfr-grade.md` が生成される。このスクリプトは決定論的（同一入力 → 同一出力）なため、LLM に依存せずバンドルスクリプトで実行する。

### スナップショット更新

`references/nfr/nfr-snapshot-update.md` および `references/event-sourcing-rules.md` に従い、`docs/nfr/latest/nfr-grade.yaml` を更新する。

- **初期構築時**: `events/{event_id}/nfr-grade.yaml`（完全版）を `latest/nfr-grade.yaml` にコピーする
- **差分更新時**: `events/{event_id}/nfr-grade-diff.yaml` の変更メトリクスを `latest/nfr-grade.yaml` にマージする
  - マージキー: `category` + `subcategory` + `metric_id`
  - `confidence: "user"` のメトリクスは上書きしない（ユーザー確定値を保護）
  - `_changes.md` の削除セクションに記載されたメトリクスを latest から除去

スナップショット更新後、latest にも Markdown 表を生成する:

```bash
node <skill-path>/scripts/generateNfrGradeMd.js docs/nfr/latest/nfr-grade.yaml
```

---

## subagent への指示テンプレート

Step1 は RDRA モデルの読み込みと推論を行うため、メインエージェントが直接実行する。
Step2 は対話が必要なため、メインエージェントが直接実行する。
Step3 は以下のパターンで subagent に委譲可能。

### Step3 例: NFR グレード出力

```
以下のファイルを順に読み込んで理解してください:

1. スキーマ定義
   - references/nfr-grade-schema.md
   - references/event-sourcing-rules.md

2. タスク指示
   - references/nfr/nfr-grade-output.md

3. 確定データ
   以下の NFR グレード情報を nfr-grade.yaml として出力してください:
   {Step2 で確定した NFR グレードデータ}

質問や確認は不要です。指示に従い即座に実行してください。
```

---

## 出力チェック

パイプライン完了後、以下を確認する:

- 初期構築時: `docs/nfr/events/{event_id}/nfr-grade.yaml` が存在すること
- 差分更新時: `docs/nfr/events/{event_id}/nfr-grade-diff.yaml` が存在すること
- `docs/nfr/events/{event_id}/_changes.md` が存在すること
- `docs/nfr/events/{event_id}/_inference.md` が存在すること
- `docs/nfr/events/{event_id}/source.txt` が存在すること
- `docs/nfr/latest/nfr-grade.yaml` が最新スナップショットであること
- `docs/nfr/latest/nfr-grade.md` が存在すること
- バリデーションスクリプトが PASS すること

## 完了報告（ユーザー向けサマリ）

タスク完了時、ユーザーに以下の項目を**必ず**含めた完了報告を提示する。pipeline スキルの Step 2 対話スキップ検知と連動する:

- 生成/更新した nfr-grade.yaml のパス
- **確認推奨項目: N 件（low=X, medium=Y）** — confidence が low/medium の項目、または自動推論（RDRA 推定・M2 デフォルト等）で埋めた項目の件数
- 主要な確認推奨項目（上位 5 件程度）: 項目名・推論値・confidence・推論根拠の 1 行要約
- 件数が 0 の場合はその旨を明記する

件数が 1 件以上ある場合は、pipeline オーケストレータが対話フローを発火する前提で、そのまま結果に含めて返すこと（AskUserQuestion は使わない）。
