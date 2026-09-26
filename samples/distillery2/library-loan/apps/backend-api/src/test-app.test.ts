/**
 * createTestApp (composition root) を通した貸出登録の結線テスト。usecase・repository・pglite を実体でつなぐ。
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { SqlDatabase } from './repository/db-context';
import { createTestApp, startTestDatabase, TEST_TOKENS } from './test-app';
import { CONTRACT_EXAMPLE_IDS, seedContractExamples } from './test-fixtures/contract-examples';

const ids = CONTRACT_EXAMPLE_IDS;

type TestApp = Awaited<ReturnType<typeof createTestApp>>;

async function setUp(): Promise<{ database: SqlDatabase; app: TestApp }> {
  const database = await startTestDatabase();
  await seedContractExamples(database);
  const app = await createTestApp({ database });
  return { database, app };
}

function registerLoan(app: TestApp, key: string) {
  return request(app)
    .post('/loans')
    .set('Authorization', `Bearer ${TEST_TOKENS.librarian}`)
    .set('Idempotency-Key', key);
}

describe('createTestApp 経由の貸出登録', () => {
  it('同じ Idempotency-Key で再送した場合、初回と同じ応答を返し貸出は 1 件だけであること', async () => {
    // Arrange
    const { database, app } = await setUp();
    const body = { bookId: ids.availableBook, patronNumber: ids.patron };
    const first = await registerLoan(app, 'key-1').send(body);

    // Act
    const second = await registerLoan(app, 'key-1').send(body);

    // Assert
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    const loans = await database.query('SELECT 1 FROM loans WHERE book_id = $1', [
      ids.availableBook,
    ]);
    expect(loans.rows).toHaveLength(1);
  });

  it('予約待ちの書籍を予約順 1 位の利用者に貸し出した場合、予約を完了にし書籍を貸出中にすること', async () => {
    // Arrange
    const { database, app } = await setUp();

    // Act
    const res = await registerLoan(app, 'key-2').send({
      bookId: ids.awaitingBookForPatron,
      patronNumber: ids.patron,
    });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.loan).toMatchObject({
      reservationId: ids.reservationForPatron,
      loanedOn: '2026-10-01',
      dueDate: '2026-10-15',
    });
    const reservation = await database.query<{ status: string }>(
      'SELECT status FROM reservations WHERE reservation_id = $1',
      [ids.reservationForPatron],
    );
    expect(reservation.rows).toEqual([{ status: 'completed' }]);
    const book = await database.query<{ status: string }>(
      'SELECT status FROM books WHERE book_id = $1',
      [ids.awaitingBookForPatron],
    );
    expect(book.rows).toEqual([{ status: 'on_loan' }]);
  });

  it('予約順 1 位以外の利用者に貸し出そうとした場合、409 で貸出も予約も変えないこと', async () => {
    // Arrange
    const { database, app } = await setUp();

    // Act
    const res = await registerLoan(app, 'key-3').send({
      bookId: ids.awaitingBookForOther,
      patronNumber: ids.patron,
    });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('not_first_in_reservation_queue');
    const loans = await database.query('SELECT 1 FROM loans WHERE book_id = $1', [
      ids.awaitingBookForOther,
    ]);
    expect(loans.rows).toHaveLength(0);
    const reservation = await database.query<{ status: string }>(
      'SELECT status FROM reservations WHERE reservation_id = $1',
      [ids.reservationForOther],
    );
    expect(reservation.rows).toEqual([{ status: 'notified' }]);
  });

  it('拒否された要求を同じ Idempotency-Key で再送した場合、書籍が貸し出せる状態に戻っていても初回と同じ 409 を返し貸出を記録しないこと', async () => {
    // Arrange
    const { database, app } = await setUp();
    const body = { bookId: ids.onLoanBook, patronNumber: ids.patron };
    const first = await registerLoan(app, 'key-5').send(body);
    await database.query("UPDATE books SET status = 'available' WHERE book_id = $1", [
      ids.onLoanBook,
    ]);

    // Act
    const second = await registerLoan(app, 'key-5').send(body);

    // Assert
    expect(first.status).toBe(409);
    expect(second.status).toBe(409);
    expect(second.text).toBe(first.text);
    const loans = await database.query(
      'SELECT 1 FROM loans WHERE book_id = $1 AND patron_number = $2',
      [ids.onLoanBook, ids.patron],
    );
    expect(loans.rows).toHaveLength(0);
    const stored = await database.query<{ response_status: number }>(
      'SELECT response_status FROM idempotency_keys WHERE idempotency_key = $1',
      ['key-5'],
    );
    expect(stored.rows).toEqual([{ response_status: 409 }]);
  });

  it('アクセストークンを送らない場合、ヘッダを補わずに 401 を返すこと', async () => {
    // Arrange
    const { app } = await setUp();

    // Act
    const res = await request(app)
      .post('/loans')
      .set('Idempotency-Key', 'key-4')
      .send({ bookId: ids.availableBook, patronNumber: ids.patron });

    // Assert
    expect(res.status).toBe(401);
  });
});
