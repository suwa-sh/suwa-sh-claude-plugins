import { describe, expect, it } from 'vitest';
import { determineLoanPeriod, type MediaType, type PatronCategory } from './loan-period';

describe('貸出期間の決定', () => {
  it('determineLoanPeriod_一般の利用者が紙の書籍を借りる場合_14日であること', () => {
    // Arrange (契約 createLoan の 201 例: 一般 × 紙 → loanPeriodDays 14)
    const category: PatronCategory = 'general';

    // Act
    const days = determineLoanPeriod(category, 'paper');

    // Assert
    expect(days).toBe(14);
  });

  it('determineLoanPeriod_すべての利用者区分と媒体種別の場合_7日14日21日のいずれかであること', () => {
    // Arrange
    const categories: PatronCategory[] = ['general', 'child', 'student'];
    const mediaTypes: MediaType[] = ['paper', 'electronic'];

    // Act
    const all = categories.flatMap((c) => mediaTypes.map((m) => determineLoanPeriod(c, m)));

    // Assert
    for (const days of all) expect([7, 14, 21]).toContain(days);
  });
});
