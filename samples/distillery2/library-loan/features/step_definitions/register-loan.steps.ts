/**
 * register-loan.steps.ts — UC「貸出を登録する」(@uc:register-loan) の step 定義
 *
 * 入口は UC の最前のティア (frontend) の画面の入口関数 submitLoanCheckout。
 * 画面の操作は tracedFn (tier: frontend, layer: screen) で包み、API 呼び出しには
 * this.api.asFetch (tier: frontend, layer: api-client) を渡す。これで「画面 → API クライアント → backend-api」が
 * 1 本のトレースに乗る。backend-api 側の計装は World (features/support/world.ts) が結線する。
 * 前提データの投入と結果の観測は features/support/library-fixtures.ts (raw の pg。トレースに載せない)。
 * step 文は features/貸出業務/register-loan.feature からそのまま取る。
 */
import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';
import { tracedFn } from '@repo/test-support/tracer';
import {
  type LoanCheckoutView,
  submitLoanCheckout,
} from '../../apps/frontend/src/state/loan-checkout';
import { fixturesOf } from '../support/library-fixtures';
import { FRONTEND_TIER } from '../support/tiers';
import type { D2World } from '../support/world';

/** 貸出受付画面の「貸し出す」操作 (計装つき) */
const submitOnCheckoutScreen = tracedFn('貸出受付画面', 'submit', submitLoanCheckout, {
  tier: FRONTEND_TIER,
  layer: 'screen',
});

/** 契約 createLoan の 409 (loan_not_allowed) が返す title。画面はこれをエラーの見出しに出す */
const LOAN_NOT_ALLOWED_TITLE = '貸し出せません';

function lastView(world: D2World): LoanCheckoutView {
  assert.ok(world.lastView, '画面の操作 (もし …) がまだ実行されていません');
  return world.lastView as LoanCheckoutView;
}

// ---- 前提 (背景) ----

Given('司書 {string} がログインしている', async function (this: D2World, librarian: string) {
  const librarianId = await fixturesOf(this).addLibrarian(librarian);
  // 偽の認証基盤にトークンを登録し、画面の API 呼び出しに Bearer トークンを付ける (契約 securitySchemes.bearerAuth)
  const token = `token-${librarian}`;
  this.tokens[token] = { role: 'librarian', librarianId };
  this.authHeaders = { authorization: `Bearer ${token}` };
});

Given('貸出期間が {int} 日に設定されている', async function (this: D2World, days: number) {
  await fixturesOf(this).setLoanPeriod(days);
});

Given('利用者 {string} が登録されている', async function (this: D2World, patron: string) {
  await fixturesOf(this).addPatron(patron);
});

// ---- 前提 (シナリオ) ----

Given(/^今日の日付は (\d{4}-\d{2}-\d{2}) である$/, function (this: D2World, today: string) {
  this.clock.setDate(today);
});

Given('蔵書 {string} の書籍の状態は在庫ありである', async function (this: D2World, copy: string) {
  await fixturesOf(this).addAvailableCopy(copy);
});

Given(
  '蔵書 {string} は利用者 {string} に貸出中である',
  async function (this: D2World, copy: string, patron: string) {
    await fixturesOf(this).addCopyOnLoan(copy, patron);
  },
);

Given(
  '蔵書 {string} は利用者 {string} 向けに取り置き中である',
  async function (this: D2World, copy: string, patron: string) {
    await fixturesOf(this).addCopyOnHold(copy, patron);
  },
);

// ---- 操作 ----

When(
  '司書が蔵書 {string} を利用者 {string} に貸し出す',
  async function (this: D2World, copy: string, patron: string) {
    const fixtures = fixturesOf(this);
    this.lastView = await submitOnCheckoutScreen(
      { patronNumber: fixtures.patron(patron).patronNumber, copyId: fixtures.copyId(copy) },
      {
        // テスト用アプリは basePath (/api) なしで配信するため、ベース URL は空にする
        baseUrl: '',
        fetch: this.api.asFetch({ tier: FRONTEND_TIER, layer: 'api-client' }),
        headers: this.authHeaders,
      },
    );
  },
);

// ---- 結果 ----

Then(
  '蔵書 {string} の利用者 {string} への貸出が記録される',
  async function (this: D2World, copy: string, patron: string) {
    const view = lastView(this);
    assert.equal(view.kind, 'success', `貸出が登録されませんでした: ${JSON.stringify(view)}`);
    const fixtures = fixturesOf(this);
    if (view.kind === 'success') {
      assert.equal(view.loan.copy_id, fixtures.copyId(copy));
      assert.equal(view.loan.patron_number, fixtures.patron(patron).patronNumber);
    }
    const loans = await fixtures.loansOf(copy, patron);
    assert.equal(loans.length, 1, `貸出の記録が 1 件ではありません: ${JSON.stringify(loans)}`);
  },
);

Then(
  '蔵書 {string} の利用者 {string} への貸出は記録されない',
  async function (this: D2World, copy: string, patron: string) {
    const loans = await fixturesOf(this).loansOf(copy, patron);
    assert.deepEqual(loans, []);
  },
);

Then(
  '蔵書 {string} の利用者 {string} への貸出の状態は貸出中である',
  async function (this: D2World, copy: string, patron: string) {
    const loans = await fixturesOf(this).loansOf(copy, patron);
    assert.deepEqual(
      loans.map((l) => l.status),
      ['on_loan'],
    );
  },
);

Then(
  /^蔵書 "([^"]*)" の利用者 "([^"]*)" への貸出の貸出日は (\d{4}-\d{2}-\d{2}) である$/,
  async function (this: D2World, copy: string, patron: string, loanedOn: string) {
    const loans = await fixturesOf(this).loansOf(copy, patron);
    assert.deepEqual(
      loans.map((l) => l.loaned_on),
      [loanedOn],
    );
    const view = lastView(this);
    if (view.kind === 'success') assert.equal(view.loan.loaned_on, loanedOn);
  },
);

Then(
  /^蔵書 "([^"]*)" の利用者 "([^"]*)" への貸出の返却期限は (\d{4}-\d{2}-\d{2}) である$/,
  async function (this: D2World, copy: string, patron: string, dueOn: string) {
    const loans = await fixturesOf(this).loansOf(copy, patron);
    assert.deepEqual(
      loans.map((l) => l.due_on),
      [dueOn],
    );
    const view = lastView(this);
    if (view.kind === 'success') assert.equal(view.loan.due_on, dueOn);
  },
);

Then('蔵書 {string} の書籍の状態は貸出中になる', async function (this: D2World, copy: string) {
  assert.equal(await fixturesOf(this).copyStatus(copy), 'on_loan');
  const view = lastView(this);
  if (view.kind === 'success') assert.equal(view.loan.copy_status, 'on_loan');
});

Then('蔵書 {string} の書籍の状態は貸出中のままである', async function (this: D2World, copy: string) {
  assert.equal(await fixturesOf(this).copyStatus(copy), 'on_loan');
});

Then('蔵書 {string} の書籍の状態は取り置き中のままである', async function (this: D2World, copy: string) {
  assert.equal(await fixturesOf(this).copyStatus(copy), 'on_hold');
});

Then(
  '利用者 {string} の蔵書 {string} に対する予約の状態は取り置き中のままである',
  async function (this: D2World, patron: string, copy: string) {
    assert.deepEqual(await fixturesOf(this).reservationStatuses(patron, copy), ['on_hold']);
  },
);

Then(
  '利用者 {string} の蔵書 {string} に対する予約の状態は受取済みになる',
  async function (this: D2World, patron: string, copy: string) {
    assert.deepEqual(await fixturesOf(this).reservationStatuses(patron, copy), ['fulfilled']);
  },
);

Then('貸出できない旨のエラーが表示される', function (this: D2World) {
  const view = lastView(this);
  assert.equal(view.kind, 'error', `エラーが表示されていません: ${JSON.stringify(view)}`);
  assert.equal(view.kind === 'error' ? view.title : undefined, LOAN_NOT_ALLOWED_TITLE);
});
