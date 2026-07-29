# source: docs/usdm/latest/requirements.yaml#requirements[REQ-002].specifications[SPEC-002-01].acceptance_criteria
Feature: SPEC-002-01 利用者が書籍の貸出手続きをWeb画面から行える

  @atdd_SPEC-002-01-1 @uc_19ec0182
  Scenario: SPEC-002-01-1
    Given 利用者が貸出可能な書籍を選択済み
    When 貸出ボタンを押す
    Then 貸出が記録され返却期限が設定される

  @atdd_SPEC-002-01-2 @uc_19ec0182
  Scenario: SPEC-002-01-2
    Given 書籍が貸出中の場合
    When 別の利用者が貸出を試みる
    Then 貸出不可のメッセージが表示される
