---
name: rdra
description: >
  RDRA（Relationship Driven Requirement Analysis）2.0 による要件定義モデリングスキル。
  初期要望テキストから5フェーズで段階的にRDRAモデルを自動生成し、さらに仕様（論理データモデル・ビジネスルール・画面定義）まで作成する。
  要件定義、要件分析、RDRA、RDRAモデル、ビジネスユースケース、BUC、アクター、情報モデル、状態モデル、
  要求分析、初期要望、業務分析、システム仕様に関するタスクで使用する。
  ユーザーが「要件定義して」「RDRAで分析して」「初期要望から要件を整理して」「BUCを作って」
  「アクターを洗い出して」「仕様を作って」などと言ったら積極的にこのスキルを使うこと。
---

# RDRA要件定義スキル

RDRA 2.0（Relationship Driven Requirement Analysis）の手法に基づき、初期要望テキストから段階的にRDRAモデルを自動生成する。

## 前提条件

- 作業ディレクトリに `初期要望.txt` が存在すること
- `初期要望.txt` は実現したいビジネスとシステムについて自然言語で記述されたテキスト

## 全体フロー

```
初期要望.txt
  → Phase1: 基礎要素の特定（11タスク並列）
  → Phase2: 要素の詳細化（3タスク並列）
  → Phase3: コンテキスト整理（3タスク並列）
  → Phase4: 関係モデル変換（4タスク並列）
  → Phase5: システム概要生成
  → RDRA統合（1_RDRA/ へ集約 + 関連データ生成）
  → 仕様生成（論理データ・ビジネスルール・画面定義）
```

ユーザーが特定フェーズだけを指定した場合はそのフェーズのみ実行する。
指定がない場合は Phase1 から順に全フェーズを実行する。

## 共通ルール

### TSVファイルの出力規則
- 出力形式: TSV（タブ区切り）
- エンコーディング: UTF-8
- 1行目は必ずヘッダー（カラム名）行を出力する
- 出力内容の判断に迷った場合は可能性の一番高いものを選択する

### ファイル生成の原則
- テンプレートやプレースホルダーのファイルは作成しない — 必ず完全な内容を生成する
- 既存ファイルがある場合は上書きする
- 出力先ディレクトリが存在しない場合は作成する

---

## Phase1: 基礎要素の特定

初期要望から RDRA の基本要素を個別に洗い出す。

### 共通コンテキスト
以下のファイルを読み込んで理解する:
- `rdra-knowledge.md` — RDRA基本概念
- `初期要望.txt` — ユーザーの要望

### タスク（並列実行）
以下のタスクプロンプトを **subagent で並列実行** する。各 subagent には上記の共通コンテキスト（rdra-knowledge.md と 初期要望.txt）を読んだ上で、指定のタスクプロンプトに従って実行するよう指示する:

| # | タスクプロンプト | 出力ファイル |
|---|----------------|-------------|
| 1 | `references/phase1/初期要望分析生成.md` | `0_RDRAZeroOne/phase1/初期要望分析.md` |
| 2 | `references/phase1/アクター生成.md` | `0_RDRAZeroOne/phase1/アクター.tsv` |
| 3 | `references/phase1/外部システム生成.md` | `0_RDRAZeroOne/phase1/外部システム.tsv` |
| 4 | `references/phase1/ビジネスポリシー生成.md` | `0_RDRAZeroOne/phase1/ビジネスポリシー.tsv` |
| 5 | `references/phase1/ビジネスパラメータ生成.md` | `0_RDRAZeroOne/phase1/ビジネスパラメータ.tsv` |
| 6 | `references/phase1/業務生成.md` | `0_RDRAZeroOne/phase1/業務.tsv` |
| 7 | `references/phase1/情報生成.md` | `0_RDRAZeroOne/phase1/情報.tsv` |
| 8 | `references/phase1/状態生成.md` | `0_RDRAZeroOne/phase1/状態.tsv` |
| 9 | `references/phase1/バリエーション生成.md` | `0_RDRAZeroOne/phase1/バリエーション.tsv` |
| 10 | `references/phase1/条件生成.md` | `0_RDRAZeroOne/phase1/条件.tsv` |
| 11 | `references/phase1/要求生成.md` | `0_RDRAZeroOne/phase1/要求.tsv` |

### 出力チェック
以下のファイルが `0_RDRAZeroOne/phase1/` に生成されていることを確認:
- `初期要望分析.md`, `アクター.tsv`, `外部システム.tsv`, `ビジネスポリシー.tsv`, `ビジネスパラメータ.tsv`, `業務.tsv`, `情報.tsv`, `状態.tsv`, `バリエーション.tsv`, `条件.tsv`, `要求.tsv`

---

## Phase2: 要素の詳細化

Phase1の出力を基に、業務・情報・状態を詳細化する。

### 共通コンテキスト
以下のファイルを読み込んで理解する:
- `rdra-knowledge.md` — RDRA基本概念
- `0_RDRAZeroOne/phase1/初期要望分析.md`
- `0_RDRAZeroOne/phase1/業務.tsv`
- `0_RDRAZeroOne/phase1/アクター.tsv`
- `0_RDRAZeroOne/phase1/状態.tsv`
- `0_RDRAZeroOne/phase1/ビジネスポリシー.tsv`

### タスク（並列実行）
以下のタスクプロンプトを **subagent で並列実行** する。各 subagent には上記の共通コンテキストを読んだ上で実行するよう指示する:

| # | タスクプロンプト | 出力ファイル |
|---|----------------|-------------|
| 1 | `references/phase2/業務生成.md` | `0_RDRAZeroOne/phase2/業務.tsv` |
| 2 | `references/phase2/情報生成.md` | `0_RDRAZeroOne/phase2/情報.tsv` |
| 3 | `references/phase2/状態生成.md` | `0_RDRAZeroOne/phase2/状態.tsv` |

### 出力チェック
以下のファイルが `0_RDRAZeroOne/phase2/` に生成されていることを確認:
- `業務.tsv`, `情報.tsv`, `状態.tsv`

---

## Phase3: コンテキスト整理

Phase2の出力を基に、アクター・BUC・情報をコンテキストで整理する。

### 共通コンテキスト
以下のファイルを読み込んで理解する:
- `rdra-knowledge.md` — RDRA基本概念
- `0_RDRAZeroOne/phase2/業務.tsv`
- `0_RDRAZeroOne/phase1/アクター.tsv`
- `0_RDRAZeroOne/phase2/情報.tsv`

### タスク（並列実行）
以下のタスクプロンプトを **subagent で並列実行** する:

| # | タスクプロンプト | 出力ファイル |
|---|----------------|-------------|
| 1 | `references/phase3/アクター生成.md` | `0_RDRAZeroOne/phase3/アクター.tsv` |
| 2 | `references/phase3/BUC生成.md` | `0_RDRAZeroOne/phase3/BUC.tsv` |
| 3 | `references/phase3/情報生成.md` | `0_RDRAZeroOne/phase3/情報.tsv` |

### 出力チェック
以下のファイルが `0_RDRAZeroOne/phase3/` に生成されていることを確認:
- `アクター.tsv`, `BUC.tsv`, `情報.tsv`

---

## Phase4: 関係モデル変換

Phase3の出力を RDRASheet 形式の最終フォーマットに変換する。

### 共通コンテキスト
以下のファイルを読み込んで理解する:
- `rdra-knowledge.md` — RDRA基本概念
- `0_RDRAZeroOne/phase3/BUC.tsv`
- `0_RDRAZeroOne/phase3/情報.tsv`
- `0_RDRAZeroOne/phase2/状態.tsv`

### タスク（並列実行）
以下のタスクプロンプトを **subagent で並列実行** する:

| # | タスクプロンプト | 出力ファイル |
|---|----------------|-------------|
| 1 | `references/phase4/BUC生成.md` | `0_RDRAZeroOne/phase4/BUC.tsv` |
| 2 | `references/phase4/バリエーション生成.md` | `0_RDRAZeroOne/phase4/バリエーション.tsv` |
| 3 | `references/phase4/条件生成.md` | `0_RDRAZeroOne/phase4/条件.tsv` |
| 4 | `references/phase4/状態生成.md` | `0_RDRAZeroOne/phase4/状態.tsv` |

### 出力チェック
以下のファイルが `0_RDRAZeroOne/phase4/` に生成されていることを確認:
- `BUC.tsv`, `バリエーション.tsv`, `条件.tsv`, `状態.tsv`

---

## Phase5: システム概要生成

初期要望からシステム名と概要を生成する。

### タスク
`references/phase5/システム概要生成.md` に従い、`1_RDRA/システム概要.json` を生成する。

---

## RDRA統合: 1_RDRA/ への集約

Phase4 の最終出力を `1_RDRA/` ディレクトリに集約する。

### ファイルコピー
以下のファイルを `1_RDRA/` にコピーする:

| コピー元 | コピー先 |
|---------|---------|
| `0_RDRAZeroOne/phase3/アクター.tsv` | `1_RDRA/アクター.tsv` |
| `0_RDRAZeroOne/phase1/外部システム.tsv` | `1_RDRA/外部システム.tsv` |
| `0_RDRAZeroOne/phase3/情報.tsv` | `1_RDRA/情報.tsv` |
| `0_RDRAZeroOne/phase4/状態.tsv` | `1_RDRA/状態.tsv` |
| `0_RDRAZeroOne/phase4/条件.tsv` | `1_RDRA/条件.tsv` |
| `0_RDRAZeroOne/phase4/バリエーション.tsv` | `1_RDRA/バリエーション.tsv` |
| `0_RDRAZeroOne/phase4/BUC.tsv` | `1_RDRA/BUC.tsv` |

### 関連データ生成（RDRAGraph用）
`scripts/makeGraphData.js` を実行して `1_RDRA/関連データ.txt` を生成する:
```bash
node <skill-path>/scripts/makeGraphData.js
```

### ZeroOneデータ生成（RDRASheet用）
`scripts/makeZeroOneData.js` を実行して `1_RDRA/ZeroOne.txt` を生成する:
```bash
node <skill-path>/scripts/makeZeroOneData.js
```

### 出力チェック
`1_RDRA/` に以下のファイルが揃っていることを確認:
- `システム概要.json`, `アクター.tsv`, `外部システム.tsv`, `情報.tsv`, `状態.tsv`, `条件.tsv`, `バリエーション.tsv`, `BUC.tsv`, `関連データ.txt`, `ZeroOne.txt`

---

## 仕様生成（Spec）

RDRA統合後の `1_RDRA/` データから仕様ドキュメントを生成する。
仕様生成はユーザーが明示的に指示した場合に実行する。

### Spec Phase1: 論理データ・ビジネスルール・画面定義

#### 共通コンテキスト
- `rdra-knowledge.md` — RDRA基本概念
- `references/rdra-graph.md` — RDRAGraph データ構造
- `1_RDRA/関連データ.txt` — RDRA定義の関連データ

#### タスク（並列実行）
| # | タスクプロンプト | 出力ファイル |
|---|----------------|-------------|
| 1 | `references/spec/21_論理データ生成.md` | `2_RDRASpec/論理データモデル.md` |
| 2 | `references/spec/22_ビジネスルール生成.md` | `2_RDRASpec/ビジネスルール.md` |
| 3 | `references/spec/23_画面一覧生成.md` | `2_RDRASpec/phase1/画面一覧.json` |
| 4 | `references/spec/24_BUC画面生成.md` | `2_RDRASpec/phase1/BUC画面.json` |
| 5 | `references/spec/25_アクター画面生成.md` | `2_RDRASpec/phase1/アクター画面.json` |

### Spec Phase2: 画面照会（Spec Phase1 完了後に実行）

#### 共通コンテキスト
Spec Phase1 の共通コンテキストに加えて:
- `2_RDRASpec/論理データモデル.md`
- `2_RDRASpec/phase1/BUC画面.json`
- `2_RDRASpec/phase1/アクター画面.json`
- `2_RDRASpec/phase1/画面一覧.json`

#### タスク
| # | タスクプロンプト | 出力ファイル |
|---|----------------|-------------|
| 1 | `references/spec/26_画面照会生成.md` | `2_RDRASpec/画面照会.json` |

### 仕様の出力チェック
`2_RDRASpec/` に以下のファイルが揃っていることを確認:
- `論理データモデル.md`, `ビジネスルール.md`, `画面照会.json`

---

## 外部ツール連携

### RDRAGraph 可視化
`1_RDRA/関連データ.txt` の内容をクリップボードにコピーし、以下のURLで可視化できる:
https://vsa.co.jp/rdratool/graph/v0.94/

### Google Spreadsheet エクスポート
`1_RDRA/ZeroOne.txt` の内容を以下のテンプレートに貼り付けて利用する:
https://docs.google.com/spreadsheets/d/1h7J70l6DyXcuG0FKYqIpXXfdvsaqjdVFwc6jQXSh9fM/

---

## subagent への指示テンプレート

各タスクを subagent に委譲する際は、以下のパターンで指示する:

```
以下のファイルを読み込んで理解してください:
{共通コンテキストのファイルリスト}

次に、以下のタスクプロンプトを読み、その指示に従ってファイルを生成してください:
{タスクプロンプトのパス}

質問や確認は不要です。指示に従い即座に実行してください。
```
