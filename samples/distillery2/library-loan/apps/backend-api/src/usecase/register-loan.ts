/**
 * 貸出を登録する (UC register-loan)。
 *
 * 司書が利用者番号と書籍IDを指定して貸出を登録する。貸出日は当日、返却期限は貸出日に貸出期間を加えた日。
 * 貸し出せないときは貸出・書籍・予約に何も書き込まない (初回の応答だけを Idempotency-Key に保存する)。
 * 更新は 1 トランザクションで行う。
 */
import { createHash } from 'node:crypto';
import type {
  Loan,
  LoanRegistration,
  RegisterLoanRequest,
} from '../../../../packages/contracts/library-api/types';
import { toCalendarDate } from '../domain/loan/calendar-date';
import { completesReservation, type LendBookRejection, lendBook } from '../domain/loan/lend-book';
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

/** 利用者に返す応答 (契約 idempotency_keys の response_status / response_body と同じ形) */
export type RecordedResponse = { status: number; body: string | null };

/** 判定結果を応答に変換する (presentation が実装する)。usecase は保存と再送時の再生だけを行う */
export interface RegisterLoanResponder {
  render(decision: RegisterLoanDecision): RecordedResponse;
}

export type RegisterLoanOutcome =
  | { kind: 'decided'; decision: RegisterLoanDecision; response: RecordedResponse }
  | { kind: 'replayed'; response: RecordedResponse }
  | { kind: 'forbidden' }
  | { kind: 'idempotency_key_conflict'; idempotencyKey: string };

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
  execute(command: RegisterLoanCommand): Promise<RegisterLoanOutcome>;
}

/** 同じキーで本文が異なる再送を見分けるための要求本文のハッシュ (AssumptionRecord A-005) */
export function hashRegisterLoanRequest(request: RegisterLoanRequest): string {
  const canonical = JSON.stringify({ bookId: request.bookId, patronNumber: request.patronNumber });
  return createHash('sha256').update(canonical).digest('hex');
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
    async execute(command) {
      // 司書専用の操作はロールで判定する (ADR 0006)
      if (command.principal.role !== 'librarian') {
        return { kind: 'forbidden' };
      }
      const { request } = command;
      const scope: IdempotencyScope = {
        idempotencyKey: command.idempotencyKey,
        principalSubject: command.principal.subject,
        operationId: REGISTER_LOAN_OPERATION_ID,
      };
      const requestHash = hashRegisterLoanRequest(request);

      return deps.unitOfWork.run<RegisterLoanOutcome>(async () => {
        const stored = await deps.idempotency.find(scope);
        if (stored) {
          if (stored.requestHash !== requestHash) {
            return { kind: 'idempotency_key_conflict', idempotencyKey: command.idempotencyKey };
          }
          // 同じキーの再送には、成功・拒否を問わず初回の応答をそのまま返す (契約 parameters/IdempotencyKey)
          return {
            kind: 'replayed',
            response: { status: stored.responseStatus, body: stored.responseBody },
          };
        }

        const now = deps.clock.now();
        const decision = await decide(deps, {
          request,
          actorSubject: command.principal.subject,
          now,
        });
        // 拒否 (409) や書籍不在の応答も、貸出と同じトランザクションで保存する (AssumptionRecord A-005)
        const response = deps.responder.render(decision);
        await deps.idempotency.save(
          scope,
          { requestHash, responseStatus: response.status, responseBody: response.body },
          now,
        );
        return { kind: 'decided', decision, response };
      });
    },
  };
}
