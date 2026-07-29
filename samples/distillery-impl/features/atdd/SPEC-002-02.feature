# source: docs/usdm/latest/requirements.yaml#requirements[REQ-002].specifications[SPEC-002-02].acceptance_criteria
Feature: SPEC-002-02 利用者が書籍の返却手続きをWeb画面から行える

  @atdd_SPEC-002-02-1
  Scenario: SPEC-002-02-1
    Given 利用者が貸出中の書籍を選択済み
    When 返却ボタンを押す
    Then 返却が記録され書籍が貸出可能になる
