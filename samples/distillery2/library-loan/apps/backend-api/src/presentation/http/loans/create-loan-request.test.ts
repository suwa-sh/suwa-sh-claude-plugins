import { describe, expect, it } from 'vitest';
import { parseCreateLoanRequest } from './create-loan-request';

const BOOK_ID = '11111111-1111-4111-8111-111111111111';

describe('貸出登録の入力検証', () => {
  it('利用者番号と書籍IDが正しい場合、入力を受け付けること', () => {
    // Arrange
    const body = { patronNumber: 'P000123', bookId: BOOK_ID };

    // Act
    const result = parseCreateLoanRequest(body);

    // Assert
    expect(result).toEqual({ ok: true, value: body });
  });

  it('書籍IDが無い場合、書籍IDは必須ですのエラーになること', () => {
    // Arrange
    const body = { patronNumber: 'P000123' };

    // Act
    const result = parseCreateLoanRequest(body);

    // Assert
    expect(result).toEqual({ ok: false, errors: [{ field: 'bookId', message: '書籍IDは必須です' }] });
  });

  it('利用者番号の形式が違う場合、patronNumber のエラーになること', () => {
    // Arrange
    const body = { patronNumber: '123', bookId: BOOK_ID };

    // Act
    const result = parseCreateLoanRequest(body);

    // Assert
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.map((e) => e.field)).toEqual(['patronNumber']);
  });

  it('書籍IDが uuid でない場合、bookId のエラーになること', () => {
    // Arrange
    const body = { patronNumber: 'P000123', bookId: 'not-a-uuid' };

    // Act
    const result = parseCreateLoanRequest(body);

    // Assert
    expect(!result.ok && result.errors.map((e) => e.field)).toEqual(['bookId']);
  });

  it('契約に無い項目がある場合、その項目のエラーになること', () => {
    // Arrange
    const body = { patronNumber: 'P000123', bookId: BOOK_ID, dueOn: '2026-12-31' };

    // Act
    const result = parseCreateLoanRequest(body);

    // Assert
    expect(!result.ok && result.errors.map((e) => e.field)).toEqual(['dueOn']);
  });

  it('本文がオブジェクトでない場合、body のエラーになること', () => {
    // Arrange
    const body = [1, 2];

    // Act
    const result = parseCreateLoanRequest(body);

    // Assert
    expect(!result.ok && result.errors.map((e) => e.field)).toEqual(['body']);
  });
});
