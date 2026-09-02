# 自分の貸出履歴を照会する - バックエンド API 仕様

## 変更概要

BC-003（貸出コンテキスト）モジュールに本人の貸出履歴を返す Query ユースケースを追加する。`GET /api/v1/me/loans` の `status=history` として実現し、返却済みの貸出を返す。返却日は返却登録時に設定される `loans.returned_at` を直接参照する。

## API 仕様

### 本人の貸出一覧取得 API（貸出履歴）

- **メソッド**: GET
- **パス**: `/api/v1/me/loans`
- **認証**: IdP 発行の Bearer トークン。認証コンテキストの利用者番号が参照対象を決める
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/loans.get`（`status=history`）を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| status | string | Yes | 抽出区分。本 UC では `history`（返却済み） |
| page | integer | No | 頁番号。既定 1、最小 1 |
| per_page | integer | No | 頁あたり件数。既定 20、最大 100 |

利用者番号を受け取るパラメータは定義しない（本人限定参照の担保）。

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| items[].loan_id | string | 貸出ID |
| items[].book_id | string | 書籍ID |
| items[].book_title | string | 書籍のタイトル |
| items[].book_author | string | 書籍の著者 |
| items[].loan_date | string(date) | 貸出日 |
| items[].loan_period_type | string | 貸出期間区分（標準 / 短期 / 長期） |
| items[].due_date | string(date) | 返却期限 |
| items[].returned_date | string(date) | 返却日。返却登録イベントの occurred_at からの射影 |
| items[].loan_status | string | 貸出状態。本 UC では常に「返却済み」 |
| total | integer | 総件数 |
| page | integer | 現在頁 |
| per_page | integer | 頁あたり件数 |

並び順は返却日の降順（新しい順）とする。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `status` が許容値外、`page` < 1、`per_page` > 100 | `{"code":"VALIDATION_ERROR","message":"リクエストパラメータが不正です","details":[...]}` |
| 401 | トークンが無効・期限切れ | `{"code":"UNAUTHORIZED","message":"再度ログインしてください"}` |
| 403 | 認証コンテキストに利用者番号が無い | `{"code":"FORBIDDEN","message":"この操作を行う権限がありません"}` |
| 500 | 技術例外 | `{"code":"INTERNAL_ERROR","message":"処理に失敗しました"}` |

## 非同期イベント（該当する場合）

なし（照会 UC のため publish/subscribe は発生しない）。

## データモデル変更

### loans（貸出 / E-004 のスナップショット）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loan_id | VARCHAR(36) | 貸出ID（PK） | 変更なし（参照のみ） |
| book_id | VARCHAR(20) | 書籍ID | 変更なし |
| user_no | VARCHAR(20) | 利用者番号。抽出キー | 変更なし |
| loan_date | DATE | 貸出日 | 変更なし |
| loan_period_type | VARCHAR(10) | 貸出期間区分 | 変更なし |
| due_date | DATE | 返却期限 | 変更なし |
| loan_status | VARCHAR(10) | 貸出状態。「返却済み」を抽出する | 変更なし |
| returned_at | DATE | 返却日。降順ソートキー | 変更なし（参照のみ） |

### books（書籍 / E-001 のスナップショット。BC-001 経由で参照）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR(20) | 書籍ID（PK） | 変更なし（参照のみ） |
| title | VARCHAR(255) | タイトル | 変更なし |
| author | VARCHAR(255) | 著者 | 変更なし |

必要なインデックス: `loans(user_no, loan_status, returned_at)`、`books(book_id)`（PK）。

## ビジネスルール

- 個人情報参照可否条件: 参照範囲はログイン中の利用者本人の貸出のみ。API のインターフェース上、他の利用者番号を指定する手段を提供しない。
- 所有者ベースの認可判定（LP-011）: domain 層で、抽出条件の利用者番号が認証コンテキストの利用者番号と一致することを強制する。
- 貸出履歴の定義: 貸出状態が「返却済み」の貸出を対象とする。返却済みの貸出は進行中の取引ではなくなり、過去の貸出履歴と貸出統計の集計対象として保持される（状態.tsv: 貸出状態）。
- 返却日の取得: 返却登録時に設定される `loans.returned_at` をそのまま返す。返却済みの貸出では NULL にならない。
- 貸出履歴は思想信条を推知しうる機微情報であるため、レスポンスに他利用者の情報を含めず、ログにも書籍タイトル・氏名を出力しない（NFR E.1.2.1 / LP-024 相当）。
- Command / Query の分離（LP-008）: 本 UC は Query。repository の読み取り専用 finder を使う。
- ページネーション: 既定 20 件/頁。全件返却は行わない（NFR B.1.1.1 / B.1.2.1）。
- 監査ログ（LP-006）: 本人限定参照の照会として「誰が・いつ・本人の貸出履歴を照会したか」を INFO で記録する。
- キャッシュ制御: `Cache-Control: no-store` を付与し、ブラウザ側に履歴を残さない（CLR-008）。
- レスポンスタイム: 5 秒以内（NFR B.2.1.1）。

## ティア完了条件（BDD）

```gherkin
Feature: 自分の貸出履歴を照会する - バックエンド API

  Scenario: 返却済みの貸出だけが返る
    Given 利用者「U-000123」に貸出状態「返却済み」2 件・「貸出中」1 件の貸出がある
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me/loans?status=history を実行する
    Then HTTP 200 が返る
    And items の件数が 2 である
    And 全 items の loan_status が「返却済み」である

  Scenario: 返却日がイベントから射影される
    Given 貸出「L-0001」の LOAN_RETURNED イベントの occurred_at が「2026-08-14T10:00:00+09:00」である
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me/loans?status=history を実行する
    Then 該当 item の returned_date が「2026-08-14」である

  Scenario: 返却日の降順で返る
    Given 利用者「U-000123」に返却日「2026-08-14」と「2026-07-01」の返却済み貸出がある
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me/loans?status=history を実行する
    Then items[0].returned_date が「2026-08-14」である
    And items[1].returned_date が「2026-07-01」である

  Scenario: 20 件/頁で分割される
    Given 利用者「U-000123」に返却済みの貸出が 25 件ある
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me/loans?status=history&page=2&per_page=20 を実行する
    Then items の件数が 5 である
    And total が 25 である

  Scenario: 他人の貸出履歴は返らない
    Given 利用者「U-000200」に返却済みの貸出がある
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me/loans?status=history を実行する
    Then レスポンスに利用者「U-000200」の貸出が含まれない

  Scenario: トークンが無効なら 401 になる
    Given 期限切れのトークンを保持している
    When GET /api/v1/me/loans?status=history を実行する
    Then HTTP 401 が返る
    And code が「UNAUTHORIZED」である
```
