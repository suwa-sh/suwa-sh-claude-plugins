/**
 * 貸出可否条件と返却期限算出条件 (RDRA 条件.tsv の貸出管理)。
 *
 * - 貸出可否条件: 書籍状態が在庫ありなら登録済みの利用者に貸し出せる。予約待ちなら予約順 1 位 (通知済) の利用者にだけ貸し出せる。
 *   貸出中の書籍は貸し出せない。登録されていない利用者には貸し出せない。
 * - 返却期限算出条件: 返却期限は貸出日に貸出期間を加えた日とする。
 */
import type { BookStatus, LoanStatus } from '../../../../../packages/contracts/library-api/types';
import { addDays } from './calendar-date';

export type LendBookInput = {
  bookStatus: BookStatus;
  patronRegistered: boolean;
  /** 予約待ちの書籍で、借り手が予約順 1 位 (通知済) か。1 位でも未通知なら false (AssumptionRecord A-013) */
  patronIsFirstInQueue: boolean;
  /** 貸出日 (YYYY-MM-DD) */
  loanedOn: string;
  /** 貸出期間の日数 */
  loanPeriodDays: number;
};

/** 貸出可否条件を満たさない理由。契約の ProblemCode と同じ識別子 */
export type LendBookRejection =
  | 'book_on_loan'
  | 'not_first_in_reservation_queue'
  | 'patron_not_registered';

export type LendBookResult =
  | {
      ok: true;
      loanedOn: string;
      dueDate: string;
      loanStatus: Extract<LoanStatus, 'on_loan'>;
      bookStatus: Extract<BookStatus, 'on_loan'>;
    }
  | { ok: false; code: LendBookRejection };

/**
 * 貸出可否条件で判定し、貸し出せるなら返却期限と貸出後の状態を返す。
 * 判定順は「利用者が登録済みか」→「書籍状態」(AssumptionRecord A-003)。
 */
export function lendBook(input: LendBookInput): LendBookResult {
  if (!input.patronRegistered) {
    return { ok: false, code: 'patron_not_registered' };
  }
  if (input.bookStatus === 'on_loan') {
    return { ok: false, code: 'book_on_loan' };
  }
  if (input.bookStatus === 'awaiting_pickup' && !input.patronIsFirstInQueue) {
    return { ok: false, code: 'not_first_in_reservation_queue' };
  }
  return {
    ok: true,
    loanedOn: input.loanedOn,
    dueDate: addDays(input.loanedOn, input.loanPeriodDays),
    loanStatus: 'on_loan',
    bookStatus: 'on_loan',
  };
}

/** 予約待ちの書籍を貸し出すときは、予約順 1 位の予約を完了にする (状態.tsv 予約状態 通知済 → 完了) */
export function completesReservation(bookStatus: BookStatus): boolean {
  return bookStatus === 'awaiting_pickup';
}
