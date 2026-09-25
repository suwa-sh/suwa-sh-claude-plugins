/**
 * テスト用 composition root。契約テスト (test/contract/) と UC BDD の API ドライバが同じ入口を使う。
 *
 * - DB を渡さなければ、使い捨ての pglite を起動して migration と契約 examples の前提データを入れる
 * - 認証基盤は in-memory の偽物に差し替える (ADR 0007)。既定は司書 lib1 としてログイン済み
 * - Clock は固定する (既定 2026-09-01)
 * - usecase / repository は decorate で包める (integrate 段階が traced() を渡す)
 *
 * 同期で request listener を返す (API ドライバが `createTestApp()` をそのまま supertest に渡すため)。
 * DB の準備は最初の要求で待つ。
 */
import { readdirSync, readFileSync } from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createApp, type Decorate } from './app';
import type { Clock, IdGenerator } from './domain/shared/clock';
import { FixedClock, RandomUuidGenerator } from './gateway/clock';
import type { Database, QueryResult, SqlClient } from './gateway/database';
import type { Authenticator, Middleware, RequestListener } from './presentation/http/server';
import { fixtureIds, seedContractFixtures } from './testing/contractFixtures';
import type { Principal } from './usecase/shared/principal';

export { fixtureIds, fixturePatronNumbers } from './testing/contractFixtures';

export const DEFAULT_TEST_DATE = '2026-09-01';
export const DEFAULT_LIBRARIAN: Principal = {
  role: 'librarian',
  librarianId: fixtureIds.librarian,
};

export interface TestAppOptions {
  /** 既存の DB (例: PgHarness.pg)。省略時は新しい pglite に migration と前提データを入れる */
  db?: Database | Promise<Database>;
  /** db を省略したとき、契約 examples の前提データを入れるか (既定 true) */
  seed?: boolean;
  clock?: Clock;
  ids?: IdGenerator;
  /** Bearer トークン → 操作主体 の対応表 (偽の認証基盤) */
  tokens?: Record<string, Principal>;
  /** Authorization ヘッダが無い要求の主体。null なら 401 (既定は司書 lib1) */
  defaultPrincipal?: Principal | null;
  /** 認証基盤そのものを差し替える場合 */
  authenticate?: Authenticator;
  decorate?: Decorate;
  middlewares?: Middleware[];
}

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

export async function applyMigrations(
  db: SqlClient & { exec?: (sql: string) => Promise<unknown> },
) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS_DIR}${file}`, 'utf8');
    if (db.exec) await db.exec(sql);
    else await db.query(sql);
  }
}

async function startEmbeddedDatabase(seed: boolean): Promise<Database> {
  const pg = new PGlite();
  await pg.waitReady;
  await applyMigrations(pg);
  if (seed) await seedContractFixtures(pg);
  return pg as unknown as Database;
}

/** DB の準備が終わるまで各呼び出しを待たせる Database */
function deferredDatabase(ready: Promise<Database>): Database {
  return {
    async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
      return (await ready).query<T>(sql, params);
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      return (await ready).transaction(fn);
    },
  };
}

export function fakeAuthenticator(
  tokens: Record<string, Principal>,
  defaultPrincipal: Principal | null,
): Authenticator {
  return async (headers: IncomingHttpHeaders) => {
    const header = headers.authorization;
    if (header === undefined) return defaultPrincipal;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match?.[1]) return null;
    return tokens[match[1]] ?? null;
  };
}

export function createTestApp(options: TestAppOptions = {}): RequestListener {
  const ready = options.db
    ? Promise.resolve(options.db)
    : startEmbeddedDatabase(options.seed ?? true);
  // 未処理の reject を避ける (失敗は最初の要求で 500 として表に出る)
  ready.catch(() => undefined);

  const defaultPrincipal =
    options.defaultPrincipal === undefined ? DEFAULT_LIBRARIAN : options.defaultPrincipal;
  return createApp({
    db: deferredDatabase(ready),
    clock: options.clock ?? FixedClock.onDate(DEFAULT_TEST_DATE),
    ids: options.ids ?? new RandomUuidGenerator(),
    authenticate: options.authenticate ?? fakeAuthenticator(options.tokens ?? {}, defaultPrincipal),
    decorate: options.decorate,
    middlewares: options.middlewares,
  });
}
