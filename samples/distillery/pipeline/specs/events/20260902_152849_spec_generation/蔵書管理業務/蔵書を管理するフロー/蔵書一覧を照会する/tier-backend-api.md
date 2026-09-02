# 蔵書一覧を照会する - バックエンド API 仕様

## 変更概要

バックエンド API（tier-backend-api）の蔵書コンテキスト（BC-001）に、蔵書一覧をページングして返す照会エンドポイントを追加する。Query 側のみで状態変更を伴わない。

## API 仕様

### 蔵書一覧照会 API

- **メソッド**: GET
- **パス**: `/api/v1/books`
- **認証**: IdP 発行トークン（Bearer）。API Gateway で粗粒度 RBAC により「司書」ロールのみ通過させる
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| keyword | string | No | タイトル・著者・ISBN・出版社の部分一致キーワード（100 文字以内） |
| genre | string[] | No | ジャンル（文学/人文/社会科学/自然科学/技術/芸術/児童/その他）。複数指定は OR |
| material_type | string[] | No | 資料種別（紙書籍/電子書籍）。複数指定は OR |
| book_status | string[] | No | 書籍状態（在庫あり/貸出中/予約待ち）。複数指定は OR |
| page | integer | No | 1 以上。既定 1 |
| per_page | integer | No | 1〜100。既定 20（UI は 20 固定） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | BookSummary[] | 書籍一覧（最大 per_page 件） |
| items[].book_id | string | 書籍ID |
| items[].title | string | タイトル |
| items[].author | string | 著者 |
| items[].isbn | string \| null | ISBN（未設定あり） |
| items[].publisher | string | 出版社 |
| items[].genre | string | ジャンル |
| items[].material_type | string | 資料種別 |
| items[].book_status | string | 書籍状態（在庫あり/貸出中/予約待ち） |
| items[].registered_at | string(date-time) | 登録日時 |
| items[].updated_at | string(date-time) | 更新日時 |
| total | integer | 条件に一致する総件数 |
| page | integer | 現在ページ |
| per_page | integer | 1 ページあたり件数 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | page < 1、per_page が範囲外、genre / material_type / book_status がバリエーション・状態モデル外の値 | `{"code":"INVALID_PARAMETER","message":"検索条件の指定が正しくありません"}` |
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作の権限がありません"}` |
| 500 | データストア障害 | `{"code":"INTERNAL_ERROR","message":"蔵書一覧を取得できませんでした"}` |

## 非同期イベント（該当する場合）

なし（照会系 UC のためイベントは発行しない）。

## データモデル変更

### books（情報: 書籍 / エンティティ E-001 / 集約 AG-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（PK） | 変更なし（参照のみ） |
| title | VARCHAR | タイトル | 変更なし（参照のみ） |
| author | VARCHAR | 著者 | 変更なし（参照のみ） |
| isbn | VARCHAR NULL | ISBN | 変更なし（参照のみ） |
| publisher | VARCHAR | 出版社 | 変更なし（参照のみ） |
| genre | VARCHAR | ジャンル | 変更なし（参照のみ） |
| material_type | VARCHAR | 資料種別 | 変更なし（参照のみ） |
| book_status | VARCHAR | 書籍状態 | 変更なし（参照のみ） |
| registered_at | TIMESTAMP | 登録日時 | 変更なし（参照のみ） |
| updated_at | TIMESTAMP | 更新日時 | 変更なし（参照のみ。既定の並び順キー） |

必要なインデックス:

- `(genre)` — ジャンル絞り込みの頻出アクセスパターン
- `(book_status)` — 書籍状態絞り込みと在庫状況の把握
- `(updated_at DESC)` — 既定の並び順（最新更新順）
- `(title)` `(author)` `(isbn)` — keyword 検索（title / author / isbn / publisher の部分一致）の前方一致部分を支える（「書籍を検索する」UC と同じ構成）。publisher は絞り込み後の filter で評価する

## ビジネスルール

- 参照のみで書籍状態を変更しない（状態遷移は「書籍を登録する」「貸出を登録する」「返却後の書籍状態を更新する」等の他 UC が担う）
- ジャンル・資料種別・書籍状態の受理値は RDRA バリエーション（ジャンル・資料種別）と状態モデル（書籍状態）の値に限定する（ドメイン層でストラテジー化された列挙を使う）
- 資料種別が「電子書籍」の書籍は初期リリースでは登録されない前提だが、一覧は資料種別で除外せずそのまま表示する（資料種別利用可否条件は登録・編集時の制約）
- 検索クエリはゲートウェイ層の adapter に集約し、ユースケース層・ドメイン層へ SQL を漏らさない
- レスポンスタイム目標 5 秒以内（NFR B.2.1.1）。per_page の上限 100 とインデックスで担保する

## ティア完了条件（BDD）

```gherkin
Feature: 蔵書一覧を照会する - バックエンド API

  Scenario: 既定条件で蔵書一覧を取得する
    Given books に「吾輩は猫である」（book_status=在庫あり）と「坊っちゃん」（book_status=貸出中）が登録されている
    When 司書ロールのトークンで GET /api/v1/books?page=1&per_page=20 を実行する
    Then HTTP 200 が返り、items に 2 件、total が 2 になる

  Scenario: ジャンルで絞り込む
    Given books に genre=文学 が 2 件、genre=技術 が 1 件登録されている
    When 司書ロールのトークンで GET /api/v1/books?genre=文学 を実行する
    Then HTTP 200 が返り、items が 2 件、すべて genre が「文学」になる

  Scenario: 不正なページ番号を拒否する
    Given 司書ロールのトークンを持っている
    When GET /api/v1/books?page=0 を実行する
    Then HTTP 400 が返り、code が「INVALID_PARAMETER」になる

  Scenario: 利用者ロールからの照会を拒否する
    Given 利用者ロールのトークンを持っている
    When GET /api/v1/books を実行する
    Then HTTP 403 が返り、code が「FORBIDDEN」になる
```
