<!-- basis: requirements@10d88a0262c31662f8fc16dcbe00973c396363cd adr@2f9d373dc26f6467cf0f95c62a65831fce0f9659 contracts@10d88a0262c31662f8fc16dcbe00973c396363cd | generated_at: 2026-09-24T00:12:39.628Z | slug: register-loan -->

# 貸出業務 / 貸出を登録する — 全シナリオのシーケンス (抽出)

アクターは 司書。正常系は [index.md](index.md) の「どう動くか」にも載せている。

## 利用者は貸出を登録できない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend-staff
        participant p1 as 貸出受付画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as RegisterLoan
        participant p4 as AccessLog
    end
    p0->>+p1: submit
    p1->>p2: POST /api/v1/loans
    p2->>+p3: execute
    p3->>p4: record
    p3-->>-p2: error
    p2-->>p1: 403
    p1-->>-p0: ok
```

## 削除済みの利用者には貸し出せない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend-staff
        participant p1 as 貸出受付画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as RegisterLoan
        participant p4 as PgLoanRegistrationRepository
        participant p6 as AccessLog
    end
    participant p5 as DB
    p0->>+p1: submit
    p1->>p2: POST /api/v1/loans
    p2->>+p3: execute
    p3->>+p4: loadLendingContext
    p4->>p5: SELECT loans, patrons, books, reservations
    p4-->>-p3: ok
    p3->>p6: record
    p3-->>-p2: error
    p2-->>p1: 404
    p1-->>-p0: ok
```

## 削除済みの書籍は貸し出せない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend-staff
        participant p1 as 貸出受付画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as RegisterLoan
        participant p4 as PgLoanRegistrationRepository
        participant p6 as AccessLog
    end
    participant p5 as DB
    p0->>+p1: submit
    p1->>p2: POST /api/v1/loans
    p2->>+p3: execute
    p3->>+p4: loadLendingContext
    p4->>p5: SELECT loans, patrons, books, reservations
    p4-->>-p3: ok
    p3->>p6: record
    p3-->>-p2: error
    p2-->>p1: 404
    p1-->>-p0: ok
```

## 取置の書籍は取置中の予約を持たない利用者には貸し出せない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend-staff
        participant p1 as 貸出受付画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as RegisterLoan
        participant p4 as PgLoanRegistrationRepository
        participant p6 as AccessLog
    end
    participant p5 as DB
    p0->>+p1: submit
    p1->>p2: POST /api/v1/loans
    p2->>+p3: execute
    p3->>+p4: loadLendingContext
    p4->>p5: SELECT loans, patrons, books, reservations
    p4-->>-p3: ok
    p3->>p6: record
    p3-->>-p2: error
    p2-->>p1: 409
    p1-->>-p0: ok
```

## 取置中の予約を持つ予約順 1 位の利用者には取置の書籍を貸し出せる

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend-staff
        participant p1 as 貸出受付画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as RegisterLoan
        participant p4 as PgLoanRegistrationRepository
        participant p6 as AccessLog
    end
    participant p5 as DB
    p0->>+p1: submit
    p1->>p2: POST /api/v1/loans
    p2->>+p3: execute
    p3->>+p4: loadLendingContext
    p4->>p5: SELECT loans, patrons, books, reservations
    p4-->>-p3: ok
    p3->>+p4: save
    p4->>p5: SAVEPOINT
    p4->>p5: UPDATE books
    p4->>p5: INSERT book_events
    p4->>p5: INSERT loans
    p4->>p5: INSERT loan_events
    p4->>p5: UPDATE reservations
    p4->>p5: INSERT reservation_events
    p4->>p5: SELECT reservations
    p4->>p5: RELEASE
    p4-->>-p3: ok
    p3->>p6: record
    p3-->>-p2: ok
    p2-->>p1: 201
    p1-->>-p0: ok
```

## 在庫ありの書籍を登録済みの利用者に貸し出す

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend-staff
        participant p1 as 貸出受付画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as RegisterLoan
        participant p4 as PgLoanRegistrationRepository
        participant p6 as AccessLog
    end
    participant p5 as DB
    p0->>+p1: submit
    p1->>p2: POST /api/v1/loans
    p2->>+p3: execute
    p3->>+p4: loadLendingContext
    p4->>p5: SELECT loans, patrons, books, reservations
    p4-->>-p3: ok
    p3->>+p4: save
    p4->>p5: SAVEPOINT
    p4->>p5: UPDATE books
    p4->>p5: INSERT book_events
    p4->>p5: INSERT loans
    p4->>p5: INSERT loan_events
    p4->>p5: RELEASE
    p4-->>-p3: ok
    p3->>p6: record
    p3-->>-p2: ok
    p2-->>p1: 201
    p1-->>-p0: ok
```

## 延滞中の貸出を持つ利用者には貸し出せない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend-staff
        participant p1 as 貸出受付画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as RegisterLoan
        participant p4 as PgLoanRegistrationRepository
        participant p6 as AccessLog
    end
    participant p5 as DB
    p0->>+p1: submit
    p1->>p2: POST /api/v1/loans
    p2->>+p3: execute
    p3->>+p4: loadLendingContext
    p4->>p5: SELECT loans, patrons, books, reservations
    p4-->>-p3: ok
    p3->>p6: record
    p3-->>-p2: error
    p2-->>p1: 409
    p1-->>-p0: ok
```

## 貸出を登録すると返却期限が自動で設定される

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend-staff
        participant p1 as 貸出受付画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as RegisterLoan
        participant p4 as PgLoanRegistrationRepository
        participant p6 as AccessLog
    end
    participant p5 as DB
    p0->>+p1: submit
    p1->>p2: POST /api/v1/loans
    p2->>+p3: execute
    p3->>+p4: loadLendingContext
    p4->>p5: SELECT loans, patrons, books, reservations
    p4-->>-p3: ok
    p3->>+p4: save
    p4->>p5: SAVEPOINT
    p4->>p5: UPDATE books
    p4->>p5: INSERT book_events
    p4->>p5: INSERT loans
    p4->>p5: INSERT loan_events
    p4->>p5: RELEASE
    p4-->>-p3: ok
    p3->>p6: record
    p3-->>-p2: ok
    p2-->>p1: 201
    p1-->>-p0: ok
```

## 貸出中の書籍は同じ書籍として貸し出せない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend-staff
        participant p1 as 貸出受付画面
    end
    box transparent backend-api
        participant p2 as backend-api
        participant p3 as RegisterLoan
        participant p4 as PgLoanRegistrationRepository
        participant p6 as AccessLog
    end
    participant p5 as DB
    p0->>+p1: submit
    p1->>p2: POST /api/v1/loans
    p2->>+p3: execute
    p3->>+p4: loadLendingContext
    p4->>p5: SELECT loans, patrons, books, reservations
    p4-->>-p3: ok
    p3->>p6: record
    p3-->>-p2: error
    p2-->>p1: 409
    p1-->>-p0: ok
```
