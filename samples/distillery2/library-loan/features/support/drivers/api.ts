/**
 * api.ts — UC BDD / 受入 (非 @browser) を実装アプリの composition root に直接当てるドライバ。
 *
 * 実装者 (d2-implement mode=integrate) は `apps/<backend>/src/test-app.ts` に
 * `export function createTestApp(): Express` を用意する (README の結線契約)。
 * ここでは supertest でそれを叩く。x-scenario-id / x-scenario-span はトレース結線のため付与する
 * (受け側の expressScenarioMiddleware が読み、画面 → API の入れ子を復元する)。
 *
 * UC の入口が画面 (frontend ティア) のときは、step から画面ロジックを呼び、その API 呼び出しに
 * `asFetch(placement)` を渡す (生成クライアントの `options.fetch`)。これで
 * 「画面 → API クライアント → backend」がブラウザ無しでも 1 本のトレースに乗る。
 *
 * 参照: supertest v7.3.0 (request(app).<method>(path))。
 */
import request from 'supertest';
import type { Driver } from './types';
import { inProcessFetch, scenarioHeaders, type Placement } from '@repo/test-support/tracer';
// createTestApp は実装リポの backend ティアが提供する。パスはプロジェクトで調整する。
import { createTestApp } from '../../../apps/backend-api/src/test-app';

export type TestApp = ReturnType<typeof createTestApp>;

export class ApiDriver implements Driver {
  private readonly app: TestApp;

  /** app を渡さなければ既定の createTestApp() を使う (World が DB・時計・計装を結線した app を渡す)。 */
  constructor(app?: TestApp) {
    this.app = app ?? createTestApp();
  }

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    let req = (request(this.app) as unknown as Record<string, (p: string) => any>)[method.toLowerCase()](path);
    for (const [k, v] of Object.entries({ ...scenarioHeaders(), ...headers })) req = req.set(k, v);
    if (body !== undefined) req = req.send(body as object);
    const res = await req;
    return { status: res.status, body: res.body, headers: res.headers as Record<string, string> };
  }

  /**
   * frontend ティアの生成クライアント (`packages/contracts/<id>/client.ts`) に渡す fetch。
   * URL のパス部分を supertest に流し、http.out (placement のティア) → http.in (backend) の入れ子を作る。
   */
  asFetch(placement: Placement): typeof fetch {
    return inProcessFetch((req) => this.request(req.method, req.path, req.body, req.headers), placement);
  }

  async teardown() {
    // supertest はサーバを都度閉じる。永続リソースを持つ場合のみここで解放する。
  }
}
