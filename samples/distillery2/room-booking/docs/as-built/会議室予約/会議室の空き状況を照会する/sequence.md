<!-- basis: requirements@64517f420b568ea1a4536b71b9dbbb357bd66460 adr@ed9e1fbd3b234cada613ca9357dd6e5ae36271e8 contracts@0ff5299f454e51558068882d06530ff940c50f62 | generated_at: 2026-11-10T04:17:46.482Z | slug: view-room-availability -->

# 会議室予約 / 会議室の空き状況を照会する — 全シナリオのシーケンス (抽出)

アクターは 社員。正常系は [index.md](index.md) の「どう動くか」にも載せている。

## 30 分刻みでない時刻は照会を受け付けない

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
    end
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>p4: execute
    p2-->>p1: 422
    p1-->>-p0: ok
```

## 予約のある会議室は予約済み、予約の無い会議室は空きと表示される

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
        participant p5 as RoomAvailabilityRepository
    end
    participant p6 as DB
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>+p4: execute
    p4->>+p5: listRooms
    p5->>p6: SELECT rooms
    p5-->>-p4: ok
    p4->>+p5: listReservations
    p5->>p6: SELECT reservations
    p5-->>-p4: ok
    p4-->>-p2: ok
    p2-->>p1: 200
    p1-->>-p0: ok
```

## 予約の時間帯と一部でも重なる時間帯は予約済みと表示される

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
        participant p5 as RoomAvailabilityRepository
    end
    participant p6 as DB
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>+p4: execute
    p4->>+p5: listRooms
    p5->>p6: SELECT rooms
    p5-->>-p4: ok
    p4->>+p5: listReservations
    p5->>p6: SELECT reservations
    p5-->>-p4: ok
    p4-->>-p2: ok
    p2-->>p1: 200
    p1-->>-p0: ok
```

## 予約の終了時刻から始まる時間帯は空きと表示される

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
        participant p5 as RoomAvailabilityRepository
    end
    participant p6 as DB
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>+p4: execute
    p4->>+p5: listRooms
    p5->>p6: SELECT rooms
    p5-->>-p4: ok
    p4->>+p5: listReservations
    p5->>p6: SELECT reservations
    p5-->>-p4: ok
    p4-->>-p2: ok
    p2-->>p1: 200
    p1-->>-p0: ok
```

## 予約済みの会議室に予約者の名前は表示されない

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
        participant p5 as RoomAvailabilityRepository
    end
    participant p6 as DB
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>+p4: execute
    p4->>+p5: listRooms
    p5->>p6: SELECT rooms
    p5-->>-p4: ok
    p4->>+p5: listReservations
    p5->>p6: SELECT reservations
    p5-->>-p4: ok
    p4-->>-p2: ok
    p2-->>p1: 200
    p1-->>-p0: ok
```

## 会議室名が表示順に並んで表示される

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
        participant p5 as RoomAvailabilityRepository
    end
    participant p6 as DB
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>+p4: execute
    p4->>+p5: listRooms
    p5->>p6: SELECT rooms
    p5-->>-p4: ok
    p4->>+p5: listReservations
    p5->>p6: SELECT reservations
    p5-->>-p4: ok
    p4-->>-p2: ok
    p2-->>p1: 200
    p1-->>-p0: ok
```

## 全会議室が会議室ごとに表示される

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
        participant p5 as RoomAvailabilityRepository
    end
    participant p6 as DB
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>+p4: execute
    p4->>+p5: listRooms
    p5->>p6: SELECT rooms
    p5-->>-p4: ok
    p4->>+p5: listReservations
    p5->>p6: SELECT reservations
    p5-->>-p4: ok
    p4-->>-p2: ok
    p2-->>p1: 200
    p1-->>-p0: ok
```

## 取り消された予約は予約済みとして扱わない

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
        participant p5 as RoomAvailabilityRepository
    end
    participant p6 as DB
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>+p4: execute
    p4->>+p5: listRooms
    p5->>p6: SELECT rooms
    p5-->>-p4: ok
    p4->>+p5: listReservations
    p5->>p6: SELECT reservations
    p5-->>-p4: ok
    p4-->>-p2: ok
    p2-->>p1: 200
    p1-->>-p0: ok
```

## 日をまたぐ時間帯は照会を受け付けない

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
    end
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>p4: execute
    p2-->>p1: 422
    p1-->>-p0: ok
```

## 終了が翌日 0:00 の時間帯は照会を受け付ける

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
        participant p5 as RoomAvailabilityRepository
    end
    participant p6 as DB
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>+p4: execute
    p4->>+p5: listRooms
    p5->>p6: SELECT rooms
    p5-->>-p4: ok
    p4->>+p5: listReservations
    p5->>p6: SELECT reservations
    p5-->>-p4: ok
    p4-->>-p2: ok
    p2-->>p1: 200
    p1-->>-p0: ok
```

## 過去の時間帯でも重なる有効な予約が無い会議室は空きと表示される

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
        participant p5 as RoomAvailabilityRepository
    end
    participant p6 as DB
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>+p4: execute
    p4->>+p5: listRooms
    p5->>p6: SELECT rooms
    p5-->>-p4: ok
    p4->>+p5: listReservations
    p5->>p6: SELECT reservations
    p5-->>-p4: ok
    p4-->>-p2: ok
    p2-->>p1: 200
    p1-->>-p0: ok
```

## 過去の時間帯の照会は受け付ける

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
        participant p5 as RoomAvailabilityRepository
    end
    participant p6 as DB
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>+p4: execute
    p4->>+p5: listRooms
    p5->>p6: SELECT rooms
    p5-->>-p4: ok
    p4->>+p5: listReservations
    p5->>p6: SELECT reservations
    p5-->>-p4: ok
    p4-->>-p2: ok
    p2-->>p1: 200
    p1-->>-p0: ok
```

## 開始時刻が終了時刻より後の時間帯は照会を受け付けない

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
    end
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>p4: execute
    p2-->>p1: 422
    p1-->>-p0: ok
```

## 開始時刻と終了時刻が同じ時間帯は照会を受け付けない

```mermaid
sequenceDiagram
    actor p0 as 社員
    box transparent frontend
        participant p1 as 空き状況画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as TokenVerifier
        participant p4 as ViewRoomAvailability
    end
    p0->>+p1: showRoomAvailability
    p1->>p2: POST /api/room-availability
    p2->>p3: verify
    p2->>p4: execute
    p2-->>p1: 422
    p1-->>-p0: ok
```
