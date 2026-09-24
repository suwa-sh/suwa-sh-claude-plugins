/**
 * repository の実体 I/O テスト。使い捨ての PGlite に migration の正本を当てて検証する (testing.md 実体 I/O 規約)。
 */
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VersionConflict } from '../../domain/loan/errors';
import { registerLoan } from '../../domain/loan/loan';
import { applyMigrations } from '../../test-app';
import { CONTRACT_FIXTURE_IDS as IDS, seedContractFixture } from '../../testing/contract-fixture';
import { PgLoanRegistrationRepository } from './pg-loan-registration-repository';

let pg: PGlite;
let repo: PgLoanRegistrationRepository;
const AT = new Date('2026-10-01T00:00:00Z');

beforeEach(async () => {
  pg = new PGlite();
  await applyMigrations(pg);
  await seedContractFixture(pg);
  let seq = 0;
  repo = new PgLoanRegistrationRepository(pg, () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`);
});

afterEach(async () => {
  await pg.close();
});

const LOAN_ID = '99999999-9999-4999-8999-999999999999';

describe('PgLoanRegistrationRepository', () => {
  it('loadLendingContext_延滞中の貸出を持つ利用者の場合_hasOverdueLoan が true であること', async () => {
    // Arrange
    const patronNumber = IDS.patronWithOverdueLoan;

    // Act
    const ctx = await repo.loadLendingContext(IDS.availableBookId, patronNumber);

    // Assert
    expect(ctx.patron).toEqual({ patronNumber, status: 'active', category: 'general', hasOverdueLoan: true });
    expect(ctx.book).toEqual({ bookId: IDS.availableBookId, status: 'available', mediaType: 'paper', version: 1 });
    expect(ctx.heldReservation).toBeNull();
  });

  it('loadLendingContext_取置の書籍の場合_予約順1位の取置中の予約を返すこと', async () => {
    // Arrange
    const bookId = IDS.heldBookId;

    // Act
    const ctx = await repo.loadLendingContext(bookId, IDS.activePatron);

    // Assert
    expect(ctx.heldReservation).toEqual({
      reservationId: IDS.heldReservationId,
      patronNumber: IDS.activePatron,
      version: 2,
    });
  });

  it('loadLendingContext_存在しない書籍と利用者の場合_null を返すこと', async () => {
    // Arrange
    const bookId = '00000000-0000-4000-8000-00000000abcd';

    // Act
    const ctx = await repo.loadLendingContext(bookId, 'P999999');

    // Assert
    expect(ctx.book).toBeNull();
    expect(ctx.patron).toBeNull();
  });

  it('save_在庫ありの書籍の場合_貸出と書籍のスナップショットとイベントを記録すること', async () => {
    // Arrange
    const ctx = await repo.loadLendingContext(IDS.availableBookId, IDS.activePatron);
    const registration = registerLoan({ context: ctx, loanId: LOAN_ID, loanedOn: '2026-10-01' });

    // Act
    await repo.save(registration, 'staff-1', AT);

    // Assert
    const loans = await pg.query(
      `SELECT patron_number, loaned_on::text, loan_period_days, due_on::text, status, version FROM loans WHERE loan_id = $1`,
      [LOAN_ID],
    );
    expect(loans.rows).toEqual([
      { patron_number: 'P000123', loaned_on: '2026-10-01', loan_period_days: 14, due_on: '2026-10-15', status: 'on_loan', version: 1 },
    ]);
    const books = await pg.query(`SELECT status, version FROM books WHERE book_id = $1`, [IDS.availableBookId]);
    expect(books.rows).toEqual([{ status: 'on_loan', version: 2 }]);
    const bookEvents = await pg.query(`SELECT event_type, book_version, actor_id FROM book_events WHERE book_id = $1`, [
      IDS.availableBookId,
    ]);
    expect(bookEvents.rows).toEqual([{ event_type: 'BookLoaned', book_version: 2, actor_id: 'staff-1' }]);
    const loanEvents = await pg.query(`SELECT event_type, loan_version FROM loan_events WHERE loan_id = $1`, [LOAN_ID]);
    expect(loanEvents.rows).toEqual([{ event_type: 'LoanCreated', loan_version: 1 }]);
  });

  it('save_取置中の予約に基づく貸出の場合_予約を受取済みにして予約順を繰り上げること', async () => {
    // Arrange
    const waitingId = '88888888-8888-4888-8888-888888888888';
    await pg.query(
      `INSERT INTO reservations (reservation_id, book_id, patron_number, reserved_at, queue_position, status, version, created_at, updated_at)
       VALUES ($1, $2, 'P000456', '2026-09-20T00:00:00Z', 2, 'waiting', 1, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z')`,
      [waitingId, IDS.heldBookId],
    );
    const ctx = await repo.loadLendingContext(IDS.heldBookId, IDS.activePatron);
    const registration = registerLoan({ context: ctx, loanId: LOAN_ID, loanedOn: '2026-10-01' });

    // Act
    await repo.save(registration, 'staff-1', AT);

    // Assert
    const rsv = await pg.query(`SELECT reservation_id, status, queue_position FROM reservations ORDER BY reserved_at DESC`);
    expect(rsv.rows).toEqual([
      { reservation_id: waitingId, status: 'waiting', queue_position: 1 },
      { reservation_id: IDS.heldReservationId, status: 'picked_up', queue_position: null },
    ]);
    const events = await pg.query(`SELECT reservation_id, event_type FROM reservation_events ORDER BY event_type`);
    expect(events.rows).toEqual([
      { reservation_id: waitingId, event_type: 'QueueAdvanced' },
      { reservation_id: IDS.heldReservationId, event_type: 'ReservationPickedUp' },
    ]);
  });

  it('save_書籍の版番号が変わっていた場合_VersionConflict で何も記録しないこと', async () => {
    // Arrange
    const ctx = await repo.loadLendingContext(IDS.availableBookId, IDS.activePatron);
    const registration = registerLoan({ context: ctx, loanId: LOAN_ID, loanedOn: '2026-10-01' });
    await pg.query(`UPDATE books SET version = version + 1 WHERE book_id = $1`, [IDS.availableBookId]);

    // Act
    const act = repo.save(registration, 'staff-1', AT);

    // Assert
    await expect(act).rejects.toBeInstanceOf(VersionConflict);
    const loans = await pg.query(`SELECT 1 FROM loans WHERE loan_id = $1`, [LOAN_ID]);
    expect(loans.rows).toHaveLength(0);
    const books = await pg.query(`SELECT status FROM books WHERE book_id = $1`, [IDS.availableBookId]);
    expect(books.rows).toEqual([{ status: 'available' }]);
  });
});
