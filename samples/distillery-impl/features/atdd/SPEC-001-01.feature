# source: docs/usdm/latest/requirements.yaml#requirements[REQ-001].specifications[SPEC-001-01].acceptance_criteria
Feature: SPEC-001-01 書籍情報（タイトル、著者、ISBN、出版社、ジャンル等）を登録・編集・削除できる

  @atdd_SPEC-001-01-1
  Scenario: SPEC-001-01-1
    Given 司書がログイン済み
    When 書籍登録画面でISBN・タイトル・著者を入力して登録する
    Then 書籍が蔵書として登録され一覧に表示される

  @atdd_SPEC-001-01-2
  Scenario: SPEC-001-01-2
    Given 登録済み書籍が存在する
    When 司書が書籍情報を編集する
    Then 変更内容が反映される
