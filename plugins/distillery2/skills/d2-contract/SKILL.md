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
| `genContractTests.js <contracts-dir> --config <config.yaml> [--uc <slug>] --out-root <repo>` | provider 契約テスト・consumer stub・validators を生成 |
| `genRdbDdl.js <contracts-dir> --config <config.yaml> --out-root <repo>` | Postgres migration・DB 契約テスト・row 型を生成 |

`--check` は書き込まずに、生成物が古いと exit 1。CI と d2-run のチェックポイントで使う。

`genContractTests.js` の挙動:
- 全生成 (`--uc` なし) では、所有する旧生成物 (契約テスト・stub・validators) のうち今回作らないものを stale として掃除する
  (生成時は削除、`--check` 時は報告して exit 1)。operation の削除・改名で旧テストが残らない。
- `--uc <slug>` 指定時は、`generated/slices/<slug>/contract-slice.json` の実在 (無ければ exit 2) と、
  source からの bundle 鮮度 (`compileContracts --check` 相当、古ければ exit 1) を先に検証する。古い契約からテストを作らない。

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
   requestBody と各 2xx/4xx response に example を付ける。
   **シナリオから example を作れないときは、契約を推測で埋めず**、
   `.distillery/runs/<slug>/issues/` に課題ドラフトを残して停止する。
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
