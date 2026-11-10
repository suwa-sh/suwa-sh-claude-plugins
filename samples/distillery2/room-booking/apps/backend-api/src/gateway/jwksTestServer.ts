// 単体テスト用の認証基盤の代わり。127.0.0.1 の空いた port で鍵の一覧 (JWKS) を実際の HTTP で配り、
// その鍵でアクセストークンを発行する (testing.md: 外部との境界はモックでなく実体で確かめる)。本番のコードから使わない。
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';

export const TEST_ISSUER = 'https://idp.example.test/';
export const TEST_AUDIENCE = 'rooms-api';
const ALG = 'ES256';
const KID = 'test-key-1';

/** 鍵の一覧の応答の仕方。ok = 鍵の一覧を返す / error = 500 を返す / not-json = JSON でない本文を返す */
export type JwksMode = 'ok' | 'error' | 'not-json';

export interface JwksTestServer {
  jwksUri: string;
  /** 配っている鍵でトークンを作る。payload の既定は sub・iss・aud・1 時間後の exp */
  sign(
    payload?: JWTPayload,
    options?: { expiresAt?: number; signWithOtherKey?: boolean },
  ): Promise<string>;
  close(): Promise<void>;
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
}

export async function startJwksTestServer(mode: JwksMode = 'ok'): Promise<JwksTestServer> {
  const { publicKey, privateKey } = await generateKeyPair(ALG);
  const other = await generateKeyPair(ALG);
  const jwk = { ...(await exportJWK(publicKey)), kid: KID, alg: ALG, use: 'sig' };
  const server = createServer((_req, res) => {
    if (mode === 'error') {
      res.writeHead(500).end();
      return;
    }
    if (mode === 'not-json') {
      res.writeHead(200, { 'content-type': 'application/json' }).end('<html>maintenance</html>');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ keys: [jwk] }));
  });
  const port = await listen(server);
  return {
    jwksUri: `http://127.0.0.1:${port}/jwks.json`,
    async sign(payload = { sub: 'employee-a' }, options = {}) {
      const jwt = new SignJWT({ iss: TEST_ISSUER, aud: TEST_AUDIENCE, ...payload })
        .setProtectedHeader({ alg: ALG, kid: KID })
        .setExpirationTime(options.expiresAt ?? Math.floor(Date.now() / 1000) + 3600);
      return jwt.sign(options.signWithOtherKey ? other.privateKey : privateKey);
    },
    close: () => closeServer(server),
  };
}

/** 接続を断られる (認証基盤に届かない) 鍵の一覧の場所。一度開いて閉じた port を返す */
export async function unreachableJwksUri(): Promise<string> {
  const server = createServer();
  const port = await listen(server);
  await closeServer(server);
  return `http://127.0.0.1:${port}/jwks.json`;
}
