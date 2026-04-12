---
name: dist-architecture
description: >
  RDRA モデルと NFR グレードからアーキテクチャ設計を推論・対話・出力するスキル。
  requirements スキルの RDRA モデル（docs/rdra/latest/）と
  quality-attributes スキルの NFR グレード（docs/nfr/latest/nfr-grade.yaml）を入力とし、
  システムアーキテクチャ（ティア構成・IdP・認可サービス・API Gateway）、
  アプリケーションアーキテクチャ（presentation/usecase/domain/gateway の4層設計・ロギング方針）、
  データアーキテクチャ（イミュータブルデータモデル・概念モデル・ストレージマッピング）を自動推論。
  クラウドデザインパターン（Circuit Breaker, Saga, CQRS 等）の適用判断、
  認可モデル選定（RBAC/ABAC/ReBAC）、ログ出力方針（レイヤー別ログカテゴリ）も含む。
  対話で確認・調整し、arch-design.yaml + coverage-report.md として出力する。
  全テクノロジー記述はベンダーニュートラル（FaaS, CaaS(k8s), RDB 等）。
  図解は全て Mermaid graph。イベントソーシングで履歴管理する。
  「アーキテクチャ設計」「システム構成を設計」「ティア構成」「レイヤ設計」
  「データモデル設計」「アプリケーション構成」「概念モデルを作成」
  「認証認可の設計」「IdP の選定」「認可モデルを選びたい」
  「ログ出力方針」「イミュータブルデータモデル」「クラウドデザインパターン」
  「非機能要求からアーキテクチャ」などで発動。
  RDRA や NFR からアーキテクチャを導出したい場合にも積極的に使うこと。
---

# アーキテクチャ設計スキル

RDRA モデルと NFR グレードからシステム・アプリケーション・データアーキテクチャを推論・対話・出力する。
全テクノロジー記述はベンダーニュートラル。クラウドベンダーへのマッピングは後続の別スキルの責務。

## 前提条件

- `docs/rdra/latest/*.tsv` が存在すること（requirements スキル実行済み）
- `docs/rdra/latest/システム概要.json` が存在すること
- `docs/nfr/latest/nfr-grade.yaml` が存在すること（quality-attributes スキル実行済み）

## ディレクトリ構成

```
docs/
  arch/
    events/{event_id}/
      arch-design.yaml      # 初期構築時: 全セクションの完全版
      arch-design-diff.yaml # 差分更新時: 変更セクションのみ
      arch-design.md         # Markdown 表現（Mermaid 図含む）
      coverage-report.md     # RDRA/NFR カバレッジレポート
      _changes.md            # 変更サマリ（追加/変更/削除）
      _inference.md          # 推論根拠サマリ
      source.txt             # トリガー説明
      decisions/             # 決定記録（arch-decision-001.yaml, ...）
    latest/
      arch-design.yaml       # 最新スナップショット（マージ結果）
      arch-design.md         # 最新 Markdown
      coverage-report.md     # 最新カバレッジレポート
      decisions/             # 決定記録（events からコピー）
```

## 全体フロー

```
docs/rdra/latest/*.tsv + docs/nfr/latest/nfr-grade.yaml
  → Step1: RDRA + NFR からアーキテクチャ推論（自動マッピング）
  → Step2: 対話で確認・調整（テクノロジースタック + ティア + レイヤー + データモデル）
  → Step3: アーキテクチャ設計 YAML 出力（イベント記録 + スナップショット更新）
```

## モード判定

パイプライン開始時に `docs/arch/latest/arch-design.yaml` の状態を確認する:

- **初期構築モード**: `docs/arch/latest/arch-design.yaml` が存在しないか空
  → Step1-3 をフル実行（全セクションを推論）
- **差分更新モード**: `docs/arch/latest/arch-design.yaml` が存在する
  → RDRA/NFR 差分に基づき関連項目のみ再推論、差分を対話で確認

---

## Step1: RDRA + NFR からのアーキテクチャ推論

RDRA モデルと NFR グレードを読み取り、アーキテクチャ設計を推論する。

### 共通コンテキスト

以下のファイルを読み込んで理解する:

- `references/arch-inference-rules.md` — RDRA + NFR → アーキテクチャ推論ルール
- `references/arch-schema.md` — アーキテクチャ設計 YAML スキーマ
- `docs/rdra/latest/*.tsv` — 現在の RDRA モデル（全ファイル）
- `docs/rdra/latest/システム概要.json` — システム概要
- `docs/nfr/latest/nfr-grade.yaml` — NFR グレード
- `docs/arch/latest/arch-design.yaml`（差分更新モード時のみ）— 既存のアーキテクチャ設計

### タスク

`references/arch/arch-infer.md` に従い、RDRA モデルと NFR グレードからアーキテクチャを推論する。

### 出力

このステップではファイル出力を行わない。推論結果を内部データとして保持し、Step2 に渡す。

---

## Step2: 対話によるアーキテクチャ設計確認・調整

Step1 の推論結果をユーザーに提示し、対話で確認・調整する。

### タスク

`references/arch/arch-dialogue.md` に従い、以下の順で対話を行う:

1. **テクノロジースタックの確認**: 言語/FW の希望、技術的制約（デプロイ先は対象外）
2. **システムアーキテクチャの確認**: ティア構成、テクノロジー候補、ティア共通方針/ルール
3. **アプリケーションアーキテクチャの確認**: ティアごとのレイヤリング、レイヤー共通方針/ルール
4. **データアーキテクチャの確認**: 概念モデル、ストレージマッピング
5. **最終確認**: 確定内容のサマリを提示

### 出力

対話で確定したアーキテクチャ設計情報を Step3 に渡す。ファイル出力はこのステップでは行わない。

---

## Step3: アーキテクチャ設計 YAML 出力

確定したアーキテクチャ設計を YAML ファイルとして出力し、イベント記録 + スナップショット更新を行う。

### 共通コンテキスト

- `references/arch-schema.md` — 出力スキーマ
- `references/event-sourcing-rules.md` — イベントソーシングルール

### タスク

`references/arch/arch-output.md` に従い、以下を生成する:

1. イベント ID の生成（`date '+%Y%m%d_%H%M%S'` コマンドでタイムスタンプ取得）
2. trigger_event の特定（前段イベント ID を `rdra:{rdra_event_id}`, `nfr:{nfr_event_id}` 形式で記録）
3. **初期構築時**: `arch-design.yaml`（全セクション含む完全版）を events/ に記録
4. **差分更新時**: `arch-design-diff.yaml`（変更セクションのみ）を events/ に記録
5. `_changes.md` の生成（追加/変更/削除を明記。trigger_event を含む）
6. `_inference.md` の生成（推論根拠サマリ）
7. `source.txt` の生成（トリガー説明）

### 出力

#### 初期構築時

- `docs/arch/events/{event_id}/arch-design.yaml`（完全版）
- `docs/arch/events/{event_id}/_changes.md`
- `docs/arch/events/{event_id}/_inference.md`
- `docs/arch/events/{event_id}/source.txt`
- `docs/arch/events/{event_id}/decisions/arch-decision-{NNN}.yaml`（1つ以上）

#### 差分更新時

- `docs/arch/events/{event_id}/arch-design-diff.yaml`（変更セクションのみ）
- `docs/arch/events/{event_id}/_changes.md`
- `docs/arch/events/{event_id}/_inference.md`
- `docs/arch/events/{event_id}/source.txt`
- `docs/arch/events/{event_id}/decisions/arch-decision-{NNN}.yaml`（1つ以上）

### バリデーション

出力後、スキーマバリデータを実行して arch-design.yaml の構造を検証する:

```bash
node <skill-path>/scripts/validateArchDesign.js docs/arch/events/{event_id}/arch-design.yaml
```

- 終了コード 0（PASS）: Markdown 生成へ進む
- 終了コード 1（FAIL）: エラー内容を確認し、arch-design.yaml を修正してから再度バリデーションを実行する

`<skill-path>` は本スキルのディレクトリパス（`${CLAUDE_PLUGIN_ROOT}/skills/dist-architecture`）。

### Markdown の生成

バリデーション通過後、arch-design.yaml を Markdown 形式に変換する:

```bash
node <skill-path>/scripts/generateArchDesignMd.js docs/arch/events/{event_id}/arch-design.yaml
```

これにより `docs/arch/events/{event_id}/arch-design.md` が生成される。このスクリプトは決定論的（同一入力 → 同一出力）なため、LLM に依存せずバンドルスクリプトで実行する。

### カバレッジレポート生成

バリデーション通過・Markdown 生成後、RDRA/NFR に対するアーキテクチャ設計の要件網羅率レポートを生成する:

```bash
node <skill-path>/scripts/generateCoverageReport.js <rdra-dir> <nfr-yaml> docs/arch/events/{event_id}/arch-design.yaml
```

- `<rdra-dir>`: RDRA latest ディレクトリ（`docs/rdra/latest/`）
- `<nfr-yaml>`: NFR グレード YAML（`docs/nfr/latest/nfr-grade.yaml`）

これにより `docs/arch/events/{event_id}/coverage-report.md` が生成される。
RDRA 網羅率・NFR 網羅率ともに 100% を目標とする。未カバー項目がある場合は、policy/rule の追加または source_model への NFR ID 追記を検討する。

### スナップショット更新

`references/arch/arch-snapshot-update.md` および `references/event-sourcing-rules.md` に従い、`docs/arch/latest/` を更新する。

- **初期構築時**: `events/{event_id}/arch-design.yaml`（完全版）を `latest/arch-design.yaml` にコピーする
- **差分更新時**: `events/{event_id}/arch-design-diff.yaml` の変更セクションを `latest/arch-design.yaml` にマージする
  - マージキー: `system_architecture.tiers` は `id`、`app_architecture.tier_layers` は `tier_id`、`data_architecture.entities` は `name`、`data_architecture.policies` は `name`
  - `confidence: "user"` の項目は上書きしない（ユーザー確定値を保護）
  - `_changes.md` の削除セクションに記載された要素を latest から除去

スナップショット更新後、latest にも Markdown を再生成する:

```bash
node <skill-path>/scripts/generateArchDesignMd.js docs/arch/latest/arch-design.yaml
```

スナップショット更新後、latest にもカバレッジレポートを生成する:

```bash
node <skill-path>/scripts/generateCoverageReport.js <rdra-dir> <nfr-yaml> docs/arch/latest/arch-design.yaml
```

---

## subagent への指示テンプレート

Step1 は RDRA/NFR モデルの読み込みと推論を行うため、メインエージェントが直接実行する。
Step2 は対話が必要なため、メインエージェントが直接実行する。
Step3 は以下のパターンで subagent に委譲可能。

### Step3 例: アーキテクチャ設計出力

```
以下のファイルを順に読み込んで理解してください:

1. スキーマ定義
   - references/arch-schema.md
   - references/event-sourcing-rules.md

2. タスク指示
   - references/arch/arch-output.md

3. 確定データ
   以下のアーキテクチャ設計情報を arch-design.yaml として出力してください:
   {Step2 で確定したアーキテクチャ設計データ}

質問や確認は不要です。指示に従い即座に実行してください。
```

---

## 出力チェック

パイプライン完了後、以下を確認する:

- 初期構築時: `docs/arch/events/{event_id}/arch-design.yaml` が存在すること
- 差分更新時: `docs/arch/events/{event_id}/arch-design-diff.yaml` が存在すること
- `docs/arch/events/{event_id}/arch-design.md` が存在すること
- `docs/arch/events/{event_id}/_changes.md` が存在すること
- `docs/arch/events/{event_id}/_inference.md` が存在すること
- `docs/arch/events/{event_id}/source.txt` が存在すること
- `docs/arch/latest/arch-design.yaml` が最新スナップショットであること
- `docs/arch/latest/arch-design.md` が最新であること
- バリデーションスクリプトが PASS すること
- `docs/arch/events/{event_id}/coverage-report.md` が存在すること
- `docs/arch/latest/coverage-report.md` が存在すること
- RDRA 網羅率が 100% であること
- NFR 網羅率（重要メトリクスのみ）が 100% であること
- `docs/arch/events/{event_id}/decisions/` に少なくとも1つの決定記録が存在すること
- `docs/arch/latest/decisions/` に決定記録がコピーされていること
- テクノロジー候補にクラウドベンダー固有のサービス名が含まれていないこと

## RDRA 整合性ルール

RDRA モデル (`docs/rdra/latest/`) に存在しないアクター / 情報 / BUC / 画面 / エンティティを、
本スキルで新規に追加してはならない。追加が必要と判断した場合は:

1. **追加しない**。提案のみに留める
2. `node ${CLAUDE_PLUGIN_ROOT}/skills/dist-pipeline/scripts/appendTodo.js --skill dist-architecture --event <arch_event_id> --type RDRA追加 --title "<タイトル>" --body "<本文>"` で `docs/todo.md` に記録
3. 確認推奨項目として「RDRA への追加是非」をユーザーに返却する

## 確認推奨項目の返却（dialogue-format 準拠）

本スキルは pipeline の Step3 として **対話あり** で実行される。confidence: low/medium の項目、
および自動推論で埋めた項目があれば、結果として「確認推奨項目リスト」を返却する。
フォーマットは `skills/dist-pipeline/references/dialogue-format.md` に従うこと
（**3案以上 + ⭐推奨 + 一行説明 + 推奨理由**）。対話を省略して completed を返してはならない。

