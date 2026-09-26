/**
 * 貸出を登録する UC が使う repository の RDB 実装 (契約 contracts/db/rdb-schema.yaml)。
 *
 * 書籍・貸出・予約は追記型のイベントとスナップショットで持つ (ADR 0004)。
 * イベントは物理更新・物理削除せず、スナップショットの更新と同じトランザクションで追記する。
 * イベントの sequence はスナップショットの version と一致させる。
 */
import { randomUUID } from 'node:crypto';
import type {
  BookStatus,
  Loan,
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

/** イベント種別 (契約では「値は UC で定める」)。AssumptionRecord A-007 */
export const EVENT_TYPES = {
  bookLent: 'lent',
  loanRegistered: 'registered',
  reservationCompleted: 'completed',
} as const;

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
      const client = db.client();
      const nextVersion = book.version + 1;
      const updated = await client.query(
        "UPDATE books SET status = 'on_loan', version = $1, updated_at = $2 WHERE book_id = $3 AND version = $4",
        [nextVersion, context.occurredAt.toISOString(), book.bookId, book.version],
      );
      expectOneRow(updated.affectedRows, '書籍', book.bookId);
      await client.query(
        'INSERT INTO book_events (event_id, book_id, sequence, event_type, payload, actor_subject, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          randomUUID(),
          book.bookId,
          nextVersion,
          EVENT_TYPES.bookLent,
          JSON.stringify({ loanId, from: book.status, to: 'on_loan' }),
          context.actorSubject,
          context.occurredAt.toISOString(),
        ],
      );
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
      const client = db.client();
      const at = context.occurredAt.toISOString();
      const initialVersion = 1;
      await client.query(
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
      await client.query(
        'INSERT INTO loan_events (event_id, loan_id, sequence, event_type, payload, actor_subject, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          randomUUID(),
          loan.loanId,
          initialVersion,
          EVENT_TYPES.loanRegistered,
          JSON.stringify(loan),
          context.actorSubject,
          at,
        ],
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
