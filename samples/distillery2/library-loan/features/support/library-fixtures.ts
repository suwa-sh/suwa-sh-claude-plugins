/**
 * library-fixtures.ts — シナリオの前提データ (司書・貸出ルール・利用者・蔵書・貸出・予約) の投入と観測。
 *
 * シナリオ上の名前 (司書 "lib1"、利用者 "m1"、蔵書 "c1") を内部 ID / 利用者番号に対応づけて World ごとに持つ。
 * 投入・観測は raw の pg で行い、トレースには載せない (図に出すのはアプリの DB アクセスだけ)。
 * 状態を持つ表 (copies / loans / reservations) は events を併せて入れ、snapshots の version を events の sequence に揃える
 * (rdb 契約: version は最後に反映した events の sequence)。
 */
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { startDatastore } from './datastore';

const SEEDED_AT = '2026-08-01T00:00:00Z';

export interface PatronRef {
  patronId: string;
  patronNumber: string;
}

export class LibraryFixtures {
  private readonly librarians = new Map<string, string>();
  private readonly patrons = new Map<string, PatronRef>();
  private readonly copies = new Map<string, { copyId: string; bookId: string }>();
  private loanRuleId: string | undefined;

  private pg(): Promise<PGlite> {
    return startDatastore();
  }

  private anyLibrarianId(): string {
    const first = this.librarians.values().next();
    if (first.done) throw new Error('前提に司書がいません (「司書 … がログインしている」が先に必要)');
    return first.value;
  }

  patron(name: string): PatronRef {
    const ref = this.patrons.get(name);
    if (!ref) throw new Error(`利用者 "${name}" は前提で登録されていません`);
    return ref;
  }

  copyId(name: string): string {
    const ref = this.copies.get(name);
    if (!ref) throw new Error(`蔵書 "${name}" は前提で登録されていません`);
    return ref.copyId;
  }

  /** 司書を登録し、その内部 ID を返す (ログイン用のトークン表は World が持つ)。 */
  async addLibrarian(loginId: string): Promise<string> {
    const librarianId = randomUUID();
    const staffNo = String(this.librarians.size + 1).padStart(4, '0');
    await (await this.pg()).query(
      `INSERT INTO librarians (librarian_id, staff_id, name, login_id, idp_subject, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [librarianId, `S-${staffNo}`, `司書 ${loginId}`, loginId, `idp|${loginId}`, SEEDED_AT],
    );
    this.librarians.set(loginId, librarianId);
    return librarianId;
  }

  /** 貸出期間 (日数) の貸出ルールを、どの貸出日にも有効になるよう登録する。 */
  async setLoanPeriod(days: number): Promise<void> {
    this.loanRuleId = randomUUID();
    await (await this.pg()).query(
      `INSERT INTO loan_rules (loan_rule_id, loan_period_days, reminder_days_before, effective_from, created_at)
       VALUES ($1, $2, 3, '2000-01-01', $3)`,
      [this.loanRuleId, days, SEEDED_AT],
    );
  }

  async addPatron(name: string): Promise<PatronRef> {
    const ref: PatronRef = {
      patronId: randomUUID(),
      patronNumber: `P-2026-${String(this.patrons.size + 1).padStart(5, '0')}`,
    };
    await (await this.pg()).query(
      `INSERT INTO patrons (patron_id, patron_number, name_encrypted, email_encrypted, login_id, registered_on, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, '2026-04-01', $6, $6)`,
      [ref.patronId, ref.patronNumber, `enc:${name}-name`, `enc:${name}-mail`, name, SEEDED_AT],
    );
    this.patrons.set(name, ref);
    return ref;
  }

  /** 書籍と蔵書を登録する。status が available 以外なら、その状態へ移ったイベントも入れる。 */
  private async addCopy(name: string, status: 'available' | 'on_loan' | 'on_hold') {
    const pg = await this.pg();
    const ref = { copyId: randomUUID(), bookId: randomUUID() };
    const actor = this.anyLibrarianId();
    await pg.query(
      `INSERT INTO books (book_id, title, media_type, registered_on, created_at, updated_at)
       VALUES ($1, $2, 'paper', '2026-04-01', $3, $3)`,
      [ref.bookId, `書籍 ${name}`, SEEDED_AT],
    );
    const version = status === 'available' ? 1 : 2;
    await pg.query(
      `INSERT INTO copies (copy_id, book_id, status, acquired_on, version, updated_at)
       VALUES ($1, $2, $3, '2026-04-01', $4, $5)`,
      [ref.copyId, ref.bookId, status, version, SEEDED_AT],
    );
    await pg.query(
      `INSERT INTO copy_events (event_id, copy_id, sequence, event_type, from_status, to_status, occurred_at, actor_librarian_id)
       VALUES ($1, $2, 1, 'registered', NULL, 'available', $3, $4)`,
      [randomUUID(), ref.copyId, SEEDED_AT, actor],
    );
    if (status !== 'available') {
      await pg.query(
        `INSERT INTO copy_events (event_id, copy_id, sequence, event_type, from_status, to_status, occurred_at, actor_librarian_id)
         VALUES ($1, $2, 2, $3, 'available', $4, $5, $6)`,
        [randomUUID(), ref.copyId, status === 'on_loan' ? 'loaned' : 'held', status, SEEDED_AT, actor],
      );
    }
    this.copies.set(name, ref);
    return ref;
  }

  async addAvailableCopy(name: string): Promise<void> {
    await this.addCopy(name, 'available');
  }

  /** 蔵書を利用者に貸出中にする (貸出日 2026-08-25、返却期限 2026-09-08)。 */
  async addCopyOnLoan(name: string, patronName: string): Promise<void> {
    if (!this.loanRuleId) throw new Error('前提に貸出ルールがありません (「貸出期間が … 日に設定されている」が先に必要)');
    const patron = this.patron(patronName);
    const copy = await this.addCopy(name, 'on_loan');
    const loanId = randomUUID();
    const pg = await this.pg();
    await pg.query(
      `INSERT INTO loans (loan_id, patron_id, copy_id, loan_rule_id, loaned_on, due_on, status, loaned_by_librarian_id, version, updated_at)
       VALUES ($1, $2, $3, $4, '2026-08-25', '2026-09-08', 'on_loan', $5, 1, $6)`,
      [loanId, patron.patronId, copy.copyId, this.loanRuleId, this.anyLibrarianId(), SEEDED_AT],
    );
    await pg.query(
      `INSERT INTO loan_events (event_id, loan_id, sequence, event_type, from_status, to_status, occurred_at, actor_librarian_id)
       VALUES ($1, $2, 1, 'loaned', NULL, 'on_loan', $3, $4)`,
      [randomUUID(), loanId, SEEDED_AT, this.anyLibrarianId()],
    );
  }

  /** 蔵書を利用者向けに取り置き中にする (予約は取り置き中、取り置き開始 2026-08-30)。 */
  async addCopyOnHold(name: string, patronName: string): Promise<void> {
    const patron = this.patron(patronName);
    const copy = await this.addCopy(name, 'on_hold');
    const reservationId = randomUUID();
    const pg = await this.pg();
    await pg.query(
      `INSERT INTO reservations (reservation_id, patron_id, book_id, held_copy_id, reserved_at, queue_position, status, hold_started_on, active_key, version, updated_at)
       VALUES ($1, $2, $3, $4, $5, NULL, 'on_hold', '2026-08-30', $6, 2, $5)`,
      [reservationId, patron.patronId, copy.bookId, copy.copyId, SEEDED_AT, `${patron.patronId}${copy.bookId}`],
    );
    await pg.query(
      `INSERT INTO reservation_events (event_id, reservation_id, sequence, event_type, from_status, to_status, occurred_at)
       VALUES ($1, $2, 1, 'reserved', NULL, 'waiting', $4), ($3, $2, 2, 'held', 'waiting', 'on_hold', $4)`,
      [randomUUID(), reservationId, randomUUID(), SEEDED_AT],
    );
  }

  // ---- 観測 ----

  async copyStatus(name: string): Promise<string | undefined> {
    const { rows } = await (await this.pg()).query<{ status: string }>(
      'SELECT status FROM copies WHERE copy_id = $1',
      [this.copyId(name)],
    );
    return rows[0]?.status;
  }

  async loansOf(copyName: string, patronName: string) {
    const { rows } = await (await this.pg()).query<{
      loan_id: string;
      status: string;
      loaned_on: string;
      due_on: string;
    }>(
      `SELECT loan_id, status, to_char(loaned_on, 'YYYY-MM-DD') AS loaned_on, to_char(due_on, 'YYYY-MM-DD') AS due_on
         FROM loans WHERE copy_id = $1 AND patron_id = $2`,
      [this.copyId(copyName), this.patron(patronName).patronId],
    );
    return rows;
  }

  async reservationStatuses(patronName: string, copyName: string): Promise<string[]> {
    const { rows } = await (await this.pg()).query<{ status: string }>(
      `SELECT r.status FROM reservations r
        WHERE r.patron_id = $1 AND r.held_copy_id = $2`,
      [this.patron(patronName).patronId, this.copyId(copyName)],
    );
    return rows.map((r) => r.status);
  }
}

const byWorld = new WeakMap<object, LibraryFixtures>();

/** World ごとの前提データ (シナリオごとに新しい World が作られるので、シナリオごとに空から始まる)。 */
export function fixturesOf(world: object): LibraryFixtures {
  let f = byWorld.get(world);
  if (!f) {
    f = new LibraryFixtures();
    byWorld.set(world, f);
  }
  return f;
}
