/**
 * RDB クライアントの最小インターフェイス。PGlite (テスト) と PostgreSQL ドライバ (本番) の差を吸収する。
 * PGlite はこの形を構造的に満たすので、そのまま渡せる。
 */
export interface SqlQueryable {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface SqlClient extends SqlQueryable {
  transaction<T>(fn: (tx: SqlQueryable) => Promise<T>): Promise<T>;
}

let savepointSeq = 0;

/**
 * すでに開いているトランザクション (テストのシナリオ隔離など) の中で使う SqlClient。
 * transaction() を SAVEPOINT で表し、失敗時はその SAVEPOINT まで巻き戻す。
 */
export function savepointClient(tx: SqlQueryable): SqlClient {
  return {
    query: (sql, params) => tx.query(sql, params),
    async transaction<T>(fn: (inner: SqlQueryable) => Promise<T>): Promise<T> {
      const name = `sp_${++savepointSeq}`;
      await tx.query(`SAVEPOINT ${name}`);
      try {
        const result = await fn(tx);
        await tx.query(`RELEASE SAVEPOINT ${name}`);
        return result;
      } catch (e) {
        await tx.query(`ROLLBACK TO SAVEPOINT ${name}`);
        throw e;
      }
    },
  };
}
