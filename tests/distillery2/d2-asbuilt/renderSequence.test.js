'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-asbuilt/scripts');
const { renderScenario, parseTraceLines, sqlVerb } = require(path.join(SCRIPTS, 'renderSequence'));

function ev(kind, name, meta) { return { ts: '2026-09-23T10:00:00.000Z', scenario: 'register-loan#s', kind, name, meta }; }

test('sqlVerb は先頭動詞を大文字で返す', () => {
  assert.equal(sqlVerb('select * from books'), 'SELECT');
  assert.equal(sqlVerb('  INSERT INTO loans'), 'INSERT');
  assert.equal(sqlVerb(''), 'QUERY');
});

test('http.in はリクエストと応答の 2 本を描く', () => {
  const out = renderScenario([ev('http.in', 'backend-api', { method: 'POST', path: '/loans', status: 201, tier: 'backend-api' })]);
  assert.match(out, /^sequenceDiagram/);
  assert.match(out, /actor p0_.* as シナリオ実行者/);
  assert.match(out, /->>p1_backend_api: POST \/loans/);
  assert.match(out, /p1_backend_api-->>p0_.*: 201/);
});

test('連続する同一 db.query は (xN) にまとまる', () => {
  const lines = [
    ev('http.in', 'backend-api', { method: 'POST', path: '/loans', status: 201, tier: 'backend-api' }),
    ev('db.query', null, { sql: 'SELECT * FROM books', tables: ['books'], component: 'Repo' }),
    ev('db.query', null, { sql: 'SELECT * FROM books', tables: ['books'], component: 'Repo' }),
    ev('db.query', null, { sql: 'SELECT * FROM books', tables: ['books'], component: 'Repo' }),
    ev('db.query', null, { sql: 'INSERT INTO loans', tables: ['loans'], component: 'Repo' }),
  ];
  const out = renderScenario(lines);
  assert.match(out, /SELECT books \(x3\)/);
  assert.match(out, /INSERT loans/);
  assert.doesNotMatch(out, /INSERT loans \(x/);
});

test('publish は非同期矢印、http.out は External との往復', () => {
  const lines = [
    ev('publish', null, { message: 'loan.registered', channel: 'loans', component: 'Svc' }),
    ev('http.out', null, { method: 'GET', url: 'https://ext/x', status: 200, tier: 'backend-api' }),
  ];
  const out = renderScenario(lines);
  assert.match(out, /-\)p\d+_Broker: loan\.registered \[loans\]/);
  assert.match(out, /->>p\d+_External: GET https:\/\/ext\/x/);
  assert.match(out, /p\d+_External-->>p\d+_backend_api: 200/);
});

test('participant 宣言は初出順で決定論的', () => {
  const lines = [
    ev('http.in', 'backend-api', { method: 'POST', path: '/loans', status: 201, tier: 'backend-api' }),
    ev('call', null, { component: 'LoanService', fn: 'register', tier: 'backend-api' }),
    ev('db.query', null, { sql: 'INSERT INTO loans', tables: ['loans'], component: 'LoanRepo' }),
  ];
  const a = renderScenario(lines);
  const b = renderScenario(lines);
  assert.equal(a, b);
  const decls = a.split('\n').filter((l) => /(actor|participant) p\d+_/.test(l)).map((l) => l.trim());
  assert.match(decls[0], /^actor p0_+ as シナリオ実行者$/);
  assert.deepEqual(decls.slice(1), [
    'participant p1_backend_api as backend-api',
    'participant p2_LoanService as LoanService',
    'participant p3_LoanRepo as LoanRepo',
    'participant p4_DB as DB',
  ]);
});

test('60 行を超えると切って残数を注記する', () => {
  const lines = [];
  for (let i = 0; i < 40; i++) lines.push(ev('call', null, { component: `C${i}`, fn: 'do', tier: 'backend-api' }));
  // http.in を先頭に置き、tier を確定させる (call の src 解決のため)
  lines.unshift(ev('http.in', 'backend-api', { method: 'GET', path: '/x', status: 200, tier: 'backend-api' }));
  const out = renderScenario(lines, { maxLines: 10 });
  const body = out.split('\n').filter((l) => /(->>|-\)|-->>)/.test(l));
  assert.equal(body.length, 10);
  assert.match(out, /Note over p0_.*: 残り \d+ 行を省略 \(全 \d+ 行\)/);
});

test('parseTraceLines は空行と不正行を無視する', () => {
  const text = '{"kind":"call"}\n\nnot json\n{"kind":"publish"}\n';
  const lines = parseTraceLines(text);
  assert.equal(lines.length, 2);
});

test('空トレースでも sequenceDiagram と actor を出す', () => {
  const out = renderScenario([]);
  assert.match(out, /^sequenceDiagram/);
  assert.match(out, /actor p0_.* as シナリオ実行者/);
});
