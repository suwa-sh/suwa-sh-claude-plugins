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
