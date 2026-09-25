/**
 * 貸出登録の永続化 (circulation モジュール)。
 * 状態を持つ蔵書・貸出・予約は events テーブルへ追記し、同じトランザクションで snapshots を更新する (ADR 0004)。
 * snapshots の version は最後に反映した events の sequence で、楽観ロックに使う (rdb 契約)。
 */
import type { CopyStatus } from '../../domain/circulation/copyStatus';
import type { LendableCopy, LoanRegistration } from '../../domain/circulation/loan';
import {
  ConcurrentUpdateError,
  type LoanRegistrationSession,
  type LoanRepository,
} from '../../domain/circulation/loanRepository';
import type { LoanRule } from '../../domain/circulation/loanRule';
import type { IdGenerator } from '../../domain/shared/clock';
import type { Database, SqlClient } from '../../gateway/database';

interface LendableCopyRow {
  copy_id: string;
  status: CopyStatus;
  version: number;
  book_title: string;
  reservation_id: string | null;
  reservation_version: number | null;
  hold_patron_number: string | null;
}

interface LoanRuleRow {
  loan_rule_id: string;
  loan_period_days: number;
  effective_from: string;
}

function createSession(tx: SqlClient, ids: IdGenerator): LoanRegistrationSession {
  return {
    async findLendableCopy(copyId: string): Promise<LendableCopy | null> {
      const { rows } = await tx.query<LendableCopyRow>(
        `SELECT c.copy_id, c.status, c.version, b.title AS book_title,
                r.reservation_id, r.version AS reservation_version, p.patron_number AS hold_patron_number
           FROM copies c
           JOIN books b ON b.book_id = c.book_id
           LEFT JOIN reservations r ON r.held_copy_id = c.copy_id AND r.status = 'on_hold'
           LEFT JOIN patrons p ON p.patron_id = r.patron_id
          WHERE c.copy_id = $1`,
        [copyId],
      );
      const row = rows[0];
      if (!row) return null;
      const hold =
        row.reservation_id !== null && row.hold_patron_number !== null
          ? {
              reservationId: row.reservation_id,
              patronNumber: row.hold_patron_number,
              version: Number(row.reservation_version),
            }
          : null;
      return {
        copyId: row.copy_id,
        bookTitle: row.book_title,
        status: row.status,
        version: Number(row.version),
        hold,
      };
    },

    async findEffectiveLoanRule(loanedOn: string): Promise<LoanRule | null> {
      const { rows } = await tx.query<LoanRuleRow>(
        `SELECT loan_rule_id, loan_period_days, to_char(effective_from, 'YYYY-MM-DD') AS effective_from
           FROM loan_rules
          WHERE effective_from <= $1::date
          ORDER BY effective_from DESC
          LIMIT 1`,
        [loanedOn],
      );
      const row = rows[0];
      return row
        ? {
            loanRuleId: row.loan_rule_id,
            loanPeriodDays: Number(row.loan_period_days),
            effectiveFrom: row.effective_from,
          }
        : null;
    },

    async save(registration: LoanRegistration, occurredAt: string): Promise<void> {
      const { loan, copyTransition, fulfilledReservation } = registration;
      const actor = loan.loanedByLibrarianId;

      const copyUpdate = await tx.query(
        `UPDATE copies SET status = $2, version = version + 1, updated_at = $3
          WHERE copy_id = $1 AND version = $4`,
        [copyTransition.copyId, copyTransition.to, occurredAt, copyTransition.expectedVersion],
      );
      if (copyUpdate.affectedRows !== 1) throw new ConcurrentUpdateError('copies');
      await tx.query(
        `INSERT INTO copy_events
           (event_id, copy_id, sequence, event_type, from_status, to_status, occurred_at, actor_librarian_id)
         VALUES ($1, $2, $3, 'loaned', $4, $5, $6, $7)`,
        [
          ids.newId(),
          copyTransition.copyId,
          copyTransition.expectedVersion + 1,
          copyTransition.from,
          copyTransition.to,
          occurredAt,
          actor,
        ],
      );

      await tx.query(
        `INSERT INTO loans
           (loan_id, patron_id, copy_id, loan_rule_id, loaned_on, due_on, returned_on, status,
            loaned_by_librarian_id, returned_by_librarian_id, version, updated_at)
         VALUES ($1, $2, $3, $4, $5::date, $6::date, NULL, $7, $8, NULL, 1, $9)`,
        [
          loan.loanId,
          loan.patronId,
          loan.copyId,
          loan.loanRuleId,
          loan.loanedOn,
          loan.dueOn,
          loan.status,
          actor,
          occurredAt,
        ],
      );
      await tx.query(
        `INSERT INTO loan_events
           (event_id, loan_id, sequence, event_type, from_status, to_status, occurred_at, actor_librarian_id)
         VALUES ($1, $2, 1, 'loaned', NULL, $3, $4, $5)`,
        [ids.newId(), loan.loanId, loan.status, occurredAt, actor],
      );

      if (fulfilledReservation) {
        const reservationUpdate = await tx.query(
          `UPDATE reservations
              SET status = 'fulfilled', active_key = NULL, version = version + 1, updated_at = $2
            WHERE reservation_id = $1 AND version = $3 AND status = 'on_hold'`,
          [fulfilledReservation.reservationId, occurredAt, fulfilledReservation.expectedVersion],
        );
        if (reservationUpdate.affectedRows !== 1) throw new ConcurrentUpdateError('reservations');
        await tx.query(
          `INSERT INTO reservation_events
             (event_id, reservation_id, sequence, event_type, from_status, to_status, occurred_at, actor_librarian_id)
           VALUES ($1, $2, $3, 'fulfilled', 'on_hold', 'fulfilled', $4, $5)`,
          [
            ids.newId(),
            fulfilledReservation.reservationId,
            fulfilledReservation.expectedVersion + 1,
            occurredAt,
            actor,
          ],
        );
      }
    },
  };
}

export function createPgLoanRepository(db: Database, ids: IdGenerator): LoanRepository {
  return {
    inTransaction: (fn) => db.transaction((tx) => fn(createSession(tx, ids))),
  };
}
