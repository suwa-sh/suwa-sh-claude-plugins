# RDRA 差分生成タスク

USDM の affected_models に基づき、RDRA モデルの差分 TSV を生成する。

## 入力

- `docs/usdm/events/{event_id}/requirements.yaml` — USDM 分解結果
- `docs/rdra/latest/*.tsv` — 現在の RDRA モデル
- `docs/rdra/latest/システム概要.json` — 現在のシステム概要
- `references/event-sourcing-rules.md` — イベントソーシングルール
- `../rdra-phases/rdra-knowledge.md` — RDRA 基本概念

## 出力

- `docs/rdra/events/{event_id}/*.tsv` — 変更があった TSV ファイルのみ
- `docs/rdra/events/{event_id}/_changes.md` — 変更サマリ

`{event_id}` は USDM イベントと同じ ID を使用する。

## 手順

### 1. USDM の affected_models を集約

requirements.yaml の全仕様から affected_models を収集し、影響を受ける RDRA モデル種別ごとにグループ化する。

| affected_models.type | 対応 TSV ファイル |
|---------------------|------------------|
| actor | アクター.tsv |
| information | 情報.tsv |
| state | 状態.tsv |
| buc | BUC.tsv |
| condition | 条件.tsv |
| variation | バリエーション.tsv |
| external_system | 外部システム.tsv |
| business_policy | （BUC.tsv 内のポリシー列で管理） |

### 2. 現在の RDRA モデルの読み込み

影響を受ける TSV ファイルを `docs/rdra/latest/` から読み込む。

### 3. 差分 TSV の生成

各影響モデルについて、action に応じた差分を生成する:

#### add（追加）

- 現在の TSV のフォーマット（ヘッダー、カラム構成）に合わせて新しい行を生成
- 既存の命名規則・粒度に合わせる
- RDRA の関連ルール（`rdra-knowledge.md` の相互関連ルール）を遵守する

#### modify（変更）

- target で指定された既存行を特定し、仕様の内容に基づいて更新した行を生成
- 変更がない列はそのまま維持する

#### delete（削除）

- 削除対象の行は差分 TSV には含めない
- `_changes.md` に削除対象を明記する

### 4. 差分 TSV の出力

各 TSV ファイルは **完全な内容** を出力する（ヘッダー + データ行）。
差分 TSV には、追加行と変更行のみを含める（削除行は含めない）。

例: アクター.tsv に新しいアクターを1名追加する場合:

```
アクター群\tアクター\t役割\t社内外\t立場
新規グループ\t新規アクター\t新しい役割の説明\t社外\t受益者
```

### 5. 変更サマリの生成

`_changes.md` を以下のフォーマットで生成する:

```markdown
# 変更サマリ

- event_id: {event_id}
- 元USDM: {event_id}
- 生成日時: {YYYY-MM-DDTHH:MM:SS}

## 追加

- {モデル種別}: {要素名}（{詳細}）

## 変更

- {モデル種別}: {要素名} → {変更内容}

## 削除

- {モデル種別}: {要素名}
```

## 出力ルール

- TSV フォーマットは既存の `docs/rdra/latest/*.tsv` と同一のカラム構成にする
- ヘッダー行は必ず含める
- 変更がないモデル種別の TSV は出力しない
- RDRA の相互関連ルールを遵守する:
  - BUC に新しい情報を参照させる場合、その情報が 情報.tsv に存在することを確認
  - 新しいアクターを BUC に関連付ける場合、そのアクターが アクター.tsv に存在することを確認
  - 不足がある場合は一緒に追加する
- 推測で要素を追加しない — USDM の affected_models に基づく変更のみを反映する
- _changes.md のモデル種別は日本語名を使用する（情報、アクター、状態、条件、バリエーション、外部システム、BUC）。英語名（information, actor 等）は使用しない

## RDRA 相互関連ルール（参考）

以下は `../rdra-phases/rdra-knowledge.md` に記載のルールの要約。差分生成時にこれらの整合性を確保する:

- BUC は アクター、情報、条件、外部システム を参照できる → 参照先が存在しない場合は一緒に追加する
- 情報 は 関連情報、状態モデル、バリエーション を参照できる → 新しい状態やバリエーションを情報に紐づける場合は先に追加する
- 状態 は 対象（情報名）を持つ → 対象の情報が存在することを確認する
