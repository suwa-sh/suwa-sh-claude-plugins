/**
 * テスト用の composition root。契約テスト (test/contract/) と UC BDD の API ドライバ (features/support/drivers/api.ts) が
 * 同じ入口を使う。supertest に渡せる RequestListener を同期で返す (DB の準備はリクエスト時に待つ)。
 *
 * 引数なしで呼ぶと、使い捨ての PGlite を起動して migration を当て、契約の例が前提にする fixture を投入する。
 * 計装 (tracer) の結線は integrate 段階で行う。
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { FixedClock } from './gateway/clock/clocks';
import type { SqlClient } from './gateway/db/sql-client';
import { InMemoryAccessLog } from './gateway/log/access-log-writers';
import type { Authenticator } from './presentation/http/authenticator';
import { createHttpApp } from './presentation/http/app';
import { PgLoanRegistrationRepository } from './repository/loan/pg-loan-registration-repository';
import { seedContractFixture } from './testing/contract-fixture';
import { TestAuthenticator } from './testing/test-authenticator';
import { RegisterLoan } from './usecase/loan/register-loan';

/** シナリオの背景「本日は "2026-10-01" である」と契約の 201 例の貸出日 */
export const DEFAULT_BUSINESS_DATE = '2026-10-01';

export interface TestAppDeps {
  /** 使う DB。省略時は使い捨ての PGlite を起動し migration を当てる */
  db?: SqlClient;
  /** 契約 fixture を投入するか。既定は db 省略時だけ true */
  seedContractFixture?: boolean;
  /** 業務日付。既定 2026-10-01 */
  businessDate?: string;
  authenticator?: Authenticator;
  /** 経路の接頭辞。契約テストは '/loans' を直接叩くため既定は '' */
  basePath?: string;
  newId?: () => string;
}

export type TestApp = RequestListener & {
  /** DB の準備 (migration と fixture) の完了 */
  ready: Promise<void>;
  db: SqlClient;
  clock: FixedClock;
  accessLog: InMemoryAccessLog;
  auth: TestAuthenticator;
};

const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url));

/** migration の正本 (apps/backend-api/migrations/*.sql) を名前順に当てる。 */
export async function applyMigrations(pg: PGlite): Promise<void> {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await pg.exec(readFileSync(`${migrationsDir}${file}`, 'utf8'));
  }
}

export function createTestApp(deps: TestAppDeps = {}): TestApp {
  const ownedPg = deps.db === undefined ? new PGlite() : undefined;
  const db: SqlClient = deps.db ?? (ownedPg as PGlite);
  const seed = deps.seedContractFixture ?? ownedPg !== undefined;
  const ready = (async () => {
    if (ownedPg) await applyMigrations(ownedPg);
    if (seed) await seedContractFixture(db);
  })();
  // 失敗はリクエスト時に 500 として返す。未処理の reject としては扱わない
  ready.catch(() => undefined);

  const clock = new FixedClock(deps.businessDate ?? DEFAULT_BUSINESS_DATE);
  const accessLog = new InMemoryAccessLog();
  const auth = new TestAuthenticator();
  const newId = deps.newId ?? randomUUID;
  const registerLoan = new RegisterLoan({
    repository: new PgLoanRegistrationRepository(db, newId),
    clock,
    accessLog,
    newId,
  });
  const http = createHttpApp({
    authenticator: deps.authenticator ?? auth,
    registerLoan,
    basePath: deps.basePath ?? '',
  });

  const listener = (req: IncomingMessage, res: ServerResponse) => {
    ready.then(
      () => http(req, res),
      (e: unknown) => {
        res.statusCode = 500;
        res.end(`test app failed to start: ${String(e)}`);
      },
    );
  };
  return Object.assign(listener, { ready, db, clock, accessLog, auth });
}
