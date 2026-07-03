# 書籍を貸出する

## 概要

利用者が書籍の貸出手続きを行う。貸出可否判定ルール（在庫あり・予約なし）を適用し、貸出期限ルールに基づいて返却期限を設定する。貸出完了時に書籍の状態が「在庫あり」から「貸出中」に遷移する。

## データフロー

```mermaid
graph LR
  subgraph FE["tier-frontend (user)"]
    FE_View["View\n貸出手続き画面"]
    FE_State["State\nLoanForm"]
    FE_API["API Client\nPOST /api/v1/loans"]
    FE_View --> FE_State --> FE_API
  end
  subgraph BE["tier-backend-api"]
    BE_Pres["presentation\nCreateLoanRequest"]
    BE_UC["usecase\nCreateLoanCommand"]
    BE_Domain["domain\nLoan Entity\nBook.status: 在庫あり→貸出中"]
    BE_GW["gateway\nLoanRepository\nBookRepository"]
    BE_Pres --> BE_UC --> BE_Domain
    BE_UC --> BE_GW
  end
  subgraph DB["RDB"]
    DB_Loans[("loans\nINSERT")]
    DB_Books[("books\nUPDATE status")]
  end
  FE_API -->|"POST /api/v1/loans {book_id, user_id}"| BE_Pres
  BE_GW -->|"INSERT INTO loans"| DB_Loans
  BE_GW -->|"UPDATE books SET status='on_loan'"| DB_Books
  DB_Loans --> BE_GW
  DB_Books --> BE_GW
  BE_GW --> BE_Domain --> BE_UC --> BE_Pres -->|"HTTP 201 {loan_id, due_date}"| FE_API --> FE_State --> FE_View
```

| レイヤー | データモデル | 変換内容 |
|---------|------------|---------|
| FE View | 書籍情報表示 + 貸出ボタン | BookCard で書籍情報表示、ボタンクリック → API |
| BE presentation | CreateLoanRequest(book_id) | user_id はトークンから取得。バリデーション + Command |
| BE domain | Loan.create + Book.status 遷移 | 貸出可否判定 + 貸出期限計算 + 状態遷移 |
| BE gateway | INSERT loans + UPDATE books | トランザクション内で2テーブル更新 |
| Response | LoanResponse(loan_id, book_title, due_date) | 貸出完了・返却期限表示 |

## 処理フロー

```mermaid
sequenceDiagram
  actor User as 利用者
  box rgb(230,240,255) tier-frontend (user)
    participant View as 貸出手続き画面
    participant State as LoanForm State
    participant APIClient as API Client
  end
  box rgb(240,255,240) tier-backend-api
    participant Pres as presentation
    participant UC as usecase
    participant Domain as domain
    participant GW as gateway
  end
  participant DB as RDB

  User->>View: 蔵書検索画面から貸出ボタンクリック
  View->>State: setBookId
  State->>APIClient: POST /api/v1/loans
  APIClient->>Pres: POST /api/v1/loans {book_id}
  Pres->>Pres: 入力バリデーション
  Pres->>UC: CreateLoanCommand(book_id, user_id)
  UC->>GW: findBookById(book_id)
  GW->>DB: SELECT * FROM books WHERE id=:book_id
  DB-->>GW: Book record
  GW-->>UC: Book
  UC->>Domain: 貸出可否判定ルール
  alt 書籍が在庫ありかつ予約なし
    Domain-->>UC: 貸出可能
    UC->>Domain: 貸出期限計算（貸出日 + 14日）
    Domain-->>UC: due_date
    UC->>Domain: Loan.create(book_id, user_id, due_date)
    UC->>Domain: Book.status = 貸出中
    UC->>GW: saveLoan(loan) + updateBook(book)
    GW->>DB: BEGIN TRANSACTION
    GW->>DB: INSERT INTO loans (id, book_id, user_id, loan_date, due_date)
    GW->>DB: UPDATE books SET status='on_loan' WHERE id=:book_id
    GW->>DB: COMMIT
    DB-->>GW: OK
    GW-->>UC: Loan
    UC-->>Pres: LoanResponse
    Pres-->>APIClient: HTTP 201
    APIClient-->>State: 貸出成功
    State-->>View: 完了画面表示
    View-->>User: 「貸出が完了しました。返却期限: 2026-04-26」
  else 書籍が貸出中または予約あり
    Domain-->>UC: BusinessException
    UC-->>Pres: error
    Pres-->>APIClient: HTTP 409
    APIClient-->>State: エラー
    State-->>View: エラー表示
    View-->>User: 「この書籍は現在貸出できません」
  end
```

## バリエーション一覧

| バリエーション名 | 値 | 処理内容 | 適用 tier | 適用箇所 |
|----------------|---|---------|----------|---------|
| 利用者種別 | 一般 | 貸出期限14日 | tier-backend-api | 貸出期限計算 |
| 利用者種別 | 学生 | 貸出期限14日 | tier-backend-api | 貸出期限計算 |
| 利用者種別 | 児童 | 貸出期限14日 | tier-backend-api | 貸出期限計算 |

## 分岐条件一覧

| 条件名 | 判定ルール | 適用 tier | 適用箇所 | BDD Scenario |
|--------|----------|----------|---------|-------------|
| 貸出可否判定ルール | 書籍が在庫ありかつ予約がない場合に貸出可能 | tier-backend-api | CreateLoanCommand | 貸出可能な書籍の貸出 / 貸出不可書籍の拒否 |
| 貸出期限ルール | 貸出日から14日間を返却期限として設定 | tier-backend-api | Loan.create | 正常な貸出 |

## 計算ルール一覧

| 計算名 | 入力情報 | 計算式/ロジック | 出力情報 | 適用 tier |
|--------|---------|---------------|---------|----------|
| 返却期限計算 | 貸出日（現在日） | 貸出日 + 14日 | 返却期限 | tier-backend-api |

## 状態遷移一覧

| 状態モデル | 遷移元 | 遷移先 | トリガー | 事前条件 | 事後処理 | 適用 tier |
|-----------|--------|--------|---------|---------|---------|----------|
| 書籍貸出状態 | 在庫あり | 貸出中 | 書籍を貸出する | 貸出可否判定ルールが真 | loans テーブルにレコード作成 | tier-backend-api |
| 予約状態 | 予約確保済 | (終了) | 書籍を貸出する（予約者による） | 予約確保済の予約者がこの書籍を貸出 | 予約レコードを完了に更新 | tier-backend-api |

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 |
|-----------|--------|------|
| 業務 | 貸出管理業務 | このUCが属する業務 |
| BUC | 貸出管理フロー | このUCを含むBUC |
| アクター | 利用者 | 操作するアクター |
| 情報 | 書籍 | 貸出対象の書籍 |
| 情報 | 貸出 | 作成する貸出記録 |
| 条件 | 貸出期限ルール | 返却期限の設定 |
| 条件 | 貸出可否判定ルール | 貸出可否の判定 |
| 状態 | 書籍貸出状態 | 在庫あり → 貸出中 |
| 状態 | 予約状態 | 予約確保済 → 終了 |

## E2E 完了条件（BDD）

### 正常系

```gherkin
Feature: 書籍を貸出する

  Scenario: 貸出可能な書籍の貸出
    Given 利用者「田中太郎」がログイン済み
    And 「在庫あり」状態で予約なしの書籍「吾輩は猫である」が存在する
    When 貸出手続き画面で「吾輩は猫である」の「貸出する」ボタンをクリックする
    Then 「貸出が完了しました。返却期限: 2026-04-26」が表示される
    And 書籍「吾輩は猫である」の状態が「貸出中」に変わる

  Scenario: 予約確保済書籍の貸出
    Given 利用者「田中太郎」がログイン済み
    And 利用者「田中太郎」の予約が「予約確保済」の書籍「こころ」が存在する
    When 貸出手続き画面で「こころ」の「貸出する」ボタンをクリックする
    Then 「貸出が完了しました。返却期限: 2026-04-26」が表示される
    And 予約が完了状態になる
```

### 異常系

```gherkin
  Scenario: 貸出中書籍の貸出拒否
    Given 利用者「田中太郎」がログイン済み
    And 「貸出中」状態の書籍「坊っちゃん」が存在する
    When 書籍「坊っちゃん」の貸出を試みる
    Then 「この書籍は現在貸出できません」エラーが表示される

  Scenario: 他者の予約がある書籍の貸出拒否
    Given 利用者「田中太郎」がログイン済み
    And 「在庫あり」状態だが利用者「佐藤次郎」の予約がある書籍「三四郎」が存在する
    When 利用者「田中太郎」が書籍「三四郎」の貸出を試みる
    Then 「この書籍は現在貸出できません」エラーが表示される
```

## ティア別仕様

- [フロントエンド](tier-frontend.md)
- [バックエンドAPI](tier-backend-api.md)
