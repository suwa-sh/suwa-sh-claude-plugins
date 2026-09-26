/**
 * 契約 (POST /loans registerLoan) の examples が前提にしている状態のテストデータ。
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
  ];
  for (const [bookId, title, status] of books) {
    await client.query(
      "INSERT INTO books (book_id, title, author, isbn, publisher, genre, media_type, status, registered_on, deleted_on, version, updated_at) VALUES ($1, $2, 'テスト著者', NULL, NULL, NULL, 'paper', $3, '2026-09-01', NULL, 1, $4)",
      [bookId, title, status, SEEDED_AT],
    );
  }
  await client.query(
    "INSERT INTO loans (loan_id, patron_number, book_id, reservation_id, loaned_on, due_date, returned_on, status, version, updated_at) VALUES ($1, $2, $3, NULL, '2026-09-25', '2026-10-09', NULL, 'on_loan', 1, $4)",
    [ids.existingLoan, ids.otherPatron, ids.onLoanBook, SEEDED_AT],
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
