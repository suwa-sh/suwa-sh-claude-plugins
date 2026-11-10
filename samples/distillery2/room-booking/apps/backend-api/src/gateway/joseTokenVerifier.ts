// アクセストークン (JWT) の本番の検証器 (ADR 0015)。署名は発行者が公開する鍵の一覧で確かめ、
// 発行者 (iss)・宛先 (aud)・期限 (exp) を検証する。業務の値への変換は呼ぶ側 (presentation) が行う。
// トークンが合わない (検証できない) ときは null を返し、呼ぶ側が 401 にする。
// 認証基盤に届かない・鍵の一覧を取れない・鍵の一覧が壊れているなどの障害は、トークンの誤りではないので
// 例外のまま投げ、呼ぶ側の共通の処理がシステムのエラー (500) にする (ADR 0023)。
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';

export interface JoseTokenVerifierConfig {
  /** 発行者 (iss) */
  issuer: string;
  /** 宛先 (aud) */
  audience: string;
  /** 発行者が公開する鍵の一覧の場所 */
  jwksUri: string;
}

/** gateway の警告の口 (ADR 0011: 外部とのやり取りの失敗は warn) */
export interface GatewayLogger {
  warn(fields: Record<string, unknown>, message: string): void;
}

/**
 * トークンそのものが合わないことを表す jose のエラーのコード (401 にするもの)。
 * 署名・形・アルゴリズム・鍵の ID がトークンと合わない、発行者・宛先・期限・必須の項目 (sub・exp) が合わない。
 * ここに無いエラー (鍵の一覧の取得の失敗・時間切れ・鍵の一覧が壊れている・通信の失敗・想定外) は障害として投げる
 */
const TOKEN_REJECTION_CODES: ReadonlySet<string> = new Set([
  errors.JWTExpired.code,
  errors.JWTClaimValidationFailed.code,
  errors.JWTInvalid.code,
  errors.JWSInvalid.code,
  errors.JWSSignatureVerificationFailed.code,
  errors.JOSEAlgNotAllowed.code,
  errors.JOSENotSupported.code,
  errors.JWKSNoMatchingKey.code,
  errors.JWKSMultipleMatchingKeys.code,
]);

function isTokenRejection(error: unknown): boolean {
  return error instanceof errors.JOSEError && TOKEN_REJECTION_CODES.has(error.code);
}

/** 検証できたら sub を返し、トークンが合わない・sub が無いなら null を返す。認証基盤の障害は例外を投げる */
export function createJoseTokenVerifier(config: JoseTokenVerifierConfig, logger: GatewayLogger) {
  const keys = createRemoteJWKSet(new URL(config.jwksUri));
  return {
    async verify(
      token: string,
      context: { correlationId?: string; handler?: string } = {},
    ): Promise<string | null> {
      try {
        const { payload } = await jwtVerify(token, keys, {
          issuer: config.issuer,
          audience: config.audience,
          requiredClaims: ['exp', 'sub'],
        });
        return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
      } catch (e) {
        const reason = e instanceof Error ? e.name : 'unknown';
        // トークンそのものはログに出さない (ADR 0011)
        if (isTokenRejection(e)) {
          logger.warn({ ...context, reason }, 'アクセストークンを検証できない');
          return null;
        }
        logger.warn({ ...context, reason }, '認証基盤から鍵の一覧を取れずトークンを検証できない');
        throw e;
      }
    },
  };
}
