/**
 * POST /returns (registerReturn) の HTTP の入口 (presentation) の単体テスト。usecase と IdP はインメモリの差し替え。
 *
 * 出典: contract-slice の POST /returns (registerReturn) の examples と判定順序 (401 → 403 → 400 → 404 / 409)。
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ReturnRegistration } from '../../../../packages/contracts/library-api/types';
import type { TokenVerifier } from '../usecase/ports';
import type { RegisterLoan } from '../usecase/register-loan';
import type {
  RegisterReturn,
  RegisterReturnCommand,
  RegisterReturnDecision,
  RegisterReturnOutcome,
} from '../usecase/register-return';
import { createHttpApp } from './http-app';
import { renderRegisterReturnDecision } from './register-return-response';

const LIBRARIAN_TOKEN = 'librarian-token';
const PATRON_TOKEN = 'patron-token';
const BOOK_ID = '4c1d7e2a-8b3f-4e6a-9c1d-2f5a8b3e6c9d';

const verifier: TokenVerifier = {
  verify: async (token) => {
    if (token === LIBRARIAN_TOKEN) return { subject: 'lib-1', role: 'librarian' };
    if (token === PATRON_TOKEN) return { subject: 'pat-1', role: 'patron', patronNumber: 'P-1' };
    return null;
  },
};

const unusedLoan: RegisterLoan = {
  isAllowed: () => true,
  execute: async () => {
    throw new Error('registerLoan は呼ばれない想定');
  },
};

const registration: ReturnRegistration = {
  bookStatus: 'available',
  loan: {
    loanId: '7e2b5d8a-3c6f-4a1e-8d4b-9f2c5e8a1b3d',
    patronNumber: 'P-00000001',
    bookId: BOOK_ID,
    reservationId: null,
    loanedOn: '2026-10-01',
    dueDate: '2026-10-15',
    returnedOn: '2026-10-15',
    status: 'returned',
  },
};

function decided(decision: RegisterReturnDecision): RegisterReturnOutcome {
  return { kind: 'decided', decision, response: renderRegisterReturnDecision(decision) };
}

function setUp(outcome: RegisterReturnOutcome = decided({ kind: 'returned', registration })) {
  const calls: RegisterReturnCommand[] = [];
  const usecase: RegisterReturn = {
    isAllowed: (principal) => principal.role === 'librarian',
    execute: async (command) => {
      calls.push(command);
      return outcome;
    },
  };
  const app = createHttpApp({
    registerLoan: unusedLoan,
    registerReturn: usecase,
    tokenVerifier: verifier,
  });
  const post = (token: string | null = LIBRARIAN_TOKEN) => {
    const req = request(app).post('/returns').set('Idempotency-Key', 'key-1');
    return token === null ? req : req.set('Authorization', `Bearer ${token}`);
  };
  return { post, calls };
}

describe('POST /returns', () => {
  it('正しい要求の場合、201 で返却結果を返し usecase に主体とキーと書籍IDを渡すこと', async () => {
    // Arrange
    const { post, calls } = setUp();

    // Act
    const res = await post().send({ bookId: BOOK_ID });

    // Assert
    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual(registration);
    expect(calls).toEqual([
      {
        principal: { subject: 'lib-1', role: 'librarian' },
        idempotencyKey: 'key-1',
        request: { bookId: BOOK_ID },
      },
    ]);
  });

  it('書籍IDが無い場合、400 で契約の文言の項目別エラーを返し usecase を呼ばないこと', async () => {
    // Arrange
    const { post, calls } = setUp();

    // Act
    const res = await post().send({});

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      type: 'https://library.example/problems/validation-error',
      title: '入力内容に誤りがあります',
      status: 400,
      code: 'validation_error',
      errors: [{ field: 'bookId', message: '書籍IDは必須です' }],
    });
    expect(calls).toHaveLength(0);
  });

  it('未定義の項目を送った場合、400 を返すこと', async () => {
    // Arrange
    const { post } = setUp();

    // Act
    const res = await post().send({ bookId: BOOK_ID, returnedOn: '2026-10-15' });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: 'returnedOn', message: 'returnedOn は指定できない項目です' },
    ]);
  });

  it('アクセストークンを付けない場合、401 で契約の文言を返すこと', async () => {
    // Arrange
    const { post, calls } = setUp();

    // Act
    const res = await post(null).send({ bookId: BOOK_ID });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      code: 'unauthorized',
      status: 401,
      title: '認証が必要です',
      type: 'https://library.example/problems/unauthorized',
    });
    expect(calls).toHaveLength(0);
  });

  it('利用者 (patron ロール) が不正な本文で呼んだ場合、入力検証より先に 403 を返すこと', async () => {
    // Arrange
    const { post, calls } = setUp();

    // Act
    const res = await post(PATRON_TOKEN).send({});

    // Assert
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 'forbidden',
      title: 'この操作を行う権限がありません',
      detail: '返却の登録は司書だけが行えます',
    });
    expect(calls).toHaveLength(0);
  });

  it('書籍が存在しない場合、404 で契約の文言を返すこと', async () => {
    // Arrange
    const unknown = '0e5c8b1f-4a7d-4f2c-8e9b-3d6a1c4f7b2e';
    const { post } = setUp(decided({ kind: 'book_not_found', bookId: unknown }));

    // Act
    const res = await post().send({ bookId: unknown });

    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: 'not_found',
      detail: `書籍 ${unknown} は見つかりません`,
      status: 404,
      title: '対象が見つかりません',
      type: 'https://library.example/problems/not-found',
    });
  });

  it('未返却の貸出が無い場合、409 no_active_loan で契約の文言を返すこと', async () => {
    // Arrange
    const bookId = '6e9b2d5a-1f4c-4a8e-9b3d-7a2e5c8f1b4d';
    const { post } = setUp(decided({ kind: 'rejected', code: 'no_active_loan', bookId }));

    // Act
    const res = await post().send({ bookId });

    // Assert
    expect(res.status).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toEqual({
      code: 'no_active_loan',
      detail: `書籍 ${bookId} には未返却の貸出がありません`,
      status: 409,
      title: 'この書籍には返却できる貸出がありません',
      type: 'https://library.example/problems/no-active-loan',
    });
  });
});
