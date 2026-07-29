# source: docs/usdm/latest/requirements.yaml#requirements[REQ-002].specifications[SPEC-002-03].acceptance_criteria
Feature: SPEC-002-03 利用者が貸出中の書籍に対して予約を行える

  @atdd_SPEC-002-03-1
  Scenario: SPEC-002-03-1
    Given 書籍が貸出中
    When 利用者が予約ボタンを押す
    Then 予約が記録され予約順が設定される

  @atdd_SPEC-002-03-2
  Scenario: SPEC-002-03-2
    Given 予約済み書籍が返却された
    When 予約順1位の利用者に通知する
    Then 利用者に予約可能通知が届く
