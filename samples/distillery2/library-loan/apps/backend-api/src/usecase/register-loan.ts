/**
 * 貸出を登録する (UC register-loan)。
 *
 * 司書が利用者番号と書籍IDを指定して貸出を登録する。貸出日は当日、返却期限は貸出日に貸出期間を加えた日。
 * 貸し出せないときは貸出・書籍・予約に何も書き込まない (初回の応答だけを Idempotency-Key に保存する)。
 * 更新は 1 トランザクションで行う。
 */
import type {
  Loan,
  LoanRegistration,
  RegisterLoanRequest,
} from '../../../../packages/contracts/library-api/types';
import { toCalendarDate } from '../domain/loan/calendar-date';
import { completesReservation, type LendBookRejection, lendBook } from '../domain/loan/lend-book';
import { isLibrarian } from './authorization';
import {
  hashRequest,
  type IdempotentOutcome,
  type RecordedResponse,
  runIdempotently,
} from './idempotent-command';
import type {
  BookRepository,
  Clock,
  IdempotencyRepository,
  IdempotencyScope,
  IdGenerator,
  LoanRepository,
  PatronRepository,
  Principal,
  ReservationRepository,
  ReservationSnapshot,
  UnitOfWork,
} from './ports';

/** 契約 (packages/contracts/library-api/server.ts) の operationId */
export const REGISTER_LOAN_OPERATION_ID = 'registerLoan';

export type RegisterLoanCommand = {
  principal: Principal;
  idempotencyKey: string;
  request: RegisterLoanRequest;
};

/**
 * 予約待ちの書籍に対する借り手の立場 (予約順位の管理対象の予約のうち最も順位が小さいものとの関係)。
 * 拒否理由の説明文を事実に合わせるために使う (AssumptionRecord A-013)
 */
export type QueueStanding = 'first_notified' | 'first_not_notified' | 'not_first';

/** 書籍を引いた後の初回の判定結果。応答として Idempotency-Key に保存する */
export type RegisterLoanDecision =
  | { kind: 'registered'; registration: LoanRegistration }
  | { kind: 'book_not_found'; bookId: string }
  | {
      kind: 'rejected';
      code: LendBookRejection;
      request: RegisterLoanRequest;
      queueStanding: QueueStanding;
    };

export type { RecordedResponse };

/** 判定結果を応答に変換する (presentation が実装する)。usecase は保存と再送時の再生だけを行う */
export interface RegisterLoanResponder {
  render(decision: RegisterLoanDecision): RecordedResponse;
}

export type RegisterLoanOutcome = IdempotentOutcome<RegisterLoanDecision> | { kind: 'forbidden' };

export type RegisterLoanDeps = {
  responder: RegisterLoanResponder;
  unitOfWork: UnitOfWork;
  books: BookRepository;
  patrons: PatronRepository;
  reservations: ReservationRepository;
  loans: LoanRepository;
  idempotency: IdempotencyRepository;
  clock: Clock;
  ids: IdGenerator;
  loanPeriodDays: number;
  timeZone: string;
};

export interface RegisterLoan {
  /** 主体がこの操作を呼べるか (入力検証より先に判定するため presentation が先に問い合わせる。AssumptionRecord A-106) */
  isAllowed(principal: Principal): boolean;
  execute(command: RegisterLoanCommand): Promise<RegisterLoanOutcome>;
}

/** 同じキーで本文が異なる再送を見分けるための要求本文のハッシュ (AssumptionRecord A-005) */
export function hashRegisterLoanRequest(request: RegisterLoanRequest): string {
  return hashRequest({ bookId: request.bookId, patronNumber: request.patronNumber });
}

function queueStanding(
  reservation: ReservationSnapshot | null,
  patronNumber: string,
): QueueStanding {
  if (reservation === null || reservation.patronNumber !== patronNumber) {
    return 'not_first';
  }
  return reservation.status === 'notified' ? 'first_notified' : 'first_not_notified';
}

type DecideContext = { request: RegisterLoanRequest; actorSubject: string; now: Date };

async function decide(
  deps: RegisterLoanDeps,
  { request, actorSubject, now }: DecideContext,
): Promise<RegisterLoanDecision> {
  const book = await deps.books.findForUpdate(request.bookId);
  if (!book) {
    return { kind: 'book_not_found', bookId: request.bookId };
  }
  const patron = await deps.patrons.findByPatronNumber(request.patronNumber);
  const reservation =
    book.status === 'awaiting_pickup'
      ? await deps.reservations.findFirstInQueueForUpdate(book.bookId)
      : null;
  const standing = queueStanding(reservation, request.patronNumber);

  const decision = lendBook({
    bookStatus: book.status,
    patronRegistered: patron !== null && patron.deletedOn === null,
    patronIsFirstInQueue: standing === 'first_notified',
    loanedOn: toCalendarDate(now, deps.timeZone),
    loanPeriodDays: deps.loanPeriodDays,
  });
  if (!decision.ok) {
    return { kind: 'rejected', code: decision.code, request, queueStanding: standing };
  }

  const completedReservation =
    completesReservation(book.status) && reservation ? reservation : null;
  const loan: Loan = {
    loanId: deps.ids.newId(),
    patronNumber: request.patronNumber,
    bookId: book.bookId,
    reservationId: completedReservation ? completedReservation.reservationId : null,
    loanedOn: decision.loanedOn,
    dueDate: decision.dueDate,
    returnedOn: null,
    status: decision.loanStatus,
  };
  const context = { actorSubject, occurredAt: now };
  await deps.loans.register(loan, context);
  await deps.books.markOnLoan(book, loan.loanId, context);
  if (completedReservation) {
    await deps.reservations.complete(completedReservation, loan.loanId, context);
  }
  return { kind: 'registered', registration: { loan, bookStatus: decision.bookStatus } };
}

export function createRegisterLoan(deps: RegisterLoanDeps): RegisterLoan {
  return {
    isAllowed: isLibrarian,
    async execute(command) {
      // 司書専用の操作はロールで判定する (ADR 0006)
      if (!isLibrarian(command.principal)) {
        return { kind: 'forbidden' };
      }
      const { request } = command;
      const scope: IdempotencyScope = {
        idempotencyKey: command.idempotencyKey,
        principalSubject: command.principal.subject,
        operationId: REGISTER_LOAN_OPERATION_ID,
      };
      return runIdempotently(deps, {
        scope,
        requestHash: hashRegisterLoanRequest(request),
        decide: (now) => decide(deps, { request, actorSubject: command.principal.subject, now }),
        render: (decision) => deps.responder.render(decision),
      });
    },
  };
}
