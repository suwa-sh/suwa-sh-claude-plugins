/**
 * datastore.ts — UC BDD 用の埋め込み DB (pglite) と、backend-api に渡す計装つき Database。
 *
 * - PgHarness で 1 プロセスに 1 つだけ起動し、migration を 1 回当てる (README の結線契約 4)
 * - シナリオ間の隔離は全テーブルの TRUNCATE (backend-api の usecase が自前でトランザクションを張るため、
 *   PgHarness.withRollback の入れ子にはできない)
 * - 前提データの投入と Then の観測は raw の pg で行い、トレースに載せない (図に出すのはアプリの DB アクセスだけ)
 * - アプリに渡す Database は query / transaction 内の query を tracePg で包む (tier: backend-api, layer: gateway)
 */
import type { PGlite } from '@electric-sql/pglite';
import { PgHarness } from '@repo/test-support/pglite-harness';
import { type Placement, tracePg } from '@repo/test-support/tracer';
import type { Database, QueryResult, SqlClient } from '../../apps/backend-api/src/gateway/database';

let harness: Promise<PgHarness> | undefined;

/** 埋め込み DB を 1 度だけ起動して migration を当てる。 */
export function startDatastore(): Promise<PGlite> {
  if (!harness) {
    process.env.D2_DATASTORE_OWNER ??= 'backend-api';
    const h = new PgHarness();
    harness = h.start().then(() => h);
  }
  return harness.then((h) => h.pg);
}

/** public スキーマの全テーブルを空にする (シナリオ間の隔離)。 */
export async function resetDatastore(): Promise<void> {
  const pg = await startDatastore();
  const { rows } = await pg.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  if (rows.length === 0) return;
  await pg.exec(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
}

type RawQuery = (sql: string, params?: unknown[]) => Promise<unknown>;

function tracedClient(query: RawQuery, placement: Placement): SqlClient {
  const client = tracePg({ query }, 'Database', placement);
  return {
    query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
      return client.query(sql, params) as Promise<QueryResult<T>>;
    },
  };
}

/** backend-api の composition root に渡す Database。すべての SQL を db.query として記録する。 */
export function tracedDatabase(pg: PGlite, placement: Placement): Database {
  const top = tracedClient((sql, params) => pg.query(sql, params), placement);
  return {
    query: (sql, params) => top.query(sql, params),
    transaction: (fn) =>
      pg.transaction((tx) => fn(tracedClient((sql, params) => tx.query(sql, params), placement))),
  };
}
