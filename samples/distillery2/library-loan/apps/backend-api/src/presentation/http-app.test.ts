/**
 * HTTP の入口 (presentation) の単体テスト。usecase と IdP はインメモリの差し替え。
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { LoanRegistration } from '../../../../packages/contracts/library-api/types';
import type { TokenVerifier } from '../usecase/ports';
import type {
  RegisterLoan,
  RegisterLoanCommand,
  RegisterLoanDecision,
  RegisterLoanOutcome,
} from '../usecase/register-loan';
import { createHttpApp } from './http-app';
import { renderRegisterLoanDecision } from './register-loan-response';

const TOKEN = 'valid-token';
const BOOK_ID = '0b6f3c1e-2a4d-4e8f-9b1a-3c5d7e9f1a2b';
const verifier: TokenVerifier = {
  verify: async (token) => (token === TOKEN ? { subject: 'lib-1', role: 'librarian' } : null),
};

function fakeUsecase(outcome: RegisterLoanOutcome | Error) {
  const calls: RegisterLoanCommand[] = [];
  const usecase: RegisterLoan = {
    execute: async (command) => {
      calls.push(command);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
  return { usecase, calls };
}

const registration: LoanRegistration = {
  bookStatus: 'on_loan',
  loan: {
    loanId: '3f8a2d6c-1b4e-4a7f-9c2d-5e8b1a4d7c0e',
    patronNumber: 'P-00000001',
    bookId: BOOK_ID,
    reservationId: null,
    loanedOn: '2026-10-01',
    dueDate: '2026-10-15',
    returnedOn: null,
    status: 'on_loan',
  },
};

function decided(decision: RegisterLoanDecision): RegisterLoanOutcome {
  return { kind: 'decided', decision, response: renderRegisterLoanDecision(decision) };
}

const registered = decided({ kind: 'registered', registration });

function post(outcome: RegisterLoanOutcome | Error = registered) {
  const { usecase, calls } = fakeUsecase(outcome);
  const app = createHttpApp({ registerLoan: usecase, tokenVerifier: verifier });
  const req = request(app)
    .post('/loans')
    .set('Authorization', `Bearer ${TOKEN}`)
    .set('Idempotency-Key', 'key-1');
  return { req, calls, app };
}

describe('POST /loans', () => {
  it('正しい要求の場合、201 で登録結果を返し usecase に主体とキーを渡すこと', async () => {
    // Arrange
    const { req, calls } = post();

    // Act
    const res = await req.send({ bookId: BOOK_ID, patronNumber: 'P-00000001' });

    // Assert
    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual(registration);
    expect(calls[0]).toEqual({
      principal: { subject: 'lib-1', role: 'librarian' },
      idempotencyKey: 'key-1',
      request: { bookId: BOOK_ID, patronNumber: 'P-00000001' },
    });
  });

  it('書籍IDが無い場合、400 で項目別のエラーを返し usecase を呼ばないこと', async () => {
    // Arrange
    const { req, calls } = post();

    // Act
    const res = await req.send({ patronNumber: 'P-00000001' });

    // Assert
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      code: 'validation_error',
      errors: [{ field: 'bookId', message: '書籍IDは必須です' }],
    });
    expect(calls).toHaveLength(0);
  });

  it('未定義の項目と UUID でない書籍IDの場合、両方を 400 で返すこと', async () => {
    // Arrange
    const { req } = post();

    // Act
    const res = await req.send({ bookId: 'abc', patronNumber: 'P-00000001', loanedOn: 'x' });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field)).toEqual(['bookId', 'loanedOn']);
  });

  it('Idempotency-Key が無い場合、400 を返すこと', async () => {
    // Arrange
    const { usecase } = fakeUsecase(registered);
    const app = createHttpApp({ registerLoan: usecase, tokenVerifier: verifier });

    // Act
    const res = await request(app)
      .post('/loans')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ bookId: BOOK_ID, patronNumber: 'P-00000001' });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: 'Idempotency-Key', message: 'Idempotency-Key ヘッダは必須です' },
    ]);
  });

  it('本文が JSON として読めない場合、400 を返すこと', async () => {
    // Arrange
    const { req } = post();

    // Act
    const res = await req.set('Content-Type', 'application/json').send('{broken');

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
  });

  it('アクセストークンが無効な場合、401 を返すこと', async () => {
    // Arrange
    const { usecase, calls } = fakeUsecase(registered);
    const app = createHttpApp({ registerLoan: usecase, tokenVerifier: verifier });

    // Act
    const res = await request(app)
      .post('/loans')
      .set('Authorization', 'Bearer wrong')
      .set('Idempotency-Key', 'key-1')
      .send({ bookId: BOOK_ID, patronNumber: 'P-00000001' });

    // Assert
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('unauthorized');
    expect(calls).toHaveLength(0);
  });

  it('貸出中の書籍で拒否された場合、409 で契約の文言を返すこと', async () => {
    // Arrange
    const { req } = post(
      decided({
        kind: 'rejected',
        code: 'book_on_loan',
        request: { bookId: BOOK_ID, patronNumber: 'P-00000001' },
        queueStanding: 'not_first',
      }),
    );

    // Act
    const res = await req.send({ bookId: BOOK_ID, patronNumber: 'P-00000001' });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      type: 'https://library.example/problems/book-on-loan',
      title: 'この書籍は貸出中のため貸し出せません',
      status: 409,
      code: 'book_on_loan',
      detail: `書籍 ${BOOK_ID} は貸出中です`,
    });
  });

  it('司書以外が呼んだ場合、403 を返すこと', async () => {
    // Arrange
    const { req } = post({ kind: 'forbidden' });

    // Act
    const res = await req.send({ bookId: BOOK_ID, patronNumber: 'P-00000001' });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('forbidden');
  });

  it('書籍が登録されていない場合、404 を返すこと', async () => {
    // Arrange
    const { req } = post(decided({ kind: 'book_not_found', bookId: BOOK_ID }));

    // Act
    const res = await req.send({ bookId: BOOK_ID, patronNumber: 'P-00000001' });

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('再送で保存済みの応答が返された場合、そのステータスと本文をそのまま返すこと', async () => {
    // Arrange
    const body = '{"type":"x","title":"y","status":409,"code":"book_on_loan"}';
    const { req } = post({ kind: 'replayed', response: { status: 409, body } });

    // Act
    const res = await req.send({ bookId: BOOK_ID, patronNumber: 'P-00000001' });

    // Assert
    expect(res.status).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.text).toBe(body);
  });

  it('同じ Idempotency-Key が別の内容に使われていた場合、409 idempotency_key_conflict を返すこと', async () => {
    // Arrange
    const { req } = post({ kind: 'idempotency_key_conflict', idempotencyKey: 'key-1' });

    // Act
    const res = await req.send({ bookId: BOOK_ID, patronNumber: 'P-00000001' });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('idempotency_key_conflict');
  });

  it('usecase が想定外の例外を投げた場合、500 で内部情報を出さずに返すこと', async () => {
    // Arrange
    const { req } = post(new Error('db connection secret'));

    // Act
    const res = await req.send({ bookId: BOOK_ID, patronNumber: 'P-00000001' });

    // Assert
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});

describe('経路', () => {
  it('提供していない経路の場合、404 を返すこと', async () => {
    // Arrange
    const { app } = post();

    // Act
    const res = await request(app).get('/unknown');

    // Assert
    expect(res.status).toBe(404);
  });

  it('ミドルウェアを渡した場合、経路の前に順に通すこと', async () => {
    // Arrange
    const seen: string[] = [];
    const { usecase } = fakeUsecase(registered);
    const app = createHttpApp({
      registerLoan: usecase,
      tokenVerifier: verifier,
      middlewares: [
        (_req, _res, next) => {
          seen.push('first');
          next();
        },
        (_req, _res, next) => {
          seen.push('second');
          next();
        },
      ],
    });

    // Act
    await request(app).get('/unknown');

    // Assert
    expect(seen).toEqual(['first', 'second']);
  });
});
