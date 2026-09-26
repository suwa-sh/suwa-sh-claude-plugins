/**
 * 返却の登録 (domain) の単体テスト。
 *
 * 出典: features/貸出業務/register-return.feature、contract-slice の POST /returns (registerReturn)、
 * RDRA 状態.tsv (書籍状態 貸出中 → 在庫あり / 予約待ち、貸出状態 貸出中 / 延滞 → 返却済)。
 */
import { describe, expect, it } from 'vitest';
import { type ReturnBookInput, returnBook } from './return-book';

const baseInput: ReturnBookInput = {
  unreturnedLoanStatus: 'on_loan',
  hasWaitingReservation: false,
  returnedOn: '2026-10-15',
};

describe('returnBook', () => {
  it('予約のない貸出中の書籍の場合、貸出を返却済にし書籍を在庫ありにすること', () => {
    // Arrange
    const input: ReturnBookInput = { ...baseInput };

    // Act
    const result = returnBook(input);

    // Assert
    expect(result).toEqual({
      ok: true,
      returnedOn: '2026-10-15',
      loanStatus: 'returned',
      bookStatus: 'available',
    });
  });

  it('予約中の予約がある書籍の場合、書籍を予約待ちにすること', () => {
    // Arrange
    const input: ReturnBookInput = { ...baseInput, hasWaitingReservation: true };

    // Act
    const result = returnBook(input);

    // Assert
    expect(result).toMatchObject({
      ok: true,
      loanStatus: 'returned',
      bookStatus: 'awaiting_pickup',
    });
  });

  it('延滞している貸出の場合、返却済にすること', () => {
    // Arrange
    const input: ReturnBookInput = { ...baseInput, unreturnedLoanStatus: 'overdue' };

    // Act
    const result = returnBook(input);

    // Assert
    expect(result).toMatchObject({ ok: true, loanStatus: 'returned', bookStatus: 'available' });
  });

  it('未返却の貸出が無い場合、no_active_loan で返却できないこと', () => {
    // Arrange
    const input: ReturnBookInput = { ...baseInput, unreturnedLoanStatus: null };

    // Act
    const result = returnBook(input);

    // Assert
    expect(result).toEqual({ ok: false, code: 'no_active_loan' });
  });
});
