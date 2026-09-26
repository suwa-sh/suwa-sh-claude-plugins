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
