# source: docs/usdm/latest/requirements.yaml#requirements[REQ-005].specifications[SPEC-005-02].acceptance_criteria
Feature: SPEC-005-02 司書が人気書籍ランキングや貸出統計をレポートとして確認できる

  @atdd_SPEC-005-02-1
  Scenario: SPEC-005-02-1
    Given 司書がログイン済み
    When 統計レポート画面を開く
    Then 貸出回数ランキング・期間別統計が表示される
