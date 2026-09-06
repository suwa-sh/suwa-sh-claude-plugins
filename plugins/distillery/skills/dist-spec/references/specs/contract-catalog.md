# 契約の正本と生成ビュー

新規生成では `contract_mode=catalog` を使用する。`legacy` は既存イベントの互換経路として明示選択できる。
既存イベントを自動変換しない。生成に使うモデルやCLIは限定しない。

## 編集する正本

人と生成担当は分割したネイティブOpenAPI / AsyncAPIを直接編集する。型表やsummaryは編集しない。

```text
_cross-cutting/api/
├── contracts.json                 # UC・operation・tierの所有/利用対応だけ
├── openapi.yaml                   # 手編集する入口
├── paths/loans.yaml               # Path Item
├── components/schemas/Loan.yaml   # 共通型。responses等も必要単位で分割
├── generated/openapi.bundle.yaml  # 生成物。Swagger UI/codegen入力
├── asyncapi.yaml                   # 非同期契約の手編集する入口
├── channels/loan-created.yaml      # チャネル
├── operations/sendLoan.yaml        # 送受信操作
├── components/messages/LoanCreated.yaml
├── components/schemas/LoanCreatedPayload.yaml
└── generated/asyncapi.bundle.yaml   # AsyncAPI表示/codegen入力
```

入口の例（参照は各ファイルの所在を基準に解決する）:

```yaml
openapi: 3.1.0
info: { title: Library, version: 1.0.0 }
paths:
  /loans:
    $ref: ./paths/loans.yaml
components:
  schemas:
    Loan:
      $ref: ./components/schemas/Loan.yaml
```

`contracts.json` は次のように入口だけを指定する。

```json
{
  "schema_version": "distillery.contracts/v1",
  "openapi": "openapi.yaml",
  "asyncapi": "asyncapi.yaml",
  "use_cases": [
    {
      "business": "業務名", "buc": "BUC名", "uc": "UC名",
      "provides": [], "consumes": []
    }
  ]
}
```

分割ファイルには型・制約・認可・エラー・拡張フィールドをネイティブ形式で保持する。
OpenAPIの別ファイル `$ref` とPath Item参照はRedoclyでbundleする。AsyncAPIは標準JSON Schema $Ref Parserで外部参照をbundleし、operationのchannel/messagesとchannelのserversをAsyncAPI指定の索引へ再接続する。接続は解決先オブジェクトの同一性で検査し、同名や似た型による推測はしない。一意に解決できない参照は停止する。その後で所有者検査・slice生成へ渡す。
入力の `openapi.yaml` / `asyncapi.yaml` と分割ファイルは生成処理で上書きしない。生成物は `generated/` にだけ置く。
編集担当はoperationの重複所有を調整するが、人による直接編集を禁止しない。

### 実行環境と互換性

Redocly CLI **2.51.1** を実行環境へ用意する。リポジトリ内は `npm ci`、
スキルだけをインストールした環境では `npm install --prefix <runtime-dir> @redocly/cli@2.51.1` を実行し、
`REDOCLY_CLI=<runtime-dir>/node_modules/@redocly/cli/bin/cli.js` を指定する。
コンパイラはこの環境変数、利用可能なnode_modules、PATHの `redocly` の順で探す。
暗黙のネットワークインストールは行わず、不在なら生成を停止する。
依存バージョンを固定し、bundle時は空の設定を指定して周辺設定のdecorator等による変更を防ぐ。

AsyncAPI分割入力は **Node.js 20以降** と `@apidevtools/json-schema-ref-parser@14.2.1` を使う。
スキル単体環境ではplugin cacheの外へ `npm install --prefix <runtime-dir> @apidevtools/json-schema-ref-parser@14.2.1` し、
`ASYNCAPI_REF_PARSER=<runtime-dir>/node_modules/@apidevtools/json-schema-ref-parser/dist/lib/index.js` を指定する。
HTTPの外部参照は無効。正本ファイルをローカルへ管理し、ファイル相対 `$ref` でつなぐ。
RedoclyによるAsyncAPI3のbundleでは必須Reference Objectがインライン化されるため、この処理を分ける。
CIでは公式 `@asyncapi/parser@3.6.3` でも生成bundleの妥当性を検証する。

従来の `openapi: { ... }` / `asyncapi: { ... }` 埋め込みと `null` は互換入力として受理する。
埋め込み形式は従来どおり `api/openapi.yaml` / `api/asyncapi.yaml` を派生出力する。
移行時は旧派生物を人が分割正本へ変換し、`.contracts-build.json` の `files` から
`_cross-cutting/api/openapi.yaml` / `asyncapi.yaml` のうち移行した入口の旧エントリを除いてからcompileする。
この明示処理がない場合は正本の誤削除を防ぐため停止する。
AsyncAPI入口のchannels / operations / componentsは各分割ファイルを `$ref` で指す。
operationのchannelは入口のchannelsを、messagesはそのchannelのmessagesを指す。
詳細は `samples/distillery/spec-progressive/async/` の実行済み例を参照。
入口→該当operation→channel/message/schemaという読み順を使い、UC担当にbundle全体を必読にしない。

`use_cases` は RDRA の全UCを列挙する。各 `provides` / `consumes` の項目:

```json
{ "kind": "openapi", "operation_id": "createLoan", "tier": "tier-backend-api" }
```

- `openapi` は入口 `"openapi.yaml"`、互換形式の完全な標準文書、対象なしの `null`。`asyncapi` は入口 `"asyncapi.yaml"`、標準文書または `null`。
- OpenAPI は `paths` 配下の各HTTP操作に一意な `operationId` を持つ。AsyncAPIは `operations` のキーを使う。
- 各operationの実装所有者は `provides` の1 UC × tierだけ。呼び出す他UC/tierは `consumes` に宣言する。
  共有operationを複数UCが実装する重複所有にしない。
- 型・共通エラー・認証は各標準文書のcomponents等に一度だけ定義する。
- 分割OpenAPI / AsyncAPIは標準bundlerで外部 `$ref` を解決する。bundle後のslice処理はローカルJSON Pointerを扱う。
  bundle後にもanchor、`$id` / `$dynamicRef` / `$recursiveRef`、Path Itemの `$ref` が残る場合は停止する。
- これらはコンパイラの対応範囲であり、OpenAPI / AsyncAPI自体の制限ではない。
  標準仕様全体の検証は既存のRedocly / AsyncAPI lintを別途実行する。
  参照検査は文書全体を保守的に走査するため、exampleや拡張内でも上記の予約キーを参照として扱う。
  それらを通常のデータキーとして持つ入力は、この実験経路の対象外とする。

## 実行順序

1. Step1のUC/tier選定後、Step2.5として単一担当がRDRA/NFR/archと既存契約からカタログを生成する。
   根拠のない仕様は追加せず、lowの判断は従来の確認推奨項目へ記録する。
2. 下記コマンドで派生物を生成する。全参照・operation・所有者を検査してから書き込む。
3. Step3のUC担当は自身のsummaryとsliceを読む。API本文はoperation ID・認可の適用箇所・
   原子性/競合/冪等性/副作用・tier固有BDDだけを書き、入出力の型表を再定義しない。
4. UC担当が不足を発見した場合は単一のカタログ担当へ返す。カタログを修正し再compileする。
   UC担当は正本の分割OpenAPI / AsyncAPIを修正できるが、summary/slice/bundleを直接修正してはならない。
5. Step4aはLLMで統合し直さずcompileする。Step6では `--check` と標準lintを実行する。
6. Step3.5 / Step4dの機械ビューは `buildSpecViews.js` で生成する。意味上のレビューは省略しない。

```bash
node <skill-path>/scripts/compileContracts.js docs/specs/events/{event_id}
node <skill-path>/scripts/compileContracts.js docs/specs/events/{event_id} --check
node <skill-path>/scripts/buildSpecViews.js docs/specs/events/{event_id} docs/rdra/latest
node <skill-path>/scripts/buildSpecViews.js docs/specs/events/{event_id} docs/rdra/latest --check
```

## 派生物と読み方

- `_cross-cutting/api/generated/openapi.bundle.yaml`: 分割正本を統合した標準文書。Swagger UIからこの1ファイルを読む。
- `_cross-cutting/api/generated/asyncapi.bundle.yaml`: 非同期契約の統合文書。AsyncAPI表示/codegenへ渡す。
- 埋め込み互換入力では `_cross-cutting/api/openapi.yaml`、AsyncAPIは `asyncapi.yaml` を出力する。
- UCの `_api-summary.yaml`: v2。operation・tier・所有者・参照先・slice hashだけの索引。型は再掲しない。
- UCの `_contract-slice.json`: 提供/利用operationと参照先のclosure。
  path単位のparameters、共通エラー、security schemes、循環schema、message payload/headerを含む。
- `_cross-cutting/api/.contracts-build.json`: 生成ファイル集合とhash。削除されたoperation/UCの派生物を
  次回compileで片付けるために使う。手編集された削除対象は上書きせず停止する。
- 生成 `.yaml` は厳密JSONで直列化した **YAML 1.2のサブセット**。型やエスケープを失わず再現するためで、手編集の分割正本は通常のYAMLでよい。
  手編集のYAML規約の例外。既存parserにはこの形式用の厳密JSON読込を追加している。
- 別UCのAPIが変わっても、そのoperationを参照しないUCのsliceとsummaryは変わらない。
- native summaryからのdegraded codegenは `_contract-slice.json` の標準文書を使う。
  `schemas[]` が無いことを理由に型情報を推測したりlegacyへフォールバックしたりしない。

## BUCとトレーサビリティ

BUCは所属UCと契約の呼出依存から生成する。実行順序や補償の業務判断はUC仕様に保持し、
機械生成が呼出依存から順序を推測しない。

UCの `_trace-links.json` に要素と根拠の対応を記録する:

```json
{
  "schema_version": "distillery.trace-links/v1",
  "links": [
    {
      "element": "[\"condition\",\"コンテキスト名\",\"条件名\"]",
      "tier": "tier-backend-api",
      "file": "業務名/BUC名/UC名/spec.md",
      "anchor": "RULE-001",
      "scenarios": [{ "file": "業務名/BUC名/UC名/spec.md", "name": "シナリオ名" }]
    }
  ]
}
```

elementは `buildSpecViews.js` が出力する `traceability-index.json` の `elements[].key` を使用する。
未登録時は全要素がunlinkedで生成されるため、この一覧から対応を付ける。
ファイルパスはevent root基準、実在するregular fileに限定する。
情報属性・条件・バリエーション値・遷移パス・外部システムをTSVから列挙する。
linkedは対応先・tier・Scenarioの実在だけを表す。意味上の充足を100%と報告してはならない。
レビューで意味上の不足があればUC/対応記録を修正し、ビューを再生成する。

## イベント記録

Step5の `spec-event.yaml` の `use_cases[].files` には、既存の本文に加えてそのUCの
`_contract-slice.json`、`_api-summary.yaml`、存在する場合の `_trace-links.json` を列挙する。
API/イベント数は `provides` から数え、`consumes` を二重計上しない。
共有契約の生成ファイル集合は `.contracts-build.json` で追跡し、BUC/対応付けビューは
`buildSpecViews.js --check` で照合する。既存event schemaを維持する。

## 標準仕様

- [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0.html)
- [AsyncAPI 3.0](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
