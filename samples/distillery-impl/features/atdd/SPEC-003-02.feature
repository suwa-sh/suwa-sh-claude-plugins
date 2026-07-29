# source: docs/usdm/latest/requirements.yaml#requirements[REQ-003].specifications[SPEC-003-02].acceptance_criteria
Feature: SPEC-003-02 返却期限を超過した場合に延滞者へ督促通知を自動送信する

  @atdd_SPEC-003-02-1
  Scenario: SPEC-003-02-1
    Given 返却期限を超過した貸出が存在する
    When 日次バッチが実行される
    Then 延滞者にメールで督促通知が送信される
