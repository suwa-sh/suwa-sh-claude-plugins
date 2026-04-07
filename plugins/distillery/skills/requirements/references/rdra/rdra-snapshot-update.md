# RDRA スナップショット更新タスク

差分 TSV を `docs/rdra/latest/` にマージし、関連データを再生成する。

## 入力

- `docs/rdra/events/{event_id}/*.tsv` — 差分 TSV
- `docs/rdra/events/{event_id}/_changes.md` — 変更サマリ
- `docs/rdra/latest/*.tsv` — 現在のスナップショット

## 出力

- 更新された `docs/rdra/latest/*.tsv`
- 再生成された `docs/rdra/latest/関連データ.txt`
- 再生成された `docs/rdra/latest/ZeroOne.txt`

## マージ手順

### 1. 変更サマリの読み込み

`_changes.md` を読み、追加・変更・削除の対象を把握する。

### 2. TSV マージ

イベントに含まれる各 TSV ファイルについて、以下のルールで latest にマージする。

#### マージキー

各 TSV のマージキー（行を一意に特定するカラム）:

| TSV ファイル | マージキー |
|-------------|-----------|
| アクター.tsv | アクター（2列目） |
| 外部システム.tsv | 外部システム（2列目） |
| 情報.tsv | 情報（2列目） |
| 状態.tsv | コンテキスト（1列目）+ 状態モデル（2列目）+ 状態（3列目） |
| 条件.tsv | コンテキスト（1列目）+ 条件（2列目） |
| バリエーション.tsv | コンテキスト（1列目）+ バリエーション（2列目） |
| BUC.tsv | BUC（2列目）+ UC（6列目） |

#### 複合キーの比較方法

複合キーのマージでは、対象の全カラムが完全一致した場合に「同一行」と判定する。

例: 状態.tsv のマージ

```
Latest:  コンテキスト	状態モデル	状態	遷移UC	遷移先状態	説明
         蔵書管理	蔵書状態	利用可能	貸出を登録する	貸出中	...

Event:   コンテキスト	状態モデル	状態	遷移UC	遷移先状態	説明
         レビュー管理	レビュー状態	公開中	レビューを削除する	削除済	...（新規）

結果:    蔵書管理	蔵書状態	利用可能	貸出を登録する	貸出中	...（維持）
         レビュー管理	レビュー状態	公開中	レビューを削除する	削除済	...（追加）
```

キー「レビュー管理+レビュー状態+公開中」は latest に存在しないため追加される。

#### 追加行の処理

イベント TSV のデータ行のうち、マージキーが latest に存在しないものを latest の末尾に追加する。

#### 変更行の処理

イベント TSV のデータ行のうち、マージキーが latest に存在するものは、latest の該当行をイベント側の内容で上書きする。

#### 削除行の処理

`_changes.md` の「削除」セクションに記載された要素を、latest から該当行を除去する。

### 3. 整合性チェック

マージ後の latest 全体で以下の整合性を確認する:

- BUC.tsv で参照されているアクターが アクター.tsv に存在するか
- BUC.tsv で参照されている情報が 情報.tsv に存在するか
- BUC.tsv で参照されている条件が 条件.tsv に存在するか
- BUC.tsv で参照されている外部システムが 外部システム.tsv に存在するか

不整合がある場合は警告メッセージを出力する（自動修正はしない）。

### 4. 関連データ再生成

スキルのスクリプトを使用して関連データを再生成する。

```bash
# 1. 一時ディレクトリを作成し、latest の TSV をコピー
mkdir -p 1_RDRA
cp docs/rdra/latest/*.tsv 1_RDRA/
cp docs/rdra/latest/システム概要.json 1_RDRA/

# 2. makeGraphData.js: process.cwd() 基準のため、ルートディレクトリで実行すれば OK
node scripts/makeGraphData.js

# 3. makeZeroOneData.js: __dirname/../../1_RDRA/ 基準のため、シンボリックリンクで対処
# Plugin 互換: makeZeroOneData.js は cwd 基準（または引数）で動作する
node ${CLAUDE_PLUGIN_ROOT}/skills/requirements/scripts/makeZeroOneData.js 1_RDRA

# 4. 生成結果を latest にコピーし、一時ディレクトリを削除
cp 1_RDRA/関連データ.txt docs/rdra/latest/
cp 1_RDRA/ZeroOne.txt docs/rdra/latest/
rm -rf 1_RDRA/
```

#### スクリプトのパス解決方法の違い

| スクリプト | パス解決方法 | 備考 |
|-----------|-------------|------|
| `makeGraphData.js` | `process.cwd()` + 引数（デフォルト `1_RDRA`） | カレントディレクトリ基準。そのまま実行可能 |
| `makeZeroOneData.js` | `__dirname/../../1_RDRA/` | スクリプトの親の親ディレクトリ基準。シンボリックリンクで対処が必要 |

注意: `<skill-path>` は本スキル（`requirements`）のパス。

## エラーハンドリング

_changes.md が以下の問題を持つ場合、パイプラインを停止して修正を指示する:

- 「追加」「変更」「削除」セクションが存在しない → _changes.md のフォーマットを確認
- モデル種別が英語名（例: "information" ではなく "情報"）→ 日本語名に修正
- 削除対象の要素が docs/rdra/latest/*.tsv に存在しない → _changes.md の要素名を確認

## 出力ルール

- マージ後の TSV はヘッダー行 + データ行の構成を維持する
- 空行は含めない
- タブ区切り、UTF-8
- latest の TSV ファイル構成は変更しない（ファイルの追加・削除はしない）
