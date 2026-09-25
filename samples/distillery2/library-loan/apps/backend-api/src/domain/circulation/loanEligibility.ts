/**
 * 条件「貸出可否」: 在庫ありの蔵書、またはその利用者向けに取り置き中の蔵書だけを貸し出せる。
 */
import type { CopyStatus } from './copyStatus';

/** 貸し出せない理由。応答の detail はこの理由から presentation が組み立てる。 */
export type LoanRefusalReason = 'on_loan' | 'held_for_other' | 'withdrawn';

export type LoanEligibility = { allowed: true } | { allowed: false; reason: LoanRefusalReason };

export interface CopyAvailability {
  status: CopyStatus;
  /** 取り置き中のとき、取り置き先の利用者番号。取り置き中でなければ null */
  heldForPatronNumber: string | null;
}

export function judgeLoanEligibility(
  copy: CopyAvailability,
  patronNumber: string,
): LoanEligibility {
  switch (copy.status) {
    case 'available':
      return { allowed: true };
    case 'on_hold':
      return copy.heldForPatronNumber !== null && copy.heldForPatronNumber === patronNumber
        ? { allowed: true }
        : { allowed: false, reason: 'held_for_other' };
    case 'on_loan':
      return { allowed: false, reason: 'on_loan' };
    case 'withdrawn':
      return { allowed: false, reason: 'withdrawn' };
  }
}

/** 業務上の失敗 (貸出可否で貸し出せない) を上位へ伝えるドメイン例外。 */
export class LoanNotAllowedError extends Error {
  constructor(readonly reason: LoanRefusalReason) {
    super(`貸し出せません: ${reason}`);
    this.name = 'LoanNotAllowedError';
  }
}
