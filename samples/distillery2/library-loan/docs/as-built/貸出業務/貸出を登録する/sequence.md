<!-- basis: requirements@6293d33ec217868e80d4dca1f65b7ee2411f83be adr@481506aca70dae9b5b64cefa6ea032e220651c7d contracts@6293d33ec217868e80d4dca1f65b7ee2411f83be | generated_at: 2026-09-26T02:13:22.592Z | slug: register-loan -->

# 貸出業務 / 貸出を登録する — 全シナリオのシーケンス (抽出)

アクターは 司書。正常系は [index.md](index.md) の「どう動くか」にも載せている。

## 予約待ちの書籍は予約順 1 位以外の利用者に貸し出せない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as TokenVerifier
        participant p5 as RegisterLoan
        participant p6 as UnitOfWork
        participant p7 as IdempotencyRepository
        participant p9 as BookRepository
        participant p10 as PatronRepository
        participant p11 as ReservationRepository
    end
    participant p8 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 409
    p1->>p3: POST /loans
    p3->>p4: verify
    p3->>+p5: execute
    p5->>+p6: run
    p6->>+p7: find
    p7->>p8: SELECT idempotency_keys
    p7-->>-p6: ok
    p6->>+p9: findForUpdate
    p9->>p8: SELECT books
    p9-->>-p6: ok
    p6->>+p10: findByPatronNumber
    p10->>p8: SELECT patrons
    p10-->>-p6: ok
    p6->>+p11: findFirstInQueueForUpdate
    p11->>p8: SELECT reservations
    p11-->>-p6: ok
    p6->>+p7: save
    p7->>p8: INSERT idempotency_keys
    p7-->>-p6: ok
    p6-->>-p5: ok
    p5-->>-p3: ok
    p3-->>p1: 409
    p1-->>-p0: ok
```

## 予約待ちの書籍を予約順 1 位の利用者に貸し出す

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as TokenVerifier
        participant p5 as RegisterLoan
        participant p6 as UnitOfWork
        participant p7 as IdempotencyRepository
        participant p9 as BookRepository
        participant p10 as PatronRepository
        participant p11 as ReservationRepository
        participant p12 as LoanRepository
    end
    participant p8 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 201
    p1->>p3: POST /loans
    p3->>p4: verify
    p3->>+p5: execute
    p5->>+p6: run
    p6->>+p7: find
    p7->>p8: SELECT idempotency_keys
    p7-->>-p6: ok
    p6->>+p9: findForUpdate
    p9->>p8: SELECT books
    p9-->>-p6: ok
    p6->>+p10: findByPatronNumber
    p10->>p8: SELECT patrons
    p10-->>-p6: ok
    p6->>+p11: findFirstInQueueForUpdate
    p11->>p8: SELECT reservations
    p11-->>-p6: ok
    p6->>+p12: register
    p12->>p8: INSERT loans
    p12->>p8: INSERT loan_events
    p12-->>-p6: ok
    p6->>+p9: markOnLoan
    p9->>p8: UPDATE books
    p9->>p8: INSERT book_events
    p9-->>-p6: ok
    p6->>+p11: complete
    p11->>p8: UPDATE reservations
    p11->>p8: INSERT reservation_events
    p11-->>-p6: ok
    p6->>+p7: save
    p7->>p8: INSERT idempotency_keys
    p7-->>-p6: ok
    p6-->>-p5: ok
    p5-->>-p3: ok
    p3-->>p1: 201
    p1-->>-p0: ok
```

## 在庫ありの書籍を登録済みの利用者に貸し出す

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as TokenVerifier
        participant p5 as RegisterLoan
        participant p6 as UnitOfWork
        participant p7 as IdempotencyRepository
        participant p9 as BookRepository
        participant p10 as PatronRepository
        participant p11 as LoanRepository
    end
    participant p8 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 201
    p1->>p3: POST /loans
    p3->>p4: verify
    p3->>+p5: execute
    p5->>+p6: run
    p6->>+p7: find
    p7->>p8: SELECT idempotency_keys
    p7-->>-p6: ok
    p6->>+p9: findForUpdate
    p9->>p8: SELECT books
    p9-->>-p6: ok
    p6->>+p10: findByPatronNumber
    p10->>p8: SELECT patrons
    p10-->>-p6: ok
    p6->>+p11: register
    p11->>p8: INSERT loans
    p11->>p8: INSERT loan_events
    p11-->>-p6: ok
    p6->>+p9: markOnLoan
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

## 登録されていない利用者には貸し出せない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as TokenVerifier
        participant p5 as RegisterLoan
        participant p6 as UnitOfWork
        participant p7 as IdempotencyRepository
        participant p9 as BookRepository
        participant p10 as PatronRepository
    end
    participant p8 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 409
    p1->>p3: POST /loans
    p3->>p4: verify
    p3->>+p5: execute
    p5->>+p6: run
    p6->>+p7: find
    p7->>p8: SELECT idempotency_keys
    p7-->>-p6: ok
    p6->>+p9: findForUpdate
    p9->>p8: SELECT books
    p9-->>-p6: ok
    p6->>+p10: findByPatronNumber
    p10->>p8: SELECT patrons
    p10-->>-p6: ok
    p6->>+p7: save
    p7->>p8: INSERT idempotency_keys
    p7-->>-p6: ok
    p6-->>-p5: ok
    p5-->>-p3: ok
    p3-->>p1: 409
    p1-->>-p0: ok
```

## 貸出を登録すると返却期限が自動で設定される

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as TokenVerifier
        participant p5 as RegisterLoan
        participant p6 as UnitOfWork
        participant p7 as IdempotencyRepository
        participant p9 as BookRepository
        participant p10 as PatronRepository
        participant p11 as LoanRepository
    end
    participant p8 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 201
    p1->>p3: POST /loans
    p3->>p4: verify
    p3->>+p5: execute
    p5->>+p6: run
    p6->>+p7: find
    p7->>p8: SELECT idempotency_keys
    p7-->>-p6: ok
    p6->>+p9: findForUpdate
    p9->>p8: SELECT books
    p9-->>-p6: ok
    p6->>+p10: findByPatronNumber
    p10->>p8: SELECT patrons
    p10-->>-p6: ok
    p6->>+p11: register
    p11->>p8: INSERT loans
    p11->>p8: INSERT loan_events
    p11-->>-p6: ok
    p6->>+p9: markOnLoan
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

## 貸出中の書籍は貸し出せない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as TokenVerifier
        participant p5 as RegisterLoan
        participant p6 as UnitOfWork
        participant p7 as IdempotencyRepository
        participant p9 as BookRepository
        participant p10 as PatronRepository
    end
    participant p8 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 409
    p1->>p3: POST /loans
    p3->>p4: verify
    p3->>+p5: execute
    p5->>+p6: run
    p6->>+p7: find
    p7->>p8: SELECT idempotency_keys
    p7-->>-p6: ok
    p6->>+p9: findForUpdate
    p9->>p8: SELECT books
    p9-->>-p6: ok
    p6->>+p10: findByPatronNumber
    p10->>p8: SELECT patrons
    p10-->>-p6: ok
    p6->>+p7: save
    p7->>p8: INSERT idempotency_keys
    p7-->>-p6: ok
    p6-->>-p5: ok
    p5-->>-p3: ok
    p3-->>p1: 409
    p1-->>-p0: ok
```
