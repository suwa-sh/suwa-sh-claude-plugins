/**
 * RDB への接続と、トランザクションの受け渡し。
 *
 * repository は呼び出しごとに `client()` で「いま動いているトランザクション (無ければ接続そのもの)」を取る。
 * これで repository を差し替え可能なオブジェクトのまま (traced() で包める形のまま)、usecase の 1 トランザクションに参加させる。
 * pg / pglite 互換の client を受け取る。
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type SqlResult<T> = { rows: T[]; affectedRows?: number };

export interface SqlClient {
  query<T>(sql: string, params?: unknown[]): Promise<SqlResult<T>>;
}

export interface SqlDatabase extends SqlClient {
  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
}

export type DbContext = {
  /** いま動いているトランザクション。トランザクション外なら接続そのもの */
  client(): SqlClient;
  /** fn を 1 トランザクションで実行する。すでにトランザクション内ならそのトランザクションに参加する */
  run<T>(fn: () => Promise<T>): Promise<T>;
};

export function createDbContext(database: SqlDatabase): DbContext {
  const current = new AsyncLocalStorage<SqlClient>();
  return {
    client: () => current.getStore() ?? database,
    run: async <T>(fn: () => Promise<T>): Promise<T> => {
      if (current.getStore()) {
        return fn();
      }
      return database.transaction((tx) => current.run(tx, fn));
    },
  };
}
