# 書籍を検索する - バックエンド API 仕様

## 変更概要

バックエンド API（tier-backend-api）の蔵書コンテキスト（BC-001）に、検索条件種別に応じた蔵書検索エンドポイントを追加する。書籍検索条件をドメイン層のストラテジー（BookSearchCriteria）として実装し、結果に在庫状況区分を付与して返す。Query 側のみで状態変更を伴わない。

## API 仕様

### 蔵書検索 API

- **メソッド**: GET
- **パス**: `/api/v1/books/search`
- **認証**: IdP 発行トークン（Bearer）。利用者ロール・司書ロールのいずれも利用できる（利用者向け検索と司書向けレファレンス検索で同一エンドポイントを共有する）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/search.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| search_type | string | No | 検索条件種別（キーワード/タイトル/著者/ISBN/ジャンル）。未指定時はプレゼンテーション層が既定「キーワード」を適用する |
| q | string | Yes | 検索語（1〜100 文字）。search_type が「ISBN」のときは 13 桁または 10 桁 |
| genre | string[] | No | ジャンルによる絞り込み（複数指定は OR） |
| material_type | string[] | No | 資料種別による絞り込み（複数指定は OR） |
| available_only | boolean | No | true のとき book_status が「在庫あり」の書籍のみ返す。既定 false |
| page | integer | No | 1 以上。既定 1 |
| per_page | integer | No | 1〜100。既定 20（UI は 20 固定） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | BookSearchResultItem[] | 検索結果（最大 per_page 件） |
| items[].book | BookSummary | 書誌情報（book_id / title / author / isbn / publisher / genre / material_type / book_status ほか） |
| items[].availability | string | 在庫状況区分（在庫あり/貸出中/予約待ち。書籍状態から導出する） |
| total | integer | 条件に一致する総件数 |
| page | integer | 現在ページ |
| per_page | integer | 1 ページあたり件数 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | search_type がバリエーション「検索条件種別」外、q が空または 100 文字超、ISBN 形式不正、page/per_page が範囲外 | `{"code":"INVALID_PARAMETER","message":"検索条件の指定が正しくありません"}` |
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 500 | データストア障害 | `{"code":"INTERNAL_ERROR","message":"検索できませんでした"}` |

## 非同期イベント（該当する場合）

なし（照会系 UC のためイベントは発行しない）。

## データモデル変更

### books（情報: 書籍 / エンティティ E-001 / 集約 AG-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（PK） | 変更なし（参照のみ） |
| title | VARCHAR | タイトル。search_type「タイトル」「キーワード」の検索対象 | 変更なし（参照のみ） |
| author | VARCHAR | 著者。search_type「著者」「キーワード」の検索対象 | 変更なし（参照のみ） |
| isbn | VARCHAR NULL | ISBN。search_type「ISBN」「キーワード」の検索対象 | 変更なし（参照のみ） |
| publisher | VARCHAR | 出版社。search_type「キーワード」の検索対象 | 変更なし（参照のみ） |
| genre | VARCHAR | ジャンル。search_type「ジャンル」と絞り込みの対象 | 変更なし（参照のみ） |
| material_type | VARCHAR | 資料種別。絞り込み対象 | 変更なし（参照のみ） |
| book_status | VARCHAR | 書籍状態。在庫状況区分の導出元、available_only の絞り込み対象 | 変更なし（参照のみ） |

必要なインデックス:

- `(title)` — タイトル検索・既定の並び順
- `(author)` — 著者検索
- `(isbn)` — ISBN 検索（完全一致）
- `(genre)` — ジャンル検索・絞り込み
- `(book_status)` — 在庫ありのみの絞り込み

## ビジネスルール

- 書籍検索条件: 検索条件種別が「キーワード」のときはタイトル・著者・ISBN・出版社を横断して部分一致検索する。「タイトル」「著者」は当該属性の部分一致、「ISBN」は完全一致、「ジャンル」は完全一致で検索する
- 一致した書籍には必ず在庫状況区分（書籍状態に基づく 在庫あり／貸出中／予約待ち）を付与して返す
- 検索条件種別の分岐はドメイン層のストラテジー（BookSearchCriteria）として実装し、条件分岐をプレゼンテーション層やゲートウェイ層へ散らさない（arch「バリエーションのストラテジー化」）
- 検索クエリはゲートウェイ層の adapter に集約する（arch「検索クエリの adapter 集約」）
- 参照のみで書籍状態を変更しない
- レスポンスタイム目標 5 秒以内（NFR B.2.1.1）。per_page の上限 100 と検索対象属性のインデックスで担保する
- 本 UC は利用者の個人情報を返さない（貸出者・予約者は含めない）。個人情報参照可否条件に抵触する項目をレスポンスへ含めない

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を検索する - バックエンド API

  Scenario: キーワードで横断検索する
    Given books に title「吾輩は猫である」・author「夏目漱石」（book_status=在庫あり）が登録されている
    When GET /api/v1/books/search?search_type=キーワード&q=漱石 を実行する
    Then HTTP 200 が返り、items が 1 件、items[0].availability が「在庫あり」になる

  Scenario: ISBN の完全一致で検索する
    Given books に isbn「9784101010014」の書籍が 1 件登録されている
    When GET /api/v1/books/search?search_type=ISBN&q=9784101010014 を実行する
    Then HTTP 200 が返り、items が 1 件になる

  Scenario: 在庫ありのみに絞り込む
    Given books に book_status「在庫あり」が 1 件、「貸出中」が 1 件登録されている
    When GET /api/v1/books/search?search_type=著者&q=夏目漱石&available_only=true を実行する
    Then HTTP 200 が返り、items が 1 件、すべて availability が「在庫あり」になる

  Scenario: 不正な検索条件種別を拒否する
    Given 利用者ロールのトークンを持っている
    When GET /api/v1/books/search?search_type=出版社&q=新潮社 を実行する
    Then HTTP 400 が返り、code が「INVALID_PARAMETER」になる
```
