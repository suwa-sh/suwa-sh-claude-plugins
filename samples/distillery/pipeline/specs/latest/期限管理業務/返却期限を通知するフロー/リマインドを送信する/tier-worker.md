# リマインドを送信するのworker仕様

## 責務

consumeReminderを受け取り、送信結果と通知記録を確定する。

## 契約

[API索引](_api-summary.yaml)のconsumeReminderを参照する。

## 実行条件

| 対象 | 処理 |
|---|---|
| 送信対象 | 未返却の貸出中でB-01が成立する貸出。利用者の現在メールアドレスを取得し、宛先不正はfailedとする |
| 本文 | 通知種別、書籍名、貸出ID、返却期限を含む。リマインドには返却期限が近い旨を示す。利用者番号やメール本文を実行ログへ出さない |
| 遅延要求 | 送信直前の状態が返却済みなら対象外として処理する。貸出IDを別の貸出へ置き換えない |
| 要求の同一性 | messageのloan_idとoutboxの対象貸出IDを照合し、不一致ならDLQへ隔離して送信しない |
| 処理単位 | notification_idごとに送信権を獲得する。SQL取引を保持したまま外部送信しない |
| 再評価 | 送信時の業務日と有効remind_daysでリマインド条件を照合する。現在状態が延滞なら督促要求へ委ねてリマインドを送らない |


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
Feature: リマインドを送信するのworker
  Scenario: DB利用不可ではACKしない
    Given 要求を受信したがRDBへ接続できない
    When workerが要求を処理する
    Then ACKせず、外部送信もしない
```

```gherkin
Feature: リマインドを送信するの結果確定
  Scenario: 送信権を失ったworkerが結果を保存する
    Given N-001のclaimが既にunknownへ移り元のclaim条件に一致しない
    When 元のworkerが成功通知を保存してoutboxを条件付き更新する
    Then 更新件数0を検出して通知と業務状態の変更をrollbackする

  Scenario: ACK済みの重複後に送信workerが停止する
    Given 重複受信が有効leaseを確認してACKし、元workerが停止した
    When lease切れ後の毎分復旧走査がN-001を検出する
    Then N-001をunknownへ変更し自動再送を停止する
```
