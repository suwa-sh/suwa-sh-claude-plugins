# 書籍を削除する

## 概要

司書が不要な書籍を蔵書から除外する。在庫あり状態の書籍のみ削除可能。貸出中・延滞中の書籍は削除できない。

## データフロー

```mermaid
graph LR
  subgraph FE["tier-frontend (admin)"]
    FE_View["View\n蔵書管理画面"]
    FE_State["State\nDeleteConfirm"]
    FE_API["API Client\nDELETE /api/v1/books/:id"]
    FE_View --> FE_State --> FE_API
  end
  subgraph BE["tier-backend-api"]
    BE_Pres["presentation\nDeleteBookRequest"]
    BE_UC["usecase\nDeleteBookCommand"]
    BE_Domain["domain\nBook Entity\nstatus=在庫あり確認"]
    BE_GW["gateway\nBookRepository"]
    BE_Pres --> BE_UC --> BE_Domain
    BE_UC --> BE_GW
  end
  subgraph DB["RDB"]
    DB_Table[("books\nDELETE")]
  end
  FE_API -->|"DELETE /api/v1/books/:id"| BE_Pres
  BE_GW -->|"DELETE FROM books WHERE id=:id"| DB_Table
  DB_Table --> BE_GW --> BE_Domain --> BE_UC --> BE_Pres -->|"HTTP 204"| FE_API --> FE_State --> FE_View
```

| レイヤー | データモデル | 変換内容 |
|---------|------------|---------|
| FE View | 削除確認ダイアログ（書籍タイトル表示） | 確認ボタンクリック → API呼出し |
| BE presentation | DeleteBookRequest(id) | パスパラメータから取得 |
| BE domain | Book Entity status チェック | 在庫あり以外は BusinessException |
| BE gateway | DELETE FROM books WHERE id=:id | 論理削除 or 物理削除 |
| Response | 204 No Content | なし |

## 処理フロー

```mermaid
sequenceDiagram
  actor Librarian as 司書
  box rgb(230,240,255) tier-frontend (admin)
    participant View as 蔵書管理画面
    participant Dialog as 削除確認ダイアログ
    participant APIClient as API Client
  end
  box rgb(240,255,240) tier-backend-api
    participant Pres as presentation
    participant UC as usecase
    participant Domain as domain
    participant GW as gateway
  end
  participant DB as RDB

  Librarian->>View: 書籍「吾輩は猫である」の削除ボタンクリック
  View->>Dialog: 確認ダイアログ表示「この書籍を削除しますか？」
  Librarian->>Dialog: 「削除する」ボタンクリック
  Dialog->>APIClient: DELETE /api/v1/books/:id
  APIClient->>Pres: DELETE /api/v1/books/:id
  Pres->>UC: DeleteBookCommand(id)
  UC->>GW: findById(id)
  GW->>DB: SELECT * FROM books WHERE id=:id
  DB-->>GW: Book record
  GW-->>UC: Book
  UC->>Domain: Book.canDelete()
  alt 書籍貸出状態が「在庫あり」
    Domain-->>UC: true
    UC->>GW: delete(id)
    GW->>DB: DELETE FROM books WHERE id=:id
    DB-->>GW: OK
    UC-->>Pres: success
    Pres-->>APIClient: HTTP 204
    APIClient-->>View: 削除成功
    View-->>Librarian: 一覧を再読み込み
  else 書籍貸出状態が「貸出中」または「延滞中」
    Domain-->>UC: BusinessException
    UC-->>Pres: error
    Pres-->>APIClient: HTTP 409
    APIClient-->>View: エラー表示
    View-->>Librarian: 「貸出中の書籍は削除できません」
  end
```

## バリエーション一覧

該当なし

## 分岐条件一覧

| 条件名 | 判定ルール | 適用 tier | 適用箇所 | BDD Scenario |
|--------|----------|----------|---------|-------------|
| 貸出可否判定ルール（削除用） | 書籍貸出状態が「在庫あり」の場合のみ削除可能 | tier-backend-api | DeleteBookCommand | 貸出中書籍の削除拒否 |

## 計算ルール一覧

該当なし

## 状態遷移一覧

| 状態モデル | 遷移元 | 遷移先 | トリガー | 事前条件 | 事後処理 | 適用 tier |
|-----------|--------|--------|---------|---------|---------|----------|
| 書籍貸出状態 | 在庫あり | (終了) | 書籍を削除する | 在庫あり状態であること | 関連予約があれば予約キャンセル | tier-backend-api |

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 |
|-----------|--------|------|
| 業務 | 蔵書管理業務 | このUCが属する業務 |
| BUC | 蔵書管理フロー | このUCを含むBUC |
| アクター | 司書 | 操作するアクター |
| 情報 | 書籍 | 削除する情報 |
| 状態 | 書籍貸出状態 | 在庫あり → 終了 |

## E2E 完了条件（BDD）

### 正常系

```gherkin
Feature: 書籍を削除する

  Scenario: 在庫あり書籍の削除
    Given 司書「山田花子」がログイン済み
    And 「在庫あり」状態の書籍「吾輩は猫である」が登録済み
    When 蔵書管理画面で「吾輩は猫である」の削除ボタンをクリックする
    And 確認ダイアログで「削除する」をクリックする
    Then 蔵書管理画面から「吾輩は猫である」が消える
```

### 異常系

```gherkin
  Scenario: 貸出中書籍の削除拒否
    Given 司書「山田花子」がログイン済み
    And 「貸出中」状態の書籍「こころ」が存在する
    When 蔵書管理画面で「こころ」の削除ボタンをクリックする
    And 確認ダイアログで「削除する」をクリックする
    Then 「貸出中の書籍は削除できません」エラーが表示される
```

## ティア別仕様

- [フロントエンド](tier-frontend.md)
- [バックエンドAPI](tier-backend-api.md)
