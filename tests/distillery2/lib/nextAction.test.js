'use strict';
// 0.3.0: 起動時の自動選択 (nextAction.js) の 11 段の順と、名指しの拒否
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2/skills');
const NA = require(path.join(PLUGIN, 'd2-common/scripts/nextAction'));
const rs = require(path.join(PLUGIN, 'd2-common/scripts/lib/runState'));

function g(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function w(root, rel, text) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
function commitAll(root, msg) { g(root, 'add', '-A'); g(root, 'commit', '-q', '-m', msg); return g(root, 'rev-parse', 'HEAD'); }

const UCS = (status = {}) => `use_cases:\n${['view-rooms', 'book-room', 'cancel-booking'].map((s) => `  - slug: ${s}\n    status: ${status[s] || 'planned'}\n`).join('')}`;

function repo({ initial = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-next-'));
  g(root, 'init', '-q', '-b', 'main');
  g(root, 'config', 'user.email', 't@example.com');
  g(root, 'config', 'user.name', 't');
  w(root, '.gitignore', '.distillery/logs/\n');
  if (initial) {
    w(root, 'docs/requirements/use-cases.yaml', UCS());
    w(root, 'docs/adr/0001-x.md', '# x\n');
    w(root, '.distillery/config.yaml', 'tiers: []\n');
  }
  commitAll(root, 'base');
  return root;
}

/** feature/<slug> を切って run を開く。blocked があれば上流で止める (issues は課題の id) */
function feature(root, slug, { blocked = null, resumed = false } = {}) {
  const base = g(root, 'rev-parse', 'main');
  g(root, 'switch', '-q', '-c', `feature/${slug}`);
  const run = rs.openRun(root, slug);
  rs.appendEvent(run, 'branch_started', { base_head: base });
  if (blocked) rs.appendEvent(run, 'blocked_on_upstream', { issues: blocked.map((id) => ({ id, target: 'decide' })) });
  if (resumed) rs.appendEvent(run, 'resumed_after_upstream', { base_head: base, from_head: base });
  commitAll(root, `impl(${slug}): x`);
  g(root, 'switch', '-q', 'main');
}

function issue(root, id, fm = 'target_step: decide') { w(root, `docs/feedback/${id}.md`, `---\n${fm}\n---\n本文\n`); }

test('1 最初の段: 要求 → 決定 → 基盤', () => {
  const root = repo({ initial: false });
  assert.equal(NA.decide(root).action, 'requirements');
  w(root, 'docs/requirements/use-cases.yaml', UCS());
  assert.equal(NA.decide(root).action, 'decide');
  w(root, 'docs/adr/0001-x.md', '# x\n');
  assert.equal(NA.decide(root).action, 'foundation');
  // 基盤が config を書いたが commit の前に止まった: まだ基盤
  w(root, '.distillery/config.yaml', 'tiers: []\n');
  assert.equal(NA.decide(root).action, 'foundation', 'config が main に無ければ基盤の途中');
  commitAll(root, 'foundation');
  assert.notEqual(NA.decide(root).action, 'foundation');
});

test('2 片付け: main の run に main マージの done がある feature と、main に入った upstream/*', () => {
  const root = repo();
  feature(root, 'book-room');
  w(root, '.distillery/runs/book-room/stages/deliver.done.yaml', 'stage: deliver\n');
  commitAll(root, 'delivered');
  g(root, 'branch', 'upstream/i1');
  const r = NA.decide(root);
  assert.equal(r.action, 'cleanup');
  assert.deepEqual(r.features, [{ slug: 'book-room', legacy: false }]);
  assert.deepEqual(r.upstream, ['upstream/i1']);
});

test('3 進行中の機能は、写し直し待ちより・上流の課題より先', () => {
  const root = repo();
  issue(root, 'd1');
  commitAll(root, 'issue');
  feature(root, 'view-rooms', { blocked: ['gone'] });
  feature(root, 'book-room');
  assert.deepEqual(NA.decide(root), { action: 'continue-feature', slug: 'book-room' });
});

test('3 写し直した後に再び止めた機能は止まっている (最後の止まりで判定する)', () => {
  const root = repo();
  const base = g(root, 'rev-parse', 'main');
  g(root, 'switch', '-q', '-c', 'feature/book-room');
  const run = rs.openRun(root, 'book-room');
  rs.appendEvent(run, 'branch_started', { base_head: base });
  rs.appendEvent(run, 'blocked_on_upstream', { issues: [{ id: 'a', target: 'decide' }] });
  rs.appendEvent(run, 'resumed_after_upstream', { base_head: base, from_head: base });
  rs.appendEvent(run, 'blocked_on_upstream', { issues: [{ id: 'b', target: 'decide' }] });
  commitAll(root, 'x');
  g(root, 'switch', '-q', 'main');
  issue(root, 'b');
  commitAll(root, 'issue b');
  const r = NA.decide(root);
  assert.equal(r.action, 'decide-diff');
  assert.deepEqual(r.notes.paused, [{ slug: 'book-room', waiting_on: ['b'] }]);
});

test('4 途中の写し直し (処理の記録) と、main に入っていない upstream/*', () => {
  const root = repo();
  feature(root, 'book-room', { blocked: ['gone'] });
  w(root, '.distillery/logs/resume-book-room.json', '{}');
  assert.deepEqual(NA.decide(root), { action: 'finish-resume', slug: 'book-room' });
  fs.rmSync(path.join(root, '.distillery/logs'), { recursive: true });
  g(root, 'switch', '-q', '-c', 'upstream/i9');
  w(root, 'docs/adr/0002-y.md', '# y\n');
  commitAll(root, 'decide: wip');
  g(root, 'switch', '-q', 'main');
  assert.deepEqual(NA.decide(root), { action: 'continue-upstream', branch: 'upstream/i9', issue: 'i9' });
});

test('5 以降は main の作業ツリーを読むので、main でなければ切り替えを返す', () => {
  const root = repo();
  g(root, 'switch', '-q', '-c', 'scratch');
  assert.deepEqual(NA.decide(root), { action: 'switch-main', from: 'scratch' });
});

test('5 push のやり直しは写し直しより先', () => {
  const root = repo();
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-next-remote-'));
  g(remote, 'init', '-q', '--bare', '-b', 'main');
  g(root, 'remote', 'add', 'origin', remote);
  g(root, 'push', '-q', 'origin', 'main');
  feature(root, 'book-room', { blocked: ['gone'] });
  w(root, 'x.txt', 'x');
  commitAll(root, 'ahead');
  assert.deepEqual(NA.decide(root), { action: 'push', ahead: 1 });
});

test('6 写し直し待ち (止めた課題がすべて main から消えた) は、旧形式・上流の課題・次の機能より先', () => {
  const root = repo();
  feature(root, 'book-room', { blocked: ['i1'] });
  issue(root, 'd2');
  commitAll(root, 'other issue');
  assert.deepEqual(NA.decide(root), { action: 'resume', slug: 'book-room' });
});

test('7 移行: main マージ済みで課題ファイルにしていない run', () => {
  const root = repo();
  const run = rs.openRun(root, 'view-rooms');
  rs.markDone(run, 'deliver');
  w(root, '.distillery/runs/view-rooms/issues/x.md', '---\ntarget_step: decide\n---\n');
  commitAll(root, 'x');
  assert.equal(NA.decide(root).action, 'migrate');
});

test('8 連鎖の上限超えは上流の課題より先。人が「続ける」と答えた連鎖は上流の課題に戻る', () => {
  const root = repo();
  issue(root, 'deep', 'target_step: decide\nchain: root1\nchain_depth: 4');
  issue(root, 'other', 'target_step: foundation');
  commitAll(root, 'issues');
  const r = NA.decide(root);
  assert.equal(r.action, 'limit-chain');
  assert.deepEqual(r.chains, [{ chain: 'root1', depth: 4, issues: ['deep'] }]);
  w(root, '.distillery/decisions.jsonl', JSON.stringify({ id: 'page:limit:chain:root1', answer: '続ける (上限を超えて直す)' }) + '\n');
  assert.deepEqual(NA.decide(root).issues, ['deep']);
});

test('9 上流の課題は 要求 → 決定 → 基盤 の順。上流で止めた機能の課題が残る間は写し直さない', () => {
  const root = repo();
  feature(root, 'book-room', { blocked: ['f1'] });
  issue(root, 'f1', 'target_step: foundation');
  issue(root, 'd1', 'target_step: decide');
  issue(root, 'r1', 'kind: requirement\ntarget_step: requirements');
  commitAll(root, 'issues');
  assert.equal(NA.decide(root).action, 'requirements-diff');
  fs.rmSync(path.join(root, 'docs/feedback/r1.md'));
  assert.deepEqual(NA.decide(root).issues, ['d1']);
  fs.rmSync(path.join(root, 'docs/feedback/d1.md'));
  assert.deepEqual(NA.decide(root).issues, ['f1']);
});

test('10 開き直しは次の機能より先。11 次の機能は上流で止めた機能を飛ばす', () => {
  const root = repo();
  w(root, 'docs/requirements/use-cases.yaml', UCS({ 'view-rooms': 'done' }));
  rs.markDone(rs.openRun(root, 'view-rooms'), 'deliver');
  issue(root, 'c1', 'target_step: contract\nfrom_uc: view-rooms');
  commitAll(root, 'x');
  feature(root, 'book-room', { blocked: ['waiting'] });
  issue(root, 'waiting', 'target_step: plugin\nkind: plugin');
  commitAll(root, 'waiting stays (plugin)');
  assert.equal(NA.decide(root).action, 'reopen');
  fs.rmSync(path.join(root, 'docs/feedback/c1.md'));
  assert.deepEqual({ ...NA.decide(root), notes: undefined }, { action: 'uc', slug: 'cancel-booking', notes: undefined });
});

test('名指し: 進行中・途中・写し直し待ちが名指しと別にあれば拒む。名指し自身なら続ける。反映待ちの機能は課題を示して拒む', () => {
  const root = repo();
  feature(root, 'book-room');
  assert.equal(NA.decide(root, { uc: 'cancel-booking' }).action, 'refuse');
  assert.equal(NA.decide(root, { stage: 'requirements' }).action, 'refuse');
  assert.deepEqual(NA.decide(root, { uc: 'book-room' }), { action: 'continue-feature', slug: 'book-room' });
  const root2 = repo();
  feature(root2, 'book-room', { blocked: ['b1'] });
  issue(root2, 'b1');
  commitAll(root2, 'issue');
  assert.deepEqual(NA.decide(root2, { uc: 'book-room' }), { action: 'refuse', reason: '上流の課題の反映待ち', slug: 'book-room', waiting_on: ['b1'] });
  assert.equal(NA.decide(root2, { uc: 'cancel-booking' }).action, 'uc');
});
