'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');

const script = path.join(__dirname, '..', 'scripts', 'progress-update.js');

function run(statusPath, args) {
  return execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, DIST_PIPELINE_STATUS_PATH: statusPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('--tokens accumulates per step, ignores invalid values, and summary renders a table', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-update-'));
  const statusPath = path.join(dir, 'status.json');
  try {
    run(statusPath, ['init']);
    let status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    assert.ok(status.steps.every(s => s.tokens === null), 'init sets tokens: null');

    run(statusPath, ['step', '6', 'running', '--subagent-task', 'spec']);
    run(statusPath, ['step', '6', 'completed', '--summary', 'ok', '--event-id', 'spec:1', '--tokens', '134783']);
    run(statusPath, ['step', '6', 'completed', '--tokens', '1,000']);
    status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    const step6 = status.steps.find(s => String(s.id) === '6');
    assert.equal(step6.tokens, 135783, 'tokens are summed across calls (comma allowed)');
    assert.equal(step6.event_id, 'spec:1');

    // invalid values are ignored with a warning, existing total is kept
    for (const bad of ['abc', '12abc', '1.5', '1e3', '1,2,3', '-5', '']) {
      const r = spawnSync(process.execPath, [script, 'step', '6', 'completed', '--tokens', bad], {
        encoding: 'utf-8', env: { ...process.env, DIST_PIPELINE_STATUS_PATH: statusPath },
      });
      assert.equal(r.status, 0, `exit 0 for --tokens "${bad}"`);
      assert.ok(r.stderr.includes('warning'), `warning emitted for --tokens "${bad}"`);
    }
    status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    assert.equal(status.steps.find(s => String(s.id) === '6').tokens, 135783);

    const summary = run(statusPath, ['summary']);
    assert.ok(summary.includes('| Step | 状態 | tokens | event_id |'));
    assert.ok(summary.includes('| 6 | completed | 135,783 | spec:1 |'));
    assert.ok(summary.includes('| 1 | pending | - | - |'));
    assert.ok(summary.includes('| **合計** | | 135,783 | |'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resume carries over tokens and event_id of completed steps from the previous status', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-update-'));
  const statusPath = path.join(dir, 'status.json');
  try {
    run(statusPath, ['init']);
    run(statusPath, ['step', '1', 'running', '--tokens', '100']);
    run(statusPath, ['step', '1', 'completed', '--event-id', 'rdra:1']);
    run(statusPath, ['step', '2', 'running', '--tokens', '200']);
    run(statusPath, ['step', '2', 'completed', '--event-id', 'nfr:1']);
    run(statusPath, ['step', '3', 'running', '--tokens', '300']);
    run(statusPath, ['resume', '3']);
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    const byId = Object.fromEntries(status.steps.map(s => [String(s.id), s]));
    assert.equal(byId['1'].tokens, 100);
    assert.equal(byId['1'].event_id, 'rdra:1');
    assert.equal(byId['1'].state, 'completed');
    assert.equal(byId['2'].tokens, 200);
    assert.equal(byId['2'].event_id, 'nfr:1');
    assert.equal(byId['3'].tokens, 300, 'tokens recorded before the interruption are kept for the resumed step');
    assert.equal(byId['3'].state, 'pending', 'workflow state of the resumed step is reset');
    assert.equal(byId['3'].event_id, null);
    run(statusPath, ['step', '3', 'running', '--tokens', '50']);
    const summary = run(statusPath, ['summary']);
    assert.ok(summary.includes('| 1 | completed | 100 | rdra:1 |'));
    assert.ok(summary.includes('| 3 | running | 350 | - |'));
    assert.ok(summary.includes('| **合計** | | 650 | |'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('DIST_PIPELINE_STATUS_PATH keeps status out of the bundle directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-update-'));
  const statusPath = path.join(dir, 'status.json');
  try {
    const out = run(statusPath, ['init']);
    assert.ok(out.includes(statusPath));
    assert.ok(fs.existsSync(statusPath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
