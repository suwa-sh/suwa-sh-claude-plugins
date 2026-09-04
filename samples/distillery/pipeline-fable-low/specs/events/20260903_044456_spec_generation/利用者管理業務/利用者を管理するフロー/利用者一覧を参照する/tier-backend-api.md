# 利用者一覧を参照する - Backend API仕様

## 変更概要

利用者コンテキスト（BC-002）モジュールに利用者一覧取得 API `GET /api/v1/users` を追加する。
offset ページネーション（page / pageSize、既定 20、上限 100）と、利用者番号（前方一致）・氏名（正規化つき部分一致）の単一条件 `q` による絞り込みを提供する。
個人情報（氏名・連絡先）を返すため司書区分限定とし、参照を監査ログに記録する（LP-006 / SR-010）。参照結果はキャッシュしない（個人情報を KVS に置かない）。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 利用者一覧取得

- **メソッド**: GET
- **パス**: `/api/v1/users`
- **認証**: Bearer（IdP 発行アクセストークン）。API Gateway で利用者区分=司書の粗粒度 RBAC（館内経路のみ）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/users.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| q | string (query) | No | 利用者番号（前方一致）または氏名（部分一致）。1〜100 文字。大文字小文字・全角半角を正規化 |
| page | integer (query) | No | ページ番号。1 以上。既定 1 |
| pageSize | integer (query) | No | 1 ページ件数。1〜100。既定 20 |
| X-Trace-Id | string (header) | No | trace_id |

#### レスポンス

`200 OK` / `application/json` — `UserPageResponse`

| フィールド | 型 | 説明 |
|-----------|---|------|
| items | UserSummary[] | 利用者一覧（利用者番号昇順） |
| items[].userNumber | string | 利用者番号 |
| items[].name | string | 氏名 |
| items[].userType | string | 利用者区分: `PATRON`（利用者）/ `STAFF`（司書） |
| items[].email | string | メールアドレス（画面側でマスク表示） |
| items[].phone | string \| null | 電話番号（画面側でマスク表示） |
| items[].registeredAt | string (date-time) | 登録日時（登録イベントの occurred_at） |
| items[].updatedAt | string (date-time) | 更新日時 |
| page | integer | 現在ページ |
| pageSize | integer | ページ件数 |
| totalCount | integer | 絞り込み条件に一致する総件数 |

住所（address）は一覧に含めない（編集画面・照会画面で個別取得）。

#### エラーレスポンス

`application/problem+json`（RFC 9457）

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | page < 1、pageSize が 1〜100 の範囲外、q が 100 文字超 | `{ status: 400, code: "VALIDATION_ERROR", errors: [{ field, message }] }` |
| 401 | トークン無し / 期限切れ | `{ status: 401, code: "UNAUTHENTICATED" }` |
| 403 | 利用者区分が司書でない | `{ status: 403, code: "FORBIDDEN" }` |

## 非同期イベント（該当する場合）

該当なし（参照系 UC）。

## データモデル変更

### users（E-003 利用者 スナップショット）

定義は「利用者を登録する」を参照。本 UC で検索用正規化列を追加する。

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_number | VARCHAR(20) | 利用者番号（PK。前方一致検索・並び順） | 参照 |
| name | VARCHAR(100) | 氏名（保管時暗号化対象） | 参照 |
| name_normalized | VARCHAR(100) | 検索用正規化氏名（NFKC + 小文字化。保管時暗号化対象。登録・編集時に導出） | 追加 |
| email / phone | - | 連絡先 | 参照 |
| user_type | VARCHAR(10) | 利用者区分（PATRON / STAFF） | 参照 |
| updated_at | TIMESTAMP | 更新日時 | 参照 |

### user_events（E-003 履歴側）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| user_number / event_type / occurred_at | - | event_type='REGISTERED' の occurred_at を registeredAt として取得 | 参照 |

## ビジネスルール

- 利用者検索判定: `q` 指定時、`user_number LIKE q%` OR `name_normalized LIKE %normalize(q)%` で照合する。q 未指定は全件。LIKE のワイルドカード文字はエスケープする
- 利用状況閲覧範囲判定: 利用者区分「司書」のみ許可。「利用者」からのアクセスは API Gateway（SP-009）で 403。presentation でも認可コンテキストの区分を確認する（LP-003）
- 並び順は `user_number ASC` 固定
- 監査ログ（LP-006 / SR-010）: 操作種別「データ参照」、対象（E-003, 応答に含めた利用者番号の一覧）、user_id、認可判定結果を記録する。氏名・連絡先の値は記録しない
- キャッシュしない: 個人情報を含む参照結果は KVS に保持しない（LP-017 の対象は書籍系参照のみ）
- 保管時暗号化（SP-024）: name / name_normalized / email / phone は暗号化列。前方一致・部分一致検索は復号可能な範囲（アプリケーション層暗号化ではなく透過的暗号化）で行う。実装方式は dist-impl の bootstrap で確定する
- 個人情報のログ出力禁止（LP-015 / CLR-004 相当）
- DB アクセスはパラメータ化クエリ必須（LR-013）

## ティア完了条件（BDD）

```gherkin
Feature: 利用者一覧を参照する - Backend API

  Scenario: 既定ページングで一覧を返す
    Given users に 45 件の利用者が存在する
    And 司書「佐藤花子」のアクセストークンを保持している
    When GET /api/v1/users を送信する
    Then HTTP 200 が返る
    And items が 20 件、page が 1、pageSize が 20、totalCount が 45 である
    And items は userNumber の昇順で、各要素に address は含まれない
    And 監査ログに操作「データ参照」、対象「E-003」と 20 件の利用者番号が記録される

  Scenario: 氏名で正規化つき部分一致検索する
    Given users に氏名「田中太郎」「田中花子」「山田一郎」「ﾀﾅｶ 次郎」が存在する
    When GET /api/v1/users?q=田中 を送信する
    Then HTTP 200 が返り、items が 2 件で name が「田中太郎」「田中花子」である
    When GET /api/v1/users?q=タナカ を送信する
    Then HTTP 200 が返り、items に「ﾀﾅｶ 次郎」が含まれる

  Scenario: 利用者番号で前方一致検索する
    Given users に「U0001234」「U0001299」「U0002345」が存在する
    When GET /api/v1/users?q=U00012 を送信する
    Then HTTP 200 が返り、items が 2 件で userNumber が「U0001234」「U0001299」である

  Scenario: 利用者区分が利用者のトークンは 403 を返す
    Given 利用者「田中太郎」（利用者区分: 利用者）のアクセストークンを保持している
    When GET /api/v1/users を送信する
    Then HTTP 403 と problem+json（code: FORBIDDEN）が返る
    And 監査ログに認可判定「拒否」が記録される

  Scenario: pageSize の上限超過は 400 を返す
    Given 司書「佐藤花子」のアクセストークンを保持している
    When GET /api/v1/users?pageSize=101 を送信する
    Then HTTP 400 と problem+json（code: VALIDATION_ERROR, errors[0].field: "pageSize"）が返る
```
