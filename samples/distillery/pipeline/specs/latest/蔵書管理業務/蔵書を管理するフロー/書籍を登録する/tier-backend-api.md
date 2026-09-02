# 書籍を登録する - バックエンド API 仕様

## 変更概要

バックエンド API（tier-backend-api）の蔵書コンテキスト（BC-001）に書籍登録エンドポイントを追加する。ドメイン層で資料種別利用可否条件を強制し、書籍状態を「在庫あり」で初期化する。ユースケース層でトランザクション境界と冪等キー検証を行う。

## API 仕様

### 書籍登録 API

- **メソッド**: POST
- **パス**: `/api/v1/books`
- **認証**: IdP 発行トークン（Bearer）。API Gateway で「司書」ロールのみ通過させる
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| X-Idempotency-Key（ヘッダ） | string(uuid) | Yes | 二重送信防止の冪等キー（arch SR-002） |
| title | string | Yes | タイトル（255 文字以内） |
| author | string | Yes | 著者（255 文字以内） |
| isbn | string | No | ISBN（13 桁または 10 桁。移行時のクレンジング対象 NFR D.4.1.3） |
| publisher | string | Yes | 出版社（255 文字以内） |
| genre | string | Yes | ジャンル（文学/人文/社会科学/自然科学/技術/芸術/児童/その他） |
| material_type | string | Yes | 資料種別（紙書籍/電子書籍。登録可能なのは「紙書籍」のみ） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| book_id | string | 採番された書籍ID |
| title | string | タイトル |
| author | string | 著者 |
| isbn | string \| null | ISBN |
| publisher | string | 出版社 |
| genre | string | ジャンル |
| material_type | string | 資料種別 |
| book_status | string | 書籍状態（登録直後は常に「在庫あり」） |
| registered_at | string(date-time) | 登録日時 |
| updated_at | string(date-time) | 更新日時 |
| version | integer | 楽観ロック用の更新世代番号（登録直後は 1） |

成功時は HTTP 201 を返す。同一 `X-Idempotency-Key` の再送では新規登録せず、初回の登録結果を HTTP 200 で返す。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | 必須項目の欠落、文字数超過、ISBN 形式不正、genre / material_type がバリエーション外 | `{"code":"INVALID_PARAMETER","message":"入力内容を確認してください","details":[{"field":"title","message":"タイトルを入力してください"}]}` |
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作の権限がありません"}` |
| 422 | 資料種別利用可否条件の違反（material_type が「電子書籍」） | `{"code":"MATERIAL_TYPE_NOT_SUPPORTED","message":"電子書籍は現在未対応です。紙書籍のみ登録できます"}` |
| 500 | データストア障害 | `{"code":"INTERNAL_ERROR","message":"書籍を登録できませんでした"}` |

## 非同期イベント（該当する場合）

なし（蔵書登録は同期処理で完結し、外部システム連携も通知も伴わない）。

## データモデル変更

### books（情報: 書籍 / エンティティ E-001 / 集約 AG-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（PK）。登録時に採番する | 追加（INSERT 対象） |
| title | VARCHAR(255) NOT NULL | タイトル | 追加（INSERT 対象） |
| author | VARCHAR(255) NOT NULL | 著者 | 追加（INSERT 対象） |
| isbn | VARCHAR(20) NULL | ISBN | 追加（INSERT 対象） |
| publisher | VARCHAR(255) NOT NULL | 出版社 | 追加（INSERT 対象） |
| genre | VARCHAR NOT NULL | ジャンル | 追加（INSERT 対象） |
| material_type | VARCHAR NOT NULL | 資料種別（登録時は「紙書籍」のみ） | 追加（INSERT 対象） |
| book_status | VARCHAR NOT NULL | 書籍状態。登録時は「在庫あり」固定 | 追加（INSERT 対象） |
| registered_at | TIMESTAMP NOT NULL | 登録日時 | 追加（INSERT 対象） |
| updated_at | TIMESTAMP NOT NULL | 更新日時 | 追加（INSERT 対象） |
| version | INTEGER NOT NULL | 楽観ロック用の更新世代番号（初期値 1。arch リポジトリ層ルール「楽観ロックによる競合制御」） | 追加（INSERT 対象） |

必要なインデックス:

- `(isbn)` — ISBN 検索のため（同一 ISBN の複数所蔵を許容するため一意制約は付けない）

## ビジネスルール

- 資料種別利用可否条件: `material_type` が「紙書籍」のときのみ登録する。「電子書籍」は 422 で拒否し、レコードを作成しない。判定はドメイン層（`Book.register`）で強制し、プレゼンテーション層の検証だけに依存しない
- 書籍状態は登録時に必ず「在庫あり」で初期化する。リクエストから book_status を受け取らない
- 書籍ID は蔵書 1 冊を一意に識別する値としてドメイン層で採番する（クライアント指定を受け付けない）
- 同一 ISBN の複数所蔵（同じ書籍を複数冊持つ）を許容する。ISBN の重複は登録エラーにしない
- 冪等キー検証: 同一 `X-Idempotency-Key` の再送は登録処理を再実行せず、初回結果を返す（ユースケース層）
- 監査ログ: ユースケース層で「誰が」「どの書籍を」登録したかを構造化ログに出力する。ドメイン層ではログを出力しない
- ISBN は NULL を許容する（RDRA 情報「書籍」の属性上必須ではなく、arch E-001 でも nullable: true）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を登録する - バックエンド API

  Scenario: 紙書籍を登録して在庫ありで作成する
    Given 司書ロールのトークンを持っている
    When POST /api/v1/books に {"title":"吾輩は猫である","author":"夏目漱石","isbn":"9784101010014","publisher":"新潮社","genre":"文学","material_type":"紙書籍"} を送る
    Then HTTP 201 が返り、book_status が「在庫あり」の BookResponse が返る

  Scenario: 電子書籍の登録を拒否する
    Given 司書ロールのトークンを持っている
    When POST /api/v1/books に material_type「電子書籍」を含むリクエストを送る
    Then HTTP 422 が返り、code が「MATERIAL_TYPE_NOT_SUPPORTED」になり、books に行が追加されない

  Scenario: 必須項目の欠落を拒否する
    Given 司書ロールのトークンを持っている
    When POST /api/v1/books に title を含めずにリクエストを送る
    Then HTTP 400 が返り、details に field「title」のエラーが含まれる

  Scenario: 同一の冪等キーによる再送で二重登録しない
    Given X-Idempotency-Key「11111111-1111-1111-1111-111111111111」で「坊っちゃん」の登録が成功している
    When 同じ冪等キーと同じ本文で再度 POST /api/v1/books を送る
    Then HTTP 200 が返り、初回と同じ book_id が返り、books の件数が増えない
```
