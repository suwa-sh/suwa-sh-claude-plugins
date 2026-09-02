# 書籍を削除する

## 概要

司書が除籍手続画面で、対象書籍を蔵書から削除（除籍）する。蔵書削除可否条件により、書籍状態が「在庫あり」であり、かつ予約状態が「予約中」「取置き中」の予約が存在しない場合に限り削除を許可する。書籍状態が「貸出中」「予約待ち」の書籍は進行中の取引が追跡できなくなるため削除できない。

## データフロー

```mermaid
graph LR
  subgraph FE["tier-frontend-staff"]
    FE_View["ビュー層\n除籍手続画面(BookWithdrawalView)"]
    FE_State["状態管理層\nWithdrawalState(対象書籍/可否/理由/冪等キー)"]
    FE_API["API クライアント層\nGET /api/v1/books/{book_id}/withdrawal-eligibility, DELETE /api/v1/books/{book_id}"]
    FE_View --> FE_State --> FE_API
  end
  subgraph BE["tier-backend-api"]
    BE_Pres["プレゼンテーション層\nWithdrawBookRequest(DTO)"]
    BE_UC["ユースケース層\nWithdrawBookCommand / CheckWithdrawalEligibilityQuery"]
    BE_Domain["ドメイン層\nBook(書籍)\n蔵書削除可否条件の判定"]
    BE_Repo["リポジトリ層\nBookRepository.findById()/delete()\nReservationQueryPort.countActive()"]
    BE_GW["ゲートウェイ層\nBookRecord(books adapter)\n予約コンテキスト参照 adapter"]
    BE_Pres --> BE_UC --> BE_Domain
    BE_UC --> BE_Repo --> BE_GW
  end
  subgraph DB["tier-datastore (RDB)"]
    DB_Books[("books\nbook_id, book_status")]
    DB_Res[("reservations\nbook_id, reservation_status")]
  end
  FE_API -->|"GET /withdrawal-eligibility → DELETE /api/v1/books/{book_id} + X-Idempotency-Key"| BE_Pres
  BE_GW -->|"SELECT book_status FROM books WHERE book_id=?"| DB_Books
  BE_GW -->|"SELECT COUNT(*) FROM reservations WHERE book_id=? AND reservation_status IN ('予約中','取置き中')"| DB_Res
  BE_GW -->|"DELETE FROM books WHERE book_id=? AND book_status='在庫あり'"| DB_Books
  DB_Books --> BE_GW --> BE_Repo --> BE_Domain --> BE_UC --> BE_Pres -->|"HTTP 200 WithdrawalEligibilityResponse / HTTP 204 No Content"| FE_API --> FE_State --> FE_View
```

| レイヤー | データモデル | 変換内容 |
|---------|------------|---------|
| FE ビュー層 | 対象書籍の書誌情報・書籍状態、削除可否と未充足理由 | 削除不可のとき理由を根拠つきで並べる |
| FE 状態管理層 | WithdrawalState(book, eligibility, submitting, idempotencyKey) | 確認 Modal の開閉と冪等キーの保持 |
| FE API クライアント層 | GET .../withdrawal-eligibility → DELETE /api/v1/books/{book_id} | 認証トークン付与・冪等キー付与・trace_id 発行 |
| BE プレゼンテーション層 | WithdrawBookRequest(book_id) | パス変数の形式検証 + Command/Query 変換 |
| BE ユースケース層 | CheckWithdrawalEligibilityQuery / WithdrawBookCommand | トランザクション境界・冪等キー検証・監査ログ出力 |
| BE ドメイン層 | Book（集約ルート AG-001） | 蔵書削除可否条件（book_status = 在庫あり かつ 有効予約 0 件）の強制 |
| BE リポジトリ層 | BookRepository / ReservationQueryPort | 予約件数は予約コンテキスト（BC-004）の公開インターフェース経由で取得する |
| BE ゲートウェイ層 | BookRecord ⇔ books テーブル | 条件つき DELETE と予約件数の SELECT |
| Response | WithdrawalEligibilityResponse / 204 No Content | 可否と未充足理由の提示、削除完了の提示 |

## 処理フロー

```mermaid
sequenceDiagram
  actor Staff as 司書

  box rgb(230,240,255) tier-frontend-staff
    participant View as ビュー層
    participant State as 状態管理層
    participant APIClient as API クライアント層
  end

  box rgb(240,255,240) tier-backend-api
    participant Pres as プレゼンテーション層
    participant UC as ユースケース層
    participant Domain as ドメイン層
    participant Repo as リポジトリ層
    participant GW as ゲートウェイ層
  end

  participant DB as tier-datastore (RDB)

  Staff->>View: 除籍手続画面(/staff/books/:bookId/withdraw)を開く
  View->>State: 削除可否の判定を要求する
  State->>APIClient: GET /api/v1/books/{book_id}/withdrawal-eligibility
  APIClient->>Pres: GET /api/v1/books/{book_id}/withdrawal-eligibility
  Pres->>UC: CheckWithdrawalEligibilityQuery
  UC->>Repo: findById(book_id) / countActiveReservations(book_id)
  Repo->>GW: SELECT
  GW->>DB: SELECT book_status FROM books / SELECT COUNT(*) FROM reservations WHERE reservation_status IN ('予約中','取置き中')
  DB-->>GW: book_status, 有効予約件数
  GW-->>Repo: 判定材料
  Repo-->>UC: Book, activeReservationCount
  UC->>Domain: book.canWithdraw(activeReservationCount)
  alt 蔵書削除可否条件: book_status が「貸出中」または「予約待ち」
    Domain-->>UC: 不可（理由: 進行中の貸出／取置きがある）
  else 有効予約が 1 件以上
    Domain-->>UC: 不可（理由: 予約中／取置き中の予約がある）
  else book_status が「在庫あり」かつ有効予約が 0 件
    Domain-->>UC: 可
  end
  UC-->>Pres: 可否と未充足理由
  Pres-->>APIClient: HTTP 200 WithdrawalEligibilityResponse
  APIClient-->>State: 可否と理由を格納する
  State-->>View: 可否に応じて除籍ボタン／理由一覧を表示する
  Staff->>View: 除籍を実行し、確認ダイアログで確定する
  View->>State: 冪等キーを生成して確定する
  State->>APIClient: DELETE /api/v1/books/{book_id}
  APIClient->>Pres: DELETE /api/v1/books/{book_id}（X-Idempotency-Key 付与）
  Pres->>UC: WithdrawBookCommand
  UC->>Domain: 蔵書削除可否条件を再判定する（画面の判定に依存しない）
  alt 条件を満たさない
    UC-->>Pres: 業務エラー
    Pres-->>APIClient: HTTP 422 BOOK_NOT_WITHDRAWABLE
  else 条件を満たす
    UC->>Repo: delete(book)
    Repo->>GW: 条件つき DELETE
    GW->>DB: DELETE FROM books WHERE book_id = ? AND book_status = '在庫あり'
    DB-->>GW: 1 件削除
    GW-->>Repo: 削除結果
    Repo-->>UC: 完了
    UC-->>Pres: 完了
    Pres-->>APIClient: HTTP 204 No Content
  end
  APIClient-->>State: 結果を格納する
  State-->>View: 完了メッセージ／業務エラーを反映する
  View-->>Staff: 「除籍しました」と蔵書管理台帳への導線を表示する
```

## バリエーション一覧

| バリエーション名 | 値 | 処理内容 | 適用 tier | 適用箇所 |
|----------------|---|---------|----------|---------|
| （該当なし） | - | 本 UC はバリエーションによる分岐を持たない（除籍手続画面の `variants` も定義されていない） | - | - |

## 分岐条件一覧

| 条件名 | 判定ルール | 適用 tier | 適用箇所 | BDD Scenario |
|--------|----------|----------|---------|-------------|
| 蔵書削除可否条件 | 対象書籍の書籍状態が「在庫あり」であり、かつ予約状態が「予約中」「取置き中」の予約が存在しない場合に限り削除を許可する | tier-frontend-staff / tier-backend-api | 除籍手続画面の可否表示 / Book.canWithdraw（ドメイン層） | 貸出中の書籍は除籍できない / 予約がある書籍は除籍できない |
| 対象書籍の存在確認 | book_id に一致する書籍が存在しないときは 404 とする | tier-backend-api | ユースケース層の findById | 存在しない書籍の除籍を拒否する |
| 破壊的操作の確認 | 除籍は `Modal(destructive-confirm)` で対象書籍名を再掲したうえで確定させる（直接 URL 遷移で完了させない） | tier-frontend-staff | 除籍手続画面 | 確認ダイアログを経ずに除籍できない |

## 計算ルール一覧

| 計算名 | 入力情報 | 計算式/ロジック | 出力情報 | 適用 tier |
|--------|---------|---------------|---------|----------|
| 有効予約件数の算出 | 予約.予約状態、予約.書籍ID | count(予約 where 書籍ID = 対象 かつ 予約状態 ∈ {予約中, 取置き中}) | 削除可否判定に使う有効予約件数 | tier-backend-api |
| 未充足理由の組み立て | 書籍.書籍状態、有効予約件数 | 書籍状態が在庫あり以外なら「進行中の取引がある」、有効予約 ≥ 1 なら「予約が残っている」を理由に加える | 削除不可理由の一覧 | tier-backend-api |

## 状態遷移一覧

| 状態モデル | 遷移元 | 遷移先 | トリガー | 事前条件 | 事後処理 | 適用 tier |
|-----------|--------|--------|---------|---------|---------|----------|
| 書籍状態 | 在庫あり | （終了・蔵書から除かれる） | 書籍を削除する | 書籍状態が「在庫あり」かつ予約状態「予約中」「取置き中」の予約が存在しない（蔵書削除可否条件） | books から該当行を削除し、蔵書一覧・検索の対象から外れる | tier-backend-api |

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 |
|-----------|--------|------|
| 業務 | 蔵書管理業務 | このUCが属する業務 |
| BUC | 蔵書を管理するフロー | このUCを含むBUC |
| アクター | 司書 | 操作するアクター（提供者） |
| 情報 | 書籍 | 削除する情報 |
| 情報 | 予約 | 削除可否判定で参照する情報 |
| 状態 | 書籍状態 | 「在庫あり」からの終了遷移 |
| 状態 | 予約状態 | 「予約中」「取置き中」の有無を判定する |
| 条件 | 蔵書削除可否条件 | 適用される条件 |
| 画面 | 除籍手続画面 | 操作する画面 |

## 受け入れ基準トレーサビリティ

| 受け入れ基準 ID | 役割 | 対応する BDD Scenario |
|---|---|---|
| SPEC-001-01#3 | 主担当 | 在庫ありで予約のない書籍を除籍する |

受け入れ基準 ID の定義は `_cross-cutting/traceability-matrix.md`「USDM 受け入れ基準 ↔ UC 対応表」を正本とする。

## E2E 完了条件（BDD）

### 正常系

```gherkin
Feature: 書籍を削除する

  Scenario: 在庫ありで予約のない書籍を除籍する
    Given 司書「山田花子」が司書ポータルにログイン済み
    And 「吾輩は猫である」の書籍状態が「在庫あり」で、予約状態が「予約中」「取置き中」の予約が0件である
    When 司書が除籍手続画面で除籍を実行し、確認ダイアログで「除籍する」を押す
    Then 「除籍しました」と表示され、蔵書管理台帳画面から「吾輩は猫である」が消える
```

### 異常系

```gherkin
  Scenario: 貸出中の書籍は除籍できない
    Given 司書「山田花子」が司書ポータルにログイン済み
    And 「坊っちゃん」の書籍状態が「貸出中」である
    When 司書が「坊っちゃん」の除籍手続画面を開く
    Then 「貸出中のため除籍できません」という理由が表示され、除籍ボタンが押せない

  Scenario: 予約がある書籍は除籍できない
    Given 「こころ」の書籍状態が「予約待ち」で、予約状態「取置き中」の予約が1件ある
    When 司書が「こころ」の除籍手続画面を開く
    Then 「予約待ちのため除籍できません」「取置き中の予約が1件あります」という理由が並んで表示され、除籍ボタンが押せない

  Scenario: 確認ダイアログを経ずに除籍できない
    Given 司書「山田花子」が「吾輩は猫である」の除籍手続画面を開いている
    When 司書が除籍ボタンを押す
    Then 対象書籍名「吾輩は猫である」を再掲した確認ダイアログが開き、確定するまで削除は行われない

  Scenario: 判定後に状態が変わった書籍の除籍を拒否する
    Given 司書「山田花子」が「吾輩は猫である」の除籍手続画面で除籍可能と表示されている
    And 別の司書が同じ書籍の貸出を登録して書籍状態が「貸出中」になっている
    When 司書が確認ダイアログで「除籍する」を押す
    Then 「貸出中のため除籍できません」と表示され、書籍は削除されない
```

## ティア別仕様

- [司書ポータル](tier-frontend-staff.md)
- [バックエンド API](tier-backend-api.md)

### 統合 API Spec

- [OpenAPI Spec](../../../_cross-cutting/api/openapi.yaml)（全 UC 統合、Contract First 開発用）
