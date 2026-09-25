<!-- basis: requirements@2920f64ec5a2cf148b060ab279273d7b2cbc1e18 adr@090e13b71116c495162f84a620b4d303817fac08 contracts@2920f64ec5a2cf148b060ab279273d7b2cbc1e18 | generated_at: 2026-09-25T02:22:44.490Z | slug: register-loan -->

# 貸出業務 / 貸出を登録する — 全シナリオのシーケンス (抽出)

アクターは 司書。正常系は [index.md](index.md) の「どう動くか」にも載せている。

## 他の利用者向けに取り置き中の蔵書は貸し出せない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as RegisterLoan
        participant p5 as FindPatronByNumber
        participant p6 as PatronRepository
        participant p8 as LoanRepository
    end
    participant p7 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 409
    p1->>p3: POST /loans
    p3->>+p4: execute
    p4->>+p5: execute
    p5->>+p6: findActiveByPatronNumber
    p6->>p7: SELECT patrons
    p6-->>-p5: ok
    p5-->>-p4: ok
    p4->>+p8: inTransaction
    p8->>p7: SELECT copies, books, reservations, patrons, loan_rules
    p8-->>-p4: error
    p4-->>-p3: error
    p3-->>p1: 409
    p1-->>-p0: ok
```

## 在庫ありの蔵書を貸し出す

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as RegisterLoan
        participant p5 as FindPatronByNumber
        participant p6 as PatronRepository
        participant p8 as LoanRepository
    end
    participant p7 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 201
    p1->>p3: POST /loans
    p3->>+p4: execute
    p4->>+p5: execute
    p5->>+p6: findActiveByPatronNumber
    p6->>p7: SELECT patrons
    p6-->>-p5: ok
    p5-->>-p4: ok
    p4->>+p8: inTransaction
    p8->>p7: SELECT copies, books, reservations, patrons, loan_rules
    p8->>p7: UPDATE copies
    p8->>p7: INSERT copy_events
    p8->>p7: INSERT loans
    p8->>p7: INSERT loan_events
    p8-->>-p4: ok
    p4-->>-p3: ok
    p3-->>p1: 201
    p1-->>-p0: ok
```

## 月をまたぐ返却期限も貸出日に貸出期間を加えて設定される

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as RegisterLoan
        participant p5 as FindPatronByNumber
        participant p6 as PatronRepository
        participant p8 as LoanRepository
    end
    participant p7 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 201
    p1->>p3: POST /loans
    p3->>+p4: execute
    p4->>+p5: execute
    p5->>+p6: findActiveByPatronNumber
    p6->>p7: SELECT patrons
    p6-->>-p5: ok
    p5-->>-p4: ok
    p4->>+p8: inTransaction
    p8->>p7: SELECT copies, books, reservations, patrons, loan_rules
    p8->>p7: UPDATE copies
    p8->>p7: INSERT copy_events
    p8->>p7: INSERT loans
    p8->>p7: INSERT loan_events
    p8-->>-p4: ok
    p4-->>-p3: ok
    p3-->>p1: 201
    p1-->>-p0: ok
```

## 本人向けに取り置き中の蔵書を貸し出すと予約が受取済みになる

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as RegisterLoan
        participant p5 as FindPatronByNumber
        participant p6 as PatronRepository
        participant p8 as LoanRepository
    end
    participant p7 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 201
    p1->>p3: POST /loans
    p3->>+p4: execute
    p4->>+p5: execute
    p5->>+p6: findActiveByPatronNumber
    p6->>p7: SELECT patrons
    p6-->>-p5: ok
    p5-->>-p4: ok
    p4->>+p8: inTransaction
    p8->>p7: SELECT copies, books, reservations, patrons, loan_rules
    p8->>p7: UPDATE copies
    p8->>p7: INSERT copy_events
    p8->>p7: INSERT loans
    p8->>p7: INSERT loan_events
    p8->>p7: UPDATE reservations
    p8->>p7: INSERT reservation_events
    p8-->>-p4: ok
    p4-->>-p3: ok
    p3-->>p1: 201
    p1-->>-p0: ok
```

## 貸出中の蔵書は貸し出せない

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as RegisterLoan
        participant p5 as FindPatronByNumber
        participant p6 as PatronRepository
        participant p8 as LoanRepository
    end
    participant p7 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 409
    p1->>p3: POST /loans
    p3->>+p4: execute
    p4->>+p5: execute
    p5->>+p6: findActiveByPatronNumber
    p6->>p7: SELECT patrons
    p6-->>-p5: ok
    p5-->>-p4: ok
    p4->>+p8: inTransaction
    p8->>p7: SELECT copies, books, reservations, patrons, loan_rules
    p8-->>-p4: error
    p4-->>-p3: error
    p3-->>p1: 409
    p1-->>-p0: ok
```

## 貸出登録時に貸出日に貸出期間を加えた返却期限が設定される

```mermaid
sequenceDiagram
    actor p0 as 司書
    box transparent frontend
        participant p1 as 貸出受付画面
    end
    participant p2 as /loans
    box transparent backend-api
        participant p3 as backend-api
        participant p4 as RegisterLoan
        participant p5 as FindPatronByNumber
        participant p6 as PatronRepository
        participant p8 as LoanRepository
    end
    participant p7 as DB
    p0->>+p1: submit
    p1->>p2: POST /loans
    p2-->>p1: 201
    p1->>p3: POST /loans
    p3->>+p4: execute
    p4->>+p5: execute
    p5->>+p6: findActiveByPatronNumber
    p6->>p7: SELECT patrons
    p6-->>-p5: ok
    p5-->>-p4: ok
    p4->>+p8: inTransaction
    p8->>p7: SELECT copies, books, reservations, patrons, loan_rules
    p8->>p7: UPDATE copies
    p8->>p7: INSERT copy_events
    p8->>p7: INSERT loans
    p8->>p7: INSERT loan_events
    p8-->>-p4: ok
    p4-->>-p3: ok
    p3-->>p1: 201
    p1-->>-p0: ok
```
