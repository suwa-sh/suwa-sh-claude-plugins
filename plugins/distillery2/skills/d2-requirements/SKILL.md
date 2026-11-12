---
name: d2-requirements
description: >-
  段階①「要求」。要望テキストを USDM (要求・仕様・受入基準) と RDRA (アクター・業務・UC・情報・状態・条件) に分解し、
  UC 一覧 (docs/requirements/use-cases.yaml) を作る。受入基準は 1 行 Gherkin としてここで人が確認する。
  UC 単位のシナリオは書かない (UC 着手時に d2-implement mode=scenario が書く)。
  「要求定義」「USDM で分解」「RDRA モデルを作る」「UC 一覧を作る」などで発動。
---

# d2-requirements

要望テキストを、USDM と RDRA に分解し、UC 一覧を作る。
生成物は `docs/requirements/` 直下に**直接**書き出す。
履歴は git が持つ。
この段階は最上流なので、生成物に `basis:` は付けない。

UC 単位のシナリオは、ここでは書かない。
受入基準は **1 行 Gherkin** (`Given … When … Then …`) で書き、人が確認する。

## 呼び出し

進行役 (d2-run) が派遣する。
`docs/requirements/` の状態で、することが分かれる。

| モード | 条件 | すること | 手順 |
|---|---|---|---|
| **初期構築** | `docs/requirements/rdra/` が無い、または空 | フルビルドする | 下の「初期構築の手順」 |
| **差分更新** | `docs/requirements/rdra/*.tsv` が既存 | 差分を、既存ファイルへ**インプレース編集**する | [references/diff-update.md](references/diff-update.md) |

差分更新では、差分アーティファクトは作らない。
変更したファイルと要点を、最終報告に列挙する。

パスの `<skills>` は、スキル群のディレクトリを指す。
定義は [../d2-common/SKILL.md](../d2-common/SKILL.md) の「パスの書き方」にある。

## 入出力

| 入力 | 出力（すべて `docs/requirements/` 配下） |
|---|---|
| 要望テキスト（例: `docs/input/初期要望.txt`）、または要求の課題ファイル `docs/feedback/<issue>.md`（要求の差分。d2-run が未処理の要求の課題をすべて渡す） | `requirements.yaml` / `requirements.md`（USDM）|
| | `rdra/*.tsv`、`rdra/関連データ.txt`、`rdra/ZeroOne.txt`、`rdra/システム概要.json`、`rdra/views/*.md`（RDRA）|
| | `use-cases.yaml`（UC 一覧）|
| | `_review-summary.md`（人が承認する材料。毎回作り直す）|

## 初期構築の手順

`references/rdra/rdra-initial-build.md` に従い、下の順で実行する。
RDRA の各フェーズはコンテキストを多く消費する。
必ずサブエージェントに委譲する (下の「サブエージェントへの指示」)。

| 順 | すること | 次へ進む条件 |
|---|---|---|
| 1 | USDM に分解し、`docs/requirements/requirements.yaml` を書く | 受入基準が 1 行 Gherkin である |
| 2 | USDM を検証する | 検証が通る。FAIL なら requirements.yaml を直して再実行する |
| 3 | USDM の Markdown を生成する | `requirements.md` ができた |
| 4 | RDRA をフルビルドする | 一時ディレクトリ `1_RDRA/` に TSV ができた |
| 5 | 整合性を lint する (確定前ゲート) | エラー (未定義参照) が 0 件である。警告 (未接続) は報告のみ |
| 6 | 関連データと ZeroOne を生成する | 2 つのファイルができた |
| 7 | 配置する | `docs/requirements/rdra/` へ移した |
| 8 | RDRA のビューを生成し、不整合をチェックする | 検出件数を確認した。残る不整合は報告する |
| 9 | 一時ディレクトリを削除する | `0_RDRAZeroOne/` と `1_RDRA/` を削除した |
| 10 | UC 一覧を生成する | 下の「UC 一覧」 |
| 11 | 確認材料を生成する | 下の「人の確認材料」 |

### 1. USDM 分解

要望テキストを `references/usdm-schema.md` の形式へ構造化する。
`references/usdm/usdm-decompose.md` に従って書く。

仕様は 1 つの UC で確かめられる単位に分ける (複数の UC の振る舞いを 1 つの仕様に混ぜない。`usdm-decompose.md` 5 節)。

### 2. USDM 検証

```bash
node <skills>/d2-requirements/scripts/validateRequirements.js docs/requirements/requirements.yaml
```

検査するのは、必須フィールド、ID 形式 (`REQ-001`・`SPEC-001-01`)、`priority`、`affected_models` である。

### 3. USDM Markdown 生成

決定論で、LLM に依存しない。

```bash
node <skills>/d2-requirements/scripts/generateRequirementsMd.js docs/requirements/requirements.yaml
```

### 4. RDRA フルビルド

`docs/requirements/requirements.yaml` を入力に、Phase1–5 と RDRA 統合を実行する。
各タスクは `references/rdra-phases/` にある。

### 5. 整合性 lint

```bash
node <skills>/d2-requirements/scripts/generateRdraMd.js 1_RDRA --lint
```

エラーが 0 件になるまで、`1_RDRA/` の TSV を直す。

### 6. 関連データと ZeroOne の生成

```bash
node <skills>/d2-requirements/scripts/makeGraphData.js 1_RDRA
node <skills>/d2-requirements/scripts/makeZeroOneData.js 1_RDRA
```

### 7. 配置

`1_RDRA/*.tsv`・`関連データ.txt`・`ZeroOne.txt`・`システム概要.json` を、`docs/requirements/rdra/` へ移す。

### 8. RDRA ビュー生成と不整合チェック

```bash
node <skills>/d2-requirements/scripts/generateRdraMd.js docs/requirements/rdra
```

`docs/requirements/rdra/views/*.md` (Mermaid 図解つき) と `views/00_不整合チェック.md` が生成される。

## UC 一覧

`genUseCases.js` が、requirements.yaml と `rdra/BUC.tsv` から UC 一覧を**決定論的に**導出する。
生成の後に、LLM が `slug` と `spec_ids` を編集し、検証する。

| 順 | すること |
|---|---|
| 1 | `node <skills>/d2-requirements/scripts/genUseCases.js` で生成する |
| 2 | 各 UC の `slug` を、意味のある英語の kebab-case に差し替える |
| 3 | 各 UC の `spec_ids` を、その UC が実現する SPEC に絞り込む。外した SPEC は `spec_ids_rejected` へ移す |
| 4 | `node <skills>/d2-requirements/scripts/validateUseCases.js docs/requirements/use-cases.yaml` で検証する |

**`spec_ids` が空の UC を残さない**。
対応する SPEC が本当に無いなら、`no_spec_reason` に理由を書いて `status: blocked` にする。

各フィールドの出どころと、編集の決まりは [references/use-cases.md](references/use-cases.md) にある。
手順 2 の前に読む。

## 人の確認材料

`docs/requirements/_review-summary.md` を書く。
d2-run が、これをレビューページに変換し、人が承認する。
仕様ではなく、毎回作り直す要約である。
**内部 ID（uc_id・SPEC-xxx 等）は本文に出さず、業務・UC・情報の名前で書く**。

| 含める要点 | 内容 |
|---|---|
| **UC 一覧** | 業務ごとに UC 名を並べ、各 UC のアクターと一言説明を書く |
| **業務ルール** | 条件とバリエーションの要点 (貸出可否・返却期限算出・媒体種別など) |
| **状態遷移** | 主要な状態モデルの遷移 (書籍の状態・予約の状態など) |
| **受入基準** | 各仕様の受入基準 (1 行 Gherkin) の要点。人が「これで合っているか」を判断できるように書く |

決めずに返す論点は、`_review-summary.md` に「未決」として書かない。
引き継ぎファイルの `asks` に書く (答えは、進行役が決めたことの記録に残す)。
確認材料には「確認したい点は引き継ぎファイルの問いにある」とだけ書く。

## RDRA の説明の書き方

RDRA の TSV の「説明」「条件の説明」は、1 文目に要点だけ (60 字まで) を書き、2 文目以降に 1 文 1 つで細目を書く (例外は「例外: 」、順番は「順番: 」で始める)。
図解 (`generateRdraMd.js`) が 1 文目を表に、2 文目以降を細目の箇条書きに出し、1 文目が長いと警告する。
説明を書き足したら、全体をこの形に整え直す ([writing.md](../d2-common/references/writing.md))。

## UI 画面を持たないプロダクト（CLI / API / バッチ）

後段の d2-design が、CLI の出力を GUI 画面としてデザインするのを防ぐ。

| すること | 細目 |
|---|---|
| Phase5 の `システム概要.json` に `interface_kind` を記録する (`gui` / `cli` / `api` / `batch`。省略時 `gui`) | `references/rdra-phases/phase5/システム概要生成.md` |
| `gui` 以外では、RDRA の「画面」を **コマンド出力 / API レスポンス** として扱う。`{コマンド名} 出力` のように、GUI と誤読されない名前にする | `references/rdra-phases/spec/23_画面一覧生成.md` |

## サブエージェントへの指示（RDRA フェーズ）

各フェーズのタスクを、サブエージェントに委譲する。
`references/...` はスキルルート相対である。
委譲時は `<skills>/d2-requirements/references/...` の絶対パスへ展開する。
成果物のパスは、プロジェクトルート相対である。

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

## スクリプト

すべて `<skills>/d2-requirements/scripts/` にある。
npm 依存は無く、共有ライブラリ (`../d2-common/scripts/lib`) だけを使う。

| スクリプト | 役割 |
|---|---|
| `validateRequirements.js` | USDM requirements.yaml の構造・意味検証 |
| `generateRequirementsMd.js` | requirements.yaml → requirements.md（決定論）|
| `generateRdraMd.js` | RDRA TSV → views/*.md ＋ 参照整合性チェック（`--lint` で確定前ゲート）|
| `makeGraphData.js` | RDRA TSV → 関連データ.txt |
| `makeZeroOneData.js` | RDRA TSV → ZeroOne.txt |
| `genUseCases.js` | requirements.yaml ＋ BUC.tsv → use-cases.yaml（決定論導出）|
| `validateUseCases.js` | use-cases.yaml の構造・意味検証 |

## 引き継ぎファイル

作業の終わりに、進行役が派遣文で渡す場所 (`{handoff}`) に引き継ぎファイルを書く。
書くのは、人に聞きたいことと、自分の書き込み範囲では直せない前のステップの問題である。
報告の本文にだけ書いたことは扱われない。
推奨は条件を付けずに 1 つ書く。
書き方は [handoff.md](../d2-common/references/handoff.md) にある。

## 細目の文書

| 文書 | 読むとき | 内容 |
|---|---|---|
| [references/diff-update.md](references/diff-update.md) | 差分更新で呼ばれたとき | 既存の要求を編集する手順と、最終報告に書く欄 |
| [references/use-cases.md](references/use-cases.md) | UC 一覧を編集する前 | 各フィールドの出どころ、`spec_ids` の編集の決まり、検証の内容 |
| [references/rdra/rdra-initial-build.md](references/rdra/rdra-initial-build.md) | 初期構築の前 | フルビルドの進め方 |
| [references/usdm-schema.md](references/usdm-schema.md) | 初期構築の手順 1 の前 | USDM の形式 |
| [references/usdm/usdm-decompose.md](references/usdm/usdm-decompose.md) | 要求を書く前 | USDM への分解の仕方。仕様を UC 単位に分ける決まり (5 節) |
| [../d2-common/references/writing.md](../d2-common/references/writing.md) | 説明を書く前 | 人が読む文章の書き方の決まり |
| [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) | 入出力を確かめるとき | 入出力の正本 (図は [dataflow.md](../d2-common/references/dataflow.md)) |
