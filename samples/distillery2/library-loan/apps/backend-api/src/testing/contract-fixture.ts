import type { SqlQueryable } from '../gateway/db/sql-client';

/**
 * 契約 createLoan の例が前提にする状態 (contracts/openapi/paths/loans.yaml 先頭コメント) を再現する fixture。
 * 利用者の氏名・連絡先は架空の値 (ADR 0007)。暗号化列はテスト用の印を付けた平文を入れる。
 */
export const CONTRACT_FIXTURE_IDS = {
  /** 架空の物語A (在庫あり) */
  availableBookId: '11111111-1111-4111-8111-111111111111',
  /** 架空の歴史B (P000123 の予約が取置中) */
  heldBookId: '22222222-2222-4222-8222-222222222222',
  /** 貸出中の書籍 (P000456 に貸出中) */
  onLoanBookId: '33333333-3333-4333-8333-333333333333',
  /** 削除済みの書籍 */
  deletedBookId: '44444444-4444-4444-8444-444444444444',
  /** P000456 の延滞中の貸出 */
  overdueLoanId: '55555555-5555-4555-8555-555555555555',
  /** P000123 の取置中の予約 */
  heldReservationId: '7f4e9d3c-0a6b-4c5d-9e8f-3a4b5c6d7e8f',
  activePatron: 'P000123',
  patronWithOverdueLoan: 'P000456',
  deletedPatron: 'P000999',
} as const;

const AT = '2026-09-01T00:00:00Z';

export async function seedContractFixture(db: SqlQueryable): Promise<void> {
  const ids = CONTRACT_FIXTURE_IDS;
  const patrons: Array<[string, string, string, string]> = [
    [ids.activePatron, '図書 太郎', 'taro@example.com', 'active'],
    [ids.patronWithOverdueLoan, '書架 花子', 'hanako@example.com', 'active'],
    [ids.deletedPatron, '架空 削除', 'deleted@example.com', 'deleted'],
  ];
  for (const [num, name, email, status] of patrons) {
    await db.query(
      `INSERT INTO patrons (patron_number, idp_subject, full_name_encrypted, email_encrypted, category, status, version, registered_on, updated_at)
       VALUES ($1, NULL, $2, $3, 'general', $4, 1, '2026-04-01', $5)`,
      [num, `test-plain:${name}`, `test-plain:${email}`, status, AT],
    );
  }

  const books: Array<[string, string, string, string, string]> = [
    [ids.availableBookId, '架空の物語A', '山田 一郎', 'literature', 'available'],
    [ids.heldBookId, '架空の歴史B', '佐藤 二郎', 'history', 'on_hold'],
    [ids.onLoanBookId, '架空の小説C', '鈴木 三郎', 'literature', 'on_loan'],
    [ids.deletedBookId, '架空の図鑑D', '高橋 四郎', 'reference', 'deleted'],
  ];
  for (const [id, title, author, genre, status] of books) {
    await db.query(
      `INSERT INTO books (book_id, isbn, title, author, publisher, genre, media_type, status, version, registered_on, updated_at)
       VALUES ($1, NULL, $2, $3, '架空出版', $4, 'paper', $5, 1, '2026-04-01', $6)`,
      [id, title, author, genre, status, AT],
    );
  }

  await db.query(
    `INSERT INTO loans (loan_id, book_id, patron_number, loaned_on, loan_period_days, due_on, returned_on, status, version, created_at, updated_at)
     VALUES ($1, $2, $3, '2026-09-01', 14, '2026-09-15', NULL, 'overdue', 2, $4, $4)`,
    [ids.overdueLoanId, ids.onLoanBookId, ids.patronWithOverdueLoan, AT],
  );

  await db.query(
    `INSERT INTO reservations (reservation_id, book_id, patron_number, reserved_at, queue_position, status, hold_started_on, hold_expires_on, version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 1, 'on_hold', '2026-09-30', '2026-10-07', 2, $4, $4)`,
    [ids.heldReservationId, ids.heldBookId, ids.activePatron, AT],
  );
}
