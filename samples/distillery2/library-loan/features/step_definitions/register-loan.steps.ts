/**
 * register-loan.steps.ts — UC「貸出を登録する」(@uc:register-loan) の step 実装
 *
 * 入口は UC の最前のティア (frontend) の画面の入口関数 submitLoanCheckout。
 * その API 呼び出しに `this.api.asFetch(FRONTEND_API_CLIENT)` を渡し、
 * 「貸出受付画面 → API クライアント → backend-api (presentation → usecase → repository → DB)」を 1 本のトレースに乗せる
 * (packages/test-support/README.md「実装者が結線するもの」2)。
 *
 * 前提データの投入と結果の確認は、計装しない素の DB に対して行う (support/library-scenario.ts)。
 * 契約 slice には参照系の API が無いため、保存された状態 (貸出・書籍状態・予約状態) を DB で観測する。
 *
 * step 文は features/貸出業務/register-loan.feature からそのまま取る (意訳しない)。
 */
import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import { tracedFn } from '@repo/test-support/tracer';
import { submitLoanCheckout, type LoanCheckoutView } from '../../apps/frontend/src/screens/loan-checkout/submit-loan-checkout';
import { TEST_TOKENS } from '../../apps/backend-api/src/test-app';
// 貸出期間の日数は要求に値が無い (feature 冒頭のコメント)。backend-api が採用した運用値 (AssumptionRecord A-001) を参照し、
// シナリオは「貸出日 + 貸出期間」の関係だけを確かめる。
import { LOAN_PERIOD_DAYS } from '../../apps/backend-api/src/domain/loan/loan-policy';
import { FRONTEND_API_CLIENT, FRONTEND_SCREEN } from '../support/composition';
import { BOOK_STATUS, LOAN_STATUS, RESERVATION_STATUS, libraryOf } from '../support/library-scenario';
import type { D2World } from '../support/world';

/** 貸出受付画面の「貸出を登録する」操作 (画面の入口。frontend / screen として計装する) */
const submitOnLoanRegisterScreen = tracedFn('貸出受付画面', 'submit', submitLoanCheckout, FRONTEND_SCREEN);

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function lend(world: D2World, bookId: string, patronNumber: string): Promise<void> {
  const lib = libraryOf(world);
  if (!lib.accessToken) throw new Error('背景「司書としてログインしている」が先に必要です');
  await lib.wire(world);
  lib.loanCountBefore = await lib.loanCount();
  lib.view = await submitOnLoanRegisterScreen({ patronNumber, bookId }, world.api.asFetch(FRONTEND_API_CLIENT), {
    headers: { Authorization: `Bearer ${lib.accessToken}` },
  });
}

function view(world: D2World): LoanCheckoutView {
  const v = libraryOf(world).view as LoanCheckoutView | undefined;
  if (!v) throw new Error('貸出の操作がまだ行われていません');
  return v;
}

// ---- 背景 ----

Given('今日は {string} である', function (this: D2World, today: string) {
  libraryOf(this).today = today;
});

Given('司書としてログインしている', function (this: D2World) {
  // テスト用の IdP (backend-api の createTestApp が差し替える in-memory のトークン表) の司書のトークン
  libraryOf(this).accessToken = TEST_TOKENS.librarian;
});

Given('利用者 {string} が登録されている', async function (this: D2World, patronName: string) {
  await libraryOf(this).registerPatron(patronName);
});

// ---- 前提: 書籍 ----

Given('書籍 {string} が登録され、在庫ありである', async function (this: D2World, title: string) {
  await libraryOf(this).registerBook(title, BOOK_STATUS.在庫あり);
});

Given(
  '書籍 {string} が登録され、{string} に貸出中である',
  async function (this: D2World, title: string, borrowerName: string) {
    const lib = libraryOf(this);
    await lib.registerBook(title, BOOK_STATUS.貸出中);
    await lib.registerExistingLoan(borrowerName, title);
  },
);

Given('書籍 {string} が登録され、予約待ちである', async function (this: D2World, title: string) {
  await libraryOf(this).registerBook(title, BOOK_STATUS.予約待ち);
});

// ---- 前提: 予約・利用者 ----

Given(
  '{string} の予約順 {int} 位は {string} で、予約状態は通知済である',
  async function (this: D2World, title: string, rank: number, patronName: string) {
    await libraryOf(this).registerReservation(title, rank, patronName, RESERVATION_STATUS.通知済);
  },
);

Given(
  '{string} の予約順 {int} 位は {string} で、予約状態は予約中である',
  async function (this: D2World, title: string, rank: number, patronName: string) {
    await libraryOf(this).registerReservation(title, rank, patronName, RESERVATION_STATUS.予約中);
  },
);

Given('利用者番号 {string} の利用者は登録されていない', async function (this: D2World, patronNumber: string) {
  assert.equal(await libraryOf(this).patronExists(patronNumber), false, `利用者番号 ${patronNumber} が登録されています`);
});

// ---- 操作 ----

When('司書が {string} を {string} に貸し出す', async function (this: D2World, title: string, patronName: string) {
  const lib = libraryOf(this);
  await lend(this, lib.bookId(title), lib.patronNumber(patronName));
});

When(
  '司書が {string} を {string} に貸し出そうとする',
  async function (this: D2World, title: string, patronName: string) {
    const lib = libraryOf(this);
    await lend(this, lib.bookId(title), lib.patronNumber(patronName));
  },
);

When(
  '司書が {string} を利用者番号 {string} に貸し出そうとする',
  async function (this: D2World, title: string, patronNumber: string) {
    await lend(this, libraryOf(this).bookId(title), patronNumber);
  },
);

// ---- 結果: 貸出 ----

Then('貸出が記録され書籍の状態が貸出中になる', async function (this: D2World) {
  const v = view(this);
  assert.equal(v.kind, 'registered', `貸出が登録されていません: ${JSON.stringify(v)}`);
  if (v.kind !== 'registered') return;
  assert.equal(v.bookStatus, BOOK_STATUS.貸出中);
  const loan = await libraryOf(this).loanById(v.loanId);
  assert.ok(loan, `貸出 ${v.loanId} が記録されていません`);
  assert.equal(await libraryOf(this).loanCount(), (libraryOf(this).loanCountBefore ?? 0) + 1);
});

Then(
  '{string} の {string} の貸出は、貸出日が {string} で貸出状態が貸出中である',
  async function (this: D2World, patronName: string, title: string, loanedOn: string) {
    const loans = await libraryOf(this).loansOf(patronName, title);
    assert.equal(loans.length, 1, `貸出の件数: ${JSON.stringify(loans)}`);
    assert.equal(loans[0].loaned_on, loanedOn);
    assert.equal(loans[0].status, LOAN_STATUS.貸出中);
  },
);

Then('貸出日から貸出期間を加えた日が返却期限として設定される', async function (this: D2World) {
  const v = view(this);
  assert.equal(v.kind, 'registered', `貸出が登録されていません: ${JSON.stringify(v)}`);
  if (v.kind !== 'registered') return;
  const loan = await libraryOf(this).loanById(v.loanId);
  assert.ok(loan, `貸出 ${v.loanId} が記録されていません`);
  assert.ok(LOAN_PERIOD_DAYS > 0, '貸出期間は 1 日以上');
  assert.equal(loan.due_date, addDays(loan.loaned_on, LOAN_PERIOD_DAYS));
  // 画面に出す返却期限は backend が決めた値そのもの
  assert.equal(v.dueDate, loan.due_date);
});

Then(
  '{string} の {string} の貸出の返却期限は {string} に貸出期間の日数を加えた日である',
  async function (this: D2World, patronName: string, title: string, loanedOn: string) {
    const loans = await libraryOf(this).loansOf(patronName, title);
    assert.equal(loans.length, 1, `貸出の件数: ${JSON.stringify(loans)}`);
    assert.equal(loans[0].due_date, addDays(loanedOn, LOAN_PERIOD_DAYS));
  },
);

Then('貸出できない旨が表示され貸出は記録されない', async function (this: D2World) {
  const v = view(this);
  assert.equal(v.kind, 'rejected', `貸出できない旨が表示されていません: ${JSON.stringify(v)}`);
  if (v.kind !== 'rejected') return;
  assert.ok(v.message.length > 0, '表示する文言が空です');
  assert.equal(await libraryOf(this).loanCount(), libraryOf(this).loanCountBefore);
});

Then('{string} の貸出は {int} 件である', async function (this: D2World, patronName: string, count: number) {
  assert.equal((await libraryOf(this).loansOf(patronName)).length, count);
});

Then(
  '{string} の {string} の貸出は、貸出状態が貸出中のまま変わらない',
  async function (this: D2World, patronName: string, title: string) {
    const loans = await libraryOf(this).loansOf(patronName, title);
    assert.equal(loans.length, 1, `貸出の件数: ${JSON.stringify(loans)}`);
    assert.equal(loans[0].status, LOAN_STATUS.貸出中);
    assert.equal(loans[0].version, 1, '既存の貸出が更新されています');
  },
);

// ---- 結果: 書籍状態 ----

Then('書籍 {string} の状態は貸出中である', async function (this: D2World, title: string) {
  assert.equal(await libraryOf(this).bookStatus(title), BOOK_STATUS.貸出中);
});

Then('書籍 {string} の状態は予約待ちである', async function (this: D2World, title: string) {
  assert.equal(await libraryOf(this).bookStatus(title), BOOK_STATUS.予約待ち);
});

Then('書籍 {string} の状態は在庫ありである', async function (this: D2World, title: string) {
  assert.equal(await libraryOf(this).bookStatus(title), BOOK_STATUS.在庫あり);
});

// ---- 結果: 予約状態 ----

Then(
  '{string} の {string} の予約の予約状態は完了である',
  async function (this: D2World, patronName: string, title: string) {
    assert.deepEqual(await libraryOf(this).reservationStatus(patronName, title), [RESERVATION_STATUS.完了]);
  },
);

Then(
  '{string} の {string} の予約の予約状態は予約中のまま変わらない',
  async function (this: D2World, patronName: string, title: string) {
    assert.deepEqual(await libraryOf(this).reservationStatus(patronName, title), [RESERVATION_STATUS.予約中]);
  },
);

Then(
  '{string} の {string} の予約の予約状態は通知済のまま変わらない',
  async function (this: D2World, patronName: string, title: string) {
    assert.deepEqual(await libraryOf(this).reservationStatus(patronName, title), [RESERVATION_STATUS.通知済]);
  },
);
