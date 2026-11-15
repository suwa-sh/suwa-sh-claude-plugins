---
name: d2-decide
description: >-
  段階②「決定」。RDRA と USDM から非機能要求グレード表 (docs/nfr/) を推論し、アーキテクチャ決定記録 (docs/adr/) を書く。
  設計書 (arch design の yaml) は書かない。ADR の front matter に機械可読の rules を持たせ、段階③がルール文書とアーキテストを生成する。
  非機能グレード表は決定の根拠として ADR とは別に残す。
  mode=feedback (決定の差分) では、実装で見つかったルールの穴を新しい ADR 1 本にする。
  「NFR グレードを作成」「アーキテクチャの決定を記録」「ADR を書く」「ティア構成を決める」「認可モデルを選ぶ」などで発動。
---

# d2-decide

RDRA モデル、USDM、UC 一覧から、人が決めるべき 2 種類の成果物を作る。

| 成果物 | 場所 | 中身 |
|---|---|---|
| **非機能要求グレード表** | `docs/nfr/nfr-grade.yaml` / `.md` | IPA 非機能要求グレードを推論した表。決定の根拠になる |
| **アーキテクチャ決定記録 (ADR)** | `docs/adr/NNNN-<slug>.md` + `index.md` | ティア、レイヤ、データ、テストなどの決定。front matter に機械可読の `rules[]` を持つ |

設計書は書かない (レイヤ構成図や、データモデルの詳細の yaml など)。
それらは、段階④でコードから導くか、段階③のルールと契約で機械検証する。

## 呼び出し

進行役 (d2-run) が派遣する。

| 呼ばれ方 | いつ | すること |
|---|---|---|
| 引数なし | 段階② | 下の手順 1〜4 で、非機能要求グレード表と ADR を作る |
| `mode=feedback issue=<課題> result=<結果ファイル>` | 決定の差分 | 実装で見つかったルールの穴を、新しい ADR 1 本にする。手順は [references/feedback.md](references/feedback.md) にある |

パスの `<skills>` は、スキル群のディレクトリを指す。
定義は [../d2-common/SKILL.md](../d2-common/SKILL.md) の「パスの書き方」にある。

## 入出力

| 入力 | 出力 |
|---|---|
| `docs/requirements/requirements.yaml` (USDM) | `docs/nfr/nfr-grade.yaml` / `nfr-grade.md` |
| `docs/requirements/rdra/*.tsv` (RDRA モデル) | `docs/adr/NNNN-<slug>.md` (ADR 群) |
| `docs/requirements/use-cases.yaml` (UC 一覧: 業務/BUC/UC/slug/spec_ids/actors/status) | `docs/adr/index.md` (索引) |
| | `docs/adr/_review-summary.md` (人レビュー用) |

すべての出力の先頭に `basis: requirements@<sha>` を付ける。
`.md` は YAML front matter に書く。
`nfr-grade.yaml` は、トップレベルの `basis:` 文字列フィールドに書く。
basis は共有ライブラリで作る。

```bash
node <skills>/d2-common/scripts/lib/basis.js stamp requirements=docs/requirements
```

## 手順

| 順 | すること | 次へ進む条件 |
|---|---|---|
| 1 | 入力を読む | 判断材料を把握した |
| 2 | 非機能要求グレードを推論して出力する | `validateNfrGrade.js` が終了コード 0 を返す |
| 3 | 決定を導いて ADR を書く | 14 領域を覆い、`validateAdr.js` が PASS する。C4 図と索引を生成した |
| 4 | 人レビュー用の要約を書く | `docs/adr/_review-summary.md` を書いた |

**auto-adopt 方針**: 各領域で推奨案を採用して完走する。
推論の確信度が低い決定は、front matter に `confidence: low` を付ける。
手順 4 のレビュー要約で、人の確認対象にする。

### 1. 入力を読む

`docs/requirements/rdra/*.tsv` (全ファイル)、`docs/requirements/requirements.yaml`、`docs/requirements/use-cases.yaml` を読む。
次のことを把握する。
これが、NFR 推論と ADR の判断材料になる。

- アクター種別 (社内 / 社外)
- 状態遷移の数
- タイマー起動
- 外部システム
- 個人情報と金銭の有無

### 2. 非機能要求グレードを推論して出力する

次の順に参照する。

| 文書 | 内容 |
|---|---|
| [references/nfr-grade-catalog.md](references/nfr-grade-catalog.md) | IPA 6 大項目 (A 可用性 / B 性能 / C 運用 / D 移行 / E セキュリティ / F 環境) のカタログ |
| [references/nfr-inference-rules.md](references/nfr-inference-rules.md) | RDRA → NFR の推論ルール |
| [references/nfr/nfr-infer.md](references/nfr/nfr-infer.md) | 推論の進め方 |
| [references/nfr/nfr-dialogue.md](references/nfr/nfr-dialogue.md) | 確定の実行モード分岐 |
| [references/nfr-grade-schema.md](references/nfr-grade-schema.md) / [references/nfr/nfr-grade-output.md](references/nfr/nfr-grade-output.md) | 出力形式 |

確定の決まり:
**auto-adopt では対話の各選択肢を推奨値で仮置きし、その仮置きに依存するメトリクスだけ `confidence: low` にする。推論根拠 (RDRA の事実) から決まるメトリクスは high / medium を保つ。人の確認一覧は important かつ low。**
`--interactive` 指定時のみ対話する。

出力後、検証と Markdown 生成を実行する。

```bash
node <skills>/d2-decide/scripts/validateNfrGrade.js docs/nfr/nfr-grade.yaml
node <skills>/d2-decide/scripts/generateNfrGradeMd.js docs/nfr/nfr-grade.yaml
```

- 終了コード 0 (PASS) で次へ進む。1 (FAIL) は、エラーを直して再検証する
- `generateNfrGradeMd.js` は決定論的である (同一入力 → 同一出力)。手で md を書かない

### 3. 決定を導いて ADR を書く

[references/required-decisions.md](references/required-decisions.md) の 14 領域 (1〜8・10〜15) を最低限すべて覆う。
該当しない領域は、「不要」と 1 本の ADR で明記する (黙って省かない)。
9 番目「コンテキストの境界」は任意である。
業務ドメインが複数に分かれるときだけ `contexts[]` を書く。

各領域の判断材料は、決定候補カタログにある。

| 領域 | カタログ |
|---|---|
| ティア構成 | [decision-candidates/tiers.md](references/decision-candidates/tiers.md) |
| レイヤ構成と依存方向 | [decision-candidates/app-layers.md](references/decision-candidates/app-layers.md) |
| データストアと migration | [decision-candidates/data.md](references/decision-candidates/data.md) |
| メッセージング | [decision-candidates/messaging.md](references/decision-candidates/messaging.md) |
| 認証 / 認可 | [decision-candidates/auth.md](references/decision-candidates/auth.md) |
| テスト方針 | [decision-candidates/testing-stack.md](references/decision-candidates/testing-stack.md) |
| UI 部品の方針 | [decision-candidates/ui.md](references/decision-candidates/ui.md) |
| DDD の戦術設計 | [decision-candidates/ddd-tactical.md](references/decision-candidates/ddd-tactical.md) |
| イミュータブルデータモデル | [decision-candidates/immutable-data.md](references/decision-candidates/immutable-data.md) |
| エラーハンドリング | [decision-candidates/error-handling.md](references/decision-candidates/error-handling.md) |
| ログのルール | [decision-candidates/logging.md](references/decision-candidates/logging.md) |
| 機械チェック | [decision-candidates/machine-checks.md](references/decision-candidates/machine-checks.md) |
| 冪等性と再試行 | [decision-candidates/idempotency-retry.md](references/decision-candidates/idempotency-retry.md) |

各 ADR は [references/adr-format.md](references/adr-format.md) の形で、1 ファイルずつ書く。
`docs/adr/0001-<slug>.md` から連番にする。

全 ADR に共通の決まり:

| 項目 | 決まり |
|---|---|
| front matter の必須フィールド | `id` (クォート必須) / `title` / `status` / `date` / `basis` / `scope` |
| 本文 | 日本語で 背景 / 決定 / 却下した案 / 影響 の 4 節 |
| 題 (`title`) | **題 (`title`) は決めたこと 1 つを 60 字までで言い切る**。別の ADR の番号から始めない (`validateAdr.js` が止める) |
| `rules[]` | 該当する ADR は `rules[]` を最低 1 つ持つ。段階③の入力になる。カタログの「派生するルール例」を土台にする |
| 言語 / FW が未定のとき | 「未定」と明記した ADR を書く。ベンダーニュートラルにし、特定サービス名を使わない |

題は、開発ルールの要点の表と `docs/README.md` にそのまま出る。
前の決定を置き換える ADR も、新しい決定だけを題にする ([writing.md](../d2-common/references/writing.md))。

特定の ADR だけの決まり:

| ADR | 持つもの |
|---|---|
| ティア構成 (scope に system を含む 1 本だけ) | `arch_test.level: tier`。front matter に `tiers[]` と `datastore_owner` |
| レイヤ構成 | `arch_test.level: layer` |
| テスト方針 (accepted。scope に testing を含む) | `capabilities.browser` |
| 機械チェック (scope に system。1 本だけ) | front matter に `checks`。形は [decision-candidates/machine-checks.md](references/decision-candidates/machine-checks.md)。段階③が、一括チェックとコマンドを生成する入力にする |
| UI (scope に ui を含む。presentation ティアがあるとき) | `ui.brand` |

**ティア構成の ADR は `arch_test.level: tier` を、レイヤ構成の ADR は `arch_test.level: layer` を持つ**。

`tiers[]` には、ティアごとに `packages` を書く。
`packages` は、そのティアの決定 (枠組み・DB のクライアント・認証) で使う npm のパッケージ名である。
無ければ `[]` にする。
型定義は `dev_packages` に書く。
これらは、段階③の config、骨格、rules の入力になる。
形は adr-format.md の「段階③が読む追加の front matter」にある。

`ui.brand` の埋め方:

| 条件 | 埋め方 |
|---|---|
| `brand` スキルがある | 走らせるか、出力を読んで、`source: "brand skill"` で埋める |
| `brand` スキルが無い | RDRA から推論し、`source: "inferred"` と `brand.confidence: low` を付ける |

`brand` スキルは、`~/.claude/skills/brand` / `~/.agents/skills/brand` / `.claude/skills/brand`、またはプラグインのスキル一覧で探す。
詳細は [decision-candidates/ui.md](references/decision-candidates/ui.md) にある。
ブランドは、d2-design のトークンの起点になる (design 側で再推論しない)。

ADR を書き終えたら、検証、C4 図、索引を、この順で生成する。

```bash
node <skills>/d2-decide/scripts/validateAdr.js docs/adr
node <skills>/d2-decide/scripts/genArchitectureDoc.js docs/adr docs/adr/architecture.md \
  --contracts contracts/contracts.json --rdra docs/requirements/rdra requirements=docs/requirements
node <skills>/d2-decide/scripts/genAdrIndex.js docs/adr docs/adr/index.md requirements=docs/requirements
```

| スクリプト | すること |
|---|---|
| `validateAdr.js` | ADR を検査する。PASS するまで直す |
| `genArchitectureDoc.js` | 「決めたもの」の C4 図 (`docs/adr/architecture.md`) を決定論的に描く |
| `genAdrIndex.js` | id 昇順で、決定論的に `index.md` を生成する。`architecture.md` があれば、C4 図へのリンクを載せる |

上の順で先に architecture.md を作るので、索引には必ずリンクが付く。
各スクリプトが検査するものと描くものは [references/scripts.md](references/scripts.md) にある。

### 4. 人レビュー用の要約を書く

`docs/adr/_review-summary.md` を書く。
d2-run が、human-html-review で人に提示する材料になる。

- NFR 表のハイライト (重要メトリクスと、確信度が低い項目)
- 各 ADR を「決定」と「却下した案」の対で、平易な言葉で説明する。内部 ID や専門ジャーゴンを本文に出さない
- `confidence: low` の決定を「確認してほしいこと」として明示する
- **ブランド方針の由来** (`ui.brand.source`) を書く。`inferred` (RDRA から推論・低確信) のときは、色とフォントを「確認してほしいこと」に含める。`brand skill` のときは、その旨を記す

`confidence: low` の決定や確認してほしいことは、選択肢と推奨を、引き継ぎファイルの `asks` にも書く。
答えは、進行役が決めたことの記録に残す。

## 完了報告

段階②の報告:

- 生成した `docs/nfr/nfr-grade.yaml` と ADR 群のパス、ADR 件数
- 覆った決定領域の一覧 (「不要」とした領域も明記する)
- `confidence: low` の決定と、確認推奨項目 (上位数件)
- 検証スクリプトがすべて PASS したこと

mode=feedback の報告は [references/feedback.md](references/feedback.md) にある。

## やらないこと

- 設計 yaml (レイヤ図・データモデルの詳細) は書かない
- インフラ / ベンダー選定はしない (ベンダーニュートラルに保つ)
- 差分モード・スナップショットマージは扱わない (履歴は Git)
- mode=feedback で、開発ルール・アーキテスト・config を作り直さない (課題をすべて ADR にした後に、d2-run が作り直す)

## 引き継ぎファイル

作業の終わりに、進行役が派遣文で渡す場所 (`{handoff}`) に引き継ぎファイルを書く。
書くのは、人に聞きたいことと、自分の書き込み範囲では直せない前のステップの問題である。
報告の本文にだけ書いたことは扱われない。
推奨は条件を付けずに 1 つ書く。
書き方は [handoff.md](../d2-common/references/handoff.md) にある。

## 細目の文書

| 文書 | 読むとき | 内容 |
|---|---|---|
| [references/required-decisions.md](references/required-decisions.md) | 手順 3 の前 | 必ず決める領域 |
| [references/adr-format.md](references/adr-format.md) | ADR を書く前 | ADR の形と、段階③が読む front matter |
| [references/scripts.md](references/scripts.md) | 検証が落ちたとき、図の中身を確かめるとき | `validateAdr.js` が検査するもの、`genArchitectureDoc.js` が描くもの |
| [references/feedback.md](references/feedback.md) | `mode=feedback` で呼ばれたとき | 決定の差分の手順、読むもの、書くもの、報告 |
| [../d2-common/references/writing.md](../d2-common/references/writing.md) | 題と本文を書く前 | 人が読む文章の書き方の決まり |
| [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) | 入出力を確かめるとき | 入出力の正本 (図は [dataflow.md](../d2-common/references/dataflow.md)) |
