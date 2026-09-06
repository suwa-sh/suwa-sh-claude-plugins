# 期間別貸出統計を集計する - バックエンド API 仕様

## 変更概要

蔵書分析コンテキスト（BC-006）に貸出統計の集計要求を受け付けるエンドポイントを追加する。統計レポートを「集計中」で作成し、期間内の貸出走査を伴う集計処理は Worker ティアへ委譲する（arch SP-018 レポート集計の分離 / NFR B.2.1.3 ターンアラウンド 10 秒以内）。

## API 仕様

### 貸出統計レポート集計要求

- **メソッド**: POST
- **パス**: `/api/v1/reports/loans`
- **認証**: IdP 発行のアクセストークン（Bearer）。司書ロール必須（arch SR-005 / NFR E.5.2.1 RBAC）
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths./api/v1/reports/loans.post` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| report_type | string | Yes | レポート種別。`期間別貸出統計` または `人気書籍ランキング` を許容 |
| period_type | string | Yes | 集計期間区分（`日次` / `月次` / `年次`） |
| period_start | string(date) | Yes | 集計開始日（ISO 8601） |
| period_end | string(date) | Yes | 集計終了日（ISO 8601）。`period_start` 以降であること |
| X-Idempotency-Key | string(header) | Yes | 冪等キー（UUID）。同一キーの再送は同じ report_id を返す（arch SR-013） |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| report_id | string | 統計レポートID |
| report_type | string | レポート種別 |
| period_type | string | 集計期間区分 |
| period_start | string(date) | 集計開始日 |
| period_end | string(date) | 集計終了日 |
| report_status | string | 統計レポート状態。作成直後は `集計中` |
| aggregated_at | string(date-time) | 集計開始日時 |

ステータスコードは 202 Accepted。集計完了は貸出統計レポート参照 API（`GET /api/v1/reports/loans/{reportId}`）で確認する。

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | `report_type` が `期間別貸出統計` / `人気書籍ランキング` 以外 | `{"code":"INVALID_REPORT_TYPE","message":"レポート種別は 期間別貸出統計 または 人気書籍ランキング を指定してください"}` |
| 400 | `period_type` がバリエーション「集計期間区分」の値でない | `{"code":"INVALID_PERIOD_TYPE","message":"集計期間区分は 日次 / 月次 / 年次 のいずれかを指定してください"}` |
| 400 | `period_start` > `period_end` | `{"code":"INVALID_PERIOD_RANGE","message":"集計終了日は集計開始日以降の日付を指定してください"}` |
| 401 | アクセストークンが無効または失効 | `{"code":"UNAUTHENTICATED","message":"再度ログインしてください"}` |
| 403 | 司書ロールを持たない | `{"code":"FORBIDDEN","message":"この操作には司書の権限が必要です"}` |
| 503 | 集計要求イベントの発行に失敗 | `{"code":"AGGREGATION_UNAVAILABLE","message":"集計を受け付けられませんでした。時間をおいて再実行してください"}` |

## 非同期イベント（該当する場合）

### 貸出統計レポート集計要求

- **チャネル**: `report.aggregation.requested`
- **方向**: publish
- **メッセージスキーマ**: `LoanStatsReportAggregationRequested { report_id, report_type, period_type, period_start, period_end, trace_id }`
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.report.aggregation.requested` を参照
- **ペイロードスキーマ**: `ReportAggregationRequestedPayload`（AsyncAPI `components.schemas.ReportAggregationRequestedPayload.title` と同名。契約生成の型名の正本であり、業務的意味が変わらない限り改名しない）
- **ヘッダースキーマ**: `MessageHeaders`（全非同期メッセージ共通のヘッダー）
- **備考**: 在庫状況の集計要求と同一チャネルを共有し、`report_type` でコンシューマ側が処理を分岐する。`trace_id` と parent span_id を伝播する（arch SR-019）

## データモデル変更

### statistical_reports（統計レポート / E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| report_id | VARCHAR | レポートID（主キー） | 追加済み（在庫状況 UC と共通） |
| report_type | VARCHAR | レポート種別。本 UC では 期間別貸出統計／人気書籍ランキング | 参照・書き込み |
| period_type | VARCHAR | 集計期間区分 | 参照・書き込み |
| period_start / period_end | DATE | 集計期間 | 参照・書き込み |
| aggregated_at | TIMESTAMP | 集計開始日時 | 参照・書き込み |
| detail | TEXT | 集計明細（JSON）。本 UC の API では空オブジェクトで初期化する | 参照・書き込み |
| report_status | VARCHAR | 統計レポート状態。作成時は `集計中` | 参照・書き込み |

## ビジネスルール

- 貸出統計集計条件（条件.tsv）: 指定された集計期間区分と期間に含まれる貸出記録を対象に貸出件数と書籍別貸出回数を集計する。集計そのものは tier-worker が実行する
- 統計レポートは作成時に必ず「集計中」で開始する（状態.tsv 統計レポート状態）
- 対象期間に貸出実績が存在しない場合の「実績なし」判定は Worker 側で行う。API は実績有無を判定しない
- 蔵書分析コンテキスト（BC-006）は貸出・書籍を読み取り専用に参照する。貸出の更新は行わない
- 同一の `X-Idempotency-Key` による再送は新しい統計レポートを作らず、既存の report_id を返す（arch SR-013）
- 集計条件のみを構造化ログに出力し、利用者番号・氏名・連絡先はログに出さない（arch SP-023）

## ティア完了条件（BDD）

```gherkin
Feature: 期間別貸出統計を集計する - バックエンド API

  Scenario: 集計要求を受け付けて集計中のレポートを作成する
    Given 司書ロールのアクセストークンを保持している
    When POST /api/v1/reports/loans に {"report_type":"期間別貸出統計","period_type":"月次","period_start":"2026-08-01","period_end":"2026-08-31"} を送信する
    Then HTTP 202 が返り、report_status が "集計中" である
    And statistical_reports に report_status='集計中' の行が 1 件登録される
    And report.aggregation.requested へ LoanStatsReportAggregationRequested が発行される

  Scenario: 人気書籍ランキングも同一エンドポイントで受け付ける
    Given 司書ロールのアクセストークンを保持している
    When POST /api/v1/reports/loans に {"report_type":"人気書籍ランキング","period_type":"年次","period_start":"2026-01-01","period_end":"2026-12-31"} を送信する
    Then HTTP 202 が返り、report_type "人気書籍ランキング" の統計レポートが集計中で作成される

  Scenario: 集計期間の前後が逆のとき400を返す
    Given 司書ロールのアクセストークンを保持している
    When POST /api/v1/reports/loans に period_start "2026-08-31"・period_end "2026-08-01" を送信する
    Then HTTP 400 と code "INVALID_PERIOD_RANGE" が返り、統計レポートは作成されない

  Scenario: 同一の冪等キーで再送しても二重に作成しない
    Given X-Idempotency-Key "9c2d-…-07" で集計要求が 1 件受理されている
    When 同じ冪等キーで POST /api/v1/reports/loans を再送する
    Then HTTP 202 が返り、既存と同じ report_id が返る

  Scenario: 司書ロールを持たない場合は403を返す
    Given 利用者ロールのアクセストークンを保持している
    When POST /api/v1/reports/loans を送信する
    Then HTTP 403 と code "FORBIDDEN" が返る
```
