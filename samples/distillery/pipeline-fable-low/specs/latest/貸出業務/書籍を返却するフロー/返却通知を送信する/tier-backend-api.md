# 返却通知を送信する - Backend API仕様

## 変更概要

通知コンテキスト（BC-005）に返却通知プレビュー API と返却通知送信 API を追加する。送信 API は単一トランザクションで通知レコード（返却通知・送信待ち）の作成と予約の状態遷移（予約中 → 通知済み）を行い、コミット後に MQ へ `ReturnNoticeRequested` を発行する（arch SP-017 / LP-008）。外部メール配信サービスの結果は待たず、送信結果の反映はワーカーの責務とする。

## API 仕様

### 返却通知プレビュー

- **メソッド**: GET
- **パス**: `/api/v1/loans/{loanId}/return-notice`
- **認証**: Bearer（IdP 発行トークン）、利用者区分「司書」必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans/{loanId}/return-notice.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| loanId | string (path) | Yes | 返却登録済みの貸出 ID |
| reveal | boolean (query) | No | 連絡先を平文で返すか（既定 false。true は監査ログに開示を記録） |

#### レスポンス（200 `ReturnNoticePreviewResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| loanId | string | 貸出 ID |
| book | BookSummary | 書籍要約（status は `RESERVED`（予約待ち）） |
| reservation | ReservationSummary | 送信先となる予約（有効予約 `RESERVED` / `NOTIFIED` のうち `queue_position = 1`）。無ければ null。送信確定で `NOTIFIED` に遷移しても同じ予約を返し続ける |
| recipient | RecipientSummary | userNumber, name, emailMasked（マスク済み）。`reveal=true` クエリで email を返す（監査ログ対象） |
| reservations | ReservationListItem[] | 書籍の有効予約（予約中・通知済み）を順位順に（reservationId, queuePosition, userNumber, userName, acceptedAt, status, notifiedAt, cancelledAt。UC「予約一覧を参照する」と同じ型） |
| notifications | NotificationLog[] | 対象予約に対する返却通知の送信記録（notificationId, notificationType, recipientMasked, requestedOn, sentAt, sendResult） |
| canSend | boolean | 送信可能か（reservation があり、当日の通知レコードが未作成） |
| blockedReason | string | 送信不可の業務エラーコード（`NO_RESERVATION_TO_NOTIFY` / `RETURN_NOTICE_ALREADY_SENT` / `LOAN_NOT_RETURNED`）。可のとき null |

#### エラーレスポンス（`application/problem+json`）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | loanId 形式不正 | `{code: "VALIDATION_ERROR"}` |
| 401 | トークン無し・無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が司書でない | `{code: "FORBIDDEN"}` |
| 404 | 貸出が存在しない | `{code: "LOAN_NOT_FOUND"}` |

### 返却通知送信

- **メソッド**: POST
- **パス**: `/api/v1/notifications/return-notices`
- **認証**: Bearer、利用者区分「司書」必須。`Idempotency-Key` ヘッダ必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/notifications/return-notices.post` を参照

#### リクエスト（`SendReturnNoticeRequest`）

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| Idempotency-Key | string (header, UUID) | Yes | 冪等キー。同一キーの再送は初回結果を返す |
| loanId | string | Yes | 返却登録済みの貸出 ID（書籍と送信先予約の特定に使う） |

#### レスポンス（202 `ReturnNoticeResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| notificationId | string | 通知 ID（MQ の MessageId と一致） |
| notificationType | string | `RETURN_NOTICE`（返却通知） |
| reservationId | string | 対象予約 ID |
| userNumber | string | 送信先利用者番号 |
| recipientMasked | string | マスク済み送信先メールアドレス |
| requestedOn | string (date) | 送信日（当日） |
| sendResult | string | `PENDING`（送信待ち） |
| reservationStatus | string | 遷移後の予約の状態（`NOTIFIED` = 通知済み） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | loanId 欠落 / Idempotency-Key 欠落 | `{code: "VALIDATION_ERROR"}` |
| 401 / 403 | 未認証 / 司書以外 | `{code: "UNAUTHENTICATED"}` / `{code: "FORBIDDEN"}` |
| 404 | 貸出が存在しない | `{code: "LOAN_NOT_FOUND"}` |
| 409 | 貸出が返却済みでない | `{code: "LOAN_NOT_RETURNED", detail: "返却登録が完了していません"}` |
| 409 | 書籍に有効予約（`RESERVED` / `NOTIFIED`）が無い | `{code: "NO_RESERVATION_TO_NOTIFY", detail: "この書籍に予約者はいません"}` |
| 409 | 同一予約 × 返却通知 × 当日の通知レコードが既に存在 | `{code: "RETURN_NOTICE_ALREADY_SENT", detail: "本日すでに返却通知を送信済みです"}` |
| 409 | 同一 Idempotency-Key で異なるリクエスト本文 | `{code: "IDEMPOTENCY_KEY_CONFLICT"}` |
| 409 | 楽観ロック競合（reservations.version 不一致） | `{code: "CONCURRENT_UPDATE"}` |

## 非同期イベント

### ReturnNoticeRequested

- **チャネル**: `notifications.return-notice-requested`
- **方向**: publish
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notifications.return-notice-requested` を参照
- **MessageId**: 通知 ID（冪等発行 LP-014。コミット後に発行し、発行失敗時は通知レコードを送信待ちのまま残して再発行対象とする）
- **ペイロード**: `{notificationId, notificationType: "RETURN_NOTICE", targetReservationId, userNumber, bookId, requestedOn, traceId}`

## データモデル変更

### notifications（通知 E-008）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_id | VARCHAR(26) | 通知 ID（ULID。MQ の MessageId と一致） | 追加（本 UC で INSERT） |
| user_number | VARCHAR(20) | 送信先利用者番号 | 追加 |
| notification_type | VARCHAR(16) | `RETURN_NOTICE`（返却通知） | 追加 |
| recipient_email | VARCHAR(254) | 送信先メールアドレス（作成時点の値のコピー） | 追加 |
| subject / body | VARCHAR(200) / TEXT | 件名 / 本文（返却通知テンプレートから生成） | 追加 |
| requested_on | DATE | 送信日（当日）。重複送信防止キーの一部 | 追加 |
| send_result | VARCHAR(16) | `PENDING`（送信待ち）（ワーカーがSUCCEEDED（成功） / FAILED（失敗）に更新） | 追加 |
| sent_at | TIMESTAMP | 送信日時（送信待ちの間は NULL） | 追加 |
| target_loan_id | VARCHAR(26) | NULL（返却通知では未使用） | 追加 |
| target_reservation_id | VARCHAR(26) | 対象予約 ID | 追加 |
| UNIQUE(target_reservation_id, notification_type, requested_on) | — | 重複送信防止の一意キー（SR-013） | 追加 |

### reservations（予約 E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR | RESERVED（予約中） → NOTIFIED（通知済み） に更新 | 変更 |
| version | INT | 楽観ロックで +1 | 変更 |

### reservation_events（予約イベント。E-007 event_snapshot のイベント側）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_event_id | VARCHAR | PK | 追加 |
| reservation_id | VARCHAR | 予約 ID | 追加 |
| event_type | VARCHAR | `NOTIFIED`（他 UC: RESERVED・CANCELLED・CLOSED） | 追加 |
| occurred_at | TIMESTAMP | 発生日時（通知日時） | 追加 |
| actor_user_number | VARCHAR | 操作者（司書） | 追加 |
| related_id | VARCHAR | notification_id | 追加 |
| idempotency_key | VARCHAR | 冪等キー（UNIQUE） | 追加 |

## ビジネスルール

- 返却通知対象判定: 貸出が「返却済み」かつ書籍が「予約待ち」で、有効予約（状態「予約中」`RESERVED` または「通知済み」`NOTIFIED`）のうち `queue_position = 1` の予約の利用者を送信先とする。有効予約が無ければ `NO_RESERVATION_TO_NOTIFY`
- 送信先ガード: 順位 1 位が「通知済み」で未来館のままでも 2 位以降を送信先にしない（予約順位の保証。順位 1 位の予約が取消・終了して繰り上がった場合のみ新しい 1 位が対象になる）
- 送信可否（`canSend`）は「送信先の予約があり、その予約 × 返却通知 × 当日（`requested_on`）の通知レコードが未作成」で判定する。作成済みなら `RETURN_NOTICE_ALREADY_SENT`（順位 1 位が `NOTIFIED` でもプレビューの `reservation` は null にしない）
- 送信先メールアドレスは利用者の現在の値を `recipient_email` にコピーする（送信時点の記録。arch E-008）
- 通知レコード作成と予約の状態遷移（予約中 → 通知済み）は同一トランザクション（LP-005 / LP-008）。予約行は `SELECT ... FOR UPDATE` で確保し `version` で楽観ロックする
- 重複送信防止: `UNIQUE(target_reservation_id, notification_type, requested_on)` で同日の二重作成を防ぐ（SR-013）。翌日以降の再送信は新しい通知レコードとして許可する（通知済みの予約に対する再通知）
- MQ 発行はコミット後に gateway 経由で行う。MessageId = 通知 ID（LP-014）。発行に失敗した場合は WARN の劣化兆候ログを出し、通知レコードは送信待ちのまま残す。「送信待ちかつ未発行」の通知は tier-worker の `ReturnNoticeSweepJob`（日次の再発行スイープ）が再発行する
- API 応答は 202 Accepted。送信結果（成功 / 失敗）はワーカーが反映し、司書はプレビュー API の `notifications` で確認する（SP-029）
- 冪等性: `Idempotency-Key` を `reservation_events.idempotency_key` に保存し、同一キーの再送は保存済みの通知を 202 で返す
- 認可: 司書区分のみ。連絡先の開示（`reveal=true`）はデータアクセス監査ログに記録する（SR-010）
- 監査ログ: データ更新（E-008 / E-007）を記録する。ログに氏名・メールアドレス・本文を出力しない

## ティア完了条件（BDD）

```gherkin
Feature: 返却通知を送信する - Backend API

  Scenario: 返却通知を作成し予約を通知済みにして MQ に発行する
    Given 貸出「L-0002」（書籍「B-000789」）が「返却済み」で書籍が「予約待ち」
    And 「U-000200」（u200@example.com）の予約「R-0001」が順位 1（予約中）、「U-000300」の予約「R-0002」が順位 2（予約中）
    And 本日が 2026-09-10
    When 司書トークンで POST /api/v1/notifications/return-notices {loanId: "L-0002"} を Idempotency-Key "n-1" 付きで送る
    Then HTTP 202 で notificationType "RETURN_NOTICE"、reservationId "R-0001"、sendResult "PENDING"、reservationStatus "NOTIFIED" が返る
    And notifications に target_reservation_id=R-0001, recipient_email=u200@example.com, requested_on=2026-09-10, send_result=PENDING の行が 1 件作成される
    And reservations「R-0001」の current_status が "NOTIFIED"、「R-0002」は "RESERVED" のままである
    And MQ チャネル "notifications.return-notice-requested" に MessageId=通知 ID のメッセージが 1 件発行される

  Scenario: プレビューで送信先と送信可否を返す
    Given 貸出「L-0002」が「返却済み」で予約「R-0001」が順位 1（予約中）
    When 司書トークンで GET /api/v1/loans/L-0002/return-notice を送る
    Then HTTP 200 で reservation.reservationId "R-0001"、recipient.emailMasked "u2***@example.com"、canSend true が返る

  Scenario: 予約中の予約が無い場合は 409 を返す
    Given 貸出「L-0001」が「返却済み」で書籍「B-000456」に予約中の予約が無い
    When 司書トークンで POST /api/v1/notifications/return-notices {loanId: "L-0001"} を送る
    Then HTTP 409 で problem+json の code "NO_RESERVATION_TO_NOTIFY" が返る

  Scenario: 同日に二重送信すると 409 を返す
    Given 予約「R-0001」に対する返却通知が requested_on=2026-09-10 で作成済み
    When 司書トークンで別の Idempotency-Key "n-2" で POST /api/v1/notifications/return-notices {loanId: "L-0002"} を送る
    Then HTTP 409 で code "RETURN_NOTICE_ALREADY_SENT" が返り notifications は追加されない

  Scenario: 返却済みでない貸出には 409 を返す
    Given 貸出「L-0003」が「貸出中」
    When 司書トークンで POST /api/v1/notifications/return-notices {loanId: "L-0003"} を送る
    Then HTTP 409 で code "LOAN_NOT_RETURNED" が返る

  Scenario: 同一 Idempotency-Key の再送は同じ結果を返す
    Given Idempotency-Key "n-1" で POST /api/v1/notifications/return-notices が HTTP 202 notificationId "N-0001" を返済み
    When 同じ本文と Idempotency-Key "n-1" で再送する
    Then HTTP 202 で notificationId "N-0001" が返り notifications は 1 件のままである
```
