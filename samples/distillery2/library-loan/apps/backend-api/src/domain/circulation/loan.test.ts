import { describe, expect, it } from 'vitest';
import { calculateDueOn, InvalidCalendarDateError } from './dueDate';
import { type LendableCopy, registerLoan } from './loan';
import { LoanNotAllowedError } from './loanEligibility';

const loanRule = { loanRuleId: 'rule-1', loanPeriodDays: 14, effectiveFrom: '2000-01-01' };
const m1 = { patronId: 'patron-m1', patronNumber: 'P-2026-00001' };
const m2 = { patronId: 'patron-m2', patronNumber: 'P-2026-00002' };

function copy(overrides: Partial<LendableCopy> = {}): LendableCopy {
  return {
    copyId: 'copy-1',
    bookTitle: '吾輩は猫である',
    status: 'available',
    version: 3,
    hold: null,
    ...overrides,
  };
}

describe('貸出登録 (集約「貸出」)', () => {
  it('在庫ありの蔵書の場合、貸出日に貸出期間を加えた返却期限で貸出中の貸出を作ること', () => {
    // Arrange
    const command = {
      loanId: 'loan-1',
      borrower: m1,
      copy: copy(),
      loanRule,
      loanedOn: '2026-09-01',
      librarianId: 'lib-1',
    };

    // Act
    const registration = registerLoan(command);

    // Assert
    expect(registration.loan).toMatchObject({
      loanId: 'loan-1',
      patronNumber: 'P-2026-00001',
      loanedOn: '2026-09-01',
      dueOn: '2026-09-15',
      returnedOn: null,
      status: 'on_loan',
      loanRuleId: 'rule-1',
    });
    expect(registration.copyTransition).toEqual({
      copyId: 'copy-1',
      from: 'available',
      to: 'on_loan',
      expectedVersion: 3,
    });
    expect(registration.fulfilledReservation).toBeNull();
  });

  it('本人向けに取り置き中の蔵書の場合、その予約を受取済みにする対象として返すこと', () => {
    // Arrange
    const held = copy({
      status: 'on_hold',
      hold: { reservationId: 'rsv-1', patronNumber: 'P-2026-00001', version: 2 },
    });

    // Act
    const registration = registerLoan({
      loanId: 'loan-1',
      borrower: m1,
      copy: held,
      loanRule,
      loanedOn: '2026-09-20',
      librarianId: 'lib-1',
    });

    // Assert
    expect(registration.fulfilledReservation).toEqual({
      reservationId: 'rsv-1',
      expectedVersion: 2,
    });
    expect(registration.copyTransition.from).toBe('on_hold');
    expect(registration.loan.dueOn).toBe('2026-10-04');
  });

  it('他の利用者向けに取り置き中の蔵書の場合、貸出可否のドメイン例外を投げること', () => {
    // Arrange
    const held = copy({
      status: 'on_hold',
      hold: { reservationId: 'rsv-1', patronNumber: 'P-2026-00001', version: 2 },
    });

    // Act
    const act = () =>
      registerLoan({
        loanId: 'loan-1',
        borrower: m2,
        copy: held,
        loanRule,
        loanedOn: '2026-09-01',
        librarianId: 'lib-1',
      });

    // Assert
    expect(act).toThrowError(new LoanNotAllowedError('held_for_other'));
  });

  it('除籍済みの蔵書の場合、貸出可否のドメイン例外を投げること', () => {
    // Arrange
    const withdrawn = copy({ status: 'withdrawn' });

    // Act
    const act = () =>
      registerLoan({
        loanId: 'loan-1',
        borrower: m1,
        copy: withdrawn,
        loanRule,
        loanedOn: '2026-09-01',
        librarianId: 'lib-1',
      });

    // Assert
    expect(act).toThrow(LoanNotAllowedError);
  });
});

describe('返却期限算出の境界', () => {
  it('calculateDueOn_年をまたぐ場合_翌年の日付になること', () => {
    // Arrange / Act
    const dueOn = calculateDueOn('2026-12-25', 14);

    // Assert
    expect(dueOn).toBe('2027-01-08');
  });

  it('calculateDueOn_存在しない日付の場合_例外を投げること', () => {
    // Arrange / Act
    const act = () => calculateDueOn('2026-02-30', 14);

    // Assert
    expect(act).toThrow(InvalidCalendarDateError);
  });

  it('calculateDueOn_貸出期間が0日の場合_例外を投げること', () => {
    // Arrange / Act
    const act = () => calculateDueOn('2026-09-01', 0);

    // Assert
    expect(act).toThrow(RangeError);
  });
});
