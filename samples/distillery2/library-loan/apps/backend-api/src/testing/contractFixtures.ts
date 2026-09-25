/**
 * 契約 examples (createLoan) が前提にしているデータ。createTestApp の既定データとして投入する。
 * 個人情報は架空の値で、暗号化済み列にはダミーの暗号文を入れる (ADR 0004: 実在の個人情報を使わない)。
 */
import type { SqlClient } from '../gateway/database';

export const fixtureIds = {
  librarian: '00000000-0000-4000-8000-000000000001',
  loanRule: '00000000-0000-4000-8000-000000000101',
  patronM1: '00000000-0000-4000-8000-000000000201',
  patronM2: '00000000-0000-4000-8000-000000000202',
  bookNeko: '00000000-0000-4000-8000-000000000301',
  bookBotchan: '00000000-0000-4000-8000-000000000302',
  bookKokoro: '00000000-0000-4000-8000-000000000303',
  copyAvailable: '11111111-1111-4111-8111-111111111111',
  copyOnLoan: '22222222-2222-4222-8222-222222222222',
  copyOnHold: '33333333-3333-4333-8333-333333333333',
  existingLoan: '00000000-0000-4000-8000-000000000401',
  heldReservation: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
} as const;

export const fixturePatronNumbers = { m1: 'P-2026-00001', m2: 'P-2026-00002' } as const;

/** 契約 examples の前提: 貸出期間 14 日、利用者 2 名、蔵書 3 冊 (在庫あり・貸出中・m1 向け取り置き中) */
export async function seedContractFixtures(db: SqlClient): Promise<void> {
  const ts = '2026-08-01T00:00:00Z';
  const id = fixtureIds;
  const statements: [string, unknown[]][] = [
    [
      `INSERT INTO librarians (librarian_id, staff_id, name, login_id, idp_subject, created_at, updated_at)
       VALUES ($1, 'S-0001', '司書 一郎', 'lib1', 'idp|lib1', $2, $2)`,
      [id.librarian, ts],
    ],
    [
      `INSERT INTO loan_rules (loan_rule_id, loan_period_days, reminder_days_before, effective_from, created_at)
       VALUES ($1, 14, 3, '2000-01-01', $2)`,
      [id.loanRule, ts],
    ],
    [
      `INSERT INTO patrons (patron_id, patron_number, name_encrypted, email_encrypted, login_id, registered_on, created_at, updated_at)
       VALUES ($1, $2, 'enc:m1-name', 'enc:m1-mail', 'm1', '2026-04-01', $5, $5),
              ($3, $4, 'enc:m2-name', 'enc:m2-mail', 'm2', '2026-04-01', $5, $5)`,
      [id.patronM1, fixturePatronNumbers.m1, id.patronM2, fixturePatronNumbers.m2, ts],
    ],
    [
      `INSERT INTO books (book_id, title, media_type, registered_on, created_at, updated_at)
       VALUES ($1, '吾輩は猫である', 'paper', '2026-04-01', $4, $4),
              ($2, '坊っちゃん', 'paper', '2026-04-01', $4, $4),
              ($3, 'こころ', 'paper', '2026-04-01', $4, $4)`,
      [id.bookNeko, id.bookBotchan, id.bookKokoro, ts],
    ],
    [
      `INSERT INTO copies (copy_id, book_id, status, acquired_on, version, updated_at)
       VALUES ($1, $2, 'available', '2026-04-01', 1, $7),
              ($3, $4, 'on_loan', '2026-04-01', 2, $7),
              ($5, $6, 'on_hold', '2026-04-01', 2, $7)`,
      [
        id.copyAvailable,
        id.bookNeko,
        id.copyOnLoan,
        id.bookBotchan,
        id.copyOnHold,
        id.bookKokoro,
        ts,
      ],
    ],
    [
      `INSERT INTO copy_events (event_id, copy_id, sequence, event_type, from_status, to_status, occurred_at, actor_librarian_id)
       VALUES (gen_random_uuid(), $1, 1, 'registered', NULL, 'available', $4, $5),
              (gen_random_uuid(), $2, 1, 'registered', NULL, 'available', $4, $5),
              (gen_random_uuid(), $2, 2, 'loaned', 'available', 'on_loan', $4, $5),
              (gen_random_uuid(), $3, 1, 'registered', NULL, 'available', $4, $5),
              (gen_random_uuid(), $3, 2, 'held', 'available', 'on_hold', $4, $5)`,
      [id.copyAvailable, id.copyOnLoan, id.copyOnHold, ts, id.librarian],
    ],
    [
      `INSERT INTO loans (loan_id, patron_id, copy_id, loan_rule_id, loaned_on, due_on, status, loaned_by_librarian_id, version, updated_at)
       VALUES ($1, $2, $3, $4, '2026-08-25', '2026-09-08', 'on_loan', $5, 1, $6)`,
      [id.existingLoan, id.patronM1, id.copyOnLoan, id.loanRule, id.librarian, ts],
    ],
    [
      `INSERT INTO loan_events (event_id, loan_id, sequence, event_type, from_status, to_status, occurred_at, actor_librarian_id)
       VALUES (gen_random_uuid(), $1, 1, 'loaned', NULL, 'on_loan', $2, $3)`,
      [id.existingLoan, ts, id.librarian],
    ],
    [
      `INSERT INTO reservations (reservation_id, patron_id, book_id, held_copy_id, reserved_at, queue_position, status, hold_started_on, active_key, version, updated_at)
       VALUES ($1, $2, $3, $4, $5, NULL, 'on_hold', '2026-08-30', $6, 2, $5)`,
      [
        id.heldReservation,
        id.patronM1,
        id.bookKokoro,
        id.copyOnHold,
        ts,
        `${id.patronM1}${id.bookKokoro}`,
      ],
    ],
    [
      `INSERT INTO reservation_events (event_id, reservation_id, sequence, event_type, from_status, to_status, occurred_at)
       VALUES (gen_random_uuid(), $1, 1, 'reserved', NULL, 'waiting', $2),
              (gen_random_uuid(), $1, 2, 'held', 'waiting', 'on_hold', $2)`,
      [id.heldReservation, ts],
    ],
  ];
  for (const [sql, params] of statements) await db.query(sql, params);
}
