/**
 * 貸出受付画面の状態 (submitLoanCheckout) の単体テスト。
 * 応答の値は contract-slice.json の createLoan の examples から取る。
 */
import { describe, expect, it } from 'vitest';
import type { Loan, Problem } from '../../../../packages/contracts/api/types';
import {
  submitLoanCheckout,
  UNEXPECTED_ERROR_DETAIL,
  UNEXPECTED_ERROR_TITLE,
} from './loan-checkout';

interface Captured {
  url?: string;
  init?: RequestInit;
}

function fakeFetch(
  status: number,
  body: unknown,
  contentType: string,
  captured: Captured = {},
): typeof fetch {
  return async (url, init) => {
    captured.url = String(url);
    captured.init = init;
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': contentType },
    });
  };
}

const heldForSelfLoan: Loan = {
  book_title: 'こころ',
  copy_id: '33333333-3333-4333-8333-333333333333',
  copy_status: 'on_loan',
  due_on: '2026-10-04',
  fulfilled_reservation_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  loan_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  loaned_on: '2026-09-20',
  patron_number: 'P-2026-00001',
  returned_on: null,
  status: 'on_loan',
};

describe('submitLoanCheckout', () => {
  it('送信した場合_契約のベースパスの/loansに利用者番号と蔵書IDをPOSTすること', async () => {
    // Arrange
    const captured: Captured = {};
    const options = { fetch: fakeFetch(201, heldForSelfLoan, 'application/json', captured) };

    // Act
    await submitLoanCheckout(
      { patronNumber: 'P-2026-00001', copyId: '33333333-3333-4333-8333-333333333333' },
      options,
    );

    // Assert
    expect({
      url: captured.url,
      method: captured.init?.method,
      body: JSON.parse(String(captured.init?.body)),
    }).toEqual({
      url: '/api/loans',
      method: 'POST',
      body: { patron_number: 'P-2026-00001', copy_id: '33333333-3333-4333-8333-333333333333' },
    });
  });

  it('ベースURLと認可ヘッダを注入した場合_それを使って呼び出すこと', async () => {
    // Arrange
    const captured: Captured = {};
    const options = {
      fetch: fakeFetch(201, heldForSelfLoan, 'application/json', captured),
      baseUrl: '',
      headers: { authorization: 'Bearer token-1' },
    };

    // Act
    await submitLoanCheckout({ patronNumber: 'P-2026-00001', copyId: 'x' }, options);

    // Assert
    expect({
      url: captured.url,
      authorization: (captured.init?.headers as Record<string, string> | undefined)?.authorization,
    }).toEqual({ url: '/loans', authorization: 'Bearer token-1' });
  });

  it('本人向けに取り置き中の蔵書を貸し出した場合_受取済みにした予約つきの貸出を返すこと', async () => {
    // Arrange
    const options = { fetch: fakeFetch(201, heldForSelfLoan, 'application/json') };

    // Act
    const view = await submitLoanCheckout(
      { patronNumber: 'P-2026-00001', copyId: '33333333-3333-4333-8333-333333333333' },
      options,
    );

    // Assert
    expect(view).toEqual({ kind: 'success', loan: heldForSelfLoan });
  });

  it('他の利用者向けに取り置き中の蔵書の場合_貸し出せない旨のエラーを返すこと', async () => {
    // Arrange
    const problem: Problem = {
      code: 'loan_not_allowed',
      detail: 'この蔵書は他の利用者向けに取り置き中です。',
      status: 409,
      title: '貸し出せません',
      type: 'https://library.example/problems/business-rule-violation',
    };
    const options = { fetch: fakeFetch(409, problem, 'application/problem+json') };

    // Act
    const view = await submitLoanCheckout(
      { patronNumber: 'P-2026-00002', copyId: '33333333-3333-4333-8333-333333333333' },
      options,
    );

    // Assert
    expect(view).toEqual({
      kind: 'error',
      title: '貸し出せません',
      detail: 'この蔵書は他の利用者向けに取り置き中です。',
    });
  });

  it('入力が不正な場合_項目ごとのエラーをフォームの項目名で返すこと', async () => {
    // Arrange
    const problem: Problem = {
      errors: [{ code: 'required', field: 'patron_number', message: '利用者番号は必須です' }],
      status: 400,
      title: '入力内容に誤りがあります',
      type: 'https://library.example/problems/validation-error',
    };
    const options = { fetch: fakeFetch(400, problem, 'application/problem+json') };

    // Act
    const view = await submitLoanCheckout(
      { patronNumber: '', copyId: '11111111-1111-4111-8111-111111111111' },
      options,
    );

    // Assert
    expect(view).toEqual({
      kind: 'error',
      title: '入力内容に誤りがあります',
      fieldErrors: { patronNo: '利用者番号は必須です' },
    });
  });

  it('利用者が見つからない場合_見つからない旨のエラーを返すこと', async () => {
    // Arrange
    const problem: Problem = {
      code: 'patron_not_found',
      status: 404,
      title: '利用者が見つかりません',
      type: 'https://library.example/problems/not-found',
    };
    const options = { fetch: fakeFetch(404, problem, 'application/problem+json') };

    // Act
    const view = await submitLoanCheckout(
      { patronNumber: 'P-2026-99999', copyId: '11111111-1111-4111-8111-111111111111' },
      options,
    );

    // Assert
    expect(view).toEqual({ kind: 'error', title: '利用者が見つかりません' });
  });

  it('通信に失敗した場合_再試行を促すエラーを返すこと', async () => {
    // Arrange
    const options = {
      fetch: (async () => {
        throw new TypeError('network down');
      }) as typeof fetch,
    };

    // Act
    const view = await submitLoanCheckout({ patronNumber: 'P-2026-00001', copyId: 'x' }, options);

    // Assert
    expect(view).toEqual({
      kind: 'error',
      title: UNEXPECTED_ERROR_TITLE,
      detail: UNEXPECTED_ERROR_DETAIL,
    });
  });

  it('Problemでない応答の場合_再試行を促すエラーを返すこと', async () => {
    // Arrange
    const options = { fetch: fakeFetch(502, 'Bad Gateway', 'text/plain') };

    // Act
    const view = await submitLoanCheckout({ patronNumber: 'P-2026-00001', copyId: 'x' }, options);

    // Assert
    expect(view).toEqual({
      kind: 'error',
      title: UNEXPECTED_ERROR_TITLE,
      detail: UNEXPECTED_ERROR_DETAIL,
    });
  });
});
