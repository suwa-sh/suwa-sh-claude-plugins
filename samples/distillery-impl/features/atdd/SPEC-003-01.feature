# source: docs/usdm/latest/requirements.yaml#requirements[REQ-003].specifications[SPEC-003-01].acceptance_criteria
Feature: SPEC-003-01 貸出時に返却期限を自動設定し、期限が近づいたら利用者にリマインド通知を送信する

  @atdd_SPEC-003-01-1
  Scenario: SPEC-003-01-1
    Given 貸出が記録済み
    When 返却期限3日前になる
    Then 利用者にリマインドメールが送信される
