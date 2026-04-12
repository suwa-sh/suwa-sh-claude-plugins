---
name: distillery:dist-requirements
description: >
  RDRA x USDM x Event Sourcing による差分パイプライン型の要件定義スキル。
  変更要望テキストを USDM 分解し、RDRA モデルを差分更新する。
  初回も USDM 分解を通してから USDM YAML を入力として rdra スキルでフルビルドし、2回目以降は差分モードで動作する。
  Spec 生成は後続の spec スキルの責務。
  「差分で要件更新」「変更要望を反映」「パイプラインで要件定義」「USDM で分解」「差分 RDRA」などで発動。
---

# RDRA Pipeline スキル（差分パイプライン型）

変更要望テキストから USDM 分解 → RDRA 差分更新をイベントソーシング方式で行う。

## 前提条件

- 作業ディレクトリに変更要望テキスト（任意ファイル名）が存在すること
- 初回実行時は `初期要望.txt` をそのまま使用可能

## ディレクトリ構成

```
docs/
  usdm/
    events/{event_id}/requirements.yaml, source.txt
    latest/requirements.yaml, requirements.md
  rdra/
    events/{event_id}/*.tsv, _changes.md
    latest/*.tsv, 関連データ.txt, ZeroOne.txt, システム概要.json
```

> **Note**: Spec 生成は後続の `spec` スキルの責務。

## 全体フロー

```
変更要望テキスト
  → Step1: USDM 分解（要求・理由・仕様に構造化）
  → Step2: RDRA 差分生成（影響モデルの差分 TSV 生成）
  → Step3: RDRA スナップショット更新（latest/ へマージ）
```

> Spec 生成は `spec` スキルで実行する（本スキルの後段）。

## モード判定

パイプライン開始時に `docs/rdra/latest/` の状態を確認する:

- **初期構築モード**: `docs/rdra/latest/` が存在しないか空
  → Step0（初期構築）を実行し、続けて Step4-5（Spec 生成）を実行する
- **差分更新モード**: `docs/rdra/latest/*.tsv` が存在する
  → Step1 から順に実行

---

## Step0: 初期構築（初期構築モードのみ）

`docs/rdra/latest/` が空の場合に実行する。初期要望も USDM を通してから、USDM YAML を入力として RDRA フルビルドを行う。

### タスク

`references/rdra/rdra-initial-build.md` に従い、以下の順で実行する:

1. **USDM 分解**: 初期要望テキストを USDM に構造化分解 → `docs/usdm/events/{event_id}/`
2. **USDM スナップショット作成**: → `docs/usdm/latest/requirements.yaml` + `requirements.md`
3. **ユーザー確認（1 回、対話 1 ターン）**: 生成した USDM の要約をユーザーに提示し、解釈ズレがないか確認する。短い要望テキスト（数百文字）から自動生成した内容が後段に波及するのを防ぐのが目的。
   - 提示項目:
     - 業務一覧（業務名の箇条書き）
     - UC 候補（BUC 候補名の箇条書き）
     - 主要情報（情報エンティティ候補の箇条書き）
     - 主要アクター（アクター候補）
   - 選択肢: 「このまま進める」「修正指示」「中断」
   - 修正指示を受けた場合は USDM を再生成してから再度確認する
   - **対話スキップフラグ**: 呼び出し元が `--no-confirm` を明示した場合、または requirements.yaml が差分更新モード（`docs/usdm/latest/requirements.yaml` が既存）の場合は確認をスキップする
4. **USDM YAML を入力とした RDRA フルビルド**: Phase1-5 + RDRA統合（`初期要望.txt` ではなく `docs/usdm/latest/requirements.yaml` を入力とする）
5. **docs 配置**: `1_RDRA/` → `docs/rdra/latest/` + `docs/rdra/events/{event_id}/`
6. **一時ディレクトリ削除**: `0_RDRAZeroOne/` と `1_RDRA/` をディレクトリごと削除

### 出力チェック

USDM:
- `docs/usdm/events/{event_id}/requirements.yaml`, `source.txt`
- `docs/usdm/latest/requirements.yaml`, `requirements.md`

RDRA:
- `docs/rdra/latest/` に以下のファイルが揃っていること:
  - `システム概要.json`, `アクター.tsv`, `外部システム.tsv`, `情報.tsv`, `状態.tsv`, `条件.tsv`, `バリエーション.tsv`, `BUC.tsv`, `関連データ.txt`, `ZeroOne.txt`

---

## Step1: USDM 分解

変更要望テキストを USDM（要求・理由・仕様）に構造化分解する。

### 共通コンテキスト

以下のファイルを読み込んで理解する:

- `references/usdm-schema.md` — USDM YAML スキーマ定義
- `references/event-sourcing-rules.md` — イベントソーシングルール
- `docs/usdm/latest/requirements.yaml` — 現在の USDM スナップショット（既存要求の把握・ID 重複回避のため。存在しない場合は初回）
- `docs/rdra/latest/*.tsv` — 現在の RDRA モデル（既存要素の把握用）
- 変更要望テキスト（ユーザー指定のファイル）

### タスク

`references/usdm/usdm-decompose.md` に従い、変更要望テキストを USDM に分解する。

### 出力

- `docs/usdm/events/{event_id}/requirements.yaml`
- `docs/usdm/events/{event_id}/source.txt`

### バリデーション

出力後、スキーマバリデータを実行して requirements.yaml の構造を検証する:

```bash
node <skill-path>/scripts/validateRequirements.js docs/usdm/events/{event_id}/requirements.yaml
```

- 終了コード 0（PASS）: 次の Step へ進む
- 終了コード 1（FAIL）: エラー内容を確認し、requirements.yaml を修正してから再度バリデーションを実行する。修正対象は主に以下:
  - `version`, `event_id`, `created_at`, `source`, `system_name` の必須フィールド
  - ID 形式（`REQ-001`, `SPEC-001-01`）
  - `priority` の値（`must`, `should`, `could` のいずれか）
  - `affected_models` の構造（`type`, `action`, `target` の必須フィールド）

`<skill-path>` は本スキルのディレクトリパス（`${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements`）。

### USDM スナップショット更新後の Markdown 生成

USDM スナップショット（`docs/usdm/latest/requirements.yaml`）の更新後、人間が読める Markdown 形式に変換する:

```bash
node <skill-path>/scripts/generateRequirementsMd.js docs/usdm/latest/requirements.yaml
```

これにより `docs/usdm/latest/requirements.md` が生成される。このスクリプトは決定論的（同一入力 → 同一出力）なため、LLM に依存せずバンドルスクリプトで実行する。

---

## Step2: RDRA 差分生成

USDM の affected_models に基づき、RDRA モデルの差分 TSV を生成する。

### 共通コンテキスト

- `references/event-sourcing-rules.md` — イベントソーシングルール
- `references/rdra-phases/rdra-knowledge.md` — RDRA 基本概念
- `docs/usdm/events/{event_id}/requirements.yaml` — Step1 の出力
- `docs/rdra/latest/*.tsv` — 現在の RDRA モデル

### タスク

`references/rdra/rdra-diff-generate.md` に従い、差分 TSV と `_changes.md` を生成する。

### 出力

- `docs/rdra/events/{event_id}/*.tsv`（変更があったファイルのみ）
- `docs/rdra/events/{event_id}/_changes.md`

### バリデーション

出力後、バリデータを実行して _changes.md と差分 TSV の構造を検証する:

```bash
node <skill-path>/scripts/validateChanges.js docs/rdra/events/{event_id}
```

- 終了コード 0（PASS）: 次の Step へ進む
- 終了コード 1（FAIL）: エラー内容を確認し修正。主な修正対象:
  - _changes.md の「追加」「変更」「削除」セクションの欠落
  - TSV ヘッダーが既存 RDRA 形式と不一致
  - モデル種別に英語名が使われている（日本語名を使用すること）

---

## Step3: RDRA スナップショット更新

差分 TSV を `docs/rdra/latest/` にマージする。

### タスク

`references/rdra/rdra-snapshot-update.md` に従い、latest/ を更新する。

### 出力

- 更新された `docs/rdra/latest/*.tsv`
- 再生成された `docs/rdra/latest/関連データ.txt`、`docs/rdra/latest/ZeroOne.txt`

---

## 実装同期確認（オプション）

ユーザーが明示的に指示した場合に実行する。

### タスク

`references/sync/sync-check.md` に従い、`src/` と `docs/specs/latest/` の整合性を確認する。

---

## subagent への指示テンプレート

各タスクを subagent に委譲する際は、Step ごとに以下のパターンで指示する。ファイルパスは絶対パスまたはプロジェクトルートからの相対パスで指定する。

### Step0 例: RDRA フルビルド Phase1 タスク（USDM YAML 入力）

```
以下のファイルを読み込んで理解してください:
- references/rdra-phases/rdra-knowledge.md
- docs/usdm/latest/requirements.yaml

※ requirements.yaml は USDM（要求・理由・仕様）形式で構造化された初期要望です。
  requirements[].requirement（要求）、reason（理由）、specifications[].specification（仕様）、
  affected_models（影響モデル）を初期要望の内容として解釈してください。

次に、以下のタスクプロンプトを読み、その指示に従ってファイルを生成してください:
{タスクプロンプトのパス}

質問や確認は不要です。指示に従い即座に実行してください。
```

Phase2-4 も同様に、共通コンテキストの `初期要望.txt` を `docs/usdm/latest/requirements.yaml` に置き換え、上記の補足を付ける。

---

### Step1 例: USDM 分解

```
以下のファイルを順に読み込んで理解してください:

1. スキーマ定義
   - references/usdm-schema.md
   - references/event-sourcing-rules.md

2. 既存データ
   - docs/usdm/latest/requirements.yaml（存在する場合 — ID重複回避のため）
   - docs/rdra/latest/*.tsv（全ファイル）

3. 入力
   - {変更要望テキストのパス}

次に、以下のタスクプロンプトを読み、その指示に従ってファイルを生成してください:
references/usdm/usdm-decompose.md

質問や確認は不要です。指示に従い即座に実行してください。
```

### Step2 例: RDRA 差分生成

```
以下のファイルを順に読み込んで理解してください:

1. 基礎知識
   - references/event-sourcing-rules.md
   - references/rdra-phases/rdra-knowledge.md

2. 入力データ
   - docs/usdm/events/{event_id}/requirements.yaml
   - docs/rdra/latest/*.tsv（全ファイル）

3. タスク指示
   - references/rdra/rdra-diff-generate.md

質問や確認は不要です。指示に従い即座に実行してください。
```

> **Note**: Spec 生成の subagent テンプレートは `spec` スキルの SKILL.md を参照。

## 確認推奨項目の返却（dialogue-format 準拠）

本スキルは pipeline の Step1 として **対話あり** で実行される。以下に該当する項目があれば
結果として「確認推奨項目リスト」を返す。フォーマットは
`skills/dist-pipeline/references/dialogue-format.md` に従う（**3案以上 + ⭐推奨 + 一行説明 + 推奨理由**）。

- USDM 分解時に解釈が曖昧だった要望（複数解釈が可能）
- RDRA モデルにアクター / 情報 / BUC を自動追加した項目
- confidence: low の項目

対話を省略して completed を返してはならない。

