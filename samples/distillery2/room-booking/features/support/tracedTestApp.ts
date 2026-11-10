/**
 * tracedTestApp.ts — UC BDD / 受入の API ドライバが使う、計装済みのテスト用 composition root (d2-implement mode=integrate)
 *
 * backend のテスト用の入口 `createTestApp` (apps/backend-api/src/test-app.ts) をそのまま使い、
 * packages/test-support/README.md の結線契約どおりに計装だけを足す。ティア実装は tracer を知らない。
 * - 最初に expressScenarioMiddleware (layer presentation) を通す。operationId は契約の slice の paths から引く
 * - 各層の境界オブジェクト (usecase / repository / gateway) を decorate で traced() に通す
 * - DB クライアントは tracePg で包む。前提のデータを入れる step の SQL (World の this.db) はトレースに載せないよう、
 *   pglite 本体ではなく query だけを委ねる別のオブジェクトを包む
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import express from 'express';
import type { PGlite } from '@electric-sql/pglite';
import type { Clock } from '@repo/test-support/clock';
import {
  createOperationIdResolver,
  expressScenarioMiddleware,
  traced,
  tracePg,
} from '@repo/test-support/tracer';
import type { Decorate } from '../../apps/backend-api/src/app';
import type { SqlClient } from '../../apps/backend-api/src/repository/sqlClient';
import { createTestApp } from '../../apps/backend-api/src/test-app';

/** backend のティア (.distillery/config.yaml の tiers[].id) */
const BACKEND_TIER = 'backend-api';

type PathsMap = Record<string, Record<string, { operationId?: string }>>;

/** contracts/generated/slices/<uc>/contract-slice.json の openapi.paths を全 UC 分まとめる (cucumber はリポのルートで回る) */
function loadSlicePaths(root = process.cwd()): PathsMap {
  const dir = path.join(root, 'contracts', 'generated', 'slices');
  const paths: PathsMap = {};
  if (!existsSync(dir)) return paths;
  for (const uc of readdirSync(dir)) {
    const file = path.join(dir, uc, 'contract-slice.json');
    if (!existsSync(file)) continue;
    const slice = JSON.parse(readFileSync(file, 'utf8')) as { openapi?: { paths?: PathsMap } };
    for (const [tpl, item] of Object.entries(slice.openapi?.paths ?? {}))
      paths[tpl] = { ...(paths[tpl] ?? {}), ...item };
  }
  return paths;
}

const resolveOperationId = createOperationIdResolver({ paths: loadSlicePaths() });

const decorate: Decorate = (name, obj, layer) => traced(name, obj, { tier: BACKEND_TIER, layer });

export interface TracedTestAppDeps {
  db?: PGlite;
  clock: Clock;
}

export async function createTracedTestApp(deps: TracedTestAppDeps) {
  const pg = deps.db;
  // 発行元の名前は SqlClient (repository の層)。どの repository からかは、親の span (traced の call) でわかる
  const client: SqlClient | undefined = pg
    ? { query: <T>(text: string, params?: unknown[]) => pg.query<T>(text, params) }
    : undefined;
  const db = client
    ? tracePg(client, 'SqlClient', { tier: BACKEND_TIER, layer: 'repository' })
    : undefined;
  const inner = await createTestApp({
    db,
    clock: deps.clock,
    decorate,
  });
  const app = express();
  app.use(
    expressScenarioMiddleware({
      resolveOperationId,
      placement: { tier: BACKEND_TIER, layer: 'presentation' },
    }),
  );
  app.use(inner);
  return app;
}
