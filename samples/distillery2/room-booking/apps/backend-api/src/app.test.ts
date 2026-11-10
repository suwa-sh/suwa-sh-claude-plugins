import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { createJoseTokenVerifier } from './gateway/joseTokenVerifier';
import {
  type JwksTestServer,
  startJwksTestServer,
  TEST_AUDIENCE,
  TEST_ISSUER,
  unreachableJwksUri,
} from './gateway/jwksTestServer';
import type { AppLogger } from './presentation/httpApp';
import type { SqlClient } from './repository/sqlClient';

const PATH = '/api/room-availability';
const BODY = { startAt: '2026-11-10T10:00:00+09:00', endAt: '2026-11-10T11:00:00+09:00' };

const silentLogger: AppLogger = { info: () => {}, warn: () => {}, error: () => {} };

/** 認証で止まる要求は DB を読まない。読んだらテストを落とす */
const untouchableDb: SqlClient = {
  query: async () => {
    throw new Error('認証で止まる要求で DB を読んだ');
  },
};

/** 本番の検証器を組み込んだ app (DB 以外は本番と同じ結線) */
function appWithJoseVerifier(jwksUri: string) {
  const tokenVerifier = createJoseTokenVerifier(
    { issuer: TEST_ISSUER, audience: TEST_AUDIENCE, jwksUri },
    silentLogger,
  );
  return buildApp({ db: untouchableDb, tokenVerifier, logger: silentLogger });
}

let idp: JwksTestServer | undefined;

afterEach(async () => {
  await idp?.close();
  idp = undefined;
});

describe('本番の検証器を組み込んだ空き状況の照会の入口', () => {
  it('認証基盤に届かない場合_401でなく500のINTERNAL_ERRORを返すこと', async () => {
    // Arrange
    const signer = await startJwksTestServer();
    const token = await signer.sign({ sub: 'employee-a' });
    await signer.close();
    const app = appWithJoseVerifier(await unreachableJwksUri());

    // Act
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`).send(BODY);

    // Assert
    expect([res.status, res.body.code]).toEqual([500, 'INTERNAL_ERROR']);
  });

  it('期限の切れたトークンの場合_401のUNAUTHENTICATEDを返すこと', async () => {
    // Arrange
    idp = await startJwksTestServer();
    const token = await idp.sign(
      { sub: 'employee-a' },
      { expiresAt: Math.floor(Date.now() / 1000) - 60 },
    );
    const app = appWithJoseVerifier(idp.jwksUri);

    // Act
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`).send(BODY);

    // Assert
    expect([res.status, res.body.code]).toEqual([401, 'UNAUTHENTICATED']);
  });
});
