# USDM 分解タスク

要望テキストを USDM（要求・理由・仕様）に構造化分解し、YAML ファイルとして出力する。

## 入力

- 要望テキスト（ユーザー指定のファイル。例: `docs/input/初期要望.txt`）
- `references/usdm-schema.md` — USDM YAML スキーマ定義
- `docs/requirements/requirements.yaml` — 現在の USDM（存在する場合。既存要求の把握・ID 重複回避のため）
- `docs/requirements/rdra/*.tsv` — 現在の RDRA モデル（既存要素との関連付けのため）

## 出力

- `docs/requirements/requirements.yaml`

`docs/requirements/requirements.yaml` が既に存在する場合は、その場で編集して要求・仕様を追記・修正する（差分更新）。履歴は git が持つ。

メタ情報の `event_id` は `{YYYYMMDD_HHMMSS}_{要約}` 形式のビルド識別子、`created_at` は `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得した値を使う。LLM が日時を推測してはならない。

## 手順

### 1. 要望の理解

要望テキストを読み、以下を把握する:

- 何を実現・変更・追加・削除したいのか
- なぜそれが必要なのか（ビジネス背景）
- どの程度の優先度か
- 対象システムの名称（システム名）

### 2. 既存 RDRA モデルの確認

`docs/requirements/rdra/*.tsv` を読み、現在のモデルに含まれる要素を把握する。要望が既存要素の修正なのか、新規追加なのかを判断する。

### 3. 要求の抽出

要望から独立した要求（Requirement）を抽出する。

- 1つの要望から複数の要求が抽出されることがある
- 各要求は独立して理解可能な粒度にする
- 要求は「何を実現したいか」をビジネス観点で記述する

### 4. 理由の記述

各要求に対して、なぜその要求が必要かの理由を記述する。

- ビジネス価値、ユーザー課題、法規制、技術的負債など
- 理由が明記されていない場合は要望の文脈から推測する

### 5. 仕様への分解

各要求を具体的な仕様（Specification）に分解する。

- 仕様は「どのように実現するか」を記述する
- 1つの要求に対して複数の仕様が定義されうる
- 各仕様に受入基準（acceptance_criteria）を付ける
  - 1 行の Gherkin（Given/When/Then を 1 文で）を推奨する
  - 例: `Given 利用者がログイン済み When 予約画面を開く Then 空き会議室の一覧が表示される`
  - 受入基準はここで人が確認する。UC 単位のシナリオはここでは書かない（UC 着手時に d2-implement mode=scenario が書く）

### 6. 影響モデルの特定

各仕様について、RDRA モデルのどの要素に影響するかを特定する。

- `type`: 影響を受ける RDRA モデル種別
  - `actor` — アクター
  - `information` — 情報
  - `state` — 状態
  - `buc` — ビジネスユースケース
  - `condition` — 条件
  - `variation` — バリエーション
  - `external_system` — 外部システム
  - `business_policy` — ビジネスポリシー
- `action`: 追加（add）/ 変更（modify）/ 削除（delete）
- `target`: 影響を受ける具体的な要素名
  - 既存要素の場合: `docs/requirements/rdra/*.tsv` に存在する名称を使用
  - 新規要素の場合: 新しい名称を付ける

### 7. システム名の決定

対象システムの名称を決定する:

- 要望テキストからシステム名を抽出する
- `docs/requirements/requirements.yaml` に既存の `system_name` がある場合は、要望でシステム名の変更が明示されない限りそれを引き継ぐ
- 初回の場合は、要望テキストの内容から自然な日本語のシステム名を1つ決定する

### 8. 優先度の判定

各要求の優先度を判定する:

- `must` — この変更の本質的な要求。これがないと目的を達成できない
- `should` — 重要だが、最悪なくても目的は最低限達成できる
- `could` — あると良いが、なくても問題ない

### 9. YAML 出力

`references/usdm-schema.md` のフォーマットに従い、`docs/requirements/requirements.yaml` を出力する。`system_name` フィールドに手順7で決定したシステム名を設定する。

## 出力ルール

- YAML は `references/usdm-schema.md` のスキーマに厳密に従う
- ID は連番で振る（REQ-001, REQ-002, ..., SPEC-001-01, SPEC-001-02, ...）。`docs/requirements/requirements.yaml` が存在する場合は、既存 ID と重複しないよう、最大の既存 ID の次の番号から採番する
- 受入基準は具体的かつ検証可能な記述にする
- affected_models は漏れなく記述する — 1つの仕様が複数のモデルに影響する場合はすべて列挙する
- 推測で仕様を追加しない — 要望に記述された内容のみから仕様を導出する
