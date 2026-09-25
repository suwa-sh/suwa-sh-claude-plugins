/**
 * 集約「貸出」。貸出登録で、条件「貸出可否」を満たすときだけ貸出を作り、
 * 条件「返却期限算出」で返却期限を決める。蔵書の状態遷移と、本人向け取り置きの受取済み化もここで決める。
 */
import type { CopyStatus, LoanStatus } from './copyStatus';
import { calculateDueOn } from './dueDate';
import { judgeLoanEligibility, LoanNotAllowedError } from './loanEligibility';
import type { LoanRule } from './loanRule';

/** 貸出登録の対象となる蔵書 (貸出可否の判定に必要な現在値)。 */
export interface LendableCopy {
  copyId: string;
  bookTitle: string;
  status: CopyStatus;
  /** copies.version (楽観ロック) */
  version: number;
  /** 取り置き中のとき、その予約 */
  hold: { reservationId: string; patronNumber: string; version: number } | null;
}

export interface Borrower {
  patronId: string;
  patronNumber: string;
}

export interface Loan {
  loanId: string;
  patronId: string;
  patronNumber: string;
  copyId: string;
  bookTitle: string;
  loanRuleId: string;
  loanedOn: string;
  dueOn: string;
  returnedOn: string | null;
  status: LoanStatus;
  loanedByLibrarianId: string;
}

/** 貸出登録の結果。repository はこれを 1 トランザクションで永続化する。 */
export interface LoanRegistration {
  loan: Loan;
  copyTransition: { copyId: string; from: CopyStatus; to: CopyStatus; expectedVersion: number };
  /** 本人向け取り置きを受取済みにする予約 (該当しなければ null) */
  fulfilledReservation: { reservationId: string; expectedVersion: number } | null;
}

export interface RegisterLoanCommand {
  loanId: string;
  borrower: Borrower;
  copy: LendableCopy;
  loanRule: LoanRule;
  loanedOn: string;
  librarianId: string;
}

export function registerLoan(command: RegisterLoanCommand): LoanRegistration {
  const { copy, borrower, loanRule, loanedOn } = command;
  const eligibility = judgeLoanEligibility(
    { status: copy.status, heldForPatronNumber: copy.hold?.patronNumber ?? null },
    borrower.patronNumber,
  );
  if (!eligibility.allowed) throw new LoanNotAllowedError(eligibility.reason);

  const loan: Loan = {
    loanId: command.loanId,
    patronId: borrower.patronId,
    patronNumber: borrower.patronNumber,
    copyId: copy.copyId,
    bookTitle: copy.bookTitle,
    loanRuleId: loanRule.loanRuleId,
    loanedOn,
    dueOn: calculateDueOn(loanedOn, loanRule.loanPeriodDays),
    returnedOn: null,
    status: 'on_loan',
    loanedByLibrarianId: command.librarianId,
  };
  const fulfilledReservation =
    copy.status === 'on_hold' && copy.hold
      ? { reservationId: copy.hold.reservationId, expectedVersion: copy.hold.version }
      : null;
  return {
    loan,
    copyTransition: {
      copyId: copy.copyId,
      from: copy.status,
      to: 'on_loan',
      expectedVersion: copy.version,
    },
    fulfilledReservation,
  };
}
