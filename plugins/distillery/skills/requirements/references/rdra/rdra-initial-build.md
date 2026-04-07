# RDRA 初期構築タスク

`docs/rdra/latest/` が空または存在しない場合に、初期要望を USDM 分解してから USDM YAML を入力として RDRA フルビルドを実行し、結果を docs 構成に配置する。

## 前提条件

- 作業ディレクトリに初期要望テキスト（任意ファイル名）が存在すること
- `docs/rdra/latest/` が空または存在しないこと

## 手順

### 1. USDM 分解

初期要望を USDM として構造化分解する。`references/usdm/usdm-decompose.md` に従い、初期要望テキストを USDM に分解する。

- 入力: 初期要望テキスト（ユーザー指定のファイル）
- 出力:
  - `docs/usdm/events/{event_id}/requirements.yaml`
  - `docs/usdm/events/{event_id}/source.txt`

`{event_id}` は `{YYYYMMDD_HHMMSS}_initial_build` 形式。日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない。

バリデーション:

```bash
node <skill-path>/scripts/validateRequirements.js docs/usdm/events/{event_id}/requirements.yaml
```

### 2. USDM スナップショット作成

`references/usdm/usdm-snapshot-update.md` に従い、初回なので requirements.yaml をそのまま `docs/usdm/latest/requirements.yaml` に配置する。

スナップショット作成後、人間が読める Markdown 形式に変換する:

```bash
node <skill-path>/scripts/generateRequirementsMd.js docs/usdm/latest/requirements.yaml
```

これにより `docs/usdm/latest/requirements.md` が生成される。

### 3. USDM YAML を入力とした RDRA フルビルド

内包された RDRA フルビルド手順（`references/rdra-phases/rdra-fullbuild.md` および `references/rdra-phases/phase1~5/`）の Phase1-5 + RDRA統合を実行する。
**ただし、各フェーズの共通コンテキストで `初期要望.txt` の代わりに `docs/usdm/latest/requirements.yaml` を入力として使用する。**

各 subagent には以下のように指示する:
- `rdra-knowledge.md` を読み込む（従来どおり）
- `docs/usdm/latest/requirements.yaml` を読み込む（`初期要望.txt` の代わり）
- USDM YAML の `requirements[].requirement`、`reason`、`specifications[].specification`、`affected_models` を初期要望の内容として解釈し、タスクプロンプトの指示に従って実行する

これにより以下が生成される:

- `0_RDRAZeroOne/phase1~4/` — 中間出力
- `1_RDRA/` — 統合出力（TSV + 関連データ + ZeroOne）

#### 関連データ生成スクリプトのパス解決に関する注意

rdra スキルの RDRA統合ステップでは、関連データ生成スクリプトを実行する。これらのスクリプトはパス解決方法が異なるため注意が必要:

| スクリプト | パス解決方法 | 入力パス | 出力パス |
|-----------|-------------|---------|---------|
| `makeGraphData.js` | `process.cwd()` + 引数（デフォルト `1_RDRA`） | `{cwd}/1_RDRA/*.tsv` | `{cwd}/1_RDRA/関連データ.txt` |
| `makeZeroOneData.js` | `__dirname/../../1_RDRA/` | `{スクリプトの親の親}/1_RDRA/*.tsv` | `{スクリプトの親の親}/1_RDRA/ZeroOne.txt` |

**makeGraphData.js** は `process.cwd()`（カレントディレクトリ）基準のため、ユーザー指定のルートディレクトリで実行すれば正しく動作する。

**makeZeroOneData.js** は `__dirname`（スクリプト自身のディレクトリ）基準で `../../1_RDRA/` を参照するため、パッチ済み: cwd 基準で動作するようになった。

**対処法**: makeZeroOneData.js を実行する際は、一時的にシンボリックリンクを作成してパスを解決する:

```bash
# Plugin 互換: makeZeroOneData.js は cwd 基準（または引数）で動作する
node ${CLAUDE_PLUGIN_ROOT}/skills/requirements/scripts/makeZeroOneData.js 1_RDRA
```

### 4. docs ディレクトリへの配置

フルビルドの結果を docs 構成に配置する。

```bash
# ディレクトリ作成
mkdir -p docs/rdra/latest
mkdir -p docs/rdra/events/{event_id}

# latest にコピー
cp 1_RDRA/アクター.tsv docs/rdra/latest/
cp 1_RDRA/外部システム.tsv docs/rdra/latest/
cp 1_RDRA/情報.tsv docs/rdra/latest/
cp 1_RDRA/状態.tsv docs/rdra/latest/
cp 1_RDRA/条件.tsv docs/rdra/latest/
cp 1_RDRA/バリエーション.tsv docs/rdra/latest/
cp 1_RDRA/BUC.tsv docs/rdra/latest/
cp 1_RDRA/システム概要.json docs/rdra/latest/
cp 1_RDRA/関連データ.txt docs/rdra/latest/
cp 1_RDRA/ZeroOne.txt docs/rdra/latest/
```

### 5. 初期構築イベントの記録

初期構築もイベントとして記録する:

```bash
# events にも全ファイルをコピー
cp docs/rdra/latest/*.tsv docs/rdra/events/{event_id}/
cp docs/rdra/latest/システム概要.json docs/rdra/events/{event_id}/
```

`_changes.md` を以下の内容で作成:

```markdown
# 変更サマリ

- event_id: {event_id}
- 元USDM: docs/usdm/events/{event_id}/requirements.yaml
- 生成日時: {YYYY-MM-DDTHH:MM:SS}

## 追加

- 全モデル要素を初期構築として追加

## 変更

- なし

## 削除

- なし
```

### 6. 一時ディレクトリの削除

RDRA フルビルドで使用した一時ディレクトリを削除する:

```bash
rm -rf 0_RDRAZeroOne/
rm -rf 1_RDRA/
```

### Step0 後のワークフロー

初期構築完了後、続けて Step4（Spec 生成）→ Step5（Spec スナップショット更新）を実行する。
初期構築時の Step4 では、`_changes.md` に「全モデル要素を初期構築として追加」と記載されているため、`docs/rdra/latest/BUC.tsv` に含まれる **全 UC** を対象として Spec を生成する。

## 出力チェック

`docs/rdra/latest/` に以下のファイルが揃っていることを確認:

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
