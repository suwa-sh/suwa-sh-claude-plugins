# データフロー (抽出)

UC がどのテーブルを読み書きするか。R = 読む、W = 書く、RW = 両方。UC ごとの詳しい流れは各 as-built の「どう動くか」。

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
    n7 == 書 ==> n0
    n7 == 読/書 ==> n1
    n7 == 書 ==> n2
    n7 == 読/書 ==> n3
    n7 -. 読 .-> n4
    n7 == 書 ==> n5
    n7 == 読/書 ==> n6
```
