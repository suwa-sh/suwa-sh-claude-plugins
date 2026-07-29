# 書籍を貸出する - バックエンドAPI仕様

## 変更概要

書籍貸出 API を実装する。貸出可否判定（予約参照を含む）・貸出期限計算・状態遷移（書籍・予約）をトランザクション内で処理する。状態変更APIとして利用者認証ヘッダの検証を行う。

## API 仕様

### 貸出作成 API

- **メソッド**: POST
- **パス**: /api/v1/loans
- **認証**: OAuth2/OIDC（`user` ロール）。認証基盤が正式導入されるまでの暫定契約として、利用者IDを `X-User-Id` ヘッダで受け渡す（下記「認証・アクセス制御」参照）
- **冪等性**: X-Idempotency-Key ヘッダ必須（状態変更を伴う操作）

#### リクエスト

| パラメータ | 位置 | 型 | 必須 | 説明 |
|-----------|------|---|------|------|
| book_id | body | string | Yes | 貸出対象の書籍ID |
| X-User-Id | header | string (uuid) | Yes | 貸出を申請する利用者ID（暫定認証契約。認証基盤導入後は正式なトークン検証に置き換える） |
| X-Idempotency-Key | header | string (uuid) | Yes | 冪等キー |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| id | string | 貸出ID |
| book_id | string | 書籍ID |
| book_title | string | 書籍タイトル |
| user_id | string | 利用者ID |
| loan_date | string | 貸出日（ISO 8601） |
| due_date | string | 返却期限（ISO 8601） |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | book_id未指定 | RFC 7807: detail="book_idは必須です" |
| 401 | 認証ヘッダ（X-User-Id）欠落または不正な値 | RFC 7807: detail="認証が必要です" |
| 404 | 書籍が存在しない | RFC 7807: detail="書籍が見つかりません" |
| 409 | 在庫なし/予約あり | RFC 7807: detail="この書籍は現在貸出できません" |
| 409 | 冪等キー重複 | RFC 7807: detail="このリクエストは既に処理済みです" |

## データモデル変更

### loans テーブル

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| id | UUID | 貸出ID（PK） | 新規 |
| book_id | UUID | 書籍ID（FK → books.id） | 新規 |
| user_id | UUID | 利用者ID（FK → users.id） | 新規 |
| loan_date | DATE | 貸出日 | 新規 |
| due_date | DATE | 返却期限 | 新規 |
| return_date | DATE | 返却日（NULL=未返却） | 新規 |
| is_overdue | BOOLEAN | 延滞フラグ | 新規 |
| idempotency_key | VARCHAR(36) | 冪等キー（UNIQUE） | 新規 |
| created_at | TIMESTAMP | 作成日時 | 新規 |

### books テーブル

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| status | VARCHAR(20) | 'available' → 'on_loan' | 更新 |

### reservations テーブル

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| status | VARCHAR(20) | 貸出可否判定のため参照（SELECT）。予約者本人（予約確保済='reserved'）による貸出成立時は 'fulfilled' に更新（UPDATE） | 参照/更新 |

- SELECT: `WHERE book_id = :book_id AND status IN ('pending', 'reserved')`（貸出可否判定のため、その書籍の予約受付中レコードを取得）
- UPDATE: 取得したレコードのうち `status = 'reserved' AND user_id = :user_id`（申請者本人の予約確保済レコード）に該当するものを `status = 'fulfilled'` に更新

## ビジネスルール

- **貸出可否判定ルール**: 書籍の status が "available" であることに加え、その書籍に対する予約受付中の予約がない場合に貸出可能。ただし予約者本人（予約確保済）の場合は貸出可能
- **予約状態ラベルとreservations.statusの対応関係**（本UCが参照する範囲）:
  - 「予約受付中」= `reservations.status IN ('pending', 'reserved')`（誰かに予約されている状態全般。他者のこの状態は貸出を妨げる）
  - 「予約確保済（本人）」= `reservations.status = 'reserved' AND reservations.user_id = 貸出申請者のuser_id`（貸出可能の例外条件）
  - 貸出成立後の「完了」= `reservations.status = 'fulfilled'`（予約者本人の貸出成立時のみ、該当予約レコードをこの値に更新）
- **利用者認証・アクセス制御ルール**: 状態変更を伴うAPI（本APIを含む）は、利用者ID受け渡し用の認証ヘッダ（暫定: `X-User-Id`）により呼び出し元利用者を識別する。認証ヘッダの欠落・不正時は401エラー（RFC 7807形式）を返す。本APIは `user` ロールのみ許可する（`oauth2` securityScheme の `user` スコープ相当）。認証基盤（OAuth2/OIDCリソースサーバー検証）が正式導入されるまでの暫定運用であり、`X-User-Id` の値はリソースサーバー側で信頼する前提とする（正式な署名検証・RBACクレーム判定は認証基盤導入後に置き換える。既知のリスクは `decisions/` の Decision Record を参照）
- **貸出期限ルール**: 貸出日 + 14日を返却期限として設定
- 貸出（loans INSERT）・書籍状態更新（books UPDATE）・予約状態更新（reservations UPDATE、該当時のみ）は同一トランザクション内で実行
- **冪等リクエスト処理ルール**: 冪等キーは KVS で重複チェック後、RDB の UNIQUE 制約で二重防止する。冪等キー重複時の応答は本APIのエラー表（409）を正とする。全API共通のキャッシュ済みレスポンス再送は行わない（`_cross-cutting/datastore/kvs-schema.yaml` 参照）

## ティア完了条件（BDD）

```gherkin
Feature: 書籍を貸出する - バックエンドAPI

  Scenario: 正常な貸出
    Given 「在庫あり」で予約なしの書籍 book_id="abc-123" が存在する
    And 利用者 user_id="user-001" のアクセストークンが有効
    When X-User-Id="user-001" ヘッダを付与して POST /api/v1/loans に book_id="abc-123" を送信する
    Then HTTP 201 が返却される
    And レスポンスの due_date が「2026-04-26」である
    And books テーブルの id="abc-123" の status が "on_loan" に更新されている
    And loans テーブルに book_id="abc-123", user_id="user-001" のレコードが作成されている

  Scenario: 予約確保済本人による貸出で予約が完了状態に更新される
    Given 「在庫あり」の書籍 book_id="def-456" が存在する
    And 利用者 user_id="user-002" の reservations レコード（book_id="def-456", status="reserved"）が存在する
    When X-User-Id="user-002" ヘッダを付与して POST /api/v1/loans に book_id="def-456" を送信する
    Then HTTP 201 が返却される
    And reservations テーブルの該当レコードの status が "fulfilled" に更新されている

  Scenario: 冪等キー重複での二重貸出防止
    Given 冪等キー "key-001" で貸出が完了済み
    When 同じ冪等キー "key-001" で POST /api/v1/loans を送信する
    Then HTTP 409 が返却される
    And 新しい貸出レコードは作成されない

  Scenario: 認証ヘッダ欠落時のアクセス拒否
    Given 「在庫あり」の書籍 book_id="ghi-789" が存在する
    When X-User-Id ヘッダを付与せずに POST /api/v1/loans に book_id="ghi-789" を送信する
    Then HTTP 401 が返却される
    And loans テーブルにレコードは作成されない
```
