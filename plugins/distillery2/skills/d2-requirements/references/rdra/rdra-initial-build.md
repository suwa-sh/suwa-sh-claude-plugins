# RDRA 初期構築タスク

`docs/requirements/rdra/` が空または存在しない場合に、要望を USDM 分解してから USDM YAML を入力として RDRA フルビルドを実行し、結果を `docs/requirements/` 構成に配置する。

`docs/requirements/rdra/*.tsv` が既に存在する場合は初期構築ではなく差分更新となる。その場合は既存 TSV をその場で編集し、`generateRdraMd.js` でビューを再生成する。履歴は git が持つ。

## 前提条件

- 作業ディレクトリに要望テキスト（任意ファイル名。例: `docs/input/初期要望.txt`）が存在すること
- `docs/requirements/rdra/` が空または存在しないこと（初期構築の場合）

## 手順

### 1. USDM 分解

要望を USDM として構造化分解する。`references/usdm/usdm-decompose.md` に従い、要望テキストを USDM に分解する。

- 入力: 要望テキスト（ユーザー指定のファイル）
- 出力: `docs/requirements/requirements.yaml`

`event_id` はメタ情報のビルド識別子（`{YYYYMMDD_HHMMSS}_initial_build` 形式）。日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない。

バリデーション:

```bash
node <skill-path>/scripts/validateRequirements.js docs/requirements/requirements.yaml
```

分解後、人間が読める Markdown 形式に変換する:

```bash
node <skill-path>/scripts/generateRequirementsMd.js docs/requirements/requirements.yaml
```

これにより `docs/requirements/requirements.md` が生成される。

### 2. USDM YAML を入力とした RDRA フルビルド

内包された RDRA フルビルド手順（`references/rdra-phases/rdra-fullbuild.md` および `references/rdra-phases/phase1~5/`）の Phase1-5 + RDRA統合を実行する。
**ただし、各フェーズの共通コンテキストで `初期要望.txt` の代わりに `docs/requirements/requirements.yaml` を入力として使用する。**

各 subagent には以下のように指示する:
- `rdra-knowledge.md` を読み込む（従来どおり）
- `docs/requirements/requirements.yaml` を読み込む（`初期要望.txt` の代わり）
- USDM YAML の `requirements[].requirement`、`reason`、`specifications[].specification`、`affected_models` を要望の内容として解釈し、タスクプロンプトの指示に従って実行する

これにより以下が生成される:

- `0_RDRAZeroOne/phase1~4/` — 中間出力
- `1_RDRA/` — 統合出力（TSV + 関連データ + ZeroOne）

#### 関連データ生成スクリプトのパス解決に関する注意

RDRA統合ステップでは、関連データ生成スクリプトを実行する。これらのスクリプトはパス解決方法が異なるため注意が必要:

| スクリプト | パス解決方法 | 入力パス | 出力パス |
|-----------|-------------|---------|---------|
| `makeGraphData.js` | `process.cwd()` + 引数（デフォルト `1_RDRA`） | `{cwd}/1_RDRA/*.tsv` | `{cwd}/1_RDRA/関連データ.txt` |
| `makeZeroOneData.js` | `process.cwd()` + 引数（デフォルト `1_RDRA`） | `{cwd}/1_RDRA/*.tsv` | `{cwd}/1_RDRA/ZeroOne.txt` |
| `generateRdraMd.js` | `process.cwd()` + 引数（デフォルト `docs/requirements/rdra`） | `{引数}/*.tsv` | `{引数}/views/*.md` |

**makeGraphData.js** は `process.cwd()`（カレントディレクトリ）基準のため、ユーザー指定のルートディレクトリで実行すれば正しく動作する。

**makeZeroOneData.js** も cwd 基準（または第1引数）で動作する:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-requirements/scripts/makeZeroOneData.js 1_RDRA
```

### 3. docs ディレクトリへの配置

フルビルドの結果を `docs/requirements/rdra/` に配置する。

**配置前に整合性 lint を実行する（配置前のゲート）:**

```bash
node <skill-path>/scripts/generateRdraMd.js 1_RDRA --lint
```

- **エラー（未定義参照、exit 1）**: `1_RDRA/` の TSV を修正して再実行する（名前ゆれ・参照漏れの
  修正。エラー 0 件になるまで配置に進まない）
- **警告（未接続要素、exit 0）**: ブロックしない。ユーザーに提示し、意図的なスコープ外かを確認する

lint 合格後に配置する:

```bash
# ディレクトリ作成
mkdir -p docs/requirements/rdra

# 配置
cp 1_RDRA/アクター.tsv docs/requirements/rdra/
cp 1_RDRA/外部システム.tsv docs/requirements/rdra/
cp 1_RDRA/情報.tsv docs/requirements/rdra/
cp 1_RDRA/状態.tsv docs/requirements/rdra/
cp 1_RDRA/条件.tsv docs/requirements/rdra/
cp 1_RDRA/バリエーション.tsv docs/requirements/rdra/
cp 1_RDRA/BUC.tsv docs/requirements/rdra/
cp 1_RDRA/システム概要.json docs/requirements/rdra/
cp 1_RDRA/関連データ.txt docs/requirements/rdra/
cp 1_RDRA/ZeroOne.txt docs/requirements/rdra/
```

配置後、RDRA ビュー（ヒトが読む Markdown + Mermaid 図解）を生成する:

```bash
node <skill-path>/scripts/generateRdraMd.js docs/requirements/rdra
```

これにより `docs/requirements/rdra/views/*.md`（不整合チェック・システムコンテキスト・業務構成・業務フロー・UC複合図・情報モデル・状態モデル・条件バリエーション + README）が生成される。このスクリプトは決定論的（同一入力 → 同一出力）なため、LLM に依存せずバンドルスクリプトで実行する。

あわせて RDRA Sheet「✖不整合」シート相当の参照整合性チェック（15 項目: BUC 参照の未定義アクター/外部システム/情報/条件、情報・状態・条件シートの未定義参照、BUC 未参照の未接続要素）が実行され、結果が `views/00_不整合チェック.md` とコンソールに出力される。不整合が検出された場合はユーザーに提示し、TSV を修正するか許容するかを確認する（自動修正はしない）。

### 4. 一時ディレクトリの削除

RDRA フルビルドで使用した一時ディレクトリを削除する:

```bash
rm -rf 0_RDRAZeroOne/
rm -rf 1_RDRA/
```

### 初期構築後のワークフロー

初期構築完了後は UC 一覧（`docs/requirements/use-cases.yaml`）を生成し、後続の d2-decide 以降へ引き渡す。UC 一覧生成は本スキルの `scripts/genUseCases.js` の責務。

## 出力チェック

`docs/requirements/rdra/` に以下のファイルが揃っていることを確認:

- `システム概要.json`
- `アクター.tsv`
- `外部システム.tsv`
- `情報.tsv`
- `状態.tsv`
- `条件.tsv`
- `バリエーション.tsv`
- `BUC.tsv`
- `関連データ.txt`
- `ZeroOne.txt`
- `views/README.md`（+ `00_不整合チェック.md` 〜 `07_条件・バリエーション.md`）
