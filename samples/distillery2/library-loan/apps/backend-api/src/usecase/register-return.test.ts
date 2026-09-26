/**
 * 返却を登録する (usecase) の単体テスト。repository はインメモリの差し替えで、書き込みの有無と内容を確かめる。
 *
 * 出典: features/貸出業務/register-return.feature、contract-slice の POST /returns (registerReturn)。
 */
import { describe, expect, it } from 'vitest';
import type { BookSnapshot, LoanSnapshot, Principal, StoredResponse } from './ports';
import {
  createRegisterReturn,
  type RegisterReturnCommand,
  type RegisterReturnDecision,
} from './register-return';

const STATUS_BY_KIND: Record<RegisterReturnDecision['kind'], number> = {
  returned: 201,
  book_not_found: 404,
  rejected: 409,
};

const LIBRARIAN: Principal = { subject: 'librarian-1', role: 'librarian' };
const ON_LOAN_BOOK = '4c1d7e2a-8b3f-4e6a-9c1d-2f5a8b3e6c9d';
const AVAILABLE_BOOK = '6e9b2d5a-1f4c-4a8e-9b3d-7a2e5c8f1b4d';
const LOAN_ID = '7e2b5d8a-3c6f-4a1e-8d4b-9f2c5e8a1b3d';

type World = {
  books: Map<string, BookSnapshot>;
  loans: LoanSnapshot[];
  waitingBooks: Set<string>;
  bookWrites: string[];
  loanWrites: string[];
  idempotency: Map<string, StoredResponse>;
};

function createWorld(): World {
  return {
    books: new Map([
      [ON_LOAN_BOOK, { bookId: ON_LOAN_BOOK, status: 'on_loan', version: 2 }],
      [AVAILABLE_BOOK, { bookId: AVAILABLE_BOOK, status: 'available', version: 1 }],
    ]),
    loans: [
      {
        loanId: LOAN_ID,
        patronNumber: 'P-00000001',
        bookId: ON_LOAN_BOOK,
        reservationId: null,
        loanedOn: '2026-10-01',
        dueDate: '2026-10-15',
        returnedOn: null,
        status: 'on_loan',
        version: 1,
      },
    ],
    waitingBooks: new Set(),
    bookWrites: [],
    loanWrites: [],
    idempotency: new Map(),
  };
}

function createUsecase(world: World) {
  return createRegisterReturn({
    responder: {
      render: (decision) => ({
        status: STATUS_BY_KIND[decision.kind],
        body: JSON.stringify(decision),
      }),
    },
    unitOfWork: { run: (fn) => fn() },
    books: {
      findForUpdate: async (bookId) => world.books.get(bookId) ?? null,
      markReturned: async (book, status, loanId) => {
        world.bookWrites.push(`${book.bookId}:${status}:${loanId}`);
      },
    },
    loans: {
      findUnreturnedByBookForUpdate: async (bookId) =>
        world.loans.find((l) => l.bookId === bookId && l.returnedOn === null) ?? null,
      markReturned: async (loan, returnedOn) => {
        world.loanWrites.push(`${loan.loanId}:${returnedOn}`);
      },
    },
    reservations: { hasWaiting: async (bookId) => world.waitingBooks.has(bookId) },
    idempotency: {
      find: async (scope) => world.idempotency.get(JSON.stringify(scope)) ?? null,
      save: async (scope, response) => {
        world.idempotency.set(JSON.stringify(scope), response);
      },
    },
    // 2026-10-15 00:30 (Asia/Tokyo) = 2026-10-14 15:30 UTC。返却日は Asia/Tokyo の暦日になる
    clock: { now: () => new Date('2026-10-14T15:30:00Z') },
    timeZone: 'Asia/Tokyo',
  });
}

function command(overrides: Partial<RegisterReturnCommand> = {}): RegisterReturnCommand {
  return {
    principal: LIBRARIAN,
    idempotencyKey: 'key-1',
    request: { bookId: ON_LOAN_BOOK },
    ...overrides,
  };
}

describe('返却を登録する', () => {
  it('予約のない貸出中の書籍の場合、当日を返却日として貸出を返却済にし書籍を在庫ありにすること', async () => {
    // Arrange
    const world = createWorld();

    // Act
    const outcome = await createUsecase(world).execute(command());

    // Assert
    expect(outcome).toMatchObject({
      kind: 'decided',
      decision: {
        kind: 'returned',
        registration: {
          bookStatus: 'available',
          loan: {
            loanId: LOAN_ID,
            patronNumber: 'P-00000001',
            bookId: ON_LOAN_BOOK,
            reservationId: null,
            loanedOn: '2026-10-01',
            dueDate: '2026-10-15',
            returnedOn: '2026-10-15',
            status: 'returned',
          },
        },
      },
    });
    expect(world.loanWrites).toEqual([`${LOAN_ID}:2026-10-15`]);
    expect(world.bookWrites).toEqual([`${ON_LOAN_BOOK}:available:${LOAN_ID}`]);
  });

  it('返却結果の貸出には版を含めないこと', async () => {
    // Arrange
    const world = createWorld();

    // Act
    const outcome = await createUsecase(world).execute(command());

    // Assert
    if (outcome.kind !== 'decided' || outcome.decision.kind !== 'returned') {
      throw new Error('返却されませんでした');
    }
    expect(outcome.decision.registration.loan).not.toHaveProperty('version');
  });

  it('予約中の予約がある書籍の場合、書籍を予約待ちにすること', async () => {
    // Arrange
    const world = createWorld();
    world.waitingBooks.add(ON_LOAN_BOOK);

    // Act
    await createUsecase(world).execute(command());

    // Assert
    expect(world.bookWrites).toEqual([`${ON_LOAN_BOOK}:awaiting_pickup:${LOAN_ID}`]);
  });

  it('未返却の貸出が無い書籍の場合、no_active_loan で拒否し貸出と書籍に書き込まないこと', async () => {
    // Arrange
    const world = createWorld();

    // Act
    const outcome = await createUsecase(world).execute(
      command({ request: { bookId: AVAILABLE_BOOK } }),
    );

    // Assert
    expect(outcome).toMatchObject({
      kind: 'decided',
      decision: { kind: 'rejected', code: 'no_active_loan', bookId: AVAILABLE_BOOK },
      response: { status: 409 },
    });
    expect(world.loanWrites).toEqual([]);
    expect(world.bookWrites).toEqual([]);
  });

  it('書籍が登録されていない場合、book_not_found を返し何も書き込まないこと', async () => {
    // Arrange
    const world = createWorld();
    const unknown = '0e5c8b1f-4a7d-4f2c-8e9b-3d6a1c4f7b2e';

    // Act
    const outcome = await createUsecase(world).execute(command({ request: { bookId: unknown } }));

    // Assert
    expect(outcome).toMatchObject({ decision: { kind: 'book_not_found', bookId: unknown } });
    expect(world.loanWrites).toEqual([]);
  });

  it('司書以外が呼んだ場合、forbidden を返し何も書き込まないこと', async () => {
    // Arrange
    const world = createWorld();
    const patron: Principal = { subject: 'patron-1', role: 'patron', patronNumber: 'P-00000001' };

    // Act
    const outcome = await createUsecase(world).execute(command({ principal: patron }));

    // Assert
    expect(outcome).toEqual({ kind: 'forbidden' });
    expect(world.idempotency.size).toBe(0);
  });

  it('司書かどうかの問い合わせの場合、ロールで判定すること', () => {
    // Arrange
    const usecase = createUsecase(createWorld());

    // Act
    const allowed = [LIBRARIAN, { subject: 'p', role: 'patron' as const }].map(usecase.isAllowed);

    // Assert
    expect(allowed).toEqual([true, false]);
  });

  it('同じ Idempotency-Key で再送した場合、初回の応答を返し 2 回目は書き込まないこと', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);
    const first = await usecase.execute(command());

    // Act
    const second = await usecase.execute(command());

    // Assert
    expect(second).toEqual({
      kind: 'replayed',
      response: first.kind === 'decided' ? first.response : null,
    });
    expect(world.loanWrites).toHaveLength(1);
  });

  it('同じ Idempotency-Key で別の書籍を送った場合、idempotency_key_conflict を返すこと', async () => {
    // Arrange
    const world = createWorld();
    const usecase = createUsecase(world);
    await usecase.execute(command());

    // Act
    const second = await usecase.execute(command({ request: { bookId: AVAILABLE_BOOK } }));

    // Assert
    expect(second).toEqual({ kind: 'idempotency_key_conflict', idempotencyKey: 'key-1' });
  });

  it('返却と貸出で同じ Idempotency-Key を使った場合、operationId で区別して保存すること', async () => {
    // Arrange
    const world = createWorld();

    // Act
    await createUsecase(world).execute(command());

    // Assert
    expect([...world.idempotency.keys()]).toEqual([
      JSON.stringify({
        idempotencyKey: 'key-1',
        principalSubject: 'librarian-1',
        operationId: 'registerReturn',
      }),
    ]);
  });
});
