# データフロー (抽出)

UC がどのテーブルを読み書きするか。R = Read、W = Write、RW = 両方。UC ごとの詳しい流れは各 UC の実装の記録の「どう動くか」。

| テーブル | 貸出を登録する |
|---|---|
| book_events | W |
| books | RW |
| idempotency_keys | RW |
| loan_events | W |
| loans | W |
| patrons | R |
| reservation_events | W |
| reservations | RW |

```mermaid
flowchart LR
    n8[貸出を登録する]
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
```
