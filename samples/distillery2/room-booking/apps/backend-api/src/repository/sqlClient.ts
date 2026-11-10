/**
 * repository が使う SQL の口。pg の Pool / Client と pglite の PGlite がどちらもこの形を満たす。
 * composition root (src/app.ts・src/test-app.ts) が実体を渡す。
 */
export interface SqlClient {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
