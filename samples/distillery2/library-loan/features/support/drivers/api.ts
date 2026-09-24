/**
 * api.ts — UC BDD / 受入 (非 @browser) を実装アプリの composition root に直接当てるドライバ。
 *
 * テスト用 composition root (`apps/backend-api/src/test-app.ts` の createTestApp) を、
 * features/support/scenario-db.ts がシナリオ隔離 DB と計装を結線した listener として渡す。
 * ここでは supertest でそれを叩く。x-scenario-id / x-scenario-span はトレース結線のため付与する
 * (受け側の expressScenarioMiddleware が読み、画面 → API の入れ子を復元する)。
 *
 * UC の入口は frontend-staff の画面ロジックなので、step は画面の入口関数を呼び、その API 呼び出しに
 * `asTransport(placement)` (frontend-staff の手書きクライアントは ApiTransport を注入する形) を渡す。
 * 生成クライアントを使う画面には `asFetch(placement)` を渡す。
 *
 * 参照: supertest v7.3.0 (request(app).<method>(path))。
 */
import type { RequestListener } from 'node:http';
import request from 'supertest';
import type { Driver } from './types';
import { inProcessFetch, scenarioHeaders, span, type Placement } from '@repo/test-support/tracer';
import type { ApiTransport } from '../../../apps/frontend-staff/src/api-client/loan-api';

export class ApiDriver implements Driver {
  private authorization: string | undefined;

  /**
   * @param app 計装済みのアプリ (scenario-db.ts の ScenarioContext.listener)
   */
  constructor(private readonly app: RequestListener) {}

  /**
   * 以降のリクエストに付ける Authorization ヘッダ。
   * 暫定注入・契約確定後に削除 (根拠: AssumptionRecord A-005
   * .distillery/runs/register-loan/attempt-1/assumptions.backend-api.yaml — テスト用トークン表現 Bearer test-staff|test-patron:<id>)
   */
  setAuthorization(value: string | undefined): void {
    this.authorization = value;
  }

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    let req = (request(this.app) as unknown as Record<string, (p: string) => any>)[method.toLowerCase()](path);
    // x-scenario-id は URI エンコード済み (非 ASCII のシナリオ名をヘッダに載せるため)。受け側の middleware が復号する
    for (const [k, v] of Object.entries({ ...scenarioHeaders(), ...headers })) req = req.set(k, v);
    if (this.authorization) req = req.set('Authorization', this.authorization);
    if (body !== undefined) req = req.send(body as object);
    const res = await req;
    return { status: res.status, body: res.body, headers: res.headers as Record<string, string> };
  }

  /**
   * frontend-staff の手書き API クライアント (createLoanApi) に渡す transport。
   * http.out (placement のティア) の span の中で backend を叩くので、画面 → API の入れ子がトレースに残る。
   */
  asTransport(placement: Placement, onResponse?: (res: { status: number; body: unknown; headers?: Record<string, string> }) => void): ApiTransport {
    return ({ method, path, body }) =>
      span('http.out', path, { method, url: path, ...placement }, async (h) => {
        const res = await this.request(method, path, body);
        h.set({ status: res.status });
        onResponse?.(res);
        return { status: res.status, body: res.body };
      });
  }

  /** 生成クライアント (`packages/contracts/<id>/client.ts`) の `options.fetch` に渡す fetch。 */
  asFetch(placement: Placement): typeof fetch {
    return inProcessFetch((req) => this.request(req.method, req.path, req.body, req.headers), placement);
  }

  async teardown() {
    // シナリオ隔離 DB の rollback は hooks.ts の After (ScenarioContext.close) が行う。
  }
}
