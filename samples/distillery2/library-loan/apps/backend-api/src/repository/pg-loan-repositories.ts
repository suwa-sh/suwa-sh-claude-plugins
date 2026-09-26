/**
 * 貸出を登録する UC・返却を登録する UC が使う repository の RDB 実装 (契約 contracts/db/rdb-schema.yaml)。
 *
 * 書籍・貸出・予約は追記型のイベントとスナップショットで持つ (ADR 0004)。
 * イベントは物理更新・物理削除せず、スナップショットの更新と同じトランザクションで追記する。
 * イベントの sequence はスナップショットの version と一致させる。
 */
import { randomUUID } from 'node:crypto';
import type {
  BookStatus,
  Loan,
  LoanStatus,
  ReservationStatus,
} from '../../../../packages/contracts/library-api/types';
import type { DbContext } from './db-context';

type EventContext = { actorSubject: string; occurredAt: Date };
type BookSnapshot = { bookId: string; status: BookStatus; version: number };
type ReservationSnapshot = {
  reservationId: string;
  patronNumber: string;
  status: ReservationStatus;
  queuePosition: number;
  version: number;
};

/**
 * イベント種別 (契約では「値は UC で定める」)。
 * 貸出の登録は register-loan の AssumptionRecord A-007、返却の登録は register-return の AssumptionRecord A-103
 */
export const EVENT_TYPES = {
  bookLent: 'lent',
  loanRegistered: 'registered',
  reservationCompleted: 'completed',
  bookReturned: 'returned',
  loanReturned: 'returned',
} as const;

type LoanSnapshot = Loan & { version: number };
type ReturnedBookStatus = Extract<BookStatus, 'available' | 'awaiting_pickup'>;

async function appendBookEvent(
  db: DbContext,
  bookId: string,
  sequence: number,
  eventType: string,
  payload: Record<string, unknown>,
  context: EventContext,
): Promise<void> {
  await db
    .client()
    .query(
      'INSERT INTO book_events (event_id, book_id, sequence, event_type, payload, actor_subject, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        randomUUID(),
        bookId,
        sequence,
        eventType,
        JSON.stringify(payload),
        context.actorSubject,
        context.occurredAt.toISOString(),
      ],
    );
}

async function appendLoanEvent(
  db: DbContext,
  loanId: string,
  sequence: number,
  eventType: string,
  payload: unknown,
  context: EventContext,
): Promise<void> {
  await db
    .client()
    .query(
      'INSERT INTO loan_events (event_id, loan_id, sequence, event_type, payload, actor_subject, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        randomUUID(),
        loanId,
        sequence,
        eventType,
        JSON.stringify(payload),
        context.actorSubject,
        context.occurredAt.toISOString(),
      ],
    );
}

/** 書籍状態を変えて版を 1 つ進め、書籍イベントを追記する */
async function changeBookStatus(
  db: DbContext,
  book: BookSnapshot,
  to: BookStatus,
  eventType: string,
  loanId: string,
  context: EventContext,
): Promise<void> {
  const nextVersion = book.version + 1;
  const updated = await db
    .client()
    .query(
      'UPDATE books SET status = $1, version = $2, updated_at = $3 WHERE book_id = $4 AND version = $5',
      [to, nextVersion, context.occurredAt.toISOString(), book.bookId, book.version],
    );
  expectOneRow(updated.affectedRows, '書籍', book.bookId);
  await appendBookEvent(
    db,
    book.bookId,
    nextVersion,
    eventType,
    { loanId, from: book.status, to },
    context,
  );
}

/** 楽観ロックの版が合わず、同時に別の更新が入ったとき */
export class ConcurrentUpdateError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} は同時に更新されました`);
    this.name = 'ConcurrentUpdateError';
  }
}

function expectOneRow(affectedRows: number | undefined, entity: string, id: string): void {
  if (affectedRows !== 1) {
    throw new ConcurrentUpdateError(entity, id);
  }
}

export function createPgBookRepository(db: DbContext) {
  return {
    async findForUpdate(bookId: string): Promise<BookSnapshot | null> {
      const { rows } = await db
        .client()
        .query<{ book_id: string; status: BookStatus; version: number }>(
          'SELECT book_id, status, version FROM books WHERE book_id = $1 AND deleted_on IS NULL FOR UPDATE',
          [bookId],
        );
      const row = rows[0];
      return row ? { bookId: row.book_id, status: row.status, version: row.version } : null;
    },

    async markOnLoan(book: BookSnapshot, loanId: string, context: EventContext): Promise<void> {
      await changeBookStatus(db, book, 'on_loan', EVENT_TYPES.bookLent, loanId, context);
    },

    async markReturned(
      book: BookSnapshot,
      status: ReturnedBookStatus,
      loanId: string,
      context: EventContext,
    ): Promise<void> {
      await changeBookStatus(db, book, status, EVENT_TYPES.bookReturned, loanId, context);
    },
  };
}

export function createPgPatronRepository(db: DbContext) {
  return {
    async findByPatronNumber(
      patronNumber: string,
    ): Promise<{ patronNumber: string; deletedOn: string | null } | null> {
      const { rows } = await db
        .client()
        .query<{ patron_number: string; deleted_on: string | null }>(
          'SELECT patron_number, deleted_on::text AS deleted_on FROM patrons WHERE patron_number = $1',
          [patronNumber],
        );
      const row = rows[0];
      return row ? { patronNumber: row.patron_number, deletedOn: row.deleted_on } : null;
    },
  };
}

export function createPgReservationRepository(db: DbContext) {
  return {
    async hasWaiting(bookId: string): Promise<boolean> {
      const { rows } = await db
        .client()
        .query<{ found: number }>(
          "SELECT 1 AS found FROM reservations WHERE book_id = $1 AND status = 'waiting' LIMIT 1",
          [bookId],
        );
      return rows.length > 0;
    },

    async findFirstInQueueForUpdate(bookId: string): Promise<ReservationSnapshot | null> {
      const { rows } = await db.client().query<{
        reservation_id: string;
        patron_number: string;
        status: ReservationStatus;
        queue_position: number;
        version: number;
      }>(
        "SELECT reservation_id, patron_number, status, queue_position, version FROM reservations WHERE book_id = $1 AND status IN ('waiting', 'notified') AND queue_position IS NOT NULL ORDER BY queue_position ASC LIMIT 1 FOR UPDATE",
        [bookId],
      );
      const row = rows[0];
      return row
        ? {
            reservationId: row.reservation_id,
            patronNumber: row.patron_number,
            status: row.status,
            queuePosition: row.queue_position,
            version: row.version,
          }
        : null;
    },

    async complete(
      reservation: ReservationSnapshot,
      loanId: string,
      context: EventContext,
    ): Promise<void> {
      const client = db.client();
      const nextVersion = reservation.version + 1;
      const at = context.occurredAt.toISOString();
      // 完了した予約は予約順位の管理対象から外れる (queue_position = null)。後続の予約順位は変えない (AssumptionRecord A-008)
      const updated = await client.query(
        "UPDATE reservations SET status = 'completed', queue_position = NULL, completed_at = $1, version = $2, updated_at = $1 WHERE reservation_id = $3 AND version = $4",
        [at, nextVersion, reservation.reservationId, reservation.version],
      );
      expectOneRow(updated.affectedRows, '予約', reservation.reservationId);
      await client.query(
        'INSERT INTO reservation_events (event_id, reservation_id, sequence, event_type, payload, actor_subject, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          randomUUID(),
          reservation.reservationId,
          nextVersion,
          EVENT_TYPES.reservationCompleted,
          JSON.stringify({ loanId, from: reservation.status, to: 'completed' }),
          context.actorSubject,
          at,
        ],
      );
    },
  };
}

export function createPgLoanRepository(db: DbContext) {
  return {
    async register(loan: Loan, context: EventContext): Promise<void> {
      const at = context.occurredAt.toISOString();
      const initialVersion = 1;
      await db
        .client()
        .query(
          'INSERT INTO loans (loan_id, patron_number, book_id, reservation_id, loaned_on, due_date, returned_on, status, version, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [
            loan.loanId,
            loan.patronNumber,
            loan.bookId,
            loan.reservationId,
            loan.loanedOn,
            loan.dueDate,
            loan.returnedOn,
            loan.status,
            initialVersion,
            at,
          ],
        );
      await appendLoanEvent(
        db,
        loan.loanId,
        initialVersion,
        EVENT_TYPES.loanRegistered,
        loan,
        context,
      );
    },

    async findUnreturnedByBookForUpdate(bookId: string): Promise<LoanSnapshot | null> {
      // 未返却の貸出は貸出中・延滞。書籍 1 冊に未返却の貸出は高々 1 件 (貸出可否条件で貸出中の書籍は貸し出せない)。
      // 書籍に続いて貸出も行ロックし、同じ書籍の同時返却を直列にする (AssumptionRecord A-105)
      const { rows } = await db.client().query<{
        loan_id: string;
        patron_number: string;
        book_id: string;
        reservation_id: string | null;
        loaned_on: string;
        due_date: string;
        returned_on: string | null;
        status: LoanStatus;
        version: number;
      }>(
        "SELECT loan_id, patron_number, book_id, reservation_id, loaned_on::text AS loaned_on, due_date::text AS due_date, returned_on::text AS returned_on, status, version FROM loans WHERE book_id = $1 AND status IN ('on_loan', 'overdue') ORDER BY loaned_on DESC LIMIT 1 FOR UPDATE",
        [bookId],
      );
      const row = rows[0];
      return row
        ? {
            loanId: row.loan_id,
            patronNumber: row.patron_number,
            bookId: row.book_id,
            reservationId: row.reservation_id,
            loanedOn: row.loaned_on,
            dueDate: row.due_date,
            returnedOn: row.returned_on,
            status: row.status,
            version: row.version,
          }
        : null;
    },

    async markReturned(
      loan: LoanSnapshot,
      returnedOn: string,
      context: EventContext,
    ): Promise<void> {
      const nextVersion = loan.version + 1;
      const updated = await db
        .client()
        .query(
          "UPDATE loans SET status = 'returned', returned_on = $1, version = $2, updated_at = $3 WHERE loan_id = $4 AND version = $5",
          [returnedOn, nextVersion, context.occurredAt.toISOString(), loan.loanId, loan.version],
        );
      expectOneRow(updated.affectedRows, '貸出', loan.loanId);
      await appendLoanEvent(
        db,
        loan.loanId,
        nextVersion,
        EVENT_TYPES.loanReturned,
        { returnedOn, from: loan.status, to: 'returned' },
        context,
      );
    },
  };
}

type IdempotencyScope = { idempotencyKey: string; principalSubject: string; operationId: string };
type StoredResponse = { requestHash: string; responseStatus: number; responseBody: string | null };

export function createPgIdempotencyRepository(db: DbContext) {
  return {
    async find(scope: IdempotencyScope): Promise<StoredResponse | null> {
      const { rows } = await db.client().query<{
        request_hash: string;
        response_status: number;
        response_body: string | null;
      }>(
        'SELECT request_hash, response_status, response_body FROM idempotency_keys WHERE idempotency_key = $1 AND principal_subject = $2 AND operation_id = $3',
        [scope.idempotencyKey, scope.principalSubject, scope.operationId],
      );
      const row = rows[0];
      return row
        ? {
            requestHash: row.request_hash,
            responseStatus: row.response_status,
            responseBody: row.response_body,
          }
        : null;
    },

    async save(scope: IdempotencyScope, response: StoredResponse, createdAt: Date): Promise<void> {
      await db
        .client()
        .query(
          'INSERT INTO idempotency_keys (idempotency_key, principal_subject, operation_id, request_hash, response_status, response_body, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            scope.idempotencyKey,
            scope.principalSubject,
            scope.operationId,
            response.requestHash,
            response.responseStatus,
            response.responseBody,
            createdAt.toISOString(),
          ],
        );
    },
  };
}
