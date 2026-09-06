# 利用者番号で貸出対象利用者を特定する

## 概要

司書が利用者番号を指定し、貸出先の氏名と利用者区分と状態を確認する。

## 関連 RDRA モデル

[RDRA BUC](../../../../../../rdra/latest/BUC.tsv)の「利用者番号で貸出対象利用者を特定する」を参照する。

## API契約

[API対応表](_api-summary.yaml)の`getLoanTarget`を参照する。

## E2E 完了条件

```gherkin
Feature: 利用者番号で貸出対象利用者を特定する
  Scenario: 存在する対象を照会する
    Given 認証済みで対象の参照権限がある
    When 存在する対象を指定してgetLoanTargetを呼ぶ
    Then 契約に適合する照会結果を返す
    And 業務データを更新しない
```

## ティア別仕様

- [Backend API](tier-backend-api.md)
