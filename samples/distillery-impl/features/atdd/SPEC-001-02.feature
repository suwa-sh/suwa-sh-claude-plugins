# source: docs/usdm/latest/requirements.yaml#requirements[REQ-001].specifications[SPEC-001-02].acceptance_criteria
Feature: SPEC-001-02 利用者情報（氏名、連絡先、利用者番号等）を登録・編集・削除できる

  @atdd_SPEC-001-02-1
  Scenario: SPEC-001-02-1
    Given 司書がログイン済み
    When 利用者登録画面で氏名・連絡先を入力して登録する
    Then 利用者が登録され利用者番号が発行される
