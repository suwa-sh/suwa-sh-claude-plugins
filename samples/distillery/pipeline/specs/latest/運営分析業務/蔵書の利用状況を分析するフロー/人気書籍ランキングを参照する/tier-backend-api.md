# 人気書籍ランキングを参照するのAPI仕様

## 責務

司書の期間条件に従って貸出実績を集計し、getPopularBooksの応答を返す。

## 契約

| 操作 | 定義 | 適用条件 |
|---|---|---|
| getPopularBooks | [_api-summary.yaml](_api-summary.yaml)のoperationと[_contract-slice.json](_contract-slice.json) | [TR-AUTH](../../../_cross-cutting/technical-rules.md#TR-AUTH)。館内接続と司書ロールを検証する |

## データ操作

| 対象 | 絞り込みと投影 |
|---|---|
| loans_events, books, genres, loan_statistics | 指定期間に発生した貸出登録イベントをloan_idで一度だけ数え、書籍ごとに集計する |
| 返却する結果 | 貸出回数降順・book_id昇順で順位を算出し、booksとgenresの表示属性を結合する |
| データ定義 | [_model-summary.yaml](_model-summary.yaml)のtables、[所有者索引](../../../_cross-cutting/datastore/generated/table-index.yaml) |

<a id="read-transaction"></a>

## 読み取りと保存の境界

同じ読取スナップショットから全対象を集計し、期間と粒度が同じ投影をRDB取引内で置換する。
貸出登録イベントをloan_idで重複排除し、返却・督促イベントを貸出回数へ加えない。
同じ期間の並行集計は期間キーを排他して順に確定し、再要求で件数を加算しない。
集計または監査の確定に失敗したらrollbackして503を返す。

順位は[人気書籍ランキング判定・集計期間判定](../../../../../rdra/latest/条件.tsv)を参照する。同数10・10・8回は1・1・3位とし、同順位内はbook_id昇順にする。

## 集計投影への接続

loan_statisticsには要求期間 × book_idの単位で貸出実績のある書籍を保存する。
stat_idはperiod_type/start/end/book_idから決定的に生成し、loan_countは書籍の貸出回数、loan_totalは期間内の全貸出件数、rankingはRDRAの順位、aggregated_atは確定時刻とする。
同期間の投影と監査を同じ取引で更新し、ページは全順位の確定後に切り出す。

## 再取得

| ケース | 結果 |
|---|---|
| 同じ要求を再実行 | 最新の確定状態を読み直す。同期間の投影を置換し加算しない |
| 通信失敗 | [TR-ERROR](../../../_cross-cutting/technical-rules.md#TR-ERROR)に従う。結果を成功と推定しない |
| 処理時間 | [NFR](../../../../../nfr/latest/nfr-grade.yaml)のB.2.1.3（10秒）を満たす |

## ティア完了条件

```gherkin
Feature: 人気書籍ランキングを参照するのAPI境界
  Scenario: 監査の失敗で情報を返さない
    Given 対象の参照には成功したが監査のINSERTが失敗する
    When getPopularBooksを実行する
    Then 503を返し業務情報を応答へ含めない
```
