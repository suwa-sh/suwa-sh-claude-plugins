# 契約レジストリ 正本(distillery-impl)

契約駆動の入口。tier 間の依存面(API・イベント・共有データレイアウト等)を「契約」として宣言し、
生成・検証・read-only 保護の対象にする。**契約種別は固定しない** — 本ファイルのレジストリに
種別を追加すれば、パイプライン側(bootstrap P4 / S3 / S4 read-set)は無変更で新種別を扱える
(P4 / S3 / read-set は impl-config の `contracts[]` を loop するだけで、種別名で分岐しない)。

## 契約宣言(impl-config.yaml の contracts[])

契約の正は `impl-config.yaml` の `contracts[]` 宣言(スキーマは state-schema.md):

- `type` は本レジストリに定義された種別のいずれか
- `provider` = 契約面を実装・所有する tier / `consumers` = 契約面に依存する tier
- bootstrap P2 が spec(`_api-summary.yaml` / `_model-summary.yaml` / tier md)から宣言案を推論し、
  **ユーザー確認で確定**する(`config_confirmed` イベント)
- 契約に現れない tier 間依存を実装中に見つけたら、直接依存を書かず issues → feedback 経由で
  契約宣言の追加を要求する

## 種別定義の 5 スロット

各種別は以下の 5 スロットで定義する。**新種別の追加 = 5 スロットを書いた節を本ファイルに増やすこと**。

| スロット | 内容 | 使う場所 |
|---|---|---|
| probe | 入力の存在確認 | bootstrap P1 |
| codegen | `packages/contracts/` への生成手順 | bootstrap P4 / S3 再生成 |
| degraded | 生成手段が使えない場合の縮退手順 | 同上 |
| verify | 実装時検証(仕様決定値と実装前提の突合) | S3(並走 dispatch 前の gate) |
| read-set | provider / consumers に配る入力 | S4 dispatch(subagent-template) |

出力 dir は原則 `packages/contracts/{contract_id}/`。openapi / asyncapi の従来名
(api-types / api-client / server-stubs / async-types)は、**その type の契約が 1 件だけの場合の
後方互換**として許す。同一 type を複数宣言する場合は各契約の `{contract_id}/` 配下に置く。
**P2/P4 は全契約の出力 dir の衝突を検査し、衝突があれば停止する**(黙って上書きしない)。

**read-set スロットの実装リポ側での実体**: Implementer / Verifier は本ファイルを読まない
(実装リポに配布されない)。彼らが読むのは impl-config の `contracts[]` と
`docs/impl/latest/contracts.lock.yaml` であり、**bootstrap P4 が本レジストリの read-set 定義を
lock の機械可読キーに反映する**(スキーマは state-schema.md):

- `generated[].audience`(provider | consumers | both)— 自 tier の role または both のみ読む。
  `lang` があるエントリは自 tier の lang と一致するもののみ
- `source_read`(none | scope | full)— 契約 source を読んでよいか。openapi は none
  (生成物起点)、rdb-schema は scope(契約対象テーブルの範囲のみ)

## type: openapi

- **source**: `_cross-cutting/api/openapi.yaml`(必須入力)
- **probe**: source の存在 + `java -version`(openapi-generator は Java 製。無ければ degraded へ)
- **codegen**(検証済みスパイク 2026-07-29):

  ```bash
  npx -y @openapitools/openapi-generator-cli generate \
    -i {specs_root}/specs/latest/_cross-cutting/api/openapi.yaml \
    -g {generator} -o packages/contracts/{出力先}
  ```

  generator 選択表(impl-config の tier lang から解決):

  | 用途 | typescript | python | java/kotlin |
  |---|---|---|---|
  | api-types + api-client(consumers: frontend) | typescript-fetch | python | java(webclient) |
  | server-stubs(provider: backend) | typescript-node(または使用 FW 用) | python-fastapi | spring |

  - **検証済み**: samples の openapi.yaml(OpenAPI 3.1)で typescript-fetch 生成成功。
    日本語 description は JSDoc コメントとして生存する
  - **既知の問題**: openapi.yaml の enum 値にキー欠落があると、生成 TS が構文エラーになり
    barrel import が全滅する。回避策は models/ 個別 import + 迂回クライアント。
    根本対応は dist-spec への変更要求(x-enum-varnames の付与)
- **degraded**: 下記「縮退方式(共通)」
- **verify**: 当該 UC の `_api-summary.yaml` の `endpoints[]` が source に定義されているか突合
- **read-set**: provider = server-stubs + api-types / consumers = api-client + api-types
  (source 全量は読ませない — 生成物起点。P4 が lock の generated[].audience に反映する)。
  複数言語の provider / consumers が関与する場合は用途 dir の下に `{lang}/` を切り、
  lock の generated[] に言語別エントリを記録する

## type: asyncapi

- **source**: `_cross-cutting/api/asyncapi.yaml`(存在する場合のみ)
- **probe**: source の存在(capability `has_asyncapi`)
- **codegen**:

  ```bash
  npx -y @asyncapi/cli generate models {lang} \
    {specs_root}/specs/latest/_cross-cutting/api/asyncapi.yaml \
    -o packages/contracts/async-types
  ```

  既知の問題 2 点(検証済み):
  1. **npx キャッシュ破損で MODULE_NOT_FOUND になることがある** → `~/.npm/_npx/` の該当ハッシュを
     削除して再実行(スパイクで再現・解消を確認)
  2. **payload スキーマに title が無いと `AnonymousSchema_N` という無名モデルになる**(message レベルの
     name/title は使われない)→ dist-spec への変更要求(payload title 付与)を起票し、
     当面は message 名との対応表を README コメントで補うか degraded を使う
- **degraded**: `_api-summary.yaml` の `async_events[]` から型を起こす(下記共通方式)
- **verify**: 当該 UC の `_api-summary.yaml` の `async_events[]` が source に定義されているか突合
- **read-set**: provider / consumers とも async-types

## type: rdb-schema

- **source**: `_cross-cutting/datastore/rdb-schema.yaml`。`scope`(契約対象テーブル名の
  **完全一致**の配列。glob・正規表現は使わない)で契約対象のテーブル群を絞れる。
  scope のいずれかが source に存在しない、または一致 0 件の場合は停止して確認する(推測しない)
- **用途例**: data pipeline が生成する mart を backend が read model として読む場合、
  そのテーブルレイアウトが provider(pipeline)と consumers(backend)の契約面になる
- **probe**: source の存在
- **codegen**: 既製 generator が無いため、機械可読 YAML(テーブル・列・型定義)から
  **row 型 + テーブル名・列名定数を `packages/contracts/{contract_id}/` に直接生成**する
  (縮退方式と同じ手書き生成が正規)。生成ファイルには
  `// contract-codegen: from rdb-schema.yaml scope={...}` ヘッダを付ける。
  出力言語は契約に関与する tier(provider / consumers)の lang。複数言語が関与する場合は
  `packages/contracts/{contract_id}/{lang}/` に言語ごとに生成し、lock の `generated[]` に
  lang を記録する。SQL 型 → 言語型の対応が自明でない列(ベンダー固有型等)は推測で
  型を割り当てず、停止して確認する
- **degraded**: codegen 自体が直接生成なので縮退の別形は無い。source がパース不能な場合は
  停止して変更要求(推測で型を起こさない)
- **verify**(S3): 列レベルの突合を行う:
  1. consumers 側 — 当該 UC の `_model-summary.yaml` の `tables[].operations` が参照する
     テーブル・列が source に実在するか
  2. provider 側 — scope のテーブルが source に定義済みか
  不整合は「dist-spec への変更要求を出して停止 / 縮退して続行」をユーザーに提示する
- **read-set**: provider / consumers とも source(scope 範囲)+ 生成型。
  migration / DDL 資産は provider tier の dir 配下に置く(tier-rules.md)
- kvs-schema.yaml / object-storage-schema.yaml も同型で種別追加できる
  (必要になった時点で本ファイルに節を足す)

## 縮退方式(共通)

generator が使えない・生成物が実用に耐えない場合は、**機械可読で最も堅い
`_api-summary.yaml` / `_model-summary.yaml`(JSON Schema 検証済み)から型定義を手書き生成**する:

- `_api-summary.yaml` の `endpoints[]`(method/path/request_schema/response_schema)と
  `schemas[]` → 型 + 薄いクライアント
- `async_events[]` → イベント型(asyncapi 縮退)
- 縮退で生成したファイルには `// degraded-codegen: from _api-summary.yaml` ヘッダを付け、
  contracts.lock.yaml の該当契約の generator 欄に `degraded` と記録する

## 新種別の追加手順

1. 本ファイルに 5 スロットの節を足す(verify を必ず書く — 検証できない契約は並走 gate にならない)
2. `impl-config.yaml` の `contracts[]` に宣言を足す(bootstrap P2 の再実行 or 手動編集 +
   `config_confirmed` イベント)
3. パイプライン側(bootstrap SKILL.md / dist-impl-run SKILL.md / state-schema.md /
   subagent-template.md)の変更は**不要**(すべて contracts[] を loop する)

## contracts.lock.yaml の運用

1. 生成前に各契約の input(source ファイル)の sha256 を取る
2. 生成後、契約ごとに `input` + `generated`(出力 dir・generator 名・日時)を lock に記録
   (スキーマは state-schema.md)
3. S3 では契約ごとに lock の sha256 と現物を照合。一致 → 再生成 skip / 不一致 → 再生成して lock 更新。
   照合とは独立に、種別の verify を当該 UC の範囲で実行する(結果は S3 done に記録)
4. `packages/contracts/` は S4(tier 並走)中 read-only。Implementer が書き換えたら
   write-set 違反として失敗させる
