# source: docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-backend-api.md#ティア完了条件（BDD）
Feature: 書籍を貸出する - バックエンドAPI

  Scenario: 正常な貸出
    Given 「在庫あり」で予約なしの書籍 book_id="abc-123" が存在する
    And 利用者 user_id="user-001" のアクセストークンが有効
    When POST /api/v1/loans に book_id="abc-123" を送信する
    Then HTTP 201 が返却される
    And レスポンスの due_date が「2026-04-26」である
    And books テーブルの id="abc-123" の status が "on_loan" に更新されている
    And loans テーブルに book_id="abc-123", user_id="user-001" のレコードが作成されている

  Scenario: 冪等キー重複での二重貸出防止
    Given 冪等キー "key-001" で貸出が完了済み
    When 同じ冪等キー "key-001" で POST /api/v1/loans を送信する
    Then HTTP 409 が返却される
    And 新しい貸出レコードは作成されない
