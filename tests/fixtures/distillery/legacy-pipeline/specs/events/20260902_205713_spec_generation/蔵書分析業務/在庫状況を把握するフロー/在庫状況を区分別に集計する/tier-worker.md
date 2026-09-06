# 在庫状況を区分別に集計する - バックエンドワーカー仕様

## 変更概要

`report.aggregation.requested` を消費し、蔵書全件を書籍状態で区分集計するコンシューマを追加する。集計結果を統計レポートの集計明細へ書き込み、統計レポート状態を「作成済み」または「実績なし」へ遷移させる。

## イベント処理仕様

### InventoryReportAggregationConsumer

- **トリガー**: `report.aggregation.requested` への `InventoryReportAggregationRequested` メッセージ到着（`report_type='在庫状況'` のメッセージのみ処理する）
- **入力チャネル**: `report.aggregation.requested`
- **出力チャネル**: なし（結果は RDB の `statistical_reports` に永続化する）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.report.aggregation.requested` を参照
- **ペイロードスキーマ**: `ReportAggregationRequestedPayload`（AsyncAPI `components.schemas.ReportAggregationRequestedPayload.title` と同名。契約生成の型名の正本であり、業務的意味が変わらない限り改名しない）
- **ヘッダースキーマ**: `MessageHeaders`（全非同期メッセージ共通のヘッダー）

#### 処理フロー

1. メッセージをデシリアライズし、`message_id` で重複消費を検知する（arch SR-018）。処理済みならスキップする
2. `trace_id` を引き継ぎ、新しい span を開始する（arch SR-019）
3. `report_id` で統計レポートを取得し、`report_status='集計中'` であることを確認する。それ以外なら処理をスキップして ACK する
4. `SELECT book_id, title, author, genre, book_status FROM books` で蔵書全件を取得する
5. 蔵書が 0 件なら統計レポート状態を「実績なし」に設定して 8 へ進む
6. 書籍状態（在庫あり／貸出中／予約待ち）ごとに件数と書籍一覧を集計し、ジャンル別件数と蔵書総数を算出する
7. 稼働率 = 貸出中件数 ÷ 蔵書総数 を算出し、統計レポート状態を「作成済み」に設定する
8. `UPDATE statistical_reports SET detail=..., report_status=..., aggregated_at=...` で結果を保存する
9. ジョブ結果（COMPLETED / FAILED）と処理件数を構造化ログへ INFO 出力する（arch LP-017）

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| RDB 一時障害（接続断・タイムアウト） | Yes | Yes | 指数バックオフで再試行し、上限超過時は DLQ へ退避する（arch SR-020） |
| 対象レポート未存在（report_id 不整合） | No | No | ERROR ログを出力して ACK する。再試行しても回復しないため |
| 統計レポート状態が「集計中」でない | No | No | 重複消費とみなし INFO ログを出して ACK する（arch SR-018） |
| メッセージのデシリアライズ失敗（ポイズンピル） | No | Yes | ERROR ログを出力して DLQ へ退避する（arch LP-017） |
| 集計処理時間の目標超過（処理時間の増加） | - | - | 劣化兆候として WARN ログを出力する（arch SR-021 / NFR B.2.1.3 ターンアラウンド 10 秒以内） |

## データモデル変更

### statistical_reports（統計レポート / E-007）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| detail | TEXT | 集計明細（JSON）。`total_books` / `status_counts` / `genre_counts` / `utilization_rate` / `books[]` を格納する | 変更 |
| report_status | VARCHAR | 集計中 → 作成済み（実績あり）／実績なし（蔵書0件） | 変更 |
| aggregated_at | TIMESTAMP | 集計完了時刻で更新する | 変更 |

### books（書籍 / E-001）

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| book_id | VARCHAR | 書籍ID。集計対象の識別子として参照 | 参照のみ |
| book_status | VARCHAR | 書籍状態。区分集計の軸として参照 | 参照のみ |
| genre | VARCHAR | ジャンル。ジャンル別件数の軸として参照 | 参照のみ |
| title / author | VARCHAR | 集計明細の書籍一覧に含める | 参照のみ |

蔵書分析コンテキスト（BC-006）は書籍を読み取り専用に参照し、更新しない。

## ビジネスルール

- 在庫状況集計条件（条件.tsv）: 蔵書全件を書籍状態（在庫あり／貸出中／予約待ち）で区分し、区分ごとの件数と書籍一覧を集計する
- 集計対象の蔵書が 0 件の場合は統計レポート状態を「実績なし」とし、司書へ実績なしとして案内する（状態.tsv）
- 稼働率は 貸出中件数 ÷ 蔵書総数 とし、蔵書総数が 0 のときは算出しない
- ジャンル別件数はバリエーション「ジャンル」の 8 区分すべてを出力する（件数 0 の区分も 0 として含める）
- 集計は書籍状態のスナップショットであり、集計中に書籍状態が変化しても再集計しない（統計レポートは event_snapshot）
- 中断許容インフラ上で実行されるため、中断時は再配信で安全に再実行できること（arch SP-032 / SR-018）

## ティア完了条件（BDD）

```gherkin
Feature: 在庫状況を区分別に集計する - バックエンドワーカー

  Scenario: 蔵書全件を書籍状態で区分集計して作成済みにする
    Given statistical_reports に report_id "RPT-0001" が report_status "集計中" で存在する
    And books に 在庫あり 80 件・貸出中 30 件・予約待ち 10 件が登録されている
    When report.aggregation.requested から report_id "RPT-0001" のメッセージを消費する
    Then detail の status_counts が {"在庫あり":80,"貸出中":30,"予約待ち":10} になり、report_status が "作成済み" になる

  Scenario: 蔵書が0件のとき実績なしにする
    Given statistical_reports に report_id "RPT-0002" が report_status "集計中" で存在する
    And books が 0 件である
    When report.aggregation.requested から report_id "RPT-0002" のメッセージを消費する
    Then report_status が "実績なし" になり、detail の total_books が 0 になる

  Scenario: 同一メッセージの重複消費を検知してスキップする
    Given message_id "msg-0001" が処理済みとして記録されている
    When 同じ message_id "msg-0001" のメッセージを再度消費する
    Then 集計は再実行されず、statistical_reports は更新されない

  Scenario: RDB障害が再試行上限を超えるとDLQへ退避する
    Given statistical_reports への UPDATE が接続断で失敗し続ける
    When リトライ上限 5 回を超える
    Then メッセージが DLQ へ退避され、ERROR ログにアラート対象として記録される
```
