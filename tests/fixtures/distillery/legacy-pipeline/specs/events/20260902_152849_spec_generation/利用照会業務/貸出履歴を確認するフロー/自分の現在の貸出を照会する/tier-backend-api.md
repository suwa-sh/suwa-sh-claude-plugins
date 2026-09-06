# 自分の現在の貸出を照会する - バックエンド API 仕様

## 変更概要

BC-003（貸出コンテキスト）モジュールに本人の現在の貸出を返す Query ユースケースを追加する。参照対象は認証コンテキストの利用者番号に固定し、リクエストで利用者番号を受け取らない。書籍のタイトル・著者は BC-001（蔵書コンテキスト）の公開インターフェース経由で取得する（CLR-007 モジュール間の直接データアクセス禁止）。

## API 仕様

### 本人の貸出一覧取得 API（現在の貸出）

- **メソッド**: GET
- **パス**: `/api/v1/me/loans`
- **認証**: IdP 発行の Bearer トークン。認証コンテキストの利用者番号が参照対象を決める
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/me/loans.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| status | string | Yes | 抽出区分。許容値: `current`（貸出中 / 延滞）、`history`（返却済み）。本 UC では `current` |
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
| items[].loan_status | string | 貸出状態（貸出中 / 延滞） |
| items[].days_remaining | integer | 返却期限までの残日数。負値は超過日数を表す |
| total | integer | 総件数 |
| page | integer | 現在頁 |
| per_page | integer | 頁あたり件数 |

並び順は返却期限の昇順（期限が近い順）とする。

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
| book_id | VARCHAR(20) | 貸出対象の書籍ID | 変更なし |
| user_no | VARCHAR(20) | 貸出先の利用者番号。抽出キー | 変更なし |
| loan_date | DATE | 貸出日 | 変更なし |
| loan_period_type | VARCHAR(10) | 貸出期間区分 | 変更なし |
| due_date | DATE | 返却期限。並び順と残日数の算出に使う | 変更なし |
| loan_status | VARCHAR(10) | 貸出状態。「貸出中」「延滞」を抽出する | 変更なし |

### books（書籍 / E-001 のスナップショット。BC-001 経由で参照）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR(20) | 書籍ID（PK） | 変更なし（参照のみ） |
| title | VARCHAR(255) | タイトル | 変更なし |
| author | VARCHAR(255) | 著者 | 変更なし |

必要なインデックス: `loans(user_no, loan_status, due_date)`、`books(book_id)`（PK）。

## ビジネスルール

- 個人情報参照可否条件: 参照対象はログイン中の利用者本人に紐づく貸出のみ。API のインターフェース上、他の利用者番号を指定する手段を提供しない。
- 所有者ベースの認可判定（LP-011）: domain 層で、抽出条件の利用者番号が認証コンテキストの利用者番号と一致することを強制する。
- 現在の貸出の定義: 貸出状態が「貸出中」または「延滞」の貸出を対象とする。「返却済み」は貸出履歴（`status=history`）の対象であり、本 UC では返さない。
- 残日数の算出: `days_remaining = due_date - 現在日`（日単位）。負値は超過日数を表す。延滞への状態遷移そのものは日次バッチ（「期限超過の貸出を延滞にする」UC）が行い、本 API は状態を変更しない。
- レスポンスの PII 最小化（LR-003）: 利用者向け API は本人の貸出のみを返し、利用者の氏名・連絡先を含めない。
- Command / Query の分離（LP-008）: 本 UC は Query。repository の読み取り専用 finder を使う。
- ページネーション: 既定 20 件/頁（NFR B.1.1.1 に対する design 決定に合わせる）。
- 監査ログ（LP-006）: 本人限定参照の照会として「誰が・いつ・本人の現在の貸出を照会したか」を INFO で記録する。書籍タイトルや氏名はログに出力しない。
- キャッシュ制御: `Cache-Control: no-store` を付与し、ブラウザ側に個人情報を残さない（CLR-008）。
- レスポンスタイム: 5 秒以内（NFR B.2.1.1）。

## ティア完了条件（BDD）

```gherkin
Feature: 自分の現在の貸出を照会する - バックエンド API

  Scenario: 貸出中・延滞の貸出だけが返る
    Given 利用者「U-000123」に貸出状態「貸出中」1 件・「延滞」1 件・「返却済み」1 件の貸出がある
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me/loans?status=current を実行する
    Then HTTP 200 が返る
    And items の件数が 2 である
    And 全 items の loan_status が「貸出中」または「延滞」である

  Scenario: 返却期限の昇順で返る
    Given 利用者「U-000123」に返却期限「2026-09-20」と「2026-09-10」の貸出がある
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me/loans?status=current を実行する
    Then items[0].due_date が「2026-09-10」である
    And items[1].due_date が「2026-09-20」である

  Scenario: 超過分は残日数が負値になる
    Given 利用者「U-000123」に返却期限「2026-08-30」・貸出状態「延滞」の貸出がある
    And 現在日が「2026-09-02」である
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me/loans?status=current を実行する
    Then items[0].days_remaining が -3 である

  Scenario: 他人の貸出は返らない
    Given 利用者「U-000200」に貸出状態「貸出中」の貸出がある
    And 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me/loans?status=current を実行する
    Then レスポンスに利用者「U-000200」の貸出が含まれない

  Scenario: 許容外の status で 400 になる
    Given 利用者「U-000123」のトークンを保持している
    When GET /api/v1/me/loans?status=all を実行する
    Then HTTP 400 が返る
    And code が「VALIDATION_ERROR」である

  Scenario: トークンが無効なら 401 になる
    Given 期限切れのトークンを保持している
    When GET /api/v1/me/loans?status=current を実行する
    Then HTTP 401 が返る
    And code が「UNAUTHORIZED」である
```
