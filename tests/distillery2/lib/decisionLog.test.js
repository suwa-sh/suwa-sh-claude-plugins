'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPTS = path.join(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts');
const D = require(path.join(SCRIPTS, 'decisionLog'));

function handoff(dir) {
  const f = path.join(dir, 'foundation-1.json');
  fs.writeFileSync(f, JSON.stringify({
    schema_version: 'distillery2.handoff/v1', step: 'foundation', upstream_issues: [],
    asks: [
      { id: 'audit-store', kind: 'choice', question: '監査ログの保存先', options: [{ label: 'DB の表', impact: 'a' }, { label: 'ファイル', impact: 'b' }], recommended: 'DB の表' },
      { id: 'headcount', kind: 'unknown_fact', question: '社員数', options: [{ label: '100 人以下', impact: 'a' }, { label: '1000 人以上', impact: 'b' }], recommended: '100 人以下' },
    ],
  }));
  return f;
}

test('add --handoff: 問い・選択肢・推奨を写して記録し、事実の問いを推奨で決めたら仮置きにする', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-dlog-'));
  const f = handoff(root);
  D.add({ root, handoff: f, ask: 'audit-store', answer: 'DB の表', by: 'recommended' });
  D.add({ root, handoff: f, ask: 'headcount', answer: '100 人以下', by: 'recommended' });
  const lines = fs.readFileSync(path.join(root, '.distillery', 'decisions.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[0].id, 'handoff:foundation:audit-store');
  assert.deepEqual(lines[0].options, ['DB の表', 'ファイル']);
  assert.equal(lines[0].provisional, false);
  assert.equal(lines[1].provisional, true, 'unknown_fact を推奨で決めたら仮置き');
});

test('add: 答えが選択肢に無い・推奨と違うのに recommended と書く・page の形が違うを拒む', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-dlog-'));
  const f = handoff(root);
  assert.throws(() => D.add({ root, handoff: f, ask: 'audit-store', answer: 'クラウド', by: 'human' }), /選択肢に無い/);
  assert.throws(() => D.add({ root, handoff: f, ask: 'audit-store', answer: 'ファイル', by: 'recommended' }), /推奨と違う/);
  assert.throws(() => D.add({ root, page: 'requirements-approve', question: 'q', answer: '承認', by: 'human' }), /page:<step>:<question>/);
  assert.throws(() => D.add({ root, page: 'page:requirements:approve', question: 'q', answer: '承認', by: 'guess' }), /--by/);
});

test('add --page --run と list: 確認ページの問いを機能の記録に残し、上流と run の記録を時刻順にまとめる', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-dlog-'));
  const run = path.join(root, '.distillery', 'runs', 'submit-expense');
  fs.mkdirSync(run, { recursive: true });
  D.add({ root, page: 'page:requirements:approve', question: 'この要求で進めてよいか', answer: '承認', by: 'recommended' });
  D.add({ run, page: 'page:review:approve', question: 'この実装で進めてよいか', answer: '進める', by: 'human' });
  const archived = path.join(root, '.distillery', 'archive', 'runs', 'submit-expense', '20261103T000000Z');
  fs.mkdirSync(archived, { recursive: true });
  fs.writeFileSync(path.join(archived, 'decisions.jsonl'), `${JSON.stringify({ at: '2000-01-01T00:00:00Z', id: 'page:scenario:approve', question: '古い', answer: '承認', by: 'human' })}\n`);
  const all = D.list({ root });
  assert.equal(all.length, 3);
  assert.equal(all[0].question, '古い', '時刻順');
  assert.deepEqual(all.map((e) => e.where), ['.distillery/archive/runs/submit-expense/20261103T000000Z', 'upstream', '.distillery/runs/submit-expense']);
  assert.equal(D.list({ root, since: '2001-01-01T00:00:00Z' }).length, 2);
  const md = D.toMarkdown(all);
  assert.match(md, /\| この要求で進めてよいか \| 承認 \| 推奨 \|/);
  assert.match(md, /\| この実装で進めてよいか \| 進める \| 人 \|/);
});

test('CLI: list --format md と、引数の誤りは exit 2', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-dlog-'));
  execFileSync(process.execPath, [path.join(SCRIPTS, 'decisionLog.js'), 'add', '--root', root, '--page', 'page:decide:approve', '--question', 'この決定で進めてよいか', '--answer', '承認', '--by', 'recommended', '--provisional'], { encoding: 'utf8' });
  const md = execFileSync(process.execPath, [path.join(SCRIPTS, 'decisionLog.js'), 'list', '--root', root, '--format', 'md'], { encoding: 'utf8' });
  assert.match(md, /推奨 \(仮置き\)/);
  let code = 0;
  try { execFileSync(process.execPath, [path.join(SCRIPTS, 'decisionLog.js'), 'add', '--root', root], { encoding: 'utf8' }); } catch (e) { code = e.status; }
  assert.equal(code, 2);
});

test('add --handoff <findings>: 検証役の findings の問いも記録できる (3 ラウンド目)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-dlog-'));
  const run = path.join(root, '.distillery', 'runs', 'submit-expense');
  fs.mkdirSync(run, { recursive: true });
  const f = path.join(root, 'findings.frontend.json');
  fs.writeFileSync(f, JSON.stringify({ findings: [], upstream_issues: [], asks: [{ id: 'tz', kind: 'unknown_fact', question: '時刻の基準', options: [{ label: 'JST', impact: 'a' }, { label: 'UTC', impact: 'b' }], recommended: 'JST', reason: '利用者は国内' }] }));
  D.add({ run, handoff: f, ask: 'tz', answer: 'JST', by: 'recommended' });
  const e = JSON.parse(fs.readFileSync(path.join(run, 'decisions.jsonl'), 'utf8').trim());
  assert.equal(e.id, 'handoff:verify:tz');
  assert.equal(e.provisional, true);
});
