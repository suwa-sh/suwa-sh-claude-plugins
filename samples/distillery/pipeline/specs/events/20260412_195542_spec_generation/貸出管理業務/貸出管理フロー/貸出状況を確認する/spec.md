# 貸出状況を確認する

## 概要

司書が貸出中の書籍一覧を確認する。貸出状況一覧画面で、全利用者の貸出中・延滞中の貸出レコードを一覧表示する。

## データフロー

```mermaid
graph LR
  subgraph FE["tier-frontend (admin)"]
    FE_View["View\n貸出状況一覧画面"]
    FE_State["State\nLoanListState"]
    FE_API["API Client\nGET /api/v1/loans"]
    FE_View --> FE_State --> FE_API
  end
  subgraph BE["tier-backend-api"]
    BE_Pres["presentation\nListLoansQuery"]
    BE_UC["usecase\nListLoansQuery"]
    BE_GW["gateway\nLoanRepository"]
    BE_Pres --> BE_UC --> BE_GW
  end
  subgraph DB["RDB"]
    DB_Table[("loans JOIN books JOIN users\nSELECT")]
  end
  FE_API -->|"GET /api/v1/loans?page=1&per_page=20"| BE_Pres
  BE_GW -->|"SELECT loans JOIN books JOIN users"| DB_Table
  DB_Table --> BE_GW --> BE_UC --> BE_Pres -->|"HTTP 200 {items, total, page}"| FE_API --> FE_State --> FE_View
```

| レイヤー | データモデル | 変換内容 |
|---------|------------|---------|
| FE View | LoanRecord コンポーネント一覧 | ページネーション付き一覧表示 |
| BE presentation | ListLoansQuery(page, per_page, status) | クエリパラメータからQuery変換 |
| BE gateway | SELECT loans JOIN books JOIN users | 貸出+書籍+利用者情報の結合取得 |
| Response | PaginatedResponse(items: LoanListItem[], total, page) | ページネーション付き一覧 |

## 処理フロー

```mermaid
sequenceDiagram
  actor Librarian as 司書
  box rgb(230,240,255) tier-frontend (admin)
    participant View as 貸出状況一覧画面
    participant APIClient as API Client
  end
  box rgb(240,255,240) tier-backend-api
    participant Pres as presentation
    participant UC as usecase
    participant GW as gateway
  end
  participant DB as RDB

  Librarian->>View: 貸出状況一覧画面にアクセス
  View->>APIClient: GET /api/v1/loans?page=1&per_page=20
  APIClient->>Pres: GET /api/v1/loans?page=1&per_page=20
  Pres->>UC: ListLoansQuery(page=1, per_page=20)
  UC->>GW: findAllLoans(page, per_page)
  GW->>DB: SELECT l.*, b.title, u.name FROM loans l JOIN books b ON l.book_id=b.id JOIN users u ON l.user_id=u.id WHERE l.return_date IS NULL ORDER BY l.loan_date DESC LIMIT 20 OFFSET 0
  DB-->>GW: Loan records
  GW-->>UC: PaginatedResult
  UC-->>Pres: PaginatedResponse
  Pres-->>APIClient: HTTP 200
  APIClient-->>View: 一覧データ
  View-->>Librarian: LoanRecord コンポーネントで一覧表示
```

## バリエーション一覧

該当なし

## 分岐条件一覧

該当なし

## 計算ルール一覧

該当なし

## 状態遷移一覧

該当なし（参照のみ）

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 |
|-----------|--------|------|
| 業務 | 貸出管理業務 | このUCが属する業務 |
| BUC | 貸出管理フロー | このUCを含むBUC |
| アクター | 司書 | 操作するアクター |
| 情報 | 貸出 | 参照する情報 |

## E2E 完了条件（BDD）

### 正常系

```gherkin
Feature: 貸出状況を確認する

  Scenario: 貸出中書籍の一覧表示
    Given 司書「山田花子」がログイン済み
    And 利用者「田中太郎」が書籍「吾輩は猫である」を貸出中（返却期限: 2026-04-26）
    And 利用者「佐藤次郎」が書籍「こころ」を延滞中（返却期限: 2026-04-01）
    When 貸出状況一覧画面にアクセスする
    Then 2件の貸出レコードが表示される
    And 「こころ」のレコードが延滞ハイライトで表示される
```

### 異常系

```gherkin
  Scenario: 貸出なしの場合
    Given 司書「山田花子」がログイン済み
    And 貸出中の書籍が0件
    When 貸出状況一覧画面にアクセスする
    Then 「現在貸出中の書籍はありません」メッセージが表示される
```

## ティア別仕様

- [フロントエンド](tier-frontend.md)
- [バックエンドAPI](tier-backend-api.md)
