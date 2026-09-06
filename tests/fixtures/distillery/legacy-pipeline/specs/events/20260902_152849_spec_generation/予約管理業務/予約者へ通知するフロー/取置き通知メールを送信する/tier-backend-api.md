# 取置き通知メールを送信する - バックエンド API 仕様

## 変更概要

通知コンテキスト（BC-005）に、取置き案内の送信要求を受け付けるエンドポイントと送信実績照会・再送のエンドポイントを追加する。API は通知を「送信待ち」で作成して `notification.hold-notice.requested` へ送信要求を publish するところまでを担い、実際の送信はワーカーへ委譲する（202 Accepted）。

## API 仕様

### 取置き案内送信要求 API

- **メソッド**: POST
- **パス**: `/api/v1/staff/notifications/hold-notices`
- **認証**: Bearer トークン（IdP 発行。API Gateway でトークン検証と粗粒度 RBAC。役割=司書、館内ネットワーク限定 / NFR E.5.3.1）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/notifications/hold-notices.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| reservation_id | string | Yes | 取置き案内の対象予約ID（body） |
| X-Idempotency-Key | string | Yes | 冪等キー（UUID。header。arch SR-002） |

#### レスポンス（202 Accepted）

| フィールド | 型 | 説明 |
|-----------|---|------|
| notification_id | string | 作成した通知ID |
| notification_type | string | 通知種別（取置き案内） |
| notification_status | string | 通知状態（送信待ち） |
| target_reservation_id | string | 対象予約ID |
| recipient_user_no | string | 宛先利用者番号 |
| requested_at | string(date-time) | 送信要求日時 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | reservation_id が未指定または形式不正 | `{"code":"INVALID_REQUEST","message":"予約IDを指定してください"}` |
| 401 | トークン未提示・失効 | `{"code":"UNAUTHENTICATED","message":"ログインが必要です"}` |
| 403 | 役割が司書でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |
| 404 | 指定した予約が存在しない | `{"code":"RESERVATION_NOT_FOUND","message":"対象の予約が見つかりません"}` |
| 409 | 取置き通知対象条件を満たさない（書籍状態が「予約待ち」でない / 予約状態が「予約中」でない / 予約順1位でない） | `{"code":"HOLD_NOTICE_NOT_ELIGIBLE","message":"取置き通知対象条件を満たしません"}` |
| 409 | 同一予約への取置き案内が既に存在する（通知送信冪等キーの重複） | `{"code":"HOLD_NOTICE_ALREADY_SENT","message":"この予約への取置き案内は送信済みです"}` |

### 通知送信実績照会 API

- **メソッド**: GET
- **パス**: `/api/v1/staff/notifications`
- **認証**: Bearer トークン（役割=司書）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/notifications.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| notification_type | string | No | 通知種別（取置き案内 / 返却期限リマインド / 延滞督促）。既定は絞り込みなし |
| notification_status | string | No | 通知状態（送信待ち / 送信済み / 送信失敗） |
| page | integer | No | ページ番号（既定 1） |
| size | integer | No | 1 ページ件数（既定 20。NFR B.1.1.1 に対する design 決定） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items[].notification_id | string | 通知ID |
| items[].notification_type | string | 通知種別 |
| items[].recipient_user_no | string | 宛先利用者番号 |
| items[].recipient_email_masked | string | 宛先メールアドレス（マスク表示） |
| items[].target_reservation_id | string | 対象予約ID |
| items[].notification_status | string | 通知状態 |
| items[].send_result | string | 送信結果（メール配信サービスの応答コード・エラー内容） |
| items[].sent_at | string(date-time) | 送信日時（送信イベントの発生時刻） |
| total | integer | 総件数 |
| page / size | integer | ページ情報 |
| failure_count | integer | 通知状態が「送信失敗」の件数（未達件数の警告用） |

### 通知再送 API

- **メソッド**: POST
- **パス**: `/api/v1/staff/notifications/{notification_id}/resend`
- **認証**: Bearer トークン（役割=司書）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/notifications/{notification_id}/resend.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| notification_id | string | Yes | 再送対象の通知ID（path） |
| X-Idempotency-Key | string | Yes | 冪等キー（UUID。header） |

#### レスポンス（202 Accepted）

| フィールド | 型 | 説明 |
|-----------|---|------|
| notification_id | string | 通知ID |
| notification_status | string | 通知状態（送信待ち） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 404 | 通知が存在しない | `{"code":"NOTIFICATION_NOT_FOUND","message":"対象の通知が見つかりません"}` |
| 409 | 通知状態が「送信失敗」でない | `{"code":"RETRY_NOT_ALLOWED","message":"送信失敗の通知のみ再送できます"}` |

## 非同期イベント（該当する場合）

### 取置き案内メール送信依頼

- **チャネル**: `notification.hold-notice.requested`
- **方向**: publish
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.notification.hold-notice.requested` を参照
- **メッセージ**: `HoldNoticeRequested`

| フィールド | 型 | 説明 |
|-----------|---|------|
| notification_id | string | 通知ID |
| notification_type | string | 通知種別（取置き案内） |
| target_reservation_id | string | 対象予約ID |
| recipient_user_no | string | 宛先利用者番号 |
| idempotency_key | string | 通知送信冪等キー（E-902）。at-least-once 配信での重複処理を抑止する |
| trace_id | string | 分散トレース ID（arch CLR-005） |
| requested_at | string(date-time) | 送信要求日時 |

宛先メールアドレスはメッセージへ含めず、ワーカー側で通知レコードから取得する（PII のメッセージング滞留を避ける。NFR E.1.2.1 / E.6.1.1）。

## データモデル変更

### notifications（情報: 通知 / E-006）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_id | VARCHAR | 通知ID（主キー） | 追加（INSERT 対象） |
| notification_type | VARCHAR | 通知種別。本 UC では「取置き案内」を設定 | 追加（INSERT 対象） |
| timing_type | VARCHAR | 通知タイミング区分。arch E-006 で `nullable: false` のため未設定にできない。取置き案内には「即時通知」を設定する | 追加（INSERT 対象） |
| recipient_user_no | VARCHAR | 宛先利用者番号 | 追加（INSERT 対象） |
| recipient_email | VARCHAR | 宛先メールアドレス。送信時点の値をコピー。保管時暗号化（NFR E.6.1.1） | 追加（INSERT 対象） |
| target_reservation_id | VARCHAR | 対象予約ID | 追加（INSERT 対象） |
| target_loan_id | VARCHAR | 対象貸出ID。取置き案内では NULL | 追加（NULL のまま） |
| send_result | TEXT | 送信結果。作成時は NULL、ワーカーが更新する | 追加（NULL のまま） |
| notification_status | VARCHAR | 通知状態。作成時は「送信待ち」、再送時も「送信待ち」へ戻す | 追加 / 変更 |

**arch へのフィードバック事項**: RDRA バリエーション「通知タイミング区分」には取置き案内に相当する値が無い。arch E-006 の `timing_type` が `nullable: false` である以上、NOT NULL 制約違反を避けるにはバリエーションへ「即時通知」を追加する必要がある（代替案は E-006 の `timing_type` を `nullable: true` へ変更すること）。本仕様は「即時通知」を追加する前提で `timing_type` を設定する。

### notification_idempotency_keys（情報: なし / E-902 通知送信冪等キー）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| idempotency_key | VARCHAR | 通知種別 + 対象予約ID から決定的に生成した冪等キー（主キー） | 追加（INSERT 対象） |
| notification_id | VARCHAR | 生成済みの通知ID | 追加（INSERT 対象） |
| requested_at | TIMESTAMP | 送信要求日時 | 追加（INSERT 対象） |
| expires_at | TIMESTAMP | キー保持期限。TTL で自動失効 | 追加（INSERT 対象） |

### reservations（情報: 予約 / E-005）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_status / priority / book_id | VARCHAR / INT | 取置き通知対象条件の再評価に参照する | 参照のみ（更新はワーカーが行う） |

## ビジネスルール

- 取置き通知対象条件: 書籍状態が「予約待ち」となった書籍について、予約順1位かつ予約状態が「予約中」の予約 1 件のみを取置き通知の対象とする。送信要求の受付時に再評価する
- 通知送信冪等キーは「取置き案内」+ 対象予約ID から決定的に生成し、既に存在する場合は新規通知を作成せず 409 を返す（E-902 / MQ の at-least-once 配信への対策）
- 宛先メールアドレスは送信要求時点の利用者の連絡先をコピーして通知へ保持し、以後の利用者側の変更に追随させない
- 通知作成と送信要求の publish は同一トランザクション境界で扱い、DB へ通知が残らないまま publish されないようにする
- 通知タイミング区分は RDRA バリエーションの 3 値がいずれも期限起点であり取置き案内に対応する値が無いため設定しない。新規の値を追加しない（要確認）
- 再送は通知状態が「送信失敗」の通知に限り、「送信待ち」へ戻して送信要求を再 publish する
- 送信実績一覧では宛先メールアドレスをマスクして返す（NFR E.1.2.1）
- 予約状態の「取置き中」への遷移と取置き期限の設定は、送信成功を確認したワーカーが行う（本ティアでは行わない）

## ティア完了条件（BDD）

```gherkin
Feature: 取置き通知メールを送信する - バックエンド API

  Scenario: 取置き案内の送信要求が 202 を返す
    Given 書籍 B-0001 の book_status が「予約待ち」
    And 予約 R-0007 の reservation_status が「予約中」で priority が 1 である
    And 役割が司書のアクセストークンを保持している
    When POST /api/v1/staff/notifications/hold-notices に {"reservation_id":"R-0007"} を送信する
    Then HTTP 202 が返り notification_status が「送信待ち」である
    And notifications に notification_type「取置き案内」の行が 1 件 INSERT される
    And notification.hold-notice.requested へ HoldNoticeRequested が publish される

  Scenario: 同一予約への再要求が 409 を返す
    Given 予約 R-0007 に対する通知種別「取置き案内」の通知が既に存在する
    When POST /api/v1/staff/notifications/hold-notices に {"reservation_id":"R-0007"} を送信する
    Then HTTP 409 が返り code が HOLD_NOTICE_ALREADY_SENT である
    And notifications の件数は変わらない

  Scenario: 条件を満たさない予約への送信要求が 409 を返す
    Given 予約 R-0300 の reservation_status が「キャンセル」である
    When POST /api/v1/staff/notifications/hold-notices に {"reservation_id":"R-0300"} を送信する
    Then HTTP 409 が返り code が HOLD_NOTICE_NOT_ELIGIBLE である
    And メッセージは publish されない

  Scenario: 送信失敗の通知を再送できる
    Given 通知 N-0002 の notification_status が「送信失敗」である
    When POST /api/v1/staff/notifications/N-0002/resend を送信する
    Then HTTP 202 が返り notification_status が「送信待ち」である
    And notification.hold-notice.requested へ HoldNoticeRequested が再 publish される

  Scenario: 送信実績一覧が未達件数つきで返る
    Given 通知種別「取置き案内」の通知が送信済み 3 件・送信失敗 1 件存在する
    When GET /api/v1/staff/notifications?notification_type=取置き案内 を送信する
    Then HTTP 200 が返り items が 4 件である
    And failure_count が 1 である
    And recipient_email_masked がマスク文字列である
```
