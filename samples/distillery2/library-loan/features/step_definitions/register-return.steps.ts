/**
 * register-return.steps.ts — UC「返却を登録する」(@uc:register-return) の step 実装
 *
 * 入口は UC の最前のティア (frontend) の画面の入口関数 submitReturnCheckout。
 * その API 呼び出しに `this.api.asFetch(FRONTEND_API_CLIENT)` を渡し、
 * 「返却受付画面 → API クライアント → backend-api (presentation → usecase → repository → DB)」を 1 本のトレースに乗せる
 * (packages/test-support/README.md「実装者が結線するもの」2)。
 * createTestApp は Authorization / Idempotency-Key を補わない。認可ヘッダは step が明示的に渡し、
 * Idempotency-Key は画面の入口関数が契約どおりに作って送る。
 *
 * 前提データの投入と結果の確認は、計装しない素の DB に対して行う (support/library-scenario.ts)。
 *
 * 次の step は register-loan.steps.ts の定義を再利用するため、ここでは再定義しない。
 * - 今日は {string} である / 司書としてログインしている / 利用者 {string} が登録されている
 * - 書籍 {string} が登録され、{string} に貸出中である / 書籍 {string} が登録され、在庫ありである
 * - {string} の予約順 {int} 位は {string} で、予約状態は予約中である
 * - 書籍 {string} の状態は在庫ありである / 書籍 {string} の状態は予約待ちである
 *
 * step 文は features/貸出業務/register-return.feature からそのまま取る (意訳しない)。
 */
import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import { tracedFn } from '@repo/test-support/tracer';
import {
  submitReturnCheckout,
  type ReturnCheckoutView,
} from '../../apps/frontend/src/screens/return-checkout/submit-return-checkout';
import { FRONTEND_API_CLIENT, FRONTEND_SCREEN } from '../support/composition';
import { BOOK_STATUS, LOAN_STATUS, libraryOf } from '../support/library-scenario';
import type { D2World } from '../support/world';

/** 返却受付画面の「返却を登録する」操作 (画面の入口。frontend / screen として計装する) */
const submitOnReturnRegisterScreen = tracedFn('返却受付画面', 'submit', submitReturnCheckout, FRONTEND_SCREEN);

async function registerReturn(world: D2World, title: string): Promise<void> {
  const lib = libraryOf(world);
  if (!lib.accessToken) throw new Error('背景「司書としてログインしている」が先に必要です');
  await lib.wire(world);
  lib.loanCountBefore = await lib.loanCount();
  lib.returnedLoanCountBefore = await lib.returnedLoanCount();
  lib.view = await submitOnReturnRegisterScreen({ bookId: lib.bookId(title) }, world.api.asFetch(FRONTEND_API_CLIENT), {
    headers: { Authorization: `Bearer ${lib.accessToken}` },
  });
}

function view(world: D2World): ReturnCheckoutView {
  const v = libraryOf(world).view as ReturnCheckoutView | undefined;
  if (!v) throw new Error('返却の操作がまだ行われていません');
  return v;
}

async function assertReturned(world: D2World, expectedBookStatus: string): Promise<void> {
  const lib = libraryOf(world);
  const v = view(world);
  assert.equal(v.kind, 'returned', `返却が登録されていません: ${JSON.stringify(v)}`);
  if (v.kind !== 'returned') return;
  assert.equal(v.bookStatus, expectedBookStatus);
  assert.equal(v.returnedOn, lib.today, '画面に出す返却日は当日');
  const loan = await lib.loanById(v.loanId);
  assert.ok(loan, `貸出 ${v.loanId} がありません`);
  assert.equal(loan.status, LOAN_STATUS.返却済);
  assert.equal(loan.returned_on, v.returnedOn, '画面に出す返却日は backend が記録した値そのもの');
  // 返却は既存の貸出を更新する。新しい貸出は作らない
  assert.equal(await lib.loanCount(), lib.loanCountBefore);
}

// ---- 前提: 貸出 ----

Given('{string} の {string} の貸出は延滞である', async function (this: D2World, patronName: string, title: string) {
  await libraryOf(this).markLoanOverdue(patronName, title);
});

// ---- 操作 ----

When('司書が {string} の返却を登録する', async function (this: D2World, title: string) {
  await registerReturn(this, title);
});

When('司書が {string} の返却を登録しようとする', async function (this: D2World, title: string) {
  await registerReturn(this, title);
});

// ---- 結果: 返却 ----

Then('貸出が返却済みになり書籍の状態が在庫ありになる', async function (this: D2World) {
  await assertReturned(this, BOOK_STATUS.在庫あり);
});

Then('貸出が返却済みになり書籍の状態が予約待ちになる', async function (this: D2World) {
  await assertReturned(this, BOOK_STATUS.予約待ち);
});

Then(
  '{string} の {string} の貸出は、返却日が {string} で貸出状態が返却済である',
  async function (this: D2World, patronName: string, title: string, returnedOn: string) {
    const loans = await libraryOf(this).loansOf(patronName, title);
    assert.equal(loans.length, 1, `貸出の件数: ${JSON.stringify(loans)}`);
    assert.equal(loans[0].returned_on, returnedOn);
    assert.equal(loans[0].status, LOAN_STATUS.返却済);
  },
);

Then('返却できない旨が表示され返却は記録されない', async function (this: D2World) {
  const lib = libraryOf(this);
  const v = view(this);
  assert.equal(v.kind, 'rejected', `返却できない旨が表示されていません: ${JSON.stringify(v)}`);
  if (v.kind !== 'rejected') return;
  assert.ok(v.message.length > 0, '表示する文言が空です');
  assert.equal(await lib.loanCount(), lib.loanCountBefore);
  assert.equal(await lib.returnedLoanCount(), lib.returnedLoanCountBefore);
});
