import { randomUUID } from 'node:crypto';
import type {
  BooksRow,
  LoansRow,
  PatronsRow,
  ReservationsRow,
} from '../../../../../packages/contracts/db/tables';
import { VersionConflict } from '../../domain/loan/errors';
import type { LendingContext, LoanRegistration } from '../../domain/loan/loan';
import type { LoanRegistrationRepository } from '../../domain/loan/loan-registration-repository';
import type { SqlClient, SqlQueryable } from '../../gateway/db/sql-client';

type BookRow = Pick<BooksRow, 'book_id' | 'status' | 'media_type' | 'version'>;
type PatronRow = Pick<PatronsRow, 'patron_number' | 'status' | 'category'> & { has_overdue_loan: boolean };
type HeldRow = Pick<ReservationsRow, 'reservation_id' | 'patron_number' | 'version'>;
type QueueRow = Pick<ReservationsRow, 'reservation_id' | 'version'> & { queue_position: number };

/**
 * 貸出登録の repository (RDB)。書籍・貸出・予約はイベントテーブルへ追記し、現在の状態はスナップショットテーブルで持つ。
 * イベントの追記とスナップショットの更新は 1 トランザクションで行う (ADR 0004)。
 */
export class PgLoanRegistrationRepository implements LoanRegistrationRepository {
  constructor(
    private readonly db: SqlClient,
    private readonly newId: () => string = randomUUID,
  ) {}

  async loadLendingContext(bookId: string, patronNumber: string): Promise<LendingContext> {
    const patrons = await this.db.query<PatronRow>(
      `SELECT p.patron_number, p.status, p.category,
              EXISTS (SELECT 1 FROM loans l WHERE l.patron_number = p.patron_number AND l.status = 'overdue') AS has_overdue_loan
         FROM patrons p WHERE p.patron_number = $1`,
      [patronNumber],
    );
    const books = await this.db.query<BookRow>(
      `SELECT book_id, status, media_type, version FROM books WHERE book_id = $1`,
      [bookId],
    );
    const held = await this.db.query<HeldRow>(
      `SELECT reservation_id, patron_number, version FROM reservations
        WHERE book_id = $1 AND status = 'on_hold' AND queue_position = 1`,
      [bookId],
    );
    const patron = patrons.rows[0];
    const book = books.rows[0];
    const reservation = held.rows[0];
    return {
      patron: patron
        ? {
            patronNumber: patron.patron_number,
            status: patron.status,
            category: patron.category,
            hasOverdueLoan: patron.has_overdue_loan,
          }
        : null,
      book: book
        ? { bookId: book.book_id, status: book.status, mediaType: book.media_type, version: book.version }
        : null,
      heldReservation: reservation
        ? {
            reservationId: reservation.reservation_id,
            patronNumber: reservation.patron_number,
            version: reservation.version,
          }
        : null,
    };
  }

  async save(registration: LoanRegistration, actorId: string, occurredAt: Date): Promise<void> {
    const at = occurredAt.toISOString();
    await this.db.transaction(async (tx) => {
      await this.markBookOnLoan(tx, registration, actorId, at);
      await this.insertLoan(tx, registration, actorId, at);
      if (registration.pickedUpReservation) {
        await this.pickUpReservation(tx, registration, actorId, at);
      }
    });
  }

  /** 書籍状態を貸出中にする。書籍単位の楽観ロック (版番号) で同じ書籍への同時登録を直列化する。 */
  private async markBookOnLoan(tx: SqlQueryable, r: LoanRegistration, actorId: string, at: string): Promise<void> {
    const updated = await tx.query<{ version: number }>(
      `UPDATE books SET status = 'on_loan', version = version + 1, updated_at = $3
        WHERE book_id = $1 AND version = $2 RETURNING version`,
      [r.loan.bookId, r.expectedBookVersion, at],
    );
    const row = updated.rows[0];
    if (!row) throw new VersionConflict();
    await tx.query(
      `INSERT INTO book_events (event_id, book_id, book_version, event_type, payload, actor_id, occurred_at)
       VALUES ($1, $2, $3, 'BookLoaned', $4, $5, $6)`,
      [
        this.newId(),
        r.loan.bookId,
        row.version,
        JSON.stringify({ status: 'on_loan', loanId: r.loan.loanId, patronNumber: r.loan.patronNumber }),
        actorId,
        at,
      ],
    );
  }

  private async insertLoan(tx: SqlQueryable, r: LoanRegistration, actorId: string, at: string): Promise<void> {
    const { loan } = r;
    const row: LoansRow = {
      loan_id: loan.loanId,
      book_id: loan.bookId,
      patron_number: loan.patronNumber,
      loaned_on: loan.loanedOn,
      loan_period_days: loan.loanPeriodDays,
      due_on: loan.dueOn,
      returned_on: null,
      status: loan.status,
      version: loan.version,
      created_at: at,
      updated_at: at,
    };
    await tx.query(
      `INSERT INTO loans (loan_id, book_id, patron_number, loaned_on, loan_period_days, due_on, returned_on,
                          status, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        row.loan_id,
        row.book_id,
        row.patron_number,
        row.loaned_on,
        row.loan_period_days,
        row.due_on,
        row.returned_on,
        row.status,
        row.version,
        row.created_at,
        row.updated_at,
      ],
    );
    await tx.query(
      `INSERT INTO loan_events (event_id, loan_id, loan_version, event_type, payload, actor_id, occurred_at)
       VALUES ($1, $2, $3, 'LoanCreated', $4, $5, $6)`,
      [
        this.newId(),
        loan.loanId,
        loan.version,
        JSON.stringify({
          bookId: loan.bookId,
          patronNumber: loan.patronNumber,
          loanedOn: loan.loanedOn,
          loanPeriodDays: loan.loanPeriodDays,
          dueOn: loan.dueOn,
          status: loan.status,
          pickedUpReservationId: r.pickedUpReservation?.reservationId ?? null,
        }),
        actorId,
        at,
      ],
    );
  }

  /**
   * 取置中の予約を受取済みにし、予約順を null にして後続を繰り上げる
   * (契約 reservations.queue_position「受取済み・取消済みになったら null にし、後続を繰り上げる」)。
   */
  private async pickUpReservation(tx: SqlQueryable, r: LoanRegistration, actorId: string, at: string): Promise<void> {
    const reservation = r.pickedUpReservation!;
    const updated = await tx.query<{ version: number }>(
      `UPDATE reservations SET status = 'picked_up', queue_position = NULL, version = version + 1, updated_at = $3
        WHERE reservation_id = $1 AND version = $2 AND status = 'on_hold' RETURNING version`,
      [reservation.reservationId, reservation.version, at],
    );
    const row = updated.rows[0];
    if (!row) throw new VersionConflict();
    await this.appendReservationEvent(tx, reservation.reservationId, row.version, 'ReservationPickedUp', {
      status: 'picked_up',
      loanId: r.loan.loanId,
    }, actorId, at);

    // 一意制約 (book_id, queue_position) に触れないよう、予約順の小さい順に 1 件ずつ繰り上げる
    const queue = await tx.query<QueueRow>(
      `SELECT reservation_id, version, queue_position FROM reservations
        WHERE book_id = $1 AND queue_position IS NOT NULL ORDER BY queue_position`,
      [r.loan.bookId],
    );
    for (const q of queue.rows) {
      const advanced = await tx.query<{ version: number }>(
        `UPDATE reservations SET queue_position = queue_position - 1, version = version + 1, updated_at = $3
          WHERE reservation_id = $1 AND version = $2 RETURNING version`,
        [q.reservation_id, q.version, at],
      );
      const a = advanced.rows[0];
      if (!a) throw new VersionConflict();
      await this.appendReservationEvent(tx, q.reservation_id, a.version, 'QueueAdvanced', {
        fromQueuePosition: q.queue_position,
        toQueuePosition: q.queue_position - 1,
      }, actorId, at);
    }
  }

  private async appendReservationEvent(
    tx: SqlQueryable,
    reservationId: string,
    version: number,
    eventType: string,
    payload: Record<string, unknown>,
    actorId: string,
    at: string,
  ): Promise<void> {
    await tx.query(
      `INSERT INTO reservation_events (event_id, reservation_id, reservation_version, event_type, payload, actor_id, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [this.newId(), reservationId, version, eventType, JSON.stringify(payload), actorId, at],
    );
  }
}
