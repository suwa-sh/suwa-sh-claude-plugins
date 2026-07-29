// 出典: _cross-cutting/datastore/rdb-schema.yaml loans テーブル

/**
 * RDB の UNIQUE 制約違反(uq_loans_idempotency_key 等)を表すリポジトリ層のエラー。
 * 出典: tier-backend-api.md ビジネスルール「冪等キーは KVS で重複チェック後、
 * RDB の UNIQUE 制約で二重防止」。KVS の事前チェックをすり抜けた重複はこの経路で検出される
 * (docs/impl/latest/19ec0182/stages/attempt-1/S5_verify.tier-backend-api.findings.yaml F-003)。
 * application 層(createLoanUseCase)がこれを捕捉し、409(ConflictError)へ変換する。
 */
export class UniqueConstraintViolationError extends Error {
  constructor(
    readonly constraintName: string,
    message: string,
  ) {
    super(message);
    this.name = "UniqueConstraintViolationError";
  }
}

export interface Loan {
  id: string;
  bookId: string;
  userId: string;
  loanDate: Date;
  dueDate: Date;
  returnDate: Date | null;
  isOverdue: boolean;
  idempotencyKey: string;
  createdAt: Date;
}

export interface LoanRepository {
  /** idempotency_key の UNIQUE 制約(uq_loans_idempotency_key)を模す。重複時は例外を投げる */
  create(loan: Loan): void;
  findByIdempotencyKey(idempotencyKey: string): Loan | undefined;
  all(): readonly Loan[];
}

export class InMemoryLoanRepository implements LoanRepository {
  private readonly loans = new Map<string, Loan>();
  private readonly loanIdByIdempotencyKey = new Map<string, string>();

  create(loan: Loan): void {
    if (this.loanIdByIdempotencyKey.has(loan.idempotencyKey)) {
      throw new UniqueConstraintViolationError(
        "uq_loans_idempotency_key",
        `uq_loans_idempotency_key 制約違反: ${loan.idempotencyKey}`,
      );
    }
    this.loans.set(loan.id, loan);
    this.loanIdByIdempotencyKey.set(loan.idempotencyKey, loan.id);
  }

  findByIdempotencyKey(idempotencyKey: string): Loan | undefined {
    const id = this.loanIdByIdempotencyKey.get(idempotencyKey);
    return id ? this.loans.get(id) : undefined;
  }

  all(): readonly Loan[] {
    return [...this.loans.values()];
  }
}
