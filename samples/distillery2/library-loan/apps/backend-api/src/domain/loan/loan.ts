import type { BusinessDate } from '../shared/business-date';
import { calculateDueOn } from './due-date';
import {
  BookNotFound,
  BookOnHoldForAnotherPatron,
  BookOnLoan,
  PatronHasOverdueLoan,
  PatronNotFound,
} from './errors';
import { determineLoanPeriod, type LoanPeriodDays, type MediaType, type PatronCategory } from './loan-period';

/** 書籍状態 (available=在庫あり, on_loan=貸出中, on_hold=予約待ち(取置), deleted=削除済み)。 */
export type BookStatus = 'available' | 'on_loan' | 'on_hold' | 'deleted';
/** 利用者状態 (active=有効, deleted=削除済み)。 */
export type PatronStatus = 'active' | 'deleted';
/** 貸出状態 (on_loan=貸出中, overdue=延滞, returned=返却済み)。 */
export type LoanStatus = 'on_loan' | 'overdue' | 'returned';

/** 貸出可否の判定に使う書籍。version は書籍単位の楽観ロックの版番号。 */
export interface BookForLending {
  bookId: string;
  status: BookStatus;
  mediaType: MediaType;
  version: number;
}

/** 貸出可否の判定に使う利用者。hasOverdueLoan は貸出状態が延滞の貸出を持つか。 */
export interface PatronForLending {
  patronNumber: string;
  status: PatronStatus;
  category: PatronCategory;
  hasOverdueLoan: boolean;
}

/** 書籍に対する取置中 (予約状態 on_hold) の予約のうち予約順 1 位のもの。 */
export interface HeldReservation {
  reservationId: string;
  patronNumber: string;
  version: number;
}

export interface LendingContext {
  /** 書籍が存在しないときは null */
  book: BookForLending | null;
  /** 利用者が存在しないときは null */
  patron: PatronForLending | null;
  /** 書籍の取置中の予約 (予約順 1 位)。無ければ null */
  heldReservation: HeldReservation | null;
}

/** 貸出 (集約)。 */
export interface Loan {
  loanId: string;
  bookId: string;
  patronNumber: string;
  loanedOn: BusinessDate;
  loanPeriodDays: LoanPeriodDays;
  dueOn: BusinessDate;
  status: LoanStatus;
  version: number;
}

/** 貸出の登録結果。repository が 1 トランザクションで永続化する。 */
export interface LoanRegistration {
  loan: Loan;
  /** 貸出の判定に使った書籍の版番号。更新時の楽観ロックに使う */
  expectedBookVersion: number;
  /** この貸出で受取済みにする予約 (取置中の予約に基づかない貸出では null) */
  pickedUpReservation: HeldReservation | null;
}

/**
 * 貸出可否条件 (条件.tsv) を判定し、貸出を登録する。
 * - 書籍状態が在庫あり、利用者状態が有効で延滞中の貸出を持たない場合に貸出できる
 * - 予約待ち (取置) の書籍は、取置中である予約順 1 位の利用者にだけ貸出できる
 * - 返却期限は貸出日に利用者区分と媒体種別に応じた貸出期間を加算して算出する
 *
 * 判定の順序 (AssumptionRecord A-003): 利用者の存在 → 書籍の存在 → 書籍状態 (取置含む) → 延滞。
 * 利用者区分ごとの貸出上限冊数は値が未決のため判定しない (AssumptionRecord A-002)。
 */
export function registerLoan(input: {
  context: LendingContext;
  loanId: string;
  loanedOn: BusinessDate;
}): LoanRegistration {
  const { context, loanId, loanedOn } = input;
  const patron = assertPatronExists(context.patron);
  const book = assertBookExists(context.book);
  const pickedUpReservation = assertBookLendableTo(book, patron, context.heldReservation);
  if (patron.hasOverdueLoan) throw new PatronHasOverdueLoan();

  const loanPeriodDays = determineLoanPeriod(patron.category, book.mediaType);
  return {
    loan: {
      loanId,
      bookId: book.bookId,
      patronNumber: patron.patronNumber,
      loanedOn,
      loanPeriodDays,
      dueOn: calculateDueOn(loanedOn, loanPeriodDays),
      status: 'on_loan',
      version: 1,
    },
    expectedBookVersion: book.version,
    pickedUpReservation,
  };
}

function assertPatronExists(patron: PatronForLending | null): PatronForLending {
  if (patron === null) throw new PatronNotFound(false);
  if (patron.status === 'deleted') throw new PatronNotFound(true);
  return patron;
}

function assertBookExists(book: BookForLending | null): BookForLending {
  if (book === null) throw new BookNotFound(false);
  if (book.status === 'deleted') throw new BookNotFound(true);
  return book;
}

function assertBookLendableTo(
  book: BookForLending,
  patron: PatronForLending,
  heldReservation: HeldReservation | null,
): HeldReservation | null {
  switch (book.status) {
    case 'available':
      return null;
    case 'on_loan':
      throw new BookOnLoan();
    case 'on_hold':
      if (heldReservation === null || heldReservation.patronNumber !== patron.patronNumber) {
        throw new BookOnHoldForAnotherPatron();
      }
      return heldReservation;
    case 'deleted':
      throw new BookNotFound(true);
  }
}
