/**
 * tracer.ts — シナリオ単位の計装トレーサ (d2-foundation テンプレート)
 *
 * AsyncLocalStorage にシナリオ文脈を置き、HTTP 入出力・DB クエリ・publish・任意の呼び出しを
 * JSONL で `${D2_TRACE_DIR}/<scenario_id>.jsonl` に追記する。1 行 =
 *   { ts, ts_end?, seq, parent?, scenario, kind: 'http.in'|'http.out'|'db.query'|'publish'|'call', name, meta }
 *
 * - `ts` は**開始**時刻、`ts_end` は完了時刻。行は完了時に書くので、ファイル内の並びは完了順になる。
 *   読み手 (as-built) は `seq` (開始順の通し番号) で並べ直す
 * - `parent` は呼び出し元の span の seq。HTTP をまたぐときは `x-scenario-span` ヘッダで運ぶ。
 *   これで「画面 → API → ユースケース → リポジトリ → DB」の入れ子が復元できる
 * - `meta.tier` / `meta.layer` は**部品ごと**に指定できる (同一プロセスで複数ティアを動かす in-process 実行のため)。
 *   省略時は setTier() で設定したプロセス既定のティア
 * scenario_id は `<uc_slug>#<scenario name>`。ファイル名にはサニタイズした値を使う。
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type TraceKind = 'http.in' | 'http.out' | 'db.query' | 'publish' | 'call';
export interface TraceEvent {
  ts: string;
  ts_end?: string;
  seq: number;
  parent?: number;
  scenario: string;
  kind: TraceKind;
  name: string;
  meta?: Record<string, unknown>;
}

/** 部品の所属。as-built のシーケンス図・データフロー図の参加者とレイヤ表示に使う。 */
export interface Placement {
  /** 部品が属するティア (省略時は setTier のプロセス既定) */
  tier?: string;
  /** 部品が属するレイヤ (例: presentation / usecase / repository / screen / api-client)。任意 */
  layer?: string;
}

interface ScenarioContext {
  scenarioId: string;
  /** 現在実行中の span の seq (子 span の parent になる) */
  span?: number;
}

const storage = new AsyncLocalStorage<ScenarioContext>();
/**
 * enterScenario() で張った文脈の控え。cucumber の Before hook と各 step は別の async 連鎖で動くため、
 * AsyncLocalStorage だけでは step まで届かないことがある (実走で確認)。シナリオは 1 プロセスで直列に走るので、
 * 文脈が取れないときはこの控えを使う。exitScenario() で消す。
 */
let fallbackStore: ScenarioContext | undefined;
function store(): ScenarioContext | undefined { return storage.getStore() ?? fallbackStore; }

/** このプロセスの既定ティア。部品ごとの Placement.tier が無いときに使う。テスト起動時に設定する。 */
let currentTier: string | undefined = process.env.D2_TIER;
export function setTier(tier: string): void { currentTier = tier; }

/**
 * 開始順の通し番号 (プロセス内で単調増加)。プロセスごとに pid 由来の基数を足し、別プロセスの行が
 * 同じトレースファイルに混ざっても seq が衝突しにくくする (hooks は実行ごとにファイルを作り直すのが前提)。
 */
let nextSeq = (process.pid % 100000) * 1_000_000 + 1;

export function currentScenarioId(): string | undefined {
  return store()?.scenarioId;
}

/** 現在の span の seq (HTTP 越しに親子関係を運ぶときヘッダに載せる)。 */
export function currentSpan(): number | undefined {
  return store()?.span;
}

type PathsMap = Record<string, Record<string, { operationId?: string }>>;
interface SliceLike { paths?: PathsMap; openapi?: { paths?: PathsMap } }

/**
 * contract-slice.json (OpenAPI bundle の部分集合) から、method + path → operationId の解決関数を作る。
 * slice は `{ schema_version, uc, openapi: { paths }, asyncapi }` の形なので paths は `openapi.paths` にある。
 * openapi 部分 (`slice.openapi`) を直接渡された場合の `slice.paths` も受け付ける (どちらの形でも動く)。
 * path template (`/loans/{id}`) は 1 セグメント一致で照合する。as-built の operation 抽出はこの operationId を出所にする。
 */
export function createOperationIdResolver(slice: SliceLike): (method: string, urlPath: string) => string | undefined {
  const entries: { method: string; re: RegExp; operationId: string }[] = [];
  const paths: PathsMap = slice.openapi?.paths || slice.paths || {};
  for (const [tpl, item] of Object.entries(paths)) {
    const re = new RegExp('^' + tpl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+') + '/?$');
    for (const [m, op] of Object.entries(item || {})) if (op && op.operationId) entries.push({ method: m.toUpperCase(), re, operationId: op.operationId });
  }
  return (method, urlPath) => {
    const p = urlPath.split('?')[0];
    const hit = entries.find(e => e.method === method.toUpperCase() && e.re.test(p));
    return hit?.operationId;
  };
}

/**
 * シナリオ id をファイル名に使える形へ変換する。
 *
 * 日本語などの非 ASCII を含む id は、そのまま `_` に潰すと別シナリオが同名ファイルに衝突する
 * (実走で 9 シナリオが 2 ファイルに混ざった)。読める ASCII 接頭辞に、**元の id 全体**の
 * sha256 先頭 8 桁を接尾して必ず一意にする。ファイル名から元の id は復元できないので、
 * トレースの読み手 (buildTraceIndex / extractAsBuilt) は JSONL の `scenario` フィールドを使う。
 */
export function sanitizeScenarioId(scenarioId: string): string {
  const ascii = scenarioId.replace(/[^A-Za-z0-9._#-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100);
  const hash = crypto.createHash('sha256').update(scenarioId, 'utf8').digest('hex').slice(0, 8);
  return `${ascii || 'scenario'}-${hash}`;
}

function writeEvent(event: TraceEvent): void {
  const dir = process.env.D2_TRACE_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sanitizeScenarioId(event.scenario)}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(event) + '\n');
}

function withTier(meta: Record<string, unknown> | undefined, placement?: Placement): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(meta || {}) };
  if (out.tier == null && (placement?.tier ?? currentTier) != null) out.tier = placement?.tier ?? currentTier;
  if (out.layer == null && placement?.layer != null) out.layer = placement.layer;
  return out;
}

/** 瞬間イベント (span を持たない) を 1 行書く。文脈が無い / 未設定なら何もしない。 */
export function emit(kind: TraceKind, name: string, meta?: Record<string, unknown>): void {
  const ctx = store();
  if (!ctx?.scenarioId || !process.env.D2_TRACE_DIR) return;
  const seq = nextSeq++;
  writeEvent({ ts: new Date().toISOString(), seq, parent: ctx.span, scenario: ctx.scenarioId, kind, name, meta: withTier(meta) });
}

/** span の中から完了時の meta を積む小道具 (例: HTTP の status)。 */
export interface SpanHandle { set(extra: Record<string, unknown>): void }

/**
 * span (開始〜完了) として fn を実行し、完了時に 1 行書く。fn の中で起きた emit / span は
 * この span を parent に持つ。fn が Promise を返せば完了を待つ。例外・reject は meta.result = 'error' で記録して再送出する。
 * fn は SpanHandle を受け取り、`set({...})` で完了時の meta を足せる。文脈が無ければ計装せずにそのまま fn を実行する。
 */
export function span<T>(kind: TraceKind, name: string, meta: Record<string, unknown> | undefined, fn: (handle: SpanHandle) => T): T {
  const ctx = store();
  const noop: SpanHandle = { set() { /* 文脈なし */ } };
  if (!ctx?.scenarioId || !process.env.D2_TRACE_DIR) return fn(noop);
  const seq = nextSeq++;
  const ts = new Date().toISOString();
  const base: TraceEvent = { ts, seq, parent: ctx.span, scenario: ctx.scenarioId, kind, name, meta: withTier(meta) };
  const extra: Record<string, unknown> = {};
  const handle: SpanHandle = { set(x) { Object.assign(extra, x); } };
  const finish = (result: 'ok' | 'error') => {
    writeEvent({ ...base, ts_end: new Date().toISOString(), meta: { ...base.meta, ...extra, result } });
  };
  let out: T;
  try {
    out = storage.run({ scenarioId: ctx.scenarioId, span: seq }, () => fn(handle));
  } catch (e) {
    finish('error');
    throw e;
  }
  if (out && typeof (out as { then?: unknown }).then === 'function') {
    return (out as unknown as Promise<unknown>).then(
      (v) => { finish('ok'); return v; },
      (e) => { finish('error'); throw e; },
    ) as unknown as T;
  }
  finish('ok');
  return out;
}

/** fn をシナリオ文脈の中で実行する。parentSpan を渡すと、その span の子として実行する (HTTP 越しの親子)。 */
export function withScenario<T>(scenarioId: string, fn: () => T, parentSpan?: number): T {
  return storage.run({ scenarioId, span: parentSpan }, fn);
}

/**
 * 現在の async 実行文脈にシナリオ id を張り、控えにも置く (以降の await 連鎖と、別連鎖で動く step の両方から解決できる)。
 * cucumber の Before から呼び、After で exitScenario() を呼ぶ。
 */
export function enterScenario(scenarioId: string): void {
  fallbackStore = { scenarioId };
  storage.enterWith({ scenarioId });
}

/** enterScenario の控えを消す (cucumber の After から呼ぶ)。 */
export function exitScenario(): void {
  fallbackStore = undefined;
  storage.enterWith(undefined as unknown as ScenarioContext);
}

/** x-scenario-id / x-scenario-span ヘッダの値。HTTP 越しにシナリオ文脈と親 span を運ぶ (非 ASCII は URI エンコード)。 */
export function scenarioHeaders(): Record<string, string> {
  const ctx = store();
  const out: Record<string, string> = {};
  if (ctx?.scenarioId) out['x-scenario-id'] = encodeURIComponent(ctx.scenarioId);
  if (ctx?.span != null) out['x-scenario-span'] = String(ctx.span);
  return out;
}

/** ヘッダから scenario id と親 span を読む (scenarioHeaders の逆)。 */
export function readScenarioHeaders(headers: Record<string, unknown>): { scenarioId?: string; parentSpan?: number } {
  const rawId = headers['x-scenario-id'];
  const rawSpan = headers['x-scenario-span'];
  let scenarioId: string | undefined;
  if (typeof rawId === 'string' && rawId) {
    try { scenarioId = decodeURIComponent(rawId); } catch { scenarioId = rawId; }
  }
  const parentSpan = typeof rawSpan === 'string' && /^\d+$/.test(rawSpan) ? Number(rawSpan) : undefined;
  return { scenarioId, parentSpan };
}

/**
 * fetch 関数を包み、シナリオヘッダを付与し http.out を span として記録する。
 * 生成クライアント (`packages/contracts/<id>/client.ts`) の `options.fetch` に渡す。placement は呼び出し側 (consumer) の所属。
 */
export function tracedFetch(base: typeof fetch, placement?: Placement): typeof fetch {
  return (input, init) => {
    const req = normalizeFetchInput(input, init);
    for (const [k, v] of Object.entries(scenarioHeaders())) req.headers.set(k, v);
    return span('http.out', req.url, withTier({ method: req.method, url: req.url }, placement), async (h) => {
      const res = await base(input as Request, { ...init, method: req.method, headers: req.headers });
      h.set({ status: res.status });
      return res;
    });
  };
}

/** fetch の (input, init) から method / url / headers / body を取り出す。Request が渡されたときはその値を既定にする。 */
export function normalizeFetchInput(input: RequestInfo | URL, init?: RequestInit): { method: string; url: string; headers: Headers; body: BodyInit | null | undefined } {
  const isReq = typeof Request !== 'undefined' && input instanceof Request;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  const method = (init?.method ?? (isReq ? (input as Request).method : undefined) ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers ?? (isReq ? (input as Request).headers : undefined));
  const body = init?.body !== undefined ? init.body : undefined;
  return { method, url, headers, body };
}

/** 本文を持てないステータス (Response のコンストラクタが拒否する)。 */
const NULL_BODY_STATUS = new Set([101, 204, 205, 304]);

/**
 * in-process の送信関数 (supertest 等) を fetch の形に包む。生成クライアントの `options.fetch` に渡す。
 * Request 入力の method / headers / body も読み、本文を持てないステータスは空の Response にする。
 * api ドライバの `asFetch` はこれで作る。
 */
export function inProcessFetch(
  send: (req: { method: string; path: string; body?: unknown; headers: Record<string, string> }) => Promise<{ status: number; body: unknown; headers?: Record<string, string> }>,
  placement?: Placement,
): typeof fetch {
  const base: typeof fetch = async (input, init) => {
    const req = normalizeFetchInput(input, init);
    const u = new URL(req.url, 'http://in-process');
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k] = v; });
    let body: unknown;
    if (req.body != null) body = parseJsonIfPossible(String(req.body));
    else if (typeof Request !== 'undefined' && input instanceof Request && input.method !== 'GET' && input.method !== 'HEAD') {
      const text = await input.clone().text();
      if (text) body = parseJsonIfPossible(text);
    }
    const res = await send({ method: req.method, path: u.pathname + u.search, body, headers });
    const resHeaders: Record<string, string> = { ...(res.headers || {}) };
    if (NULL_BODY_STATUS.has(res.status)) return new Response(null, { status: res.status, headers: resHeaders });
    if (!Object.keys(resHeaders).some((k) => k.toLowerCase() === 'content-type')) resHeaders['content-type'] = 'application/json';
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), { status: res.status, headers: resHeaders });
  };
  return tracedFetch(base, placement);
}

function parseJsonIfPossible(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

/** グローバル fetch を包む (tracedFetch のグローバル版)。返り値は元の fetch を復元する関数。 */
export function traceFetch(placement?: Placement): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = tracedFetch(original, placement);
  return () => { globalThis.fetch = original; };
}

interface ReqLike { headers: Record<string, unknown>; method?: string; url?: string; path?: string }
interface ResLike { statusCode?: number; on?: (ev: string, cb: () => void) => unknown }

/**
 * express ミドルウェア: 受信ヘッダ x-scenario-id / x-scenario-span で文脈と親 span を張り、
 * **要求受信時**を ts、応答完了時を ts_end として http.in を 1 行記録する。
 * meta = {method, path, status, operationId, tier, layer}。operationId は resolver (createOperationIdResolver) で引く。
 */
export function expressScenarioMiddleware(opts: { resolveOperationId?: (method: string, path: string) => string | undefined; placement?: Placement } = {}) {
  return (req: ReqLike, res: ResLike, next: () => void) => {
    const fromHeader = readScenarioHeaders(req.headers);
    const scenario = fromHeader.scenarioId || currentScenarioId();
    const parentSpan = fromHeader.parentSpan ?? currentSpan();
    const method = String(req.method || 'GET');
    const urlPath = String(req.path || (req.url || '').split('?')[0]);
    if (!scenario || !process.env.D2_TRACE_DIR) { next(); return; }
    const seq = nextSeq++;
    const ts = new Date().toISOString();
    const meta = withTier({ method, path: urlPath, operationId: opts.resolveOperationId?.(method, urlPath) }, opts.placement);
    const record = () => writeEvent({
      ts, ts_end: new Date().toISOString(), seq, parent: parentSpan, scenario, kind: 'http.in', name: urlPath,
      meta: { ...meta, status: res.statusCode, result: res.statusCode != null && res.statusCode >= 500 ? 'error' : 'ok' },
    });
    const run = () => { if (res.on) res.on('finish', record); else record(); next(); };
    storage.run({ scenarioId: scenario, span: seq }, run);
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

/** pg / pglite 互換の client を包み、db.query を span として記録する。component は発行元 (例: 'LoanRepository')。 */
export function tracePg<T extends QueryClient>(client: T, component = 'db-client', placement?: Placement): T {
  const orig = client.query.bind(client);
  (client as QueryClient).query = (text: string, params?: unknown[]) =>
    span('db.query', 'query', withTier({ sql: text, tables: extractTables(text), component }, placement), () => orig(text, params));
  return client;
}

interface Publisher { publish(topic: string, message: unknown): Promise<unknown> | unknown; }

/** publisher port を包み、publish を記録する。message 名は topic (channel) から取る。 */
export function tracePublisher<T extends Publisher>(port: T, component = 'publisher', placement?: Placement): T {
  const orig = port.publish.bind(port);
  (port as Publisher).publish = (topic: string, message: unknown) =>
    span('publish', topic, withTier({ message: topic, channel: topic, component }, placement), () => orig(topic, message));
  return port;
}

/**
 * usecase / repository / 画面ロジックなどのオブジェクトを Proxy で包み、メソッド呼び出しを call の span として記録する。
 * name が component (図の参加者名) になる。placement で所属ティアとレイヤを付ける
 * (例: traced('RegisterLoan', uc, { tier: 'backend-api', layer: 'usecase' }))。
 */
export function traced<T extends object>(name: string, obj: T, placement?: Placement): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || typeof prop === 'symbol') return value;
      return (...args: unknown[]) =>
        span('call', `${name}.${String(prop)}`, withTier({ component: name, fn: String(prop), args: args.length }, placement),
          () => (value as (...a: unknown[]) => unknown).apply(target, args));
    },
  });
}

/** 単独の関数を call の span として記録する版 (画面の submit 関数など、オブジェクトでない入口に使う)。 */
export function tracedFn<A extends unknown[], R>(component: string, fn: string, impl: (...args: A) => R, placement?: Placement): (...args: A) => R {
  return (...args: A) => span('call', `${component}.${fn}`, withTier({ component, fn, args: args.length }, placement), () => impl(...args));
}
