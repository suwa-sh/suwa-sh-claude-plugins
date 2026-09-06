# 書籍詳細と在庫状況を照会する

## 概要

司書または利用者が書籍IDを指定し、書籍の詳細と現在の在庫状況を確認する。

## 関連 RDRA モデル

[RDRA BUC](../../../../../../rdra/latest/BUC.tsv)の「書籍詳細と在庫状況を照会する」を参照する。

## API契約

[API対応表](_api-summary.yaml)の`getBookAvailability`を参照する。

## E2E 完了条件

```gherkin
Feature: 書籍詳細と在庫状況を照会する
  Scenario: 存在する対象を照会する
    Given 認証済みで対象の参照権限がある
    When 存在する対象を指定してgetBookAvailabilityを呼ぶ
    Then 契約に適合する照会結果を返す
    And 業務データを更新しない
```

## ティア別仕様

- [Backend API](tier-backend-api.md)
