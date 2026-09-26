/**
 * 返却の登録 (RDRA 状態.tsv の「返却を登録する」の遷移)。
 *
 * - 貸出状態: 貸出中 → 返却済、延滞 → 返却済
 * - 書籍状態: 貸出中 → 在庫あり (予約が無い)、貸出中 → 予約待ち (予約中の予約がある)
 * - 未返却の貸出 (貸出中・延滞) が無い書籍は返却できない (契約 registerReturn の 409 no_active_loan)
 */
import type { BookStatus, LoanStatus } from '../../../../../packages/contracts/library-api/types';

/** 未返却の貸出の貸出状態 (返却を登録できる遷移元) */
export type UnreturnedLoanStatus = Extract<LoanStatus, 'on_loan' | 'overdue'>;

export type ReturnBookInput = {
  /** 書籍の未返却の貸出の貸出状態。未返却の貸出が無ければ null */
  unreturnedLoanStatus: UnreturnedLoanStatus | null;
  /** 書籍に予約中 (waiting) の予約があるか */
  hasWaitingReservation: boolean;
  /** 返却日 (YYYY-MM-DD) */
  returnedOn: string;
};

/** 返却できない理由。契約の ProblemCode と同じ識別子 */
export type ReturnBookRejection = 'no_active_loan';

export type ReturnBookResult =
  | {
      ok: true;
      returnedOn: string;
      loanStatus: Extract<LoanStatus, 'returned'>;
      bookStatus: Extract<BookStatus, 'available' | 'awaiting_pickup'>;
    }
  | { ok: false; code: ReturnBookRejection };

/** 未返却の貸出の貸出状態か (貸出中・延滞) */
export function isUnreturned(status: LoanStatus): status is UnreturnedLoanStatus {
  return status === 'on_loan' || status === 'overdue';
}

export function returnBook(input: ReturnBookInput): ReturnBookResult {
  if (input.unreturnedLoanStatus === null) {
    return { ok: false, code: 'no_active_loan' };
  }
  return {
    ok: true,
    returnedOn: input.returnedOn,
    loanStatus: 'returned',
    bookStatus: input.hasWaitingReservation ? 'awaiting_pickup' : 'available',
  };
}
