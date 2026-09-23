'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { planGate, selectGates, GATES } = require('../../../plugins/distillery2/scripts/runGates');

const script = path.resolve(__dirname, '../../../plugins/distillery2/scripts/runGates.js');

function makeRepo(config) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-gates-'));
  fs.mkdirSync(path.join(repo, '.distillery'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.distillery/config.yaml'), config);
  return repo;
}

function run(repo, args) {
  try { return { code: 0, out: execFileSync(process.execPath, [script, '--cwd', repo, ...args], { encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status, out: e.stdout + e.stderr }; }
}

const CONFIG = [
  'schema_version: "2.0"',
  'tiers:',
  '  - id: api',
  '    dir: apps/api',
  '    kind: backend',
  '    commands:',
  '      lint: node -e "process.exit(0)"',
  '      unit: node -e "require(\'fs\').writeFileSync(process.argv[1], \'{}\'); process.exit(0)" {report}',
  '      contract: node -e "process.exit(3)"',
  '  - id: web',
  '    dir: apps/web',
  '    kind: frontend',
  '    commands:',
  '      unit: node -e "process.exit(0)"',
  'commands:',
  '  arch_test: node -e "process.exit(0)"',
  '  uc_bdd: node -e "process.exit(0)" {slug}',
  '  acceptance_api: node -e "process.exit(0)"',
  '  acceptance_browser: node -e "process.exit(1)"',
  'capabilities:',
  '  browser: false',
].join('\n');

test('selectGates honours --upto / --from / --only', () => {
  assert.deepEqual(selectGates({}), GATES);
  assert.deepEqual(selectGates({ upto: 'unit' }), ['static', 'unit']);
  assert.deepEqual(selectGates({ from: 'contract' }), ['contract', 'uc-bdd', 'acceptance']);
  assert.deepEqual(selectGates({ only: 'uc-bdd' }), ['uc-bdd']);
});

test('planGate substitutes slug and report paths and skips undefined commands', () => {
  const config = { tiers: [{ id: 'api', commands: { unit: 'x {report}' } }], commands: { uc_bdd: 'cuke {slug} {report}' }, capabilities: { browser: true } };
  const ctx = { slug: 'loan', reportsDir: '/r' };
  const unit = planGate('unit', config, ctx);
  assert.equal(unit.jobs[0].cmd, 'x /r/unit.api.json');
  const bdd = planGate('uc-bdd', config, ctx);
  assert.equal(bdd.jobs[0].cmd, 'cuke loan /r/uc-bdd.json');
  const acc = planGate('acceptance', config, ctx);
  assert.deepEqual(acc.jobs.map(j => j.skipped === true), [true, true]);
});

test('runs gates in order, stops at first failure, writes gates.json', () => {
  const repo = makeRepo(CONFIG);
  const r = run(repo, ['--uc', 'loan']);
  assert.equal(r.code, 1);
  const summary = JSON.parse(fs.readFileSync(path.join(repo, '.distillery/runs/loan/reports/gates.json'), 'utf8'));
  assert.deepEqual(summary.gates.map(g => [g.name, g.status]), [['static', 'pass'], ['unit', 'pass'], ['contract', 'fail']]);
  assert.equal(summary.result, 'fail');
  assert.ok(fs.existsSync(path.join(repo, '.distillery/runs/loan/reports/unit.api.json')), 'report path substituted');
  const contract = summary.gates[2];
  assert.equal(contract.jobs.find(j => j.tier === 'api').exit, 3);
  assert.equal(contract.jobs.find(j => j.tier === 'web').status, 'skipped');
});

test('--upto stops early and --expect-red inverts the verdict', () => {
  const repo = makeRepo(CONFIG);
  assert.equal(run(repo, ['--uc', 'loan', '--upto', 'unit']).code, 0);
  assert.equal(run(repo, ['--uc', 'loan', '--only', 'contract', '--expect-red', 'contract']).code, 0);
  assert.equal(run(repo, ['--uc', 'loan', '--only', 'unit', '--expect-red', 'unit']).code, 1);
});

test('acceptance runs browser command only when capabilities.browser is true', () => {
  const repo = makeRepo(CONFIG.replace('browser: false', 'browser: true'));
  const r = run(repo, ['--uc', 'loan', '--only', 'acceptance']);
  assert.equal(r.code, 1);
  const summary = JSON.parse(fs.readFileSync(path.join(repo, '.distillery/runs/loan/reports/gates.json'), 'utf8'));
  assert.deepEqual(summary.gates[0].jobs.map(j => [j.name, j.status]), [['acceptance_api', 'pass'], ['acceptance_browser', 'fail']]);
});
