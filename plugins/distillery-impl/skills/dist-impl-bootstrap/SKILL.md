---
name: distillery-impl:dist-impl-bootstrap
description: >
  distillery の仕様書一式(docs/specs, arch, usdm, design)から実装先 mono repo の骨格を生成する
  bootstrap スキル。tier ディレクトリ・4 段テスト配置・qlty/CI・dev-rules 配布・契約 codegen
  (契約レジストリの宣言 contracts[] → packages/contracts。openapi/asyncapi/rdb-schema 等、種別追加可能)・
  Storybook コンポーネント取り込み(packages/ui)・
  uc-map/impl-config/contracts.lock の生成までを冪等に行う。
  通常は dist-impl-run(S0)から呼ばれるが、「実装リポを bootstrap して」で単体起動もできる。
---

# dist-impl-bootstrap

distillery の出力を入力契約として、実装先リポの「最初から規約が焼き込まれた状態」を作る。
**冪等**: Phase の完了は `docs/impl/latest/bootstrap.done.yaml` の Phase 記録で判定して skip する
(生成物の存在では判定しない — CLAUDE.md や ci.yml は既存リポに元からあり得るため)。
再実行しても既存の実装コードを壊さない。

引数: `specs_root={distillery 出力ルート} repo_root={実装先リポルート}`(省略時は対話で確認)。
`phase=contracts force=true` を渡された場合は **P4(契約 codegen)だけを強制再実行**する
(S3 の stale 検知から呼ばれる経路。lock の sha256 が一致していても再生成し、lock を更新する。
bootstrap.done.yaml は **P4 の記録と契約入力ハッシュ(contracts[] の各入力)だけ**を更新し、他 Phase に触れない)。
さらに `contract_id={id}`(任意・カンマ区切りで複数可)を渡された場合は**該当契約だけ**を再生成し、
lock・入力ハッシュもその契約のエントリのみ更新する(無指定は全契約)。

## 参照する正本

- レイアウト: `references/repo-layout.md`
- 契約レジストリ(種別定義・codegen): `references/contract-registry.md`
- 開発規約(配布物): `references/dev-rules/`(coding-rules / test-strategy / tier-rules)
- 状態スキーマ: `../dist-impl-run/references/state-schema.md`(impl-config / uc-map / contracts.lock)

## Phase 構成

| Phase | 内容 |
|---|---|
| P1 preflight | ツール・依存の存在プローブ |
| P2 config | impl-config.yaml + uc-map.yaml 生成 |
| P3 skeleton | リポ骨格 + dev-rules 配布 + CLAUDE.md |
| P4 contracts | 契約 codegen + contracts.lock |
| P5 ui | Storybook コンポーネント取り込み |
| P6 ci | qlty + GitHub Actions(6 段ゲート) |
| P7 atdd | ATDD feature 全 SPEC 分生成 |

**各 Phase 完了のたびに `docs/impl/latest/bootstrap.done.yaml` の該当 Phase を done に更新する**
(スキーマは `../dist-impl-run/references/state-schema.md`。全 Phase の完了で S0 done とみなされる)。
失敗時も中間ファイルは削除しない。再実行は bootstrap.done.yaml の未完了 Phase から。

## P1: preflight(存在プローブ)

1. `java -version` / `node --version` を確認(java 無し → codegen は縮退モード)
2. ddd plugin の有無: Skill 一覧に `ddd:ddd-tactical-implementation` があるか。
   無ければ capability `has_ddd_plugin: false`(implement は dev-rules のみで継続)
3. 条件付き入力の存在プローブ → capability フラグ化:
   - `{specs_root}/specs/latest/_cross-cutting/api/asyncapi.yaml` → has_asyncapi
   - `_cross-cutting/datastore/kvs-schema.yaml` → has_kvs / `object-storage-schema.yaml` → has_object_storage
   - `{specs_root}/design/latest/storybook-app/` → has_design_system
   - 加えて `references/contract-registry.md` の各種別の source を probe する
     (P2 の契約宣言案の材料。capability は probe 結果の記録であり、契約の正は contracts[])
4. **矛盾検査**: spec-event.yaml の `use_cases[].async_event_count > 0` の UC があるのに asyncapi.yaml が
   無い等の矛盾は、bootstrap を止めず「仕様への変更要求」ドラフトとして報告する(起票は S8/ユーザー判断)

## P2: config(impl-config + uc-map)

1. `{specs_root}/arch/latest/arch-design.yaml` の `system_architecture.tiers[]` を読み、
   `{specs_root}/specs/latest/spec-event.yaml` の `use_cases[].files[]` に現れる tier id を抽出する
2. **実装 tier の宣言案**を作る: files[] に現れる tier → 実装 tier(dir は `tier-` を除いた名前、
   `kind`(frontend / backend / worker / data-pipeline / cli / mcp-server)は tier id と
   tier md の構成から推定した案を出す)。
   files[] に現れない architecture tier(例 tier-datastore)→ 共有資産(datastore_owner を提案)。
   **確認推奨項目としてユーザーに提示**(tier→dir 対応 / kind / datastore_owner /
   **backend_framework(impl-config に記録。P3 の依存 install の選択元)** / 言語 / コマンド群。
   kind は read-set・tier-rules 適用の機械可読キーになるため必須確定項目)
3. **契約宣言案(contracts[])を作る**: P1 の probe 結果と spec(`_api-summary.yaml` /
   `_model-summary.yaml` / tier md)から、契約ごとに type / source / provider / consumers の案を
   推論する(種別は `references/contract-registry.md` に定義されたもののみ。
   例: 複数 tier が同一テーブル群に read/write する場合は type: rdb-schema の契約 —
   data pipeline が書く mart を backend が読む等)。
   **tier 宣言と併せてユーザー確認で確定**する(provider/consumers が推定できない契約は
   推測で埋めず確認必須項目にする)。契約に載らない tier 間依存は実装時に issues 経由で扱う
4. uc-map.yaml を生成: 全 UC の uc_id(生成式は state-schema.md。NFC 正規化 + canonical JSON + sha256 先頭 8 桁)、
   path、tiers。**衝突検査**で衝突があれば 12 桁に延長
5. spec-event.yaml に無い tier id・パース不能 YAML は**停止して報告**(推測しない)

## P3: skeleton(骨格 + 規約配布)

1. `references/repo-layout.md` に従い tier ディレクトリ・packages/・features/ を作成
2. `references/dev-rules/` 3 ファイルを `{repo_root}/docs/dev-rules/` へコピー
3. `{repo_root}/CLAUDE.md` を生成: 冒頭に dev-rules の必須 5 項の抜粋 + `docs/dev-rules/` への参照、
   続けてプロジェクト固有節(specs_root の場所 / uc-map の場所 / tier 構成 / コマンド群)
4. 言語ごとの formatter / linter / テスト FW / BDD FW(例: TS = biome or eslint + vitest + cucumber-js、
   Python = ruff + pytest + pytest-bdd)の設定雛形を tier dir に配置し、コマンドを impl-config の `commands` に記録
5. **backend_framework(express 等)の依存は雛形と同時に install する**(仮置きの雛形だけでは
   S4 で使えない)。tier tsconfig には ts-node 用の override(`module: CommonJS`)も焼き込む
   (tsconfig.base の `module: ESNext` を ts-node/register が継承すると、拡張子なし相対 import が
   解決不能になる)

## P4: contracts(契約 codegen)

impl-config の `contracts[]` を loop し、`references/contract-registry.md` の種別定義
(codegen / degraded スロット)に従って生成し、contracts.lock.yaml(契約ごとの input sha256 +
generated)を書く。java 不在・generator 失敗時は種別の縮退手順に切り替え、lock の該当契約に
`degraded` と記録。**種別名でパイプラインを分岐させない**(新種別はレジストリへの追加だけで通る)。

**注意**: bootstrap 実行中は `specs_root` を書き換えない(P4/P5 のプローブ・取り込みと競合し
部分スナップショットになる。`dist-design-system` の追い上げ生成と並走させない)。

## P5: ui(Storybook 取り込み。has_design_system のみ)

1. **取り込み元の正は `storybook-app/src/` の実ファイル列挙**(components / tokens に加えて
   `src/stories/` と、それらが import する src 内モジュールも含む — Story は画面実装の参照例として
   design-event の `screens[].story` から結線されているため、components だけに絞ると落ちる)。
   design-event.yaml の `components` は object(`ui` / `domain` / `common` の配列。path は common の
   一部にしか無い)なので、**取り込みマニフェストには使わず**、コンポーネント名と `screens[]` の
   結線照合(uc → story / variants)にだけ使う
2. 実ファイルを `{repo_root}/packages/ui/` へコピーし、import パスを packages/ui 内で完結するよう
   書き換え、`packages/ui/.imported.yaml` に取り込み元(design event_id)とファイル一覧を記録
3. storybook-app が無い(has_design_system: false)場合は skip(frontend tier の実装は tier-rules.md の
   縮退規約に従う)

## P6: ci(qlty + 6 段ゲート)

1. `qlty init` 相当の `.qlty/qlty.toml` + 言語別 configs を配置
2. `.github/workflows/ci.yml` を生成: format-check → lint → tdd(tier matrix)→ tier-bdd(tier matrix)
   → uc-bdd → atdd。コマンドは impl-config の `commands` / `integration_commands` から転記
3. **ルート実行の cucumber(features/uc・features/atdd)用に `tsconfig.uc-features.json`
   (jsx: react + DOM lib + module: CommonJS + ts-node 節)を生成し、cucumber.cjs 冒頭に
   `process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || "tsconfig.uc-features.json";`
   を入れる**(パスはリポルート相対 — bdd:uc / bdd:atdd はルート cwd で実行される前提)(tier cucumber は workspace cwd で自 tsconfig を拾えるが、
   ルート実行の bdd:uc / bdd:atdd は拾える tsconfig が無く `--jsx is not set` で即死するため)
4. **biome.json に生成物の ignore を焼き込む**: `files.ignore: ["packages/contracts/**",
   "packages/ui/**", "node_modules/**"]`(無いと barrier format が vendored 生成物を整形して churn する)

## P7: atdd(ATDD feature 全 SPEC 分)

`{specs_root}/usdm/latest/requirements.yaml` の全 SPEC(**キーパスは
`requirements[].specifications[]`**。ルート直下に specifications は無い)について
`features/atdd/{spec_id}.feature` を生成する。1 criterion = 1 Scenario、Scenario 名は
`{SPEC-ID}-{連番}`、**各 Scenario に一意タグ `@atdd_{SPEC-ID}-{連番}` を付ける**
(転写ルールは `references/dev-rules/test-strategy.md`。S7 の選択実行はタグ式の完全一致で行い、
名前の部分一致フィルタは使わない — `SPEC-X-1` が `SPEC-X-10` に誤一致するため)。
acceptance_criteria が空の SPEC は feature を作らず、報告に「criteria 欠落 SPEC 一覧」として載せる。

## 完了報告

- capability フラグ一覧 / 生成・skip した Phase / UC 数と uc_id 桁数 / 縮退モードの有無 /
  矛盾検査で見つけた変更要求ドラフト / criteria 欠落 SPEC 一覧
