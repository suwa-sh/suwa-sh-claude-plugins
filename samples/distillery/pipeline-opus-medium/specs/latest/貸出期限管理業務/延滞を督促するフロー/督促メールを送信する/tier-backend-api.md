# 督促メールを送信する - バックエンド API 仕様

## 変更概要

延滞督促の送信実績を照会するエンドポイントと、送信失敗の通知を再送するエンドポイントを提供する。エンドポイント定義は「リマインドメールを送信する」と共通で、通知種別（`延滞督促`）で絞り込む。再送は通知状態を「送信失敗」→「送信待ち」へ遷移させ、通知種別に対応する `notification.dun.requested` へメッセージを再 publish する。

## API 仕様

### 通知送信実績の一覧取得（延滞督促）

- **メソッド**: GET
- **パス**: `/api/v1/staff/notifications`
- **認証**: 外部マネージド IdP 発行のアクセストークン（Bearer）。役割「司書」を確認する（RBAC / NFR E.5.2.1）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/notifications.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| notification_type | string | No | 通知種別。本 UC の画面は `延滞督促` を指定する |
| timing_type | string | No | 通知タイミング区分。本 UC では `期限超過督促` |
| notification_status | string | No | 通知状態。`送信待ち` / `送信済み` / `送信失敗` |
| target_date | string(date) | No | 送信要求日で絞り込む。既定は当日 |
| page | integer | No | ページ番号（1 始まり）。既定 1 |
| per_page | integer | No | 1 ページ件数。既定 20、最大 100 |

#### レスポンス

`NotificationLogListResponse`（「リマインドメールを送信する」の tier-backend-api.md と同一スキーマ）。本 UC では `items[].notification_type` が `延滞督促`、`items[].timing_type` が `期限超過督促` となり、`items[].due_date` は対象貸出の返却期限を表す。

| フィールド | 型 | 説明 |
|-----------|---|------|
| summary.pending / summary.sent / summary.failed | integer | 通知状態別の件数。`failed` が督促の未達件数 |
| total / page / per_page | integer | ページング情報 |
| items[].notification_id | string | 通知ID |
| items[].notification_type | string | 通知種別（`延滞督促`） |
| items[].timing_type | string | 通知タイミング区分（`期限超過督促`） |
| items[].recipient_user_no | string | 宛先利用者番号 |
| items[].recipient_email_masked | string | 宛先メールアドレス（マスク済み） |
| items[].user_name | string | 宛先利用者の氏名（司書ロール向け API のみ） |
| items[].target_loan_id | string | 対象貸出ID |
| items[].book_title | string | 対象貸出の書籍タイトル |
| items[].due_date | string(date) | 対象貸出の返却期限 |
| items[].notification_status | string | 通知状態 |
| items[].send_result | string | 送信結果（メールアドレスはマスク済み） |
| items[].requested_at | string(date-time) | 送信要求日時 |
| items[].resendable | boolean | 通知状態が「送信失敗」のときのみ `true` |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `notification_type` / `timing_type` / `notification_status` がバリエーションの許容値でない | `{"code":"INVALID_PARAMETER","message":"パラメータの値が不正です"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |
| 500 | データストア障害等の技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

### 通知の再送（延滞督促）

- **メソッド**: POST
- **パス**: `/api/v1/staff/notifications/{notification_id}/resend`
- **認証**: 同上（役割「司書」）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/notifications/{notification_id}/resend.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| notification_id | string（パス） | Yes | 再送する通知ID（通知種別が `延滞督促` のもの） |
| X-Idempotency-Key | string（ヘッダ） | Yes | 冪等キー（UUID）。二重送信を防止する（arch SR-002 / LP-007） |

#### レスポンス

`NotificationResendResponse`（notification_id / notification_status / accepted_at）。成功時のステータスコードは 202。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 404 | 指定した通知IDが存在しない | `{"code":"NOTIFICATION_NOT_FOUND","message":"通知が見つかりません"}` |
| 409 | 通知状態が「送信失敗」以外 | `{"code":"NOT_RESENDABLE","message":"送信失敗の通知のみ再送できます"}` |
| 400 | `X-Idempotency-Key` が欠落または形式不正 | `{"code":"INVALID_IDEMPOTENCY_KEY","message":"冪等キーが不正です"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |

## 非同期イベント（該当する場合）

### 延滞督促送信要求の再 publish

- **チャネル**: `notification.dun.requested`
- **方向**: publish
- **AsyncAPI**: [asyncapi.yaml](../../_cross-cutting/api/asyncapi.yaml) の `channels.notification.dun.requested` を参照
- **ペイロードスキーマ**: `DunNotificationRequestedPayload`（AsyncAPI `components.schemas.DunNotificationRequestedPayload.title` と同名。契約生成の型名の正本であり、業務的意味が変わらない限り改名しない）
- **ヘッダースキーマ**: `MessageHeaders`（全非同期メッセージ共通のヘッダー）
- **契機**: 再送 API が通知状態を「送信失敗」→「送信待ち」へ遷移させ、トランザクションのコミット後に publish する（arch LP-005）
- **メッセージ**: `DunNotificationRequested`。再送のたびに再送連番を含めた `idempotency_key` を生成し、前回の送信済み判定と衝突させない。あわせて再送対象の `notification_id` を設定して publish する（worker は既存通知を再利用し INSERT しない）
- **チャネルの選択**: 再送 API は通知の `notification_type` を見て publish 先を決める（`返却期限リマインド` → `notification.remind.requested` / `延滞督促` → `notification.dun.requested`）

## データモデル変更

### notifications（情報: 通知 / E-006）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_id | VARCHAR | 通知ID（PK） | 変更なし（参照のみ） |
| notification_type | VARCHAR | `延滞督促` で絞り込む | 変更なし（参照のみ） |
| timing_type | VARCHAR | `期限超過督促` | 変更なし（参照のみ） |
| recipient_email | VARCHAR | 宛先メールアドレス。API はマスクして返す | 変更なし（参照のみ） |
| target_loan_id | VARCHAR | 対象貸出ID | 変更なし（参照のみ） |
| send_result | TEXT | 送信結果 | 変更なし（参照のみ） |
| notification_status | VARCHAR | 再送で「送信失敗」→「送信待ち」へ更新する | 変更（UPDATE） |

インデックス: `(notification_type, notification_status, requested_at)` の複合インデックスを必要とする（「リマインドメールを送信する」と共通）。

### loans / books / users（参照のみ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loans.due_date | DATE | 対象貸出の返却期限 | 変更なし（参照のみ） |
| books.title | VARCHAR | 対象貸出の書籍タイトル | 変更なし（参照のみ） |
| users.name | VARCHAR | 司書向け一覧に表示する氏名 | 変更なし（参照のみ） |

## ビジネスルール

- 再送は通知状態が「送信失敗」の通知のみ受け付ける。「送信待ち」「送信済み」は 409 で拒否する
- 再送の publish 先チャネルは通知種別で決定する。`延滞督促` は `notification.dun.requested` へ publish する
- 状態遷移の判定と実行はドメイン層で行い、許可外の遷移要求はドメイン例外をスローする（arch LP-009）
- 通知状態の更新と送信要求の publish は同一トランザクションにしない。publish はコミット後に行う（arch LP-005）
- レスポンスに宛先メールアドレスの生値を含めない（NFR E.6.2.1 / arch SR-031）
- 再送操作は状態遷移を伴うビジネスイベントとして監査ログに INFO で記録する（arch LP-006）
- 冪等キーは KVS で検証し、既処理なら前回結果を返す（arch LP-007）
- 督促メールの送信自体は本ティアで行わない。tier-worker が MQ から消費して tier-external-gateway 経由で送信する

## ティア完了条件（BDD）

```gherkin
Feature: 督促メールを送信する - バックエンド API

  Scenario: 延滞督促の送信実績とサマリを返す
    Given 通知種別「延滞督促」の通知が送信済み 8 件・送信失敗 2 件記録されている
    When 司書トークンで GET /api/v1/staff/notifications?notification_type=延滞督促 を呼び出す
    Then HTTP 200 が返り summary.sent が 8、summary.failed が 2 になる

  Scenario: 対象貸出の返却期限を明細に含める
    Given 通知「N-4001」の対象貸出「L-3001」の返却期限が「2026-09-01」である
    When 司書トークンで GET /api/v1/staff/notifications?notification_type=延滞督促 を呼び出す
    Then items[0].target_loan_id が「L-3001」、items[0].due_date が「2026-09-01」になる

  Scenario: 送信失敗の督促を再送受付する
    Given 通知「N-4001」の通知種別が「延滞督促」で通知状態が「送信失敗」である
    When 司書トークンで POST /api/v1/staff/notifications/N-4001/resend を冪等キーつきで呼び出す
    Then HTTP 202 が返り notification_status が「送信待ち」になり notification.dun.requested へメッセージが publish される

  Scenario: 通知種別に応じた publish 先を選ぶ
    Given 通知「N-2001」の通知種別が「返却期限リマインド」で通知状態が「送信失敗」である
    When 司書トークンで POST /api/v1/staff/notifications/N-2001/resend を呼び出す
    Then notification.remind.requested へ publish され notification.dun.requested へは publish されない

  Scenario: 送信待ちの通知の再送を拒否する
    Given 通知「N-4002」の通知状態が「送信待ち」である
    When 司書トークンで POST /api/v1/staff/notifications/N-4002/resend を呼び出す
    Then HTTP 409 が返り code「NOT_RESENDABLE」が返却される

  Scenario: 利用者ロールのトークンでは到達できない
    Given 利用者「田中太郎」のアクセストークンを保持している
    When 利用者トークンで GET /api/v1/staff/notifications?notification_type=延滞督促 を呼び出す
    Then HTTP 403 が返り code「FORBIDDEN」が返却される
```
