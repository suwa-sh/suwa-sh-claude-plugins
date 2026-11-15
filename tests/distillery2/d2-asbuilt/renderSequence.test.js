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

// --- 並行の呼び出し・値で返した拒否・失敗した文 (実地確認の課題) ---------------------------

/** seq_end つきの span を作る小道具。start / end は論理時刻 (seq と同じ物差し) */
function span2(kind, name, meta, start, end, parent) {
  return { ts: '2026-11-10T00:00:00.000Z', ts_end: '2026-11-10T00:00:00.001Z', seq: start, seq_end: end, parent, scenario: 'view-room-availability#s', kind, name, meta };
}

function parallelTrace() {
  // 実地確認の形: usecase が listRooms と listReservations を Promise.all で呼ぶ。その後に順の呼び出しが 1 本
  const B = { tier: 'backend-api' };
  const inn = span2('http.in', '/room-availability', { method: 'GET', path: '/room-availability', status: 200, ...B }, 1, 12);
  const uc = span2('call', 'ViewRoomAvailability.execute', { component: 'ViewRoomAvailability', fn: 'execute', result: 'ok', ...B }, 2, 11, 1);
  const rooms = span2('call', 'Repo.listRooms', { component: 'Repo', fn: 'listRooms', result: 'ok', ...B }, 3, 7, 2);
  const q1 = span2('db.query', 'query', { sql: 'SELECT room_id FROM rooms', tables: ['rooms'], component: 'Repo', result: 'ok', ...B }, 4, 7, 3);
  const reservations = span2('call', 'Repo.listReservations', { component: 'Repo', fn: 'listReservations', result: 'ok', ...B }, 5, 8, 2);
  const q2 = span2('db.query', 'query', { sql: 'SELECT room_id FROM reservations', tables: ['reservations'], component: 'Repo', result: 'ok', ...B }, 6, 7, 5);
  const audit = span2('call', 'Repo.audit', { component: 'Repo', fn: 'audit', result: 'ok', ...B }, 8, 10, 2);
  const q3 = span2('db.query', 'query', { sql: 'INSERT INTO audits (id) VALUES ($1)', tables: ['audits'], component: 'Repo', result: 'ok', ...B }, 9, 10, 8);
  return [q1, q2, rooms, reservations, q3, audit, uc, inn];
}

test('並行に動いた兄弟の呼び出しは par / and / end で囲み、順の呼び出しは囲まない (実地確認: Promise.all の 2 本を順に描いた)', () => {
  const out = renderScenario(parallelTrace());
  const body = out.split('\n').slice(out.split('\n').findIndex((l) => /->>/.test(l)));
  assert.deepEqual(body, [
    '    p0->>p1: GET /room-availability',
    '    p1->>+p2: execute',
    '    par listRooms',
    '        p2->>+p3: listRooms',
    '        p3->>p4: SELECT rooms',
    '        p3-->>-p2: ok',
    '    and listReservations',
    '        p2->>+p3: listReservations',
    '        p3->>p4: SELECT reservations',
    '        p3-->>-p2: ok',
    '    end',
    '    p2->>+p3: audit',
    '    p3->>p4: INSERT audits',
    '    p3-->>-p2: ok',
    '    p2-->>-p1: ok',
    '    p1-->>p0: 200',
  ]);
  // seq_end の無いトレースは重なりを判定できないので、順に描く
  const noEnd = parallelTrace().map(({ seq_end, ...rest }) => rest);
  assert.doesNotMatch(renderScenario(noEnd), /\bpar\b/);
  // 時刻が同じミリ秒でも、順の呼び出しは並行にしない (判定は seq_end。時刻を使わない)
  const sequential = parallelTrace().map((l) => (l.name === 'Repo.listRooms' ? { ...l, seq_end: 5 } : l.kind === 'db.query' && l.seq === 4 ? { ...l, seq_end: 5 } : l));
  assert.doesNotMatch(renderScenario(sequential), /\bpar\b/);
});

test('overlapGroups: 3 本以上の並行と、組の途中で終わった span より後に始まる span', () => {
  const { overlapGroups } = require(path.join(SCRIPTS, 'traceTree'));
  const n = (s, e) => ({ seq: s, ev: { seq: s, seq_end: e } });
  const seqs = (groups) => groups.map((g) => g.map((x) => x.seq));
  assert.deepEqual(seqs(overlapGroups([n(1, 4), n(2, 4), n(3, 5), n(5, 6), n(6, 7)])), [[1, 2, 3], [5], [6]]);
  // a が先に終わっても、b がまだ動いている間に始まった c は同じ組
  assert.deepEqual(seqs(overlapGroups([n(1, 3), n(2, 9), n(4, 6)])), [[1, 2, 4]]);
  // seq_end の無い行は組を広げない
  assert.deepEqual(seqs(overlapGroups([{ seq: 1, ev: { seq: 1 } }, { seq: 2, ev: { seq: 2 } }])), [[1], [2]]);
  assert.deepEqual(overlapGroups([]), []);
});

test('途中で切るときは、開いたままの par を閉じる (閉じないと図が描けない)', () => {
  const lines = parallelTrace();
  const count = (text, re) => text.split('\n').filter((l) => re.test(l.trim())).length;
  for (let max = 1; max <= 16; max++) {
    const out = renderScenario(lines, { maxLines: max });
    assert.equal(count(out, /^par /), count(out, /^end$/), `maxLines=${max}: par と end の数が合う\n${out}`);
    // 中身の無い par / and で終わらない
    assert.doesNotMatch(out, /\n\s*(par|and) [^\n]*\n\s*end/, `maxLines=${max}\n${out}`);
  }
  assert.match(renderScenario(lines, { maxLines: 5 }), /end\n    Note over p0: 残り \d+ 行を省略/);
});

test('値で返した結果の種類 (meta.returned) を戻りの線の名前にする。例外は error、どちらでもなければ ok (実地確認: 業務の拒否を ok と描いた)', () => {
  const B = { tier: 'backend-api' };
  const inn = span2('http.in', '/reservations', { method: 'POST', path: '/reservations', status: 409, ...B }, 1, 9);
  const uc = span2('call', 'ReserveRoom.execute', { component: 'ReserveRoom', fn: 'execute', result: 'ok', returned: 'SLOT_OVERLAPS', ...B }, 2, 8, 1);
  const find = span2('call', 'Repo.findRoom', { component: 'Repo', fn: 'findRoom', result: 'ok', ...B }, 3, 5, 2);
  const q1 = span2('db.query', 'query', { sql: 'SELECT room_id FROM rooms', tables: ['rooms'], component: 'Repo', result: 'ok', ...B }, 4, 5, 3);
  const policy = span2('call', 'Policy.check', { component: 'Policy', fn: 'check', result: 'ok', returned: 'overlaps', ...B }, 5, 6, 2);
  const boom = span2('call', 'Repo.save', { component: 'Repo', fn: 'save', result: 'error', returned: 'ignored', ...B }, 6, 8, 2);
  const q2 = span2('db.query', 'query', { sql: 'INSERT INTO reservations (id) VALUES ($1)', tables: ['reservations'], component: 'Repo', result: 'error', ...B }, 7, 8, 6);
  const out = renderScenario([q1, find, policy, q2, boom, uc, inn]);
  const arrows = out.split('\n').filter((l) => /->>|-->>/.test(l)).map((l) => l.trim());
  assert.deepEqual(arrows, [
    'p0->>p1: POST /reservations',
    'p1->>+p2: execute',
    'p2->>+p3: findRoom',
    'p3->>p4: SELECT rooms',
    'p3-->>-p2: ok',
    // 子の無い呼び出しでも、値で返した結果の種類があれば戻りの線を描く
    'p2->>+p5: check',
    'p5-->>-p2: overlaps',
    'p2->>+p3: save',
    // 失敗した文は名前で分かるようにする
    'p3->>p4: INSERT reservations (失敗)',
    'p3-->>-p2: error',
    'p2-->>-p1: SLOT_OVERLAPS',
    'p1-->>p0: 409',
  ]);
});

test('失敗した文 (result が error。取り消された文) の表は、分岐の表の読み書きに数えず、成功した SELECT とまとめない (実地確認: 409 の経路の書き込みに表が載った)', () => {
  const lines = [
    ev('http.in', 'b', { method: 'POST', path: '/reservations', status: 409, tier: 'b' }),
    ev('db.query', null, { sql: 'SELECT * FROM rooms', tables: ['rooms'], result: 'ok', component: 'Repo' }),
    ev('db.query', null, { sql: 'SELECT * FROM locks', tables: ['locks'], result: 'error', component: 'Repo' }),
    ev('db.query', null, { sql: 'WITH inserted AS (INSERT INTO reservations (id) VALUES ($1) RETURNING id) INSERT INTO room_slot_occupancies (id) SELECT id FROM inserted', tables: ['reservations', 'room_slot_occupancies', 'inserted'], result: 'error', component: 'Repo' }),
    ev('db.query', null, { sql: 'UPDATE audits SET n = n + 1', tables: ['audits'], result: 'ok', component: 'Repo' }),
  ];
  assert.deepEqual(summarizeScenario(lines), { status: '409', reads: ['rooms'], writes: ['audits'], messages: [] });
  const out = renderScenario(lines);
  assert.match(out, /: SELECT rooms\n/);
  assert.match(out, /: SELECT locks \(失敗\)\n/);
  assert.match(out, /: WITH reservations, room_slot_occupancies \(失敗\)\n/);
  assert.match(out, /: UPDATE audits$/);
});
