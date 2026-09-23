# 契約レジストリ (v2)

契約駆動の入口。ティア間の依存面 (API・イベント・共有データレイアウト) を「契約」として宣言し、
生成・検証・read-only 保護の対象にする。契約種別は固定しない。本ファイルに種別の節を足せば、
パイプライン側 (d2-foundation / d2-contract / d2-run) は無変更で新種別を扱える (すべて `contracts[]` を loop する)。

契約宣言の正本は `.distillery/config.yaml` の `contracts[]` (id / type / source / provider / consumers)。
UC が契約のどの要素を使うかは [`uc-index.md`](uc-index.md) が持つ。

## 種別定義の 5 スロット

各種別は次の 5 スロットで定義する。v2 では bundle と examples を必須にし、v1 の非分割モードと縮退モードは廃止した。

| スロット | 内容 | 使う場所 |
|---|---|---|
| probe | 入力 (source) の存在確認 | d2-foundation |
| codegen | `packages/contracts/` と provider テストへの生成手順 | d2-contract / d2-foundation |
| tests | 生成する契約テストの形 | 同上 |
| verify | 実装時検証 (契約と実装前提の突合) | d2-verify / ゲート |
| read-set | provider / consumers に配る入力 | d2-run のサブエージェント派遣 |

## type: openapi

- **source**: `contracts/openapi/openapi.yaml` (分割可)。`compileContracts.js` が redocly で
  `generated/openapi.bundle.yaml` に bundle する。`--check` で正本との一致を検査する。
- **probe**: source の存在。
- **codegen**: `genContractTests.js` が operation ごとに provider テストと consumer stub を生成する。
- **tests**: provider = `apps/<provider>/test/contract/<operationId>.test.ts` (supertest + ajv)。
  example ごとに request → status → body 検証。example 欠如は `it.todo`。
- **verify**: UC slice の operation が bundle に定義済みで、examples が揃っていること
  (`validateUcIndex.js`)。
- **read-set**: provider = server 型 + slice / consumers = client 型 + stub + slice。source 全量は配らない。

## type: asyncapi

- **source**: `contracts/asyncapi/asyncapi.yaml`。`bundleAsyncapi.js` (ref-parser) で
  `generated/asyncapi.bundle.yaml` に bundle する。operation.channel は Reference のまま残す。
- **probe**: source の存在 (`capabilities.has_asyncapi`)。
- **codegen**: `genContractTests.js` が `packages/contracts/<id>/validators.ts` と
  `apps/<provider>/test/contract/messages.test.ts` を生成する。
- **tests**: message example を payload schema で検証。example 欠如は `it.todo`。
- **verify**: UC slice の message が bundle の `components.messages` に定義済みであること。
- **read-set**: provider / consumers とも message 型 + validators + slice。

## type: rdb-schema

- **source**: 入口 `contracts/db/rdb-schema.yaml` (domains 一覧) + `db/domains/<id>.yaml`。
  `compileRdbSchema.js` が `generated/rdb-schema.bundle.yaml` / `table-index.yaml` / UC 別 `rdb-slice.yaml`
  を生成する。アーキ設計への entity 依存は持たない (種別の所有は ADR が決める)。
- **probe**: source の存在。
- **codegen**: `genRdbDdl.js` が Postgres migration・pglite の DB 契約テスト・
  `packages/contracts/<id>/tables.ts` (row 型 + 名前定数) を生成する。
- **tests**: pglite に migration を当て、`information_schema` と bundle を突合する。
- **verify**: UC slice の tables が bundle に実在すること。列・型・FK は `compileRdbSchema.js` が検証する。
- **read-set**: provider / consumers とも slice (契約対象テーブルの範囲) + 生成 row 型。
  migration は provider ティアの `migrations/` 配下に置く。

## 新種別の追加手順

1. 本ファイルに 5 スロットの節を足す (verify を必ず書く。検証できない契約はゲートにならない)。
2. `.distillery/config.yaml` の `contracts[]` に宣言を足す。
3. パイプライン側の変更は不要 (すべて `contracts[]` を loop する)。kvs-schema / object-storage-schema も同型で追加できる。
