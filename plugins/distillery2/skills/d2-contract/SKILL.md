---
name: d2-contract
description: >-
  契約 (OpenAPI / AsyncAPI / RDB スキーマ) を分割 YAML で管理し、bundle・UC ごとの slice・契約テストを生成する。
  mode=skeleton (段階③: カタログ・共通コンポーネント・エラー型・空の uc-index) と
  mode=uc (段階④: 1 UC 分の分割ファイル編集・examples 追加・slice/テスト再生成) の 2 モード。
  実装で見つかった契約の穴は、その UC を契約の段から巻き戻すか開き直して mode=uc で直す。
  UC が使う operation には examples を必須にし、書けなければ止めて課題にする。
---

# d2-contract

契約 (OpenAPI、AsyncAPI、RDB スキーマ) を書き、そこから生成物を作る。
契約の正本は `contracts/` の分割 YAML である。カタログ (`contracts.json`) と UC の索引 (`uc-index.yaml`) も、手順に従って書く。
bundle、UC ごとの slice、契約テストは、スクリプトが決定論的に生成する。

個別仕様 (spec.md) やティア別の文書は作らない。
仕様は、機械で検証できる契約に寄せる。

## 呼び出し

進行役 (d2-run) が、mode を 1 つ指定して派遣する。

| mode | 段階 | すること |
|---|---|---|
| `mode=skeleton` | ③ 基盤 | ADR と RDRA から、契約の骨格を用意する。UC 個別の operation はまだ書かない |
| `mode=uc uc=<slug>` | ④ UC の縦切り | 1 UC 分の契約の差分を書き、slice と契約テストを再生成する |

実装で見つかった契約の穴も `mode=uc` で直す。
その UC を契約の段から巻き戻すか、開き直してから呼ばれる。

パスの `<skills>` は、スキル群のディレクトリを指す。
定義は [../d2-common/SKILL.md](../d2-common/SKILL.md) の「パスの書き方」にある。

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

## mode=skeleton の手順

| 順 | すること | 内容 |
|---|---|---|
| 1 | カタログを書く | ADR が決めたティアと契約面から `contracts/contracts.json` を書く (id / type / source / provider / consumers)。source は `contracts/` 相対 |
| 2 | 入口ファイルを書く | 下の表のとおり |
| 3 | 共通コンポーネントとエラー型を置く | 全 UC が参照するエラースキーマ、ページング、共通ヘッダを `components` に置く。RDRA の状態モデルは、enum 列や status プロパティに落とす |
| 4 | 空の uc-index を作る | `uc-index.yaml` が無い初回だけ、`schema_version` と空の `ucs: []` で作る。既にあれば UC のエントリを残す |
| 5 | compile する | `compileContracts.js` と `compileRdbSchema.js` を実行して bundle を作る。この時点では slice は空である。生成物の先頭に `basis: requirements@<sha> adr@<sha>` を付ける |

手順 2 の入口ファイル:

| ファイル | 中身 |
|---|---|
| `openapi/openapi.yaml` | `openapi: 3.1.0`、info、servers、securitySchemes、空の `paths`。共通の `components/schemas` (エラー型 `Problem` など) と、共通の `parameters` / `responses` |
| `asyncapi/asyncapi.yaml` | `asyncapi: 3.0.0`、info、servers、空の `channels` / `operations`。`capabilities.has_asyncapi` のときだけ書く |
| `db/rdb-schema.yaml` | `schema_version: distillery2.rdb-split/v1`、`domains: []` から始める。RDRA の情報モデルのサブドメインごとに `db/domains/<id>.yaml` を起こす |

回し直すときの決まり:
`contracts/uc-index.yaml` に UC が既にある (基盤の差分や基盤のレビューの反証で回し直す) ときは、既存の UC の operation と、その分割ファイル (`paths`・`components` の UC 固有の部分・`db/domains/*.yaml` の UC が使う表) を変えない・消さない。
変える必要があれば、その UC の契約の課題として引き継ぎファイルに書く (戻し先 `contract`、`uc` 付き)。

## mode=uc の手順

| 順 | すること | 内容 |
|---|---|---|
| 1 | 読む | `docs/requirements/use-cases.yaml` の該当行、`features/<業務>/<slug>.feature`、RDRA の関連する条件/状態行 |
| 2 | 契約を編集する | この UC が提供/利用する operation、message、table を分割ファイルに足す。触るのは分割ファイル (`openapi/` `asyncapi/` `db/domains/`) だけである |
| 3 | examples を書く | requestBody と、各 2xx/4xx response に example を付ける。下の「examples の書き方」に従う |
| 4 | uc-index を更新する | `uc-index.yaml` の該当 `slug` に `operations` / `messages` / `tables` を書く |
| 5 | compile と validate をする | `compileContracts.js` → `compileRdbSchema.js` → `validateUcIndex.js`。examples の不足や参照のずれは、validate が exit 1 で止める |
| 6 | 契約テストを生成する | `genContractTests.js --uc <slug>` と `genRdbDdl.js` を、対象リポに対して実行する。生成物に `basis:` を付ける |

手順 2 で足すもの:

| 種別 | 足すもの |
|---|---|
| OpenAPI | path item と operationId、request/response スキーマ。共通型は `$ref` で再利用する |
| AsyncAPI | channel、operation、message、payload schema |
| RDB | 該当する `db/domains/<id>.yaml` に、テーブル、列、FK を足す |

やり直しで新しい受入基準が添えてあれば、既存の operation の応答・スキーマも直してよい。

手順 6 の生成先は `apps/*/test/contract/**`、`apps/<datastore_owner>/migrations/**`、`packages/contracts/**` である。
どれも生成物なので、手で直さない。
契約テストは、この時点では todo か red になる (実装前のため)。

### examples の書き方

必須ルールは [references/uc-index.md](references/uc-index.md) にある。
本文だけで応答が決まらないときは、次の拡張で入力を表す。
書き方は [references/contract-tests.md](references/contract-tests.md) の「要求ヘッダ」と「例ごとの要求」にある。

| 応答の決まり方 | 例 | 入力の表し方 |
|---|---|---|
| 認証や冪等キーで決まる | 401 / 403 / 409 | 文書直下の `x-test-headers` (既定値) と、request example の `x-headers` (上書き。`null` で送らない) |
| 本文だけでは区別できない | 無い ID の 404、本文の無い GET の 401 / 403、前提のデータで決まる 409 / 5xx | operation の `x-test-requests` で、例ごとに URL の値、ヘッダ、テスト用データ (`fixture`) を指定する。テスト用データの意味を `x-test-fixtures` に書く |
| 同じ status で中身が違う | (status では区別できない例) | `expect` で、確かめる項目を書く |

期待する結果が違う例が同じ要求になると、validate が止める。
期待する結果が違うとは、status が違うか、同じ status で中身が違うことを指す。

**シナリオから example を作れないときは、契約を推測で埋めず**、引き継ぎファイルの `upstream_issues` に書いて停止する。
戻し先は、シナリオか要求が決めていない振る舞いなら `scenario` か `requirements` にする。
契約の書き方で解けるなら、書いて進む。

## スクリプト

`S=<skills>/d2-contract/scripts` として、対象リポの `contracts/` に対して実行する。

| スクリプト | 役割 |
|---|---|
| `compileContracts.js <contracts-dir> [--check]` | OpenAPI/AsyncAPI を bundle し、UC ごとの contract-slice.json を生成 |
| `compileRdbSchema.js <contracts-dir> [--check]` | RDB を bundle し、table-index と UC ごとの rdb-slice.yaml を生成 |
| `validateUcIndex.js <contracts-dir>` | 参照実在性と examples 必須ルールを検査 |
| `genContractTests.js <contracts-dir> --config <config.yaml> [--uc <slug>] --out-root <repo>` | provider 契約テスト、consumer stub、validators を生成。消費側 API クライアントも生成する (genApiClient を内部で呼ぶ) |
| `genApiClient.js <contracts-dir> --config <config.yaml> --out-root <repo> [--check]` | OpenAPI bundle から、消費側の型付き API クライアントを `packages/contracts/<id>/` に生成 |
| `genRdbDdl.js <contracts-dir> --config <config.yaml> --out-root <repo>` | Postgres migration、DB 契約テスト、row 型を生成 |
| `classifyContractChanges.js --uc <slug> [--json]` | 変わった契約の生成物を、この UC の分、他 UC の分、共有の分に分ける。d2-run が contract 段の受理時に使う |

`--check` は書き込まずに、生成物が古いと exit 1 を返す。
CI と d2-run のチェックポイントで使う。

各スクリプトの細かい挙動は [references/contract-tests.md](references/contract-tests.md) の「スクリプトの挙動」にある。

## 注意

| 注意 | 扱い |
|---|---|
| `generated/` は手で編集しない | 差分が要るなら、分割ファイルを直して再 compile する |
| bundle の道具 | redocly (`REDOCLY_CLI`) と ref-parser (`ASYNCAPI_REF_PARSER`) を使う。対象リポの node_modules に無ければ、env で解決先を渡す。実行中の無断インストールはしない |
| 生成テストが依存するライブラリ | ajv 8 / ajv-formats 3 / supertest / vitest / @electric-sql/pglite を、対象リポの devDependencies に入れる |

## 引き継ぎファイル

作業の終わりに、進行役が派遣文で渡す場所 (`{handoff}`) に引き継ぎファイルを書く。
書くのは、人に聞きたいことと、自分の書き込み範囲では直せない前のステップの問題である。
報告の本文にだけ書いたことは扱われない。
推奨は条件を付けずに 1 つ書く。
書き方は [handoff.md](../d2-common/references/handoff.md) にある。

## 細目の文書

| 文書 | 読むとき | 内容 |
|---|---|---|
| [references/uc-index.md](references/uc-index.md) | mode=uc の手順 3 と 4 の前 | `uc-index.yaml` の形と、examples の必須ルール。UC が契約のどの要素を使うかを持つ |
| [references/contract-registry.md](references/contract-registry.md) | 種別ごとの扱いを確かめるとき | 種別ごとの生成と検証 |
| [references/contract-tests.md](references/contract-tests.md) | examples を書く前、契約テストを生成する前 | 生成テストの方式、検証済みライブラリとバージョン、スクリプトの挙動 |
| [references/troubleshooting.md](references/troubleshooting.md) | 契約テストで詰まったとき | 踏んだ問題と回避策 |
| [../d2-common/references/dataflow.yaml](../d2-common/references/dataflow.yaml) | 入出力を確かめるとき | 入出力の正本 (図は [dataflow.md](../d2-common/references/dataflow.md)) |
