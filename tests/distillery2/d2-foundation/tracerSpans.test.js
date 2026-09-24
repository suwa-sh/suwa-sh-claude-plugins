'use strict';
/**
 * tracer.ts (テンプレート) を transpile して実行し、span の親子・開始順・HTTP 越しの伝播を実測する。
 * as-built のシーケンス図はこの形 (seq / parent / ts_end) を前提に木を組む。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const TRACER = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-foundation/templates/test-support/src/tracer.ts');

function loadTracer(traceDir) {
  const src = fs.readFileSync(TRACER, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2tracer-'));
  const file = path.join(dir, 'tracer.cjs');
  fs.writeFileSync(file, out);
  process.env.D2_TRACE_DIR = traceDir;
  delete require.cache[file];
  return require(file);
}

function readTrace(traceDir) {
  const files = fs.readdirSync(traceDir).filter((f) => f.endsWith('.jsonl'));
  assert.equal(files.length, 1, 'トレースファイルは 1 つ');
  return fs.readFileSync(path.join(traceDir, files[0]), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

test('span は開始順の seq と親 span の parent を持ち、完了順に書かれる', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  await t.withScenario('uc#s1', async () => {
    const repo = t.traced('LoanRepository', { async find() { await t.tracePg({ query: async () => ({ rows: [] }) }, 'LoanRepository', { layer: 'repository' }).query('SELECT * FROM books'); return 1; } }, { tier: 'backend-api', layer: 'repository' });
    const uc = t.traced('RegisterLoan', { async execute() { await repo.find(); return 'ok'; } }, { tier: 'backend-api', layer: 'usecase' });
    await uc.execute();
  });
  const lines = readTrace(traceDir);
  // 完了順: db.query → find → execute
  assert.deepEqual(lines.map((l) => l.kind), ['db.query', 'call', 'call']);
  const bySeq = Object.fromEntries(lines.map((l) => [l.seq, l]));
  const execute = lines.find((l) => l.name === 'RegisterLoan.execute');
  const find = lines.find((l) => l.name === 'LoanRepository.find');
  const q = lines.find((l) => l.kind === 'db.query');
  assert.equal(execute.parent, undefined);
  assert.equal(find.parent, execute.seq);
  assert.equal(q.parent, find.seq);
  assert.ok(execute.seq < find.seq && find.seq < q.seq, '開始順');
  for (const l of lines) { assert.ok(l.ts_end >= l.ts); assert.equal(l.meta.result, 'ok'); }
  assert.equal(execute.meta.tier, 'backend-api');
  assert.equal(execute.meta.layer, 'usecase');
  assert.equal(q.meta.layer, 'repository');
  assert.deepEqual(q.meta.tables, ['books']);
  assert.ok(bySeq[execute.seq]);
});

test('例外は result: error で記録して再送出する', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  await t.withScenario('uc#s2', async () => {
    const uc = t.traced('Uc', { async run() { throw new Error('boom'); } }, { tier: 'backend-api' });
    await assert.rejects(() => uc.run(), /boom/);
  });
  const [line] = readTrace(traceDir);
  assert.equal(line.meta.result, 'error');
});

test('express ミドルウェアは要求受信時を ts にし、ヘッダの親 span を parent にする', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  const mw = t.expressScenarioMiddleware({ resolveOperationId: () => 'createLoan', placement: { tier: 'backend-api', layer: 'presentation' } });
  // 画面 (frontend) の span の中から fetch する体で、ヘッダを作る
  let headers;
  await t.withScenario('uc#s3', async () => {
    const screen = t.tracedFn('貸出受付画面', 'submit', async () => { headers = t.scenarioHeaders(); }, { tier: 'frontend-staff', layer: 'screen' });
    await screen();
  });
  assert.equal(decodeURIComponent(headers['x-scenario-id']), 'uc#s3');
  assert.match(headers['x-scenario-span'], /^\d+$/);
  // 別の async 文脈 (サーバ側) でミドルウェアが受ける
  const listeners = {};
  const res = { statusCode: 201, on(ev, cb) { listeners[ev] = cb; } };
  await new Promise((resolve) => {
    mw({ headers, method: 'POST', path: '/loans' }, res, () => {
      // ハンドラの中の DB クエリは http.in の子になる
      t.tracePg({ query: async () => ({}) }, 'Repo', { tier: 'backend-api', layer: 'repository' }).query('INSERT INTO loans').then(() => { listeners.finish(); resolve(); });
    });
  });
  const lines = readTrace(traceDir);
  const httpIn = lines.find((l) => l.kind === 'http.in');
  const screen = lines.find((l) => l.kind === 'call');
  const q = lines.find((l) => l.kind === 'db.query');
  assert.equal(httpIn.parent, screen.seq, 'ヘッダで運んだ親 span');
  assert.equal(q.parent, httpIn.seq);
  assert.ok(httpIn.seq < q.seq, 'http.in は要求受信時の seq (クエリより前)');
  assert.equal(httpIn.meta.status, 201);
  assert.equal(httpIn.meta.operationId, 'createLoan');
  assert.equal(httpIn.meta.tier, 'backend-api');
  assert.equal(httpIn.meta.layer, 'presentation');
});

test('tracedFetch は http.out を span にし、status を完了時に入れる', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  const fake = async () => new Response('{}', { status: 409 });
  const f = t.tracedFetch(fake, { tier: 'frontend-staff', layer: 'api-client' });
  await t.withScenario('uc#s4', () => f('http://x/api/v1/loans', { method: 'POST' }));
  const [line] = readTrace(traceDir);
  assert.equal(line.kind, 'http.out');
  assert.equal(line.meta.status, 409);
  assert.equal(line.meta.method, 'POST');
  assert.equal(line.meta.tier, 'frontend-staff');
});

test('enterScenario の文脈は別の async 連鎖 (cucumber の step) からも解決でき、exitScenario で消える', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  t.enterScenario('uc#s5');
  // Before hook とは別の連鎖 (setImmediate) で step が動く体
  await new Promise((resolve) => setImmediate(async () => { await t.traced('Uc', { async run() {} }, { tier: 'b' }).run(); resolve(); }));
  assert.equal(readTrace(traceDir).length, 1);
  assert.equal(t.scenarioHeaders()['x-scenario-id'], encodeURIComponent('uc#s5'));
  t.exitScenario();
  assert.equal(t.currentScenarioId(), undefined);
});

test('inProcessFetch は Request 入力の method / headers / body を読み、204 は本文なしの Response にする', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  const seen = [];
  const f = t.inProcessFetch(async (req) => { seen.push(req); return req.method === 'DELETE' ? { status: 204, body: undefined } : { status: 201, body: { ok: 1 }, headers: { 'x-a': 'b' } }; }, { tier: 'frontend-staff', layer: 'api-client' });
  await t.withScenario('uc#s6', async () => {
    const res1 = await f(new Request('http://x/api/v1/loans?q=1', { method: 'POST', headers: { 'content-type': 'application/json', 'x-h': 'v' }, body: JSON.stringify({ a: 1 }) }));
    assert.equal(res1.status, 201);
    assert.deepEqual(await res1.json(), { ok: 1 });
    assert.equal(res1.headers.get('x-a'), 'b');
    const res2 = await f('http://x/api/v1/loans/1', { method: 'DELETE' });
    assert.equal(res2.status, 204);
    assert.equal(await res2.text(), '');
  });
  assert.equal(seen[0].method, 'POST');
  assert.equal(seen[0].path, '/api/v1/loans?q=1');
  assert.deepEqual(seen[0].body, { a: 1 });
  assert.equal(seen[0].headers['x-h'], 'v');
  assert.equal(decodeURIComponent(seen[0].headers['x-scenario-id']), 'uc#s6');
  const lines = readTrace(traceDir);
  assert.deepEqual(lines.map((l) => [l.kind, l.meta.method, l.meta.status]), [['http.out', 'POST', 201], ['http.out', 'DELETE', 204]]);
});

test('inProcessFetch: init.body の null は本文なし、Blob は中身を読む', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  const seen = [];
  const f = t.inProcessFetch(async (req) => { seen.push(req); return { status: 200, body: {} }; });
  await t.withScenario('uc#s8', async () => {
    await f(new Request('http://x/a', { method: 'POST', body: '{"a":1}' }), { body: null });
    await f('http://x/b', { method: 'POST', body: new Blob(['{"b":2}']) });
    await f('http://x/c', { method: 'POST', body: 'plain text' });
  });
  assert.equal(seen[0].body, undefined);
  assert.deepEqual(seen[1].body, { b: 2 });
  assert.equal(seen[2].body, 'plain text');
});

test('inProcessFetch: JSON でない文字列応答はそのまま返す', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  const f = t.inProcessFetch(async (req) => (req.path === '/t' ? { status: 200, body: 'hello', headers: { 'content-type': 'text/plain' } } : { status: 200, body: { a: 1 }, headers: { 'content-type': 'application/problem+json' } }));
  await t.withScenario('uc#s9', async () => {
    assert.equal(await (await f('http://x/t')).text(), 'hello');
    assert.deepEqual(await (await f('http://x/j')).json(), { a: 1 });
  });
});

test('seq はプロセスごとに基数が違い、別プロセスの行と衝突しにくい', () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  t.withScenario('uc#s7', () => t.emit('call', 'x'));
  const [line] = readTrace(traceDir);
  assert.equal(line.seq, (process.pid % 100000) * 1000000 + 1);
});

test('文脈が無ければ何も書かず、そのまま実行する', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  const uc = t.traced('Uc', { run() { return 42; } });
  assert.equal(uc.run(), 42);
  assert.deepEqual(fs.readdirSync(traceDir), []);
});
