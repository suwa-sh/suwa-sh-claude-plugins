/**
 * repository の実体 I/O テスト (pglite。docker 不要)。migration は apps/backend-api/migrations が正本。
 */
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerLoan } from '../../domain/circulation/loan';
import { ConcurrentUpdateError } from '../../domain/circulation/loanRepository';
import type { Database } from '../../gateway/database';
import { fixtureIds, seedContractFixtures } from '../../testing/contractFixtures';
import { applyMigrations } from '../../test-app';
import { createPgLoanRepository } from './pgLoanRepository';

let pg: PGlite;
let db: Database;
let seq = 0;
const ids = {
  newId: () => {
    seq += 1;
    return `00000000-0000-4000-9000-${String(seq).padStart(12, '0')}`;
  },
};

beforeEach(async () => {
  pg = new PGlite();
  await applyMigrations(pg);
  await seedContractFixtures(pg);
  db = pg as unknown as Database;
});

afterEach(async () => {
  await pg.close();
});

describe('LoanRepository (pglite)', () => {
  it('取り置き中の蔵書を本人に貸し出す場合、貸出・蔵書・予約の events と snapshots を記録すること', async () => {
    // Arrange
    const repo = createPgLoanRepository(db, ids);

    // Act
    const loanId = await repo.inTransaction(async (session) => {
      const copy = await session.findLendableCopy(fixtureIds.copyOnHold);
      const rule = await session.findEffectiveLoanRule('2026-09-20');
      if (!copy || !rule) throw new Error('fixture missing');
      const registration = registerLoan({
        loanId: ids.newId(),
        borrower: { patronId: fixtureIds.patronM1, patronNumber: 'P-2026-00001' },
        copy,
        loanRule: rule,
        loanedOn: '2026-09-20',
        librarianId: fixtureIds.librarian,
      });
      await session.save(registration, '2026-09-20T03:00:00.000Z');
      return registration.loan.loanId;
    });

    // Assert
    const loan = await pg.query<{ due_on: string; status: string; version: number }>(
      `SELECT to_char(due_on, 'YYYY-MM-DD') AS due_on, status, version FROM loans WHERE loan_id = $1`,
      [loanId],
    );
    expect(loan.rows).toEqual([{ due_on: '2026-10-04', status: 'on_loan', version: 1 }]);
    const copy = await pg.query<{ status: string; version: number }>(
      'SELECT status, version FROM copies WHERE copy_id = $1',
      [fixtureIds.copyOnHold],
    );
    expect(copy.rows).toEqual([{ status: 'on_loan', version: 3 }]);
    const copyEvent = await pg.query<{ event_type: string; from_status: string }>(
      'SELECT event_type, from_status FROM copy_events WHERE copy_id = $1 AND sequence = 3',
      [fixtureIds.copyOnHold],
    );
    expect(copyEvent.rows).toEqual([{ event_type: 'loaned', from_status: 'on_hold' }]);
    const reservation = await pg.query<{ status: string; active_key: string | null }>(
      'SELECT status, active_key FROM reservations WHERE reservation_id = $1',
      [fixtureIds.heldReservation],
    );
    expect(reservation.rows).toEqual([{ status: 'fulfilled', active_key: null }]);
    const loanEvents = await pg.query('SELECT 1 FROM loan_events WHERE loan_id = $1', [loanId]);
    expect(loanEvents.rows).toHaveLength(1);
  });

  it('蔵書の version が読み取り後に進んでいた場合、ConcurrentUpdateError で全体を巻き戻すこと', async () => {
    // Arrange
    const repo = createPgLoanRepository(db, ids);

    // Act
    const act = repo.inTransaction(async (session) => {
      const copy = await session.findLendableCopy(fixtureIds.copyAvailable);
      const rule = await session.findEffectiveLoanRule('2026-09-01');
      if (!copy || !rule) throw new Error('fixture missing');
      const registration = registerLoan({
        loanId: ids.newId(),
        borrower: { patronId: fixtureIds.patronM1, patronNumber: 'P-2026-00001' },
        copy: { ...copy, version: copy.version - 1 },
        loanRule: rule,
        loanedOn: '2026-09-01',
        librarianId: fixtureIds.librarian,
      });
      await session.save(registration, '2026-09-01T03:00:00.000Z');
    });

    // Assert
    await expect(act).rejects.toThrow(ConcurrentUpdateError);
    const loans = await pg.query('SELECT 1 FROM loans WHERE copy_id = $1', [
      fixtureIds.copyAvailable,
    ]);
    expect(loans.rows).toHaveLength(0);
  });

  it('貸出日より後に適用開始の世代がある場合、貸出日時点で有効な世代を返すこと', async () => {
    // Arrange
    await pg.query(
      `INSERT INTO loan_rules (loan_rule_id, loan_period_days, reminder_days_before, effective_from, created_at)
       VALUES ('00000000-0000-4000-8000-000000000102', 21, 3, '2026-10-01', now())`,
    );
    const repo = createPgLoanRepository(db, ids);

    // Act
    const rule = await repo.inTransaction((session) => session.findEffectiveLoanRule('2026-09-30'));

    // Assert
    expect(rule).toEqual({
      loanRuleId: fixtureIds.loanRule,
      loanPeriodDays: 14,
      effectiveFrom: '2000-01-01',
    });
  });
});
