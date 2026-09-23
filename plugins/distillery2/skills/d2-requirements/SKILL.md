---
name: distillery2:d2-requirements
description: >-
  段階①「要求」。要望テキストを USDM (要求・仕様・受入基準) と RDRA (アクター・業務・UC・情報・状態・条件) に分解し、
  UC 一覧 (docs/requirements/use-cases.yaml) を作る。受入基準は 1 行 Gherkin としてここで人が確認する。
  UC 単位のシナリオは書かない (UC 着手時に d2-implement mode=scenario が書く)。
  「要求定義」「USDM で分解」「RDRA モデルを作る」「UC 一覧を作る」などで発動。
---

# d2-requirements（段階① 要求）

要望テキストを USDM と RDRA に分解し、UC 一覧を作る。履歴は git が持つ（イベントソーシングは使わない）。
生成物は `docs/requirements/` 直下に**直接**書き出す。

## 入出力

| 入力 | 出力（すべて `docs/requirements/` 配下） |
|---|---|
| 要望テキスト（例: `docs/input/初期要望.txt`） | `requirements.yaml` / `requirements.md`（USDM）|
| | `rdra/*.tsv`、`rdra/関連データ.txt`、`rdra/ZeroOne.txt`、`rdra/システム概要.json`、`rdra/views/*.md`（RDRA）|
| | `use-cases.yaml`（UC 一覧）|
| | `_review-summary.md`（人が承認する材料。毎回作り直す）|

この段階は最上流なので、生成物に `basis:` は付けない。

## モード判定

`docs/requirements/` の有無で分岐する。

- **初期構築**: `docs/requirements/rdra/` が無い、または空 → Step0（フルビルド）を実行する。
- **差分更新**: `docs/requirements/rdra/*.tsv` が既存 → Step1（差分を既存ファイルへ**インプレース編集**）を実行する。
  差分アーティファクトは作らない。変更したファイルと要点を最終報告に列挙する。

---

## Step0: 初期構築（フルビルド）

`references/rdra/rdra-initial-build.md` に従い、以下の順で実行する。RDRA 各フェーズは
コンテキストを多く消費するため、必ずサブエージェントに委譲する（下の「サブエージェントへの指示」参照）。

1. **USDM 分解** — 要望テキストを `references/usdm-schema.md` の形式へ構造化し、
   `references/usdm/usdm-decompose.md` に従って `docs/requirements/requirements.yaml` を書く。
   受入基準（`acceptance_criteria`）は **1 行 Gherkin**（`Given … When … Then …`）で人が確認できる粒度にする。
   UC 単位のシナリオはここでは書かない。
2. **USDM 検証** — 構造をバリデートする:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/validateRequirements.js docs/requirements/requirements.yaml
   ```
   FAIL なら requirements.yaml を直して再実行する（必須フィールド / ID 形式 `REQ-001`・`SPEC-001-01` / `priority` / `affected_models`）。
3. **USDM Markdown 生成**（決定論・LLM 非依存）:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/generateRequirementsMd.js docs/requirements/requirements.yaml
   ```
4. **RDRA フルビルド** — `docs/requirements/requirements.yaml` を入力に Phase1–5 + RDRA 統合を実行し、
   TSV を一時ディレクトリ `1_RDRA/` に作る（`references/rdra-phases/` の各タスク）。
5. **整合性 lint（確定前ゲート）**:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/generateRdraMd.js 1_RDRA --lint
   ```
   エラー（未定義参照）が 0 件になるまで `1_RDRA/` の TSV を直す。警告（未接続）は報告のみ。
6. **関連データ・ZeroOne 生成**:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/makeGraphData.js 1_RDRA
   node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/makeZeroOneData.js 1_RDRA
   ```
7. **配置** — `1_RDRA/*.tsv`・`関連データ.txt`・`ZeroOne.txt`・`システム概要.json` を `docs/requirements/rdra/` へ移す。
8. **RDRA ビュー生成 + 不整合チェック**:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/generateRdraMd.js docs/requirements/rdra
   ```
   `docs/requirements/rdra/views/*.md`（Mermaid 図解つき）と `views/00_不整合チェック.md` が生成される。
   検出件数を確認し、残る不整合を報告する。
9. **一時ディレクトリ削除** — `0_RDRAZeroOne/`・`1_RDRA/` を削除する。
10. **UC 一覧生成**（後述「UC 一覧」）。
11. **確認材料生成**（後述「人の確認材料」）。

---

## Step1: 差分更新（インプレース編集）

既存の `docs/requirements/` がある場合、変更要望テキストを USDM で解釈し、既存ファイルを**編集**する
（作り直さない）。

1. `docs/requirements/requirements.yaml` に要求・仕様・受入基準を追記／修正する。ID は既存と重複させない。
2. 影響する `docs/requirements/rdra/*.tsv` を編集する。
3. Step0 の手順 2・3・5・8 を再実行して検証・Markdown・ビュー・不整合チェックを更新する。
   **差分更新では入力ディレクトリを `docs/requirements/rdra` にする**（一時ディレクトリ `1_RDRA/` は
   Step0 の手順 9 で削除済みのため）。手順 5・6 のコマンドは次に読み替える:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/generateRdraMd.js docs/requirements/rdra --lint
   node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/makeGraphData.js docs/requirements/rdra
   node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/makeZeroOneData.js docs/requirements/rdra
   ```
   （関連データ・ZeroOne は TSV を変えたときだけ再生成する）。
4. **UC 一覧**を再生成する（既存の `slug`・`spec_ids`・`status` は uc_id で引き継がれる）。
5. **確認材料**を作り直す。
6. 最終報告に「変更したファイル」と「追加／変更／削除した要求・UC」を列挙する。

---

## UC 一覧（use-cases.yaml）

`genUseCases.js` が requirements.yaml と `rdra/BUC.tsv` から UC 一覧を**決定論的に**導出する。

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/genUseCases.js
# 既定: docs/requirements/requirements.yaml  docs/requirements/rdra/BUC.tsv  docs/requirements/use-cases.yaml
```

各 UC のフィールド:

| フィールド | 出どころ |
|---|---|
| `uc_id` | 業務・BUC・UC の canonical JSON 配列（NFC 正規化）の sha256 先頭 8 桁。衝突時は全 UC で 12 桁 |
| `business` / `buc` / `uc` | BUC.tsv の 業務 / BUC / UC 列 |
| `actors` | BUC.tsv の「アクター」関連オブジェクト |
| `tiers_hint` | 画面あり→frontend、タイマーあり→worker、常に backend（暫定ヒント。ティアは d2-decide が決める）|
| `spec_ids` | **スクリプトはフロー（BUC）単位で候補を当てる**。LLM が UC が実現する SPEC へ絞り込む |
| `slug` | **スクリプトは暫定 `uc-<uc_id>` を置く**。LLM が意味のある英語 kebab-case（`^[a-z0-9]+(-[a-z0-9]+)*$`・一意）へ差し替える |
| `status` | 既定 `planned`（`planned` / `in_progress` / `done`）|

**LLM の作業**: 生成後、各 UC の `slug` を英名へ、`spec_ids` を実現する SPEC へ編集する。
既存 use-cases.yaml があれば `slug`・`status`・`tiers_hint` は uc_id で引き継がれるので、再生成しても
LLM の編集は消えない。`spec_ids` は**既存値（LLM が絞った SPEC）と新たな推定候補の和集合**になり、
SPEC を取りこぼさない。再生成で新規に増えた候補は各 UC の `spec_ids_added` に記録されるので、
**LLM は `spec_ids_added` を見て採否を判断し、実現する SPEC だけに絞ったら `spec_ids_added` を削除する**。
編集後にバリデートする:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/validateUseCases.js docs/requirements/use-cases.yaml
```

チェック内容: 構造（schema-use-cases.json）、uc_id 一意、slug 一意・パターン、spec_ids が requirements.yaml に実在。

---

## 人の確認材料（_review-summary.md）

`docs/requirements/_review-summary.md` を書く。オーケストレータ（d2-run）がこれをレビューページに変換し、人が承認する。
仕様ではなく毎回作り直す要約。**内部 ID（uc_id・SPEC-xxx 等）は本文に出さず、業務・UC・情報の名前で書く**。

含める要点:

- **UC 一覧** — 業務ごとに UC 名を並べ、各 UC のアクターと一言説明。
- **業務ルール** — 条件・バリエーション（貸出可否・返却期限算出・媒体種別など）の要点。
- **状態遷移** — 主要な状態モデル（書籍の状態・予約の状態など）の遷移。
- **受入基準** — 各仕様の受入基準（1 行 Gherkin）の要点。人が「これで合っているか」を判断できるように。

---

## スクリプト一覧

すべて `${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/` にあり、npm 依存なし・共有ライブラリ
（`../../../scripts/lib`）のみ使う。

| スクリプト | 役割 |
|---|---|
| `validateRequirements.js` | USDM requirements.yaml の構造・意味検証 |
| `generateRequirementsMd.js` | requirements.yaml → requirements.md（決定論）|
| `generateRdraMd.js` | RDRA TSV → views/*.md ＋ 参照整合性チェック（`--lint` で確定前ゲート）|
| `makeGraphData.js` | RDRA TSV → 関連データ.txt |
| `makeZeroOneData.js` | RDRA TSV → ZeroOne.txt |
| `genUseCases.js` | requirements.yaml ＋ BUC.tsv → use-cases.yaml（決定論導出）|
| `validateUseCases.js` | use-cases.yaml の構造・意味検証 |

---

## サブエージェントへの指示（RDRA フェーズ）

各フェーズタスクをサブエージェントに委譲する。`references/...` はスキルルート相対で、委譲時は
`${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/references/...` の絶対パスへ展開する。成果物パスはプロジェクトルート相対。

```
以下のファイルを読み込んで理解してください:
- references/rdra-phases/rdra-knowledge.md
- docs/requirements/requirements.yaml

※ requirements.yaml は USDM 形式です。requirement（要求）・reason（理由）・
  specifications[].specification（仕様）・affected_models（影響モデル）を要望内容として解釈してください。

次に、以下のタスクプロンプトに従ってファイルを生成してください:
{タスクプロンプトのパス（references/rdra-phases/... の絶対パス）}

質問や確認は不要です。指示に従い即座に実行してください。
```

---

## UI 画面を持たないプロダクト（CLI / API / バッチ）

- Phase5 の `システム概要.json` に `interface_kind`（`gui` / `cli` / `api` / `batch`。省略時 `gui`）を記録する
  （`references/rdra-phases/phase5/システム概要生成.md`）。
- `gui` 以外では RDRA の「画面」を **コマンド出力 / API レスポンス** として扱い、`{コマンド名} 出力` のように
  GUI と誤読されない名前にする（`references/rdra-phases/spec/23_画面一覧生成.md`）。
- 目的: 後段の d2-design が CLI 出力を GUI 画面としてデザインするのを防ぐ。
