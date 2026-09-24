import type { Principal } from '../usecase/auth/principal';

/**
 * テスト用の認証。OIDC のトークン検証の代わりに使う (本番では使わない)。
 * - Authorization ヘッダが無いときは既定の操作者 (司書) とみなす。契約テストは認証ヘッダを送らないため (AssumptionRecord A-005)
 * - `Bearer test-staff:<subject>` は司書、`Bearer test-patron:<利用者番号>` は利用者
 * - それ以外のトークンは無効 (401)
 */
export class TestAuthenticator {
  private defaultPrincipal: Principal | null = { role: 'staff', subject: 'test-staff' };

  /** ヘッダが無いときの操作者を差し替える。null ならヘッダなしは 401 になる。 */
  setDefaultPrincipal(principal: Principal | null): void {
    this.defaultPrincipal = principal;
  }

  async authenticate(authorizationHeader: string | undefined): Promise<Principal | null> {
    if (authorizationHeader === undefined) return this.defaultPrincipal;
    const m = /^Bearer test-(staff|patron):(\S+)$/.exec(authorizationHeader);
    if (!m) return null;
    const [, role, value] = m as unknown as [string, 'staff' | 'patron', string];
    return role === 'staff' ? { role, subject: value } : { role, subject: `test-patron-${value}`, patronNumber: value };
  }
}
