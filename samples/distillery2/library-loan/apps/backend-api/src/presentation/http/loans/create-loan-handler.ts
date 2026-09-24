import {
  BookNotFound,
  LoanRegistrationError,
  PatronHasOverdueLoan,
  PatronNotFound,
  VersionConflict,
} from '../../../domain/loan/errors';
import type { Principal } from '../../../usecase/auth/principal';
import type { RegisterLoanCommand, RegisterLoanResult } from '../../../usecase/loan/register-loan';
import {
  conflictProblem,
  loanNotAllowedProblem,
  notFoundProblem,
  validationProblem,
  type Problem,
} from '../problem';
import { parseCreateLoanRequest } from './create-loan-request';

export interface RegisterLoanUseCase {
  execute(principal: Principal, command: RegisterLoanCommand): Promise<RegisterLoanResult>;
}

/** 契約 Loan の応答表現 */
export interface LoanResponse {
  loanId: string;
  bookId: string;
  patronNumber: string;
  loanedOn: string;
  loanPeriodDays: 7 | 14 | 21;
  dueOn: string;
  status: 'on_loan' | 'overdue' | 'returned';
  pickedUpReservationId: string | null;
}

export type HandlerResult = { status: 201; body: LoanResponse } | { status: number; problem: Problem };

/** POST /loans (operationId: createLoan) */
export async function handleCreateLoan(
  useCase: RegisterLoanUseCase,
  principal: Principal,
  body: unknown,
): Promise<HandlerResult> {
  const parsed = parseCreateLoanRequest(body);
  if (!parsed.ok) return { status: 400, problem: validationProblem(parsed.errors) };

  try {
    const { loan, pickedUpReservationId } = await useCase.execute(principal, parsed.value);
    return {
      status: 201,
      body: {
        loanId: loan.loanId,
        bookId: loan.bookId,
        patronNumber: loan.patronNumber,
        loanedOn: loan.loanedOn,
        loanPeriodDays: loan.loanPeriodDays,
        dueOn: loan.dueOn,
        status: loan.status,
        pickedUpReservationId,
      },
    };
  } catch (e) {
    if (e instanceof LoanRegistrationError) {
      const problem = toProblem(e);
      return { status: problem.status, problem };
    }
    throw e;
  }
}

function toProblem(e: LoanRegistrationError): Problem {
  if (e instanceof BookNotFound || e instanceof PatronNotFound) return notFoundProblem(e.code, e.message);
  if (e instanceof VersionConflict) return conflictProblem(e.code, e.message);
  if (e instanceof PatronHasOverdueLoan) return loanNotAllowedProblem(e.code, 'この利用者には貸し出せません', e.message);
  return loanNotAllowedProblem(e.code, 'この書籍は貸し出せません', e.message);
}
