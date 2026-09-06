# 督促を送信する

## 概要

延滞判定で作成した要求に基づき、利用者へ督促メールを配信する。既に返却された貸出には送信しない。

## データフロー

```mermaid
flowchart LR
  I["consumeDunning"] --> W["督促を送信する"]
  DB[("通知要求と延滞貸出、利用者、書籍")] --> W
  W --> O["送信結果と通知記録"]
  W --> R["処理結果とACK"]
```

## シーケンス

```mermaid
sequenceDiagram
  participant MQ as MQ
  participant W as Worker
  participant DB as RDB
  participant Mail as メール配信サービス
  MQ->>W: consumeDunning（notification_id）
  W->>DB: T-01 送信権と要求状態を照合
  alt T-01 sent / failed / unknown
    W-->>MQ: ACK（再送なし）
  else T-01 有効leaseのsending
    W-->>MQ: ACK（他workerが配信中、再送しない）
  else T-01 lease切れのsending
    W->>DB: unknownを確定
    W-->>MQ: ACK（手動照合）
  else T-01 claim可能なqueuedまたはpublished
    W->>DB: T-02 B-01の対象の現在状態を再取得
    alt T-02 対象外
      W->>DB: failedと監査TARGET_INACTIVEを確定
      W-->>MQ: ACK
    else 対象
      W->>DB: TR-MQの条件付きclaimをcommit（更新0件なら送信しない）
      W->>Mail: 通知内容を送信
      alt T-03 受理成功
        W->>DB: 送信結果と通知記録を同一取引でcommit
        W-->>MQ: commit後にACK
      else T-04 未送信が確実な障害
        W->>W: TR-MQの制限内で再試行
      else T-05 受理またはDB確定結果が不明
        W->>DB: unknownへ確定
        W-->>MQ: ACK（自動再送なし）
      end
    end
  end
```

## 分岐条件の接続

| 分岐ID | 正本 | 結果 |
|---|---|---|
| B-01 | [条件](../../../../../../rdra/latest/条件.tsv)の延滞判定 | 抽出時の業務対象を決める |
| T-01 | [TR-MQ](../../../_cross-cutting/technical-rules.md#TR-MQ) | 確定済み・有効lease→ACK、lease切れ→unknown、claim可能→状態再確認 |
| T-02 | worker仕様の送信対象 | 対象→送信権取得、対象外→送信抑止してACK |
| T-03/T-04/T-05 | [TR-MQ](../../../_cross-cutting/technical-rules.md#TR-MQ) | 受理成功→結果保存、確実な未送信→限定再試行、不明→自動送信停止 |

## 関連 RDRA モデル

| モデル | 要素 | 適用箇所 |
|---|---|---|
| [BUC](../../../../../../rdra/latest/BUC.tsv) | 期限管理業務 / 延滞者に督促するフロー / 督促を送信する | 日次起動と処理責任 |
| [情報](../../../../../../rdra/latest/情報.tsv) | 貸出, 利用者, 通知, 書籍 | 取得と保存 |
| [外部システム](../../../../../../rdra/latest/外部システム.tsv) | メール配信サービス | 配信workerの外部送信 |

## E2E 完了条件（BDD）

```gherkin
Feature: 督促を送信する
  Scenario: 督促を配信する
    Given L-001が延滞で未返却、督促N-001がqueuedである
    When workerがN-001を処理し、配信サービスが受理する
    Then 成功通知を1件保存し、N-001をsentにしてACKする

  Scenario: 返却済みを除外する
    Given 督促N-001の対象L-001が返却済みである
    When N-001を処理する
    Then メールを送らず対象外としてACKする

  Scenario: 送信結果が不明になる
    Given N-001の外部送信で応答が失われた
    When workerが復旧処理を実行する
    Then N-001をunknownとして保持し、自動再送を停止する
```

## ティア別仕様

- [worker仕様](tier-worker.md)
- [契約索引](_api-summary.yaml)のconsumeDunning

## 配信権の完了条件

```gherkin
Feature: 督促を送信するの配信権
  Scenario: 配信中の通知を別workerが受信する
    Given N-001はsendingでlease_untilが現在時刻より後である
    When 別workerが同じN-001を受信する
    Then 外部送信せずACKし、先行workerのclaimを維持する

  Scenario: 対象外抑止後に再配信される
    Given N-001は対象外としてfailedと監査TARGET_INACTIVEが保存済みである
    When 同じN-001を受信する
    Then メールと通知履歴を増やさずACKする
```
