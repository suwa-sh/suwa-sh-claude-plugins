# source: docs/usdm/latest/requirements.yaml#requirements[REQ-001].specifications[SPEC-001-03].acceptance_criteria
Feature: SPEC-001-03 書籍をキーワード、タイトル、著者、ISBN、ジャンルで検索できる

  @atdd_SPEC-001-03-1
  Scenario: SPEC-001-03-1
    Given 利用者がシステムにアクセス済み
    When 検索条件を入力して検索する
    Then 条件に合致する書籍の一覧が表示される
