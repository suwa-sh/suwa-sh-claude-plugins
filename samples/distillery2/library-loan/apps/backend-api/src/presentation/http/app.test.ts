import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { BookOnHoldForAnotherPatron, VersionConflict } from '../../domain/loan/errors';
import { ForbiddenError, type Principal } from '../../usecase/auth/principal';
import type { RegisterLoanCommand, RegisterLoanResult } from '../../usecase/loan/register-loan';
import { createHttpApp } from './app';

const BODY = { patronNumber: 'P000123', bookId: '11111111-1111-4111-8111-111111111111' };
const staff: Principal = { role: 'staff', subject: 'staff-1' };

function appWith(opts: {
  principal?: Principal | null;
  execute?: (p: Principal, c: RegisterLoanCommand) => Promise<RegisterLoanResult>;
}) {
  const principal = opts.principal === undefined ? staff : opts.principal;
  return createHttpApp({
    authenticator: { authenticate: async () => principal },
    registerLoan: {
      execute:
        opts.execute ??
        (async () => {
          throw new Error('not called');
        }),
    },
    onUnexpectedError: () => undefined,
  });
}

describe('HTTP 入口 POST /api/v1/loans', () => {
  it('アクセストークンが無効な場合、401 の Problem を返すこと', async () => {
    // Arrange
    const app = appWith({ principal: null });

    // Act
    const res = await request(app).post('/api/v1/loans').send(BODY);

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ type: 'https://library.example/problems/unauthorized', title: 'ログインが必要です', status: 401 });
  });

  it('usecase が権限なしと判定した場合、403 の Problem を返すこと', async () => {
    // Arrange
    const app = appWith({
      execute: async () => {
        throw new ForbiddenError();
      },
    });

    // Act
    const res = await request(app).post('/api/v1/loans').send(BODY);

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.type).toBe('https://library.example/problems/forbidden');
  });

  it('取置の書籍を他の利用者に貸し出そうとした場合、409 と code を返すこと', async () => {
    // Arrange
    const app = appWith({
      execute: async () => {
        throw new BookOnHoldForAnotherPatron();
      },
    });

    // Act
    const res = await request(app).post('/api/v1/loans').send(BODY);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'book-on-hold-for-another-patron',
      title: 'この書籍は貸し出せません',
      detail: '指定した書籍は他の利用者のために取置中です',
    });
  });

  it('同じ書籍への同時登録と競合した場合、409 version-conflict を返すこと', async () => {
    // Arrange
    const app = appWith({
      execute: async () => {
        throw new VersionConflict();
      },
    });

    // Act
    const res = await request(app).post('/api/v1/loans').send(BODY);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'version-conflict', type: 'https://library.example/problems/conflict' });
  });

  it('本文が JSON として読めない場合、400 の ValidationProblem を返すこと', async () => {
    // Arrange
    const app = appWith({});

    // Act
    const res = await request(app).post('/api/v1/loans').set('content-type', 'application/json').send('{broken');

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([{ field: 'body', message: 'リクエスト本文を JSON として読み取れません' }]);
  });

  it('想定外の失敗の場合、500 の Problem を返し内部の詳細を出さないこと', async () => {
    // Arrange
    const app = appWith({
      execute: async () => {
        throw new Error('db connection secret');
      },
    });

    // Act
    const res = await request(app).post('/api/v1/loans').send(BODY);

    // Assert
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('契約に無い経路の場合、404 を返すこと', async () => {
    // Arrange
    const app = appWith({});

    // Act
    const res = await request(app).get('/api/v1/unknown');

    // Assert
    expect(res.status).toBe(404);
  });
});
