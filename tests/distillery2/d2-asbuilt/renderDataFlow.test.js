'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-asbuilt/scripts');
const { buildFlows, renderFlowchart, renderSystemDataFlow } = require(path.join(SCRIPTS, 'renderDataFlow'));
const { buildTree, observedPlacements } = require(path.join(SCRIPTS, 'traceTree'));

let seq = 0;
function sp(kind, name, meta, parent) { return { ts: 't', ts_end: 't', seq: ++seq, parent, scenario: 'uc#s', kind, name, meta }; }

function sampleTraces() {
  seq = 0;
  const screen = sp('call', null, { component: '貸出受付画面', fn: 'submit', tier: 'frontend-staff', layer: 'screen' });
  const out = sp('http.out', '/api/v1/loans', { method: 'POST', url: '/api/v1/loans', status: 201, tier: 'frontend-staff', layer: 'api-client' }, screen.seq);
  const inn = sp('http.in', '/loans', { method: 'POST', path: '/loans', status: 201, operationId: 'createLoan', tier: 'backend-api', layer: 'presentation' }, out.seq);
  const uc = sp('call', null, { component: 'RegisterLoan', fn: 'execute', tier: 'backend-api', layer: 'usecase' }, inn.seq);
  const q1 = sp('db.query', null, { sql: 'SELECT * FROM books', tables: ['books'], component: 'LoanRepository', tier: 'backend-api', layer: 'repository' }, uc.seq);
  const q2 = sp('db.query', null, { sql: 'INSERT INTO loans', tables: ['loans'], component: 'LoanRepository', tier: 'backend-api', layer: 'repository' }, uc.seq);
  const pub = sp('publish', 'loan.registered', { message: 'loan.registered', channel: 'loans', component: 'RegisterLoan', tier: 'backend-api' }, uc.seq);
  const s1 = { scenario: 'uc#s1', lines: [q1, q2, pub, uc, inn, out, screen] };
  // 2 本目: 同じ経路で books を更新する (読み書き両方になる)
  const inn2 = sp('http.in', '/loans', { method: 'POST', path: '/loans', status: 409, operationId: 'createLoan', tier: 'backend-api', layer: 'presentation' });
  const uc2 = sp('call', null, { component: 'RegisterLoan', fn: 'execute', tier: 'backend-api', layer: 'usecase' }, inn2.seq);
  const q3 = sp('db.query', null, { sql: 'UPDATE books SET status', tables: ['books'], component: 'LoanRepository', tier: 'backend-api' }, uc2.seq);
  const s2 = { scenario: 'uc#s2', lines: [q3, uc2, inn2] };
  return [s1, s2];
}

test('buildFlows は全シナリオを合算し、読み書きを辺の種類で分ける', () => {
  const flows = buildFlows(sampleTraces(), { actor: '司書' });
  const text = renderFlowchart(flows);
  assert.match(text, /^flowchart LR/);
  assert.match(text, /n\d+\(\(司書\)\)/);
  assert.match(text, /subgraph n\d+\["frontend-staff"\]\n\s+n\d+\[貸出受付画面\]\n\s+end/);
  assert.match(text, /subgraph n\d+\["backend-api"\]/);
  assert.match(text, /\[createLoan （POST \/loans）\]/);
  assert.match(text, /\[\(books\)\]/);
  assert.match(text, />loan\.registered\]/);
  // books は s1 で読み、s2 で書く → 読/書
  const booksId = text.match(/(n\d+)\[\(books\)\]/)[1];
  const ucId = text.match(/(n\d+)\[RegisterLoan\]/)[1];
  assert.ok(text.includes(`${ucId} == 読/書 ==> ${booksId}`), text);
  const loansId = text.match(/(n\d+)\[\(loans\)\]/)[1];
  assert.ok(text.includes(`${ucId} == 書 ==> ${loansId}`));
  // 発行
  assert.match(text, /-- 発行 --> n\d+/);
  // 画面 → API は 1 本 (http.out 自身のノードは無い)
  assert.doesNotMatch(text, /\/api\/v1\/loans/);
  // 決定論
  assert.equal(renderFlowchart(buildFlows(sampleTraces(), { actor: '司書' })), text);
});

test('アクター起点の辺は、祖先が無いノードから引く', () => {
  const flows = buildFlows(sampleTraces(), { actor: '司書' });
  const text = renderFlowchart(flows);
  const actorId = text.match(/(n\d+)\(\(司書\)\)/)[1];
  const screenId = text.match(/(n\d+)\[貸出受付画面\]/)[1];
  const opId = text.match(/(n\d+)\[createLoan/)[1];
  assert.ok(text.includes(`${actorId} --> ${screenId}`));
  assert.ok(text.includes(`${actorId} --> ${opId}`), 's2 は画面を通らず API 直 → アクターから API へ');
});

test('observedPlacements はトレースに現れたティアとレイヤを返す', () => {
  const [s1] = sampleTraces();
  assert.deepEqual(observedPlacements(buildTree(s1.lines)), [
    { tier: 'backend-api', layers: ['presentation', 'repository', 'usecase'] },
    { tier: 'frontend-staff', layers: ['api-client', 'screen'] },
  ]);
});

test('renderSystemDataFlow は UC × テーブルの表と図を描く', () => {
  const index = { ucs: {
    'register-loan': { uc: '貸出を登録する', business: '貸出業務', tables_rw: { books: ['read', 'write'], loans: ['write'] } },
    'return-loan': { uc: '返却を登録する', business: '貸出業務', tables: ['loans'] },
  } };
  const md = renderSystemDataFlow(index);
  assert.match(md, /\| テーブル \| 貸出を登録する \| 返却を登録する \|/);
  assert.match(md, /\| books \| RW \| - \|/);
  assert.match(md, /\| loans \| W \| ● \|/);
  assert.match(md, /flowchart LR/);
  assert.match(md, /== 読\/書 ==>/);
  assert.equal(renderSystemDataFlow(index), md);
  assert.match(renderSystemDataFlow({ ucs: {} }), /トレースなし/);
});
