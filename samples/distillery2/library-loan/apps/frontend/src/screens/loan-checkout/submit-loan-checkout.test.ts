/**
 * 貸出受付画面の入口関数 (submitLoanCheckout) の単体テスト。
 *
 * 出典: features/貸出業務/register-loan.feature「貸出できない旨が表示され貸出は記録されない」、
 * contract-slice の POST /loans (registerLoan) の 201 / 400 / 409 examples。
 */
import { describe, expect, it } from 'vitest';
import {
  nextIdempotencyKey,
  submitLoanCheckout,
  UNEXPECTED_FAILURE_MESSAGE,
} from './submit-loan-checkout';

const jsonResponse = (status: number, body: unknown, contentType: string): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });

const registered201 = {
  bookStatus: 'on_loan',
  loan: {
    bookId: '0b6f3c1e-2a4d-4e8f-9b1a-3c5d7e9f1a2b',
    dueDate: '2026-10-15',
    loanId: '3f8a2d6c-1b4e-4a7f-9c2d-5e8b1a4d7c0e',
    loanedOn: '2026-10-01',
    patronNumber: 'P-00000001',
    reservationId: null,
    returnedOn: null,
    status: 'on_loan',
  },
};

describe('submitLoanCheckout', () => {
  it('貸出が登録された場合、返却期限と貸出中の書籍状態を表示すること', async () => {
    // Arrange
    const input = { patronNumber: 'P-00000001', bookId: '0b6f3c1e-2a4d-4e8f-9b1a-3c5d7e9f1a2b' };
    const fetchFn = (async () =>
      jsonResponse(201, registered201, 'application/json')) as typeof fetch;

    // Act
    const view = await submitLoanCheckout(input, fetchFn);

    // Assert
    expect(view).toEqual({
      kind: 'registered',
      loanId: '3f8a2d6c-1b4e-4a7f-9c2d-5e8b1a4d7c0e',
      loanedOn: '2026-10-01',
      dueDate: '2026-10-15',
      bookStatus: 'on_loan',
    });
  });

  it('貸出中の書籍で 409 が返った場合、貸出できない旨を表示すること', async () => {
    // Arrange
    const input = { patronNumber: 'P-00000001', bookId: '9e4a1c7b-3d5f-4a2e-8b6c-1f3e5a7c9b0d' };
    const fetchFn = (async () =>
      jsonResponse(
        409,
        {
          code: 'book_on_loan',
          detail: '書籍 9e4a1c7b-3d5f-4a2e-8b6c-1f3e5a7c9b0d は貸出中です',
          status: 409,
          title: 'この書籍は貸出中のため貸し出せません',
          type: 'https://library.example/problems/book-on-loan',
        },
        'application/problem+json',
      )) as typeof fetch;

    // Act
    const view = await submitLoanCheckout(input, fetchFn);

    // Assert
    expect(view).toEqual({
      kind: 'rejected',
      code: 'book_on_loan',
      message: 'この書籍は貸出中のため貸し出せません',
    });
  });

  it('入力不正で 400 が返った場合、貸出できない旨を表示すること', async () => {
    // Arrange
    const input = { patronNumber: 'P-00000001', bookId: '' };
    const fetchFn = (async () =>
      jsonResponse(
        400,
        {
          code: 'validation_error',
          errors: [{ field: 'bookId', message: '書籍IDは必須です' }],
          status: 400,
          title: '入力内容に誤りがあります',
          type: 'https://library.example/problems/validation-error',
        },
        'application/problem+json',
      )) as typeof fetch;

    // Act
    const view = await submitLoanCheckout(input, fetchFn);

    // Assert
    expect(view).toEqual({
      kind: 'rejected',
      code: 'validation_error',
      message: '入力内容に誤りがあります',
    });
  });

  it('契約に無い応答が返った場合、再試行を促す失敗を表示すること', async () => {
    // Arrange
    const input = { patronNumber: 'P-00000001', bookId: '0b6f3c1e-2a4d-4e8f-9b1a-3c5d7e9f1a2b' };
    const fetchFn = (async () => new Response('', { status: 502 })) as typeof fetch;

    // Act
    const view = await submitLoanCheckout(input, fetchFn);

    // Assert
    expect(view).toEqual({ kind: 'failed', status: 502, message: UNEXPECTED_FAILURE_MESSAGE });
  });

  it('送信する場合、POST /loans に Idempotency-Key と利用者番号・書籍IDを付けること', async () => {
    // Arrange
    const input = { patronNumber: 'P-00000001', bookId: '0b6f3c1e-2a4d-4e8f-9b1a-3c5d7e9f1a2b' };
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse(201, registered201, 'application/json');
    }) as typeof fetch;

    // Act
    await submitLoanCheckout(input, fetchFn, { idempotencyKey: 'key-001' });

    // Assert
    expect(calls).toEqual([
      {
        url: '/loans',
        init: {
          method: 'POST',
          body: JSON.stringify({
            patronNumber: 'P-00000001',
            bookId: '0b6f3c1e-2a4d-4e8f-9b1a-3c5d7e9f1a2b',
          }),
          headers: { 'content-type': 'application/json', 'Idempotency-Key': 'key-001' },
        },
      },
    ]);
  });

  it('再送判定キーを省略した場合、呼び出しごとに異なるキーを付けること', async () => {
    // Arrange
    const input = { patronNumber: 'P-00000001', bookId: '0b6f3c1e-2a4d-4e8f-9b1a-3c5d7e9f1a2b' };
    const keys: string[] = [];
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      keys.push((init?.headers as Record<string, string>)['Idempotency-Key']);
      return jsonResponse(201, registered201, 'application/json');
    }) as typeof fetch;
    await submitLoanCheckout(input, fetchFn);

    // Act
    await submitLoanCheckout(input, fetchFn);

    // Assert
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys.every((k) => k.length >= 1 && k.length <= 128)).toBe(true);
  });
});

describe('nextIdempotencyKey', () => {
  it('貸し出せない応答の後は、再試行で改めて判定されるよう新しいキーにすること', () => {
    // Arrange
    const view = { kind: 'rejected' as const, code: 'book_on_loan' as const, message: '貸出中' };

    // Act
    const next = nextIdempotencyKey(view, 'key-001');

    // Assert
    expect(next).not.toBe('key-001');
  });

  it('結果が不確かな失敗の後は、登録が重複しないよう同じキーのままにすること', () => {
    // Arrange
    const view = { kind: 'failed' as const, status: 0, message: '通信できません' };

    // Act
    const next = nextIdempotencyKey(view, 'key-001');

    // Assert
    expect(next).toBe('key-001');
  });
});
