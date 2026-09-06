# 書籍詳細と在庫状況を照会する — API参照コンテキスト

`getBookAvailability` の型・レスポンスは `_contract-slice.json` を参照する。
正本は `_cross-cutting/api/openapi.yaml` から参照する分割ファイルである。
このファイルはoperationの所有先を示すためのコンテキストであり、処理手順を定義する実装仕様ではない。

```gherkin
Feature: 契約参照の確認
  Scenario: 貸出登録の参照先を解決できる
    Given 分割OpenAPIをbundle済みである
    When 貸出登録のconsumesから getBookAvailability を参照する
    Then このUCが唯一の実装所有者として解決される
```

このScenarioは契約構造の検査であり、業務E2Eの代用ではない。
