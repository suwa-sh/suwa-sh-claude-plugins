# source: docs/usdm/latest/requirements.yaml#requirements[REQ-004].specifications[SPEC-004-01].acceptance_criteria
Feature: SPEC-004-01 利用者が自分の貸出履歴（過去・現在）をWeb画面で確認できる

  @atdd_SPEC-004-01-1
  Scenario: SPEC-004-01-1
    Given 利用者がログイン済み
    When マイページの貸出履歴画面を開く
    Then 過去と現在の貸出一覧が表示される
