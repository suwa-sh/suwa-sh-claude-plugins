# 司書向けに蔵書を検索する - バックエンド API 仕様

## 変更概要

司書のレファレンス検索は、利用者向けの蔵書検索と同一の検索条件（書籍検索条件）で同一の結果を返す。したがってバックエンド API（tier-backend-api）は蔵書コンテキスト（BC-001）の既存エンドポイント `GET /api/v1/books/search` を司書ロールでも利用できるようにするだけで、新規エンドポイントは追加しない。

## API 仕様

### 蔵書検索 API（利用者向け検索と共有）

- **メソッド**: GET
- **パス**: `/api/v1/books/search`
- **認証**: IdP 発行トークン（Bearer）。司書ロール・利用者ロールのいずれも利用できる。司書ポータルからのアクセスは館内ネットワークに限定される（API Gateway の IP 制限。NFR E.5.3.1）
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
| items[].book | BookSummary | 書誌情報 |
| items[].availability | string | 在庫状況区分（在庫あり/貸出中/予約待ち） |
| total | integer | 条件に一致する総件数 |
| page | integer | 現在ページ |
| per_page | integer | 1 ページあたり件数 |

司書ロール向けにレスポンス項目を追加・変更しない。司書と利用者で同一の検索結果を返し、案内内容の食い違いを防ぐ。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | search_type がバリエーション「検索条件種別」外、q が空または 100 文字超、ISBN 形式不正、page/per_page が範囲外 | `{"code":"INVALID_PARAMETER","message":"検索条件の指定が正しくありません"}` |
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 館内ネットワーク以外からの司書ポータル経由アクセス | `{"code":"FORBIDDEN","message":"この操作の権限がありません"}` |
| 500 | データストア障害 | `{"code":"INTERNAL_ERROR","message":"検索できませんでした"}` |

## 非同期イベント（該当する場合）

なし（照会系 UC のためイベントは発行しない）。

## データモデル変更

### books（情報: 書籍 / エンティティ E-001 / 集約 AG-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（PK） | 変更なし（参照のみ） |
| title / author / isbn / publisher | VARCHAR | 検索条件種別に応じた検索対象 | 変更なし（参照のみ） |
| genre | VARCHAR | ジャンル検索・絞り込みの対象 | 変更なし（参照のみ） |
| material_type | VARCHAR | 絞り込み対象 | 変更なし（参照のみ） |
| book_status | VARCHAR | 在庫状況区分の導出元、available_only の絞り込み対象 | 変更なし（参照のみ） |

必要なインデックス: 「書籍を検索する」UC と同一（`(title)` / `(author)` / `(isbn)` / `(genre)` / `(book_status)`）。本 UC で追加のインデックスは不要。

## ビジネスルール

- 司書向けレファレンス検索は利用者向け検索と同一の書籍検索条件・同一の結果を返す（案内内容の一貫性のため、ロールによる結果の出し分けを行わない）
- 検索条件種別の分岐はドメイン層のストラテジー（BookSearchCriteria）として実装し、利用者向け検索と実装を共有する
- 参照のみで書籍状態を変更しない
- 利用者の個人情報（貸出者・予約者）はレスポンスへ含めない（個人情報参照可否条件、NFR E.1.2.1）
- レスポンスタイム目標 5 秒以内（NFR B.2.1.1）

## ティア完了条件（BDD）

```gherkin
Feature: 司書向けに蔵書を検索する - バックエンド API

  Scenario: 司書ロールで著者検索を実行する
    Given books に author「夏目漱石」の書籍が 3 件登録されている
    When 司書ロールのトークンで GET /api/v1/books/search?search_type=著者&q=夏目漱石 を実行する
    Then HTTP 200 が返り、items が 3 件、各要素に availability が含まれる

  Scenario: 司書と利用者で同一の結果を返す
    Given books に author「夏目漱石」の書籍が 3 件登録されている
    When 司書ロールと利用者ロールのそれぞれで GET /api/v1/books/search?search_type=著者&q=夏目漱石 を実行する
    Then 両者の items と total が一致する

  Scenario: 在庫ありのみで貸出可能な蔵書に絞る
    Given books に book_status「在庫あり」が 1 件、「貸出中」が 2 件登録されている
    When 司書ロールのトークンで GET /api/v1/books/search?search_type=著者&q=夏目漱石&available_only=true を実行する
    Then HTTP 200 が返り、items が 1 件、availability が「在庫あり」になる

  Scenario: 不正な検索条件種別を拒否する
    Given 司書ロールのトークンを持っている
    When GET /api/v1/books/search?search_type=出版社&q=新潮社 を実行する
    Then HTTP 400 が返り、code が「INVALID_PARAMETER」になる
```
