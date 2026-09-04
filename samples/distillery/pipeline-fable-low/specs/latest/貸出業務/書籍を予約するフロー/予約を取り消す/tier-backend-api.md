# 予約を取り消す - Backend API仕様

## 変更概要

予約コンテキスト（BC-004）に予約詳細参照 API（本人限定）と予約取消 API を追加する。取消は単一トランザクションで予約の取消遷移・後続順位の繰り上げ・（条件付き）書籍の在庫あり復帰・（条件付き）次順位への返却通知作成を行い、コミット後に返却通知の MQ 発行を行う。本人限定判定はユースケース層で行い、不一致は 403 と監査ログにする（SP-016 / LP-007）。

## API 仕様

### 予約詳細参照（本人限定）

- **メソッド**: GET
- **パス**: `/api/v1/reservations/{reservationId}`
- **認証**: Bearer（IdP 発行トークン）、利用者区分「利用者」（本人の予約のみ）。司書は任意の予約を参照できる
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reservations/{reservationId}.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| reservationId | string (path) | Yes | 予約 ID |

#### レスポンス（200 `ReservationDetailResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| reservationId | string | 予約 ID |
| bookId | string | 書籍 ID |
| userNumber | string | 予約した利用者番号 |
| acceptedAt | string (date-time) | 受付日時 |
| queuePosition | integer | 予約順位（取消・終了は最終順位） |
| totalWaiting | integer | 当該書籍の有効予約件数 |
| status | string | 予約の状態（`RESERVED`（予約中） / `NOTIFIED`（通知済み） / `CANCELLED`（取消） / `CLOSED`（終了）） |
| notifiedAt | string (date-time) | 通知日時（通知済み以降）。無ければ null |
| cancelledAt | string (date-time) | 取消日時（取消のとき）。無ければ null |
| canCancel | boolean | 取消可能か（予約中 / 通知済み） |
| blockedReason | string | 取消不可の業務エラーコード（`RESERVATION_NOT_CANCELLABLE`）。可のとき null |
| book | BookSummary | 書籍要約 |

#### エラーレスポンス（`application/problem+json`）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | reservationId 形式不正 | `{code: "VALIDATION_ERROR"}` |
| 401 | トークン無し・無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分「利用者」で予約の利用者番号がトークンと不一致 | `{code: "FORBIDDEN"}`（監査ログに拒否を記録） |
| 404 | 予約が存在しない | `{code: "RESERVATION_NOT_FOUND"}` |
| 429 | 公開経路のレート制限超過（API Gateway SP-010） | `{code: "RATE_LIMITED"}` + `Retry-After` |

### 予約取消

- **メソッド**: POST
- **パス**: `/api/v1/reservations/{reservationId}/cancel`
- **認証**: Bearer、利用者区分「利用者」必須（本人の予約のみ）。`Idempotency-Key` ヘッダ必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reservations/{reservationId}/cancel.post` を参照

#### リクエスト（`CancelReservationRequest`）

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| reservationId | string (path) | Yes | 取り消す予約 ID |
| Idempotency-Key | string (header, UUID) | Yes | 冪等キー。同一キーの再送は初回結果を返す |
| （本文） | object | No | 本文なし（空 JSON を許容） |

#### レスポンス（200 `ReservationCancelResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| reservationId | string | 予約 ID |
| bookId | string | 書籍 ID |
| status | string | `CANCELLED`（取消） |
| cancelledAt | string (date-time) | 取消日時 |
| previousStatus | string | 取消前の状態（`RESERVED`（予約中） / `NOTIFIED`（通知済み）） |
| promotedCount | integer | 順位を繰り上げた後続予約の件数 |
| bookStatus | string | 取消後の書籍の状態（`ON_LOAN`（貸出中） / `RESERVED`（予約待ち） / `AVAILABLE`（在庫あり）） |
| nextNotified | ReservationSummary | 通知済み取消に伴い通知済みへ遷移した次順位の予約。無ければ null |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | Idempotency-Key 欠落 / reservationId 形式不正 | `{code: "VALIDATION_ERROR"}` |
| 401 | 未認証 | `{code: "UNAUTHENTICATED"}` |
| 403 | 他人の予約 / 利用者区分が「利用者」でない | `{code: "FORBIDDEN"}`（監査ログに拒否を記録） |
| 404 | 予約が存在しない | `{code: "RESERVATION_NOT_FOUND"}` |
| 409 | 予約の状態が「取消」または「終了」 | `{code: "RESERVATION_NOT_CANCELLABLE", detail: "この予約はすでに終了しています"}` |
| 409 | 同一 Idempotency-Key で異なるリクエスト | `{code: "IDEMPOTENCY_KEY_CONFLICT"}` |
| 409 | 楽観ロック競合（reservations / books の version 不一致） | `{code: "CONCURRENT_UPDATE"}` |
| 429 | 公開経路のレート制限超過（API Gateway SP-010） | `{code: "RATE_LIMITED"}` + `Retry-After` |

## 非同期イベント（条件付き）

### ReturnNoticeRequested

- **チャネル**: `notifications.return-notice-requested`
- **方向**: publish
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notifications.return-notice-requested` を参照
- **発行条件**: 取り消した予約が「通知済み」で書籍が「予約待ち」、かつ次順位の「予約中」の予約が存在するとき。ペイロード・MessageId・冪等発行は UC「返却通知を送信する」と同一

## データモデル変更

### reservations（予約 E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR | RESERVED（予約中） / NOTIFIED（通知済み） → CANCELLED（取消） に更新。次順位は RESERVED（予約中） → NOTIFIED（通知済み）（条件付き） | 変更 |
| queue_position | INT | 後続の有効予約を -1 で繰り上げ | 変更 |
| version | INT | 楽観ロックで +1 | 変更 |

### reservation_events（予約イベント）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id | VARCHAR | 予約 ID | 追加（本 UC で INSERT） |
| event_type | VARCHAR | `CANCELLED`（取消）（本人）/ `NOTIFIED`（次順位。条件付き） | 追加 |
| occurred_at | TIMESTAMP | 取消日時（cancelled_at の導出元） | 追加 |
| actor_user_number | VARCHAR | 操作者（利用者本人） | 追加 |
| related_id | VARCHAR | 通知イベントのとき notification_id | 追加 |
| idempotency_key | VARCHAR | 冪等キー（取消イベント、UNIQUE） | 追加 |

### books（書籍 E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR | RESERVED（予約待ち） → AVAILABLE（在庫あり） に更新（有効予約が 0 件になったとき） | 変更 |
| version | INT | 楽観ロックで +1 | 変更 |

### book_events（書籍イベント）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| event_type | VARCHAR | `CANCELLED`（書籍が在庫ありへ遷移したときのみ） | 追加 |
| related_id | VARCHAR | reservation_id | 追加 |

### notifications（通知 E-008）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_type / target_reservation_id / send_result | VARCHAR / VARCHAR / VARCHAR | `RETURN_NOTICE`（返却通知） / 次順位の予約 ID / `PENDING`（送信待ち）（条件付き INSERT。構造は UC「RETURN_NOTICE（返却通知）を送信する」と同一） | 追加 |

## ビジネスルール

- 利用状況閲覧範囲判定: 利用者区分「利用者」は自分の利用者番号に紐づく予約のみ参照・取消できる。不一致は 403 とし、データアクセス監査ログに拒否を記録する（LP-007 / SP-016）。司書トークンは参照可・取消不可（403）
- 取消可否: 予約の状態が「予約中」「通知済み」のときのみ取消できる。「取消」「終了」は `RESERVATION_NOT_CANCELLABLE`
- 予約順位決定: 取消後、同一書籍の有効予約（予約中・通知済み）のうち取消対象より後ろの順位を 1 ずつ繰り上げる。取消した予約は最終順位を保持したまま順位管理対象から外す
- 繰り上げの更新順序: 部分一意インデックス `uq_reservations_book_id_queue_position` と衝突しないよう、対象行を `queue_position` 昇順に 1 行ずつ更新する（一括 UPDATE にしない）。各行の UPDATE では `version = version + 1` と `updated_at` も更新する
- 次順位への返却通知: 取消対象が「通知済み」で書籍が「予約待ち」のとき、繰り上げ後に順位 1 位となる「予約中」の予約を「通知済み」に遷移させ、通知レコード（返却通知・送信待ち）を作成してコミット後に MQ へ発行する（状態.tsv「通知済み → 取消: 次の予約順位の利用者に通知する」、条件「返却通知対象判定」）。書籍が「貸出中」のときは通知しない（返却時に UC「返却通知を送信する」で通知する）
- 書籍の状態復帰: 取消後に有効予約が 0 件で書籍が「予約待ち」なら「在庫あり」に遷移させ、book_events に予約取消イベントを記録する。書籍が「貸出中」なら変更しない
- 状態変更はすべて同一トランザクション内で行う。予約行・書籍行は `SELECT ... FOR UPDATE` で確保し `version` で楽観ロックする（LP-005 / LP-013）
- 取消日時は取消イベント（reservation_events.event_type = 'CANCELLED'）の occurred_at で管理する（arch E-007）
- 冪等性: `Idempotency-Key` を `reservation_events.idempotency_key` に保存し、同一キーの再送は保存済みの取消結果を 200 で返す。繰り上げは再実行しない
- 参照系キャッシュの当該書籍を無効化する（LP-017）
- 監査ログ: データ更新（E-007 / E-001 / E-008）と本人限定判定の結果を記録する（LP-006 / SR-010）。ログに氏名・連絡先を出力しない

## ティア完了条件（BDD）

```gherkin
Feature: 予約を取り消す - Backend API

  Scenario: 予約中の予約を取り消して後続を繰り上げる
    Given 書籍「B-000789」が「貸出中」で「U-000123」の予約「R-0001」が順位 1（予約中）、「U-000300」の予約「R-0002」が順位 2（予約中）
    And 利用者「U-000123」のトークンを持つ
    When POST /api/v1/reservations/R-0001/cancel を Idempotency-Key "c-1" 付きで送る
    Then HTTP 200 で status "CANCELLED"、previousStatus "RESERVED"、promotedCount 1、bookStatus "ON_LOAN"、nextNotified null が返る
    And reservations「R-0001」の current_status が "CANCELLED"、「R-0002」の queue_position が 1 になる
    And reservation_events に取消イベントが 1 件記録される

  Scenario: 通知済みの予約を取り消して次順位に返却通知を作成する
    Given 書籍「B-000789」が「予約待ち」で「U-000123」の予約「R-0001」が順位 1（通知済み）、「U-000300」の予約「R-0002」が順位 2（予約中）
    And 利用者「U-000123」のトークンを持つ
    When POST /api/v1/reservations/R-0001/cancel を送る
    Then HTTP 200 で nextNotified.reservationId "R-0002"、nextNotified.queuePosition 1、bookStatus "RESERVED" が返る
    And reservations「R-0002」の current_status が "NOTIFIED" になる
    And notifications に notification_type=RETURN_NOTICE, target_reservation_id=R-0002, send_result=PENDING の行が 1 件作成される
    And MQ チャネル "notifications.return-notice-requested" にメッセージが 1 件発行される

  Scenario: 最後の予約を取り消して書籍を在庫ありに戻す
    Given 書籍「B-000789」が「予約待ち」で「U-000123」の予約「R-0001」が順位 1（通知済み）で他に有効な予約が無い
    When 利用者「U-000123」のトークンで POST /api/v1/reservations/R-0001/cancel を送る
    Then HTTP 200 で bookStatus "AVAILABLE" が返り books.current_status が "AVAILABLE" になる
    And book_events に予約取消イベントが 1 件記録され notifications は追加されない

  Scenario: 他人の予約の取消は 403 を返す
    Given 予約「R-0002」は「U-000300」の予約である
    When 利用者「U-000123」のトークンで POST /api/v1/reservations/R-0002/cancel を送る
    Then HTTP 403 で problem+json の code "FORBIDDEN" が返り reservations は変更されない
    And 監査ログに action_type=データ更新, result=拒否 が記録される

  Scenario: 取消済みの予約は 409 を返す
    Given 「U-000123」の予約「R-0001」が「取消」である
    When 利用者「U-000123」のトークンで POST /api/v1/reservations/R-0001/cancel を送る
    Then HTTP 409 で code "RESERVATION_NOT_CANCELLABLE" が返る

  Scenario: 予約詳細参照で本人の予約を返す
    Given 「U-000123」の予約「R-0001」が順位 2（予約中）で書籍の有効予約が 3 件
    When 利用者「U-000123」のトークンで GET /api/v1/reservations/R-0001 を送る
    Then HTTP 200 で queuePosition 2、totalWaiting 3、status "RESERVED"、canCancel true が返る

  Scenario: 同一 Idempotency-Key の再送は繰り上げを再実行しない
    Given Idempotency-Key "c-1" で POST /api/v1/reservations/R-0001/cancel が HTTP 200 を返済み
    And 「R-0002」の queue_position が 1 である
    When 同じ Idempotency-Key "c-1" で再送する
    Then HTTP 200 で同一の cancelledAt が返り「R-0002」の queue_position は 1 のままである
```
