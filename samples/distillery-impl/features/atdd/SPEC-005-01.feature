# source: docs/usdm/latest/requirements.yaml#requirements[REQ-005].specifications[SPEC-005-01].acceptance_criteria
Feature: SPEC-005-01 司書が書籍の在庫状況（貸出中・在庫あり・予約待ち）を一覧で確認できる

  @atdd_SPEC-005-01-1
  Scenario: SPEC-005-01-1
    Given 司書がログイン済み
    When 在庫状況画面を開く
    Then 全書籍の在庫状態が一覧表示される
