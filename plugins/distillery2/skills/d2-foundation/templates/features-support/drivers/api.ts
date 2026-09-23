/**
 * api.ts — UC BDD / 受入 (非 @browser) を実装アプリの composition root に直接当てるドライバ。
 *
 * 実装者 (d2-implement mode=integrate) は `apps/<backend>/src/test-app.ts` に
 * `export function createTestApp(): Express` を用意する (README の結線契約)。
 * ここでは supertest でそれを叩く。x-scenario-id はトレース結線のため付与する。
 *
 * 参照: supertest v7.3.0 (request(app).<method>(path))。
 */
import request from 'supertest';
import type { Driver } from './types';
import { currentScenarioId } from '@repo/test-support/tracer';
// createTestApp は実装リポの backend ティアが提供する。パスはプロジェクトで調整する。
import { createTestApp } from '../../../apps/backend-api/src/test-app';

export class ApiDriver implements Driver {
  private app = createTestApp();

  async request(method: string, path: string, body?: unknown) {
    const scenario = currentScenarioId();
    let req = (request(this.app) as unknown as Record<string, (p: string) => any>)[method.toLowerCase()](path);
    if (scenario) req = req.set('x-scenario-id', scenario);
    if (body !== undefined) req = req.send(body as object);
    const res = await req;
    return { status: res.status, body: res.body };
  }

  async teardown() {
    // supertest はサーバを都度閉じる。永続リソースを持つ場合のみここで解放する。
  }
}
