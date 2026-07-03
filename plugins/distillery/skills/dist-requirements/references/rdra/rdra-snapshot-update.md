# RDRA スナップショット更新タスク

差分 TSV をステージング（`_rdra_staging/`）にマージし、整合性 lint に合格してから
`docs/rdra/latest/` を確定して関連データを再生成する。

## 入力

- `docs/rdra/events/{event_id}/*.tsv` — 差分 TSV
- `docs/rdra/events/{event_id}/_changes.md` — 変更サマリ
- `docs/rdra/latest/*.tsv` — 現在のスナップショット

## 出力

- 更新された `docs/rdra/latest/*.tsv`
- 再生成された `docs/rdra/latest/関連データ.txt`
- 再生成された `docs/rdra/latest/ZeroOne.txt`
- 再生成された `docs/rdra/latest/views/*.md`（Mermaid 図解つきの人間可読ビュー）

## マージ手順

### 1. 変更サマリの読み込み

`_changes.md` を読み、追加・変更・削除の対象を把握する。

### 2. TSV マージ（ステージング）

latest を直接更新せず、まずステージングディレクトリにマージする。整合性 lint（手順 3）に
合格するまで latest には反映しない。

```bash
rm -rf _rdra_staging
mkdir -p _rdra_staging
cp docs/rdra/latest/*.tsv _rdra_staging/
cp docs/rdra/latest/システム概要.json _rdra_staging/
```

イベントに含まれる各 TSV ファイルについて、以下のルールで `_rdra_staging/` 内の TSV にマージする
（以降のマージルールで「latest」とあるのはステージング内のコピーを指す）。

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

### 3. 整合性 lint（latest 確定前）

マージ後のステージングに対して整合性 lint を実行する。手動でのチェックは行わない。

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/scripts/generateRdraMd.js _rdra_staging --lint
```

RDRA Sheet「✖不整合」シート相当の 15 項目（BUC 参照の未定義アクター/外部システム/情報/条件、
情報・状態・条件シートの未定義参照、BUC 未参照の未接続要素）をチェックする。

- **エラー（未定義参照、exit 1）**: イベント側（`docs/rdra/events/{event_id}/*.tsv` と `_changes.md`）を
  修正し、手順 2 からやり直す（ステージングは作り直す）。ステージングや latest を直接修正しては
  ならない（イベントソーシングではイベントが正）。
- **警告（未接続要素、exit 0）**: ブロックしない。ユーザーに提示し、意図的なスコープ外かを確認する。

lint がエラー 0 件になるまで手順 2〜3 を繰り返す。

### 4. latest 確定

lint 合格後、ステージングの TSV を latest に反映し、ステージングを削除する。

```bash
cp _rdra_staging/*.tsv docs/rdra/latest/
rm -rf _rdra_staging
```

### 5. 関連データ再生成

スキルのスクリプトを使用して関連データを再生成する。

```bash
# 1. 一時ディレクトリを作成し、latest の TSV をコピー
mkdir -p 1_RDRA
cp docs/rdra/latest/*.tsv 1_RDRA/
cp docs/rdra/latest/システム概要.json 1_RDRA/

# 2. makeGraphData.js: cwd 基準（または第1引数、デフォルト 1_RDRA）で動作する
node ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/scripts/makeGraphData.js 1_RDRA

# 3. makeZeroOneData.js: cwd 基準（または第1引数）で動作する
node ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/scripts/makeZeroOneData.js 1_RDRA

# 4. 生成結果を latest にコピーし、一時ディレクトリを削除
cp 1_RDRA/関連データ.txt docs/rdra/latest/
cp 1_RDRA/ZeroOne.txt docs/rdra/latest/
rm -rf 1_RDRA/
```

### 6. RDRA ビュー再生成 + 不整合チェック

ヒトが読む Markdown ビュー（Mermaid 図解つき）を再生成する。決定論的スクリプトのため LLM に依存しない。

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/scripts/generateRdraMd.js docs/rdra/latest
```

これにより `docs/rdra/latest/views/*.md` が再生成される（既存の views/*.md は削除してから生成される）。
あわせて RDRA Sheet「✖不整合」相当の参照整合性チェック（15 項目）が再実行され、
結果が `views/00_不整合チェック.md` とコンソールに出力される。手順 3 の lint に合格していれば
エラーは 0 件のはずで、残るのは許容済みの警告（未接続要素）のみ。
CI 等で不整合をエラーにしたい場合は `--strict` オプションを付ける（警告含め 1 件以上で exit code 1）。

#### スクリプトのパス解決方法の違い

| スクリプト | パス解決方法 | 備考 |
|-----------|-------------|------|
| `makeGraphData.js` | `process.cwd()` + 引数（デフォルト `1_RDRA`） | カレントディレクトリ基準。そのまま実行可能 |
| `makeZeroOneData.js` | `process.cwd()` + 引数（デフォルト `1_RDRA`） | カレントディレクトリ基準。そのまま実行可能 |
| `generateRdraMd.js` | `process.cwd()` + 引数（デフォルト `docs/rdra/latest`） | カレントディレクトリ基準。そのまま実行可能 |

注意: `<skill-path>` は本スキル（`dist-requirements`）のパス。

## エラーハンドリング

_changes.md が以下の問題を持つ場合、パイプラインを停止して修正を指示する:

- 「追加」「変更」「削除」セクションが存在しない → _changes.md のフォーマットを確認
- モデル種別が英語名（例: "information" ではなく "情報"）→ 日本語名に修正
- 削除対象の要素が docs/rdra/latest/*.tsv に存在しない → _changes.md の要素名を確認

整合性 lint（手順 3）がエラーを検出した場合は、イベント TSV / _changes.md を修正して
手順 2 から再実行する（latest は未更新のまま保たれる）。

## 出力ルール

- マージ後の TSV はヘッダー行 + データ行の構成を維持する
- 空行は含めない
- タブ区切り、UTF-8
- latest の TSV ファイル構成は変更しない（ファイルの追加・削除はしない）
