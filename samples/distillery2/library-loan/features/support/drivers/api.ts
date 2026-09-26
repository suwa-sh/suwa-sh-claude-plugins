/**
 * api.ts — UC BDD / 受入 (非 @browser) を実装アプリの composition root に直接当てるドライバ。
 *
 * 実装者 (d2-implement mode=integrate) は `apps/<backend>/src/test-app.ts` に
 * `createTestApp(options)` を用意する (README の結線契約)。backend-api の createTestApp は
 * pglite の起動を待つため **非同期** (Promise<RequestListener>) なので、最初の要求のときに 1 度だけ組み立てる。
 * UC ごとの結線 (計装・DB・時計) は、最初の要求より前に `configure(options)` で渡す。
 * ここでは supertest でそれを叩く。x-scenario-id / x-scenario-span はトレース結線のため付与する
 * (受け側の expressScenarioMiddleware が読み、画面 → API の入れ子を復元する)。
 *
 * UC の入口が画面 (frontend ティア) のときは、step から画面ロジックを呼び、その API 呼び出しに
 * `asFetch(placement)` を渡す (生成クライアントの `options.fetch`)。これで
 * 「画面 → API クライアント → backend」がブラウザ無しでも 1 本のトレースに乗る。
 *
 * 参照: supertest v7.3.0 (request(app).<method>(path)。app は http.RequestListener も受け付ける)。
 */
import request from 'supertest';

/** supertest の 1 リクエスト (型は request(app).get の戻りから取る。@types/supertest の export 形に依存しない) */
type SuperTestRequest = ReturnType<ReturnType<typeof request>['get']>;
import type { Driver } from './types';
import { inProcessFetch, scenarioHeaders, type Placement } from '@repo/test-support/tracer';
// createTestApp は実装リポの backend ティアが提供する。パスはプロジェクトで調整する。
import { createTestApp, type TestAppOptions } from '../../../apps/backend-api/src/test-app';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;

export class ApiDriver implements Driver {
  private options: TestAppOptions | undefined;
  private app: Promise<TestApp> | undefined;

  /** createTestApp に渡す結線 (計装・DB・時計など)。最初の要求より前に呼ぶ */
  configure(options: TestAppOptions): void {
    if (this.app) throw new Error('ApiDriver.configure は最初の要求より前に呼んでください');
    this.options = options;
  }

  private getApp(): Promise<TestApp> {
    this.app ??= createTestApp(this.options);
    return this.app;
  }

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const app = await this.getApp();
    let req = (request(app) as unknown as Record<string, (p: string) => SuperTestRequest>)[method.toLowerCase()](path);
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
    // supertest はサーバを都度閉じる。DB などの永続リソースは結線した側 (UC の support) が閉じる。
  }
}
