/**
 * 返却受付画面 (ReturnRegister, route /admin/returns) の入口関数 (submitReturnCheckout) の単体テスト。
 *
 * 出典: features/貸出業務/register-return.feature「貸出が返却済みになり書籍の状態が在庫ありになる」
 * 「返却できない旨が表示され返却は記録されない」、contract-slice の POST /returns (registerReturn) の 201 / 404 / 409 examples。
 */
import { describe, expect, it } from 'vitest';
import { RETURN_UNEXPECTED_FAILURE_MESSAGE, submitReturnCheckout } from './submit-return-checkout';

const jsonResponse = (status: number, body: unknown, contentType: string): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });

const BOOK_ID = '4c1d7e2a-8b3f-4e6a-9c1d-2f5a8b3e6c9d';

const returned201 = {
  bookStatus: 'available',
  loan: {
    bookId: BOOK_ID,
    dueDate: '2026-10-15',
    loanId: '7e2b5d8a-3c6f-4a1e-8d4b-9f2c5e8a1b3d',
    loanedOn: '2026-10-01',
    patronNumber: 'P-00000001',
    reservationId: null,
    returnedOn: '2026-10-15',
    status: 'returned',
  },
};

describe('submitReturnCheckout', () => {
  it('返却が登録された場合、返却日と返却後の書籍状態を表示すること', async () => {
    // Arrange
    const fetchFn = (async () =>
      jsonResponse(201, returned201, 'application/json')) as typeof fetch;

    // Act
    const view = await submitReturnCheckout({ bookId: BOOK_ID }, fetchFn);

    // Assert
    expect(view).toEqual({
      kind: 'returned',
      loanId: '7e2b5d8a-3c6f-4a1e-8d4b-9f2c5e8a1b3d',
      returnedOn: '2026-10-15',
      bookStatus: 'available',
    });
  });

  it('予約のある書籍の返却が登録された場合、書籍状態を予約待ちとして表示すること', async () => {
    // Arrange
    const body = {
      bookStatus: 'awaiting_pickup',
      loan: {
        ...returned201.loan,
        bookId: '8d3f6a1c-5e2b-4c7d-9a3e-6b1d4f7a2c5e',
        loanId: '1f4a7c2e-9d3b-4e6f-8a2c-5d8b1e4f7a3c',
      },
    };
    const fetchFn = (async () => jsonResponse(201, body, 'application/json')) as typeof fetch;

    // Act
    const view = await submitReturnCheckout(
      { bookId: '8d3f6a1c-5e2b-4c7d-9a3e-6b1d4f7a2c5e' },
      fetchFn,
    );

    // Assert
    expect(view).toEqual({
      kind: 'returned',
      loanId: '1f4a7c2e-9d3b-4e6f-8a2c-5d8b1e4f7a3c',
      returnedOn: '2026-10-15',
      bookStatus: 'awaiting_pickup',
    });
  });

  it('未返却の貸出が無い書籍で 409 が返った場合、返却できない旨を表示すること', async () => {
    // Arrange
    const fetchFn = (async () =>
      jsonResponse(
        409,
        {
          code: 'no_active_loan',
          detail: '書籍 6e9b2d5a-1f4c-4a8e-9b3d-7a2e5c8f1b4d には未返却の貸出がありません',
          status: 409,
          title: 'この書籍には返却できる貸出がありません',
          type: 'https://library.example/problems/no-active-loan',
        },
        'application/problem+json',
      )) as typeof fetch;

    // Act
    const view = await submitReturnCheckout(
      { bookId: '6e9b2d5a-1f4c-4a8e-9b3d-7a2e5c8f1b4d' },
      fetchFn,
    );

    // Assert
    expect(view).toEqual({
      kind: 'rejected',
      code: 'no_active_loan',
      message: 'この書籍には返却できる貸出がありません',
    });
  });

  it('存在しない書籍で 404 が返った場合、返却できない旨を表示すること', async () => {
    // Arrange
    const fetchFn = (async () =>
      jsonResponse(
        404,
        {
          code: 'not_found',
          detail: '書籍 0e5c8b1f-4a7d-4f2c-8e9b-3d6a1c4f7b2e は見つかりません',
          status: 404,
          title: '対象が見つかりません',
          type: 'https://library.example/problems/not-found',
        },
        'application/problem+json',
      )) as typeof fetch;

    // Act
    const view = await submitReturnCheckout(
      { bookId: '0e5c8b1f-4a7d-4f2c-8e9b-3d6a1c4f7b2e' },
      fetchFn,
    );

    // Assert
    expect(view).toEqual({ kind: 'rejected', code: 'not_found', message: '対象が見つかりません' });
  });

  it('契約に無い応答が返った場合、再試行を促す失敗を表示すること', async () => {
    // Arrange
    const fetchFn = (async () => new Response('', { status: 502 })) as typeof fetch;

    // Act
    const view = await submitReturnCheckout({ bookId: BOOK_ID }, fetchFn);

    // Assert
    expect(view).toEqual({
      kind: 'failed',
      status: 502,
      message: RETURN_UNEXPECTED_FAILURE_MESSAGE,
    });
  });

  it('送信する場合、POST /returns に Idempotency-Key と書籍IDを付けること', async () => {
    // Arrange
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse(201, returned201, 'application/json');
    }) as typeof fetch;

    // Act
    await submitReturnCheckout({ bookId: BOOK_ID }, fetchFn, {
      idempotencyKey: 'key-001',
      headers: { Authorization: 'Bearer test-librarian-token' },
    });

    // Assert
    expect(calls).toEqual([
      {
        url: '/returns',
        init: {
          method: 'POST',
          body: JSON.stringify({ bookId: BOOK_ID }),
          headers: {
            'content-type': 'application/json',
            Authorization: 'Bearer test-librarian-token',
            'Idempotency-Key': 'key-001',
          },
        },
      },
    ]);
  });

  it('再送判定キーを省略した場合、呼び出しごとに異なるキーを付けること', async () => {
    // Arrange
    const keys: string[] = [];
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      keys.push((init?.headers as Record<string, string>)['Idempotency-Key']);
      return jsonResponse(201, returned201, 'application/json');
    }) as typeof fetch;
    await submitReturnCheckout({ bookId: BOOK_ID }, fetchFn);

    // Act
    await submitReturnCheckout({ bookId: BOOK_ID }, fetchFn);

    // Assert
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys.every((k) => k.length >= 1 && k.length <= 128)).toBe(true);
  });
});
