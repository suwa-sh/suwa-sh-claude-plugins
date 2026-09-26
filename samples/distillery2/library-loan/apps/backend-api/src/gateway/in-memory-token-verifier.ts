/**
 * IdP のアクセストークン検証の in-memory 実装 (ADR 0007: IdP はテスト用の in-memory 実装に差し替える)。
 * トークン文字列と主体の対応表で検証する。OIDC の署名検証を行う本番実装は別 UC (認証基盤) で用意する。
 */
type Role = 'librarian' | 'patron';
type Principal = { subject: string; role: Role; patronNumber?: string };

export function createInMemoryTokenVerifier(tokens: Record<string, Principal>) {
  const table = new Map(Object.entries(tokens));
  return {
    async verify(token: string): Promise<Principal | null> {
      return table.get(token) ?? null;
    },
  };
}
