/**
 * tracer.ts — シナリオ単位の計装トレーサ (d2-foundation テンプレート)
 *
 * AsyncLocalStorage にシナリオ文脈を置き、HTTP 入出力・DB クエリ・publish・任意の呼び出しを
 * JSONL で `${D2_TRACE_DIR}/<scenario_id>.jsonl` に追記する。1 行 =
 *   { ts, scenario, kind: 'http.in'|'http.out'|'db.query'|'publish'|'call', name, meta }
 * scenario_id は `<uc_slug>#<scenario name>`。ファイル名にはサニタイズした値を使う。
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type TraceKind = 'http.in' | 'http.out' | 'db.query' | 'publish' | 'call';
export interface TraceEvent {
  ts: string;
  scenario: string;
  kind: TraceKind;
  name: string;
  meta?: Record<string, unknown>;
}

interface ScenarioContext {
  scenarioId: string;
}

const storage = new AsyncLocalStorage<ScenarioContext>();

/** このプロセスが属するティア (as-built のシーケンス図で送受信者を確定するため)。テスト起動時に設定する。 */
let currentTier: string | undefined = process.env.D2_TIER;
export function setTier(tier: string): void { currentTier = tier; }

export function currentScenarioId(): string | undefined {
  return storage.getStore()?.scenarioId;
}

interface SliceLike { paths?: Record<string, Record<string, { operationId?: string }>> }

/**
 * contract-slice.json (OpenAPI bundle の部分集合) から、method + path → operationId の解決関数を作る。
 * path template (`/loans/{id}`) は 1 セグメント一致で照合する。as-built の operation 抽出はこの operationId を出所にする。
 */
export function createOperationIdResolver(slice: SliceLike): (method: string, urlPath: string) => string | undefined {
  const entries: { method: string; re: RegExp; operationId: string }[] = [];
  for (const [tpl, item] of Object.entries(slice.paths || {})) {
    const re = new RegExp('^' + tpl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+') + '/?$');
    for (const [m, op] of Object.entries(item || {})) if (op && op.operationId) entries.push({ method: m.toUpperCase(), re, operationId: op.operationId });
  }
  return (method, urlPath) => {
    const p = urlPath.split('?')[0];
    const hit = entries.find(e => e.method === method.toUpperCase() && e.re.test(p));
    return hit?.operationId;
  };
}

/** シナリオ id をファイル名に使える形へ変換する。 */
export function sanitizeScenarioId(scenarioId: string): string {
  return scenarioId.replace(/[^A-Za-z0-9._#-]+/g, '_').slice(0, 200);
}

/** 1 イベントを D2_TRACE_DIR 配下の JSONL に追記する。文脈が無い / 未設定なら何もしない。 */
export function emit(kind: TraceKind, name: string, meta?: Record<string, unknown>): void {
  const scenario = currentScenarioId();
  const dir = process.env.D2_TRACE_DIR;
  if (!scenario || !dir) return;
  const event: TraceEvent = { ts: new Date().toISOString(), scenario, kind, name, meta };
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sanitizeScenarioId(scenario)}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(event) + '\n');
}

/** fn をシナリオ文脈の中で実行する。 */
export function withScenario<T>(scenarioId: string, fn: () => T): T {
  return storage.run({ scenarioId }, fn);
}

/**
 * 現在の async 実行文脈にシナリオ id を張る (以降の await 連鎖に伝播する)。
 * cucumber の Before から呼ぶと、同一シナリオの step 実行中も currentScenarioId() が解決できる。
 */
export function enterScenario(scenarioId: string): void {
  storage.enterWith({ scenarioId });
}

/** グローバル fetch を包み、x-scenario-id を付与し http.out を記録する。返り値は元の fetch を復元する関数。 */
export function traceFetch(): () => void {
  const original = globalThis.fetch;
  const wrapped: typeof fetch = async (input, init) => {
    const scenario = currentScenarioId();
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (scenario) headers.set('x-scenario-id', scenario);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = init?.method || 'GET';
    const res = await original(input as Request, { ...init, headers });
    emit('http.out', url, { method, url, status: res.status, tier: currentTier });
    return res;
  };
  globalThis.fetch = wrapped;
  return () => { globalThis.fetch = original; };
}

interface ReqLike { headers: Record<string, unknown>; method?: string; url?: string; path?: string }
interface ResLike { statusCode?: number; on?: (ev: string, cb: () => void) => unknown }

/**
 * express ミドルウェア: 受信ヘッダ x-scenario-id で文脈を張り、応答完了時に http.in を記録する。
 * meta = {method, path, status, operationId, tier}。operationId は resolver (createOperationIdResolver) で引く。
 */
export function expressScenarioMiddleware(opts: { resolveOperationId?: (method: string, path: string) => string | undefined } = {}) {
  return (req: ReqLike, res: ResLike, next: () => void) => {
    const scenario = (req.headers['x-scenario-id'] as string) || currentScenarioId();
    const method = String(req.method || 'GET');
    const urlPath = String(req.path || (req.url || '').split('?')[0]);
    const record = () => emit('http.in', urlPath, { method, path: urlPath, status: res.statusCode, operationId: opts.resolveOperationId?.(method, urlPath), tier: currentTier });
    const run = () => { if (res.on) res.on('finish', record); else record(); next(); };
    if (scenario) withScenario(scenario, run); else run();
  };
}

/** SQL から素朴にテーブル名を拾う (from / join / into / update)。 */
export function extractTables(sql: string): string[] {
  const tables = new Set<string>();
  const re = /\b(?:from|join|into|update)\s+["`]?([A-Za-z_][A-Za-z0-9_."]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) tables.add(m[1].replace(/"/g, ''));
  return [...tables];
}

interface QueryClient { query(text: string, params?: unknown[]): Promise<unknown>; }

/** pg / pglite 互換の client を包み、db.query を記録する。component は発行元 (例: 'LoanRepository')。 */
export function tracePg<T extends QueryClient>(client: T, component = 'db-client'): T {
  const orig = client.query.bind(client);
  (client as QueryClient).query = (text: string, params?: unknown[]) => {
    emit('db.query', 'query', { sql: text, tables: extractTables(text), component, tier: currentTier });
    return orig(text, params);
  };
  return client;
}

interface Publisher { publish(topic: string, message: unknown): Promise<unknown> | unknown; }

/** publisher port を包み、publish を記録する。message 名は topic (channel) から取る。 */
export function tracePublisher<T extends Publisher>(port: T, component = 'publisher'): T {
  const orig = port.publish.bind(port);
  (port as Publisher).publish = (topic: string, message: unknown) => {
    emit('publish', topic, { message: topic, channel: topic, component, tier: currentTier });
    return orig(topic, message);
  };
  return port;
}

/** usecase / port オブジェクトを Proxy で包み、メソッド呼び出しを call として記録する。name が component になる。 */
export function traced<T extends object>(name: string, obj: T): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || typeof prop === 'symbol') return value;
      return (...args: unknown[]) => {
        emit('call', `${name}.${String(prop)}`, { component: name, fn: String(prop), args: args.length, tier: currentTier });
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}
