# リマインドメールを送信する - バックエンド API 仕様

## 変更概要

通知の送信実績を照会するエンドポイントと、送信失敗の通知を再送するエンドポイントを追加する。再送は通知状態を「送信失敗」→「送信待ち」へ遷移させ、通知種別に対応する送信要求チャネルへメッセージを再 publish する。メール送信そのものは tier-worker と tier-external-gateway が担う。

## API 仕様

### 通知送信実績の一覧取得

- **メソッド**: GET
- **パス**: `/api/v1/staff/notifications`
- **認証**: 外部マネージド IdP 発行のアクセストークン（Bearer）。役割「司書」を確認する（RBAC / NFR E.5.2.1）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/notifications.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| notification_type | string | No | 通知種別。`取置き案内` / `返却期限リマインド` / `延滞督促`。本 UC の画面は `返却期限リマインド` を指定する |
| timing_type | string | No | 通知タイミング区分。`期限前リマインド` / `期限当日` / `期限超過督促` |
| notification_status | string | No | 通知状態。`送信待ち` / `送信済み` / `送信失敗` |
| target_date | string(date) | No | 送信要求日で絞り込む。既定は当日 |
| page | integer | No | ページ番号（1 始まり）。既定 1 |
| per_page | integer | No | 1 ページ件数。既定 20、最大 100 |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| summary.pending | integer | 通知状態「送信待ち」の件数 |
| summary.sent | integer | 通知状態「送信済み」の件数 |
| summary.failed | integer | 通知状態「送信失敗」の件数（未達件数） |
| total | integer | 絞り込み条件に合致する総件数 |
| page | integer | 現在のページ番号 |
| per_page | integer | 1 ページ件数 |
| items | NotificationLogItem[] | 通知の配列 |
| items[].notification_id | string | 通知ID |
| items[].notification_type | string | 通知種別 |
| items[].timing_type | string | 通知タイミング区分 |
| items[].recipient_user_no | string | 宛先利用者番号 |
| items[].recipient_email_masked | string | 宛先メールアドレス（マスク済み。例 `t***@example.com`） |
| items[].user_name | string | 宛先利用者の氏名（司書ロール向け API のみ返す。arch LR-003） |
| items[].target_loan_id | string | 対象貸出ID |
| items[].book_title | string | 対象貸出の書籍タイトル |
| items[].due_date | string(date) | 対象貸出の返却期限 |
| items[].notification_status | string | 通知状態（送信待ち / 送信済み / 送信失敗） |
| items[].send_result | string | 送信結果。メール配信サービスの応答コード・エラー内容（メールアドレスはマスク済み） |
| items[].requested_at | string(date-time) | 送信要求日時 |
| items[].resendable | boolean | 再送可能か（通知状態が「送信失敗」のときのみ `true`） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `notification_type` / `timing_type` / `notification_status` がバリエーションの許容値でない | `{"code":"INVALID_PARAMETER","message":"パラメータの値が不正です"}` |
| 401 | アクセストークンが無効または期限切れ | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |
| 500 | データストア障害等の技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

### 通知の再送

- **メソッド**: POST
- **パス**: `/api/v1/staff/notifications/{notification_id}/resend`
- **認証**: 同上（役割「司書」）
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/notifications/{notification_id}/resend.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| notification_id | string（パス） | Yes | 再送する通知ID |
| X-Idempotency-Key | string（ヘッダ） | Yes | 冪等キー（UUID）。二重送信を防止する（arch SR-002 / LP-007） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| notification_id | string | 再送を受け付けた通知ID |
| notification_status | string | 遷移後の通知状態（`送信待ち`） |
| accepted_at | string(date-time) | 再送受付日時 |

成功時のステータスコードは 202（受付。実際の送信は tier-worker が非同期に行う）。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 404 | 指定した通知IDが存在しない | `{"code":"NOTIFICATION_NOT_FOUND","message":"通知が見つかりません"}` |
| 409 | 通知状態が「送信失敗」以外（送信待ち / 送信済み） | `{"code":"NOT_RESENDABLE","message":"送信失敗の通知のみ再送できます"}` |
| 400 | `X-Idempotency-Key` が欠落または形式不正 | `{"code":"INVALID_IDEMPOTENCY_KEY","message":"冪等キーが不正です"}` |
| 403 | 役割が「司書」でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |

## 非同期イベント（該当する場合）

### 返却期限リマインド送信要求の再 publish

- **チャネル**: `notification.remind.requested`
- **方向**: publish
- **AsyncAPI**: [asyncapi.yaml](../../_cross-cutting/api/asyncapi.yaml) の `channels.notification.remind.requested` を参照
- **契機**: 再送 API が通知状態を「送信失敗」→「送信待ち」へ遷移させ、トランザクションのコミット後に publish する（arch LP-005）
- **メッセージ**: `RemindNotificationRequested`。`idempotency_key` は再送のたびに再送連番を含めて生成し、前回の送信済み判定と衝突させない。あわせて再送対象の `notification_id` を設定して publish する（worker は既存通知を再利用し INSERT しない）

## データモデル変更

### notifications（情報: 通知 / E-006）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| notification_id | VARCHAR | 通知ID（PK） | 変更なし（参照のみ） |
| notification_type | VARCHAR | 通知種別。一覧の絞り込み軸 | 変更なし（参照のみ） |
| timing_type | VARCHAR | 通知タイミング区分 | 変更なし（参照のみ） |
| recipient_user_no | VARCHAR | 宛先利用者番号 | 変更なし（参照のみ） |
| recipient_email | VARCHAR | 宛先メールアドレス。保管時暗号化。API はマスクして返す | 変更なし（参照のみ） |
| target_loan_id | VARCHAR | 対象貸出ID | 変更なし（参照のみ） |
| send_result | TEXT | 送信結果。再送受付時にクリアせず追記的に保持する | 変更なし（参照のみ） |
| notification_status | VARCHAR | 通知状態。再送で「送信失敗」→「送信待ち」へ更新する | 変更（UPDATE） |

インデックス: `(notification_type, notification_status, requested_at)` の複合インデックスを必要とする（送信実績の絞り込みとサマリ集計のため）。

### loans / users（参照のみ）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loans.due_date | DATE | 一覧に表示する対象貸出の返却期限 | 変更なし（参照のみ） |
| books.title | VARCHAR | 対象貸出の書籍タイトル | 変更なし（参照のみ） |
| users.name | VARCHAR | 司書向け一覧に表示する氏名 | 変更なし（参照のみ） |

## ビジネスルール

- 再送は通知状態が「送信失敗」の通知のみ受け付ける。「送信待ち」「送信済み」は 409 で拒否する（状態.tsv の通知状態: 送信失敗 → 送信待ち の遷移のみ許可）
- 状態遷移の判定と実行はドメイン層で行い、許可外の遷移要求はドメイン例外をスローする（arch LP-009）
- 通知状態の更新と送信要求の publish は同一トランザクションにしない。publish はコミット後に行い、失敗は通知状態で追跡する（arch LP-005）
- レスポンスに宛先メールアドレスの生値を含めない。マスク済みの値のみ返す（NFR E.6.2.1 / arch SR-031）
- 一覧は司書ロール向け API のため利用者の氏名を含めてよい。利用者向け API には本 API のスキーマを流用しない（arch LR-003）
- 再送操作は状態遷移を伴うビジネスイベントとして監査ログに INFO で記録する（誰が・いつ・どの通知を再送したか。arch LP-006）
- 冪等キーは KVS で検証し、既処理なら前回結果を返す（arch LP-007）

## ティア完了条件（BDD）

```gherkin
Feature: リマインドメールを送信する - バックエンド API

  Scenario: 返却期限リマインドの送信実績とサマリを返す
    Given 通知種別「返却期限リマインド」の通知が送信済み 10 件・送信失敗 2 件記録されている
    When 司書トークンで GET /api/v1/staff/notifications?notification_type=返却期限リマインド を呼び出す
    Then HTTP 200 が返り summary.sent が 10、summary.failed が 2 になる

  Scenario: 宛先メールアドレスをマスクして返す
    Given 通知「N-2001」の宛先メールアドレスが「tanaka@example.com」である
    When 司書トークンで GET /api/v1/staff/notifications?notification_type=返却期限リマインド を呼び出す
    Then items[0].recipient_email_masked が「t***@example.com」になり生のメールアドレスは含まれない

  Scenario: 送信失敗の通知を再送受付する
    Given 通知「N-2001」の通知状態が「送信失敗」である
    When 司書トークンで POST /api/v1/staff/notifications/N-2001/resend を冪等キーつきで呼び出す
    Then HTTP 202 が返り notification_status が「送信待ち」になり notification.remind.requested へメッセージが publish される

  Scenario: 送信済みの通知の再送を拒否する
    Given 通知「N-2002」の通知状態が「送信済み」である
    When 司書トークンで POST /api/v1/staff/notifications/N-2002/resend を呼び出す
    Then HTTP 409 が返り code「NOT_RESENDABLE」が返却される

  Scenario: 同一冪等キーの再送要求を二重処理しない
    Given 冪等キー「11111111-1111-1111-1111-111111111111」で通知「N-2001」の再送が受け付け済みである
    When 同じ冪等キーで POST /api/v1/staff/notifications/N-2001/resend を再度呼び出す
    Then HTTP 202 が返り前回と同じ結果が返され送信要求は追加で publish されない

  Scenario: 存在しない通知の再送を拒否する
    Given 通知「N-9999」が登録されていない
    When 司書トークンで POST /api/v1/staff/notifications/N-9999/resend を呼び出す
    Then HTTP 404 が返り code「NOTIFICATION_NOT_FOUND」が返却される
```
