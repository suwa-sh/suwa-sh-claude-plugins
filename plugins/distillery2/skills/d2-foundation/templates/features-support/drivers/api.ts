/**
 * api.ts — UC BDD / 受入 (非 @browser) を実装アプリの composition root に直接当てるドライバ。
 *
 * 実装者 (d2-implement mode=integrate) は `apps/<backend>/src/test-app.ts` に
 * `export function createTestApp(deps: TestAppDeps): Express` を用意する (README の結線契約)。
 * deps は World が渡す: `db` (シナリオごとの pglite。RDB が無ければ undefined) と `clock` (固定の時計)。
 * ここでは supertest でそれを叩く。x-scenario-id / x-scenario-span はトレース結線のため付与する
 * (受け側の expressScenarioMiddleware が読み、画面 → API の入れ子を復元する)。
 *
 * 契約の文書直下の `x-test-headers` (テスト用の認証ヘッダなど) は、genContractTests が
 * `packages/contracts/<id>/test-headers.json` に書き出したものを既定のヘッダとして付ける。
 * 重ねる順は 既定 → トレース → 呼び出し元の headers (シナリオが明示したものが勝つ)。値を空文字にしたヘッダは送らない
 * (例: 未認証の 401 を確かめるときは `{ Authorization: '' }`)。
 *
 * UC の入口が画面 (frontend ティア) のときは、step から画面ロジックを呼び、その API 呼び出しに
 * `asFetch(placement)` を渡す (生成クライアントの `options.fetch`)。これで
 * 「画面 → API クライアント → backend」がブラウザ無しでも 1 本のトレースに乗る。
 *
 * 参照: supertest v7.3.0 (request(app).<method>(path))。
 */
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';

/** supertest の 1 リクエスト (型は request(app).get の戻りから取る。@types/supertest の export 形に依存しない) */
type SuperTestRequest = ReturnType<ReturnType<typeof request>['get']>;
import type { PGlite } from '@electric-sql/pglite';
import type { Driver } from './types';
import type { Clock } from '@repo/test-support/clock';
import { inProcessFetch, scenarioHeaders, type Placement } from '@repo/test-support/tracer';
// createTestApp は実装リポの backend ティアが提供する。パスはプロジェクトで調整する。
import { createTestApp } from '../../../apps/backend-api/src/test-app';

/** contracts/contracts.json の openapi 契約ごとの test-headers.json を重ねる (cucumber はリポのルートで回る) */
function contractTestHeaders(root = process.cwd()): Record<string, string> {
  const out: Record<string, string> = {};
  const catalogPath = path.join(root, 'contracts', 'contracts.json');
  if (!fs.existsSync(catalogPath)) return out;
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as {
    contracts?: { id: string; type: string }[];
  };
  for (const c of catalog.contracts ?? []) {
    const f = path.join(root, 'packages', 'contracts', c.id, 'test-headers.json');
    if (c.type === 'openapi' && fs.existsSync(f)) Object.assign(out, JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  return out;
}

/** テスト用の composition root に渡すもの (README の結線契約) */
export interface TestAppDeps {
  db?: PGlite;
  clock: Clock;
}

export class ApiDriver implements Driver {
  private testHeaders = contractTestHeaders();
  private app: ReturnType<typeof createTestApp>;

  constructor(deps: TestAppDeps) {
    this.app = createTestApp(deps);
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    let req = (request(this.app) as unknown as Record<string, (p: string) => SuperTestRequest>)[
      method.toLowerCase()
    ](path);
    const all = { ...this.testHeaders, ...scenarioHeaders(), ...headers };
    for (const [k, v] of Object.entries(all)) if (v !== '') req = req.set(k, v);
    if (body !== undefined) req = req.send(body as object);
    const res = await req;
    return { status: res.status, body: res.body, headers: res.headers as Record<string, string> };
  }

  /**
   * frontend ティアの生成クライアント (`packages/contracts/<id>/client.ts`) に渡す fetch。
   * URL のパス部分を supertest に流し、http.out (placement のティア) → http.in (backend) の入れ子を作る。
   */
  asFetch(placement: Placement): typeof fetch {
    return inProcessFetch(
      (req) => this.request(req.method, req.path, req.body, req.headers),
      placement,
    );
  }

  async teardown() {
    // supertest はサーバを都度閉じる。永続リソースを持つ場合のみここで解放する。
  }
}
