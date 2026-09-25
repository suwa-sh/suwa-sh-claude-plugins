/**
 * UC「貸出を登録する」(circulation モジュール)。
 * 司書だけが操作でき (条件「操作権限」)、条件「貸出可否」を満たす蔵書を貸し出し、
 * 条件「返却期限算出」で返却期限を設定する。蔵書・貸出・予約の更新は 1 トランザクション (ADR 0009)。
 */
import { type Loan, registerLoan } from '../../domain/circulation/loan';
import type { LoanRepository } from '../../domain/circulation/loanRepository';
import { LoanRuleNotConfiguredError } from '../../domain/circulation/loanRule';
import type { Clock, IdGenerator } from '../../domain/shared/clock';
import type { FindPatronByNumber } from '../patron/findPatronByNumber';
import { NotFoundError, type Principal, requireLibrarian } from '../shared/principal';

export interface RegisterLoanInput {
  patronNumber: string;
  copyId: string;
}

export interface RegisterLoanResult {
  loan: Loan;
  copyStatus: 'on_loan';
  fulfilledReservationId: string | null;
}

export interface RegisterLoan {
  execute(principal: Principal, input: RegisterLoanInput): Promise<RegisterLoanResult>;
}

export interface RegisterLoanDeps {
  loans: LoanRepository;
  findPatronByNumber: FindPatronByNumber;
  clock: Clock;
  ids: IdGenerator;
}

export function createRegisterLoan(deps: RegisterLoanDeps): RegisterLoan {
  return {
    async execute(principal, input) {
      const librarian = requireLibrarian(principal, 'createLoan');

      const patron = await deps.findPatronByNumber.execute(input.patronNumber);
      if (!patron) throw new NotFoundError('patron_not_found');

      const loanedOn = deps.clock.today();
      return deps.loans.inTransaction(async (session) => {
        const copy = await session.findLendableCopy(input.copyId);
        if (!copy) throw new NotFoundError('copy_not_found');

        const loanRule = await session.findEffectiveLoanRule(loanedOn);
        if (!loanRule) throw new LoanRuleNotConfiguredError(loanedOn);

        const registration = registerLoan({
          loanId: deps.ids.newId(),
          borrower: patron,
          copy,
          loanRule,
          loanedOn,
          librarianId: librarian.librarianId,
        });
        await session.save(registration, deps.clock.now());
        return {
          loan: registration.loan,
          copyStatus: 'on_loan',
          fulfilledReservationId: registration.fulfilledReservation?.reservationId ?? null,
        };
      });
    },
  };
}
