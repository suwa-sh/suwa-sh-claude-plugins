# source: docs/usdm/latest/requirements.yaml#requirements[REQ-004].specifications[SPEC-004-02].acceptance_criteria
Feature: SPEC-004-02 利用者が自分の予約状況をWeb画面で確認できる

  @atdd_SPEC-004-02-1
  Scenario: SPEC-004-02-1
    Given 利用者がログイン済み
    When マイページの予約状況画面を開く
    Then 現在の予約一覧と予約順が表示される
