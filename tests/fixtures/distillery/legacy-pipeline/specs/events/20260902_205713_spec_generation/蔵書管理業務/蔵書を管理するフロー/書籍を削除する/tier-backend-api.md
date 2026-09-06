# 書籍を削除する - バックエンド API 仕様

## 変更概要

バックエンド API（tier-backend-api）の蔵書コンテキスト（BC-001）に、除籍可否判定エンドポイントと書籍削除エンドポイントを追加する。蔵書削除可否条件をドメイン層で強制し、予約の有無は予約コンテキスト（BC-004）の公開インターフェース経由で取得する（モジュール間の直接データアクセス禁止）。

## API 仕様

### 除籍可否判定 API

- **メソッド**: GET
- **パス**: `/api/v1/books/{book_id}/withdrawal-eligibility`
- **認証**: IdP 発行トークン（Bearer）。司書ロールのみ
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{book_id}/withdrawal-eligibility.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id（パス） | string | Yes | 判定対象の書籍ID |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| book | BookSummary | 対象書籍の書誌情報と書籍状態 |
| deletable | boolean | 蔵書削除可否条件を満たすか |
| book_status | string | 書籍状態（在庫あり/貸出中/予約待ち） |
| active_reservation_count | integer | 予約状態が「予約中」「取置き中」の予約件数 |
| reasons | string[] | 削除不可の未充足理由（deletable=false のとき 1 件以上） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作の権限がありません"}` |
| 404 | book_id に一致する書籍が存在しない | `{"code":"BOOK_NOT_FOUND","message":"対象の書籍が見つかりません"}` |
| 500 | データストア障害 | `{"code":"INTERNAL_ERROR","message":"除籍可否を判定できませんでした"}` |

### 書籍削除 API

- **メソッド**: DELETE
- **パス**: `/api/v1/books/{book_id}`
- **認証**: IdP 発行トークン（Bearer）。司書ロールのみ
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{book_id}.delete` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id（パス） | string | Yes | 除籍対象の書籍ID |
| X-Idempotency-Key（ヘッダ） | string(uuid) | Yes | 二重送信防止の冪等キー |

#### レスポンス

成功時は HTTP 204 No Content（本文なし）。同一 `X-Idempotency-Key` の再送も 204 を返す。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作の権限がありません"}` |
| 404 | book_id に一致する書籍が存在しない | `{"code":"BOOK_NOT_FOUND","message":"対象の書籍が見つかりません"}` |
| 422 | 蔵書削除可否条件の違反（書籍状態が「貸出中」「予約待ち」、または有効予約が 1 件以上） | `{"code":"BOOK_NOT_WITHDRAWABLE","message":"進行中の取引があるため除籍できません","reasons":["貸出中のため除籍できません"]}` |
| 500 | データストア障害 | `{"code":"INTERNAL_ERROR","message":"書籍を除籍できませんでした"}` |

## 非同期イベント（該当する場合）

なし（除籍は同期処理で完結し、通知も外部連携も伴わない）。

## データモデル変更

### books（情報: 書籍 / エンティティ E-001 / 集約 AG-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID（PK） | 削除（WHERE 条件） |
| book_status | VARCHAR | 書籍状態。DELETE の追加条件（`= '在庫あり'`）に使う | 削除（WHERE 条件） |
| （その他の書誌カラム） | - | 行ごと削除される | 削除 |

### reservations（情報: 予約 / エンティティ E-005 / 集約 AG-004）※参照のみ

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 対象書籍ID | 変更なし（参照のみ） |
| reservation_status | VARCHAR | 予約状態。「予約中」「取置き中」の件数を数える | 変更なし（参照のみ） |

必要なインデックス:

- `PRIMARY KEY (book_id)`（books） — 1 件削除の主キーアクセス
- `(book_id, reservation_status)`（reservations） — 対象書籍の有効予約件数の集計

## ビジネスルール

- 蔵書削除可否条件: 書籍状態が「在庫あり」であり、かつ予約状態が「予約中」「取置き中」の予約が存在しない場合に限り削除する。判定はドメイン層（`Book.canWithdraw`）で強制し、画面の判定結果に依存しない
- 削除実行時に可否を再判定する。判定 API の応答から実行までの間に状態が変わった場合は 422 で拒否する
- DELETE は `WHERE book_id = ? AND book_status = '在庫あり'` の条件つきで実行し、更新件数 0 のときは 422 とする（判定と削除の間の競合を防ぐ）
- 予約件数の取得は予約コンテキスト（BC-004）の公開インターフェース（ReservationQueryPort）経由で行い、reservations テーブルへ蔵書コンテキストから直接アクセスしない（arch「モジュール間の直接データアクセス禁止」）
- 冪等キー検証: 同一 `X-Idempotency-Key` の再送は削除処理を再実行せず 204 を返す
- 除籍は books の物理削除で行うが、貸出履歴・貸出統計は書籍レコードに依存しない。loans は除籍後も参照できるよう書籍ID に加えてタイトル・著者・ISBN・ジャンルのスナップショットを保持し、貸出統計集計条件（返却済みの貸出も集計対象）は loans 側のスナップショットだけで成立させる（books への外部キー制約は張らない）
- 上記スナップショットの書き込み責務は貸出登録側にある。UC「蔵書利用業務/書籍を貸し出すフロー/貸出を登録する」の loans INSERT は、`loan_id` / `book_id` / `user_no` / `loan_date` / `loan_period_type` / `due_date` / `loan_status` に加えて `book_title` / `book_author` / `book_isbn` / `book_genre` の 4 列を貸出時点の書誌値で必ず書き込むこと（本 UC の除籍が成立する前提条件）。これらの列が欠けると、除籍後に貸出履歴・貸出統計が書誌を復元できない
- 監査ログ: ユースケース層で「誰が」「どの書籍を」除籍したかを構造化ログに出力する

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を削除する - バックエンド API

  Scenario: 在庫ありで予約のない書籍を削除する
    Given books に book_id「BK-001」（book_status=在庫あり）が存在し、reservations に予約状態「予約中」「取置き中」の行がない
    When 司書ロールのトークンで DELETE /api/v1/books/BK-001 を実行する
    Then HTTP 204 が返り、books から BK-001 が削除される

  Scenario: 除籍可否判定で不可の理由を返す
    Given books の book_id「BK-002」の book_status が「予約待ち」で、reservations に予約状態「取置き中」が 1 件ある
    When 司書ロールのトークンで GET /api/v1/books/BK-002/withdrawal-eligibility を実行する
    Then HTTP 200 が返り、deletable が false、active_reservation_count が 1、reasons が 2 件になる

  Scenario: 貸出中の書籍の削除を拒否する
    Given books の book_id「BK-003」の book_status が「貸出中」である
    When 司書ロールのトークンで DELETE /api/v1/books/BK-003 を実行する
    Then HTTP 422 が返り、code が「BOOK_NOT_WITHDRAWABLE」になり、books から BK-003 が削除されない

  Scenario: 存在しない書籍の削除を拒否する
    Given books に book_id「BK-999」が存在しない
    When 司書ロールのトークンで DELETE /api/v1/books/BK-999 を実行する
    Then HTTP 404 が返り、code が「BOOK_NOT_FOUND」になる
```
