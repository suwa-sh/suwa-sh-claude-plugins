/**
 * scenario-db.ts — UC BDD / 受入のシナリオ隔離 DB と、テスト用 composition root の結線 (d2-implement mode=integrate)
 *
 * - 埋め込み Postgres (PGlite) はプロセスで 1 つだけ起動し、migration を 1 回当てる (PgHarness.start)
 * - 各シナリオは 1 つのトランザクションの中で実行し、After で必ず rollback する
 *   (トランザクションを After まで開いたままにするため、PgHarness.withRollback ではなく pg.transaction を直接使う)
 * - アプリには savepointClient(tx) で包んだ DB を渡す。PGlite は入れ子の transaction を持てないため
 *   (backend-api 実装者からの申し送り)
 * - 計装: setTier('backend-api')、expressScenarioMiddleware (operationId は contract-slice から解決)、
 *   tracePg(DB, 'PgLoanRegistrationRepository') を結線する。step 側の準備・確認用クエリはトレースしない
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { PgHarness } from '@repo/test-support/pglite-harness';
import {
  createOperationIdResolver,
  expressScenarioMiddleware,
  setTier,
  tracePg,
} from '@repo/test-support/tracer';
import { savepointClient, type SqlQueryable } from '../../apps/backend-api/src/gateway/db/sql-client';
import { createTestApp, type TestApp } from '../../apps/backend-api/src/test-app';

const PROVIDER_TIER = 'backend-api';

let harness: PgHarness | undefined;
let harnessReady: Promise<PgHarness> | undefined;

/** プロセスで 1 つの PGlite を起動し migration を当てる。 */
async function sharedHarness(): Promise<PgHarness> {
  if (!harnessReady) {
    harness = new PgHarness({ datastoreOwner: process.env.D2_DATASTORE_OWNER || PROVIDER_TIER });
    const h = harness;
    harnessReady = h.start().then(() => h);
  }
  return harnessReady;
}

export async function stopSharedHarness(): Promise<void> {
  if (harness) await harness.stop();
  harness = undefined;
  harnessReady = undefined;
}

const resolverCache = new Map<string, (method: string, path: string) => string | undefined>();

function operationIdResolver(ucSlug: string) {
  let r = resolverCache.get(ucSlug);
  if (!r) {
    const file = `contracts/generated/slices/${ucSlug}/contract-slice.json`;
    const slice = JSON.parse(readFileSync(file, 'utf8'));
    r = createOperationIdResolver(slice);
    resolverCache.set(ucSlug, r);
  }
  return r;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 1 シナリオ分の隔離 DB とアプリ。 */
export class ScenarioContext {
  /** step の準備・確認に使う DB (トランザクション内。トレースしない) */
  readonly db: SqlQueryable;
  /** 計装済みのアプリ (supertest に渡す) */
  readonly listener: RequestListener;
  readonly app: TestApp;
  private readonly release: () => void;
  private readonly done: Promise<void>;

  private constructor(db: SqlQueryable, app: TestApp, listener: RequestListener, release: () => void, done: Promise<void>) {
    this.db = db;
    this.app = app;
    this.listener = listener;
    this.release = release;
    this.done = done;
  }

  static async open(ucSlug: string): Promise<ScenarioContext> {
    const h = await sharedHarness();
    const sentinel = Symbol('rollback');
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let onTx!: (tx: SqlQueryable) => void;
    const txReady = new Promise<SqlQueryable>((resolve) => {
      onTx = resolve;
    });
    const done = h.pg
      .transaction(async (tx) => {
        onTx(tx as unknown as SqlQueryable);
        await released;
        throw sentinel; // 必ず rollback する
      })
      .then(
        () => undefined,
        (e: unknown) => {
          if (e !== sentinel) throw e;
        },
      );
    const tx = await Promise.race([
      txReady,
      done.then(() => {
        throw new Error('scenario transaction ended before it was opened');
      }),
    ]);

    // アプリが発行するクエリだけを計装する (step の準備・確認用クエリと区別するため別オブジェクトで包む)
    const appQueryable = tracePg(
      { query: (sql: string, params?: unknown[]) => tx.query(sql, params) } as SqlQueryable & {
        query(text: string, params?: unknown[]): Promise<unknown>;
      },
      'PgLoanRegistrationRepository',
    );
    const app = createTestApp({ db: savepointClient(appQueryable), seedContractFixture: false });
    await app.ready;

    setTier(PROVIDER_TIER);
    const middleware = expressScenarioMiddleware({ resolveOperationId: operationIdResolver(ucSlug) });
    const listener: RequestListener = (req: IncomingMessage, res: ServerResponse) => {
      // api ドライバは x-scenario-id を URI エンコードして送る (非 ASCII のシナリオ名をヘッダに載せるため)
      const raw = req.headers['x-scenario-id'];
      if (typeof raw === 'string') req.headers['x-scenario-id'] = safeDecode(raw);
      middleware(req as unknown as Parameters<typeof middleware>[0], res, () => app(req, res));
    };
    return new ScenarioContext(tx, app, listener, release, done);
  }

  /** トランザクションを rollback して閉じる。 */
  async close(): Promise<void> {
    this.release();
    await this.done;
  }
}
