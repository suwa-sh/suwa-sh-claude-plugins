'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const rs = require('../../../plugins/distillery2/scripts/lib/runState');

test('open, events, done, status, invalidate, attempts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'register-loan', { uc: '貸出業務/書籍を貸し出すフロー/貸出を登録する' });
  assert.equal(dir, path.join(root, '.distillery', 'runs', 'register-loan'));
  assert.equal(rs.readEvents(dir).length, 1);
  rs.openRun(root, 'register-loan');
  assert.equal(rs.readEvents(dir).length, 1, 'reopen does not duplicate run_opened');

  rs.appendEvent(dir, 'scenario_approved', { by: 'user' });
  rs.markDone(dir, 'scenario', { commit: 'abc' });
  assert.equal(rs.isDone(dir, 'scenario'), true);
  assert.equal(rs.readDone(dir, 'scenario').commit, 'abc');

  let s = rs.status(dir);
  assert.equal(s.stages.scenario, 'done');
  assert.equal(s.next_stage, 'contract');
  assert.equal(s.attempt, 1);
  assert.equal(s.events, 3);

  rs.attemptDir(dir, 2);
  assert.equal(rs.currentAttempt(dir), 2);

  const moved = rs.invalidate(dir, 'scenario', 'requirements changed');
  assert.ok(fs.existsSync(moved));
  assert.equal(rs.isDone(dir, 'scenario'), false);
  s = rs.status(dir);
  assert.equal(s.next_stage, 'scenario');
  assert.equal(s.last_event.type, 'stage_invalidated');
  assert.equal(rs.invalidate(dir, 'scenario', 'again'), null);
});

test('invalidateFrom: その段階と後ろの段階の done をまとめて退避する (as-built から integrate へ戻すとき。0.1.23)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'register-return');
  for (const s of ['scenario', 'contract', 'scaffold', 'tier', 'contract-gate', 'integrate', 'verify', 'review', 'feedback']) rs.markDone(dir, s, {});
  const moved = rs.invalidateFrom(dir, 'integrate', 'as-built に計装なしのティア');
  assert.deepEqual(moved.map(p => path.basename(p).replace(/^\d+_\d+_/, '')), ['integrate.done.yaml', 'verify.done.yaml', 'review.done.yaml', 'feedback.done.yaml'], 'done の無い asbuilt は飛ばす');
  const s = rs.status(dir);
  assert.equal(s.next_stage, 'integrate');
  assert.equal(s.stages.tier, 'done', '前の段階は残す');
  assert.throws(() => rs.invalidateFrom(dir, 'nope', 'x'), /unknown stage/);
  // CLI
  rs.markDone(dir, 'integrate', {});
  rs.markDone(dir, 'verify', {});
  const cli = require('node:child_process').execFileSync('node', [path.resolve(__dirname, '../../../plugins/distillery2/scripts/lib/runState.js'), 'invalidate', dir, 'integrate', 'again', '--from'], { encoding: 'utf8' });
  assert.equal(cli.trim().split('\n').length, 2);
  assert.equal(rs.status(dir).next_stage, 'integrate');
});

test('returnToIntegrate: findings の退避 → integrate 以降の done の退避 → イベントを 1 操作で行い、何度戻っても上書きしない (0.1.23)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'register-return');
  for (const s of ['scenario', 'contract', 'scaffold', 'tier', 'contract-gate', 'integrate', 'verify', 'review']) rs.markDone(dir, s, {});
  const a1 = rs.attemptDir(dir, 1);
  fs.writeFileSync(path.join(a1, 'findings.backend-api.yaml'), 'v: 1\n');
  fs.writeFileSync(path.join(a1, 'findings.frontend.yaml'), 'v: 1\n');
  fs.writeFileSync(path.join(a1, 'assumptions.backend-api.yaml'), 'keep: true\n');
  const r = rs.returnToIntegrate(dir, { instrumentation_gaps: ['backend-api'], instrumentation_happy_gaps: [] });
  assert.equal(r.moved_findings.length, 2);
  assert.ok(r.moved_findings.every(p => /^invalidated\/\d{8}_\d{6}_attempt-1_findings\.[a-z-]+\.yaml$/.test(p)), r.moved_findings.join(','));
  assert.deepEqual(fs.readdirSync(a1), ['assumptions.backend-api.yaml'], 'findings だけ移し、assumptions は残す');
  assert.equal(r.invalidated.length, 3, 'integrate・verify・review の done');
  const s = rs.status(dir);
  assert.equal(s.next_stage, 'integrate');
  assert.equal(s.attempt, 1, 'attempt は上げない');
  const ev = rs.readEvents(dir).filter(e => e.type === 'returned_to_integrate');
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0].instrumentation_gaps, ['backend-api']);
  assert.deepEqual(ev[0].moved_findings, r.moved_findings);
  // 同じ attempt でもう一度戻る (同じ秒でも上書きしない)
  rs.markDone(dir, 'integrate', {}); rs.markDone(dir, 'verify', {});
  fs.writeFileSync(path.join(a1, 'findings.backend-api.yaml'), 'v: 2\n');
  const r2 = rs.returnToIntegrate(dir, { instrumentation_gaps: ['backend-api'] });
  assert.equal(r2.moved_findings.length, 1);
  const all = fs.readdirSync(path.join(dir, 'invalidated')).filter(n => n.includes('findings.backend-api'));
  assert.equal(all.length, 2, '1 回目の退避を上書きしない');
  // CLI
  const out = require('node:child_process').execFileSync('node', [path.resolve(__dirname, '../../../plugins/distillery2/scripts/lib/runState.js'), 'return-to-integrate', dir, '{"instrumentation_gaps":[]}'], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out).moved_findings, []);
});

test('pendingFeedback: 保留と解消 (新形式・旧形式)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'register-return');
  assert.deepEqual(rs.pendingFeedback(dir), [], '還流が無ければ空');

  // 新形式の保留
  rs.appendEvent(dir, 'feedback_deferred', { kind: 'contract', issue_path: 'issues/a.md', reason: 'headless' });
  // 0.1.18 以前の記録: url 空の feedback_filed (issue をパスとみなす)。絶対パスでも issues/ 以降で照合する
  rs.appendEvent(dir, 'feedback_filed', { kind: 'requirement', issue: '/repo/.distillery/runs/register-return/issues/b.md', url: null, status: 'deferred' });
  let p = rs.pendingFeedback(dir);
  assert.deepEqual(p.map(x => [x.kind, x.issue_path]), [['contract', 'issues/a.md'], ['requirement', 'issues/b.md']]);
  assert.equal(p[0].reason, 'headless');
  assert.deepEqual(rs.status(dir).pending_feedback.map(x => x.issue_path), ['issues/a.md', 'issues/b.md'], 'status に載る');

  // 起票 (url 付き filed) で解消。旧形式の issue キーでも照合する
  rs.appendEvent(dir, 'feedback_filed', { kind: 'contract', issue_path: 'issues/a.md', url: 'https://example/pr/1' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'requirement', issue: 'issues/b.md', url: 'https://example/issues/2' });
  assert.deepEqual(rs.pendingFeedback(dir), []);

  // url 付きでも別の issue は解消しない / issue パスの無い保留は残る
  rs.appendEvent(dir, 'feedback_deferred', { kind: 'rule', issue_path: 'issues/c.md', reason: 'no remote' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'rule', issue_path: 'issues/other.md', url: 'https://example/pr/3' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'contract', url: '' });
  p = rs.pendingFeedback(dir);
  assert.deepEqual(p.map(x => x.issue_path), ['issues/c.md', null]);
});

test('段階の順 (0.1.26): 配送 (deliver) が還流 (feedback) の前', () => {
  assert.deepEqual(rs.STAGES.slice(-3), ['asbuilt', 'deliver', 'feedback']);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'uc');
  for (const s of rs.STAGES.slice(0, rs.STAGES.indexOf('asbuilt') + 1)) rs.markDone(dir, s);
  assert.equal(rs.status(dir).next_stage, 'deliver');
  rs.markDone(dir, 'deliver', { squash: 'abc' });
  assert.equal(rs.status(dir).next_stage, 'feedback');
  assert.equal(rs.status(dir).legacy_order, false);
});

test('feedback_filed の ref (0.1.26) でも起票済み。filedIssues は ref / url 付きだけ', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'uc');
  rs.appendEvent(dir, 'feedback_deferred', { kind: 'rule', issue_path: 'issues/a.md', reason: 'old' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'rule', ref: '0123abc', issue_path: 'issues/a.md' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'requirement', ref: 'docs/feedback/b.md', issue_path: 'issues/b.md' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'contract', url: 'https://example/pr/1', issue_path: 'issues/c.md' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'contract', ref: '', issue_path: 'issues/d.md' });
  assert.deepEqual(rs.pendingFeedback(dir).map(x => x.issue_path), ['issues/d.md']);
  assert.deepEqual(rs.filedIssues(dir), ['issues/a.md', 'issues/b.md', 'issues/c.md']);
});

test('旧形式の順 (還流 done・配送 done 無し) は次の段階を出さず、mark-legacy-delivered で配送済みにする', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'uc');
  for (const s of rs.STAGES) if (s !== 'deliver') rs.markDone(dir, s);
  let st = rs.status(dir);
  assert.equal(st.legacy_order, true);
  assert.equal(st.next_stage, null);
  const out = require('node:child_process').execFileSync('node', [path.resolve(__dirname, '../../../plugins/distillery2/scripts/lib/runState.js'), 'mark-legacy-delivered', dir], { encoding: 'utf8' });
  assert.equal(JSON.parse(out).legacy, true);
  st = rs.status(dir);
  assert.equal(st.legacy_order, false);
  assert.equal(st.next_stage, null, '全段 done');
  assert.equal(rs.readDone(dir, 'deliver').legacy, true);
  // 旧形式でない run には使えない
  const dir2 = rs.openRun(root, 'uc2');
  assert.throws(() => rs.markLegacyDelivered(dir2), /旧形式/);
});
