# 利用者を削除する - Backend API仕様

## 変更概要

利用者コンテキスト（BC-002）モジュールに利用者削除 API `DELETE /api/v1/users/{userNumber}` を追加する。
削除可否は貸出コンテキスト（BC-003）/ 予約コンテキスト（BC-004）の公開インタフェースで有効件数を取得して domain で判定し（LR-003）、`user_events` INSERT（削除）と `users` DELETE、認証情報（E-903）の無効化を 1 トランザクションで実行する。
個人情報の更新のため監査ログ対象（LP-006）。確認画面の初期表示は「利用者を編集する」で定義した `GET /api/v1/users/{userNumber}` を拡張し、`activeLoanCount` / `activeReservationCount` を追加する。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 利用者取得（拡張）

- **メソッド**: GET
- **パス**: `/api/v1/users/{userNumber}`
- **認証**: Bearer。利用者区分=司書（館内経路）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users/{userNumber}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| userNumber | string (path) | Yes | 利用者番号 |
| include | string (query) | No | `activeCounts` を指定すると有効な貸出・予約件数を含める（削除確認画面で使用） |

#### レスポンス

`200 OK` — `UserResponse`（「利用者を登録する」のスキーマに以下を追加）

| フィールド | 型 | 説明 |
|-----------|---|------|
| version | integer | 楽観ロック用バージョン |
| activeLoanCount | integer | 貸出の状態が貸出中 / 延滞の件数（include=activeCounts のとき） |
| activeReservationCount | integer | 予約の状態が予約中 / 通知済みの件数（include=activeCounts のとき） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | トークン無し / 期限切れ | `{ status: 401, code: "UNAUTHENTICATED" }` |
| 403 | 利用者区分が司書でない | `{ status: 403, code: "FORBIDDEN" }` |
| 404 | userNumber が存在しない | `{ status: 404, code: "USER_NOT_FOUND" }` |

### 利用者削除

- **メソッド**: DELETE
- **パス**: `/api/v1/users/{userNumber}`
- **認証**: Bearer。API Gateway で利用者区分=司書の粗粒度 RBAC（館内経路のみ）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users/{userNumber}.delete` を参照

#### リクエスト

ヘッダ `Idempotency-Key`（必須）、`X-Trace-Id`（任意）。ボディなし。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| userNumber | string (path) | Yes | 利用者番号 |
| If-Match | string (header) | No | 取得時の version。指定時は楽観ロック条件に用いる |

#### レスポンス

`204 No Content`（ボディなし）

| フィールド | 型 | 説明 |
|-----------|---|------|
| （なし） | - | - |

#### エラーレスポンス

`application/problem+json`（RFC 9457）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | Idempotency-Key 欠落、If-Match が整数でない | `{ status: 400, code: "BAD_REQUEST" }` |
| 401 | トークン無し / 期限切れ | `{ status: 401, code: "UNAUTHENTICATED" }` |
| 403 | 利用者区分が司書でない | `{ status: 403, code: "FORBIDDEN" }` |
| 404 | userNumber が存在しない（削除済み含む） | `{ status: 404, code: "USER_NOT_FOUND" }` |
| 409 | 貸出中 / 延滞の貸出、または予約中 / 通知済みの予約がある | `{ status: 409, code: "USER_NOT_DELETABLE", reasons: ["ACTIVE_LOAN", "ACTIVE_RESERVATION"], activeLoanCount, activeReservationCount }` |
| 409 | 対象が認可コンテキストの本人 | `{ status: 409, code: "SELF_DELETE_NOT_ALLOWED" }` |
| 409 | If-Match の version が現在値と不一致 | `{ status: 409, code: "OPTIMISTIC_LOCK_CONFLICT" }` |

409 のレスポンス型は単一ではない。`code = USER_NOT_DELETABLE` のときだけ `reasons`（必須）を持つ `UserNotDeletableProblemDetails`、`SELF_DELETE_NOT_ALLOWED` / `OPTIMISTIC_LOCK_CONFLICT` は `reasons` を持たない `ProblemDetails` を返す（契約上は `oneOf: [ProblemDetails, UserNotDeletableProblemDetails]`。クライアントは `code` で判別する）。

## 非同期イベント（該当する場合）

該当なし（利用者削除は通知を発行しない）。

## データモデル変更

### users（E-003 利用者 スナップショット）

定義は「利用者を登録する」を参照。本 UC はスナップショット行を DELETE する。

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_number | VARCHAR(20) | 削除対象の PK | 削除（行） |
| version | INT | If-Match 指定時の楽観ロック条件 | 参照 |

### user_events（E-003 履歴側）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| event_type | VARCHAR(20) | 「DELETED」（登録 UC で定義済みの値） | 参照（値） |
| payload | JSON | 削除の場合は `{ "reason": "利用終了" }` のみ。氏名・連絡先は含めない（個人情報の残存を避ける） | 参照 |

`user_events` は削除後も保持する（イベント履歴）。`user_events.user_number` から `users` への FK は張らない。

### credentials（E-903 認証情報。派生エンティティ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_number | VARCHAR(20) | E-003 と 1:1 | 削除（行）。利用者削除時に同一トランザクションで削除し、IdP セッションを失効させる |

### loans（E-004 貸出。BC-003 所有。参照のみ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_number | VARCHAR(20) | 利用者番号 | 参照（COUNT 条件）。削除後も返却済み貸出は user_number を保持する（FK は張らない。貸出統計の元データ） |
| current_status | VARCHAR(16) | ON_LOAN / OVERDUE / RETURNED | 参照（COUNT 条件） |

### reservations（E-007 予約。BC-004 所有。参照のみ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_number | VARCHAR(20) | 利用者番号 | 参照（COUNT 条件） |
| current_status | VARCHAR(16) | RESERVED = 予約中 / NOTIFIED = 通知済み / CANCELLED = 取消 / CLOSED = 終了 | 参照（COUNT 条件） |

## ビジネスルール

- 利用者削除可否判定（_inference 7 Option A 仮採用）: `User.delete(activeLoanCount, activeReservationCount)` は両方が 0 のときのみ削除イベントを生成する。1 件以上あれば `UserNotDeletableException`（409 `USER_NOT_DELETABLE`、`reasons[]` に該当理由）。連鎖処理（予約取消・返却済み扱い）は行わない
- 有効件数の取得: 貸出 BC の公開 IF `countActiveLoans(userNumber)`（貸出中 / 延滞）と予約 BC の公開 IF `countActiveReservations(userNumber)`（予約中 / 通知済み）を usecase から呼ぶ（LR-003）。判定と削除の間の変化に備え、DELETE は同一トランザクション内で再確認する
- 自己削除禁止: 認可コンテキストの user_id と対象 userNumber が一致する場合は 409 `SELF_DELETE_NOT_ALLOWED`
- 永続化: `userRepository.delete(user)` は `user_events` INSERT（event_type=DELETED、payload に個人情報を含めない）、`users` DELETE、`credentials` DELETE を同一トランザクションで実行する（LR-008）。削除件数 0 は 409 `OPTIMISTIC_LOCK_CONFLICT`
- 監査ログ（LP-006 / SR-010）: GET は「データ参照」、DELETE は「データ更新」として user_id・対象（E-003, userNumber）・結果（成功 / 拒否）を記録する。氏名・連絡先の値は記録しない
- 冪等性: `Idempotency-Key` を受け付け、同一キーの再送は最初の応答（204）を返す（LR-002）
- 通知（E-008）の `recipient_email` は送信時点のコピーとして保持し、利用者削除で消去しない（通知記録の保全）。保持期間は運用ポリシーに従う
- 個人情報のログ出力禁止（CLR-004 相当）。SQL バインド値もログに出さない（LP-015）
- DB アクセスはパラメータ化クエリ必須（LR-013）

## ティア完了条件（BDD）

```gherkin
Feature: 利用者を削除する - Backend API

  Scenario: 有効な貸出・予約がない利用者を削除すると 204 が返る
    Given users に「U0001234 田中太郎」（version 1）が存在する
    And loans に「U0001234」の貸出中・延滞は 0 件、reservations に予約中・通知済みは 0 件である
    And 司書「佐藤花子」（S0000001）のアクセストークンを保持している
    When DELETE /api/v1/users/U0001234 を Idempotency-Key「idem-udel-001」で送信する
    Then HTTP 204 が返る
    And users に「U0001234」は存在せず、credentials の「U0001234」も存在しない
    And user_events に user_number「U0001234」、event_type「DELETED」の 1 行が追加され、payload に氏名・連絡先は含まれない
    And 監査ログに対象「E-003 / U0001234」、操作「データ更新」、結果「成功」が記録される

  Scenario: 貸出中の利用者は 409 と理由を返す
    Given users に「U0003456」が存在し、loans に current_status ON_LOAN が 2 件存在する
    When DELETE /api/v1/users/U0003456 を送信する
    Then HTTP 409 と problem+json（code: USER_NOT_DELETABLE, reasons: ["ACTIVE_LOAN"], activeLoanCount: 2）が返る
    And users に「U0003456」が残っている
    And 監査ログに結果「拒否」が記録される

  Scenario: 予約中と延滞の両方がある利用者は両方の理由を返す
    Given users に「U0004567」が存在し、loans に OVERDUE 1 件、reservations に RESERVED 1 件存在する
    When DELETE /api/v1/users/U0004567 を送信する
    Then HTTP 409 と problem+json（code: USER_NOT_DELETABLE, reasons: ["ACTIVE_LOAN", "ACTIVE_RESERVATION"]）が返る

  Scenario: 返却済みの貸出のみの利用者は削除でき貸出記録は残る
    Given users に「U0002345」が存在し、loans に current_status RETURNED が 3 件存在する
    When DELETE /api/v1/users/U0002345 を送信する
    Then HTTP 204 が返る
    And loans の 3 件は user_number「U0002345」のまま保持される

  Scenario: GET に include=activeCounts を指定すると件数を返す
    Given users に「U0003456」が存在し、loans に ON_LOAN 2 件、reservations に NOTIFIED 1 件存在する
    When GET /api/v1/users/U0003456?include=activeCounts を送信する
    Then HTTP 200 が返り、activeLoanCount が 2、activeReservationCount が 1 である
    And 監査ログに操作「データ参照」が記録される

  Scenario: 自分自身の削除は 409 を返す
    Given 司書「佐藤花子」（S0000001）のアクセストークンを保持している
    When DELETE /api/v1/users/S0000001 を送信する
    Then HTTP 409 と problem+json（code: SELF_DELETE_NOT_ALLOWED）が返る
```
