<!-- basis: requirements@affbf164e2f7afdb8468b05d8ca76387d572b634 adr@481506aca70dae9b5b64cefa6ea032e220651c7d contracts@affbf164e2f7afdb8468b05d8ca76387d572b634 | generated_at: 2026-09-26T04:26:30.681Z | slug: register-return -->

# 貸出業務 / 返却を登録する — 全シナリオのシーケンス (抽出)

アクターは 司書。正常系は [index.md](index.md) の「どう動くか」にも載せている。

## 予約のある貸出中の書籍の返却を登録する

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 返却受付画面
    end
    participant p2 as /returns
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as TokenVerifier
        participant p5 as RegisterReturn
        participant p6 as UnitOfWork
        participant p7 as IdempotencyRepository
        participant p9 as BookRepository
        participant p10 as LoanRepository
        participant p11 as ReservationRepository
    end
    participant p8 as DB
    p0->>+p1: submit
    p1->>p2: POST /returns
    p2-->>p1: 201
    p1->>p3: POST /returns
    p3->>p4: verify
    p3->>p5: isAllowed
    p3->>+p5: execute
    p5->>+p6: run
    p6->>+p7: find
    p7->>p8: SELECT idempotency_keys
    p7-->>-p6: ok
    p6->>+p9: findForUpdate
    p9->>p8: SELECT books
    p9-->>-p6: ok
    p6->>+p10: findUnreturnedByBookForUpdate
    p10->>p8: SELECT loans
    p10-->>-p6: ok
    p6->>+p11: hasWaiting
    p11->>p8: SELECT reservations
    p11-->>-p6: ok
    p6->>+p10: markReturned
    p10->>p8: UPDATE loans
    p10->>p8: INSERT loan_events
    p10-->>-p6: ok
    p6->>+p9: markReturned
    p9->>p8: UPDATE books
    p9->>p8: INSERT book_events
    p9-->>-p6: ok
    p6->>+p7: save
    p7->>p8: INSERT idempotency_keys
    p7-->>-p6: ok
    p6-->>-p5: ok
    p5-->>-p3: ok
    p3-->>p1: 201
    p1-->>-p0: ok
```

## 予約のない貸出中の書籍の返却を登録する

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 返却受付画面
    end
    participant p2 as /returns
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as TokenVerifier
        participant p5 as RegisterReturn
        participant p6 as UnitOfWork
        participant p7 as IdempotencyRepository
        participant p9 as BookRepository
        participant p10 as LoanRepository
        participant p11 as ReservationRepository
    end
    participant p8 as DB
    p0->>+p1: submit
    p1->>p2: POST /returns
    p2-->>p1: 201
    p1->>p3: POST /returns
    p3->>p4: verify
    p3->>p5: isAllowed
    p3->>+p5: execute
    p5->>+p6: run
    p6->>+p7: find
    p7->>p8: SELECT idempotency_keys
    p7-->>-p6: ok
    p6->>+p9: findForUpdate
    p9->>p8: SELECT books
    p9-->>-p6: ok
    p6->>+p10: findUnreturnedByBookForUpdate
    p10->>p8: SELECT loans
    p10-->>-p6: ok
    p6->>+p11: hasWaiting
    p11->>p8: SELECT reservations
    p11-->>-p6: ok
    p6->>+p10: markReturned
    p10->>p8: UPDATE loans
    p10->>p8: INSERT loan_events
    p10-->>-p6: ok
    p6->>+p9: markReturned
    p9->>p8: UPDATE books
    p9->>p8: INSERT book_events
    p9-->>-p6: ok
    p6->>+p7: save
    p7->>p8: INSERT idempotency_keys
    p7-->>-p6: ok
    p6-->>-p5: ok
    p5-->>-p3: ok
    p3-->>p1: 201
    p1-->>-p0: ok
```

## 延滞している書籍の返却を登録する

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 返却受付画面
    end
    participant p2 as /returns
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as TokenVerifier
        participant p5 as RegisterReturn
        participant p6 as UnitOfWork
        participant p7 as IdempotencyRepository
        participant p9 as BookRepository
        participant p10 as LoanRepository
        participant p11 as ReservationRepository
    end
    participant p8 as DB
    p0->>+p1: submit
    p1->>p2: POST /returns
    p2-->>p1: 201
    p1->>p3: POST /returns
    p3->>p4: verify
    p3->>p5: isAllowed
    p3->>+p5: execute
    p5->>+p6: run
    p6->>+p7: find
    p7->>p8: SELECT idempotency_keys
    p7-->>-p6: ok
    p6->>+p9: findForUpdate
    p9->>p8: SELECT books
    p9-->>-p6: ok
    p6->>+p10: findUnreturnedByBookForUpdate
    p10->>p8: SELECT loans
    p10-->>-p6: ok
    p6->>+p11: hasWaiting
    p11->>p8: SELECT reservations
    p11-->>-p6: ok
    p6->>+p10: markReturned
    p10->>p8: UPDATE loans
    p10->>p8: INSERT loan_events
    p10-->>-p6: ok
    p6->>+p9: markReturned
    p9->>p8: UPDATE books
    p9->>p8: INSERT book_events
    p9-->>-p6: ok
    p6->>+p7: save
    p7->>p8: INSERT idempotency_keys
    p7-->>-p6: ok
    p6-->>-p5: ok
    p5-->>-p3: ok
    p3-->>p1: 201
    p1-->>-p0: ok
```

## 未返却の貸出が無い書籍は返却を登録できない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 返却受付画面
    end
    participant p2 as /returns
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as TokenVerifier
        participant p5 as RegisterReturn
        participant p6 as UnitOfWork
        participant p7 as IdempotencyRepository
        participant p9 as BookRepository
        participant p10 as LoanRepository
    end
    participant p8 as DB
    p0->>+p1: submit
    p1->>p2: POST /returns
    p2-->>p1: 409
    p1->>p3: POST /returns
    p3->>p4: verify
    p3->>p5: isAllowed
    p3->>+p5: execute
    p5->>+p6: run
    p6->>+p7: find
    p7->>p8: SELECT idempotency_keys
    p7-->>-p6: ok
    p6->>+p9: findForUpdate
    p9->>p8: SELECT books
    p9-->>-p6: ok
    p6->>+p10: findUnreturnedByBookForUpdate
    p10->>p8: SELECT loans
    p10-->>-p6: ok
    p6->>+p7: save
    p7->>p8: INSERT idempotency_keys
    p7-->>-p6: ok
    p6-->>-p5: ok
    p5-->>-p3: ok
    p3-->>p1: 409
    p1-->>-p0: ok
```
