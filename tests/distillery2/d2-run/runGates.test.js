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
  '    provides: [api]',  // 提供側だけ contract ゲートが回る (0.1.10 実走 ④-1)
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

test('contradictory ranges and expect-red outside the range are argument errors', () => {
  const repo = makeRepo(CONFIG);
  const a = run(repo, ['--uc', 'loan', '--from', 'unit', '--upto', 'static']);
  assert.equal(a.code, 2); assert.match(a.out, /empty gate range/);
  const b = run(repo, ['--uc', 'loan', '--only', 'static', '--expect-red', 'unit']);
  assert.equal(b.code, 2); assert.match(b.out, /outside the selected gates/);
});

test('a tier without a unit command fails the unit gate instead of passing silently', () => {
  const repo = makeRepo(CONFIG.replace(/    commands:\n      unit: node -e "process\.exit\(0\)"\n/, ''));
  const r = run(repo, ['--uc', 'loan', '--only', 'unit']);
  assert.equal(r.code, 1);
  assert.match(r.out, /required job\(s\) skipped.*web:unit/);
  // contract is required only for providers: web provides nothing → skipped is fine
  const c = run(repo, ['--uc', 'loan', '--only', 'contract', '--tiers', 'web']);
  assert.equal(c.code, 0, c.out);
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

test('static gate runs commands.quality (qlty) once for the repo, and skips it when undefined', () => {
  const ctx = { slug: 'loan', reportsDir: '/r' };
  const withQ = planGate('static', { tiers: [{ id: 'api', commands: { lint: 'l' } }], commands: { arch_test: 'a', quality: 'qlty check --all --no-fix' } }, ctx);
  const q = withQ.jobs.find(j => j.name === 'quality');
  assert.equal(q.cmd, 'qlty check --all --no-fix');
  assert.equal(q.tier, undefined, 'quality はティア単位ではなくリポ全体');
  const withoutQ = planGate('static', { tiers: [{ id: 'api', commands: { lint: 'l' } }], commands: { arch_test: 'a' } }, ctx);
  assert.equal(withoutQ.jobs.find(j => j.name === 'quality').skipped, true);
});

test('runs gates in order, stops at first failure, writes gates.json', () => {
  const repo = makeRepo(CONFIG);
  const r = run(repo, ['--uc', 'loan']);
  assert.equal(r.code, 1);
  const summary = JSON.parse(fs.readFileSync(path.join(repo, '.distillery/runs/loan/reports/gates.json'), 'utf8'));
  assert.deepEqual(summary.gates.map(g => [g.name, g.status]), [['static', 'pass'], ['unit', 'pass'], ['contract', 'fail'], ['uc-bdd', 'missing'], ['acceptance', 'missing']]);
  assert.equal(summary.result, 'fail');
  assert.equal(summary.all_recorded, false);
  assert.ok(fs.existsSync(path.join(repo, '.distillery/runs/loan/reports/unit.api.json')), 'report path substituted');
  const contract = summary.gates[2];
  assert.equal(contract.jobs.find(j => j.tier === 'api').exit, 3);
  assert.equal(contract.jobs.find(j => j.tier === 'web').status, 'skipped');
});

test('--upto stops early; partial runs merge into gates.json instead of overwriting', () => {
  const repo = makeRepo(CONFIG);
  assert.equal(run(repo, ['--uc', 'loan', '--upto', 'unit']).code, 0);
  let summary = JSON.parse(fs.readFileSync(path.join(repo, '.distillery/runs/loan/reports/gates.json'), 'utf8'));
  assert.deepEqual(summary.gates.map(g => [g.name, g.status]), [['static', 'pass'], ['unit', 'pass'], ['contract', 'missing'], ['uc-bdd', 'missing'], ['acceptance', 'missing']]);
  assert.equal(summary.all_recorded, false);
  assert.equal(run(repo, ['--uc', 'loan', '--only', 'uc-bdd']).code, 0);
  summary = JSON.parse(fs.readFileSync(path.join(repo, '.distillery/runs/loan/reports/gates.json'), 'utf8'));
  assert.deepEqual(summary.gates.map(g => [g.name, g.status]), [['static', 'pass'], ['unit', 'pass'], ['contract', 'missing'], ['uc-bdd', 'pass'], ['acceptance', 'missing']]);
  assert.deepEqual(summary.run_gates, ['uc-bdd']);
});

test('--expect-red accepts only assertion failures recorded in the report', () => {
  // unit passes → red expected but green → fail
  let repo = makeRepo(CONFIG);
  assert.equal(run(repo, ['--uc', 'loan', '--only', 'unit', '--expect-red', 'unit']).code, 1);
  // contract fails without {report} → cannot distinguish setup error → fail
  assert.equal(run(repo, ['--uc', 'loan', '--only', 'contract', '--expect-red', 'contract']).code, 1);
  // every job skipped (no uc_bdd command) → fail
  repo = makeRepo(CONFIG.replace(/  uc_bdd: .*\n/, ''));
  assert.equal(run(repo, ['--uc', 'loan', '--only', 'uc-bdd', '--expect-red', 'uc-bdd']).code, 1);
  // api unit writes a vitest-style report with failures and exits 1, but web unit passes → not every tier is red → fail
  const red = CONFIG.replace("unit: node -e \"require('fs').writeFileSync(process.argv[1], '{}'); process.exit(0)\" {report}", "unit: node -e \"require('fs').writeFileSync(process.argv[1], JSON.stringify({numFailedTests: 2})); process.exit(1)\" {report}");
  repo = makeRepo(red);
  let r = run(repo, ['--uc', 'loan', '--only', 'unit', '--expect-red', 'unit']);
  assert.equal(r.code, 1);
  assert.match(r.out, /passed: web/);
  // restrict to the UC's tier → red confirmed
  r = run(repo, ['--uc', 'loan', '--only', 'unit', '--expect-red', 'unit', '--tiers', 'api']);
  assert.equal(r.code, 0, r.out);
  const summary = JSON.parse(fs.readFileSync(path.join(repo, '.distillery/runs/loan/reports/gates.json'), 'utf8'));
  assert.match(summary.gates[1].note, /red baseline confirmed/);
  assert.equal(summary.gates[1].jobs.length, 1, 'web job filtered out by --tiers');
  // unknown tier → exit 2
  assert.equal(run(repo, ['--uc', 'loan', '--only', 'unit', '--tiers', 'nope']).code, 2);
  // report written but 0 failures although exit 1 → not red
  const zero = red.replace('{numFailedTests: 2}', '{numFailedTests: 0}');
  repo = makeRepo(zero);
  assert.equal(run(repo, ['--uc', 'loan', '--only', 'unit', '--expect-red', 'unit', '--tiers', 'api']).code, 1);
});

test('a stale report from a previous run is not reused as red evidence', () => {
  // first run: api unit writes a failing report
  const red = CONFIG.replace("unit: node -e \"require('fs').writeFileSync(process.argv[1], '{}'); process.exit(0)\" {report}", "unit: node -e \"require('fs').writeFileSync(process.argv[1], JSON.stringify({numFailedTests: 2})); process.exit(1)\" {report}");
  const repo = makeRepo(red);
  assert.equal(run(repo, ['--uc', 'loan', '--only', 'unit', '--expect-red', 'unit', '--tiers', 'api']).code, 0);
  const report = path.join(repo, '.distillery/runs/loan/reports/unit.api.json');
  assert.ok(fs.existsSync(report));
  // second run: command now crashes before writing a report (setup error) → the old report must not count
  fs.writeFileSync(path.join(repo, '.distillery/config.yaml'), red.replace("unit: node -e \"require('fs').writeFileSync(process.argv[1], JSON.stringify({numFailedTests: 2})); process.exit(1)\" {report}", 'unit: node -e "process.exit(1)" {report}'));
  const r = run(repo, ['--uc', 'loan', '--only', 'unit', '--expect-red', 'unit', '--tiers', 'api']);
  assert.equal(r.code, 1);
  assert.match(r.out, /no report written/);
  assert.equal(fs.existsSync(report), false, 'stale report deleted before the run');
});

test('acceptance runs browser command only when capabilities.browser is true', () => {
  const repo = makeRepo(CONFIG.replace('browser: false', 'browser: true'));
  const r = run(repo, ['--uc', 'loan', '--only', 'acceptance']);
  assert.equal(r.code, 1);
  const summary = JSON.parse(fs.readFileSync(path.join(repo, '.distillery/runs/loan/reports/gates.json'), 'utf8'));
  assert.deepEqual(summary.gates.find(g => g.name === 'acceptance').jobs.map(j => [j.name, j.status]), [['acceptance_api', 'pass'], ['acceptance_browser', 'fail']]);
});
