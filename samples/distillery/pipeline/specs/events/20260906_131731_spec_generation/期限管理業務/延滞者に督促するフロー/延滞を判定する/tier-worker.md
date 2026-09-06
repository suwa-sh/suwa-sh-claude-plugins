# 延滞を判定するのworker仕様

## 責務

consumeOverdueScheduleを受け取り、貸出の延滞遷移、貸出イベント、督促要求、outboxを確定する。

## 契約

[API索引](_api-summary.yaml)のconsumeOverdueScheduleとpublishDunningを参照する。

## 実行条件

| 対象 | 処理 |
|---|---|
| 走査 | loan_idを昇順に100件ずつ読み、対象候補を再確認する。lock待ちを飛ばして成功扱いにしない |
| トランザクション | 貸出1件を単位に貸出の延滞遷移、貸出イベント、督促要求、outboxを保存する。先行貸出のcommitは後続の失敗で戻さない |
| 再開 | 同じbusiness_dateで全体を再走査し、cause_keyと現在状態で確定済み対象を除く |
| 日付 | DailyRun.business_dateを使用し、再実行時に現在日付へ置き換えない |
| 順序 | 同一business_dateの延滞判定を完了してからリマインド抽出を起動する。延滞判定が失敗した日はリマインドを開始しない |
| 再判定 | 現在状態が貸出中で、期限を超過する場合だけ延滞へ更新する。既に延滞の貸出は新しい督促要求を作らない |


## 障害と再実行

| 境界 | 処理 |
|---|---|
| DB利用不可 | ACKしない。更新が確定したかを次回RDBで照合する |
| MQ公開失敗 | 確定outboxを維持して再公開する |
| 配信の重複、再試行、結果不明 | [TR-MQ](../../../_cross-cutting/technical-rules.md#TR-MQ)を適用する |
| 状態変更 | [TR-TX](../../../_cross-cutting/technical-rules.md#TR-TX)のlock順と原子性を適用する |

## データ操作

[_model-summary.yaml](_model-summary.yaml)と[RDB所有者索引](../../../_cross-cutting/datastore/generated/table-index.yaml)を参照する。

## ティア完了条件

```gherkin
Feature: 延滞を判定するのworker
  Scenario: DB利用不可ではACKしない
    Given 要求を受信したがRDBへ接続できない
    When workerが要求を処理する
    Then ACKせず、外部送信もしない
```
