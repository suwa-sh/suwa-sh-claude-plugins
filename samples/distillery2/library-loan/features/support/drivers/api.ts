/**
 * api.ts — UC BDD / 受入 (非 @browser) を実装アプリの composition root に直接当てるドライバ。
 *
 * テスト用 composition root (`apps/backend-api/src/test-app.ts` の createTestApp) を、
 * features/support/scenario-db.ts がシナリオ隔離 DB と計装を結線した listener として渡す。
 * ここでは supertest でそれを叩く。x-scenario-id はトレース結線のため付与する。
 *
 * 参照: supertest v7.3.0 (request(app).<method>(path))。
 */
import type { RequestListener } from 'node:http';
import request from 'supertest';
import type { Driver } from './types';
import { currentScenarioId } from '@repo/test-support/tracer';

export class ApiDriver implements Driver {
  private authorization: string | undefined;

  /**
   * @param app 計装済みのアプリ (scenario-db.ts の ScenarioContext.listener)
   * @param scenarioId トレース文脈。AsyncLocalStorage が step まで伝播しない場合の予備
   */
  constructor(
    private readonly app: RequestListener,
    private readonly scenarioId?: string,
  ) {}

  /**
   * 以降のリクエストに付ける Authorization ヘッダ。
   * 暫定注入・契約確定後に削除 (根拠: AssumptionRecord A-005
   * .distillery/runs/register-loan/attempt-1/assumptions.backend-api.yaml — テスト用トークン表現 Bearer test-staff|test-patron:<id>)
   */
  setAuthorization(value: string | undefined): void {
    this.authorization = value;
  }

  async request(method: string, path: string, body?: unknown) {
    const scenario = currentScenarioId() ?? this.scenarioId;
    let req = (request(this.app) as unknown as Record<string, (p: string) => any>)[method.toLowerCase()](path);
    // HTTP ヘッダ値に非 ASCII (日本語のシナリオ名) は載らないため URI エンコードして送る。
    // 受け側 (scenario-db.ts の listener) が expressScenarioMiddleware に渡す前に復号する
    if (scenario) req = req.set('x-scenario-id', encodeURIComponent(scenario));
    if (this.authorization) req = req.set('Authorization', this.authorization);
    if (body !== undefined) req = req.send(body as object);
    const res = await req;
    return { status: res.status, body: res.body, headers: res.headers as Record<string, string> };
  }

  async teardown() {
    // シナリオ隔離 DB の rollback は hooks.ts の After (ScenarioContext.close) が行う。
  }
}
