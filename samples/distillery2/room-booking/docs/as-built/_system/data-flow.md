# データフロー (抽出)

UC がどのテーブルを読み書きするか。R = Read、W = Write、RW = 両方。UC ごとの詳しい流れは各 UC の実装の記録の「どう動くか」。

| テーブル | 会議室を予約する | 会議室の空き状況を照会する |
|---|---|---|
| reservation_events | W | - |
| reservations | RW | R |
| room_slot_occupancies | W | - |
| rooms | R | R |

```mermaid
flowchart LR
    n4[会議室を予約する]
    n5[会議室の空き状況を照会する]
    n0[(reservation_events)]
    n1[(reservations)]
    n2[(room_slot_occupancies)]
    n3[(rooms)]
    n4 == Write ==> n0
    n4 == Read/Write ==> n1
    n4 == Write ==> n2
    n4 -. Read .-> n3
    n5 -. Read .-> n1
    n5 -. Read .-> n3
```
