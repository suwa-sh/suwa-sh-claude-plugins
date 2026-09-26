/**
 * composition.ts — UC BDD 用の composition root の結線 (計装)。
 *
 * backend-api の createTestApp(options) に、計装済みの部品を渡すための options を組み立てる
 * (packages/test-support/README.md「実装者が結線するもの」1)。
 *
 * - presentation: expressScenarioMiddleware (operationId は contract-slice.json から引く)
 * - usecase / repository / gateway: decorate で traced() に通す
 * - DB: SqlDatabase を包み、接続直の query とトランザクション内の query を db.query として記録する
 *
 * frontend ティアの結線 (画面の入口 = tracedFn、API クライアント = asFetch) は FRONTEND_* の placement を使う。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createOperationIdResolver,
  expressScenarioMiddleware,
  type Placement,
  tracePg,
  traced,
} from '@repo/test-support/tracer';
import type { TestAppOptions } from '../../apps/backend-api/src/test-app';

type SqlDatabase = NonNullable<TestAppOptions['database']>;
type Middleware = NonNullable<TestAppOptions['middlewares']>[number];
type Decorate = NonNullable<TestAppOptions['decorate']>;
type Clock = NonNullable<TestAppOptions['clock']>;

export const BACKEND_TIER = 'backend-api';
export const FRONTEND_TIER = 'frontend';

/** 画面の入口関数 (submitLoanCheckout 等) の所属 */
export const FRONTEND_SCREEN: Placement = { tier: FRONTEND_TIER, layer: 'screen' };
/** 画面から backend を呼ぶ API クライアント (生成クライアントの options.fetch) の所属 */
export const FRONTEND_API_CLIENT: Placement = { tier: FRONTEND_TIER, layer: 'api-client' };

const DB_PLACEMENT: Placement = { tier: BACKEND_TIER, layer: 'repository' };
/** DB クライアントの部品名 (as-built のデータストア参加者)。契約レジストリの RDB 契約 id に合わせる */
const DB_COMPONENT = 'library-db';

function loadOperationIdResolver(slug: string) {
  const slicePath = path.join('contracts', 'generated', 'slices', slug, 'contract-slice.json');
  const slice = JSON.parse(fs.readFileSync(slicePath, 'utf8'));
  return createOperationIdResolver(slice);
}

/** SqlDatabase を包み、接続直の query とトランザクション内の query を db.query の span として記録する */
export function traceDatabase(database: SqlDatabase): SqlDatabase {
  type QueryFn = SqlDatabase['query'];
  const direct = tracePg(
    { query: (sql: string, params?: unknown[]) => database.query(sql, params) },
    DB_COMPONENT,
    DB_PLACEMENT,
  );
  return {
    query: ((sql: string, params?: unknown[]) => direct.query(sql, params)) as QueryFn,
    transaction: (fn) =>
      database.transaction((tx) => fn(tracePg(tx as unknown as { query: QueryFn }, DB_COMPONENT, DB_PLACEMENT) as unknown as typeof tx)),
  };
}

const decorate: Decorate = (name, obj, layer) => traced(name, obj, { tier: BACKEND_TIER, layer });

/**
 * createTestApp に渡す計装済みの options。
 * - database: 前提データを入れた DB (計装はここで被せる。前提データの投入と結果の確認は計装しない素の DB で行う)
 * - clock: シナリオの「今日」
 * 認証ヘッダと Idempotency-Key は createTestApp が補わない。画面の入口関数 (submitLoanCheckout 等) が契約どおりに送る。
 */
export function tracedTestAppOptions(slug: string, database: SqlDatabase, clock: Clock): TestAppOptions {
  const scenarioMiddleware = expressScenarioMiddleware({
    resolveOperationId: loadOperationIdResolver(slug),
    placement: { tier: BACKEND_TIER, layer: 'presentation' },
  }) as unknown as Middleware;
  return {
    database: traceDatabase(database),
    seedContractExamples: false,
    clock,
    decorate,
    middlewares: [scenarioMiddleware],
  };
}
