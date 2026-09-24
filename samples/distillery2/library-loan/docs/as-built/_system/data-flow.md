# データフロー (抽出)

UC がどのテーブルを読み書きするか。R = Read、W = Write、RW = 両方。UC ごとの詳しい流れは各 UC の実装の記録の「どう動くか」。

| テーブル | 貸出を登録する |
|---|---|
| book_events | W |
| books | RW |
| loan_events | W |
| loans | RW |
| patrons | R |
| reservation_events | W |
| reservations | RW |

```mermaid
flowchart LR
    n7[貸出を登録する]
    n0[(book_events)]
    n1[(books)]
    n2[(loan_events)]
    n3[(loans)]
    n4[(patrons)]
    n5[(reservation_events)]
    n6[(reservations)]
    n7 == Write ==> n0
    n7 == Read/Write ==> n1
    n7 == Write ==> n2
    n7 == Read/Write ==> n3
    n7 -. Read .-> n4
    n7 == Write ==> n5
    n7 == Read/Write ==> n6
```
