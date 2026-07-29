# CLAUDE.md

このリポは distillery-impl の bootstrap(S0)が生成した実装リポ。全エージェントは作業開始前に本ファイルと
`docs/dev-rules/` を読む。

## 必須(Verifier が reject する違反。詳細は `docs/dev-rules/coding-rules.md`)

1. **契約型の直接編集禁止**: `packages/contracts/` 配下(openapi/asyncapi generator の生成物)を手で書き換えない。
   契約に不足があれば仕様への変更要求(issues/)を起票する。生成物の再生成は S0/S3 のみ
2. **frontend の UI コンポーネントは `packages/ui/` のみ使用**: 新規コンポーネントの自作は禁止。
   不足は design(dist-design-system)への変更要求を経由する
3. **formatter / linter を通過する**: コマンドは本ファイル下部の `impl-config.yaml` 転記が正
4. **仕様を実装側で曲げない**: 仕様(spec.md / tier-*.md / 契約)と実装が矛盾したら、実装を仕様に合わせるか、
   仕様の問題として issues/ に書き捨てる
5. **Conventional Commits**: コミットはオーケストレータのみが行う(サブエージェントは git を実行しない)

詳細な開発規約は `docs/dev-rules/coding-rules.md` / `test-strategy.md` / `tier-rules.md` を参照。

## プロジェクト固有

- **specs_root**: `/private/tmp/distillery-impl-test/specs-root`(distillery 出力ルート。仕様の正本)
- **uc-map**: `docs/impl/latest/uc-map.yaml`(UC 一覧・uc_id・tier 対応。18 UC、id は 8 桁)
- **impl-config**: `docs/impl/latest/impl-config.yaml`(tier 宣言・commands・capabilities の正)
- **contracts.lock**: `docs/impl/latest/contracts.lock.yaml`(契約 codegen の入力ハッシュ・生成物一覧)

### tier 構成

| tier id | dir | kind | lang |
|---|---|---|---|
| tier-frontend | `frontend/` | frontend | typescript(Next.js) |
| tier-backend-api | `backend-api/` | backend | typescript |
| tier-worker | `worker/` | worker | typescript |

`tier-datastore` / `tier-external`(architecture tier)は実装 tier ではなく共有資産。
datastore(migration/schema)は `datastore_owner: tier-backend-api` の配下に置く。

### コマンド群(tier 別。`npm run <script> --workspace=<dir>`)

- format_check / lint / test / bdd は各 tier の `package.json` に定義(biome + vitest + cucumber-js)
- integration: `npm run bdd:uc`(UC BDD) / `npm run bdd:atdd`(ATDD)

### capabilities(bootstrap P1 のプローブ結果)

- has_asyncapi: true(`_cross-cutting/api/asyncapi.yaml` あり。ただし payload に `title` 欠落で
  一部モデルが `AnonymousSchema_N` 化。`packages/contracts/async-types/README.md` に対応表あり)
- has_kvs: true(`_cross-cutting/datastore/kvs-schema.yaml` あり。セッション情報 E-006 が対象)
- has_object_storage: false
- has_design_system: true(ただし `storybook-app/src/` の実体は 4 ファイルのみ。design-event.yaml が
  宣言する残りのコンポーネント・Story は未生成。`packages/ui/.imported.yaml` に詳細)
- has_ddd_plugin: true(`ddd:ddd-tactical-implementation` 利用可。ドメインロジックはその基準に従う)

### 契約 codegen(P4)

`packages/contracts/{api-types,api-client,server-stubs}` は openapi.yaml から typescript-fetch /
typescript-node で生成(縮退モードではない)。`async-types` は asyncapi.yaml から生成(2 メッセージとも
`AnonymousSchema_N` 化。README.md に対応表)。全て生成物のため直接編集禁止。
