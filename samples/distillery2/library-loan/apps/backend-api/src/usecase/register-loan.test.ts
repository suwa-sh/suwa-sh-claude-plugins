/**
 * 貸出を登録する (usecase) の単体テスト。repository はインメモリの差し替えで、書き込みの有無と内容を確かめる。
 */
import { describe, expect, it } from 'vitest';
import type { Loan } from '../../../../packages/contracts/library-api/types';
import type {
  BookSnapshot,
  PatronRecord,
  Principal,
  ReservationSnapshot,
  StoredResponse,
} from './ports';
import {
  createRegisterLoan,
  type RegisterLoanCommand,
  type RegisterLoanDecision,
} from './register-loan';

const STATUS_BY_KIND: Record<RegisterLoanDecision['kind'], number> = {
  registered: 201,
  book_not_found: 404,
  rejected: 409,
};

const LIBRARIAN: Principal = { subject: 'librarian-1', role: 'librarian' };
const AVAILABLE_BOOK = '0b6f3c1e-2a4d-4e8f-9b1a-3c5d7e9f1a2b';
const AWAITING_BOOK = '5d2e8a41-7c3b-4f60-8e1d-9a2b4c6d8e0f';
const ON_LOAN_BOOK = '9e4a1c7b-3d5f-4a2e-8b6c-1f3e5a7c9b0d';

type World = {
  books: Map<string, BookSnapshot>;
  patrons: Map<string, PatronRecord>;
  reservations: ReservationSnapshot[];
  loans: Loan[];
  bookWrites: string[];
  completedReservations: string[];
  idempotency: Map<string, StoredResponse>;
};

function createWorld(): World {
  return {
    books: new Map([
      [AVAILABLE_BOOK, { bookId: AVAILABLE_BOOK, status: 'available', version: 1 }],
      [AWAITING_BOOK, { bookId: AWAITING_BOOK, status: 'awaiting_pickup', version: 3 }],
      [ON_LOAN_BOOK, { bookId: ON_LOAN_BOOK, status: 'on_loan', version: 2 }],
    ]),
    patrons: new Map([
      ['P-00000001', { patronNumber: 'P-00000001', deletedOn: null }],
      ['P-00000002', { patronNumber: 'P-00000002', deletedOn: null }],
      ['P-00000009', { patronNumber: 'P-00000009', deletedOn: '2026-09-01' }],
    ]),
    reservations: [
      {
        reservationId: 'r-first',
        patronNumber: 'P-00000001',
        status: 'notified',
        queuePosition: 1,
        version: 2,
      },
      {
        reservationId: 'r-second',
        patronNumber: 'P-00000002',
        status: 'waiting',
        queuePosition: 2,
        version: 1,
      },
    ],
    loans: [],
    bookWrites: [],
    completedReservations: [],
    idempotency: new Map(),
  };
}

function createUsecase(world: World) {
  let sequence = 0;
  return createRegisterLoan({
    responder: {
      render: (decision) => ({
        status: STATUS_BY_KIND[decision.kind],
        body: JSON.stringify(decision),
      }),
    },
    unitOfWork: { run: (fn) => fn() },
    books: {
      findForUpdate: async (bookId) => world.books.get(bookId) ?? null,
      markOnLoan: async (book, loanId) => {
        world.books.set(book.bookId, { ...book, status: 'on_loan', version: book.version + 1 });
        world.bookWrites.push(`${book.bookId}:${loanId}`);
      },
    },
    patrons: { findByPatronNumber: async (n) => world.patrons.get(n) ?? null },
    reservations: {
      findFirstInQueueForUpdate: async () =>
        world.reservations.find((r) => r.queuePosition === 1) ?? null,
      complete: async (reservation) => {
        world.completedReservations.push(reservation.reservationId);
      },
    },
    loans: {
      register: async (loan) => {
        world.loans.push(loan);
      },
    },
    idempotency: {
      find: async (scope) => world.idempotency.get(JSON.stringify(scope)) ?? null,
      save: async (scope, response) => {
        world.idempotency.set(JSON.stringify(scope), response);
      },
    },
    clock: { now: () => new Date('2026-10-01T09:00:00+09:00') },
    ids: {
      newId: () => {
        sequence += 1;
        return `loan-${sequence}`;
      },
    },
    loanPeriodDays: 14,
    timeZone: 'Asia/Tokyo',
  });
}

function command(overrides: Partial<RegisterLoanCommand> = {}): RegisterLoanCommand {
  return {
    principal: LIBRARIAN,
    idempotencyKey: 'key-1',
    request: { bookId: AVAILABLE_BOOK, patronNumber: 'P-00000001' },
    ...overrides,
  };
}

describe('貸出を登録する', () => {
  it('在庫ありの書籍を登録済みの利用者に貸し出す場合、貸出日と返却期限を設定して貸出を記録し書籍を貸出中にすること', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);

    // Act
    const outcome = await usecase.execute(command());

    // Assert
    const decision: RegisterLoanDecision = {
      kind: 'registered',
      registration: {
        bookStatus: 'on_loan',
        loan: {
          loanId: 'loan-1',
          patronNumber: 'P-00000001',
          bookId: AVAILABLE_BOOK,
          reservationId: null,
          loanedOn: '2026-10-01',
          dueDate: '2026-10-15',
          returnedOn: null,
          status: 'on_loan',
        },
      },
    };
    expect(outcome).toMatchObject({ kind: 'decided', decision, response: { status: 201 } });
    const response = outcome.kind === 'decided' ? outcome.response : null;
    expect(JSON.parse(response?.body ?? 'null')).toEqual(decision);
    expect(world.bookWrites).toEqual([`${AVAILABLE_BOOK}:loan-1`]);
    expect(world.completedReservations).toEqual([]);
    expect([...world.idempotency.values()]).toEqual([
      { requestHash: expect.any(String), responseStatus: 201, responseBody: response?.body },
    ]);
  });

  it('予約待ちの書籍を予約順 1 位の利用者に貸し出す場合、その予約だけを完了にすること', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);

    // Act
    const outcome = await usecase.execute(
      command({ request: { bookId: AWAITING_BOOK, patronNumber: 'P-00000001' } }),
    );

    // Assert
    expect(outcome).toMatchObject({
      kind: 'decided',
      decision: {
        kind: 'registered',
        registration: { loan: { reservationId: 'r-first' }, bookStatus: 'on_loan' },
      },
    });
    expect(world.completedReservations).toEqual(['r-first']);
  });

  it('予約待ちの書籍を予約順 1 位以外の利用者に貸し出す場合、貸出・書籍・予約に書き込まずに拒否し、拒否の応答だけを保存すること', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);

    // Act
    const outcome = await usecase.execute(
      command({ request: { bookId: AWAITING_BOOK, patronNumber: 'P-00000002' } }),
    );

    // Assert
    expect(outcome).toMatchObject({
      kind: 'decided',
      decision: {
        kind: 'rejected',
        code: 'not_first_in_reservation_queue',
        queueStanding: 'not_first',
      },
      response: { status: 409 },
    });
    expect(world.loans).toEqual([]);
    expect(world.bookWrites).toEqual([]);
    expect(world.completedReservations).toEqual([]);
    expect([...world.idempotency.values()]).toEqual([
      { requestHash: expect.any(String), responseStatus: 409, responseBody: expect.any(String) },
    ]);
  });

  it('予約待ちの書籍で本人が予約順 1 位でも未通知の場合、1 位で未通知であることを添えて拒否すること', async () => {
    // Arrange
    const world = createWorld();
    world.reservations[0] = { ...world.reservations[0], status: 'waiting' };
    const usecase = createUsecase(world);

    // Act
    const outcome = await usecase.execute(
      command({ request: { bookId: AWAITING_BOOK, patronNumber: 'P-00000001' } }),
    );

    // Assert
    expect(outcome).toMatchObject({
      kind: 'decided',
      decision: {
        kind: 'rejected',
        code: 'not_first_in_reservation_queue',
        queueStanding: 'first_not_notified',
      },
    });
    expect(world.completedReservations).toEqual([]);
  });

  it('貸出中の書籍の場合、何も書き込まずに book_on_loan で拒否すること', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);

    // Act
    const outcome = await usecase.execute(
      command({ request: { bookId: ON_LOAN_BOOK, patronNumber: 'P-00000001' } }),
    );

    // Assert
    expect(outcome).toMatchObject({
      kind: 'decided',
      decision: { kind: 'rejected', code: 'book_on_loan' },
    });
    expect(world.loans).toEqual([]);
  });

  it('論理削除済みの利用者の場合、patron_not_registered で拒否すること', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);

    // Act
    const outcome = await usecase.execute(
      command({ request: { bookId: AVAILABLE_BOOK, patronNumber: 'P-00000009' } }),
    );

    // Assert
    expect(outcome).toMatchObject({
      kind: 'decided',
      decision: { kind: 'rejected', code: 'patron_not_registered' },
    });
    expect(world.loans).toEqual([]);
  });

  it('登録されていない書籍の場合、book_not_found を返すこと', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);
    const unknownBook = '11111111-2222-4333-8444-555555555555';

    // Act
    const outcome = await usecase.execute(
      command({ request: { bookId: unknownBook, patronNumber: 'P-00000001' } }),
    );

    // Assert
    expect(outcome).toMatchObject({
      kind: 'decided',
      decision: { kind: 'book_not_found', bookId: unknownBook },
      response: { status: 404 },
    });
  });

  it('司書以外のロールの場合、forbidden を返し何も書き込まないこと', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);

    // Act
    const outcome = await usecase.execute(
      command({ principal: { subject: 'patron-1', role: 'patron', patronNumber: 'P-00000001' } }),
    );

    // Assert
    expect(outcome).toEqual({ kind: 'forbidden' });
    expect(world.loans).toEqual([]);
    expect(world.idempotency.size).toBe(0);
  });

  it('同じ Idempotency-Key で同じ内容を再送した場合、初回と同じ応答を返し貸出を重複させないこと', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);
    const first = await usecase.execute(command());

    // Act
    const second = await usecase.execute(command());

    // Assert
    expect(first.kind).toBe('decided');
    expect(second).toEqual({
      kind: 'replayed',
      response: first.kind === 'decided' ? first.response : null,
    });
    expect(world.loans).toHaveLength(1);
  });

  it('拒否された要求を同じ Idempotency-Key で再送した場合、その後に貸し出せる状態になっても初回と同じ拒否の応答を返し貸出を記録しないこと', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);
    const onLoan = command({ request: { bookId: ON_LOAN_BOOK, patronNumber: 'P-00000001' } });
    const first = await usecase.execute(onLoan);
    world.books.set(ON_LOAN_BOOK, { bookId: ON_LOAN_BOOK, status: 'available', version: 3 });

    // Act
    const second = await usecase.execute(onLoan);

    // Assert
    expect(first).toMatchObject({ kind: 'decided', response: { status: 409 } });
    expect(second).toEqual({
      kind: 'replayed',
      response: first.kind === 'decided' ? first.response : null,
    });
    expect(world.loans).toEqual([]);
    expect(world.bookWrites).toEqual([]);
  });

  it('書籍が登録されていない要求を同じ Idempotency-Key で再送した場合、初回と同じ 404 の応答を返すこと', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);
    const unknownBook = '11111111-2222-4333-8444-555555555555';
    const missing = command({ request: { bookId: unknownBook, patronNumber: 'P-00000001' } });
    const first = await usecase.execute(missing);

    // Act
    const second = await usecase.execute(missing);

    // Assert
    expect(second).toEqual({
      kind: 'replayed',
      response: first.kind === 'decided' ? first.response : null,
    });
  });

  it('同じ Idempotency-Key で異なる内容を送った場合、idempotency_key_conflict を返すこと', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);
    await usecase.execute(command());

    // Act
    const outcome = await usecase.execute(
      command({ request: { bookId: AWAITING_BOOK, patronNumber: 'P-00000001' } }),
    );

    // Assert
    expect(outcome).toEqual({ kind: 'idempotency_key_conflict', idempotencyKey: 'key-1' });
    expect(world.loans).toHaveLength(1);
  });
});
