# 利用者の利用状況を参照する - Backend API仕様

## 変更概要

利用者コンテキスト（BC-002）に司書向けの利用状況照会 API（`/api/v1/users/{userNumber}/usage`）を追加する。貸出コンテキスト・予約コンテキストの公開インタフェース（LR-003）を経由して貸出・予約を集約し、連絡先は既定でマスクして返す。`reveal=true` の開示要求はデータアクセス監査ログに明示記録する（SP-016 / SR-010 / NFR E.1.2.1）。

## API 仕様

### 利用者の利用状況照会

- **メソッド**: GET
- **パス**: `/api/v1/users/{userNumber}/usage`
- **認証**: Bearer（IdP 発行トークン）、利用者区分「司書」必須
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users/{userNumber}/usage.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| userNumber | string (path) | Yes | 利用者番号 |
| loanScope | string (query) | No | `current`（貸出中・延滞。既定）/ `history`（返却済み）/ `all` |
| includeClosedReservations | boolean (query) | No | 取消・終了の予約を含めるか（既定 false） |
| reveal | boolean (query) | No | 連絡先を平文で返すか（既定 false。true は監査ログに開示を記録） |

#### レスポンス（200 `UserUsageResponse`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| user | UserUsageProfile | userNumber, name, userType（`STAFF`（司書） / `PATRON`（利用者））, emailMasked, phoneMasked, addressMasked。`reveal=true` のとき email, phone, address も返す |
| loans | MyLoanItem[] | loanId, book, loanedOn, dueDate, returnedOn, status, remainingDays, dueStatus（UC「貸出履歴を参照する」と同じ型） |
| reservations | MyReservationItem[] | reservationId, book, acceptedAt, queuePosition, totalWaiting, status, notifiedAt, cancelledAt, canCancel（UC「予約状況を参照する」と同じ型） |
| summary | UsageSummary | onLoanCount（貸出中）, overdueCount（延滞）, activeReservationCount（予約中・通知済み） |
| today | string (date) | サーバ基準日 |
| remindDays | integer | 現行のリマインド日数 |

貸出・予約は窓口での即答用途のためページネーションしない（1 利用者あたりの件数は小さい。上限 200 件を超える場合は `loanScope` で絞る）。

#### エラーレスポンス（`application/problem+json`）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | userNumber 形式不正 / loanScope 不正 | `{code: "VALIDATION_ERROR", errors: [{field, message}]}` |
| 401 | トークン無し・無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が司書でない | `{code: "FORBIDDEN"}`（監査ログに拒否を記録） |
| 404 | 利用者が存在しない | `{code: "USER_NOT_FOUND"}` |

## データモデル変更

### users（利用者 E-003）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_number / name / email / phone / address / user_type | — | 利用者要約と連絡先（参照のみ。連絡先は既定マスク） | 参照のみ |

### loans（貸出 E-004）/ loan_events

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loans.user_number / current_status / loaned_on / due_date / book_id | — | 利用者の貸出（参照のみ） | 参照のみ |
| loan_events.event_type / occurred_at | — | 返却日の導出（参照のみ） | 参照のみ |

### reservations（予約 E-007）/ reservation_events

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservations.user_number / current_status / queue_position / accepted_at / book_id | — | 利用者の予約と書籍ごとの待ち人数（参照のみ） | 参照のみ |
| reservation_events.event_type / occurred_at | — | 通知日時・取消日時の導出（参照のみ） | 参照のみ |

### books（書籍 E-001）/ remind_days_settings（リマインド日数 E-006）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| books.title / author / media_type / current_status | — | 書籍要約（参照のみ） | 参照のみ |
| remind_days_settings.remind_days / valid_from / valid_to | — | 現行世代（参照のみ） | 参照のみ |

### audit_logs（監査ログ E-902）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| action_type / target_entity / target_id / result | — | データ参照（E-003 / E-004 / E-007、target_id = 利用者番号）。`reveal=true` は「連絡先開示」を付記して記録 | 追加（本 UC で INSERT） |

## ビジネスルール

- 利用状況閲覧範囲判定: 利用者区分「司書」のみ利用者番号を指定して任意の利用者の利用状況を参照できる。「利用者」は 403 とし監査ログに拒否を記録する（LP-007 / SP-016）
- 連絡先のマスク: 既定は email（先頭 2 文字 + `***@` + ドメイン）、phone（下 4 桁以外 `*`）、address（都道府県のみ）でマスクして返す。`reveal=true` は平文を返し、監査ログにデータ参照 + 連絡先開示を記録する（NFR E.1.2.1 / E.7.1.1）
- 貸出: `loanScope` に応じて貸出の状態で絞る。返却期限昇順（延滞が先頭）。返却日は返却イベントの occurred_at で導出。期限表示区分は UC「貸出履歴を参照する」の DueDatePolicy と同一（現行リマインド日数を使用。LR-004）
- 予約: 既定は有効予約（予約中・通知済み）を通知済み先頭・受付日時降順。`includeClosedReservations=true` で取消・終了を末尾に含める。`totalWaiting` は書籍ごとの有効予約件数。`canCancel` は参考値（司書は本 API から取消しない）
- 集約: 利用者コンテキストの usecase が貸出・予約モジュールの公開インタフェース（読み取りクエリ）を呼ぶ（LR-003 / CM-003 / CM-004）。直接他 BC のテーブルを結合しない
- 応答はページネーションしない。ログに氏名・連絡先を出力しない
- 参照系のため KVS キャッシュの対象にしてよい（LP-017）が、連絡先を含むため `reveal=true` の応答はキャッシュしない。貸出・予約の状態遷移で当該利用者のキャッシュを無効化する

## ティア完了条件（BDD）

```gherkin
Feature: 利用者の利用状況を参照する - Backend API

  Scenario: 司書が利用者の貸出と予約をマスク済み連絡先つきで取得する
    Given 利用者「U-000123」（田中太郎、tanaka@example.com、090-1234-5678）が登録済み
    And 「U-000123」の貸出「L-0001」が「貸出中」（返却期限 2026-09-17）、予約「R-0003」（書籍 B-000789）が順位 3（予約中）で書籍の有効予約が 3 件
    And 現行のリマインド日数が 3 日で本日が 2026-09-10
    When 司書トークンで GET /api/v1/users/U-000123/usage を送る
    Then HTTP 200 で user.name "田中太郎"、user.emailMasked "ta***@example.com"、user.phoneMasked "***-****-5678" が返り user.email は含まれない
    And loans が 1 件（remainingDays 7、dueStatus "OK"）、reservations が 1 件（queuePosition 3、totalWaiting 3）が返る
    And summary が {onLoanCount: 1, overdueCount: 0, activeReservationCount: 1} で返る
    And 監査ログに action_type=データ参照, target_id=U-000123 が記録される

  Scenario: reveal=true で連絡先を平文で返し監査ログに開示を記録する
    Given 利用者「U-000123」が登録済み
    When 司書トークンで GET /api/v1/users/U-000123/usage?reveal=true を送る
    Then HTTP 200 で user.email "tanaka@example.com" が返る
    And 監査ログに連絡先開示（target_id=U-000123）が記録される

  Scenario: 延滞を集計に反映する
    Given 「U-000300」の貸出「L-0003」が「延滞」（返却期限 2026-08-31）で本日が 2026-09-10
    When 司書トークンで GET /api/v1/users/U-000300/usage を送る
    Then HTTP 200 で summary.overdueCount 1、loans[0].dueStatus "OVERDUE"、loans[0].remainingDays -10 が返る

  Scenario: 存在しない利用者は 404 を返す
    Given 利用者「U-999999」が存在しない
    When 司書トークンで GET /api/v1/users/U-999999/usage を送る
    Then HTTP 404 で problem+json の code "USER_NOT_FOUND" が返る

  Scenario: 利用者トークンでは 403 を返す
    Given 利用者区分「利用者」のトークンを持つ
    When GET /api/v1/users/U-000300/usage を送る
    Then HTTP 403 で code "FORBIDDEN" が返り監査ログに result=拒否 が記録される

  Scenario: 履歴を返却日つきで返す
    Given 「U-000123」の貸出「L-0000」が「返却済み」で返却イベントの occurred_at が 2026-08-10 14:00
    When 司書トークンで GET /api/v1/users/U-000123/usage?loanScope=history を送る
    Then HTTP 200 で loans[0].loanId "L-0000"、returnedOn "2026-08-10"、dueStatus "RETURNED" が返る
```
