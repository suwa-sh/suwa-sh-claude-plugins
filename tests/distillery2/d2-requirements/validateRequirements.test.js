'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-requirements/scripts/validateRequirements.js');
const FIX = path.join(__dirname, 'fixtures');

function run(file) {
  return spawnSync(process.execPath, [SCRIPT, path.join(FIX, file)], { encoding: 'utf8' });
}

test('正しい requirements.yaml は PASS (exit 0)', () => {
  const r = run('requirements-pass.yaml');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS/);
  assert.match(r.stdout, /Specifications: 2/);
});

test('必須欠落の requirements.yaml は FAIL (exit 1)', () => {
  const r = run('requirements-fail.yaml');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /FAIL/);
  assert.match(r.stdout, /Missing required property/);
});
