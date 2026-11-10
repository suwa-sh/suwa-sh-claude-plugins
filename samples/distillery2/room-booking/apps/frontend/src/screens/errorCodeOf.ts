import type { ErrorCode } from '@repo/ui';

/** エラーの応答に code が無いか、応答を受け取れなかったときに出すコード */
export const FALLBACK_ERROR: ErrorCode = 'INTERNAL_ERROR';

/** エラーの応答 (契約の Problem) から、画面に理由を出すためのエラーのコードを取り出す */
export function errorCodeOf(data: unknown): ErrorCode {
  const code = (data as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? (code as ErrorCode) : FALLBACK_ERROR;
}
