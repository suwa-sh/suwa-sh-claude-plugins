/**
 * 返却を登録する UC が使う repository (RDB 実装) の実体 I/O テスト。pglite に migration を当てて検証する。
 * 前提データは契約 registerReturn の examples に合わせた test-fixtures/contract-examples。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { startTestDatabase } from '../test-app';
import { CONTRACT_EXAMPLE_IDS, seedContractExamples } from '../test-fixtures/contract-examples';
import { createDbContext, type DbContext, type SqlDatabase } from './db-context';
import {
  createPgBookRepository,
  createPgLoanRepository,
  createPgReservationRepository,
} from './pg-loan-repositories';

const ids = CONTRACT_EXAMPLE_IDS;
const context = { actorSubject: 'test-librarian', occurredAt: new Date('2026-10-15T01:00:00Z') };

let database: SqlDatabase;
let db: DbContext;

beforeEach(async () => {
  database = await startTestDatabase();
  await seedContractExamples(database);
  db = createDbContext(database);
});

describe('LoanRepository (返却)', () => {
  it('延滞している貸出の書籍の場合、未返却の貸出として日付を暦日の文字列で返すこと', async () => {
    // Arrange
    const loans = createPgLoanRepository(db);

    // Act
    const loan = await loans.findUnreturnedByBookForUpdate(ids.overdueBook);

    // Assert
    expect(loan).toEqual({
      loanId: ids.overdueLoan,
      patronNumber: ids.patron,
      bookId: ids.overdueBook,
      reservationId: null,
      loanedOn: '2026-09-01',
      dueDate: '2026-09-15',
      returnedOn: null,
      status: 'overdue',
      version: 1,
    });
  });

  it('未返却の貸出が無い書籍の場合、null を返すこと', async () => {
    // Arrange
    const loans = createPgLoanRepository(db);

    // Act
    const loan = await loans.findUnreturnedByBookForUpdate(ids.noActiveLoanBook);

    // Assert
    expect(loan).toBeNull();
  });

  it('貸出を返却済にした場合、返却日を記録して版を上げ同じ連番の貸出イベントを追記すること', async () => {
    // Arrange
    const loans = createPgLoanRepository(db);
    const loan = await loans.findUnreturnedByBookForUpdate(ids.returnBook);
    if (!loan) throw new Error('fixture の貸出がありません');

    // Act
    await db.run(() => loans.markReturned(loan, '2026-10-15', context));

    // Assert
    const snapshot = await database.query<{
      status: string;
      returned_on: string | null;
      version: number;
    }>('SELECT status, returned_on::text AS returned_on, version FROM loans WHERE loan_id = $1', [
      ids.returnLoan,
    ]);
    expect(snapshot.rows).toEqual([{ status: 'returned', returned_on: '2026-10-15', version: 2 }]);
    const events = await database.query<{ sequence: number; event_type: string }>(
      'SELECT sequence, event_type FROM loan_events WHERE loan_id = $1',
      [ids.returnLoan],
    );
    expect(events.rows).toEqual([{ sequence: 2, event_type: 'returned' }]);
    expect(await loans.findUnreturnedByBookForUpdate(ids.returnBook)).toBeNull();
  });

  it('版が古い貸出で返却済にした場合、ConcurrentUpdateError を投げ貸出イベントを残さないこと', async () => {
    // Arrange
    const loans = createPgLoanRepository(db);
    const loan = await loans.findUnreturnedByBookForUpdate(ids.returnBook);
    if (!loan) throw new Error('fixture の貸出がありません');

    // Act
    const act = db.run(() => loans.markReturned({ ...loan, version: 99 }, '2026-10-15', context));

    // Assert
    await expect(act).rejects.toThrow('同時に更新されました');
    const events = await database.query('SELECT 1 FROM loan_events WHERE loan_id = $1', [
      ids.returnLoan,
    ]);
    expect(events.rows).toHaveLength(0);
  });
});

describe('BookRepository (返却)', () => {
  it('貸出中の書籍を予約待ちにした場合、版を上げて返却の書籍イベントを追記すること', async () => {
    // Arrange
    const books = createPgBookRepository(db);
    const book = await books.findForUpdate(ids.reservedOnLoanBook);
    if (!book) throw new Error('fixture の書籍がありません');

    // Act
    await db.run(() =>
      books.markReturned(book, 'awaiting_pickup', ids.reservedOnLoanLoan, context),
    );

    // Assert
    const snapshot = await database.query<{ status: string; version: number }>(
      'SELECT status, version FROM books WHERE book_id = $1',
      [ids.reservedOnLoanBook],
    );
    expect(snapshot.rows).toEqual([{ status: 'awaiting_pickup', version: 2 }]);
    const events = await database.query<{ sequence: number; event_type: string; payload: string }>(
      'SELECT sequence, event_type, payload FROM book_events WHERE book_id = $1',
      [ids.reservedOnLoanBook],
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0]).toMatchObject({ sequence: 2, event_type: 'returned' });
    expect(JSON.parse(events.rows[0]?.payload ?? '{}')).toEqual({
      loanId: ids.reservedOnLoanLoan,
      from: 'on_loan',
      to: 'awaiting_pickup',
    });
  });
});

describe('ReservationRepository (返却)', () => {
  it('予約中の予約がある書籍の場合、true を返すこと', async () => {
    // Arrange
    const reservations = createPgReservationRepository(db);

    // Act
    const found = await reservations.hasWaiting(ids.reservedOnLoanBook);

    // Assert
    expect(found).toBe(true);
  });

  it('予約が通知済だけの書籍の場合、予約中の予約は無いとして false を返すこと', async () => {
    // Arrange
    const reservations = createPgReservationRepository(db);

    // Act
    const found = await reservations.hasWaiting(ids.awaitingBookForPatron);

    // Assert
    expect(found).toBe(false);
  });
});
