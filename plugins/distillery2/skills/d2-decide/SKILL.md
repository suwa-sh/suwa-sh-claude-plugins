---
name: distillery2:d2-decide
description: >-
  段階②「決定」。RDRA と USDM から非機能要求グレード表 (docs/nfr/) を推論し、アーキテクチャ決定記録 (docs/adr/) を書く。
  設計書 (arch design の yaml) は書かない。ADR の front matter に機械可読の rules を持たせ、段階③がルール文書とアーキテストを生成する。
  非機能グレード表は決定の根拠として ADR とは別に残す。
  「NFR グレードを作成」「アーキテクチャの決定を記録」「ADR を書く」「ティア構成を決める」「認可モデルを選ぶ」などで発動。
---

# d2-decide (段階② 決定)

RDRA モデル・USDM・UC 一覧から、人が決めるべき 2 種類の成果物を作る。

1. **非機能要求グレード表** (`docs/nfr/nfr-grade.yaml` / `.md`): IPA 非機能要求グレードを推論した表。決定の根拠。
2. **アーキテクチャ決定記録 (ADR)** (`docs/adr/NNNN-<slug>.md` + `index.md`): ティア・レイヤ・データ・テスト等の決定。front matter に機械可読の `rules[]` を持つ。

設計書 (レイヤ構成図・データモデルの詳細 yaml 等) は書かない。それらはコードから導く (段階④) か、ルール / 契約 (段階③) で機械検証する。

## 入出力

| 入力 | 出力 |
|---|---|
| `docs/requirements/requirements.yaml` (USDM) | `docs/nfr/nfr-grade.yaml` / `nfr-grade.md` |
| `docs/requirements/rdra/*.tsv` (RDRA モデル) | `docs/adr/NNNN-<slug>.md` (ADR 群) |
| `docs/requirements/use-cases.yaml` (UC 一覧: 業務/BUC/UC/slug/spec_ids/actors/status) | `docs/adr/index.md` (索引) |
| | `docs/adr/_review-summary.md` (人レビュー用) |

すべての出力の先頭に `basis: requirements@<sha>` を付ける。`.md` は YAML front matter、`nfr-grade.yaml` はトップレベルの `basis:` 文字列フィールド。basis は共有ライブラリで作る:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/lib/basis.js stamp requirements=docs/requirements
```

## 手順

### 1. 入力を読む

- `docs/requirements/rdra/*.tsv` (全ファイル)、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml` を読む。
- アクター種別 (社内 / 社外)、状態遷移の数、タイマー起動、外部システム、個人情報 / 金銭の有無を把握する。これが NFR 推論と ADR の判断材料になる。

### 2. 非機能要求グレードを推論して出力する

NFR の推論は v1 手順を移植している。順に参照する:

- [references/nfr-grade-catalog.md](references/nfr-grade-catalog.md) — IPA 6 大項目 (A 可用性 / B 性能 / C 運用 / D 移行 / E セキュリティ / F 環境) カタログ
- [references/nfr-inference-rules.md](references/nfr-inference-rules.md) — RDRA → NFR 推論ルール
- [references/nfr/nfr-infer.md](references/nfr/nfr-infer.md) — 推論の進め方
- [references/nfr/nfr-dialogue.md](references/nfr/nfr-dialogue.md) — 確定の実行モード分岐。**auto-adopt では対話の各選択肢を推奨値で仮置きし、その仮置きに依存するメトリクスだけ `confidence: low` にする。推論根拠 (RDRA の事実) から決まるメトリクスは high / medium を保つ。人の確認一覧は important かつ low。** `--interactive` 指定時のみ対話する
- [references/nfr-grade-schema.md](references/nfr-grade-schema.md) / [references/nfr/nfr-grade-output.md](references/nfr/nfr-grade-output.md) — 出力形式

出力後、検証と Markdown 生成を実行する:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/validateNfrGrade.js docs/nfr/nfr-grade.yaml
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/generateNfrGradeMd.js docs/nfr/nfr-grade.yaml
```

- 終了コード 0 (PASS) で次へ。1 (FAIL) はエラーを直して再検証する。
- `generateNfrGradeMd.js` は決定論的 (同一入力 → 同一出力)。手で md を書かない。

### 3. 決定を導いて ADR を書く

[references/required-decisions.md](references/required-decisions.md) の 8 領域を最低限すべて覆う。該当しない領域は「不要」と 1 本の ADR で明記する (黙って省かない)。

各領域の判断材料は決定候補カタログにある:

| 領域 | カタログ |
|---|---|
| ティア構成 | [decision-candidates/tiers.md](references/decision-candidates/tiers.md) |
| レイヤ構成と依存方向 | [decision-candidates/app-layers.md](references/decision-candidates/app-layers.md) |
| データストアと migration | [decision-candidates/data.md](references/decision-candidates/data.md) |
| メッセージング | [decision-candidates/messaging.md](references/decision-candidates/messaging.md) |
| 認証 / 認可 | [decision-candidates/auth.md](references/decision-candidates/auth.md) |
| テスト方針 | [decision-candidates/testing-stack.md](references/decision-candidates/testing-stack.md) |
| UI 部品の方針 | [decision-candidates/ui.md](references/decision-candidates/ui.md) |

各 ADR は [references/adr-format.md](references/adr-format.md) の形で 1 ファイルずつ書く (`docs/adr/0001-<slug>.md` から連番)。要点:

- front matter の必須フィールド: `id` (クォート必須) / `title` / `status` / `date` / `basis` / `scope`。
- 本文は日本語で 背景 / 決定 / 却下した案 / 影響 の 4 節。
- 該当する ADR は `rules[]` を最低 1 つ持つ。**ティア構成とレイヤ構成の ADR は `arch_test` を持つ**。
- **ティア構成の ADR は front matter に `tiers[]` と `datastore_owner` を、テスト方針の ADR は `capabilities.browser` を持つ**
  (段階③の config / 骨格 / rules の入力。形は adr-format.md「段階③が読む追加の front matter」)。
- `rules[]` は段階③ の入力になる。カタログの「派生するルール例」を土台にする。
- 言語 / FW が未定なら「未定」と明記した ADR を書く (ベンダーニュートラル。特定サービス名を使わない)。

**auto-adopt 方針**: 各領域で推奨案を採用して完走する。推論の確信度が低い決定は front matter に `confidence: low` を付け、手順 4 のレビュー要約で人の確認対象にする。

ADR を書き終えたら検証と索引生成:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/validateAdr.js docs/adr
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/genAdrIndex.js docs/adr docs/adr/index.md requirements=docs/requirements
```

- `validateAdr.js` はスキーマ・id 一意性・参照整合性 (supersedes / superseded_by の双方向)・status 遷移・`rules[].scope` 書式に加え、ティア構成 ADR がちょうど 1 本あること・`rules[]` のカバレッジ (該当 scope の rules 必須、ティア/レイヤの `arch_test`) を検査する。PASS するまで直す。
- `genAdrIndex.js` は id 昇順で決定論的に `index.md` を生成する。

### 4. 人レビュー用の要約を書く

`docs/adr/_review-summary.md` を書く。オーケストレータ (d2-run) が human-html-review でヒトに提示する材料になる。

- NFR 表のハイライト (重要メトリクスと確信度が低い項目)。
- 各 ADR を「決定」と「却下した案」の対で、平易な言葉で説明する。内部 ID や専門ジャーゴンを本文に出さない。
- `confidence: low` の決定を「確認してほしいこと」として明示する。

## 完了報告

- 生成した `docs/nfr/nfr-grade.yaml` と ADR 群のパス、ADR 件数。
- 覆った 8 決定領域の一覧 (「不要」とした領域も明記)。
- `confidence: low` の決定と、確認推奨項目 (上位数件)。
- 検証スクリプトがすべて PASS したこと。

## やらないこと

- 設計 yaml (レイヤ図・データモデルの詳細) は書かない。
- インフラ / ベンダー選定はしない (ベンダーニュートラルに保つ)。
- 差分モード・スナップショットマージはイテレーション 1 では扱わない (履歴は Git)。
