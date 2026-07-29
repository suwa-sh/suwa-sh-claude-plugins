# source: docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md#ティア完了条件（BDD）
Feature: 書籍を貸出する - フロントエンド

  Scenario: 貸出手続き画面の表示
    Given 利用者「田中太郎」がログイン済み
    And 「在庫あり」の書籍「吾輩は猫である」が存在する
    When /loans/new?book_id={bookId} にアクセスする
    Then BookCard に「吾輩は猫である」の情報が表示される
    And BookLoanStatusBadge が「在庫あり」(available) を表示する
    And 「貸出する」ボタンが有効である

  Scenario: 貸出完了後の表示
    Given 貸出手続き画面が表示されている
    When 「貸出する」ボタンをクリックする
    And API が HTTP 201 を返す
    Then 「貸出が完了しました。返却期限: 2026-04-26」が表示される
