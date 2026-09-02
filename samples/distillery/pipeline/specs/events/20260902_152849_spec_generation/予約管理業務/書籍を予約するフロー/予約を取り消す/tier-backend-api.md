# 予約を取り消す - バックエンド API 仕様

## 変更概要

予約コンテキスト（BC-004）に予約取消エンドポイントを追加する。予約状態を「キャンセル」へ遷移させ、予約順位決定条件に従って後続予約の予約順位を繰り上げる。対象書籍に有効な予約が残らない場合は、蔵書コンテキスト（BC-001）へ書籍状態の「在庫あり」復帰を依頼する。

## API 仕様

### 予約取消 API

- **メソッド**: POST
- **パス**: `/api/v1/staff/reservations/{reservation_id}/cancel`
- **認証**: Bearer トークン（IdP 発行。API Gateway でトークン検証と粗粒度 RBAC。役割=司書、館内ネットワーク限定 / NFR E.5.3.1）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/reservations/{reservation_id}/cancel.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| reservation_id | string | Yes | 取消対象の予約ID（path） |
| reason | string | No | 取消理由（利用者申し出 / 取置き期限切れ 等の自由記述。監査ログへ記録する） |
| X-Idempotency-Key | string | Yes | 冪等キー（UUID。header。arch SR-002） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| reservation_id | string | 取消した予約ID |
| book_id | string | 対象書籍ID |
| reservation_status | string | 取消後の予約状態（キャンセル） |
| promoted_count | integer | 予約順位を繰り上げた後続予約の件数 |
| book_status | string | 取消後の書籍状態（予約待ち / 在庫あり） |
| cancelled_at | string(date-time) | 取消日時 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | reservation_id の形式不正 | `{"code":"INVALID_REQUEST","message":"予約IDの形式が不正です"}` |
| 401 | トークン未提示・失効 | `{"code":"UNAUTHENTICATED","message":"ログインが必要です"}` |
| 403 | 役割が司書でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |
| 404 | 指定した予約が存在しない | `{"code":"RESERVATION_NOT_FOUND","message":"対象の予約が見つかりません"}` |
| 409 | 予約状態が「貸出済み」 | `{"code":"ALREADY_LENT","message":"この予約はすでに貸出済みのため取り消せません"}` |
| 409 | 予約状態が「キャンセル」かつ別の冪等キーでの再取消 | `{"code":"ALREADY_CANCELLED","message":"この予約はすでにキャンセル済みです"}` |

同一 `X-Idempotency-Key` の再送は、初回の取消結果（HTTP 200・同一の `promoted_count` / `book_status` / `cancelled_at`）をそのまま返し、`reservations` を再更新しない（UC「予約を登録する」と同じ冪等再送方針。arch SR-002）。409 `ALREADY_CANCELLED` は、初回と異なる冪等キーでキャンセル済み予約の取消を要求された場合に限定する。

## 非同期イベント（該当する場合）

この UC では非同期イベントを発行しない。取消により次順位者への取置きが必要になった場合の通知は、UC「予約順1位の利用者を特定する」「取置き通知メールを送信する」の責務とする。

## データモデル変更

### reservations（情報: 予約 / E-005）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_status | VARCHAR | 予約状態。対象予約を「キャンセル」へ更新する | 変更 |
| priority | INT | 予約順位。同一書籍の後続予約を 1 つ繰り上げる | 変更 |
| hold_expires_at | TIMESTAMP | 取置き期限。取置き中の予約を取り消す場合は NULL へ戻す | 変更 |

### books（情報: 書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_status | VARCHAR | 書籍状態。有効な予約が残らない場合「予約待ち」から「在庫あり」へ更新する | 変更 |

`books` の更新は蔵書コンテキスト（BC-001）が所有するため、予約コンテキストから直接テーブルを更新せず、蔵書コンテキストの公開インターフェース（BookStatusPort）経由で依頼する（arch CLR-002 モジュール間の直接データアクセス禁止）。

## ビジネスルール

- 取消可能な予約状態は「予約中」「取置き中」に限る。「貸出済み」「キャンセル」は取消不可とする
- 予約順位決定条件: キャンセルとなった予約は順位の対象から除外し、同一書籍で予約状態が「予約中」「取置き中」かつ取消対象より大きい予約順位を持つ予約の予約順位を 1 減算する
- 取置き中の予約を取り消した場合は `hold_expires_at` を NULL に戻し、次順位者への取置きへ引き継げる状態にする
- 対象書籍に予約状態が「予約中」「取置き中」の予約が残らない場合のみ、書籍状態を「予約待ち」から「在庫あり」へ戻す。書籍状態が「貸出中」の場合は変更しない
- 予約状態の更新・順位の繰り上げ・書籍状態の更新は単一トランザクションで実行する
- 取消操作は操作者（司書の利用者番号）と理由を監査ログへ記録する（arch CLR-009 / CLR-004 構造化ログの必須フィールド）

## ティア完了条件（BDD）

```gherkin
Feature: 予約を取り消す - バックエンド API

  Scenario: 予約中の予約取消が 200 を返し後続順位を繰り上げる
    Given 書籍 B-0001 に priority 1(R-0007) / 2(R-0008) / 3(R-0009) の「予約中」予約が存在する
    And 役割が司書のアクセストークンを保持している
    When POST /api/v1/staff/reservations/R-0007/cancel を送信する
    Then HTTP 200 が返り reservation_status が「キャンセル」である
    And promoted_count が 2 である
    And R-0008 の priority が 1、R-0009 の priority が 2 へ更新される

  Scenario: 最後の有効予約を取り消すと書籍状態が在庫ありへ戻る
    Given 書籍 B-0002 の book_status が「予約待ち」で有効な予約は R-0100（取置き中）のみである
    When POST /api/v1/staff/reservations/R-0100/cancel を送信する
    Then HTTP 200 が返り book_status が「在庫あり」である
    And R-0100 の hold_expires_at が NULL へ更新される

  Scenario: 貸出済みの予約取消が 409 を返す
    Given 予約 R-0200 の reservation_status が「貸出済み」
    When POST /api/v1/staff/reservations/R-0200/cancel を送信する
    Then HTTP 409 が返り code が ALREADY_LENT である
    And reservations は更新されない

  Scenario: 役割が利用者のトークンでは取消できない
    Given 役割が利用者のアクセストークンを保持している
    When POST /api/v1/staff/reservations/R-0007/cancel を送信する
    Then HTTP 403 が返り code が FORBIDDEN である
    And reservations は更新されない
```
