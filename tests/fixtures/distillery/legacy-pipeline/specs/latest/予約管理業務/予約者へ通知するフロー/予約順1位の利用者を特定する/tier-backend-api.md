# 予約順1位の利用者を特定する - バックエンド API 仕様

## 変更概要

通知コンテキスト（BC-005）に、取置き通知対象条件を評価して取置き候補を返す照会エンドポイントを追加する。予約コンテキスト（BC-004）の予約と利用者コンテキスト（BC-002）の利用者は、各コンテキストの公開インターフェース経由で取得する（arch CLR-002）。

## API 仕様

### 取置き候補照会 API

- **メソッド**: GET
- **パス**: `/api/v1/staff/books/{book_id}/hold-candidate`
- **認証**: Bearer トークン（IdP 発行。API Gateway でトークン検証と粗粒度 RBAC。役割=司書、館内ネットワーク限定 / NFR E.5.3.1）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/books/{book_id}/hold-candidate.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| book_id | string | Yes | 取置き対象を特定する書籍ID（path） |
| reveal_contact | boolean | No | 宛先メールアドレスを開示するか（既定 false。true の場合は開示操作として監査ログへ記録する） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| book_id | string | 書籍ID |
| book_title | string | 書籍タイトル |
| book_status | string | 書籍状態（予約待ち / 在庫あり / 貸出中） |
| notifiable | boolean | 取置き通知対象条件を満たすか |
| reason_condition | string | notifiable が false の場合の根拠条件名（取置き通知対象条件 等） |
| candidate | object | 取置き候補。存在しない場合は null |
| candidate.reservation_id | string | 候補の予約ID |
| candidate.priority | integer | 予約順位（1） |
| candidate.reservation_status | string | 予約状態（予約中） |
| candidate.applied_at | string(date-time) | 予約申込日時 |
| candidate.user_no | string | 取置き対象者の利用者番号 |
| candidate.user_name | string | 氏名 |
| candidate.user_category | string | 利用者区分（一般 / 学生 / 団体） |
| candidate.user_email_masked | string | マスク済み宛先メールアドレス（例: `t***@example.com`）。常に返す |
| candidate.user_email | string | 平文の宛先メールアドレス。`reveal_contact=true` のときのみ設定し、既定では返さない |
| remaining_count | integer | 候補を除く「予約中」予約の残件数 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | book_id の形式不正 | `{"code":"INVALID_REQUEST","message":"書籍IDの形式が不正です"}` |
| 401 | トークン未提示・失効 | `{"code":"UNAUTHENTICATED","message":"ログインが必要です"}` |
| 403 | 役割が司書でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |
| 404 | 指定した書籍が存在しない | `{"code":"BOOK_NOT_FOUND","message":"対象の書籍が見つかりません"}` |

候補が存在しない場合はエラーではなく、`candidate=null` の 200 を返す。

### 予約待ち書籍一覧 API

取置き候補照会の対象 `book_id` を司書へ提示するための一覧エンドポイント。

- **メソッド**: GET
- **パス**: `/api/v1/staff/holds/pending-books`
- **認証**: Bearer トークン（IdP 発行。API Gateway でトークン検証と粗粒度 RBAC。役割=司書、館内ネットワーク限定 / NFR E.5.3.1）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/staff/holds/pending-books.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| page | integer | No | ページ番号（query。既定 1） |
| size | integer | No | 1 ページあたり件数（query。既定 20） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items[].book_id | string | 書籍ID。取置き候補照会 API の path パラメータに用いる |
| items[].book_title | string | 書籍タイトル |
| items[].book_status | string | 書籍状態（予約待ち） |
| items[].waiting_count | integer | 予約状態が「予約中」の予約件数 |
| total | integer | 予約待ち書籍の総件数 |
| page | integer | 現在のページ番号 |
| size | integer | 1 ページあたり件数 |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 401 | トークン未提示・失効 | `{"code":"UNAUTHENTICATED","message":"ログインが必要です"}` |
| 403 | 役割が司書でない | `{"code":"FORBIDDEN","message":"この操作は司書のみ実行できます"}` |

個人情報は返さない（書籍単位の集計のみ。arch SP-004）。

## 非同期イベント（該当する場合）

この UC では非同期イベントを発行しない。取置き案内メール送信依頼の発行は UC「取置き通知メールを送信する」の責務とする。

## データモデル変更

### reservations（情報: 予約 / E-005）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| reservation_id / book_id / user_no / applied_at / priority / reservation_status | VARCHAR / TIMESTAMP / INT | 取置き候補の抽出に参照する | 参照のみ |

### books（情報: 書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id / title / book_status | VARCHAR | 取置き通知対象条件の判定に参照する | 参照のみ |

### users（情報: 利用者 / E-002）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_no / name / user_category | VARCHAR | 取置き対象者の表示に参照する | 参照のみ |
| email | VARCHAR | 宛先メールアドレス。保管時暗号化（NFR E.6.1.1）から復号し、既定はマスクして返す | 参照のみ |

本 UC は参照のみで、テーブルの更新は行わない。

## ビジネスルール

- 取置き通知対象条件: 書籍状態が「予約待ち」となった書籍について、予約順1位かつ予約状態が「予約中」の予約 1 件を取置き通知の対象とする
- 予約順位決定条件: 予約状態が「予約中」の予約のうち予約順位が最小の 1 件を候補とする。「取置き中」「貸出済み」「キャンセル」は候補にしない
- 書籍状態が「予約待ち」でない場合は `notifiable=false` とし、`reason_condition` に「取置き通知対象条件」を設定する
- 候補が存在しない場合も `notifiable=false` とし、`candidate=null` を返す
- 宛先メールアドレスは既定でマスクして返す。`reveal_contact=true` の場合のみ平文で返し、開示操作を監査ログへ記録する（NFR E.1.2.1 / arch CLR-009）
- 予約・利用者は他コンテキストの所有データであるため、公開インターフェース経由で取得し、テーブルを直接結合しない（arch CLR-002）

## ティア完了条件（BDD）

```gherkin
Feature: 予約順1位の利用者を特定する - バックエンド API

  Scenario: 予約待ちの書籍で予約順1位の候補が返る
    Given 書籍 B-0001 の book_status が「予約待ち」
    And 書籍 B-0001 に priority 1 の「予約中」予約 R-0007（user_no U-0001）と priority 2 の「予約中」予約 R-0008 が存在する
    And 役割が司書のアクセストークンを保持している
    When GET /api/v1/staff/books/B-0001/hold-candidate を送信する
    Then HTTP 200 が返り notifiable が true である
    And candidate.reservation_id が R-0007、candidate.user_no が U-0001 である
    And remaining_count が 1 である

  Scenario: 予約中の予約が無い場合は candidate が null で返る
    Given 書籍 B-0002 の book_status が「予約待ち」
    And 書籍 B-0002 の予約はすべて reservation_status が「キャンセル」である
    When GET /api/v1/staff/books/B-0002/hold-candidate を送信する
    Then HTTP 200 が返り candidate が null である
    And notifiable が false である

  Scenario: 在庫ありの書籍では notifiable が false になる
    Given 書籍 B-0003 の book_status が「在庫あり」
    When GET /api/v1/staff/books/B-0003/hold-candidate を送信する
    Then HTTP 200 が返り notifiable が false である
    And reason_condition が「取置き通知対象条件」である

  Scenario: 連絡先は既定でマスクして返る
    Given 書籍 B-0001 の取置き候補が利用者番号 U-0001 である
    When GET /api/v1/staff/books/B-0001/hold-candidate を reveal_contact 指定なしで送信する
    Then candidate.user_email_masked が t***@example.com で返る
    And candidate.user_email は返らない（未設定）
    And 監査ログに開示操作は記録されない
```
