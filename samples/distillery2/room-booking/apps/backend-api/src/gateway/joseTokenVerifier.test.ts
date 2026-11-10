import { afterEach, describe, expect, it } from 'vitest';
import {
  type JwksTestServer,
  startJwksTestServer,
  TEST_AUDIENCE,
  TEST_ISSUER,
  unreachableJwksUri,
} from './jwksTestServer';
import { createJoseTokenVerifier, type GatewayLogger } from './joseTokenVerifier';

function recordingLogger() {
  const lines: { fields: Record<string, unknown>; message: string }[] = [];
  const logger: GatewayLogger = { warn: (fields, message) => lines.push({ fields, message }) };
  return { logger, lines };
}

/** 鍵の一覧はキャッシュされるので、テストごとに新しい検証器を作る */
function verifierFor(jwksUri: string, logger: GatewayLogger = recordingLogger().logger) {
  return createJoseTokenVerifier({ issuer: TEST_ISSUER, audience: TEST_AUDIENCE, jwksUri }, logger);
}

let idp: JwksTestServer | undefined;

afterEach(async () => {
  await idp?.close();
  idp = undefined;
});

describe('本番のアクセストークンの検証器 (トークンが合わないときは null)', () => {
  it('署名と発行者と宛先と期限が合う場合_subを返すこと', async () => {
    // Arrange
    idp = await startJwksTestServer();
    const token = await idp.sign({ sub: 'employee-a' });

    // Act
    const sub = await verifierFor(idp.jwksUri).verify(token);

    // Assert
    expect(sub).toBe('employee-a');
  });

  it('期限が切れている場合_nullを返しトークンを含まない警告のログを出すこと', async () => {
    // Arrange
    idp = await startJwksTestServer();
    const token = await idp.sign(
      { sub: 'employee-a' },
      { expiresAt: Math.floor(Date.now() / 1000) - 60 },
    );
    const { logger, lines } = recordingLogger();

    // Act
    const sub = await verifierFor(idp.jwksUri, logger).verify(token, { correlationId: 'c-1' });

    // Assert
    expect(sub).toBeNull();
    expect(lines).toEqual([
      {
        fields: { correlationId: 'c-1', reason: 'JWTExpired' },
        message: 'アクセストークンを検証できない',
      },
    ]);
  });

  it('発行者が違う場合_nullを返すこと', async () => {
    // Arrange
    idp = await startJwksTestServer();
    const token = await idp.sign({ sub: 'employee-a', iss: 'https://other-idp.example.test/' });

    // Act
    const sub = await verifierFor(idp.jwksUri).verify(token);

    // Assert
    expect(sub).toBeNull();
  });

  it('宛先が違う場合_nullを返すこと', async () => {
    // Arrange
    idp = await startJwksTestServer();
    const token = await idp.sign({ sub: 'employee-a', aud: 'other-api' });

    // Act
    const sub = await verifierFor(idp.jwksUri).verify(token);

    // Assert
    expect(sub).toBeNull();
  });

  it('配っている鍵と違う鍵で署名されている場合_nullを返すこと', async () => {
    // Arrange
    idp = await startJwksTestServer();
    const token = await idp.sign({ sub: 'employee-a' }, { signWithOtherKey: true });

    // Act
    const sub = await verifierFor(idp.jwksUri).verify(token);

    // Assert
    expect(sub).toBeNull();
  });

  it('subが無い場合_nullを返すこと', async () => {
    // Arrange
    idp = await startJwksTestServer();
    const token = await idp.sign({});

    // Act
    const sub = await verifierFor(idp.jwksUri).verify(token);

    // Assert
    expect(sub).toBeNull();
  });

  it('JWTの形でない場合_nullを返すこと', async () => {
    // Arrange
    idp = await startJwksTestServer();

    // Act
    const sub = await verifierFor(idp.jwksUri).verify('not-a-jwt');

    // Assert
    expect(sub).toBeNull();
  });
});

describe('本番のアクセストークンの検証器 (認証基盤の障害は例外)', () => {
  it('認証基盤に届かない場合_例外を投げ警告のログを出すこと', async () => {
    // Arrange
    const signer = await startJwksTestServer();
    const token = await signer.sign({ sub: 'employee-a' });
    await signer.close();
    const { logger, lines } = recordingLogger();
    const verifier = verifierFor(await unreachableJwksUri(), logger);

    // Act
    const result = verifier.verify(token, { correlationId: 'c-2' });

    // Assert
    await expect(result).rejects.toThrow();
    expect(lines).toEqual([
      {
        fields: { correlationId: 'c-2', reason: expect.any(String) },
        message: '認証基盤から鍵の一覧を取れずトークンを検証できない',
      },
    ]);
  });

  it('鍵の一覧の場所が500を返す場合_例外を投げること', async () => {
    // Arrange
    idp = await startJwksTestServer('error');
    const token = await idp.sign({ sub: 'employee-a' });

    // Act
    const result = verifierFor(idp.jwksUri).verify(token);

    // Assert
    await expect(result).rejects.toThrow();
  });

  it('鍵の一覧の場所がJSONでない本文を返す場合_例外を投げること', async () => {
    // Arrange
    idp = await startJwksTestServer('not-json');
    const token = await idp.sign({ sub: 'employee-a' });

    // Act
    const result = verifierFor(idp.jwksUri).verify(token);

    // Assert
    await expect(result).rejects.toThrow();
  });
});
