import { currentPath, type TokenProvider } from './tokenProvider';

/** 401 (UNAUTHENTICATED) の HTTP の status */
const UNAUTHORIZED = 401;

/**
 * 生成クライアントの options.fetch を包み、Authorization ヘッダ (Bearer) を 1 回だけ付ける (ADR 0014 / 0021)。
 * API が 401 を返したら、トークンの供給元のサインインを呼んで認証基盤のサインインへ戻す (画面ごとに 401 を扱わない)。
 */
export function authorizedFetch(tokens: TokenProvider, base: typeof fetch = fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const token = await tokens.getAccessToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
    const res = await base(input, { ...init, headers });
    if (res.status === UNAUTHORIZED) await tokens.signIn(currentPath());
    return res;
  }) as typeof fetch;
}
