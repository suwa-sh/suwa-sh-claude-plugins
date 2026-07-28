---
name: distillery-impl:dist-impl-bootstrap
description: >
  distillery の仕様書一式(docs/specs, arch, usdm, design)から実装先 mono repo の骨格を生成する
  bootstrap スキル。tier ディレクトリ・4 段テスト配置・qlty/CI・dev-rules 配布・契約 codegen
  (openapi/asyncapi → packages/contracts)・Storybook コンポーネント取り込み(packages/ui)・
  uc-map/impl-config/contracts.lock の生成までを冪等に行う。
  通常は dist-impl-run(S0)から呼ばれるが、「実装リポを bootstrap して」で単体起動もできる。
---

# dist-impl-bootstrap

distillery の出力を入力契約として、実装先リポの「最初から規約が焼き込まれた状態」を作る。
**冪等**: 各 Phase は完了判定ファイルの存在で skip する。再実行しても既存の実装コードを壊さない。

引数: `specs_root={distillery 出力ルート} repo_root={実装先リポルート}`(省略時は対話で確認)

## 参照する正本

- レイアウト: `references/repo-layout.md`
- 契約 codegen: `references/contract-codegen.md`
- 開発規約(配布物): `references/dev-rules/`(coding-rules / test-strategy / tier-rules)
- 状態スキーマ: `../dist-impl-run/references/state-schema.md`(impl-config / uc-map / contracts.lock)

## Phase 構成と完了判定ファイル

| Phase | 内容 | 完了判定 |
|---|---|---|
| P1 preflight | ツール・依存の存在プローブ | docs/impl/latest/impl-config.yaml の `capabilities` |
| P2 config | impl-config.yaml + uc-map.yaml 生成 | 同ファイルの存在 + スキーマ適合 |
| P3 skeleton | リポ骨格 + dev-rules 配布 + CLAUDE.md | {repo_root}/CLAUDE.md |
| P4 contracts | 契約 codegen + contracts.lock | docs/impl/latest/contracts.lock.yaml |
| P5 ui | Storybook コンポーネント取り込み | {repo_root}/packages/ui/.imported.yaml |
| P6 ci | qlty + GitHub Actions(6 段ゲート) | {repo_root}/.github/workflows/ci.yml |
| P7 atdd | ATDD feature 全 SPEC 分生成 | {repo_root}/features/atdd/.generated.yaml |

失敗時も中間ファイルは削除しない。再実行は未完了 Phase から。

## P1: preflight(存在プローブ)

1. `java -version` / `node --version` を確認(java 無し → codegen は縮退モード)
2. ddd plugin の有無: Skill 一覧に `ddd:ddd-tactical-implementation` があるか。
   無ければ capability `has_ddd_plugin: false`(implement は dev-rules のみで継続)
3. 条件付き入力の存在プローブ → capability フラグ化:
   - `{specs_root}/specs/latest/_cross-cutting/api/asyncapi.yaml` → has_asyncapi
   - `_cross-cutting/datastore/kvs-schema.yaml` → has_kvs / `object-storage-schema.yaml` → has_object_storage
   - `{specs_root}/design/latest/storybook-app/` → has_design_system
4. **矛盾検査**: spec-event.yaml の `use_cases[].async_event_count > 0` の UC があるのに asyncapi.yaml が
   無い等の矛盾は、bootstrap を止めず「仕様への変更要求」ドラフトとして報告する(起票は S8/ユーザー判断)

## P2: config(impl-config + uc-map)

1. `{specs_root}/arch/latest/arch-design.yaml` の `system_architecture.tiers[]` を読み、
   `{specs_root}/specs/latest/spec-event.yaml` の `use_cases[].files[]` に現れる tier id を抽出する
2. **実装 tier の宣言案**を作る: files[] に現れる tier → 実装 tier(dir は `tier-` を除いた名前)。
   files[] に現れない architecture tier(例 tier-datastore)→ 共有資産(datastore_owner を提案)。
   **確認推奨項目としてユーザーに提示**(tier→dir 対応 / datastore_owner / 言語 / コマンド群)
3. uc-map.yaml を生成: 全 UC の uc_id(生成式は state-schema.md。NFC 正規化 + canonical JSON + sha256 先頭 8 桁)、
   path、tiers。**衝突検査**で衝突があれば 12 桁に延長
4. spec-event.yaml に無い tier id・パース不能 YAML は**停止して報告**(推測しない)

## P3: skeleton(骨格 + 規約配布)

1. `references/repo-layout.md` に従い tier ディレクトリ・packages/・features/ を作成
2. `references/dev-rules/` 3 ファイルを `{repo_root}/docs/dev-rules/` へコピー
3. `{repo_root}/CLAUDE.md` を生成: 冒頭に dev-rules の必須 5 項の抜粋 + `docs/dev-rules/` への参照、
   続けてプロジェクト固有節(specs_root の場所 / uc-map の場所 / tier 構成 / コマンド群)
4. 言語ごとの formatter / linter / テスト FW / BDD FW(例: TS = biome or eslint + vitest + cucumber-js、
   Python = ruff + pytest + pytest-bdd)の設定雛形を tier dir に配置し、コマンドを impl-config の `commands` に記録

## P4: contracts(契約 codegen)

`references/contract-codegen.md` の手順で生成し、contracts.lock.yaml を書く。
java 不在・generator 失敗時は縮退モード(`_api-summary.yaml` 起点)に切り替え、lock に `degraded` と記録。

## P5: ui(Storybook 取り込み。has_design_system のみ)

1. `{specs_root}/design/latest/design-event.yaml` の `components[].path` を取り込みマニフェストとして、
   `storybook-app/src/components/` と tokens を `{repo_root}/packages/ui/` へコピー
2. import パスを packages/ui 内で完結するよう書き換え、`packages/ui/.imported.yaml` に
   取り込み元(design event_id)とファイル一覧を記録
3. storybook-app が無い(has_design_system: false)場合は skip(frontend tier の実装は tier-rules.md の
   縮退規約に従う)

## P6: ci(qlty + 6 段ゲート)

1. `qlty init` 相当の `.qlty/qlty.toml` + 言語別 configs を配置
2. `.github/workflows/ci.yml` を生成: format-check → lint → tdd(tier matrix)→ tier-bdd(tier matrix)
   → uc-bdd → atdd。コマンドは impl-config の `commands` / `integration_commands` から転記

## P7: atdd(ATDD feature 全 SPEC 分)

`{specs_root}/usdm/latest/requirements.yaml` の全 `specifications[]` について
`features/atdd/{spec_id}.feature` を生成する(転写ルールと Scenario 形式は `references/dev-rules/test-strategy.md`)。
acceptance_criteria が空の SPEC は feature を作らず、報告に「criteria 欠落 SPEC 一覧」として載せる。

## 完了報告

- capability フラグ一覧 / 生成・skip した Phase / UC 数と uc_id 桁数 / 縮退モードの有無 /
  矛盾検査で見つけた変更要求ドラフト / criteria 欠落 SPEC 一覧
