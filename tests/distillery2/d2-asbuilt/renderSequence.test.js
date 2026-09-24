'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-asbuilt/scripts');
const { renderScenario, parseTraceLines, sqlVerb, pickHappyPath, summarizeScenario } = require(path.join(SCRIPTS, 'renderSequence'));

// 旧形式 (seq 無し): ファイル順に並ぶ。http.in は応答完了時に書かれていた
function ev(kind, name, meta) { return { ts: '2026-09-23T10:00:00.000Z', scenario: 'register-loan#s', kind, name, meta }; }
// 新形式 (seq / parent): 開始順の seq と親 span
let seq = 0;
function sp(kind, name, meta, parent) { return { ts: '2026-09-23T10:00:00.000Z', ts_end: '2026-09-23T10:00:00.005Z', seq: ++seq, parent, scenario: 'register-loan#s', kind, name, meta }; }

test('sqlVerb は先頭動詞を大文字で返す', () => {
  assert.equal(sqlVerb('select * from books'), 'SELECT');
  assert.equal(sqlVerb('  INSERT INTO loans'), 'INSERT');
  assert.equal(sqlVerb(''), 'QUERY');
});

test('http.in はリクエストと応答の 2 本を描き、参加者は読める名前で id は p<n>', () => {
  const out = renderScenario([ev('http.in', 'backend-api', { method: 'POST', path: '/loans', status: 201, tier: 'backend-api' })], { actor: '司書' });
  assert.match(out, /^sequenceDiagram/);
  assert.match(out, /actor p0 as 司書/);
  assert.match(out, /participant p1 as backend-api/);
  assert.match(out, /p0->>p1: POST \/loans/);
  assert.match(out, /p1-->>p0: 201/);
  assert.doesNotMatch(out, /p0_/);
});

test('旧形式: http.in より前に並ぶ DB クエリは、その要求の中の出来事として要求と応答の間に描く', () => {
  const lines = [
    ev('db.query', null, { sql: 'SELECT * FROM books', tables: ['books'], component: 'Repo', tier: 'backend-api' }),
    ev('db.query', null, { sql: 'SELECT * FROM books', tables: ['books'], component: 'Repo', tier: 'backend-api' }),
    ev('db.query', null, { sql: 'SELECT * FROM books', tables: ['books'], component: 'Repo', tier: 'backend-api' }),
    ev('db.query', null, { sql: 'INSERT INTO loans', tables: ['loans'], component: 'Repo', tier: 'backend-api' }),
    ev('http.in', 'backend-api', { method: 'POST', path: '/loans', status: 201, tier: 'backend-api' }),
  ];
  const out = renderScenario(lines);
  const arrows = out.split('\n').filter((l) => /->>|-->>/.test(l)).map((l) => l.trim());
  assert.equal(arrows[0], 'p0->>p1: POST /loans');
  assert.match(arrows[1], /^p2->>p3: SELECT books \(x3\)$/);
  assert.match(arrows[2], /^p2->>p3: INSERT loans$/);
  assert.equal(arrows[3], 'p1-->>p0: 201');
  assert.match(out, /participant p2 as Repo/);
});

test('新形式: 画面 → API → ユースケース → リポジトリ → DB を入れ子で描き、ティアごとに box で囲む', () => {
  seq = 0;
  const screen = sp('call', '画面.submit', { component: '貸出受付画面', fn: 'submit', tier: 'frontend-staff', layer: 'screen' });
  const out = sp('http.out', '/api/v1/loans', { method: 'POST', url: '/api/v1/loans', status: 201, tier: 'frontend-staff' }, screen.seq);
  const inn = sp('http.in', '/loans', { method: 'POST', path: '/loans', status: 201, operationId: 'createLoan', tier: 'backend-api', layer: 'presentation' }, out.seq);
  const uc = sp('call', 'RegisterLoan.execute', { component: 'RegisterLoan', fn: 'execute', tier: 'backend-api', layer: 'usecase' }, inn.seq);
  const repo = sp('call', 'Repo.find', { component: 'LoanRepository', fn: 'find', tier: 'backend-api', layer: 'repository' }, uc.seq);
  const q1 = sp('db.query', 'query', { sql: 'SELECT * FROM books', tables: ['books'], component: 'LoanRepository', tier: 'backend-api' }, repo.seq);
  const q2 = sp('db.query', 'query', { sql: 'SELECT * FROM patrons', tables: ['patrons'], component: 'LoanRepository', tier: 'backend-api' }, repo.seq);
  const q3 = sp('db.query', 'query', { sql: 'INSERT INTO loans', tables: ['loans'], component: 'LoanRepository', tier: 'backend-api' }, uc.seq);
  // 完了順 (ファイルの実際の並び)
  const lines = [q1, q2, repo, q3, uc, inn, out, screen];
  const text = renderScenario(lines, { actor: '司書' });
  const arrows = text.split('\n').filter((l) => /->>|-->>/.test(l)).map((l) => l.trim());
  assert.deepEqual(arrows, [
    'p0->>+p1: submit',
    'p1->>p2: POST /loans',
    'p2->>+p3: execute',
    'p3->>+p4: find',
    'p4->>p5: SELECT books, patrons',
    'p4-->>-p3: ok',
    'p3->>p5: INSERT loans',
    'p3-->>-p2: ok',
    'p2-->>p1: 201',
    'p1-->>-p0: ok',
  ]);
  assert.match(text, /box transparent frontend-staff\n\s+participant p1 as 貸出受付画面\n\s+end/);
  assert.match(text, /box transparent backend-api\n\s+participant p2 as backend-api\n\s+participant p3 as RegisterLoan\n\s+participant p4 as LoanRepository\n\s+end/);
  // http.out 自身の矢印は描かない (画面 → API の 1 本にまとまる)
  assert.doesNotMatch(text, /\/api\/v1\/loans/);
});

test('publish は非同期矢印、外部への http.out はホストとの往復', () => {
  const lines = [
    ev('publish', null, { message: 'loan.registered', channel: 'loans', component: 'Svc' }),
    ev('http.out', null, { method: 'GET', url: 'https://ext/x', status: 200, tier: 'backend-api' }),
  ];
  const out = renderScenario(lines);
  assert.match(out, /p\d+-\)p\d+: loan\.registered \[loans\]/);
  assert.match(out, /participant p\d+ as Broker/);
  assert.match(out, /participant p\d+ as ext/);
  assert.match(out, /p0->>p\d+: GET https:\/\/ext\/x/);
  assert.match(out, /-->>p0: 200/);
});

test('参加者宣言は初出順で決定論的', () => {
  seq = 0;
  const inn = sp('http.in', '/loans', { method: 'POST', path: '/loans', status: 201, tier: 'backend-api' });
  const c = sp('call', null, { component: 'LoanService', fn: 'register', tier: 'backend-api' }, inn.seq);
  const q = sp('db.query', null, { sql: 'INSERT INTO loans', tables: ['loans'], component: 'LoanRepo', tier: 'backend-api' }, c.seq);
  const lines = [q, c, inn];
  const a = renderScenario(lines);
  const b = renderScenario(lines);
  assert.equal(a, b);
  const decls = a.split('\n').filter((l) => /(actor|participant) p\d+/.test(l)).map((l) => l.trim());
  assert.deepEqual(decls, [
    'actor p0 as シナリオ実行者',
    'participant p1 as backend-api',
    'participant p2 as LoanService',
    'participant p3 as DB',
  ]);
});

test('60 行を超えると切って残数を注記する', () => {
  seq = 0;
  const inn = sp('http.in', '/x', { method: 'GET', path: '/x', status: 200, tier: 'backend-api' });
  const lines = [];
  for (let i = 0; i < 40; i++) lines.push(sp('call', null, { component: `C${i}`, fn: 'do', tier: 'backend-api' }, inn.seq));
  lines.push(inn);
  const out = renderScenario(lines, { maxLines: 10 });
  const body = out.split('\n').filter((l) => /(->>|-\)|-->>)/.test(l));
  assert.equal(body.length, 10);
  assert.match(out, /Note over p0: 残り \d+ 行を省略 \(全 \d+ 行\)/);
});

test('pickHappyPath は 2xx を返したシナリオのうち最も行数の多いものを決定論的に選ぶ', () => {
  const t = (scenario, status, n) => ({ scenario, lines: [ev('http.in', 'b', { method: 'POST', path: '/x', status, tier: 'b' }), ...Array.from({ length: n }, () => ev('db.query', null, { sql: 'SELECT 1', tables: ['t'] }))] });
  const traces = [t('b', 409, 9), t('a', 201, 3), t('c', 201, 3)];
  assert.equal(pickHappyPath(traces).scenario, 'a');
  assert.equal(pickHappyPath([t('b', 409, 9), t('a', 404, 1)]).scenario, 'b');
  assert.equal(pickHappyPath([]), null);
});

test('summarizeScenario は応答・読み・書き・発行をまとめる', () => {
  const s = summarizeScenario([
    ev('http.in', 'b', { method: 'POST', path: '/x', status: 201, tier: 'b' }),
    ev('db.query', null, { sql: 'SELECT * FROM books', tables: ['books'] }),
    ev('db.query', null, { sql: 'UPDATE books SET x', tables: ['books'] }),
    ev('publish', null, { message: 'loan.registered' }),
  ]);
  assert.deepEqual(s, { status: '201', reads: ['books'], writes: ['books'], messages: ['loan.registered'] });
});

test('parseTraceLines は空行と不正行を無視する', () => {
  const text = '{"kind":"call"}\n\nnot json\n{"kind":"publish"}\n';
  const lines = parseTraceLines(text);
  assert.equal(lines.length, 2);
});

test('空トレースでも sequenceDiagram と actor を出す', () => {
  const out = renderScenario([]);
  assert.match(out, /^sequenceDiagram/);
  assert.match(out, /actor p0 as シナリオ実行者/);
});
