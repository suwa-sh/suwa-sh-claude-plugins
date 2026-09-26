/**
 * 返却を登録する (UC register-return)。
 *
 * 司書が書籍IDを指定して返却を登録する。返却日は当日。対象は書籍の未返却の貸出 (貸出中・延滞)。
 * 貸出を返却済にし、予約中の予約が無ければ書籍を在庫ありに、あれば予約待ちにする。予約状態は変えない。
 * 返却できないときは貸出・書籍に何も書き込まない (初回の応答だけを Idempotency-Key に保存する)。
 * 更新は 1 トランザクションで行う。返却通知の送信待ち記録 (outbox) は UC notify-reserved-book-returned で足す。
 */
import type {
  RegisterReturnRequest,
  ReturnRegistration,
} from '../../../../packages/contracts/library-api/types';
import { toCalendarDate } from '../domain/loan/calendar-date';
import { isUnreturned, type ReturnBookRejection, returnBook } from '../domain/loan/return-book';
import { isLibrarian } from './authorization';
import {
  hashRequest,
  type IdempotentOutcome,
  type RecordedResponse,
  runIdempotently,
} from './idempotent-command';
import type {
  BookReturnRepository,
  Clock,
  IdempotencyRepository,
  LoanReturnRepository,
  Principal,
  UnitOfWork,
  WaitingReservationReader,
} from './ports';

/** 契約 (packages/contracts/library-api/server.ts) の operationId */
export const REGISTER_RETURN_OPERATION_ID = 'registerReturn';

export type RegisterReturnCommand = {
  principal: Principal;
  idempotencyKey: string;
  request: RegisterReturnRequest;
};

/** 書籍を引いた後の初回の判定結果。応答として Idempotency-Key に保存する */
export type RegisterReturnDecision =
  | { kind: 'returned'; registration: ReturnRegistration }
  | { kind: 'book_not_found'; bookId: string }
  | { kind: 'rejected'; code: ReturnBookRejection; bookId: string };

/** 判定結果を応答に変換する (presentation が実装する) */
export interface RegisterReturnResponder {
  render(decision: RegisterReturnDecision): RecordedResponse;
}

export type RegisterReturnOutcome =
  | IdempotentOutcome<RegisterReturnDecision>
  | { kind: 'forbidden' };

export type RegisterReturnDeps = {
  responder: RegisterReturnResponder;
  unitOfWork: UnitOfWork;
  books: BookReturnRepository;
  loans: LoanReturnRepository;
  reservations: WaitingReservationReader;
  idempotency: IdempotencyRepository;
  clock: Clock;
  timeZone: string;
};

export interface RegisterReturn {
  /** 主体がこの操作を呼べるか (入力検証より先に判定するため presentation が先に問い合わせる。AssumptionRecord A-106) */
  isAllowed(principal: Principal): boolean;
  execute(command: RegisterReturnCommand): Promise<RegisterReturnOutcome>;
}

/** 同じキーで本文が異なる再送を見分けるための要求本文のハッシュ (AssumptionRecord A-104) */
export function hashRegisterReturnRequest(request: RegisterReturnRequest): string {
  return hashRequest({ bookId: request.bookId });
}

type DecideContext = { request: RegisterReturnRequest; actorSubject: string; now: Date };

async function decide(
  deps: RegisterReturnDeps,
  { request, actorSubject, now }: DecideContext,
): Promise<RegisterReturnDecision> {
  const book = await deps.books.findForUpdate(request.bookId);
  if (!book) {
    return { kind: 'book_not_found', bookId: request.bookId };
  }
  // 返却できるかは書籍状態でなく未返却の貸出の有無で決める (AssumptionRecord A-102)
  const loan = await deps.loans.findUnreturnedByBookForUpdate(book.bookId);
  const hasWaitingReservation = loan ? await deps.reservations.hasWaiting(book.bookId) : false;
  const result = returnBook({
    unreturnedLoanStatus: loan && isUnreturned(loan.status) ? loan.status : null,
    hasWaitingReservation,
    // 返却日は「サーバーの当日」を図書館のタイムゾーンの暦日で決める (AssumptionRecord A-101)
    returnedOn: toCalendarDate(now, deps.timeZone),
  });
  // returnBook は未返却の貸出が無ければ拒否する。loan の null 判定は型の絞り込みのため
  if (!result.ok || !loan) {
    return { kind: 'rejected', code: 'no_active_loan', bookId: book.bookId };
  }

  const context = { actorSubject, occurredAt: now };
  await deps.loans.markReturned(loan, result.returnedOn, context);
  await deps.books.markReturned(book, result.bookStatus, loan.loanId, context);
  const { version: _version, ...contractLoan } = loan;
  return {
    kind: 'returned',
    registration: {
      loan: { ...contractLoan, returnedOn: result.returnedOn, status: result.loanStatus },
      bookStatus: result.bookStatus,
    },
  };
}

export function createRegisterReturn(deps: RegisterReturnDeps): RegisterReturn {
  return {
    isAllowed: isLibrarian,
    async execute(command) {
      // 司書専用の操作はロールで判定する (ADR 0006、契約「librarian ロールだけが呼べる」)
      if (!isLibrarian(command.principal)) {
        return { kind: 'forbidden' };
      }
      const { request } = command;
      return runIdempotently(deps, {
        scope: {
          idempotencyKey: command.idempotencyKey,
          principalSubject: command.principal.subject,
          operationId: REGISTER_RETURN_OPERATION_ID,
        },
        requestHash: hashRegisterReturnRequest(request),
        decide: (now) => decide(deps, { request, actorSubject: command.principal.subject, now }),
        render: (decision) => deps.responder.render(decision),
      });
    },
  };
}
