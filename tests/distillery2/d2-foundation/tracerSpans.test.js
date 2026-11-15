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

test('tracedFetch は x-scenario-span に http.out の seq を載せ、http.in が http.out の子になる (実地確認: http.in の親が画面になり http.out と兄弟に並んだ)', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  const mw = t.expressScenarioMiddleware({ placement: { tier: 'backend-api', layer: 'presentation' } });
  // 受け側: 届いたヘッダでミドルウェアを通す (in-process の送信の体)
  const seen = [];
  const base = async (_input, init) => {
    const headers = {};
    new Headers(init.headers).forEach((v, k) => { headers[k] = v; });
    seen.push(headers);
    const listeners = {};
    const res = { statusCode: 200, on(ev, cb) { listeners[ev] = cb; } };
    await new Promise((resolve) => mw({ headers, method: 'GET', path: '/rooms' }, res, () => { listeners.finish(); resolve(); }));
    return new Response('{}', { status: 200 });
  };
  const f = t.tracedFetch(base, { tier: 'frontend', layer: 'api-client' });
  await t.withScenario('uc#nest', async () => {
    const screen = t.tracedFn('空き状況画面', 'show', () => f('http://x/rooms'), { tier: 'frontend', layer: 'screen' });
    await screen();
  });
  const lines = readTrace(traceDir);
  const screen = lines.find((l) => l.kind === 'call');
  const httpOut = lines.find((l) => l.kind === 'http.out');
  const httpIn = lines.find((l) => l.kind === 'http.in');
  assert.equal(seen[0]['x-scenario-span'], String(httpOut.seq), 'ヘッダの span は http.out の seq');
  assert.equal(httpOut.parent, screen.seq, '画面 → http.out');
  assert.equal(httpIn.parent, httpOut.seq, 'http.out → http.in (画面の直下ではない)');
  // 呼び出し元が自分で付けた x-scenario-span があっても、http.out の seq で上書きする
  seen.length = 0;
  await t.withScenario('uc#nest', () => f('http://x/rooms', { headers: { 'x-scenario-span': '1' } }));
  assert.notEqual(seen[0]['x-scenario-span'], '1');
});

test('seq_end は完了した時点で次に振られる seq: 並行の兄弟は重なり、順の兄弟は重ならない', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const repo = t.traced('Repo', { async listRooms() { await tick(); }, async listReservations() { await tick(); }, async save() { await tick(); } }, { tier: 'b', layer: 'repository' });
  await t.withScenario('uc#par', async () => {
    const uc = t.traced('Uc', { async execute() { await Promise.all([repo.listRooms(), repo.listReservations()]); await repo.save(); } }, { tier: 'b', layer: 'usecase' });
    await uc.execute();
  });
  const lines = readTrace(traceDir);
  const by = (name) => lines.find((l) => l.name === name);
  const rooms = by('Repo.listRooms'); const reservations = by('Repo.listReservations'); const save = by('Repo.save'); const execute = by('Uc.execute');
  for (const l of lines) assert.equal(typeof l.seq_end, 'number');
  assert.ok(reservations.seq < rooms.seq_end, '並行: 後の span は、前の span が終わる前に始まっている');
  assert.ok(save.seq >= rooms.seq_end && save.seq >= reservations.seq_end, '順: 前の span が終わってから始まる');
  assert.ok(execute.seq_end > save.seq, '親は子より後に終わる');
  // 実装の記録のシーケンス図は、この seq_end で並行の 2 本だけを par で囲む
  const { renderScenario } = require(path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-asbuilt/scripts/renderSequence'));
  const body = renderScenario(lines).split('\n').map((l) => l.trim()).filter((l) => /^(par|and|end)\b|: (listRooms|listReservations|save)$/.test(l));
  assert.deepEqual(body.map((l) => l.replace(/^p\d+->>\+?p\d+: /, '')), ['par listRooms', 'listRooms', 'and listReservations', 'listReservations', 'end', 'save']);
});

test('値で返した業務の拒否は result: ok のまま、戻り値の種類を meta.returned に残す (実地確認: 図が 409 の経路の戻りをすべて ok と描いた)', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  const obj = t.traced('Uc', {
    async rejected() { return { ok: false, error: { code: 'SLOT_OVERLAPS' } }; },
    async rejectedKind() { return { ok: false, error: { kind: 'not_found' } }; },
    async rejectedText() { return { ok: false, error: 'TOO_LATE' }; },
    async rejectedBare() { return { ok: false }; },
    async created() { return { ok: true, value: { kind: 'created', reservation: {} } }; },
    async okPlain() { return { ok: true, value: [1, 2] }; },
    overlaps() { return { kind: 'overlaps' }; },
    screenError() { return { kind: 'error', code: 'SLOT_OVERLAPS' }; },
    plain() { return { rows: [] }; },
    nothing() {},
    list() { return [{ kind: 'x' }]; },
  }, { tier: 'b' });
  await t.withScenario('uc#ret', async () => { for (const k of ['rejected', 'rejectedKind', 'rejectedText', 'rejectedBare', 'created', 'okPlain', 'overlaps', 'screenError', 'plain', 'nothing', 'list']) await obj[k](); });
  const lines = readTrace(traceDir);
  const returned = Object.fromEntries(lines.map((l) => [l.meta.fn, l.meta.returned]));
  assert.deepEqual(returned, {
    rejected: 'SLOT_OVERLAPS', rejectedKind: 'not_found', rejectedText: 'TOO_LATE', rejectedBare: 'rejected',
    created: 'created', okPlain: undefined, overlaps: 'overlaps', screenError: 'error SLOT_OVERLAPS', plain: undefined, nothing: undefined, list: undefined,
  });
  for (const l of lines) assert.equal(l.meta.result, 'ok', '例外ではないので result は ok');
  assert.equal(t.returnLabel({ kind: 'x'.repeat(100) }).length, 40, '長い名前は 40 字で切る');
});

test('meta.returned は call だけに付ける (fetch の Response は ok: false を持つが、http.out の戻りは status で描く)', async () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2trace-'));
  const t = loadTracer(traceDir);
  const f = t.tracedFetch(async () => new Response('{}', { status: 409 }), { tier: 'frontend' });
  await t.withScenario('uc#resp', () => f('http://x/api'));
  const [line] = readTrace(traceDir);
  assert.equal(line.kind, 'http.out');
  assert.equal(line.meta.status, 409);
  assert.ok(!('returned' in line.meta));
  // call が Response をそのまま返しても、結果の型として読まない
  assert.equal(t.returnLabel(new Response('{}', { status: 409 })), undefined);
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
