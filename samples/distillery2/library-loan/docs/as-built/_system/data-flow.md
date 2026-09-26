# データフロー (抽出)

UC がどのテーブルを読み書きするか。R = Read、W = Write、RW = 両方。UC ごとの詳しい流れは各 UC の実装の記録の「どう動くか」。

| テーブル | 貸出を登録する | 返却を登録する |
|---|---|---|
| book_events | W | W |
| books | RW | RW |
| idempotency_keys | RW | RW |
| loan_events | W | W |
| loans | W | RW |
| patrons | R | - |
| reservation_events | W | - |
| reservations | RW | R |

```mermaid
flowchart LR
    n8[貸出を登録する]
    n9[返却を登録する]
    n0[(book_events)]
    n1[(books)]
    n2[(idempotency_keys)]
    n3[(loan_events)]
    n4[(loans)]
    n5[(patrons)]
    n6[(reservation_events)]
    n7[(reservations)]
    n8 == Write ==> n0
    n8 == Read/Write ==> n1
    n8 == Read/Write ==> n2
    n8 == Write ==> n3
    n8 == Write ==> n4
    n8 -. Read .-> n5
    n8 == Write ==> n6
    n8 == Read/Write ==> n7
    n9 == Write ==> n0
    n9 == Read/Write ==> n1
    n9 == Read/Write ==> n2
    n9 == Write ==> n3
    n9 == Read/Write ==> n4
    n9 -. Read .-> n7
```
