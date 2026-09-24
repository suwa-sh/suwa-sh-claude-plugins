import { describe, expect, it } from 'vitest';
import { BookOnLoan } from '../../domain/loan/errors';
import type { LendingContext, LoanRegistration } from '../../domain/loan/loan';
import type { LoanRegistrationRepository } from '../../domain/loan/loan-registration-repository';
import { ForbiddenError, type Principal } from '../auth/principal';
import type { AccessLogEntry } from '../ports/access-log';
import { RegisterLoan } from './register-loan';

class FakeRepository implements LoanRegistrationRepository {
  saved: Array<{ registration: LoanRegistration; actorId: string }> = [];
  constructor(private readonly context: LendingContext) {}
  async loadLendingContext(): Promise<LendingContext> {
    return this.context;
  }
  async save(registration: LoanRegistration, actorId: string): Promise<void> {
    this.saved.push({ registration, actorId });
  }
}

const availableContext: LendingContext = {
  book: { bookId: 'book-a', status: 'available', mediaType: 'paper', version: 1 },
  patron: { patronNumber: 'P000123', status: 'active', category: 'general', hasOverdueLoan: false },
  heldReservation: null,
};
const staff: Principal = { role: 'staff', subject: 'staff-1' };
const patronUser: Principal = { role: 'patron', subject: 'patron-1', patronNumber: 'P000123' };

function setup(context: LendingContext = availableContext) {
  const repository = new FakeRepository(context);
  const entries: AccessLogEntry[] = [];
  const useCase = new RegisterLoan({
    repository,
    clock: { today: () => '2026-10-01', now: () => new Date('2026-10-01T00:00:00Z') },
    accessLog: { record: (e) => entries.push(e) },
    newId: () => 'loan-1',
  });
  return { useCase, repository, entries };
}

describe('RegisterLoan', () => {
  it('司書が登録する場合、業務日付を貸出日として貸出を記録し、操作者を記録すること', async () => {
    // Arrange
    const { useCase, repository } = setup();

    // Act
    const result = await useCase.execute(staff, { patronNumber: 'P000123', bookId: 'book-a' });

    // Assert
    expect(result.loan.loanedOn).toBe('2026-10-01');
    expect(result.pickedUpReservationId).toBeNull();
    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0]?.actorId).toBe('staff-1');
  });

  it('司書が登録する場合、成功のデータアクセスログを個人情報なしで残すこと', async () => {
    // Arrange
    const { useCase, entries } = setup();

    // Act
    await useCase.execute(staff, { patronNumber: 'P000123', bookId: 'book-a' });

    // Assert
    expect(entries).toEqual([
      {
        action: 'loan.register',
        actorSubject: 'staff-1',
        actorRole: 'staff',
        outcome: 'succeeded',
        target: { bookId: 'book-a', patronNumber: 'P000123', loanId: 'loan-1' },
        occurredAt: '2026-10-01T00:00:00.000Z',
      },
    ]);
  });

  it('利用者ロールの場合、ForbiddenError で貸出を記録しないこと', async () => {
    // Arrange
    const { useCase, repository } = setup();

    // Act
    const act = useCase.execute(patronUser, { patronNumber: 'P000123', bookId: 'book-a' });

    // Assert
    await expect(act).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.saved).toHaveLength(0);
  });

  it('利用者ロールの場合、拒否のデータアクセスログを残すこと', async () => {
    // Arrange
    const { useCase, entries } = setup();

    // Act
    await useCase.execute(patronUser, { patronNumber: 'P000123', bookId: 'book-a' }).catch(() => undefined);

    // Assert
    expect(entries.map((e) => [e.outcome, e.reason])).toEqual([['denied', 'forbidden']]);
  });

  it('貸出可否条件を満たさない場合、ドメイン例外を伝え貸出を記録しないこと', async () => {
    // Arrange
    const { useCase, repository, entries } = setup({
      ...availableContext,
      book: { bookId: 'book-a', status: 'on_loan', mediaType: 'paper', version: 2 },
    });

    // Act
    const act = useCase.execute(staff, { patronNumber: 'P000123', bookId: 'book-a' });

    // Assert
    await expect(act).rejects.toBeInstanceOf(BookOnLoan);
    expect(repository.saved).toHaveLength(0);
    expect(entries.map((e) => [e.outcome, e.reason])).toEqual([['rejected', 'book-on-loan']]);
  });
});
