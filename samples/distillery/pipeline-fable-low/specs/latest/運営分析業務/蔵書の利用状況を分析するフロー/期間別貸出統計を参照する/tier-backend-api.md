# 期間別貸出統計を参照する - Backend API仕様

## 変更概要

運営分析コンテキスト（BC-006）に読み取り API `GET /api/v1/reports/loan-statistics` を追加する。集計テーブル loan_statistics（arch E-009、resource_mutable）を期間区切りで集約して返し、未集計の区切り（当日・当月）は loans を COUNT して補完する。結果は KVS に Cache-Aside（TTL 10 分）で保持する（LP-017）。

## API 仕様

> 500 INTERNAL_ERROR は共通エラーハンドラが返す横断エラーであり、各 API のエラー表には個別に宣言しない（[openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の規約に準拠）。

### 期間別貸出統計取得

- **メソッド**: GET
- **パス**: `/api/v1/reports/loan-statistics`
- **認証**: Bearer（IdP 発行アクセストークン）。利用者区分 = 司書 のみ許可（LP-003 / SP-016）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reports/loan-statistics.get` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| periodType | string (query) | Yes | 集計期間種別 enum: `DAY`（日）/ `MONTH`（月）/ `YEAR`（年）（バリエーション「集計期間種別」） |
| from | string (query, date) | Yes | 集計対象期間 開始日（YYYY-MM-DD） |
| to | string (query, date) | Yes | 集計対象期間 終了日（YYYY-MM-DD）。from <= to |

期間上限: `DAY` は 366 日、`MONTH` は 36 か月、`YEAR` は 10 年。`MONTH` / `YEAR` は from を月初 / 年初、to を月末 / 年末に丸める。

#### レスポンス

`LoanStatisticsResponse`

| フィールド | 型 | 説明 |
|-----------|---|------|
| periodType | string | 要求した集計期間種別 |
| from | string (date) | 丸め後の開始日 |
| to | string (date) | 丸め後の終了日 |
| totalLoans | integer | 期間内貸出件数の合計 |
| previousTotalLoans | integer | 直前の同一長期間の貸出件数合計（前期比の基準） |
| series | array | 期間区切りごとの貸出件数（期間昇順） |
| series[].periodStart | string (date) | 区切り開始日 |
| series[].periodEnd | string (date) | 区切り終了日 |
| series[].loanTotal | integer | 区切り内の貸出件数 |
| aggregatedAt | string (date-time) | 集計テーブルの最終集計日時（補完分は応答時刻） |

#### エラーレスポンス

`application/problem+json`（RFC 9457）+ 業務エラーコード

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | periodType が enum 外、日付形式不正、from > to | `{code: "VALIDATION_ERROR", errors[{field, reason}]}` |
| 400 | periodType ごとの期間上限を超過 | `{code: "INVALID_PERIOD_RANGE", detail: "DAY: 最大 366 日"}` |
| 401 | トークン未提示 / 無効 | `{code: "UNAUTHENTICATED"}` |
| 403 | 利用者区分が司書でない | `{code: "FORBIDDEN"}`（監査ログに認可判定 = deny を記録） |

## 非同期イベント（該当する場合）

なし（同期の読み取り API）。

## データモデル変更

### loan_statistics（情報: 貸出統計）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| stat_id | VARCHAR(26) | 集計 ID（PK） | 追加 |
| period_type | VARCHAR(8) | 集計期間種別 enum: DAY（日）・MONTH（月）・YEAR（年） | 追加 |
| period_start | DATE | 集計対象期間 開始日 | 追加 |
| period_end | DATE | 集計対象期間 終了日 | 追加 |
| book_id | VARCHAR(26) | 書籍 ID（books への参照）。本 UC は書籍別内訳を SUM で畳み込む | 追加 |
| loan_count | INT | 書籍ごとの貸出回数（人気書籍ランキング用） | 追加 |
| loan_total | INT | 集計期間内の貸出件数 | 追加 |
| ranking | INT | ランキング順位（人気書籍ランキング用） | 追加 |
| aggregated_at | TIMESTAMP | 集計日時（再集計で更新） | 追加 |
| UNIQUE(period_type, period_start, book_id) | — | 期間 × 書籍で 1 行 | 追加 |
| INDEX(period_type, period_start) | — | 期間範囲の集約 SELECT | 追加 |

### loans（情報: 貸出）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| loaned_on | DATE | 貸出日。未集計区切りの COUNT 条件 | 変更なし |
| INDEX(loaned_on) | — | 貸出日範囲の COUNT（補完） | 追加 |

## ビジネスルール

- 条件「集計期間判定」: 集計期間種別と指定期間から期間区切りを生成し、貸出日が区切り内に含まれる貸出記録を集計対象とする。区切りの生成は domain `AggregationPeriod` に実装し、集計期間種別はストラテジー（LP-012）で切り替える
- 集計の正本は loan_statistics（集計テーブル）。集計行が無い区切りだけ loans を COUNT して補完し、応答に混在させる（補完分は再集計後に集計テーブルの値に置き換わる）
- 前期比の基準期間は「from の直前に終わる、同じ長さの期間」とし、同じ規則で集計する
- 結果は KVS `cache:report:loan-statistics:{periodType}:{from}:{to}` に TTL 10 分でキャッシュする。貸出登録・返却登録による無効化は行わない（集計画面は 10 分以内の鮮度で足りる。NFR B.2.1.3）
- 司書のみ利用可。参照は集計値のみのため個人情報を含まないが、認可判定結果はデータアクセス監査ログに記録する（SR-010）
- 応答は 10 秒以内（NFR B.2.1.3）。RDB クエリはパラメータ化し、期間上限で走査量を抑える（SR-011 / LR-013）

## ティア完了条件（BDD）

```gherkin
Feature: 期間別貸出統計を参照する - Backend API

  Scenario: 月単位の集計を返す
    Given 司書「S-0001」のアクセストークンを持つ
    And loan_statistics に period_type=MONTH で 2026-03〜2026-08 の各月に book_id 別の行があり、月ごとの loan_total 合計が 120, 135, 98, 150, 142, 160 である
    When GET /api/v1/reports/loan-statistics?periodType=MONTH&from=2026-03-01&to=2026-08-31 を呼ぶ
    Then HTTP 200 で series が 6 件、series[0] が {periodStart: "2026-03-01", periodEnd: "2026-03-31", loanTotal: 120} である
    And totalLoans が 805 である

  Scenario: 未集計の当月を loans から補完する
    Given 司書「S-0001」のアクセストークンを持ち、今日が 2026-09-03 である
    And loan_statistics に 2026-09 の行が存在せず、loans に loaned_on が 2026-09-01〜2026-09-03 の行が 7 件ある
    When GET /api/v1/reports/loan-statistics?periodType=MONTH&from=2026-08-01&to=2026-09-30 を呼ぶ
    Then series[1] が {periodStart: "2026-09-01", periodEnd: "2026-09-30", loanTotal: 7} である

  Scenario: 期間上限を超えると 400 を返す
    Given 司書「S-0001」のアクセストークンを持つ
    When GET /api/v1/reports/loan-statistics?periodType=DAY&from=2025-01-01&to=2026-12-31 を呼ぶ
    Then HTTP 400 と problem+json {code: "INVALID_PERIOD_RANGE"} が返る

  Scenario: 利用者区分が利用者なら 403 を返す
    Given 利用者「U-0001」（利用者区分: 利用者）のアクセストークンを持つ
    When GET /api/v1/reports/loan-statistics?periodType=YEAR&from=2024-01-01&to=2026-12-31 を呼ぶ
    Then HTTP 403 と problem+json {code: "FORBIDDEN"} が返る
    And 監査ログに actor=U-0001, action=READ_REPORT, result=deny が記録される
```
