/**
 * 貸出を登録する UC の repository (RDB 実装) の実体 I/O テスト。pglite に migration を当てて検証する。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Loan } from '../../../../packages/contracts/library-api/types';
import { startTestDatabase } from '../test-app';
import { CONTRACT_EXAMPLE_IDS, seedContractExamples } from '../test-fixtures/contract-examples';
import { createDbContext, type DbContext, type SqlDatabase } from './db-context';
import {
  createPgBookRepository,
  createPgIdempotencyRepository,
  createPgLoanRepository,
  createPgPatronRepository,
  createPgReservationRepository,
} from './pg-loan-repositories';

const ids = CONTRACT_EXAMPLE_IDS;
const context = { actorSubject: 'test-librarian', occurredAt: new Date('2026-10-01T00:00:00Z') };
const NEW_LOAN_ID = '3f8a2d6c-1b4e-4a7f-9c2d-5e8b1a4d7c0e';

function newLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    loanId: NEW_LOAN_ID,
    patronNumber: ids.patron,
    bookId: ids.availableBook,
    reservationId: null,
    loanedOn: '2026-10-01',
    dueDate: '2026-10-15',
    returnedOn: null,
    status: 'on_loan',
    ...overrides,
  };
}

let database: SqlDatabase;
let db: DbContext;

beforeEach(async () => {
  database = await startTestDatabase();
  await seedContractExamples(database);
  db = createDbContext(database);
});

describe('BookRepository', () => {
  it('在庫ありの書籍を貸出中にした場合、スナップショットの版を上げて同じ連番の書籍イベントを追記すること', async () => {
    // Arrange
    const books = createPgBookRepository(db);
    const book = await books.findForUpdate(ids.availableBook);
    if (!book) throw new Error('fixture の書籍がありません');

    // Act
    await db.run(() => books.markOnLoan(book, NEW_LOAN_ID, context));

    // Assert
    const snapshot = await database.query<{ status: string; version: number }>(
      'SELECT status, version FROM books WHERE book_id = $1',
      [ids.availableBook],
    );
    expect(snapshot.rows).toEqual([{ status: 'on_loan', version: 2 }]);
    const events = await database.query<{ sequence: number; event_type: string }>(
      'SELECT sequence, event_type FROM book_events WHERE book_id = $1',
      [ids.availableBook],
    );
    expect(events.rows).toEqual([{ sequence: 2, event_type: 'lent' }]);
  });

  it('論理削除済みの書籍の場合、見つからないこと', async () => {
    // Arrange
    await database.query("UPDATE books SET deleted_on = '2026-09-30' WHERE book_id = $1", [
      ids.availableBook,
    ]);
    const books = createPgBookRepository(db);

    // Act
    const book = await books.findForUpdate(ids.availableBook);

    // Assert
    expect(book).toBeNull();
  });

  it('版が古いスナップショットで更新した場合、ConcurrentUpdateError を投げ書籍イベントを残さないこと', async () => {
    // Arrange
    const books = createPgBookRepository(db);
    const stale = { bookId: ids.availableBook, status: 'available' as const, version: 99 };

    // Act
    const act = db.run(() => books.markOnLoan(stale, NEW_LOAN_ID, context));

    // Assert
    await expect(act).rejects.toThrow('同時に更新されました');
    const events = await database.query('SELECT 1 FROM book_events WHERE book_id = $1', [
      ids.availableBook,
    ]);
    expect(events.rows).toHaveLength(0);
  });
});

describe('PatronRepository', () => {
  it('論理削除済みの利用者の場合、削除日を暦日の文字列で返すこと', async () => {
    // Arrange
    await database.query("UPDATE patrons SET deleted_on = '2026-09-15' WHERE patron_number = $1", [
      ids.patron,
    ]);
    const patrons = createPgPatronRepository(db);

    // Act
    const patron = await patrons.findByPatronNumber(ids.patron);

    // Assert
    expect(patron).toEqual({ patronNumber: ids.patron, deletedOn: '2026-09-15' });
  });
});

describe('ReservationRepository', () => {
  it('予約順 1 位の予約を完了にした場合、予約順位の管理対象から外し予約イベントを追記すること', async () => {
    // Arrange
    const reservations = createPgReservationRepository(db);
    const first = await reservations.findFirstInQueueForUpdate(ids.awaitingBookForPatron);
    if (!first) throw new Error('fixture の予約がありません');

    // Act
    await db.run(() => reservations.complete(first, NEW_LOAN_ID, context));

    // Assert
    const snapshot = await database.query<{
      status: string;
      queue_position: number | null;
      version: number;
    }>('SELECT status, queue_position, version FROM reservations WHERE reservation_id = $1', [
      ids.reservationForPatron,
    ]);
    expect(snapshot.rows).toEqual([{ status: 'completed', queue_position: null, version: 3 }]);
    const events = await database.query<{ sequence: number; event_type: string }>(
      'SELECT sequence, event_type FROM reservation_events WHERE reservation_id = $1',
      [ids.reservationForPatron],
    );
    expect(events.rows).toEqual([{ sequence: 3, event_type: 'completed' }]);
  });
});

describe('LoanRepository', () => {
  it('貸出を記録した場合、版 1 のスナップショットと連番 1 の貸出イベントを書くこと', async () => {
    // Arrange
    const loans = createPgLoanRepository(db);

    // Act
    await db.run(() => loans.register(newLoan(), context));

    // Assert
    const snapshot = await database.query<{
      loaned_on: string;
      due_date: string;
      status: string;
      version: number;
    }>(
      'SELECT loaned_on::text AS loaned_on, due_date::text AS due_date, status, version FROM loans WHERE loan_id = $1',
      [NEW_LOAN_ID],
    );
    expect(snapshot.rows).toEqual([
      { loaned_on: '2026-10-01', due_date: '2026-10-15', status: 'on_loan', version: 1 },
    ]);
    const events = await database.query<{ sequence: number; event_type: string }>(
      'SELECT sequence, event_type FROM loan_events WHERE loan_id = $1',
      [NEW_LOAN_ID],
    );
    expect(events.rows).toEqual([{ sequence: 1, event_type: 'registered' }]);
  });

  it('同じトランザクションの途中で失敗した場合、記録した貸出も巻き戻ること', async () => {
    // Arrange
    const loans = createPgLoanRepository(db);

    // Act
    const act = db.run(async () => {
      await loans.register(newLoan(), context);
      throw new Error('後続の更新が失敗した');
    });

    // Assert
    await expect(act).rejects.toThrow('後続の更新が失敗した');
    const rows = await database.query('SELECT 1 FROM loans WHERE loan_id = $1', [NEW_LOAN_ID]);
    expect(rows.rows).toHaveLength(0);
  });
});

describe('IdempotencyRepository', () => {
  it('保存した初回応答の場合、同じキー・主体・operationId で引けること', async () => {
    // Arrange
    const idempotency = createPgIdempotencyRepository(db);
    const scope = {
      idempotencyKey: 'key-1',
      principalSubject: 'test-librarian',
      operationId: 'registerLoan',
    };
    const response = { requestHash: 'hash-1', responseStatus: 201, responseBody: '{"a":1}' };
    await idempotency.save(scope, response, context.occurredAt);

    // Act
    const found = await idempotency.find(scope);

    // Assert
    expect(found).toEqual(response);
    expect(await idempotency.find({ ...scope, principalSubject: 'someone-else' })).toBeNull();
  });
});
