# 契約カタログ方式（検証用の明示選択）

`dist-spec contract_mode=catalog` の場合だけ使用する。未指定は第1段階の `legacy`。
既存イベントを自動変換しない。実生成での受入確認が完了するまでデフォルトにしない。

## 編集する正本

`_cross-cutting/api/contracts.json` を単一担当が編集する。
OpenAPI / AsyncAPI の型・制約・認可・エラー・拡張フィールドをネイティブ形式のまま保持する。
API本文やsummaryを第二の定義元にしない。

```json
{
  "schema_version": "distillery.contracts/v1",
  "openapi": { "openapi": "3.1.0", "info": { "title": "Example", "version": "1.0.0" }, "paths": {}, "components": {} },
  "asyncapi": null,
  "use_cases": [
    {
      "business": "業務名", "buc": "BUC名", "uc": "UC名",
      "provides": [],
      "consumes": []
    }
  ]
}
```

`use_cases` は RDRA の全UCを列挙する。各 `provides` / `consumes` の項目:

```json
{ "kind": "openapi", "operation_id": "createLoan", "tier": "tier-backend-api" }
```

- `openapi` / `asyncapi` は完全な標準仕様文書、対象がない場合は `null`。
- OpenAPI は `paths` 配下の各HTTP操作に一意な `operationId` を持つ。AsyncAPIは `operations` のキーを使う。
- 各operationの実装所有者は `provides` の1 UC × tierだけ。呼び出す他UC/tierは `consumes` に宣言する。
  共有operationを複数UCが実装する重複所有にしない。
- 型・共通エラー・認証は各標準文書のcomponents等に一度だけ定義する。
- このコンパイラの参照対応範囲はローカルJSON Pointer。外部 `$ref`、anchor参照、`$id` / `$dynamicRef` /
  `$recursiveRef` は事前bundleが必要として停止する。黙って落とさない。Path Itemはinlineとする。
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
   UC担当がsummary/slice/openapi/asyncapiを直接修正してはならない。
5. Step4aはLLMで統合し直さずcompileする。Step6では `--check` と標準lintを実行する。
6. Step3.5 / Step4dの機械ビューは `buildSpecViews.js` で生成する。意味上のレビューは省略しない。

```bash
node <skill-path>/scripts/compileContracts.js docs/specs/events/{event_id}
node <skill-path>/scripts/compileContracts.js docs/specs/events/{event_id} --check
node <skill-path>/scripts/buildSpecViews.js docs/specs/events/{event_id} docs/rdra/latest
node <skill-path>/scripts/buildSpecViews.js docs/specs/events/{event_id} docs/rdra/latest --check
```

## 派生物と読み方

- `_cross-cutting/api/openapi.yaml` / `asyncapi.yaml`: 正本の標準文書を無損失で出力する。
- UCの `_api-summary.yaml`: v2。operation・tier・所有者・参照先・slice hashだけの索引。型は再掲しない。
- UCの `_contract-slice.json`: 提供/利用operationと参照先のclosure。
  path単位のparameters、共通エラー、security schemes、循環schema、message payload/headerを含む。
- `_cross-cutting/api/.contracts-build.json`: 生成ファイル集合とhash。削除されたoperation/UCの派生物を
  次回compileで片付けるために使う。手編集された削除対象は上書きせず停止する。
- 生成 `.yaml` は厳密JSONで直列化した **YAML 1.2のサブセット**。型やエスケープを失わず再現するためで、
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
