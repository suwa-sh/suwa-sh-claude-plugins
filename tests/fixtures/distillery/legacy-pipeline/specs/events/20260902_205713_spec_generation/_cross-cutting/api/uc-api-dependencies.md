# UC 間 API 依存マップ

各 UC が「所有する API」と「他 UC が所有する API を利用する依存（cross-UC API 依存）」を
機械可読に分離する。対象 UC の入力（`_api-summary.yaml`）だけを読めば、その UC が呼び出す
全 API operation と契約ファイルを列挙できる状態を保証する。

## 記録場所と形式

各 UC の `_api-summary.yaml` に次の 2 ブロックを置く。

| ブロック | 意味 |
|---|---|
| `endpoints:` | **その UC が所有する** API operation（従来どおり。OpenAPI へ集約される正本） |
| `consumes:` | **他 UC が所有する** API operation への依存（cross-UC API 依存。OpenAPI へは集約しない） |

```yaml
consumes:
  - operation_id: "getBookAvailability"       # OpenAPI の operationId（唯一の結合キー）
    method: "GET"
    path: "/api/v1/books/{book_id}/availability"
    owner_uc: "書籍詳細と在庫状況を照会する"     # この operation を endpoints に持つ UC
    contract: "_cross-cutting/api/openapi.yaml"  # 契約ファイル（同期 API は openapi.yaml）
    tier: "tier-frontend-staff"                # 呼び出し元ティア
    purpose: "貸出登録前に対象書籍の在庫状況を再確認する"
    required: true                             # false は任意（欠けても UC が成立する）
```

非同期メッセージへの依存は `contract: "_cross-cutting/api/asyncapi.yaml"` とし、
`operation_id` に AsyncAPI の `operations` のキーを書く。

## 非同期メッセージの payload schema title 一覧

AsyncAPI の生成型名が `AnonymousSchema_1` のような匿名名にならないよう、
message と payload schema の対応をここで固定する。
`payload_schema` は AsyncAPI `components.schemas` のキーおよび `title` と同名であり、
各 UC の `_api-summary.yaml` の `async_events[].payload_schema` と一致させる。
業務イベントの意味が変わらない限り改名しない（改名すると生成型名が変わる）。

| message | channel | payload_schema (= title) | headers_schema | 所有 UC |
|---------|---------|--------------------------|----------------|---------|
| `HoldNoticeRequested` | `notification.hold-notice.requested` / `notification.hold-notice.dlq` | `HoldNoticeRequestedPayload` | `MessageHeaders` | 取置き通知メールを送信する |
| `RemindNotificationRequested` | `notification.remind.requested` / `notification.remind.dlq` | `RemindNotificationRequestedPayload` | `MessageHeaders` | リマインドメールを送信する |
| `DunNotificationRequested` | `notification.dun.requested` / `notification.dun.dlq` | `DunNotificationRequestedPayload` | `MessageHeaders` | 督促メールを送信する |
| `InventoryReportAggregationRequested` | `report.aggregation.requested` / `report.aggregation.dlq` | `ReportAggregationRequestedPayload` | `MessageHeaders` | 在庫状況を区分別に集計する |
| `LoanStatsReportAggregationRequested` | `report.aggregation.requested` / `report.aggregation.dlq` | `ReportAggregationRequestedPayload` | `MessageHeaders` | 期間別貸出統計を集計する |

message の `payload` / `headers` は必ず `$ref` で上表のスキーマを参照し、
インラインのオブジェクト定義を書かない（asyncapi.yaml の `info.description` の命名規約が正本）。

## ルール

1. **所有と利用を混在させない**。`endpoints:` にはその UC が定義した operation だけを書き、
   他 UC の operation を再掲しない。再掲すると OpenAPI 集約時に重複定義になる。
2. **結合キーは `operation_id`**。パス文字列の一致で解決しない（パスパラメータ表記の揺れで壊れるため）。
3. **`owner_uc` は `_cross-cutting/api/uc-api-dependencies.md` の一覧と一致させる**。
   所有 UC が存在しない operation は `consumes:` に書けない（先に所有 UC 側へ `endpoints:` を追加する）。
4. **自 UC 所有の operation を `consumes:` に書かない**（自己依存は依存ではない）。
5. **依存の粒度は operation 単位**。「〜画面が使う API 一式」のような曖昧な記述をしない。
6. `consumes:` が空の UC は `consumes: []` と明示する（未記入と区別する）。

## 利用側の読み方

- 実装（dist-impl）は対象 UC の `_api-summary.yaml` だけを読み、
  `endpoints:` を「実装する契約」、`consumes:` を「呼び出す契約」として扱う。
- `contract` に書かれたファイルの `operation_id` を引けば、リクエスト・レスポンス型が確定する。
- 全体の依存関係は本ファイルの「依存一覧」節に集約する（各 UC の `consumes:` から機械生成する）。

## API operation 所有一覧（45 operation）

`operationId` ごとの所有 UC を 1 つに確定する。`consumes:` の `owner_uc` は必ず本表と一致させる。

| operationId | method | path | 所有 UC | 業務 / BUC |
|---|---|---|---|---|
| `cancelReservation` | POST | `/api/v1/staff/reservations/{reservation_id}/cancel` | 予約を取り消す | 予約管理業務 / 書籍を予約するフロー |
| `checkLoanEligibility` | POST | `/api/v1/loans/eligibility-checks` | 書籍の貸出可否を判定する | 蔵書利用業務 / 書籍を貸し出すフロー |
| `createBook` | POST | `/api/v1/books` | 書籍を登録する | 蔵書管理業務 / 蔵書を管理するフロー |
| `createInventoryReport` | POST | `/api/v1/reports/inventory` | 在庫状況を区分別に集計する | 蔵書分析業務 / 在庫状況を把握するフロー |
| `createLoan` | POST | `/api/v1/loans` | 貸出を登録する | 蔵書利用業務 / 書籍を貸し出すフロー |
| `createLoanStatsReport` | POST | `/api/v1/reports/loans` | 期間別貸出統計を集計する | 蔵書分析業務 / 貸出統計を把握するフロー |
| `createReservation` | POST | `/api/v1/reservations` | 予約を登録する | 予約管理業務 / 書籍を予約するフロー |
| `createUser` | POST | `/api/v1/users` | 利用者を登録する | 利用者管理業務 / 利用者を管理するフロー |
| `deleteBook` | DELETE | `/api/v1/books/{book_id}` | 書籍を削除する | 蔵書管理業務 / 蔵書を管理するフロー |
| `deleteUser` | DELETE | `/api/v1/users/{user_no}` | 利用者を削除する | 利用者管理業務 / 利用者を管理するフロー |
| `getBook` | GET | `/api/v1/books/{book_id}` | 書籍情報を編集する | 蔵書管理業務 / 蔵書を管理するフロー |
| `getBookAvailability` | GET | `/api/v1/books/{book_id}/availability` | 書籍詳細と在庫状況を照会する | 蔵書利用業務 / 書籍を検索するフロー |
| `getBookWithdrawalEligibility` | GET | `/api/v1/books/{book_id}/withdrawal-eligibility` | 書籍を削除する | 蔵書管理業務 / 蔵書を管理するフロー |
| `getHoldCandidate` | GET | `/api/v1/staff/books/{book_id}/hold-candidate` | 予約順1位の利用者を特定する | 予約管理業務 / 予約者へ通知するフロー |
| `getInventoryReport` | GET | `/api/v1/reports/inventory/{report_id}` | 在庫状況レポートを参照する | 蔵書分析業務 / 在庫状況を把握するフロー |
| `getLatestInventoryReport` | GET | `/api/v1/reports/inventory/latest` | 在庫状況レポートを参照する | 蔵書分析業務 / 在庫状況を把握するフロー |
| `getLatestLoanStatsReport` | GET | `/api/v1/reports/loans/latest` | 貸出統計レポートを参照する | 蔵書分析業務 / 貸出統計を把握するフロー |
| `getLoanStatsReport` | GET | `/api/v1/reports/loans/{report_id}` | 貸出統計レポートを参照する | 蔵書分析業務 / 貸出統計を把握するフロー |
| `getLoanTarget` | GET | `/api/v1/loan-targets/{user_no}` | 利用者番号で貸出対象利用者を特定する | 蔵書利用業務 / 書籍を貸し出すフロー |
| `getMyCard` | GET | `/api/v1/me/card` | 利用者番号で貸出対象利用者を特定する | 蔵書利用業務 / 書籍を貸し出すフロー |
| `getMyHoldStatus` | GET | `/api/v1/me/reservations/{reservation_id}/hold` | 自分の取置き状況を照会する | 予約管理業務 / 予約者へ通知するフロー |
| `getMyLoan` | GET | `/api/v1/me/loans/{loan_id}` | 自分の貸出内容と返却期限を照会する | 蔵書利用業務 / 書籍を貸し出すフロー |
| `getMyProfile` | GET | `/api/v1/me` | 自分の利用者情報を照会する | 利用者管理業務 / 利用者を管理するフロー |
| `getMyReservationRank` | GET | `/api/v1/me/reservations/{reservation_id}/rank` | 自分の予約順位を照会する | 予約管理業務 / 書籍を予約するフロー |
| `getOverdueJudgement` | GET | `/api/v1/staff/overdues/judgement` | 期限超過の貸出を延滞にする | 貸出期限管理業務 / 延滞を督促するフロー |
| `getUser` | GET | `/api/v1/users/{user_no}` | 利用者情報を編集する | 利用者管理業務 / 利用者を管理するフロー |
| `listBooks` | GET | `/api/v1/books` | 蔵書一覧を照会する | 蔵書管理業務 / 蔵書を管理するフロー |
| `listLoans` | GET | `/api/v1/loans` | 返却を登録する | 蔵書利用業務 / 書籍を返却するフロー |
| `listMyDueLoans` | GET | `/api/v1/me/loans/due` | 自分の返却期限を照会する | 貸出期限管理業務 / 返却期限をリマインドするフロー |
| `listMyHolds` | GET | `/api/v1/me/reservations/holds` | 自分の取置き中の予約を照会する | 利用照会業務 / 予約状況を確認するフロー |
| `listMyLoans` | GET | `/api/v1/me/loans` | 自分の現在の貸出を照会する | 利用照会業務 / 貸出履歴を確認するフロー |
| `listMyOverdueLoans` | GET | `/api/v1/me/loans/overdue` | 自分の延滞中の貸出を照会する | 貸出期限管理業務 / 延滞を督促するフロー |
| `listMyReservations` | GET | `/api/v1/me/reservations` | 自分の予約状況を照会する | 利用照会業務 / 予約状況を確認するフロー |
| `listNotifications` | GET | `/api/v1/staff/notifications` | 取置き通知メールを送信する | 予約管理業務 / 予約者へ通知するフロー |
| `listOverdueLoans` | GET | `/api/v1/staff/overdues` | 延滞中の貸出を照会する | 貸出期限管理業務 / 延滞を督促するフロー |
| `listPendingHoldBooks` | GET | `/api/v1/staff/holds/pending-books` | 予約順1位の利用者を特定する | 予約管理業務 / 予約者へ通知するフロー |
| `listUpcomingDueLoans` | GET | `/api/v1/staff/duedates/upcoming` | 返却期限接近の貸出を判定する | 貸出期限管理業務 / 返却期限をリマインドするフロー |
| `listUsers` | GET | `/api/v1/users` | 利用者一覧を照会する | 利用者管理業務 / 利用者を管理するフロー |
| `registerLoanReturn` | POST | `/api/v1/loans/{loan_id}/return` | 返却を登録する | 蔵書利用業務 / 書籍を返却するフロー |
| `resendNotification` | POST | `/api/v1/staff/notifications/{notification_id}/resend` | 取置き通知メールを送信する | 予約管理業務 / 予約者へ通知するフロー |
| `restockBook` | POST | `/api/v1/books/{book_id}/restock` | 返却後の書籍状態を更新する | 蔵書利用業務 / 書籍を返却するフロー |
| `searchBooks` | GET | `/api/v1/books/search` | 書籍を検索する | 蔵書利用業務 / 書籍を検索するフロー |
| `sendHoldNotice` | POST | `/api/v1/staff/notifications/hold-notices` | 取置き通知メールを送信する | 予約管理業務 / 予約者へ通知するフロー |
| `updateBook` | PUT | `/api/v1/books/{book_id}` | 書籍情報を編集する | 蔵書管理業務 / 蔵書を管理するフロー |
| `updateUser` | PUT | `/api/v1/users/{user_no}` | 利用者情報を編集する | 利用者管理業務 / 利用者を管理するフロー |

合計 operation: 45（所有 UC は operation あたり 1 つだけ）

### 複数 UC が同じ operation を使う場合の所有 UC 決定

| operationId | 所有 UC | 理由 | 利用側（`consumes:` に記録する UC） |
|---|---|---|---|
| `listNotifications` / `resendNotification` | 取置き通知メールを送信する | 通知実績照会・再送は通知種別横断の共通 operation であり、最初に通知を発火する UC を所有者とする | リマインドメールを送信する / 督促メールを送信する |
| `searchBooks` | 書籍を検索する | 利用者向け検索が RDRA 上の起点（SPEC-001-03#1 の主担当）であり、司書向けは同じ operation の条件違い | 司書向けに蔵書を検索する |
| `listMyLoans` | 自分の現在の貸出を照会する | 本人限定の貸出照会の正本。履歴・返却対象・返却済みはクエリ条件（`scope` / 状態）違いの利用 | 自分の貸出履歴を照会する / 自分の返却済み貸出を照会する / 返却対象の貸出を照会する |

## 依存一覧

<!-- GENERATED:uc-api-dependencies:BEGIN -->
| 利用 UC | operationId | method / path | 所有 UC | 契約 | 必須 |
|---|---|---|---|---|---|
| リマインドメールを送信する | `listNotifications` | GET `/api/v1/staff/notifications` | 取置き通知メールを送信する | `_cross-cutting/api/openapi.yaml` | true |
| リマインドメールを送信する | `resendNotification` | POST `/api/v1/staff/notifications/{notification_id}/resend` | 取置き通知メールを送信する | `_cross-cutting/api/openapi.yaml` | true |
| 予約を登録する | `getBookAvailability` | GET `/api/v1/books/{book_id}/availability` | 書籍詳細と在庫状況を照会する | `_cross-cutting/api/openapi.yaml` | true |
| 予約を登録する | `listMyReservations` | GET `/api/v1/me/reservations` | 自分の予約状況を照会する | `_cross-cutting/api/openapi.yaml` | true |
| 利用者を削除する | `getUser` | GET `/api/v1/users/{user_no}` | 利用者情報を編集する | `_cross-cutting/api/openapi.yaml` | true |
| 司書向けに蔵書を検索する | `searchBooks` | GET `/api/v1/books/search` | 書籍を検索する | `_cross-cutting/api/openapi.yaml` | true |
| 在庫状況を区分別に集計する | `getInventoryReport` | GET `/api/v1/reports/inventory/{report_id}` | 在庫状況レポートを参照する | `_cross-cutting/api/openapi.yaml` | false |
| 在庫状況を区分別に集計する | `getLatestInventoryReport` | GET `/api/v1/reports/inventory/latest` | 在庫状況レポートを参照する | `_cross-cutting/api/openapi.yaml` | false |
| 期間別貸出統計を集計する | `getLatestLoanStatsReport` | GET `/api/v1/reports/loans/latest` | 貸出統計レポートを参照する | `_cross-cutting/api/openapi.yaml` | false |
| 期間別貸出統計を集計する | `getLoanStatsReport` | GET `/api/v1/reports/loans/{report_id}` | 貸出統計レポートを参照する | `_cross-cutting/api/openapi.yaml` | false |
| 督促メールを送信する | `listNotifications` | GET `/api/v1/staff/notifications` | 取置き通知メールを送信する | `_cross-cutting/api/openapi.yaml` | true |
| 督促メールを送信する | `resendNotification` | POST `/api/v1/staff/notifications/{notification_id}/resend` | 取置き通知メールを送信する | `_cross-cutting/api/openapi.yaml` | true |
| 自分の貸出履歴を照会する | `listMyLoans` | GET `/api/v1/me/loans` | 自分の現在の貸出を照会する | `_cross-cutting/api/openapi.yaml` | true |
| 自分の返却済み貸出を照会する | `listMyLoans` | GET `/api/v1/me/loans` | 自分の現在の貸出を照会する | `_cross-cutting/api/openapi.yaml` | true |
| 貸出を登録する | `checkLoanEligibility` | POST `/api/v1/loans/eligibility-checks` | 書籍の貸出可否を判定する | `_cross-cutting/api/openapi.yaml` | false |
| 貸出を登録する | `getBookAvailability` | GET `/api/v1/books/{book_id}/availability` | 書籍詳細と在庫状況を照会する | `_cross-cutting/api/openapi.yaml` | false |
| 貸出を登録する | `getLoanTarget` | GET `/api/v1/loan-targets/{user_no}` | 利用者番号で貸出対象利用者を特定する | `_cross-cutting/api/openapi.yaml` | false |
| 返却対象の貸出を照会する | `listMyLoans` | GET `/api/v1/me/loans` | 自分の現在の貸出を照会する | `_cross-cutting/api/openapi.yaml` | true |

依存 18 件（`consumes: []` の UC は本表に現れない）。
<!-- GENERATED:uc-api-dependencies:END -->
