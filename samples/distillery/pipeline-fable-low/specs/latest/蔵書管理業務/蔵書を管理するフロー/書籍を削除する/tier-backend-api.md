# 書籍を削除する - Backend API仕様

## 変更概要

蔵書コンテキスト（BC-001）モジュールに書籍削除 API `DELETE /api/v1/books/{bookId}` を追加する。
書籍集約（AG-001）の不変条件「貸出中・予約待ちの書籍は削除できない」を domain で検証し、`book_events` INSERT（削除）と `books` DELETE を 1 トランザクションで実行する。
削除は状態遷移を伴う UC のため監査ログ対象（LP-006）。確認画面の初期表示は「書籍を編集する」で定義した `GET /api/v1/books/{bookId}` を利用する。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 書籍削除

- **メソッド**: DELETE
- **パス**: `/api/v1/books/{bookId}`
- **認証**: Bearer。API Gateway で利用者区分=司書の粗粒度 RBAC（館内経路のみ）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/books/{bookId}.delete` を参照

#### リクエスト

ヘッダ `Idempotency-Key`（必須）、`X-Trace-Id`（任意）。ボディなし。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| bookId | string (path) | Yes | 書籍 ID |
| If-Match | string (header) | No | 取得時の version。指定時は楽観ロック条件に用いる |

#### レスポンス

`204 No Content`（ボディなし）

| フィールド | 型 | 説明 |
|-----------|---|------|
| （なし） | - | - |

#### エラーレスポンス

`application/problem+json`（RFC 9457）。

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | Idempotency-Key 欠落、If-Match が整数でない | `{ status: 400, code: "BAD_REQUEST" }` |
| 401 | トークン無し / 期限切れ | `{ status: 401, code: "UNAUTHENTICATED" }` |
| 403 | 利用者区分が司書でない | `{ status: 403, code: "FORBIDDEN" }` |
| 404 | bookId が存在しない（削除済み含む） | `{ status: 404, code: "BOOK_NOT_FOUND" }` |
| 409 | 書籍の状態が貸出中 / 予約待ち | `{ status: 409, code: "BOOK_NOT_DELETABLE", detail: "貸出中" または "予約待ち" }` |
| 409 | If-Match の version が現在値と不一致 | `{ status: 409, code: "OPTIMISTIC_LOCK_CONFLICT" }` |

## 非同期イベント（該当する場合）

該当なし（書籍削除は通知を発行しない）。

## データモデル変更

### books（E-001 書籍 スナップショット）

定義は「書籍を登録する」を参照。本 UC はスナップショット行を DELETE する。

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR(32) | 削除対象の PK | 削除（行） |
| current_status | VARCHAR(16) | AVAILABLE のときのみ削除可 | 参照 |
| version | INT | If-Match 指定時の楽観ロック条件 | 参照 |

### book_events（E-001 履歴側）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| event_type | VARCHAR(20) | 「DELETED」を追加 | 追加（値） |
| payload | JSON | 削除前の全属性 + 遷移前状態 AVAILABLE（履歴として保持） | 参照 |

`book_events` は書籍削除後も保持する（イベントは削除しない。E-001 event_snapshot）。`book_events.book_id` から `books` への FK は張らない（履歴が孤児化しないようにする）。

### loans / reservations（他 BC 所有。参照のみ）

削除可否は `books.current_status` で判定し、貸出 / 予約テーブルを直接参照しない（LR-003。状態は貸出・返却・予約 UC が同期的に整合させる: LP-005）。

## ビジネスルール

- 削除可否判定: `Book.delete()` は `current_status` が「在庫あり（AVAILABLE）」のときのみ削除イベントを生成する。「貸出中」「予約待ち」はドメイン例外 `BookNotDeletableException`（409 `BOOK_NOT_DELETABLE`、detail に現在の状態文言）を返す（状態.tsv「在庫あり → 書籍を削除する」/ AG-001 invariants / LR-005）
- 永続化: `bookRepository.delete(book)` は `book_events` INSERT（event_type=DELETED、payload に削除前属性）と `books` DELETE を同一トランザクションで実行する。DELETE の WHERE には `current_status = 'AVAILABLE'` を含め、判定と削除の間の状態変化を防ぐ（削除件数 0 は再取得して 409 `BOOK_NOT_DELETABLE` または `OPTIMISTIC_LOCK_CONFLICT` に変換）
- 監査ログ: user_id・操作種別（データ更新）・対象（E-001, bookId）・遷移前後の状態（在庫あり → 削除）・認可判定結果を記録する。拒否（409）も記録する（LP-006）。書籍属性の値は記録しない
- 冪等性: `Idempotency-Key` を受け付け、同一キーの再送は最初の応答（204）を返す（LR-002）。削除済み書籍に別キーで再送した場合は 404
- キャッシュ: 削除後に `cache:books:*` と `cache:books:detail:{bookId}` を無効化する（LP-017）
- 貸出統計（E-009）に残る book_id は削除しない（派生データ。FK ではない）。ランキング表示側で書籍不在を扱う
- DB アクセスはパラメータ化クエリ必須（LR-013）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を削除する - Backend API

  Scenario: 在庫ありの書籍を削除すると 204 が返りスナップショットが消える
    Given books に「B-0001」（current_status AVAILABLE、version 1）が存在する
    And 司書「佐藤花子」のアクセストークンを保持している
    When DELETE /api/v1/books/B-0001 を Idempotency-Key「idem-del-001」で送信する
    Then HTTP 204 が返る
    And books に「B-0001」は存在しない
    And book_events に book_id「B-0001」、event_type「DELETED」の 1 行が追加される
    And 監査ログに対象「E-001 / B-0001」、遷移「AVAILABLE → 削除」、結果「成功」が記録される

  Scenario: 貸出中の書籍は 409 を返す
    Given books に「B-0002」（current_status ON_LOAN）が存在する
    When DELETE /api/v1/books/B-0002 を送信する
    Then HTTP 409 と problem+json（code: BOOK_NOT_DELETABLE, detail: "貸出中"）が返る
    And books に「B-0002」が残っている
    And 監査ログに結果「拒否」が記録される

  Scenario: 予約待ちの書籍は 409 を返す
    Given books に「B-0004」（current_status RESERVED）が存在する
    When DELETE /api/v1/books/B-0004 を送信する
    Then HTTP 409 と problem+json（code: BOOK_NOT_DELETABLE, detail: "予約待ち"）が返る

  Scenario: 同一冪等キーの再送は 204 を返し二重処理しない
    Given DELETE /api/v1/books/B-0001 を Idempotency-Key「idem-del-002」で送信し HTTP 204 を受け取っている
    When 同一リクエストを Idempotency-Key「idem-del-002」で再送する
    Then HTTP 204 が返る
    And book_events の event_type「DELETED」は「B-0001」について 1 行のみである

  Scenario: 存在しない書籍の削除は 404 を返す
    Given 司書「佐藤花子」のアクセストークンを保持している
    When DELETE /api/v1/books/B-9999 を送信する
    Then HTTP 404 と problem+json（code: BOOK_NOT_FOUND）が返る
```
