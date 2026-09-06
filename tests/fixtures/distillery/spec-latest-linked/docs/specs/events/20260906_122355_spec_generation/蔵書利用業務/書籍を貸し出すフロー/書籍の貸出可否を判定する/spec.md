# 書籍の貸出可否を判定する

## 概要

司書が書籍と利用者を指定し、登録前に貸出可否と拒否理由を確認する。

## 関連 RDRA モデル

[RDRA BUC](../../../../../../rdra/latest/BUC.tsv)の「書籍の貸出可否を判定する」を参照する。

## API契約

[API対応表](_api-summary.yaml)の`checkLoanEligibility`を参照する。

## E2E 完了条件

```gherkin
Feature: 書籍の貸出可否を判定する
  Scenario: 存在する対象を照会する
    Given 認証済みで対象の参照権限がある
    When 存在する対象を指定してcheckLoanEligibilityを呼ぶ
    Then 契約に適合する照会結果を返す
    And 業務データを更新しない
```

## ティア別仕様

- [Backend API](tier-backend-api.md)
