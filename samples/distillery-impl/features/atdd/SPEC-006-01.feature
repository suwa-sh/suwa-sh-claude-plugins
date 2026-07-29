# source: docs/usdm/latest/requirements.yaml#requirements[REQ-006].specifications[SPEC-006-01].acceptance_criteria
Feature: SPEC-006-01 書籍情報に資料種別（紙書籍・電子書籍）を持たせ、将来の電子書籍対応に備える

  @atdd_SPEC-006-01-1
  Scenario: SPEC-006-01-1
    Given 書籍登録画面
    When 資料種別を選択できる
    Then 紙書籍として登録でき、将来電子書籍も選択可能な設計となっている
