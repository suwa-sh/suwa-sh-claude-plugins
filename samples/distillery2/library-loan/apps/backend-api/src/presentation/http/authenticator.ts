import type { Principal } from '../../usecase/auth/principal';

/**
 * アクセストークン (Bearer) を検証し、操作者を取り出す (ADR 0006: アプリはトークンの検証だけを担う)。
 * 無い・無効なら null を返し、presentation は 401 を返す。
 */
export interface Authenticator {
  authenticate(authorizationHeader: string | undefined): Promise<Principal | null>;
}
