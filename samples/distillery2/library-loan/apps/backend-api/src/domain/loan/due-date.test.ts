/**
 * 貸出登録 (register-loan) — backend-api / domain 層
 *
 * 出典: 契約 createLoan の Loan.dueOn「返却期限。貸出日に貸出期間の日数を加えた日付」
 *       と 201 例 (loanedOn 2026-10-01, loanPeriodDays 14 → dueOn 2026-10-15)、
 *       シナリオ「貸出を登録すると返却期限が自動で設定される」。
 */
import { describe, expect, it } from 'vitest';
import { calculateDueOn } from './due-date';

describe('返却期限の算出', () => {
  it('calculateDueOn_貸出日が2026-10-01で貸出期間が14日の場合_返却期限が2026-10-15であること', () => {
    // Arrange
    const loanedOn = '2026-10-01';

    // Act
    const dueOn = calculateDueOn(loanedOn, 14);

    // Assert
    expect(dueOn).toBe('2026-10-15');
  });

  it('calculateDueOn_貸出日が月末で貸出期間が7日の場合_翌月の日付になること', () => {
    // Arrange
    const loanedOn = '2026-10-28';

    // Act
    const dueOn = calculateDueOn(loanedOn, 7);

    // Assert
    expect(dueOn).toBe('2026-11-04');
  });

  it('calculateDueOn_貸出日が年末で貸出期間が21日の場合_翌年の日付になること', () => {
    // Arrange
    const loanedOn = '2026-12-20';

    // Act
    const dueOn = calculateDueOn(loanedOn, 21);

    // Assert
    expect(dueOn).toBe('2027-01-10');
  });

  it('calculateDueOn_貸出日が日付の形式でない場合_例外になること', () => {
    // Arrange
    const loanedOn = '2026-02-30';

    // Act
    const act = () => calculateDueOn(loanedOn, 14);

    // Assert
    expect(act).toThrow(RangeError);
  });
});
