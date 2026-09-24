import { addDays, type BusinessDate } from '../shared/business-date';
import type { LoanPeriodDays } from './loan-period';

/**
 * 返却期限算出条件 (条件.tsv): 返却期限は貸出日に貸出期間を加算して算出する。
 * 契約 Loan.dueOn「貸出日に貸出期間の日数を加えた日付」。
 */
export function calculateDueOn(loanedOn: BusinessDate, loanPeriodDays: LoanPeriodDays): BusinessDate {
  return addDays(loanedOn, loanPeriodDays);
}
