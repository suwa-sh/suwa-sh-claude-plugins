// テスト用のトークンの検証器。テストの composition root (src/test-app.ts) だけが渡す (ADR 0006)。
// 契約の bearerAuth の説明どおり、Bearer test-employee-<社員> を社員の sub employee-<社員> に対応させる。
// 本番の入口 (src/app.ts) はこれを使わない。
const TEST_TOKEN_PREFIX = 'test-employee-';

export function createTestTokenVerifier() {
  return {
    async verify(token: string): Promise<string | null> {
      if (!token.startsWith(TEST_TOKEN_PREFIX)) return null;
      const who = token.slice(TEST_TOKEN_PREFIX.length);
      return who.length > 0 ? `employee-${who}` : null;
    },
  };
}
