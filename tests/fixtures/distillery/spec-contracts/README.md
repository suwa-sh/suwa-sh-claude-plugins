# 契約カタログの検証用サンプル

3 UCのHTTP APIとイベント契約を使った、コンパイラの小さな検証例です。
手書きのテスト入力 `contracts.json` からスクリプトで生成しています。
dist-pipelineで生成した業務仕様や、実生成の受入結果ではありません。
UC本文・BDD・RDRAを省いた契約だけのfixtureなので、Specイベント全体のvalidator対象にはしません。

- 編集元: `_cross-cutting/api/contracts.json`
- 生成物: OpenAPI / AsyncAPI、各UCの `_api-summary.yaml` と `_contract-slice.json`、生成manifest
- 所有者: 貸出登録がcreateLoan/sendLoan、書籍照会がgetBook、書籍削除がdeleteBook
- 依存: 貸出登録はgetBookを利用。抜粋にはその型も含み、deleteBookと未使用schemaは含みません。
- 保持する項目: required、enum、nullable、認可、エラー、冪等性header、循環参照、イベントpayload/header

リポジトリ直下から再現します:

```bash
node plugins/distillery/skills/dist-spec/scripts/compileContracts.js samples/distillery/spec-contracts --check
node --test tests/dist-spec-contracts.test.js
```

変更時は正本だけを編集し、`--check` を外して再生成します。
生成yamlはJSON構文（YAML 1.2のサブセット）です。

標準lintは2026-09-05に隔離ディレクトリで実行しました。
Redoclyのminimal rulesetはエラー0、警告2（example.comのURLと意図的な未使用schema）。
AsyncAPI CLI 4.1.1はエラー0、警告0、情報1（3.1への更新推奨）。
この実験経路の対応バージョンはOpenAPI 3.1 / AsyncAPI 3.0です。
