import type { Clock } from '../../domain/shared/business-date';
import { LoanRegistrationError } from '../../domain/loan/errors';
import { registerLoan, type Loan } from '../../domain/loan/loan';
import type { LoanRegistrationRepository } from '../../domain/loan/loan-registration-repository';
import { ForbiddenError, type Principal } from '../auth/principal';
import type { AccessLog } from '../ports/access-log';

export interface RegisterLoanCommand {
  patronNumber: string;
  bookId: string;
}

export interface RegisterLoanResult {
  loan: Loan;
  pickedUpReservationId: string | null;
}

export interface RegisterLoanDeps {
  repository: LoanRegistrationRepository;
  clock: Clock;
  accessLog: AccessLog;
  newId: () => string;
}

const ACTION = 'loan.register';

/**
 * UC 貸出を登録する。司書ロールだけが実行できる (操作権限条件)。
 * 貸出日は業務日付 (clock.today())、貸出期間と返却期限はドメインが決める。
 */
export class RegisterLoan {
  constructor(private readonly deps: RegisterLoanDeps) {}

  async execute(principal: Principal, command: RegisterLoanCommand): Promise<RegisterLoanResult> {
    const { repository, clock, accessLog, newId } = this.deps;
    const target = { bookId: command.bookId, patronNumber: command.patronNumber };
    const log = (outcome: 'succeeded' | 'denied' | 'rejected', extra: { loanId?: string; reason?: string } = {}) =>
      accessLog.record({
        action: ACTION,
        actorSubject: principal.subject,
        actorRole: principal.role,
        outcome,
        target: extra.loanId ? { ...target, loanId: extra.loanId } : target,
        ...(extra.reason ? { reason: extra.reason } : {}),
        occurredAt: clock.now().toISOString(),
      });

    if (principal.role !== 'staff') {
      log('denied', { reason: 'forbidden' });
      throw new ForbiddenError();
    }

    try {
      const context = await repository.loadLendingContext(command.bookId, command.patronNumber);
      const registration = registerLoan({ context, loanId: newId(), loanedOn: clock.today() });
      await repository.save(registration, principal.subject, clock.now());
      log('succeeded', { loanId: registration.loan.loanId });
      return {
        loan: registration.loan,
        pickedUpReservationId: registration.pickedUpReservation?.reservationId ?? null,
      };
    } catch (e) {
      if (e instanceof LoanRegistrationError) log('rejected', { reason: e.code });
      throw e;
    }
  }
}
