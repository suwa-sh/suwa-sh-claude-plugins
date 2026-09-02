# Step1 Part 0（ドメインアーキテクチャ）推論 subagent の固定指示

> オーケストレータ（メインエージェント）はこのファイルの**絶対パス**と変数ブロックだけをプロンプトに書く（本文を貼らない）。
> あなたは推論だけを行い、**正本（arch-design.yaml / events / latest）は書かない**。出力先は staging
> `docs/arch/.work/{event_id}/` のみ（events/ には一時ファイルを置かない）。
> `references/...` は変数ブロックの `skill_root`（dist-architecture スキルの絶対パス）基準、`docs/...` はプロジェクトルート基準。

## 読み込むファイル（これ以外は読まない）

1. ルール・スキーマ・手順
   - `references/arch-inference-rules.md`（基本方針・Part 別入力表・**共通ルール: Entity ID の決定規則**）
   - `references/inference/part0-domain.md`（Part 0 推論ルール）
   - `references/arch-domain-patterns.md`（Q1〜Q4 詳細ルール・investment_policy 定型文・confidence 上限）
   - `references/schema/domain.md` + `references/schema/common.md`（出力スキーマ・ID 体系・confidence 値）
   - `references/arch/arch-infer.md` の「1. RDRA モデルの読み込みと特徴抽出」「3. ドメインアーキテクチャの推論（Part 0）」「7. confidence の付与」節
   - `references/arch/arch-dialogue.md` の Phase 0 節（要約 md に載せる表の項目を確認するため。対話自体はメインが行う）
   - `${CLAUDE_PLUGIN_ROOT}/skills/dist-pipeline/references/dialogue-format.md`（要確認項目の形式。`${CLAUDE_PLUGIN_ROOT}` は
     変数ブロックの `plugin_root`）
2. 入力データ
   - `docs/rdra/latest/*.tsv`（全ファイル。小さいので全部読む）と `docs/rdra/latest/システム概要.json`
   - 差分更新モード: `docs/arch/latest/_digest/domain_architecture.yaml` と `docs/arch/latest/_digest/data_architecture.yaml`
     （既存 Entity の `id` / `name` / `source_info` の対応表を得るため。無ければ `docs/arch/latest/arch-design.yaml` の
     `domain_architecture` / `data_architecture.entities` セクションのみ。**既存に `domain_architecture` が無い場合**は新規生成として扱う）と、
     変数 `trigger_type` に応じた変更差分（rdra: `docs/rdra/events/{rdra_event_id}/_changes.md` / nfr: 差分なし。RDRA は latest 全体を
     入力にする / manual: 変数ブロックの指示文）

読まないもの: 他 Part の推論ルール（`inference/part1〜3`）、`arch-design-patterns.md` / `arch-app-patterns.md` /
`arch-data-patterns.md` / `arch-logging-patterns.md`、`nfr-grade.yaml`（Part 0 は RDRA のみを根拠にする）。

## 推論

`references/arch/arch-infer.md`「1. RDRA モデルの読み込みと特徴抽出」と「3. ドメインアーキテクチャの推論（Part 0）」の Q1〜Q4 + Mermaid 図。
confidence 上限（Core SD = medium / BC = medium / Aggregate = low）を守る。`source_model` は RDRA 要素のみ。
**Entity ID は共通ルール（`arch-inference-rules.md`「Entity ID の決定規則」）で決める**。Part 3 も同じ規則で採番するので、
`owned_entity_ids[]` と `aggregate root` はその ID を使う。

## 出力（staging のみ）

- `docs/arch/.work/{event_id}/_draft/00-domain.md` — **メインエージェントが Step2 Phase 0 の対話に使う要約**。
  `references/arch/arch-dialogue.md` Phase 0 の各表を再現できる情報を**すべて**含める:
  1. RDRA モデル分析結果: 各 tsv の要素数と特徴（BUC / UC 数、アクター種別数、外部システム数、エンティティ数と個人情報の有無、
     状態数、条件数、バリエーション数。Step3 の `_inference.md` にそのまま転記される）
  2. サブドメイン一覧: id / name / type / confidence / 根拠（BUC クラスタ・キーワード）/ investment_policy
  3. BC 一覧: id / name / 所属 SD / 所有 BUC / owned_entity_ids（**Entity 名を併記**）/ 同名異義語の検出結果 /
     ubiquitous_language（用語・定義・根拠の全件）/ team_ownership（null）
  4. コンテキストマップ: 関係 id / upstream / downstream / パターン / 翻訳責務 の表 + Mermaid `graph LR`
     （ノードラベルは BC 名のみ、エッジラベルはパターン名のみ）
  5. 集約境界仮説: root（Entity id と名前）/ 含まれる Entity / invariants の**本文全件** / confidence / note
  6. **要確認項目**（confidence: low / medium で対話が必要なもの。
     `${CLAUDE_PLUGIN_ROOT}/skills/dist-pipeline/references/dialogue-format.md` 準拠の 3 案 + ⭐推奨 + 一行説明 + 推奨理由）
  7. Part 1〜3 への伝播事項（BC : tier 対応の暫定、認可重み付けのデータ感度シグナル、BC ごとの owned_entity_ids）
- `docs/arch/.work/{event_id}/_draft/03-domain-architecture.yaml` — `domain_architecture:` セクションのドラフト
  （`schema/domain.md` の YAML 例と同じ構造。ファイル名は Step3 の `arch-design.parts/03-domain-architecture.yaml` と同一で、
  Step3 で確定内容を反映してそのまま昇格（コピー）される）

## 完了報告

チャットの返答は「Part 0 完了: SD {n} / BC {m} / 集約仮説 {k} / 要確認 {q} 件: {00-domain.md のパス}」の 1 行のみ。
本文の再掲はしない。質問や確認は不要。指示に従い即座に実行する。

## 変数ブロック（オーケストレータが埋める）

```text
skill_root: {dist-architecture スキルの絶対パス}
plugin_root: {${CLAUDE_PLUGIN_ROOT} を展開した絶対パス}
event_id: {event_id}
mode: initial | diff
trigger_type: rdra | nfr | manual          # diff のとき必須
（trigger_type=rdra のとき）rdra_event_id: {rdra_event_id}（変更差分 docs/rdra/events/{rdra_event_id}/_changes.md を読む）
（trigger_type=manual のとき）指示: {ユーザーの変更指示 1〜3 行}
```
