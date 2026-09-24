<!-- basis: requirements@c99a17fdd8915399a17cdd205937316c051e9e02 adr@2f9d373dc26f6467cf0f95c62a65831fce0f9659 contracts@c99a17fdd8915399a17cdd205937316c051e9e02 | generated_at: 2026-09-24T00:10:02.802Z | slug: register-loan -->

# 貸出業務 / 貸出を登録する — シーケンス (抽出)

## register-loan#延滞中の貸出を持つ利用者には貸し出せない

```mermaid
sequenceDiagram
    actor p0________ as シナリオ実行者
    participant p1_PgLoanRegistrationRepository as PgLoanRegistrationRepository
    participant p2_DB as DB
    participant p3_backend_api as backend-api
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT loans, patrons
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT books
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT reservations
    p0________->>p3_backend_api: POST /loans
    p3_backend_api-->>p0________: 409
```

## register-loan#在庫ありの書籍を登録済みの利用者に貸し出す

```mermaid
sequenceDiagram
    actor p0________ as シナリオ実行者
    participant p1_PgLoanRegistrationRepository as PgLoanRegistrationRepository
    participant p2_DB as DB
    participant p3_backend_api as backend-api
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT loans, patrons
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT books
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT reservations
    p1_PgLoanRegistrationRepository->>p2_DB: SAVEPOINT
    p1_PgLoanRegistrationRepository->>p2_DB: UPDATE books
    p1_PgLoanRegistrationRepository->>p2_DB: INSERT book_events
    p1_PgLoanRegistrationRepository->>p2_DB: INSERT loans
    p1_PgLoanRegistrationRepository->>p2_DB: INSERT loan_events
    p1_PgLoanRegistrationRepository->>p2_DB: RELEASE
    p0________->>p3_backend_api: POST /loans
    p3_backend_api-->>p0________: 201
```

## register-loan#削除済みの書籍は貸し出せない

```mermaid
sequenceDiagram
    actor p0________ as シナリオ実行者
    participant p1_PgLoanRegistrationRepository as PgLoanRegistrationRepository
    participant p2_DB as DB
    participant p3_backend_api as backend-api
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT loans, patrons
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT books
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT reservations
    p0________->>p3_backend_api: POST /loans
    p3_backend_api-->>p0________: 404
```

## register-loan#削除済みの利用者には貸し出せない

```mermaid
sequenceDiagram
    actor p0________ as シナリオ実行者
    participant p1_PgLoanRegistrationRepository as PgLoanRegistrationRepository
    participant p2_DB as DB
    participant p3_backend_api as backend-api
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT loans, patrons
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT books
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT reservations
    p0________->>p3_backend_api: POST /loans
    p3_backend_api-->>p0________: 404
```

## register-loan#取置の書籍は取置中の予約を持たない利用者には貸し出せない

```mermaid
sequenceDiagram
    actor p0________ as シナリオ実行者
    participant p1_PgLoanRegistrationRepository as PgLoanRegistrationRepository
    participant p2_DB as DB
    participant p3_backend_api as backend-api
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT loans, patrons
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT books
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT reservations
    p0________->>p3_backend_api: POST /loans
    p3_backend_api-->>p0________: 409
```

## register-loan#取置中の予約を持つ予約順 1 位の利用者には取置の書籍を貸し出せる

```mermaid
sequenceDiagram
    actor p0________ as シナリオ実行者
    participant p1_PgLoanRegistrationRepository as PgLoanRegistrationRepository
    participant p2_DB as DB
    participant p3_backend_api as backend-api
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT loans, patrons
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT books
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT reservations
    p1_PgLoanRegistrationRepository->>p2_DB: SAVEPOINT
    p1_PgLoanRegistrationRepository->>p2_DB: UPDATE books
    p1_PgLoanRegistrationRepository->>p2_DB: INSERT book_events
    p1_PgLoanRegistrationRepository->>p2_DB: INSERT loans
    p1_PgLoanRegistrationRepository->>p2_DB: INSERT loan_events
    p1_PgLoanRegistrationRepository->>p2_DB: UPDATE reservations
    p1_PgLoanRegistrationRepository->>p2_DB: INSERT reservation_events
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT reservations
    p1_PgLoanRegistrationRepository->>p2_DB: RELEASE
    p0________->>p3_backend_api: POST /loans
    p3_backend_api-->>p0________: 201
```

## register-loan#貸出を登録すると返却期限が自動で設定される

```mermaid
sequenceDiagram
    actor p0________ as シナリオ実行者
    participant p1_PgLoanRegistrationRepository as PgLoanRegistrationRepository
    participant p2_DB as DB
    participant p3_backend_api as backend-api
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT loans, patrons
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT books
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT reservations
    p1_PgLoanRegistrationRepository->>p2_DB: SAVEPOINT
    p1_PgLoanRegistrationRepository->>p2_DB: UPDATE books
    p1_PgLoanRegistrationRepository->>p2_DB: INSERT book_events
    p1_PgLoanRegistrationRepository->>p2_DB: INSERT loans
    p1_PgLoanRegistrationRepository->>p2_DB: INSERT loan_events
    p1_PgLoanRegistrationRepository->>p2_DB: RELEASE
    p0________->>p3_backend_api: POST /loans
    p3_backend_api-->>p0________: 201
```

## register-loan#貸出中の書籍は同じ書籍として貸し出せない

```mermaid
sequenceDiagram
    actor p0________ as シナリオ実行者
    participant p1_PgLoanRegistrationRepository as PgLoanRegistrationRepository
    participant p2_DB as DB
    participant p3_backend_api as backend-api
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT loans, patrons
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT books
    p1_PgLoanRegistrationRepository->>p2_DB: SELECT reservations
    p0________->>p3_backend_api: POST /loans
    p3_backend_api-->>p0________: 409
```

## register-loan#利用者は貸出を登録できない

```mermaid
sequenceDiagram
    actor p0________ as シナリオ実行者
    participant p1_backend_api as backend-api
    p0________->>p1_backend_api: POST /loans
    p1_backend_api-->>p0________: 403
```
