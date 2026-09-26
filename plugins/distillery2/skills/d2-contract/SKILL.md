---
name: distillery2:d2-contract
description: >-
  契約 (OpenAPI / AsyncAPI / RDB スキーマ) を分割 YAML で管理し、bundle・UC ごとの slice・契約テストを生成する。
  mode=skeleton (段階③: カタログ・共通コンポーネント・エラー型・空の uc-index) と
  mode=uc (段階④: 1 UC 分の分割ファイル編集・examples 追加・slice/テスト再生成) の 2 モード。
  UC が使う operation には examples を必須にし、書けなければ止めて課題にする。
---

# d2-contract

契約の正本は `contracts/` の分割 YAML。bundle・slice・契約テストは機械が決定論的に生成する。
UC が契約のどの要素を使うかは [`references/uc-index.md`](references/uc-index.md) の `uc-index.yaml` が持つ。
種別ごとの生成・検証は [`references/contract-registry.md`](references/contract-registry.md)、
生成テストの方式と検証済みライブラリは [`references/contract-tests.md`](references/contract-tests.md) を参照する。

個別仕様 (spec.md) やティア別 md は作らない。仕様は契約 (機械検証可能) に寄せ、コードは as-built から導く。

## ディレクトリ

```
contracts/
  contracts.json          # カタログ: {schema_version, contracts:[{id,type,source,provider,consumers}]}
  openapi/openapi.yaml     # 分割可 (paths/ components/)
  asyncapi/asyncapi.yaml
  db/rdb-schema.yaml       # 入口 (domains 一覧) + db/domains/<id>.yaml
  uc-index.yaml            # UC ごとに使う operation / message / table
  generated/               # 生成物 (commit する)。手で編集しない
    openapi.bundle.yaml  asyncapi.bundle.yaml  rdb-schema.bundle.yaml  table-index.yaml
    slices/<uc_slug>/{contract-slice.json, rdb-slice.yaml}
```

## スクリプト

`S=${CLAUDE_PLUGIN_ROOT}/skills/d2-contract/scripts` として、対象リポの `contracts/` に対して実行する。

| スクリプト | 役割 |
|---|---|
| `compileContracts.js <contracts-dir> [--check]` | OpenAPI/AsyncAPI を bundle し、UC ごとの contract-slice.json を生成 |
| `compileRdbSchema.js <contracts-dir> [--check]` | RDB を bundle し、table-index と UC ごとの rdb-slice.yaml を生成 |
| `validateUcIndex.js <contracts-dir>` | 参照実在性と examples 必須ルールを検査 |
| `genContractTests.js <contracts-dir> --config <config.yaml> [--uc <slug>] --out-root <repo>` | provider 契約テスト・consumer stub・validators、および消費側 API クライアント (下記 genApiClient を内部で呼ぶ) を生成 |
| `genApiClient.js <contracts-dir> --config <config.yaml> --out-root <repo> [--check]` | OpenAPI bundle から消費側の型付き API クライアントを生成: `packages/contracts/<id>/types.ts` (スキーマ→TS 型)・`client.ts` (operationId ごとの型付き fetch)・`server.ts` (operationId ↔ method/path 表)。外部依存なし・決定論的 |
| `genRdbDdl.js <contracts-dir> --config <config.yaml> --out-root <repo>` | Postgres migration・DB 契約テスト・row 型を生成 |
| `classifyContractChanges.js --uc <slug> [--json]` | 変わった契約の生成物 (`git status` から) を own (この UC の operation。同じ operation を使う他 UC を併記) / other_uc (他 UC の operation) / shared (`messages.test.ts`・`db-schema.test.ts`・DDL・`packages/contracts/**`・bundle) に分ける。d2-run が contract 段の受理時に使い、他の UC にも効く変更を人レビューに載せる |

`--check` は書き込まずに、生成物が古いと exit 1。CI と d2-run のチェックポイントで使う。

`genContractTests.js` の挙動:
- 全生成 (`--uc` なし) では旧生成物を掃除する (生成時は削除、`--check` 時は報告して exit 1)。operation の削除・改名や provider 移設で旧テストが残らない。
  - 契約テスト・validators (`.ts`) は所有タグで判定し、全 `apps/*/test/contract` を走査する (provider を別ティアへ移した後の旧テストも検出)。
  - consumer stub (`.json`) は各 `stubs/` の `.distillery2-generated.json` (生成一覧) に載るファイルだけを削除対象にする。手書き stub は消さない。
- `--uc <slug>` 指定時は、`generated/slices/<slug>/contract-slice.json` の実在 (無ければ exit 2) と、
  source からの bundle 鮮度 (`compileContracts --check` 相当、古ければ exit 1) を先に検証する。古い契約からテストを作らない。
- **消費側 API クライアント** (`types.ts` / `client.ts` / `server.ts`) は全生成でも `--uc` でも**全 operation から生成する** (型・経路・クライアントは UC 横断。UC で縮めると先に作った UC 分が消えるため)。consumer は `client.ts` を、provider は `types.ts` / `server.ts` を使う ([tier-impl.md](../d2-implement/references/tier-impl.md) の read-set)。

## mode=skeleton (段階③)

ADR と RDRA の情報/状態モデルから、契約の骨格を一度だけ用意する。UC 個別の operation はまだ書かない。

1. **カタログ**: ADR が決めたティアと契約面から `contracts/contracts.json` を書く
   (id / type / source / provider / consumers)。source は `contracts/` 相対。
2. **入口ファイル**:
   - `openapi/openapi.yaml` — `openapi: 3.1.0`、info、servers、securitySchemes、空の `paths`、
     共通の `components/schemas` (エラー型 `Problem` など) と共通 `parameters` / `responses`。
   - `asyncapi/asyncapi.yaml` — `asyncapi: 3.0.0`、info、servers、空の `channels` / `operations`
     (`capabilities.has_asyncapi` のときだけ)。
   - `db/rdb-schema.yaml` — `schema_version: distillery2.rdb-split/v1`、`domains: []` から始め、
     RDRA の情報モデルのサブドメインごとに `db/domains/<id>.yaml` を起こす。
3. **共通コンポーネント / エラー型**: 全 UC が参照するエラースキーマ・ページング・共通ヘッダを
   `components` に置く。RDRA の状態モデルは enum 列や status プロパティに落とす。
4. **空の uc-index**: `uc-index.yaml` を `schema_version` + 空の `ucs: []` で作る。
5. **compile**: `compileContracts.js` と `compileRdbSchema.js` を実行して bundle を作る
   (この時点では slice は空)。生成物の先頭に `basis: requirements@<sha> adr@<sha>` を付ける。

## mode=uc uc=&lt;slug&gt; (段階④)

1 UC 分の契約差分を書き、slice と契約テストを再生成する。

1. **読む**: `docs/requirements/use-cases.yaml` の該当行、`features/<業務>/<slug>.feature`、
   RDRA の関連する条件/状態行。触るのは分割ファイル (`openapi/` `asyncapi/` `db/domains/`) だけ。
2. **契約を編集**: この UC が提供/利用する operation・message・table を分割ファイルに足す。
   - OpenAPI: path item と operationId、request/response スキーマ (共通型は `$ref` で再利用)。
   - AsyncAPI: channel・operation・message・payload schema。
   - RDB: 該当 `db/domains/<id>.yaml` にテーブル・列・FK を足す。
3. **examples を書く**: [`references/uc-index.md`](references/uc-index.md) の examples 必須ルールに従い、
   requestBody と各 2xx/4xx response に example を付ける。認証や冪等キーで決まる応答 (401 / 403 / 409) は、文書直下の `x-test-headers` (既定値) と
   request example の `x-headers` (上書き。`null` で送らない) で入力を表す ([`references/contract-tests.md`](references/contract-tests.md) の「要求ヘッダ」)。
   **シナリオから example を作れないときは、契約を推測で埋めず**、
   `.distillery/runs/<slug>/issues/<ts>_<slug>.md` に課題ドラフトを残して停止する。書式は実装の課題と同じ:
   front matter に `kind: contract` と `title` (40 字以内)。front matter が無いと as-built の課題の表で「未分類」になる (0.1.10 実走 ④-11)。
4. **uc-index を更新**: `uc-index.yaml` の該当 `slug` に `operations` / `messages` / `tables` を書く。
5. **compile + validate**: `compileContracts.js` → `compileRdbSchema.js` → `validateUcIndex.js`。
   examples 不足や参照ずれは validate が exit 1 で止める。
6. **契約テスト生成**: `genContractTests.js --uc <slug>` と `genRdbDdl.js` を対象リポに対して実行する。
   契約テストはこの時点では todo か red (実装前だから)。生成物に `basis:` を付ける。

## 注意

- `generated/` は手で編集しない。差分が要るなら分割ファイルを直して再 compile する。
- bundle は redocly (`REDOCLY_CLI`) と ref-parser (`ASYNCAPI_REF_PARSER`) を使う。対象リポの
  node_modules に無ければ env で解決先を渡す。実行中の無断インストールはしない。
- 生成テストが依存するライブラリ (ajv 8 / ajv-formats 3 / supertest / vitest / @electric-sql/pglite) は
  対象リポの devDependencies に入れる。バージョンは [`references/contract-tests.md`](references/contract-tests.md)。
- 契約テストで踏んだ問題と回避策は [`references/troubleshooting.md`](references/troubleshooting.md)。
