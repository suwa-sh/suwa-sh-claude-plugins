/**
 * 貸出可否条件と返却期限算出条件 (domain) の単体テスト。
 *
 * 出典: features/貸出業務/register-loan.feature、contract-slice の POST /loans (registerLoan)。
 * 貸出期間の日数は要求に値が無いため、テストから引数で渡す (日数そのものは固定しない)。
 */
import { describe, expect, it } from 'vitest';
import { completesReservation, type LendBookInput, lendBook } from './lend-book';

const baseInput: LendBookInput = {
  bookStatus: 'available',
  patronRegistered: true,
  patronIsFirstInQueue: false,
  loanedOn: '2026-10-01',
  loanPeriodDays: 14,
};

describe('lendBook', () => {
  it('在庫ありの書籍を登録済みの利用者に貸し出す場合、貸出日に貸出期間を加えた返却期限で貸出中になること', () => {
    // Arrange
    const input: LendBookInput = { ...baseInput };

    // Act
    const result = lendBook(input);

    // Assert
    expect(result).toEqual({
      ok: true,
      loanedOn: '2026-10-01',
      dueDate: '2026-10-15',
      loanStatus: 'on_loan',
      bookStatus: 'on_loan',
    });
  });

  it('貸出中の書籍の場合、book_on_loan で貸し出せないこと', () => {
    // Arrange
    const input: LendBookInput = { ...baseInput, bookStatus: 'on_loan' };

    // Act
    const result = lendBook(input);

    // Assert
    expect(result).toEqual({ ok: false, code: 'book_on_loan' });
  });

  it('予約待ちの書籍を予約順 1 位の利用者に貸し出す場合、貸出中になること', () => {
    // Arrange
    const input: LendBookInput = {
      ...baseInput,
      bookStatus: 'awaiting_pickup',
      patronIsFirstInQueue: true,
    };

    // Act
    const result = lendBook(input);

    // Assert
    expect(result).toMatchObject({ ok: true, bookStatus: 'on_loan', loanStatus: 'on_loan' });
  });

  it('予約待ちの書籍を予約順 1 位以外の利用者に貸し出す場合、not_first_in_reservation_queue で貸し出せないこと', () => {
    // Arrange
    const input: LendBookInput = {
      ...baseInput,
      bookStatus: 'awaiting_pickup',
      patronIsFirstInQueue: false,
    };

    // Act
    const result = lendBook(input);

    // Assert
    expect(result).toEqual({ ok: false, code: 'not_first_in_reservation_queue' });
  });

  it('登録されていない利用者の場合、patron_not_registered で貸し出せないこと', () => {
    // Arrange
    const input: LendBookInput = { ...baseInput, patronRegistered: false };

    // Act
    const result = lendBook(input);

    // Assert
    expect(result).toEqual({ ok: false, code: 'patron_not_registered' });
  });

  it('貸出中の書籍を登録されていない利用者に貸し出す場合、利用者の判定を先に返すこと', () => {
    // Arrange
    const input: LendBookInput = { ...baseInput, bookStatus: 'on_loan', patronRegistered: false };

    // Act
    const result = lendBook(input);

    // Assert
    expect(result).toEqual({ ok: false, code: 'patron_not_registered' });
  });

  it('返却期限が月末をまたぐ場合、暦どおりの日付になること', () => {
    // Arrange
    const input: LendBookInput = { ...baseInput, loanedOn: '2026-12-25', loanPeriodDays: 14 };

    // Act
    const result = lendBook(input);

    // Assert
    expect(result).toMatchObject({ ok: true, dueDate: '2027-01-08' });
  });
});

describe('completesReservation', () => {
  it('予約待ちの書籍の場合、予約を完了にすること', () => {
    // Arrange
    const bookStatus = 'awaiting_pickup' as const;

    // Act
    const result = completesReservation(bookStatus);

    // Assert
    expect(result).toBe(true);
  });

  it('在庫ありの書籍の場合、予約を完了にしないこと', () => {
    // Arrange
    const bookStatus = 'available' as const;

    // Act
    const result = completesReservation(bookStatus);

    // Assert
    expect(result).toBe(false);
  });
});
