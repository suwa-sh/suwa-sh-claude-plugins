# Step1 Part 1 / 2 / 3 推論 subagent の固定指示（変数 `part` で切り替え）

> オーケストレータはこのファイルの**絶対パス**と変数ブロックだけをプロンプトに書く（本文を貼らない）。
> 実行順は **Part 0 → Part 1 → (Part 2 ∥ Part 3)**。Part 2 は Part 1 が確定したティア ID を前提にするため Part 1 の後、
> Part 3 は Part 0 だけを前提にするため Part 2 と並列に起動される。あなたは自分の Part だけを推論し、
> 正本（arch-design.yaml / events / latest）は書かない。出力先は staging `docs/arch/.work/{event_id}/` のみ。
> `references/...` は変数ブロックの `skill_root` 基準、`docs/...` はプロジェクトルート基準。

## 読み込むファイル（自分の Part の行だけ。これ以外は読まない）

共通で読むもの:
- `references/arch-inference-rules.md`（基本方針・Part 別入力表・共通ルール: Entity ID の決定規則）
- `references/schema/common.md`
- `references/arch/arch-infer.md` の「2. NFR グレードの読み込みと影響分析」（Part 1 のみ）と自分の Part の手順節（4. / 5. / 6.）、
  「7. confidence の付与」「8. source_model への NFR ID 明記」
- `${CLAUDE_PLUGIN_ROOT}/skills/dist-pipeline/references/dialogue-format.md`（要確認項目の形式。`${CLAUDE_PLUGIN_ROOT}` は変数 `plugin_root`）
- `docs/rdra/latest/*.tsv`（全ファイル。小さいので全部読む）と `docs/rdra/latest/システム概要.json`
- `docs/arch/.work/{event_id}/_draft/00-domain.md`（Part 0 の要約。BC / owned_entity_ids / 認可重み付け / BC : tier 暫定を前提にする）。
  **差分更新で Part 0 を実行していない場合**は `docs/arch/latest/_digest/domain_architecture.yaml`
  （無ければ `docs/arch/latest/arch-design.yaml` の `domain_architecture` セクション）を代わりに読む。
  **どちらも無い場合（変数 `domain: none`。既存スナップショットに domain_architecture が無く、ユーザーが新規生成を選ばなかった）**は
  no-domain モード: BC / owned_entity_ids / 認可重み付けに依存する手順を省略し、Part 3 は Entity ID を共通ルールの初期構築規則
  （既存 ID があればそれを優先）で単独で採番する
- 差分更新モード: `docs/arch/latest/_digest/{system_architecture|app_architecture|data_architecture}.yaml` のうち自分の Part の分
  （無ければ `arch-design.yaml` の該当セクションのみ）と、変更差分 `_changes.md`

| part | ルール | スキーマ | NFR（`docs/nfr/latest/_digest/category-X.yaml`。無ければ `nfr-grade.yaml` の該当カテゴリ） | 前 Part の要約 | パターン集（該当シグナル時だけ名前引きで該当 `###` 節のみ） |
|------|-------|---------|----------------------------------------------------------------------------------|---------------|-------------------------------------------------------|
| 1 system | `references/inference/part1-system.md` | `references/schema/system.md` | **A〜F 全カテゴリ**（Part 1 は NFR 全体の影響分析も担う） | — | `references/arch-design-patterns.md` / `arch-logging-patterns.md` |
| 2 app | `references/inference/part2-app.md` | `references/schema/app.md` | A・B・C・E | `_draft/01-system.md`（確定ティア id / 種別 / BC 対応）。**差分更新で Part 1 を実行していない場合**は `docs/arch/latest/_digest/system_architecture.yaml`（無ければ `arch-design.yaml` の `system_architecture`）を代わりに読む | `references/arch-app-patterns.md` / `arch-logging-patterns.md` / `arch-design-patterns.md`（CQRS 節のみ） |
| 3 data | `references/inference/part3-data.md` | `references/schema/data.md` | A・B・D・E | — | `references/arch-data-patterns.md` / `arch-design-patterns.md`（データ管理・回復性の節） |

読まないもの: 他 Part のルール・スキーマ、`arch-design.parts/`、パターン集の丸読み（Part ルールが名前で参照した `###` 節だけ）。

## 推論

`references/arch/arch-infer.md` の「2. NFR グレードの読み込みと影響分析」（Part 1 のみ）、「4. システム（Part 1）」「5. アプリケーション（Part 2）」
「6. データ（Part 3）」のうち自分の Part の手順に従う。confidence の付与（同 7.）と `source_model` への NFR ID 明記（同 8.）を守る。
Part 3 の Entity ID は共通ルール（`arch-inference-rules.md`「Entity ID の決定規則」）で採番し、`00-domain.md` の owned_entity_ids と一致させる。

## 出力（staging のみ）

要約 md とセクションドラフト yaml を `docs/arch/.work/{event_id}/_draft/` に書く。**ドラフトのファイル名は Step3 の
`arch-design.parts/` と同一**（Step3 で確定内容を反映してそのまま昇格（コピー）される）:

| part | 要約 md（メインが読む） | セクションドラフト yaml（Step3 が読む） |
|------|----------------------|------------------------------------|
| 1 | `_draft/01-system.md` | `_draft/04-system-architecture.yaml`（`system_architecture:` セクション） |
| 2 | `_draft/02-app.md` | `_draft/05-app-architecture.yaml`（`app_architecture:` セクション） |
| 3 | `_draft/03-data.md` | `_draft/06-data-architecture.yaml`（`data_architecture:` セクション） |

要約 md の内容:
1. 推論結果の一覧（Part 1: ティア構成 **id / 種別 / 責務の表** + テクノロジー候補 + i18n + BC : tier 対応 + cross_tier_policies の要点 /
   Part 2: ティアごとのレイヤリングとレイヤー責務 / Part 3: エンティティ一覧（id / 名前 / 所属 BC）・リレーション・ストレージマッピング）と Mermaid 図
2. **要確認項目**（confidence: low / medium。dialogue-format.md 準拠の 3 案 + ⭐推奨 + 一行説明 + 推奨理由）
3. 参照した NFR メトリクス ID の一覧（カバレッジ確認用）
4. **Part 1 のみ**: NFR カテゴリ A〜F ごとの平均 Lv と主な影響（Step3 の `_inference.md` に転記される）

## 完了報告

チャットの返答は「Part {n} 完了: {主要数値 1〜3 個} / 要確認 {q} 件: {要約 md のパス}」の 1 行のみ。質問や確認は不要。

## 変数ブロック（オーケストレータが埋める）

```text
skill_root: {dist-architecture スキルの絶対パス}
plugin_root: {${CLAUDE_PLUGIN_ROOT} を展開した絶対パス}
event_id: {event_id}
part: 1 | 2 | 3
mode: initial | diff
domain: draft | latest | none          # 00-domain.md あり / latest の domain_architecture を使う / no-domain モード
（diff のとき）変更差分: docs/rdra/events/{rdra_event_id}/_changes.md または docs/nfr/events/{nfr_event_id}/_changes.md
（diff で Part 0 未実行のとき）domain 入力: docs/arch/latest/_digest/domain_architecture.yaml
（diff で Part 1 未実行の Part 2 のとき）system 入力: docs/arch/latest/_digest/system_architecture.yaml
```
