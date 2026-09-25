/**
 * データストア (単一の RDB) への接続ポート。pg / pglite 互換のクライアントをそのまま渡せる最小の形にする。
 * repository だけがこれを使って読み書きする (ADR 0004)。
 */
export interface QueryResult<T> {
  rows: T[];
  affectedRows?: number;
}

export interface SqlClient {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface Database extends SqlClient {
  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
}
