# 期間別貸出統計を参照するのAPI仕様

## 責務

司書の期間条件に従って貸出実績を集計し、getLoanStatisticsの応答を返す。

## 契約

| 操作 | 定義 | 適用条件 |
|---|---|---|
| getLoanStatistics | [_api-summary.yaml](_api-summary.yaml)のoperationと[_contract-slice.json](_contract-slice.json) | [TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)。館内接続と司書ロールを検証する |

## データ操作

| 対象 | 絞り込みと投影 |
|---|---|
| loans_events, loan_statistics | 指定期間の貸出登録イベントをloan_idで一度だけ数え、指定粒度の期間へ割り当てる |
| 返却する結果 | 期間内の全bucketを日付順で作り、実績のないbucketを0件で補完する |
| データ定義 | [_model-summary.yaml](_model-summary.yaml)のtables、[所有者索引](../../../_cross-cutting/datastore/generated/table-index.yaml) |

<a id="read-transaction"></a>

## 読み取りと保存の境界

同じ読取スナップショットから全対象を集計し、期間と粒度が同じ投影をRDB取引内で置換する。
貸出登録イベントをloan_idで重複排除し、返却・督促イベントを貸出回数へ加えない。
同じ期間の並行集計は期間キーを排他して順に確定し、再要求で件数を加算しない。
集計または監査の確定に失敗したらrollbackして503を返す。

日・月・年のbucketを要求期間内で列挙する。最初・最後のbucketは開始日・終了日で切り詰め、0件のbucketもseriesへ含める。labelは日がYYYY-MM-DD、月がYYYY-MM、年がYYYYとする。total_loansはseriesのvalue合計と一致させる。

## 集計投影への接続

| 値 | 保存と集約 |
|---|---|
| 保存単位 | 要求期間で切り詰めたbucket × book_id。貸出実績のある書籍だけloan_statisticsへ保存する |
| period_type/start/end | bucketの粒度と切り詰め後の日付範囲 |
| loan_count | bucket内の当該書籍の貸出件数 |
| loan_total | bucket内の全書籍のloan_count合計 |
| ranking | 当該bucketにRDRAの人気書籍ランキング判定を適用した順位 |
| stat_id | period_type/start/end/book_idから決定的に生成する |
| aggregated_at | 置換する取引のサーバ時刻 |
| series | bucketごとのloan_count合計。投影行がないbucketは0を返す |

## 再取得

| ケース | 結果 |
|---|---|
| 同じ要求を再実行 | 最新の確定状態を読み直す。同期間の投影を置換し加算しない |
| 通信失敗 | [TR-ERROR](../../../_cross-cutting/technical-rules.md#TR-ERROR)に従う。結果を成功と推定しない |
| 処理時間 | [NFR](../../../../../nfr/latest/nfr-grade.yaml)のB.2.1.3（10秒）を満たす |

## ティア完了条件

```gherkin
Feature: 期間別貸出統計を参照するのAPI境界
  Scenario: 監査の失敗で情報を返さない
    Given 対象の参照には成功したが監査のINSERTが失敗する
    When getLoanStatisticsを実行する
    Then 503を返し業務情報を応答へ含めない
```
