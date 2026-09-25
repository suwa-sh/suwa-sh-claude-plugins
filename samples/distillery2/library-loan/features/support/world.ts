/**
 * world.ts — Cucumber の World (d2-foundation テンプレート + integrate の結線)
 *
 * タグ @browser が付いたシナリオはブラウザドライバ、それ以外は api ドライバを選ぶ。
 * ドライバは step 定義から `this.driver` で使う。
 *
 * api ドライバには、backend-api のテスト用 composition root (createTestApp) を次の結線で渡す (test-support README の結線契約):
 *   - 最初のミドルウェアに expressScenarioMiddleware (tier: backend-api, layer: presentation。operationId は contract-slice.json から解決)
 *   - usecase / repository を decorate → traced() で包む (tier: backend-api, layer は createApp が渡す値)
 *   - DB は埋め込み pglite (datastore.ts) を tracePg で包んで渡す
 *   - 時計はシナリオごとの FixedClock (「今日の日付は … である」で動かす)
 *   - 認証は偽の認証基盤。トークン表はシナリオの前提 (司書のログイン) で埋める。ヘッダ無しは 401 (defaultPrincipal: null)
 *
 * 参照 (Context7 /cucumber/cucumber-js v13.2.1): setWorldConstructor(CustomWorld); World を継承。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { World, setWorldConstructor, type IWorldOptions } from '@cucumber/cucumber';
import {
  createOperationIdResolver,
  expressScenarioMiddleware,
  traced,
} from '@repo/test-support/tracer';
import { FixedClock } from '../../apps/backend-api/src/gateway/clock';
import type { Middleware } from '../../apps/backend-api/src/presentation/http/server';
import { createTestApp, DEFAULT_TEST_DATE } from '../../apps/backend-api/src/test-app';
import type { Principal } from '../../apps/backend-api/src/usecase/shared/principal';
import { startDatastore, tracedDatabase } from './datastore';
import { BACKEND_TIER } from './tiers';
import type { Driver } from './drivers/types';
import { ApiDriver } from './drivers/api';
import { BrowserDriver } from './drivers/browser';


let resolver: ((method: string, urlPath: string) => string | undefined) | undefined;

type Paths = Record<string, Record<string, { operationId?: string }>>;

/** 全 UC の contract-slice.json の openapi.paths を合わせて operationId の解決関数を作る (プロセスで 1 回)。 */
function operationIdResolver(): (method: string, urlPath: string) => string | undefined {
  if (resolver) return resolver;
  const slicesDir = path.join(process.cwd(), 'contracts', 'generated', 'slices');
  const paths: Paths = {};
  for (const uc of readdirSync(slicesDir)) {
    const file = path.join(slicesDir, uc, 'contract-slice.json');
    if (!existsSync(file)) continue;
    const slice = JSON.parse(readFileSync(file, 'utf8')) as { openapi?: { paths?: Paths } };
    for (const [p, item] of Object.entries(slice.openapi?.paths ?? {})) paths[p] = { ...paths[p], ...item };
  }
  resolver = createOperationIdResolver({ openapi: { paths } });
  return resolver;
}

export class D2World extends World {
  driver!: Driver;
  scenarioId = '';
  /** backend-api の時計 (既定 2026-09-01)。シナリオの「今日の日付」で動かす */
  readonly clock = FixedClock.onDate(DEFAULT_TEST_DATE);
  /** 偽の認証基盤のトークン表 (Bearer トークン → 操作主体)。createTestApp は参照で持つので後から埋めてよい */
  readonly tokens: Record<string, Principal> = {};
  /** 画面から API を呼ぶときに付ける認証ヘッダ (契約 securitySchemes.bearerAuth) */
  authHeaders: Record<string, string> = {};
  /** 直前の画面操作の結果 (画面の表示状態) */
  lastView: unknown;

  constructor(options: IWorldOptions) {
    super(options);
  }

  /** タグからドライバを選ぶ。hooks.ts の Before から呼ぶ。 */
  selectDriver(tags: readonly string[]): void {
    this.driver = tags.includes('@browser') ? new BrowserDriver() : new ApiDriver(this.createApp());
  }

  /** backend-api のテスト用 composition root に DB・時計・認証・計装を結線する。 */
  private createApp() {
    const scenarioMiddleware = expressScenarioMiddleware({
      resolveOperationId: operationIdResolver(),
      placement: { tier: BACKEND_TIER, layer: 'presentation' },
    }) as unknown as Middleware;
    return createTestApp({
      db: startDatastore().then((pg) => tracedDatabase(pg, { tier: BACKEND_TIER, layer: 'gateway' })),
      clock: this.clock,
      tokens: this.tokens,
      defaultPrincipal: null,
      decorate: (name, obj, layer) => traced(name, obj, { tier: BACKEND_TIER, layer }),
      middlewares: [scenarioMiddleware],
    });
  }

  /** api ドライバ (非 @browser) を取り出す。画面ロジックに `this.api.asFetch(placement)` を渡すときに使う。 */
  get api(): ApiDriver {
    if (!(this.driver instanceof ApiDriver)) throw new Error('この step は api ドライバ (非 @browser) でのみ実行できます');
    return this.driver;
  }
}

setWorldConstructor(D2World);
