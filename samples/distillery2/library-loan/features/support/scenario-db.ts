/**
 * scenario-db.ts — UC BDD / 受入のシナリオ隔離 DB と、テスト用 composition root の結線 (d2-implement mode=integrate)
 *
 * - 埋め込み Postgres (PGlite) はプロセスで 1 つだけ起動し、migration を 1 回当てる (PgHarness.start)
 * - 各シナリオは 1 つのトランザクションの中で実行し、After で必ず rollback する
 *   (トランザクションを After まで開いたままにするため、PgHarness.withRollback ではなく pg.transaction を直接使う)
 * - アプリには savepointClient(tx) で包んだ DB を渡す。PGlite は入れ子の transaction を持てないため
 *   (backend-api 実装者からの申し送り)
 * - 計装: expressScenarioMiddleware (presentation。operationId は contract-slice から解決)、createTestApp の decorate フックで
 *   usecase / repository / gateway を traced() で包み、tracePg(DB, 'PgLoanRegistrationRepository') を結線する。
 *   すべて placement { tier: 'backend-api', layer } 付き (frontend-staff と同一プロセスで動くため)。
 *   step 側の準備・確認用クエリはトレースしない
 * - アプリは契約の servers[0].url に合わせて /api/v1 配下で配信する (frontend-staff の画面が呼ぶパス)
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { PgHarness } from '@repo/test-support/pglite-harness';
import {
  createOperationIdResolver,
  expressScenarioMiddleware,
  traced,
  tracePg,
} from '@repo/test-support/tracer';
import { savepointClient, type SqlQueryable } from '../../apps/backend-api/src/gateway/db/sql-client';
import { createTestApp, type TestApp } from '../../apps/backend-api/src/test-app';

const PROVIDER_TIER = 'backend-api';
/** 契約の servers[0].url。frontend-staff の API クライアントはこの接頭辞付きで呼ぶ */
const BASE_PATH = '/api/v1';

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
      { tier: PROVIDER_TIER, layer: 'repository' },
    );
    const app = createTestApp({
      db: savepointClient(appQueryable),
      seedContractFixture: false,
      basePath: BASE_PATH,
      decorate: (name, obj, layer) => traced(name, obj, { tier: PROVIDER_TIER, layer }),
    });
    await app.ready;

    const resolve = operationIdResolver(ucSlug);
    const middleware = expressScenarioMiddleware({
      // 契約の paths は接頭辞無し (/loans) なので、解決前に basePath を外す
      resolveOperationId: (method, path) => resolve(method, path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) : path),
      placement: { tier: PROVIDER_TIER, layer: 'presentation' },
    });
    const listener: RequestListener = (req: IncomingMessage, res: ServerResponse) => {
      // x-scenario-id / x-scenario-span は middleware が読む (URI エンコードされたシナリオ名も復号する)
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
