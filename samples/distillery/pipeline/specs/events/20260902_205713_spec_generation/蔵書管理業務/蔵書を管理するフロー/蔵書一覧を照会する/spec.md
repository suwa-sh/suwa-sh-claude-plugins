# 蔵書一覧を照会する

## 概要

司書が蔵書管理台帳画面で、登録済みの書籍をタイトル・著者・ISBN・出版社・ジャンル・資料種別とともに一覧表示する。書籍状態（在庫あり／貸出中／予約待ち）を併せて示し、一元管理されている蔵書の最新状態を確認できるようにする。

## データフロー

```mermaid
graph LR
  subgraph FE["tier-frontend-staff"]
    FE_View["ビュー層\n蔵書管理台帳画面(BookLedgerView)"]
    FE_State["状態管理層\nBookLedgerQueryState(検索条件/ページ)"]
    FE_API["API クライアント層\nGET /api/v1/books"]
    FE_View --> FE_State --> FE_API
  end
  subgraph BE["tier-backend-api"]
    BE_Pres["プレゼンテーション層\nListBooksRequest(DTO)"]
    BE_UC["ユースケース層\nListBooksQuery"]
    BE_Domain["ドメイン層\nBook(書籍)\nbook_status: 在庫あり/貸出中/予約待ち"]
    BE_Repo["リポジトリ層\nBookRepository.findPage()"]
    BE_GW["ゲートウェイ層\nBookRecord(books adapter)"]
    BE_Pres --> BE_UC --> BE_Domain
    BE_UC --> BE_Repo --> BE_GW
  end
  subgraph DB["tier-datastore (RDB)"]
    DB_Books[("books\nbook_id, title, author, isbn,\npublisher, genre, material_type,\nbook_status, registered_at, updated_at")]
  end
  FE_API -->|"GET /api/v1/books?genre=&material_type=&book_status=&keyword=&page=&per_page=20"| BE_Pres
  BE_GW -->|"SELECT ... FROM books WHERE 条件 ORDER BY updated_at DESC LIMIT 20 OFFSET n"| DB_Books
  DB_Books --> BE_GW --> BE_Repo --> BE_Domain --> BE_UC --> BE_Pres -->|"HTTP 200 BookListResponse(items[], total, page, per_page)"| FE_API --> FE_State --> FE_View
```

| レイヤー | データモデル | 変換内容 |
|---------|------------|---------|
| FE ビュー層 | 蔵書管理台帳画面の絞り込み入力（キーワード / ジャンル / 資料種別 / 書籍状態）とページ番号 | BookSearchFilter の選択値を BookLedgerQueryState へ反映する |
| FE 状態管理層 | BookLedgerQueryState(keyword, genre[], material_type[], book_status[], page) | クエリ文字列へ直列化し、条件変更時は page を 1 に戻す |
| FE API クライアント層 | GET /api/v1/books のクエリパラメータ | 認証トークン付与・trace_id 発行・タイムアウト/リトライ |
| BE プレゼンテーション層 | ListBooksRequest(keyword, genre[], material_type[], book_status[], page, per_page) | 形式・列挙値バリデーション + ListBooksQuery 変換 |
| BE ユースケース層 | ListBooksQuery | 読み取り専用（Query 側）。トランザクションは読み取り整合のみ |
| BE リポジトリ層 | BookRepository.findPage(criteria, page, per_page) | 検索条件を仕様オブジェクトへ変換 |
| BE ゲートウェイ層 | BookRecord ⇔ books テーブル | SELECT 結果を Book エンティティへ復元 |
| Response | BookListResponse(items[BookSummary], total, page, per_page) | 台帳テーブル行と BookStatusBadge の表示に使う |

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

  Staff->>View: 蔵書管理台帳画面(/staff/books)を開く / 絞り込みを変更する
  View->>State: 検索条件・ページを更新する
  State->>APIClient: 蔵書一覧を取得する
  APIClient->>Pres: GET /api/v1/books?keyword=&genre=&material_type=&book_status=&page=1&per_page=20
  Pres->>Pres: 入力バリデーション（page>=1, per_page<=100, 列挙値はバリエーションの値のみ）
  Pres->>UC: ListBooksQuery
  UC->>Repo: findPage(criteria, page, per_page)
  Repo->>GW: 検索条件を books の SELECT へ変換する
  GW->>DB: SELECT * FROM books WHERE 条件 ORDER BY updated_at DESC LIMIT 20 OFFSET n
  DB-->>GW: books レコード（最大20件）+ 総件数
  GW-->>Repo: BookRecord[]
  Repo-->>UC: Book[]（ドメインモデル）
  UC->>Domain: 書籍状態の表示区分を確定する
  alt 該当件数が 0 件
    UC-->>Pres: items=[], total=0
  else 該当件数が 1 件以上
    UC-->>Pres: items=[BookSummary], total=N
  end
  Pres-->>APIClient: HTTP 200 BookListResponse
  APIClient-->>State: 一覧・総件数を格納する
  State-->>View: 台帳テーブルとページャを更新する
  View-->>Staff: 書籍一覧・書籍状態バッジ・総件数を表示する
```

## バリエーション一覧

| バリエーション名 | 値 | 処理内容 | 適用 tier | 適用箇所 |
|----------------|---|---------|----------|---------|
| ジャンル | 文学、人文、社会科学、自然科学、技術、芸術、児童、その他 | 一覧の絞り込み条件（複数選択）と一覧列の表示 | tier-frontend-staff / tier-backend-api | 蔵書管理台帳画面の BookSearchFilter / GET /api/v1/books の genre |
| 資料種別 | 紙書籍、電子書籍 | 一覧の絞り込み条件（複数選択）と一覧列の表示 | tier-frontend-staff / tier-backend-api | 蔵書管理台帳画面の BookSearchFilter / GET /api/v1/books の material_type |

## 分岐条件一覧

| 条件名 | 判定ルール | 適用 tier | 適用箇所 | BDD Scenario |
|--------|----------|----------|---------|-------------|
| 該当 0 件の分岐 | 絞り込み結果の total が 0 のとき、テーブルではなく EmptyState を表示する | tier-frontend-staff | 蔵書管理台帳画面 | 絞り込み結果が0件のとき理由と次の行動を示す |
| ページ分割 | total が per_page(20) を超えるとき Pagination を表示する（無限スクロールは使わない） | tier-frontend-staff / tier-backend-api | 蔵書管理台帳画面 / GET /api/v1/books | 21件以上の蔵書をページ送りで確認する |

## 計算ルール一覧

| 計算名 | 入力情報 | 計算式/ロジック | 出力情報 | 適用 tier |
|--------|---------|---------------|---------|----------|
| ページオフセット算出 | page, per_page | offset = (page - 1) × per_page | SELECT の OFFSET 値 | tier-backend-api |
| 総ページ数算出 | total, per_page | total_pages = ceil(total ÷ per_page) | Pagination の頁数 | tier-frontend-staff |

## 状態遷移一覧

| 状態モデル | 遷移元 | 遷移先 | トリガー | 事前条件 | 事後処理 | 適用 tier |
|-----------|--------|--------|---------|---------|---------|----------|
| 書籍状態 | （遷移なし） | （遷移なし） | 蔵書一覧を照会する（参照のみ） | 司書としてログイン済み | なし（書籍状態は表示のみ） | tier-backend-api |

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 |
|-----------|--------|------|
| 業務 | 蔵書管理業務 | このUCが属する業務 |
| BUC | 蔵書を管理するフロー | このUCを含むBUC |
| アクター | 司書 | 操作するアクター（受益者） |
| 情報 | 書籍 | 参照する情報 |
| 状態 | 書籍状態 | 一覧に表示する状態（在庫あり／貸出中／予約待ち） |
| バリエーション | ジャンル、資料種別 | 絞り込み条件・表示項目 |
| 画面 | 蔵書管理台帳画面 | 操作する画面 |

## 受け入れ基準トレーサビリティ

| 受け入れ基準 ID | 役割 | 対応する BDD Scenario |
|---|---|---|
| SPEC-001-01#1 | 補助 | 登録済みの蔵書を一覧で確認する |
| SPEC-001-01#2 | 補助 | 登録済みの蔵書を一覧で確認する |
| SPEC-001-01#3 | 補助 | 登録済みの蔵書を一覧で確認する |

受け入れ基準 ID の定義は `_cross-cutting/traceability-matrix.md`「USDM 受け入れ基準 ↔ UC 対応表」を正本とする。

## E2E 完了条件（BDD）

### 正常系

```gherkin
Feature: 蔵書一覧を照会する

  Scenario: 登録済みの蔵書を一覧で確認する
    Given 司書「山田花子」が司書ポータルにログイン済み
    And 蔵書に「吾輩は猫である」（在庫あり）と「坊っちゃん」（貸出中）が登録されている
    When 司書が蔵書管理台帳画面（/staff/books）を開く
    Then 「吾輩は猫である」がタイトル・著者・ISBN・出版社・ジャンル・資料種別とともに表示され、書籍状態バッジが「在庫あり」になる
    And 「坊っちゃん」の書籍状態バッジが「貸出中」になる

  Scenario: ジャンルで蔵書を絞り込む
    Given 司書「山田花子」が蔵書管理台帳画面を開いている
    And 蔵書に文学ジャンルの書籍が2件、技術ジャンルの書籍が1件登録されている
    When 司書がジャンル「文学」を選択して絞り込む
    Then 文学ジャンルの2件だけが一覧に表示され、総件数に「2 件」と表示される

  Scenario: 21件以上の蔵書をページ送りで確認する
    Given 司書「山田花子」が蔵書管理台帳画面を開いている
    And 蔵書が25件登録されている
    When 司書がページャの「2」を押す
    Then 21件目から25件目の書籍が表示される
```

### 異常系

```gherkin
  Scenario: 絞り込み結果が0件のとき理由と次の行動を示す
    Given 司書「山田花子」が蔵書管理台帳画面を開いている
    And 児童ジャンルの書籍が1件も登録されていない
    When 司書がジャンル「児童」を選択して絞り込む
    Then 「条件に一致する蔵書がありません」と絞り込み条件の解除導線が表示される

  Scenario: 蔵書一覧の取得に失敗したとき再試行できる
    Given 司書「山田花子」が蔵書管理台帳画面を開いている
    And バックエンド API が 500 を返す状態である
    When 司書が一覧を再読み込みする
    Then 「蔵書一覧を取得できませんでした」というエラー表示と再試行ボタンが表示される
```

## ティア別仕様

- [司書ポータル](tier-frontend-staff.md)
- [バックエンド API](tier-backend-api.md)

### 統合 API Spec

- [OpenAPI Spec](../../../_cross-cutting/api/openapi.yaml)（全 UC 統合、Contract First 開発用）
