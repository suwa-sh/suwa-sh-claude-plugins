import { describe, expect, it } from 'vitest';
import type { LendableCopy, LoanRegistration } from '../../domain/circulation/loan';
import { LoanNotAllowedError } from '../../domain/circulation/loanEligibility';
import type { LoanRepository } from '../../domain/circulation/loanRepository';
import { type LoanRule, LoanRuleNotConfiguredError } from '../../domain/circulation/loanRule';
import type { Patron } from '../../domain/patron/patron';
import type { Clock } from '../../domain/shared/clock';
import { ForbiddenError, NotFoundError, type Principal } from '../shared/principal';
import { createRegisterLoan } from './registerLoan';

const librarian: Principal = { role: 'librarian', librarianId: 'lib-1' };
const fixedClock: Clock = { now: () => '2026-09-01T03:00:00.000Z', today: () => '2026-09-01' };

function setup(state: { patrons?: Patron[]; copies?: LendableCopy[]; loanRule?: LoanRule | null }) {
  const saved: LoanRegistration[] = [];
  const loans: LoanRepository = {
    inTransaction: (fn) =>
      fn({
        findLendableCopy: async (copyId) => state.copies?.find((c) => c.copyId === copyId) ?? null,
        findEffectiveLoanRule: async () =>
          state.loanRule === undefined
            ? { loanRuleId: 'rule-1', loanPeriodDays: 14, effectiveFrom: '2000-01-01' }
            : state.loanRule,
        save: async (registration) => {
          saved.push(registration);
        },
      }),
  };
  const registerLoan = createRegisterLoan({
    loans,
    findPatronByNumber: {
      execute: async (n) => state.patrons?.find((p) => p.patronNumber === n) ?? null,
    },
    clock: fixedClock,
    ids: { newId: () => 'loan-new' },
  });
  return { registerLoan, saved };
}

const m1: Patron = { patronId: 'patron-m1', patronNumber: 'P-2026-00001' };
const availableCopy: LendableCopy = {
  copyId: 'copy-1',
  bookTitle: '吾輩は猫である',
  status: 'available',
  version: 1,
  hold: null,
};

describe('貸出を登録する (usecase)', () => {
  it('司書が在庫ありの蔵書を貸し出す場合、今日を貸出日として貸出を保存すること', async () => {
    // Arrange
    const { registerLoan, saved } = setup({ patrons: [m1], copies: [availableCopy] });

    // Act
    const result = await registerLoan.execute(librarian, {
      patronNumber: 'P-2026-00001',
      copyId: 'copy-1',
    });

    // Assert
    expect(result.loan).toMatchObject({
      loanId: 'loan-new',
      loanedOn: '2026-09-01',
      dueOn: '2026-09-15',
      loanedByLibrarianId: 'lib-1',
    });
    expect(result.copyStatus).toBe('on_loan');
    expect(result.fulfilledReservationId).toBeNull();
    expect(saved).toHaveLength(1);
  });

  it('利用者区分が利用者の場合、ForbiddenError を投げ何も保存しないこと', async () => {
    // Arrange
    const { registerLoan, saved } = setup({ patrons: [m1], copies: [availableCopy] });

    // Act
    const act = registerLoan.execute(
      { role: 'patron', patronNumber: 'P-2026-00001' },
      { patronNumber: 'P-2026-00001', copyId: 'copy-1' },
    );

    // Assert
    await expect(act).rejects.toThrow(ForbiddenError);
    expect(saved).toHaveLength(0);
  });

  it('登録されていない利用者番号の場合、patron_not_found を投げること', async () => {
    // Arrange
    const { registerLoan } = setup({ patrons: [m1], copies: [availableCopy] });

    // Act
    const act = registerLoan.execute(librarian, { patronNumber: 'P-2026-99999', copyId: 'copy-1' });

    // Assert
    await expect(act).rejects.toEqual(new NotFoundError('patron_not_found'));
  });

  it('存在しない蔵書の場合、copy_not_found を投げること', async () => {
    // Arrange
    const { registerLoan } = setup({ patrons: [m1], copies: [] });

    // Act
    const act = registerLoan.execute(librarian, { patronNumber: 'P-2026-00001', copyId: 'nope' });

    // Assert
    await expect(act).rejects.toEqual(new NotFoundError('copy_not_found'));
  });

  it('貸出中の蔵書の場合、貸出可否のドメイン例外を投げ何も保存しないこと', async () => {
    // Arrange
    const { registerLoan, saved } = setup({
      patrons: [m1],
      copies: [{ ...availableCopy, status: 'on_loan' }],
    });

    // Act
    const act = registerLoan.execute(librarian, { patronNumber: 'P-2026-00001', copyId: 'copy-1' });

    // Assert
    await expect(act).rejects.toThrow(LoanNotAllowedError);
    expect(saved).toHaveLength(0);
  });

  it('貸出日時点で有効な貸出ルールが無い場合、LoanRuleNotConfiguredError を投げること', async () => {
    // Arrange
    const { registerLoan } = setup({ patrons: [m1], copies: [availableCopy], loanRule: null });

    // Act
    const act = registerLoan.execute(librarian, { patronNumber: 'P-2026-00001', copyId: 'copy-1' });

    // Assert
    await expect(act).rejects.toThrow(LoanRuleNotConfiguredError);
  });
});
