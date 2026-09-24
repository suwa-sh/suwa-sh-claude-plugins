import { describe, expect, it } from 'vitest';
import {
  BookNotFound,
  BookOnHoldForAnotherPatron,
  BookOnLoan,
  PatronHasOverdueLoan,
  PatronNotFound,
} from './errors';
import { registerLoan, type BookForLending, type LendingContext, type PatronForLending } from './loan';

const book = (over: Partial<BookForLending> = {}): BookForLending => ({
  bookId: 'book-a',
  status: 'available',
  mediaType: 'paper',
  version: 3,
  ...over,
});
const patron = (over: Partial<PatronForLending> = {}): PatronForLending => ({
  patronNumber: 'P000123',
  status: 'active',
  category: 'general',
  hasOverdueLoan: false,
  ...over,
});
const context = (over: Partial<LendingContext> = {}): LendingContext => ({
  book: book(),
  patron: patron(),
  heldReservation: null,
  ...over,
});
const register = (ctx: LendingContext) => registerLoan({ context: ctx, loanId: 'loan-1', loanedOn: '2026-10-01' });

describe('貸出を登録する', () => {
  it('在庫ありの書籍を有効な利用者に貸し出す場合、貸出中の貸出が返却期限つきで記録されること', () => {
    // Arrange
    const ctx = context();

    // Act
    const result = register(ctx);

    // Assert
    expect(result.loan).toEqual({
      loanId: 'loan-1',
      bookId: 'book-a',
      patronNumber: 'P000123',
      loanedOn: '2026-10-01',
      loanPeriodDays: 14,
      dueOn: '2026-10-15',
      status: 'on_loan',
      version: 1,
    });
    expect(result.expectedBookVersion).toBe(3);
    expect(result.pickedUpReservation).toBeNull();
  });

  it('貸出中の書籍の場合、book-on-loan で貸出できないこと', () => {
    // Arrange
    const ctx = context({ book: book({ status: 'on_loan' }) });

    // Act
    const act = () => register(ctx);

    // Assert
    expect(act).toThrow(BookOnLoan);
  });

  it('削除済みの書籍の場合、book-not-found で貸出できないこと', () => {
    // Arrange
    const ctx = context({ book: book({ status: 'deleted' }) });

    // Act
    const act = () => register(ctx);

    // Assert
    expect(act).toThrow(BookNotFound);
  });

  it('存在しない書籍の場合、book-not-found で貸出できないこと', () => {
    // Arrange
    const ctx = context({ book: null });

    // Act
    const act = () => register(ctx);

    // Assert
    expect(act).toThrow(BookNotFound);
  });

  it('削除済みの利用者の場合、patron-not-found で貸出できないこと', () => {
    // Arrange
    const ctx = context({ patron: patron({ status: 'deleted' }) });

    // Act
    const act = () => register(ctx);

    // Assert
    expect(act).toThrow(PatronNotFound);
  });

  it('存在しない利用者の場合、patron-not-found で貸出できないこと', () => {
    // Arrange
    const ctx = context({ patron: null });

    // Act
    const act = () => register(ctx);

    // Assert
    expect(act).toThrow(PatronNotFound);
  });

  it('延滞中の貸出を持つ利用者の場合、patron-has-overdue-loan で貸出できないこと', () => {
    // Arrange
    const ctx = context({ patron: patron({ hasOverdueLoan: true }) });

    // Act
    const act = () => register(ctx);

    // Assert
    expect(act).toThrow(PatronHasOverdueLoan);
  });

  it('取置中の予約を持つ予約順1位の利用者の場合、取置の書籍を貸し出せて予約を受取済みにすること', () => {
    // Arrange
    const held = { reservationId: 'rsv-1', patronNumber: 'P000123', version: 2 };
    const ctx = context({ book: book({ status: 'on_hold' }), heldReservation: held });

    // Act
    const result = register(ctx);

    // Assert
    expect(result.loan.status).toBe('on_loan');
    expect(result.pickedUpReservation).toEqual(held);
  });

  it('取置中の予約が他の利用者のものの場合、book-on-hold-for-another-patron で貸出できないこと', () => {
    // Arrange
    const held = { reservationId: 'rsv-1', patronNumber: 'P000456', version: 2 };
    const ctx = context({ book: book({ status: 'on_hold' }), heldReservation: held });

    // Act
    const act = () => register(ctx);

    // Assert
    expect(act).toThrow(BookOnHoldForAnotherPatron);
  });

  it('予約待ち(取置)なのに取置中の予約が無い場合、貸出できないこと', () => {
    // Arrange
    const ctx = context({ book: book({ status: 'on_hold' }), heldReservation: null });

    // Act
    const act = () => register(ctx);

    // Assert
    expect(act).toThrow(BookOnHoldForAnotherPatron);
  });

  it('他の利用者の取置の書籍を延滞中の利用者が借りようとした場合、書籍の理由を先に返すこと', () => {
    // Arrange
    const held = { reservationId: 'rsv-1', patronNumber: 'P000123', version: 2 };
    const ctx = context({
      book: book({ status: 'on_hold' }),
      heldReservation: held,
      patron: patron({ patronNumber: 'P000456', hasOverdueLoan: true }),
    });

    // Act
    const act = () => register(ctx);

    // Assert
    expect(act).toThrow(BookOnHoldForAnotherPatron);
  });
});
