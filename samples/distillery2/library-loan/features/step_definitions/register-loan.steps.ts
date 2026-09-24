/**
 * register-loan.steps.ts — UC「貸出を登録する」(@uc:register-loan) の step 定義
 *
 * シナリオ: features/貸出業務/register-loan.feature
 * 契約 slice: contracts/generated/slices/register-loan/ (operationId: createLoan, POST /loans)
 *
 * - もし は UC の入口 = frontend-staff の貸出受付画面の入口関数 (submitLoanCheckout) から入る。画面の API 呼び出しには
 *   api ドライバの transport を注入するので、画面 → API クライアント → backend-api → DB が 1 本のトレースに乗る。
 *   実装の内部関数 (usecase / repository) は呼ばない
 * - 前提の状態は、状態を作る API (書籍登録・予約など) がこの UC の契約に無いため、シナリオ隔離 DB に直接書く
 * - ならば は API 応答と、DB に残った状態 (貸出・書籍状態・予約状態) を観測する。
 *   この UC の契約に参照 API (GET) が無いため、永続化された状態は DB から読む
 * step 文はシナリオの文言をそのまま使う (意訳しない)。
 */
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { Given, When, Then, type DataTable } from '@cucumber/cucumber';
import type { ApiResponse, D2World } from '../support/world';
import { tracedFn } from '@repo/test-support/tracer';
import { createLoanApi } from '../../apps/frontend-staff/src/api-client/loan-api';
import { submitLoanCheckout } from '../../apps/frontend-staff/src/screens/loan-checkout/submit-loan-checkout';

// --- シナリオの語 → 契約 / スキーマの値 ---

const BOOK_STATUS: Record<string, string> = {
  在庫あり: 'available',
  貸出中: 'on_loan',
  '予約待ち（取置）': 'on_hold',
  削除済み: 'deleted',
};
const LOAN_STATUS: Record<string, string> = { 貸出中: 'on_loan', 延滞: 'overdue', 返却済み: 'returned' };
const RESERVATION_STATUS: Record<string, string> = {
  予約待ち: 'waiting',
  取置中: 'on_hold',
  受取済み: 'picked_up',
  取消: 'cancelled',
};
const PATRON_STATUS: Record<string, string> = { 有効: 'active', 削除済み: 'deleted' };
const PATRON_CATEGORY: Record<string, string> = { 一般: 'general', 児童: 'child', 学生: 'student' };
const GENRE: Record<string, string> = {
  文学: 'literature',
  歴史: 'history',
  自然科学: 'natural_science',
  社会科学: 'social_science',
  芸術: 'art',
  工学: 'engineering',
  児童: 'children',
  参考: 'reference',
};
const MEDIA_TYPE: Record<string, string> = { 紙: 'paper', 電子: 'electronic' };

/** 契約の例と同じ書籍ID (contracts/openapi/paths/loans.yaml 先頭コメント)。他のタイトルは都度採番する */
const CONTRACT_BOOK_IDS: Record<string, string> = {
  架空の物語A: '11111111-1111-4111-8111-111111111111',
  架空の歴史B: '22222222-2222-4222-8222-222222222222',
};

const SEEDED_AT = '2026-09-01T00:00:00Z';

function mapLabel(table: Record<string, string>, label: string, what: string): string {
  const v = table[label];
  if (!v) throw new Error(`${what} "${label}" の対応値が未定義です`);
  return v;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// --- DB 読み書きの補助 (シナリオ隔離トランザクション内) ---

async function rows<T>(world: D2World, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await world.scenario.db.query<T>(sql, params)).rows;
}

function bookId(world: D2World, title: string): string {
  const id = world.uc.bookIds.get(title);
  if (!id) throw new Error(`書籍 "${title}" は背景で登録されていません`);
  return id;
}

function today(world: D2World): string {
  return world.scenario.app.clock.today();
}

async function bookStatus(world: D2World, title: string): Promise<string> {
  const r = await rows<{ status: string }>(world, 'SELECT status::text AS status FROM books WHERE book_id = $1', [
    bookId(world, title),
  ]);
  assert.equal(r.length, 1, `書籍 "${title}" が見つかりません`);
  return r[0].status;
}

async function setBookStatus(world: D2World, title: string, status: string): Promise<void> {
  await world.scenario.db.query('UPDATE books SET status = $2::books_status WHERE book_id = $1', [
    bookId(world, title),
    status,
  ]);
}

interface LoanRow {
  loan_id: string;
  status: string;
  loaned_on: string;
  loan_period_days: number;
  due_on: string;
}

const LOAN_COLUMNS = `loan_id::text AS loan_id, status::text AS status, to_char(loaned_on, 'YYYY-MM-DD') AS loaned_on,
  loan_period_days, to_char(due_on, 'YYYY-MM-DD') AS due_on`;

async function loansOf(world: D2World, patronNumber: string, title?: string): Promise<LoanRow[]> {
  if (title === undefined) {
    return rows<LoanRow>(world, `SELECT ${LOAN_COLUMNS} FROM loans WHERE patron_number = $1 ORDER BY created_at`, [
      patronNumber,
    ]);
  }
  return rows<LoanRow>(
    world,
    `SELECT ${LOAN_COLUMNS} FROM loans WHERE patron_number = $1 AND book_id = $2 ORDER BY created_at`,
    [patronNumber, bookId(world, title)],
  );
}

async function subjectLoan(world: D2World): Promise<LoanRow> {
  const id = world.uc.subjectLoanId;
  assert.ok(id, '「その貸出」が指す貸出がありません (貸出の登録が成功していません)');
  const r = await rows<LoanRow>(world, `SELECT ${LOAN_COLUMNS} FROM loans WHERE loan_id = $1`, [id]);
  assert.equal(r.length, 1, `貸出 ${id} が記録されていません`);
  return r[0];
}

async function totalLoans(world: D2World): Promise<number> {
  const r = await rows<{ n: number }>(world, 'SELECT count(*)::int AS n FROM loans');
  return r[0].n;
}

async function insertLoan(
  world: D2World,
  patronNumber: string,
  title: string,
  status: string,
  loanedOn: string,
  periodDays: number,
): Promise<void> {
  await world.scenario.db.query(
    `INSERT INTO loans (loan_id, book_id, patron_number, loaned_on, loan_period_days, due_on, returned_on, status, version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, $7::loans_status, 1, $8, $8)`,
    [randomUUID(), bookId(world, title), patronNumber, loanedOn, periodDays, addDays(loanedOn, periodDays), status, SEEDED_AT],
  );
}

async function reservationStatus(world: D2World, patronNumber: string, title: string): Promise<string> {
  const r = await rows<{ status: string }>(
    world,
    'SELECT status::text AS status FROM reservations WHERE patron_number = $1 AND book_id = $2',
    [patronNumber, bookId(world, title)],
  );
  assert.equal(r.length, 1, `利用者 "${patronNumber}" の書籍 "${title}" の予約が 1 件ではありません (${r.length} 件)`);
  return r[0].status;
}

// --- もし の共通処理 ---

const FRONTEND_TIER = 'frontend-staff';

/** 貸出受付画面の「貸出する」を、画面ロジック → API クライアント → backend の順に通す (in-process の e2e)。 */
async function requestLoan(world: D2World, patronNumber: string, title: string): Promise<ApiResponse> {
  world.uc.loanCountBeforeAct = await totalLoans(world);
  let captured: ApiResponse | undefined;
  const api = createLoanApi(world.api.asTransport({ tier: FRONTEND_TIER, layer: 'api-client' }, (res) => (captured = res)));
  const submit = tracedFn('貸出受付画面', 'submit', (input: { patronNumber: string; bookId: string }) => submitLoanCheckout(api, input), {
    tier: FRONTEND_TIER,
    layer: 'screen',
  });
  world.uc.lastView = await submit({ patronNumber, bookId: bookId(world, title) });
  world.uc.acted = true;
  const res = captured ?? { status: 0, body: undefined };
  world.uc.lastResponse = res;
  const body = res.body as { loanId?: string } | undefined;
  if (res.status === 201 && body?.loanId) world.uc.subjectLoanId = body.loanId;
  return res;
}

function describe(res: ApiResponse | undefined): string {
  return res ? `status=${res.status} body=${JSON.stringify(res.body)}` : '応答なし';
}

function assertProblem(res: ApiResponse | undefined, statuses: number[], what: string): void {
  assert.ok(res, 'もし の応答がありません');
  assert.ok(statuses.includes(res.status), `${what}: 期待 ${statuses.join('/')} / 実際 ${describe(res)}`);
  const contentType = String(res.headers?.['content-type'] ?? '');
  assert.match(contentType, /application\/problem\+json/, `${what}: Problem 形式で返っていません (${contentType})`);
  const body = res.body as { title?: string; status?: number } | undefined;
  assert.ok(body?.title, `${what}: 利用者に示す title がありません (${describe(res)})`);
  assert.equal(body?.status, res.status, `${what}: 本文の status が HTTP ステータスと一致しません`);
}

async function assertNoLoanRecorded(world: D2World): Promise<void> {
  assert.notEqual(world.uc.lastResponse?.status, 201, `貸出が登録されてしまいました (${describe(world.uc.lastResponse)})`);
  assert.equal(await totalLoans(world), world.uc.loanCountBeforeAct, '貸出の件数が変わっています');
}

// --- 背景 ---

Given('本日は {string} である', function (this: D2World, today: string) {
  this.scenario.app.clock.set(today);
});

Given('司書がログインしている', function (this: D2World) {
  // 暫定注入・契約確定後に削除 (根拠: AssumptionRecord A-005 — テスト用トークン表現。契約には認証方式の具体が無い)
  this.api.setAuthorization('Bearer test-staff:librarian-bdd');
});

Given('次の利用者が登録されている:', async function (this: D2World, patrons: DataTable) {
  for (const row of patrons.hashes()) {
    await this.scenario.db.query(
      `INSERT INTO patrons (patron_number, idp_subject, full_name_encrypted, email_encrypted, category, status, version, registered_on, updated_at)
       VALUES ($1, NULL, $2, $3, $4::patrons_category, $5::patrons_status, 1, '2026-04-01', $6)`,
      [
        row['利用者番号'],
        `test-plain:${row['氏名']}`,
        `test-plain:${row['連絡先']}`,
        mapLabel(PATRON_CATEGORY, row['利用者区分'], '利用者区分'),
        mapLabel(PATRON_STATUS, row['利用者状態'], '利用者状態'),
        SEEDED_AT,
      ],
    );
  }
});

Given('次の書籍が登録されている:', async function (this: D2World, books: DataTable) {
  for (const row of books.hashes()) {
    const title = row['タイトル'];
    const id = CONTRACT_BOOK_IDS[title] ?? randomUUID();
    this.uc.bookIds.set(title, id);
    // 背景は書籍状態を言わない。登録直後の書籍は在庫ありとし、各シナリオの前提で必要な状態に変える
    await this.scenario.db.query(
      `INSERT INTO books (book_id, isbn, title, author, publisher, genre, media_type, status, version, registered_on, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::books_genre, $7::books_media_type, 'available', 1, '2026-04-01', $8)`,
      [
        id,
        row['ISBN'],
        title,
        row['著者'],
        row['出版社'],
        mapLabel(GENRE, row['ジャンル'], 'ジャンル'),
        mapLabel(MEDIA_TYPE, row['媒体種別'], '媒体種別'),
        SEEDED_AT,
      ],
    );
  }
});

// --- 前提 ---

// 前提 (事前状態) と ならば (事後確認) の両方で使う
Given('書籍 {string} の書籍状態は {string} である', async function (this: D2World, bookTitle: string, bookStatus_: string) {
  const expected = mapLabel(BOOK_STATUS, bookStatus_, '書籍状態');
  if (!this.uc.acted) {
    await setBookStatus(this, bookTitle, expected);
    return;
  }
  assert.equal(await bookStatus(this, bookTitle), expected, `書籍 "${bookTitle}" の書籍状態`);
});

Given('書籍 {string} は利用者 {string} に貸出中である', async function (this: D2World, bookTitle: string, patronNumber: string) {
  await insertLoan(this, patronNumber, bookTitle, 'on_loan', addDays(today(this), -7), 14);
  await setBookStatus(this, bookTitle, 'on_loan');
});

Given(
  '利用者 {string} の書籍 {string} の予約は予約順 {int} 位で予約状態が {string} である',
  async function (this: D2World, patronNumber: string, bookTitle: string, queuePosition: number, reservationStatus_: string) {
    const status = mapLabel(RESERVATION_STATUS, reservationStatus_, '予約状態');
    const onHold = status === 'on_hold';
    await this.scenario.db.query(
      `INSERT INTO reservations (reservation_id, book_id, patron_number, reserved_at, queue_position, status, hold_started_on, hold_expires_on, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::reservations_status, $7, $8, 1, $4, $4)`,
      [
        randomUUID(),
        bookId(this, bookTitle),
        patronNumber,
        SEEDED_AT,
        queuePosition,
        status,
        onHold ? addDays(today(this), -1) : null,
        onHold ? addDays(today(this), 6) : null,
      ],
    );
  },
);

Given(
  '利用者 {string} は書籍 {string} の貸出を持ち、その貸出状態は {string} である',
  async function (this: D2World, patronNumber: string, bookTitle: string, loanStatus_: string) {
    const status = mapLabel(LOAN_STATUS, loanStatus_, '貸出状態');
    // 延滞は返却期限を過ぎた貸出。貸出日を 30 日前・貸出期間 14 日として期限切れにする
    const loanedOn = status === 'overdue' ? addDays(today(this), -30) : addDays(today(this), -7);
    await insertLoan(this, patronNumber, bookTitle, status, loanedOn, 14);
    if (status !== 'returned') await setBookStatus(this, bookTitle, 'on_loan');
  },
);

Given('利用者 {string} の利用者状態は {string} である', async function (this: D2World, patronNumber: string, patronStatus_: string) {
  await this.scenario.db.query('UPDATE patrons SET status = $2::patrons_status WHERE patron_number = $1', [
    patronNumber,
    mapLabel(PATRON_STATUS, patronStatus_, '利用者状態'),
  ]);
});

Given('利用者 {string} としてログインしている', function (this: D2World, patronNumber: string) {
  // 暫定注入・契約確定後に削除 (根拠: AssumptionRecord A-005 — 利用者ロールのテスト用トークン)
  this.api.setAuthorization(`Bearer test-patron:${patronNumber}`);
});

// --- もし ---

When('司書が利用者 {string} に書籍 {string} の貸出を登録する', async function (this: D2World, patronNumber: string, bookTitle: string) {
  const res = await requestLoan(this, patronNumber, bookTitle);
  assert.equal(res.status, 201, `貸出を登録できませんでした (${describe(res)})`);
});

When(
  '司書が利用者 {string} に書籍 {string} の貸出を登録しようとする',
  async function (this: D2World, patronNumber: string, bookTitle: string) {
    await requestLoan(this, patronNumber, bookTitle);
  },
);

When(
  '利用者 {string} が自分に書籍 {string} の貸出を登録しようとする',
  async function (this: D2World, patronNumber: string, bookTitle: string) {
    await requestLoan(this, patronNumber, bookTitle);
  },
);

// --- ならば: 貸出の記録 ---

Then('貸出が記録され書籍の状態が貸出中になる', async function (this: D2World) {
  const res = this.uc.lastResponse;
  assert.equal(res?.status, 201, `貸出が記録されていません (${describe(res)})`);
  const body = res!.body as { loanId?: string; status?: string; bookId?: string };
  assert.equal(body.status, 'on_loan', '応答の貸出状態');
  const loan = await subjectLoan(this);
  assert.equal(loan.status, 'on_loan', '記録された貸出の貸出状態');
  const r = await rows<{ status: string }>(this, 'SELECT status::text AS status FROM books WHERE book_id = $1', [body.bookId]);
  assert.equal(r[0]?.status, 'on_loan', '貸し出した書籍の書籍状態');
});

Then(
  '利用者 {string} の書籍 {string} の貸出が {int} 件記録されている',
  async function (this: D2World, patronNumber: string, bookTitle: string, count: number) {
    const loans = await loansOf(this, patronNumber, bookTitle);
    assert.equal(loans.length, count, `利用者 "${patronNumber}" の書籍 "${bookTitle}" の貸出件数`);
    if (loans.length > 0) this.uc.subjectLoanId = loans[loans.length - 1].loan_id;
  },
);

Then('その貸出の貸出状態は {string} である', async function (this: D2World, loanStatus_: string) {
  const loan = await subjectLoan(this);
  assert.equal(loan.status, mapLabel(LOAN_STATUS, loanStatus_, '貸出状態'), 'その貸出の貸出状態');
});

// --- ならば: 返却期限 ---

Then('貸出日と貸出期間から算出した返却期限が自動で設定される', async function (this: D2World) {
  const res = this.uc.lastResponse;
  assert.equal(res?.status, 201, `貸出が記録されていません (${describe(res)})`);
  const body = res!.body as { loanedOn?: string; loanPeriodDays?: number; dueOn?: string };
  assert.ok(body.dueOn, '応答に返却期限 (dueOn) がありません');
  const loan = await subjectLoan(this);
  assert.equal(loan.due_on, body.dueOn, '記録された返却期限と応答の返却期限');
  assert.equal(loan.loaned_on, body.loanedOn, '記録された貸出日と応答の貸出日');
  assert.equal(loan.loan_period_days, body.loanPeriodDays, '記録された貸出期間と応答の貸出期間');
});

Then('その貸出の貸出日は {string} である', async function (this: D2World, loanedOn: string) {
  const loan = await subjectLoan(this);
  assert.equal(loan.loaned_on, loanedOn, 'その貸出の貸出日');
});

Then('その貸出の貸出期間は 7 日・14 日・21 日のいずれかである', async function (this: D2World) {
  const loan = await subjectLoan(this);
  assert.ok([7, 14, 21].includes(loan.loan_period_days), `その貸出の貸出期間 (${loan.loan_period_days} 日)`);
});

Then('その貸出の返却期限は貸出日に貸出期間の日数を加えた日付である', async function (this: D2World) {
  const loan = await subjectLoan(this);
  assert.equal(loan.due_on, addDays(loan.loaned_on, loan.loan_period_days), 'その貸出の返却期限');
});

// --- ならば: 貸出できない ---

Then('貸出できない旨が表示され貸出は記録されない', async function (this: D2World) {
  // 貸出できない理由は、削除済みの書籍・利用者が 404、貸出可否条件の不成立が 409 (契約 createLoan)
  assertProblem(this.uc.lastResponse, [404, 409], '貸出できない旨');
  await assertNoLoanRecorded(this);
});

Then('利用者 {string} の貸出は {int} 件である', async function (this: D2World, patronNumber: string, count: number) {
  const loans = await loansOf(this, patronNumber);
  assert.equal(loans.length, count, `利用者 "${patronNumber}" の貸出件数`);
});

Then(
  '利用者 {string} の書籍 {string} の貸出は {int} 件である',
  async function (this: D2World, patronNumber: string, bookTitle: string, count: number) {
    const loans = await loansOf(this, patronNumber, bookTitle);
    assert.equal(loans.length, count, `利用者 "${patronNumber}" の書籍 "${bookTitle}" の貸出件数`);
  },
);

Then('書籍 {string} の書籍状態は {string} のままである', async function (this: D2World, bookTitle: string, bookStatus_: string) {
  assert.equal(await bookStatus(this, bookTitle), mapLabel(BOOK_STATUS, bookStatus_, '書籍状態'), `書籍 "${bookTitle}" の書籍状態`);
});

Then(
  '利用者 {string} の書籍 {string} の貸出の貸出状態は {string} のままである',
  async function (this: D2World, patronNumber: string, bookTitle: string, loanStatus_: string) {
    const loans = await loansOf(this, patronNumber, bookTitle);
    assert.equal(loans.length, 1, `利用者 "${patronNumber}" の書籍 "${bookTitle}" の貸出件数`);
    assert.equal(loans[0].status, mapLabel(LOAN_STATUS, loanStatus_, '貸出状態'), '貸出状態');
  },
);

// --- ならば: 予約 ---

Then(
  '利用者 {string} の書籍 {string} の予約の予約状態は {string} である',
  async function (this: D2World, patronNumber: string, bookTitle: string, reservationStatus_: string) {
    const expected = mapLabel(RESERVATION_STATUS, reservationStatus_, '予約状態');
    assert.equal(await reservationStatus(this, patronNumber, bookTitle), expected, '予約状態');
  },
);

Then(
  '利用者 {string} の書籍 {string} の予約の予約状態は {string} のままである',
  async function (this: D2World, patronNumber: string, bookTitle: string, reservationStatus_: string) {
    const expected = mapLabel(RESERVATION_STATUS, reservationStatus_, '予約状態');
    assert.equal(await reservationStatus(this, patronNumber, bookTitle), expected, '予約状態');
  },
);

// --- ならば: 操作権限 ---

Then('操作する権限がない旨が表示され貸出は記録されない', async function (this: D2World) {
  assertProblem(this.uc.lastResponse, [403], '操作する権限がない旨');
  await assertNoLoanRecorded(this);
});
