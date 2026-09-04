# 延滞一覧を参照する - Backend API仕様

## 変更概要

貸出コンテキスト（BC-003）に延滞貸出の一覧 API `GET /api/v1/loans?status=OVERDUE` を追加し、通知コンテキスト（BC-005）に貸出別通知記録 API `GET /api/v1/loans/{loanId}/notifications` を追加する。利用者（BC-002）・書籍（BC-001）・通知（BC-005）の属性は各 BC の公開インタフェース経由で取得する（LR-003）。個人情報（利用者・通知）を返すため司書限定の厳格認可とデータアクセス監査ログを必須とする（SP-016 / SR-010）。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 貸出一覧取得（延滞絞り込み）

- **メソッド**: GET
- **パス**: `/api/v1/loans`
- **認証**: Bearer（IdP 発行アクセストークン）。利用者区分 = 司書 のみ許可（LP-003 / LP-007）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans.get` を参照

`/api/v1/loans` は UC「利用者の利用状況を参照する」と共有するリソース。本 UC は `status=OVERDUE` の絞り込みと督促状況の付与（`include=latestNotice`）を定義する。

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| status | string (query) | Yes（本 UC） | 貸出の状態 enum: `ON_LOAN`（貸出中）/ `OVERDUE`（延滞）/ `RETURNED`（返却済み）。本 UC は `OVERDUE`（延滞） |
| userNumber | string (query) | No | 利用者番号で絞り込み |
| include | string (query) | No | `latestNotice` を指定すると最新の督促通知と督促回数を付与する（本 UC は指定） |
| sort | string (query) | No | `dueDate`（既定。返却期限昇順）/ `overdueDays`（延滞日数降順）/ `lastNotice`（最終督促日時降順） |
| page | integer (query) | No | ページ番号（1 始まり）。既定 1 |
| pageSize | integer (query) | No | 1 ページの件数。既定 20、上限 100 |

#### レスポンス

`OverdueLoanListResponse`

| フィールド | 型 | 説明 |
|-----------|---|------|
| summary.overdueCount | integer | 延滞件数（絞り込みに依らず全体） |
| summary.noticeFailedCount | integer | 最新督促が失敗の延滞件数 |
| summary.noticePendingCount | integer | 督促が未送信または送信待ちの延滞件数 |
| items[].loanId | string | 貸出 ID |
| items[].book.bookId / title | string | 書籍 |
| items[].user.userNumber / name / email | string | 延滞者（email は個人情報。クライアントでマスク表示） |
| items[].loanedOn | string (date) | 貸出日 |
| items[].dueDate | string (date) | 返却期限 |
| items[].overdueDays | integer | 延滞日数（今日 − 返却期限） |
| items[].status | string | 貸出の状態（`OVERDUE`: 延滞） |
| items[].latestNotice | object \| null | 最新の督促通知 {notificationId, requestedOn, sentAt, sendResult, failureReason} |
| items[].noticeCount | integer | 督促回数 |
| page / pageSize / totalCount | integer | ページネーション |

#### エラーレスポンス

`application/problem+json`（RFC 9457）+ 業務エラーコード

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | status / sort / include が enum 外、page < 1、pageSize が 1〜100 外 | `{code: "VALIDATION_ERROR", errors[{field, reason}]}` |
| 401 | トークン未提示 / 無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が司書でない | `{code: "FORBIDDEN"}`（監査ログに deny を記録） |

### 貸出別通知記録取得

- **メソッド**: GET
- **パス**: `/api/v1/loans/{loanId}/notifications`
- **認証**: Bearer。利用者区分 = 司書 のみ
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/loans/{loanId}/notifications.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| loanId | string (path) | Yes | 貸出 ID |

#### レスポンス

`NotificationLogResponse`

| フィールド | 型 | 説明 |
|-----------|---|------|
| items[].notificationId | string | 通知 ID |
| items[].notificationType | string | 通知種別 enum: `RETURN_NOTICE`（返却通知）/ `REMINDER`（リマインド）/ `OVERDUE_NOTICE`（督促） |
| items[].recipientEmail | string | 送信先メールアドレス（作成時点のコピー。クライアントでマスク） |
| items[].requestedOn | string (date) | 送信予定日 |
| items[].sentAt | string (date-time) \| null | 送信日時 |
| items[].sendResult | string | 送信結果 enum: `PENDING`（送信待ち）/ `SUCCEEDED`（成功）/ `FAILED`（失敗）/ `SKIPPED`（スキップ） |
| items[].failureReason | string \| null | 失敗理由コード |

件名・本文は返さない（個人情報最小化）。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | トークン未提示 / 無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が司書でない | `{code: "FORBIDDEN"}` |
| 404 | 貸出が存在しない | `{code: "LOAN_NOT_FOUND"}` |

## 非同期イベント（該当する場合）

なし（送信結果はワーカー UC「督促を送信する」「リマインドを送信する」が通知レコードに反映済み）。

## データモデル変更

### loans（情報: 貸出）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| current_status | VARCHAR(16) | 貸出の状態。本 UC は `OVERDUE`（延滞）で絞り込む | 変更なし |
| due_date | DATE | 返却期限。並び順と延滞日数の算出 | 変更なし |
| INDEX(current_status, due_date) | — | 延滞 × 返却期限順のページング（UC「リマインド対象を抽出する」で追加済み） | 変更なし |
| INDEX(user_number, current_status) | — | 利用者番号絞り込み | 追加 |

### notifications（情報: 通知）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| target_loan_id / notification_type / requested_on | — | 貸出別の最新督促の特定（UNIQUE 定義済み） | 変更なし |
| send_result / sent_at / failure_reason | — | 送信状況の表示 | 変更なし（UC「リマインドを送信する」で定義） |

### users / books

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| users.name / email | VARCHAR | 延滞者の表示（email は保管時暗号化対象） | 変更なし |
| books.title | VARCHAR | 延滞書籍の表示 | 変更なし |

## ビジネスルール

- 条件「延滞判定」の状態遷移は UC「延滞を判定する」の責務。本 UC は貸出の状態 = 延滞 を参照し、延滞日数 = 今日 − 返却期限 を domain `Loan.overdueDays(today)` で算出する
- 督促の送信状況は通知種別 = 督促 の最新（requested_on 最大）レコードから導く。未送信 / 送信待ち / 成功 / 失敗 / スキップ を区別して返す（LP-024: 恒久失敗を司書が確認できる状態にする）
- 司書限定。利用者区分 = 利用者 のアクセスは 403 とし、監査ログに deny を記録する（LP-007）。許可時も貸出・利用者・通知の参照をデータアクセス監査ログ（actor、操作種別、対象 ID 群）に記録する。値（氏名・連絡先）は記録しない（SR-010）
- 一覧はページネーション必須（既定 20、上限 100、totalCount を返す）。並びは返却期限昇順・貸出 ID 昇順で安定させる
- 通知の件名・本文は API で返さない。送信先メールアドレスは返すが、ログ出力しない（CLR-006）
- DB アクセスはパラメータ化クエリ（LR-013）。応答 5 秒以内（NFR B.2.1.1）

## ティア完了条件（BDD）

```gherkin
Feature: 延滞一覧を参照する - Backend API

  Scenario: 延滞貸出を督促状況つきで返す
    Given 司書「S-0001」のアクセストークンを持ち、今日が 2026-09-03 である
    And loans に loan_id=L-2001, user_number=U-0001, book_id=B-001, due_date=2026-08-30, current_status=OVERDUE の行がある
    And notifications に target_loan_id=L-2001, notification_type=OVERDUE_NOTICE, requested_on=2026-09-01, send_result=SUCCEEDED, sent_at=2026-09-01T00:10:00Z の行がある
    When GET /api/v1/loans?status=OVERDUE&include=latestNotice&page=1&pageSize=20 を呼ぶ
    Then HTTP 200 で items[0] が {loanId: "L-2001", overdueDays: 4, status: "OVERDUE", noticeCount: 1} で latestNotice.sendResult が "SUCCEEDED" である
    And summary が {overdueCount: 1, noticeFailedCount: 0, noticePendingCount: 0} である
    And 監査ログに actor=S-0001, action=READ_LOANS, targets=[L-2001], result=allow が記録される

  Scenario: 督促未送信の延滞は latestNotice が null になる
    Given 司書「S-0001」のアクセストークンを持つ
    And loans に current_status=OVERDUE の loan_id=L-2003 があり notifications に督促の行が無い
    When GET /api/v1/loans?status=OVERDUE&include=latestNotice を呼ぶ
    Then items の L-2003 の latestNotice が null、noticeCount が 0 で summary.noticePendingCount が 1 である

  Scenario: 貸出別の通知記録を新しい順に返す
    Given 司書「S-0001」のアクセストークンを持つ
    And notifications に target_loan_id=L-2001 の行がリマインド（2026-08-27）、督促（2026-08-31）、督促（2026-09-01）の 3 件ある
    When GET /api/v1/loans/L-2001/notifications を呼ぶ
    Then HTTP 200 で items が 3 件、items[0].requestedOn が "2026-09-01" である
    And レスポンスに subject / body は含まれない

  Scenario: 利用者区分が利用者なら 403 を返す
    Given 利用者「U-0001」（利用者区分: 利用者）のアクセストークンを持つ
    When GET /api/v1/loans?status=OVERDUE を呼ぶ
    Then HTTP 403 と problem+json {code: "FORBIDDEN"} が返り、監査ログに result=deny が記録される
```
