/**
 * library-scenario.ts — 貸出業務の UC BDD 用の補助 (シナリオごとの DB・前提データ・結果の確認)。
 *
 * - DB はシナリオごとに backend-api の startTestDatabase() で使い捨ての pglite を起動する (migration 適用済み)。
 *   シナリオ間の隔離は「別インスタンス」で取る (After で閉じる)
 * - 前提データの投入と結果の確認は、計装しない素の DB に SQL で行う
 *   (契約 slice に参照系の API が無いため。as-built の図に前提投入が混ざらないようにする)
 * - 氏名・書名から利用者番号・書籍ID を引く対応表を持つ。利用者の連絡先は合成データ (ADR 0007)
 * - アプリ (createTestApp) の結線は最初の操作のときに行う (背景の「今日」を時計に反映してから組み立てる)
 */
import { randomUUID } from 'node:crypto';
import { startTestDatabase } from '../../apps/backend-api/src/test-app';
import { tracedTestAppOptions } from './composition';
import type { D2World } from './world';

type SqlDatabase = Awaited<ReturnType<typeof startTestDatabase>>;

const SEEDED_AT = '2026-09-01T09:00:00+09:00';
const SEEDED_ON = '2026-09-01';

export const BOOK_STATUS = { 在庫あり: 'available', 貸出中: 'on_loan', 予約待ち: 'awaiting_pickup' } as const;
export const RESERVATION_STATUS = { 予約中: 'waiting', 通知済: 'notified', 完了: 'completed', 取消: 'cancelled' } as const;
export const LOAN_STATUS = { 貸出中: 'on_loan', 返却済: 'returned', 延滞: 'overdue' } as const;

export type LoanRow = {
  loan_id: string;
  patron_number: string;
  book_id: string;
  reservation_id: string | null;
  loaned_on: string;
  due_date: string;
  status: string;
  version: number;
};

export class LibraryScenario {
  readonly slug: string;
  private db: SqlDatabase | undefined;
  private readonly patrons = new Map<string, string>();
  private readonly books = new Map<string, string>();
  private patronSeq = 100;
  /** 背景「今日は <date> である」。時計は図書館のタイムゾーン (Asia/Tokyo) の 09:00 に固定する */
  today: string | undefined;
  /** 背景「司書としてログインしている」で得たアクセストークン */
  accessToken: string | undefined;
  /** 操作の直前の貸出件数 (「貸出は記録されない」の確認に使う) */
  loanCountBefore: number | undefined;
  /** 画面の入口関数の戻り値 */
  view: unknown;
  private wired = false;

  constructor(slug: string) {
    this.slug = slug;
  }

  async database(): Promise<SqlDatabase> {
    this.db ??= await startTestDatabase();
    return this.db;
  }

  /** createTestApp を計装つきで結線する (最初の操作の直前に 1 度だけ) */
  async wire(world: D2World): Promise<void> {
    if (this.wired) return;
    if (!this.today) throw new Error('背景「今日は ... である」が先に必要です');
    const now = new Date(`${this.today}T09:00:00+09:00`);
    world.api.configure(tracedTestAppOptions(this.slug, await this.database(), { now: () => new Date(now.getTime()) }));
    this.wired = true;
  }

  patronNumber(name: string): string {
    const n = this.patrons.get(name);
    if (!n) throw new Error(`利用者 "${name}" は前提で登録されていません`);
    return n;
  }

  bookId(title: string): string {
    const id = this.books.get(title);
    if (!id) throw new Error(`書籍 "${title}" は前提で登録されていません`);
    return id;
  }

  async registerPatron(name: string): Promise<string> {
    this.patronSeq += 1;
    const patronNumber = `P-${String(this.patronSeq).padStart(8, '0')}`;
    const db = await this.database();
    await db.query(
      'INSERT INTO patrons (patron_number, idp_subject, name, email_encrypted, registered_on, deleted_on, updated_at) VALUES ($1, NULL, $2, $3, $4, NULL, $5)',
      [patronNumber, name, `enc:synthetic-${patronNumber}`, SEEDED_ON, SEEDED_AT],
    );
    this.patrons.set(name, patronNumber);
    return patronNumber;
  }

  async registerBook(title: string, status: (typeof BOOK_STATUS)[keyof typeof BOOK_STATUS]): Promise<string> {
    const bookId = randomUUID();
    const db = await this.database();
    await db.query(
      "INSERT INTO books (book_id, title, author, isbn, publisher, genre, media_type, status, registered_on, deleted_on, version, updated_at) VALUES ($1, $2, 'テスト著者', NULL, NULL, NULL, 'paper', $3, $4, NULL, 1, $5)",
      [bookId, title, status, SEEDED_ON, SEEDED_AT],
    );
    this.books.set(title, bookId);
    return bookId;
  }

  /** 既存の貸出 (貸出中) を入れる。貸出日は今日より前の日にする */
  async registerExistingLoan(patronName: string, title: string): Promise<void> {
    const db = await this.database();
    await db.query(
      "INSERT INTO loans (loan_id, patron_number, book_id, reservation_id, loaned_on, due_date, returned_on, status, version, updated_at) VALUES ($1, $2, $3, NULL, '2026-09-24', '2026-10-08', NULL, 'on_loan', 1, $4)",
      [randomUUID(), this.patronNumber(patronName), this.bookId(title), SEEDED_AT],
    );
  }

  async registerReservation(
    title: string,
    rank: number,
    patronName: string,
    status: (typeof RESERVATION_STATUS)['予約中' | '通知済'],
  ): Promise<void> {
    const db = await this.database();
    const notifiedAt = status === 'notified' ? SEEDED_AT : null;
    await db.query(
      'INSERT INTO reservations (reservation_id, patron_number, book_id, received_at, queue_position, status, notified_at, completed_at, cancelled_at, version, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, 1, $4)',
      [randomUUID(), this.patronNumber(patronName), this.bookId(title), SEEDED_AT, rank, status, notifiedAt],
    );
  }

  async patronExists(patronNumber: string): Promise<boolean> {
    const db = await this.database();
    const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM patrons WHERE patron_number = $1', [patronNumber]);
    return rows[0].n > 0;
  }

  async loanCount(): Promise<number> {
    const db = await this.database();
    const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM loans');
    return rows[0].n;
  }

  async loansOf(patronName: string, title?: string): Promise<LoanRow[]> {
    const db = await this.database();
    const params: unknown[] = [this.patronNumber(patronName)];
    let sql =
      'SELECT loan_id::text AS loan_id, patron_number, book_id::text AS book_id, reservation_id::text AS reservation_id, loaned_on::text AS loaned_on, due_date::text AS due_date, status::text AS status, version FROM loans WHERE patron_number = $1';
    if (title !== undefined) {
      params.push(this.bookId(title));
      sql += ' AND book_id = $2';
    }
    const { rows } = await db.query<LoanRow>(sql, params);
    return rows;
  }

  async loanById(loanId: string): Promise<LoanRow | undefined> {
    const db = await this.database();
    const { rows } = await db.query<LoanRow>(
      'SELECT loan_id::text AS loan_id, patron_number, book_id::text AS book_id, reservation_id::text AS reservation_id, loaned_on::text AS loaned_on, due_date::text AS due_date, status::text AS status, version FROM loans WHERE loan_id = $1',
      [loanId],
    );
    return rows[0];
  }

  async bookStatus(title: string): Promise<string> {
    const db = await this.database();
    const { rows } = await db.query<{ status: string }>('SELECT status::text AS status FROM books WHERE book_id = $1', [this.bookId(title)]);
    return rows[0]?.status;
  }

  async reservationStatus(patronName: string, title: string): Promise<string[]> {
    const db = await this.database();
    const { rows } = await db.query<{ status: string }>(
      'SELECT status::text AS status FROM reservations WHERE patron_number = $1 AND book_id = $2',
      [this.patronNumber(patronName), this.bookId(title)],
    );
    return rows.map((r) => r.status);
  }

  async close(): Promise<void> {
    const db = this.db as unknown as { close?: () => Promise<void> } | undefined;
    this.db = undefined;
    if (db?.close) await db.close();
  }
}

const scenarios = new WeakMap<D2World, LibraryScenario>();

/** World ごとの LibraryScenario (無ければ作る) */
export function libraryOf(world: D2World): LibraryScenario {
  let s = scenarios.get(world);
  if (!s) {
    const slug = world.scenarioId.split('#')[0] || 'unknown';
    s = new LibraryScenario(slug);
    scenarios.set(world, s);
  }
  return s;
}

/** After フックから呼ぶ。作っていなければ何もしない */
export async function closeLibraryOf(world: D2World): Promise<void> {
  const s = scenarios.get(world);
  if (s) await s.close();
  scenarios.delete(world);
}
