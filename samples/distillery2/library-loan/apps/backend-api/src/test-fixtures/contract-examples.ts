/**
 * 契約 (POST /loans registerLoan、POST /returns registerReturn) の examples が前提にしている状態のテストデータ。
 * 返却の examples の予約ID は契約に無いため仮の値を置く (AssumptionRecord A-108)。
 * 契約テストは createTestApp() を引数なしで呼ぶため、既定でこの状態を用意する。
 * 利用者の氏名・連絡先は合成データ (ADR 0007)。
 */
import type { SqlClient } from '../repository/db-context';

export const CONTRACT_EXAMPLE_IDS = {
  /** 登録済みの利用者 (examples の patronNumber) */
  patron: 'P-00000001',
  /** 予約順 1 位 (通知済) の予約を持つ別の利用者 */
  otherPatron: 'P-00000002',
  /** 在庫ありの書籍 (example success / patronNotRegistered) */
  availableBook: '0b6f3c1e-2a4d-4e8f-9b1a-3c5d7e9f1a2b',
  /** 貸出中の書籍 (example bookOnLoan) */
  onLoanBook: '9e4a1c7b-3d5f-4a2e-8b6c-1f3e5a7c9b0d',
  /** 予約待ちで予約順 1 位が P-00000001 の書籍 (example successFromReservation) */
  awaitingBookForPatron: '5d2e8a41-7c3b-4f60-8e1d-9a2b4c6d8e0f',
  reservationForPatron: '8b3d5f7a-4c2e-4d1b-9a6f-2e8c4a6b1d3f',
  /** 予約待ちで予約順 1 位が別の利用者の書籍 (example notFirstInReservationQueue) */
  awaitingBookForOther: '2c7f9b3e-6a1d-4c8e-9f2b-7d4a1e6c3b5f',
  reservationForOther: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  /** 貸出中の書籍の既存の貸出 */
  existingLoan: 'c0ffee00-1234-4abc-8def-0123456789ab',

  // --- 契約 POST /returns (registerReturn) の examples ---
  /** 予約のない貸出中の書籍 (example success / forbidden / unauthorized) とその貸出 */
  returnBook: '4c1d7e2a-8b3f-4e6a-9c1d-2f5a8b3e6c9d',
  returnLoan: '7e2b5d8a-3c6f-4a1e-8d4b-9f2c5e8a1b3d',
  /** 延滞している貸出の書籍 (example successOverdue) とその貸出 */
  overdueBook: '3a6d9c2f-7b4e-4f1a-8c5d-2e9b6a3f1d4c',
  overdueLoan: '5b8e1a4d-2c7f-4d3b-9e6a-1c4f7b2d5e8a',
  /** 予約中の予約がある貸出中の書籍 (example successWithReservation) とその貸出・予約 */
  reservedOnLoanBook: '8d3f6a1c-5e2b-4c7d-9a3e-6b1d4f7a2c5e',
  reservedOnLoanLoan: '1f4a7c2e-9d3b-4e6f-8a2c-5d8b1e4f7a3c',
  waitingReservation: 'e3a9c5b1-6d2f-4b8a-9c4e-7f1a3d5b9e2c',
  /** 未返却の貸出が無い在庫ありの書籍 (example noActiveLoan) */
  noActiveLoanBook: '6e9b2d5a-1f4c-4a8e-9b3d-7a2e5c8f1b4d',
  /** 登録されていない書籍 (example notFound)。前提データには入れない */
  unknownBook: '0e5c8b1f-4a7d-4f2c-8e9b-3d6a1c4f7b2e',
} as const;

const SEEDED_AT = '2026-09-01T09:00:00+09:00';

export async function seedContractExamples(client: SqlClient): Promise<void> {
  const ids = CONTRACT_EXAMPLE_IDS;
  await client.query(
    "INSERT INTO patrons (patron_number, idp_subject, name, email_encrypted, registered_on, deleted_on, updated_at) VALUES ($1, NULL, 'テスト 利用者一', 'enc:synthetic-1', '2026-09-01', NULL, $3), ($2, NULL, 'テスト 利用者二', 'enc:synthetic-2', '2026-09-01', NULL, $3)",
    [ids.patron, ids.otherPatron, SEEDED_AT],
  );
  const books: Array<[string, string, string]> = [
    [ids.availableBook, 'テスト書籍 在庫あり', 'available'],
    [ids.onLoanBook, 'テスト書籍 貸出中', 'on_loan'],
    [ids.awaitingBookForPatron, 'テスト書籍 予約待ち 1', 'awaiting_pickup'],
    [ids.awaitingBookForOther, 'テスト書籍 予約待ち 2', 'awaiting_pickup'],
    [ids.returnBook, 'テスト書籍 返却 予約なし', 'on_loan'],
    [ids.overdueBook, 'テスト書籍 返却 延滞', 'on_loan'],
    [ids.reservedOnLoanBook, 'テスト書籍 返却 予約あり', 'on_loan'],
    [ids.noActiveLoanBook, 'テスト書籍 返却 貸出なし', 'available'],
  ];
  for (const [bookId, title, status] of books) {
    await client.query(
      "INSERT INTO books (book_id, title, author, isbn, publisher, genre, media_type, status, registered_on, deleted_on, version, updated_at) VALUES ($1, $2, 'テスト著者', NULL, NULL, NULL, 'paper', $3, '2026-09-01', NULL, 1, $4)",
      [bookId, title, status, SEEDED_AT],
    );
  }
  // 返却の examples の貸出は、契約 examples の loanId・patronNumber・loanedOn・dueDate・status (返却前) に合わせる
  const loans: Array<[string, string, string, string, string, string]> = [
    [ids.existingLoan, ids.otherPatron, ids.onLoanBook, '2026-09-25', '2026-10-09', 'on_loan'],
    [ids.returnLoan, ids.patron, ids.returnBook, '2026-10-01', '2026-10-15', 'on_loan'],
    [ids.overdueLoan, ids.patron, ids.overdueBook, '2026-09-01', '2026-09-15', 'overdue'],
    [
      ids.reservedOnLoanLoan,
      ids.patron,
      ids.reservedOnLoanBook,
      '2026-10-01',
      '2026-10-15',
      'on_loan',
    ],
  ];
  for (const [loanId, patronNumber, bookId, loanedOn, dueDate, status] of loans) {
    await client.query(
      'INSERT INTO loans (loan_id, patron_number, book_id, reservation_id, loaned_on, due_date, returned_on, status, version, updated_at) VALUES ($1, $2, $3, NULL, $4, $5, NULL, $6, 1, $7)',
      [loanId, patronNumber, bookId, loanedOn, dueDate, status, SEEDED_AT],
    );
  }
  await client.query(
    "INSERT INTO reservations (reservation_id, patron_number, book_id, received_at, queue_position, status, notified_at, completed_at, cancelled_at, version, updated_at) VALUES ($1, $2, $3, $4, 1, 'waiting', NULL, NULL, NULL, 1, $4)",
    [ids.waitingReservation, ids.otherPatron, ids.reservedOnLoanBook, SEEDED_AT],
  );
  const reservations: Array<[string, string, string]> = [
    [ids.reservationForPatron, ids.patron, ids.awaitingBookForPatron],
    [ids.reservationForOther, ids.otherPatron, ids.awaitingBookForOther],
  ];
  for (const [reservationId, patronNumber, bookId] of reservations) {
    await client.query(
      "INSERT INTO reservations (reservation_id, patron_number, book_id, received_at, queue_position, status, notified_at, completed_at, cancelled_at, version, updated_at) VALUES ($1, $2, $3, $4, 1, 'notified', $4, NULL, NULL, 2, $4)",
      [reservationId, patronNumber, bookId, SEEDED_AT],
    );
  }
}
