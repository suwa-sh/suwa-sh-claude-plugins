# 司書向けに蔵書を検索する

## 概要

司書が利用者からの問合せに対し、レファレンス検索画面から利用者向けと同一の検索条件（書籍検索条件）で蔵書と在庫状況を調べ、その場で案内する。窓口対応中の使用を想定し、検索結果は表形式で一度に多く見せる。

## データフロー

```mermaid
graph LR
  subgraph FE["tier-frontend-staff"]
    FE_View["ビュー層\nレファレンス検索画面(ReferenceSearchView)"]
    FE_State["状態管理層\nReferenceSearchState(検索条件/結果/ページ)"]
    FE_API["API クライアント層\nGET /api/v1/books/search"]
    FE_View --> FE_State --> FE_API
  end
  subgraph BE["tier-backend-api"]
    BE_Pres["プレゼンテーション層\nSearchBooksRequest(DTO)"]
    BE_UC["ユースケース層\nSearchBooksQuery"]
    BE_Domain["ドメイン層\nBook(書籍)\nBookSearchCriteria(検索条件種別のストラテジー)"]
    BE_Repo["リポジトリ層\nBookFinder.search()（読み取り専用）"]
    BE_GW["ゲートウェイ層\nBookRecord(books adapter・検索クエリを集約)"]
    BE_Pres --> BE_UC --> BE_Domain
    BE_UC --> BE_Repo --> BE_GW
  end
  subgraph DB["tier-datastore (RDB)"]
    DB_Books[("books\nbook_id, title, author, isbn,\npublisher, genre, material_type, book_status")]
  end
  FE_API -->|"GET /api/v1/books/search?search_type=タイトル&q=坊っちゃん&genre=&material_type=&available_only=&page=1&per_page=20"| BE_Pres
  BE_GW -->|"SELECT ... FROM books WHERE 検索条件種別に応じた述語 ORDER BY title LIMIT 20 OFFSET n"| DB_Books
  DB_Books --> BE_GW --> BE_Repo --> BE_Domain --> BE_UC --> BE_Pres -->|"HTTP 200 BookSearchResponse(items[BookSearchResultItem], total, page, per_page)"| FE_API --> FE_State --> FE_View
```

| レイヤー | データモデル | 変換内容 |
|---------|------------|---------|
| FE ビュー層 | 検索条件種別・検索語・ジャンル・資料種別・在庫ありのみ、結果テーブル | `BookSearchFilter` の選択値を検索クエリへ変換し、`Table` + `BookStatusBadge` で結果を描画する |
| FE 状態管理層 | ReferenceSearchState(query, results, total, page) | 窓口対応中に条件を切り替えても直前の結果を保持し、画面間で条件を共有する |
| FE API クライアント層 | GET /api/v1/books/search のクエリパラメータ | 認証トークン付与・trace_id 発行・タイムアウト/リトライ |
| BE プレゼンテーション層 | SearchBooksRequest(search_type, q, genre[], material_type[], available_only, page, per_page) | 形式・列挙値バリデーション + SearchBooksQuery 変換（利用者向け検索と共通） |
| BE ユースケース層 | SearchBooksQuery | 読み取り専用（Query 側） |
| BE ドメイン層 | BookSearchCriteria（検索条件種別のストラテジー） | 検索条件種別ごとの検索対象属性を決める |
| BE ゲートウェイ層 | BookRecord ⇔ books テーブル | 検索クエリを adapter に集約する |
| Response | BookSearchResponse(items[BookSearchResultItem(book, availability)], total, page, per_page) | 表の行と在庫状況バッジの表示に使う |

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

  Staff->>View: レファレンス検索画面(/staff/books/reference-search)で問合せ内容を条件に入力する
  View->>State: 検索条件・ページを更新する
  State->>APIClient: 検索を要求する
  APIClient->>Pres: GET /api/v1/books/search?search_type=...&q=...&page=1&per_page=20
  Pres->>Pres: 入力バリデーション（search_type はバリエーション「検索条件種別」の値のみ）
  Pres->>UC: SearchBooksQuery
  UC->>Domain: BookSearchCriteria.of(search_type, q, genre[], material_type[])
  alt 書籍検索条件: search_type が「キーワード」
    Domain->>Domain: タイトル・著者・ISBN・出版社を横断する部分一致条件を組む
  else search_type が「タイトル」「著者」「ISBN」「ジャンル」
    Domain->>Domain: 指定属性のみを対象とする条件を組む
  end
  UC->>Repo: search(criteria, page, per_page)
  Repo->>GW: 検索条件を books の SELECT へ変換する
  GW->>DB: SELECT * FROM books WHERE 条件 ORDER BY title LIMIT 20 OFFSET n
  DB-->>GW: books レコード + 総件数
  GW-->>Repo: BookRecord[]
  Repo-->>UC: Book[]
  UC->>Domain: 書籍状態から在庫状況区分を決める
  alt 該当件数が 0 件
    UC-->>Pres: items=[], total=0
  else 該当件数が 1 件以上
    UC-->>Pres: items=[BookSearchResultItem], total=N
  end
  Pres-->>APIClient: HTTP 200 BookSearchResponse
  APIClient-->>State: 結果と総件数を格納する
  State-->>View: 表とページャを更新する
  View-->>Staff: 書誌情報と在庫状況を表形式で表示し、利用者へ案内できる状態にする
```

## バリエーション一覧

| バリエーション名 | 値 | 処理内容 | 適用 tier | 適用箇所 |
|----------------|---|---------|----------|---------|
| 検索条件種別 | キーワード、タイトル、著者、ISBN、ジャンル | 検索対象属性のルート分岐。既定は「キーワード」 | tier-frontend-staff / tier-backend-api | レファレンス検索画面の BookSearchFilter / BookSearchCriteria のストラテジー |
| ジャンル | 文学、人文、社会科学、自然科学、技術、芸術、児童、その他 | 絞り込み条件（複数選択）と表の列 | tier-frontend-staff / tier-backend-api | レファレンス検索画面 / GET /api/v1/books/search の genre |
| 資料種別 | 紙書籍、電子書籍 | 絞り込み条件（複数選択）と表の列 | tier-frontend-staff / tier-backend-api | レファレンス検索画面 / GET /api/v1/books/search の material_type |

## 分岐条件一覧

| 条件名 | 判定ルール | 適用 tier | 適用箇所 | BDD Scenario |
|--------|----------|----------|---------|-------------|
| 書籍検索条件 | 検索条件種別（キーワード／タイトル／著者／ISBN／ジャンル）のいずれかで蔵書を検索し、一致した書籍に書籍状態に基づく在庫状況区分を併せて表示する | tier-frontend-staff / tier-backend-api | レファレンス検索画面 / BookSearchCriteria | 問合せの著者名で蔵書を調べる |
| 該当 0 件の分岐 | total が 0 のとき `EmptyState` に「条件に一致する蔵書がありません」と条件変更の導線を出す | tier-frontend-staff | レファレンス検索画面 | 該当0件のとき条件変更を案内する |
| 在庫ありのみ絞り込み | `available_only=true` のとき book_status が「在庫あり」の書籍だけを返す | tier-frontend-staff / tier-backend-api | レファレンス検索画面 / GET /api/v1/books/search | いま貸せる蔵書だけを案内する |
| ページ分割 | total が per_page(20) を超えるとき `Pagination` を表示する | tier-frontend-staff / tier-backend-api | レファレンス検索画面 | 21件以上の結果をページ送りする |

## 計算ルール一覧

| 計算名 | 入力情報 | 計算式/ロジック | 出力情報 | 適用 tier |
|--------|---------|---------------|---------|----------|
| 在庫状況区分の決定 | 書籍.書籍状態 | 在庫あり → 在庫あり、貸出中 → 貸出中、予約待ち → 予約待ち | 検索結果の在庫状況区分 | tier-backend-api |
| ページオフセット算出 | page, per_page | offset = (page - 1) × per_page | SELECT の OFFSET 値 | tier-backend-api |

## 状態遷移一覧

| 状態モデル | 遷移元 | 遷移先 | トリガー | 事前条件 | 事後処理 | 適用 tier |
|-----------|--------|--------|---------|---------|---------|----------|
| 書籍状態 | （遷移なし） | （遷移なし） | 司書向けに蔵書を検索する（参照のみ） | 司書としてログイン済み | なし（在庫状況区分として表示するだけ） | tier-backend-api |

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 |
|-----------|--------|------|
| 業務 | 蔵書利用業務 | このUCが属する業務 |
| BUC | 書籍を検索するフロー | このUCを含むBUC |
| アクター | 司書 | 操作するアクター（提供者） |
| 情報 | 書籍 | 参照する情報 |
| 状態 | 書籍状態 | 在庫状況区分として表示する |
| 条件 | 書籍検索条件 | 適用される条件 |
| バリエーション | 検索条件種別、ジャンル、資料種別 | 検索・絞り込み条件 |
| 画面 | レファレンス検索画面 | 操作する画面 |

## E2E 完了条件（BDD）

### 正常系

```gherkin
Feature: 司書向けに蔵書を検索する

  Scenario: 問合せの著者名で蔵書を調べる
    Given 司書「山田花子」が司書ポータルにログイン済み
    And 蔵書に著者「夏目漱石」の書籍が3件登録されている
    When 司書がレファレンス検索画面で検索条件種別「著者」に「夏目漱石」を入力して検索する
    Then 3件が表形式で表示され、各行に書籍状態バッジ（在庫あり／貸出中／予約待ち）が表示される

  Scenario: いま貸せる蔵書だけを案内する
    Given 蔵書に「吾輩は猫である」（在庫あり）と「坊っちゃん」（貸出中）が登録されている
    When 司書が検索条件種別「著者」に「夏目漱石」を入力し「在庫ありのみ」を選んで検索する
    Then 「吾輩は猫である」だけが表示され、利用者へすぐ貸せる書籍として案内できる

  Scenario: 21件以上の結果をページ送りする
    Given 検索条件「文学」に一致する書籍が25件ある
    When 司書が検索してページャの「2」を押す
    Then 21件目から25件目の書籍が表に表示される
```

### 異常系

```gherkin
  Scenario: 該当0件のとき条件変更を案内する
    Given 司書「山田花子」がレファレンス検索画面を開いている
    And 「存在しない書名」に一致する書籍が蔵書にない
    When 司書が検索条件種別「タイトル」に「存在しない書名」を入力して検索する
    Then 「条件に一致する蔵書がありません」と検索条件の変更を促す案内が表示される

  Scenario: 検索語が未入力のとき検索できない
    Given 司書「山田花子」がレファレンス検索画面を開いている
    When 司書が検索語を空欄のまま検索ボタンを押そうとする
    Then 検索ボタンが無効のままで、「検索語を入力してください」と表示される

  Scenario: 検索に失敗したとき再試行できる
    Given バックエンド API が 500 を返す状態である
    When 司書が検索条件種別「キーワード」に「漱石」を入力して検索する
    Then 「検索できませんでした」というエラー表示と再試行ボタンが表示される
```

## ティア別仕様

- [司書ポータル](tier-frontend-staff.md)
- [バックエンド API](tier-backend-api.md)

### 統合 API Spec

- [OpenAPI Spec](../../../_cross-cutting/api/openapi.yaml)（全 UC 統合、Contract First 開発用）
