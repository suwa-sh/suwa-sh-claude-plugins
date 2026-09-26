/**
 * テスト用の composition root。契約テスト (test/contract/) と UC BDD の api ドライバが同じ入口 createTestApp() を使う。
 *
 * - DB: 引数で渡さなければ pglite を起動し、migrations/ を当て、契約 examples の前提データを入れる
 * - 時計: 既定で 2026-10-01 09:00 (Asia/Tokyo) に固定する (契約 example の loanedOn とシナリオの「今日」)
 * - IdP: in-memory のトークン表 (TEST_TOKENS) に差し替える
 * - 既定ヘッダ: 契約テストは Authorization / Idempotency-Key を送らないため、無いときだけ司書のトークンと
 *   新しい Idempotency-Key を補う (`defaultHeaders: false` で無効化できる)。本番の入口 (createApp) は補わない
 * - 計装: integrate 段階が `decorate` と `middlewares` を渡して結線する
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PgHarness } from '@repo/test-support/pglite-harness';
import { type AppDeps, createApp } from './app';
import { createInMemoryTokenVerifier } from './gateway/in-memory-token-verifier';
import { fixedClock } from './gateway/system';
import type { RequestListener } from './presentation/http-app';
import type { SqlDatabase } from './repository/db-context';
import { seedContractExamples } from './test-fixtures/contract-examples';

export const TEST_NOW = new Date('2026-10-01T09:00:00+09:00');

export const TEST_TOKENS = {
  librarian: 'test-librarian-token',
  patron: 'test-patron-token',
} as const;

export const TEST_PRINCIPALS = {
  [TEST_TOKENS.librarian]: { subject: 'test-librarian', role: 'librarian' as const },
  [TEST_TOKENS.patron]: {
    subject: 'test-patron',
    role: 'patron' as const,
    patronNumber: 'P-00000001',
  },
};

export type TestAppOptions = Partial<AppDeps> & {
  /** 契約 examples の前提データを入れるか (既定: database を渡さないとき true) */
  seedContractExamples?: boolean;
  /** Authorization / Idempotency-Key が無い要求に既定値を補うか (既定 true) */
  defaultHeaders?: boolean;
};

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

/** migrations/ を当てた使い捨ての pglite を起動する */
export async function startTestDatabase(): Promise<SqlDatabase> {
  const harness = new PgHarness({ migrationsDir: MIGRATIONS_DIR });
  await harness.start();
  return harness.pg;
}

function withDefaultHeaders(listener: RequestListener): RequestListener {
  return (req, res) => {
    if (req.headers.authorization === undefined) {
      req.headers.authorization = `Bearer ${TEST_TOKENS.librarian}`;
    }
    if (req.headers['idempotency-key'] === undefined) {
      req.headers['idempotency-key'] = randomUUID();
    }
    listener(req, res);
  };
}

export async function createTestApp(options: TestAppOptions = {}): Promise<RequestListener> {
  const { seedContractExamples: seedOption, defaultHeaders = true, ...deps } = options;
  const database = deps.database ?? (await startTestDatabase());
  if (seedOption ?? deps.database === undefined) {
    await seedContractExamples(database);
  }
  const app = createApp({
    ...deps,
    database,
    tokenVerifier: deps.tokenVerifier ?? createInMemoryTokenVerifier(TEST_PRINCIPALS),
    clock: deps.clock ?? fixedClock(TEST_NOW),
  });
  return defaultHeaders ? withDefaultHeaders(app) : app;
}
