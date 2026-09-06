'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const { parseTranscript, collectSession, aggregate, renderMarkdown, parseWeights, resolveSessionFiles } = require('../../../plugins/distillery/skills/dist-pipeline/scripts/tokenReport');

const fixtureDir = path.join(__dirname, 'fixtures', 'token-report');
const mainJsonl = path.join(fixtureDir, 'sess-1111.jsonl');

test('parseTranscript dedupes rows sharing a message.id and skips non-JSON lines', () => {
  const u = parseTranscript(mainJsonl);
  assert.equal(u.msgs, 3, 'msg_1 appears twice but counts once');
  assert.equal(u.input, 2 + 3 + 1);
  assert.equal(u.cache_creation, 1000 + 200 + 50);
  assert.equal(u.cache_read, 500 + 1500 + 1700);
  assert.equal(u.output, 10 + 20 + 5);
  assert.equal(u.max_context, 1 + 50 + 1700);
  assert.equal(u.model, 'claude-test');
  assert.equal(u.first_ts, '2026-09-01T00:00:01.000Z');
  assert.equal(u.last_ts, '2026-09-01T00:00:05.000Z');
});

test('parseTranscript extracts subagent_tokens only from queue-operation rows (empty value → null, user text ignored)', () => {
  const u = parseTranscript(mainJsonl);
  assert.deepEqual(u.notifications, { abc123: 1234, def456: null }, 'a <usage> or </task-notification> inside <result> must not break extraction');
  assert.equal('spoof' in u.notifications, false, 'notification-like text inside a user message must not be counted');
});

test('collectSession picks up subagents with meta and aggregate joins reported tokens', () => {
  const session = collectSession(mainJsonl);
  assert.equal(session.session, 'sess-1111');
  assert.deepEqual(session.subagents.map(s => s.id), ['abc123', 'def456']);
  assert.equal(session.subagents[0].meta.description, 'UC Spec 生成 G1');
  assert.equal(session.subagents[0].msgs, 2);
  assert.equal(session.subagents[0].cache_creation, 630);

  const report = aggregate([session]);
  assert.equal(report.agents.length, 3);
  const main = report.agents.find(a => a.agent === 'main');
  const sub = report.agents.find(a => a.agent === 'abc123');
  const sub2 = report.agents.find(a => a.agent === 'def456');
  assert.equal(main.reported_tokens, null);
  assert.equal(sub.reported_tokens, 1234);
  assert.equal(sub.spawn_depth, 1);
  assert.equal(sub2.reported_tokens, null);
  assert.equal(sub2.description, '');
  assert.equal(report.totals.agents, 3);
  assert.equal(report.totals.cache_creation, 1250 + 630 + 100);
  assert.equal(report.totals.cache_read, 3700 + 600 + 0);
  // cost with default weights: input*1 + cc*1.25 + cr*0.1 + out*0 (output is unreliable in transcripts)
  assert.equal(Math.round(main.cost), Math.round(6 * 1 + 1250 * 1.25 + 3700 * 0.1));
});

test('parseWeights overrides only known keys with finite non-negative values', () => {
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (m) => warnings.push(String(m));
  try {
    const w = parseWeights('cache_read=0.2,bogus=9,output=abc,input=Infinity,cache_creation=-1,input=,,output=2,input=2=garbage');
    assert.equal(w.cache_read, 0.2);
    assert.equal(w.output, 2, 'a later valid entry wins');
    assert.equal(w.input, 1, 'Infinity, empty and key=value=garbage are rejected');
    assert.equal(w.cache_creation, 1.25, 'negative is rejected');
    assert.equal('bogus' in w, false);
    assert.equal(warnings.length, 6);
  } finally {
    console.warn = origWarn;
  }
});

test('renderMarkdown lists agents by cost desc with a total row', () => {
  const report = aggregate([collectSession(mainJsonl)]);
  const md = renderMarkdown(report);
  const lines = md.split('\n');
  assert.ok(lines[0].startsWith('# Token report (sess-1111)'));
  const rows = lines.filter(l => l.startsWith('| sess-111'));
  assert.equal(rows.length, 3);
  assert.ok(rows[0].includes('| main |'), 'main has the highest cost');
  assert.ok(lines.some(l => l.startsWith('| **total** | 3 agents')));
  assert.ok(md.includes('UC Spec 生成 G1'));

  // description containing table-breaking characters is escaped
  const hostile = aggregate([collectSession(mainJsonl)]);
  hostile.agents[1].description = 'A | B\nsecond\rthird\r\nfourth';
  const hostileMd = renderMarkdown(hostile);
  const hostileRows = hostileMd.split('\n').filter(l => l.startsWith('| sess-111'));
  assert.equal(hostileRows.length, 3, 'no extra rows from a newline in description');
  assert.equal(hostileMd.includes('\r'), false, 'lone CR is escaped too');
  assert.ok(hostileRows.some(l => l.includes('A \\| B<br>second<br>third<br>fourth')));
});

test('resolveSessionFiles handles jsonl, session dir, project dir and --latest', () => {
  assert.deepEqual(resolveSessionFiles(mainJsonl, false), [mainJsonl]);
  assert.deepEqual(resolveSessionFiles(path.join(fixtureDir, 'sess-1111'), false), [mainJsonl]);
  assert.deepEqual(resolveSessionFiles(fixtureDir, false), [mainJsonl]);
  assert.deepEqual(resolveSessionFiles(fixtureDir, true), [mainJsonl]);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'token-report-empty-'));
  try {
    assert.throws(() => resolveSessionFiles(empty, false), /no \.jsonl/);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test('CLI writes token-report.md and token-report.json into --out', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'token-report-'));
  const stdout = execFileSync(process.execPath, [path.join(__dirname, '../../../plugins/distillery/skills/dist-pipeline', 'scripts', 'tokenReport.js'), mainJsonl, '--json', '--out', out], { encoding: 'utf-8' });
  const json = JSON.parse(fs.readFileSync(path.join(out, 'token-report.json'), 'utf-8'));
  assert.equal(json.totals.agents, 3);
  assert.ok(fs.existsSync(path.join(out, 'token-report.md')));
  assert.ok(stdout.includes('"totals"'));
  fs.rmSync(out, { recursive: true, force: true });
});
