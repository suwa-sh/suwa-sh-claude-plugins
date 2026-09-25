# データフロー (抽出)

UC がどのテーブルを読み書きするか。R = Read、W = Write、RW = 両方。UC ごとの詳しい流れは各 UC の実装の記録の「どう動くか」。

| テーブル | 貸出を登録する |
|---|---|
| books | R |
| copies | RW |
| copy_events | W |
| loan_events | W |
| loan_rules | R |
| loans | W |
| patrons | R |
| reservation_events | W |
| reservations | RW |

```mermaid
flowchart LR
    n9[貸出を登録する]
    n0[(books)]
    n1[(copies)]
    n2[(copy_events)]
    n3[(loan_events)]
    n4[(loan_rules)]
    n5[(loans)]
    n6[(patrons)]
    n7[(reservation_events)]
    n8[(reservations)]
    n9 -. Read .-> n0
    n9 == Read/Write ==> n1
    n9 == Write ==> n2
    n9 == Write ==> n3
    n9 -. Read .-> n4
    n9 == Write ==> n5
    n9 -. Read .-> n6
    n9 == Write ==> n7
    n9 == Read/Write ==> n8
```
