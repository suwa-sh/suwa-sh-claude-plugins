# Step3 UC Spec 生成 subagent の固定指示

最初に `references/specs/latest-linked-spec.md` を読み、新規生成・レビューではその規約を優先する。前段latestの条件/状態/Storyを辿り、図と分岐の接続を検査する。前段の複写を要求しない。

> オーケストレータはこのファイルの**絶対パス**と変数ブロックだけをプロンプトに書く（本文を貼らない）。
> subagent は最初にこのファイルを読み、指示に従う。

## 読み込むファイル（この順で。ここに無いものは読まない）

`references/...` は変数ブロックの `skill_root`（dist-spec スキルの絶対パス）基準。`docs/...` はプロジェクトルート基準。

1. テンプレート・ルール
   - `references/specs/latest-linked-spec.md`
   - `references/specs/spec-template.md`（共通部: spec.md フォーマット・注意事項）
   - `references/specs/tier-templates/{kind}.md` — **変数ブロックの対象ティアに現れる kind の分だけ**
     （presentation / api / worker / cli。現れない kind のファイルは読まない）
   - `references/specs/spec-generate.md`（生成手順 2〜7 と出力ルール）
   - `references/specs/datastore-rules.md` の「`_model-summary.yaml` の導出ルール」節のみ（手順 7 で参照。他の節は読まない）
2. 入力データ
   - `docs/rdra/latest/*.tsv`（全ファイル）
   - `docs/specs/events/{event_id}/_inputs-digest.md`（Step1 生成の arch/nfr ダイジェスト。
     ファイル自体が無い場合は `docs/nfr/latest/nfr-grade.yaml` と `docs/arch/latest/arch-design.yaml` をフルロードする。
     冒頭のチェックリストで `元ファイル参照` のセクションがある場合はそのセクションだけを元ファイルから読む。
     `not_applicable` のセクションは読みに行かない）
   - `docs/design/latest/design-event.yaml` — **対象ティアに presentation kind があり、かつ `_inputs-digest.md` 冒頭が
     `design_available: true` のときだけ**読む（それ以外はファイルが存在しても開かない = design 無しモード）
   - `docs/specs/events/{event_id}/_cross-cutting/ux-ui/ux-design.md`（Step2 生成済み。**presentation kind があるときだけ**）
   - `docs/specs/events/{event_id}/_cross-cutting/ux-ui/ui-design.md`（Step2 生成済み。**presentation または cli kind があるときだけ**。
     cli では出力規約として使う）
   - `docs/design/latest/storybook-app/` の対象component実装、Props、Story、token、route定義（designありのみ）。名前一覧だけで推測しない。
   - `docs/specs/latest/{業務名}/{BUC名}/{UC名}/`（既存 Spec があれば）

読まないもの: 他 UC の Spec、`references/specs/tier-selection-rules.md`（ティア選定はオーケストレータが適用済み）、
`references/specs/decision-records.md`、`docs/arch/latest/arch-design.yaml` 全文（ダイジェストで足りる場合）。

catalog modeの場合だけ `references/specs/contract-catalog.md` と対象UCの `_api-summary.yaml` / `_contract-slice.json` を追加で読む。
元のカタログ全体・他UCのsliceは読まない。型表とsummaryの手編集は行わず、APIはoperation参照にする。
UCの `_trace-links.json` はcatalog modeで生成する。element keyは現在のtraceability-indexから取得し、
索引がまだ無い場合はStep4dで対応を補完する（キーを推測しない）。

## 生成

変数ブロックの各 UC について、`spec-generate.md` の手順 2〜7 に従い
`spec.md` / `tier-{tier_id}.md`（対象ティアごと）/ `_api-summary.yaml`（api kind があるとき）/ `_model-summary.yaml` を
`docs/specs/events/{event_id}/{業務名}/{BUC名}/{UC名}/` に生成する。指示に無いティアのファイルは生成しない。

## 完了報告

生成した UC ごとにファイル一覧を報告する。質問や確認は不要。指示に従い即座に実行する。

## 変数ブロック（オーケストレータが埋める）

```text
skill_root: {dist-spec スキルの絶対パス。例 /Users/.../plugins/cache/.../skills/dist-spec}
event_id: {event_id}
design_available: {true|false}
contract_mode: {legacy|catalog}
対象 UC:
  - 業務: {業務名} / BUC: {BUC名} / UC: {UC名} / 対象ティア: {tier_id} ({kind}), {tier_id} ({kind})
  - ...（1 subagent あたり 8〜10 UC まで）
```
