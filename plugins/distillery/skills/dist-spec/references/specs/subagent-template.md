# subagent への指示テンプレート（ファイル参照方式）

dist-spec が起動する subagent（生成 / レビュー / 修正）へは、**長文の固定指示を貼らず、指示ファイルの絶対パスと
変数ブロックだけ**を渡す（dist-impl-run と同じ方式。並列起動時のプロンプト複製トークンと、オーケストレータの
コンテキスト蓄積を抑える）。固定指示の正本は `references/specs/stage-instructions/` 配下。

## stage → 指示ファイル

| stage | 指示ファイル | 読ませる範囲の要点 |
|-------|-------------|------------------|
| Step3 UC Spec 生成 | `references/specs/stage-instructions/step3-generate.md` | spec-template 共通部 + 対象 kind の tier-templates + spec-generate + digest + tsv |
| Step3-Review | `references/specs/stage-instructions/step3-review.md` | 対象 UC のファイルと tsv / digest。findings は `_review/step3-{group}-round{n}.yaml` |
| Step3 / 3.5 / 4 の修正 | `references/specs/stage-instructions/step3-fix.md` | findings YAML と指摘のあるファイルだけ |
| Step3.5-Review | `references/specs/stage-instructions/step35-review.md` | buc-spec.md と所属 UC の spec.md |
| Step4-Review | `references/specs/stage-instructions/step4-review.md` | 担当（api / datastore / ux-ui / traceability）の成果物だけ |
| Step6.5 反証レビュー | `references/specs/stage-instructions/step65-review.md` | events/{event_id} 全体（round 2 以降は前 findings の target のみ） |

**専用の指示ファイルが無い生成 stage**（Step3.5 の buc-spec 生成、Step4a〜4d の cross-cutting 生成）も同じファイル参照方式で起動する。
指示ファイルの代わりに、既存のテンプレート / ルールファイルの絶対パスを「読む順」で列挙し、SKILL.md の当該 Step の
生成手順（数行）と変数（event_id / 対象 BUC or 担当 / design_available）だけをプロンプトに書く:

| stage | 指示ファイルとして渡すもの（ルール） | 一次入力（ルールが要求するもの。これ以外は読ませない） |
|-------|----------------------------------|------------------------------------------------|
| Step3.5 buc-spec 生成 | `references/specs/buc-spec-template.md` | 対象 BUC の所属 UC ディレクトリ一覧（spec.md）、`docs/rdra/latest/BUC.tsv` / `情報.tsv` / `状態.tsv` / `条件.tsv` / `バリエーション.tsv` |
| Step4a API 統合 | `references/specs/openapi-rules.md` / `asyncapi-rules.md` | 全 UC の `_api-summary.yaml`、`docs/rdra/latest/情報.tsv` / `条件.tsv` / `バリエーション.tsv`、`_inputs-digest.md`（arch tiers・technology_context・nfr セキュリティ）、`docs/design/latest/_digest/components.yaml`（design ありのみ） |
| Step4b データストア統合 | `references/specs/datastore-rules.md` | 全 UC の `_model-summary.yaml`、`docs/rdra/latest/情報.tsv`、`_inputs-digest.md`（data_architecture.entities） |
| Step4c 共通コンポーネント | `references/specs/cross-cutting-ux-ui-template.md` | 全 UC の presentation tier md、`docs/design/latest/_digest/components.yaml`（design ありのみ） |
| Step4d トレーサビリティ | `references/specs/cross-cutting-traceability-template.md` | `docs/rdra/latest/*.tsv`、全 UC の spec.md |

これらの stage のプロンプトには、上表のパス（絶対パス）と SKILL.md の当該 Step の生成手順（数行）、変数に加えて、
**次の完了報告形式と `${CLAUDE_PLUGIN_ROOT}/skills/dist-pipeline/references/dialogue-format.md` の絶対パスを必ず書く**
（subagent は本ファイルを読まないため、プロンプトに含めないと契約が届かない）:

```text
完了報告: 「{stage 名} 完了: 生成 {n} ファイル / 要確認 {q} 件」の 1 行 + 生成ファイルのパス一覧（1 行 1 パス）。
本文の再掲・所感は書かない。要確認項目がある場合だけ、その下に {dialogue-format.md の絶対パス} 準拠の確認推奨項目リストを続ける。
```

## プロンプトの形（全 stage 共通）

```text
あなたは {role} です。
まず次の指示ファイルを読み、その指示に従ってください（本文はここに貼りません）:
{絶対パス: ${CLAUDE_PLUGIN_ROOT}/skills/dist-spec/references/specs/stage-instructions/{file}}

変数ブロック:
skill_root: {${CLAUDE_PLUGIN_ROOT}/skills/dist-spec を展開した絶対パス}
{指示ファイル末尾「変数ブロック」の形式で埋めた値}

質問や確認は不要です。指示に従い即座に実行し、指示ファイルの「完了報告」形式だけを返してください。
```

（専用指示ファイルの無い生成 stage では、`{file}` の代わりに上表のルールファイルと一次入力の絶対パスを列挙し、
「指示ファイルの『完了報告』形式」の代わりに上記の完了報告形式をそのまま書く）

`${CLAUDE_PLUGIN_ROOT}` は実際のプラグインルートの絶対パスに展開してから渡す（subagent は変数を解決しない）。
指示ファイル内の `references/...` は **`skill_root` 基準**、`docs/...` はプロジェクトルート基準で解決する
（fresh subagent の作業ディレクトリはプロジェクトなので、`references/` は相対では見つからない）。

## 変数の与え方

- 生成 subagent の「対象ティア」は Step1 で確定した `{tier_id} ({kind})` の形で渡す。kind は
  `references/specs/tier-selection-rules.md` の規則で presentation / api / worker / cli のいずれか
- グループ分割は 1 subagent あたり 8〜10 UC まで。全グループを**単一メッセージで同時起動**する
- レビュー / 修正の findings パスは `docs/specs/events/{event_id}/_review/` 配下に限定する
  （`_` prefix のためバリデーション・スナップショットの UC 走査対象外）
