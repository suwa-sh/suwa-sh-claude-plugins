/**
 * createTestApp (composition root) を通した返却登録の結線テスト (scaffold の red baseline)。
 * usecase・repository・pglite を実体でつなぐ。前提データは素の SQL で入れる。
 *
 * 出典: features/貸出業務/register-return.feature「予約のない貸出中の書籍の返却を登録する」
 * 「未返却の貸出が無い書籍は返却を登録できない」、contract-slice の POST /returns (registerReturn) の 201 / 409。
 * 時計は createTestApp の既定 (TEST_NOW = 2026-10-01 Asia/Tokyo) なので、返却日は 2026-10-01 になる。
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { SqlDatabase } from './repository/db-context';
import { createTestApp, startTestDatabase, TEST_TOKENS } from './test-app';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;

const SEEDED_AT = '2026-09-01T09:00:00+09:00';
const PATRON = 'P-00000201';

async function setUp(): Promise<{ database: SqlDatabase; app: TestApp }> {
  const database = await startTestDatabase();
  await database.query(
    'INSERT INTO patrons (patron_number, idp_subject, name, email_encrypted, registered_on, deleted_on, updated_at) VALUES ($1, NULL, $2, $3, $4, NULL, $5)',
    [PATRON, '合成 太郎', `enc:synthetic-${PATRON}`, '2026-09-01', SEEDED_AT],
  );
  const app = await createTestApp({ database });
  return { database, app };
}

async function insertBook(database: SqlDatabase, status: string): Promise<string> {
  const bookId = randomUUID();
  await database.query(
    "INSERT INTO books (book_id, title, author, isbn, publisher, genre, media_type, status, registered_on, deleted_on, version, updated_at) VALUES ($1, 'テスト書籍', 'テスト著者', NULL, NULL, NULL, 'paper', $2, '2026-09-01', NULL, 1, $3)",
    [bookId, status, SEEDED_AT],
  );
  return bookId;
}

async function insertLoan(database: SqlDatabase, bookId: string): Promise<string> {
  const loanId = randomUUID();
  await database.query(
    "INSERT INTO loans (loan_id, patron_number, book_id, reservation_id, loaned_on, due_date, returned_on, status, version, updated_at) VALUES ($1, $2, $3, NULL, '2026-09-20', '2026-10-04', NULL, 'on_loan', 1, $4)",
    [loanId, PATRON, bookId, SEEDED_AT],
  );
  return loanId;
}

function registerReturn(app: TestApp, key: string) {
  return request(app)
    .post('/returns')
    .set('Authorization', `Bearer ${TEST_TOKENS.librarian}`)
    .set('Idempotency-Key', key);
}

describe('createTestApp 経由の返却登録', () => {
  it('予約のない貸出中の書籍の返却を登録した場合、201 で貸出を返却済にし書籍を在庫ありにすること', async () => {
    // Arrange
    const { database, app } = await setUp();
    const bookId = await insertBook(database, 'on_loan');
    const loanId = await insertLoan(database, bookId);

    // Act
    const res = await registerReturn(app, 'return-key-1').send({ bookId });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      bookStatus: 'available',
      loan: { loanId, bookId, returnedOn: '2026-10-01', status: 'returned' },
    });
    const loan = await database.query<{ status: string; returned_on: string | null }>(
      'SELECT status::text AS status, returned_on::text AS returned_on FROM loans WHERE loan_id = $1',
      [loanId],
    );
    expect(loan.rows).toEqual([{ status: 'returned', returned_on: '2026-10-01' }]);
    const book = await database.query<{ status: string }>(
      'SELECT status::text AS status FROM books WHERE book_id = $1',
      [bookId],
    );
    expect(book.rows).toEqual([{ status: 'available' }]);
  });

  it('未返却の貸出が無い書籍の返却を登録しようとした場合、409 no_active_loan で書籍状態を変えないこと', async () => {
    // Arrange
    const { database, app } = await setUp();
    const bookId = await insertBook(database, 'available');

    // Act
    const res = await registerReturn(app, 'return-key-2').send({ bookId });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('no_active_loan');
    const book = await database.query<{ status: string }>(
      'SELECT status::text AS status FROM books WHERE book_id = $1',
      [bookId],
    );
    expect(book.rows).toEqual([{ status: 'available' }]);
  });
});
