'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseYaml } = require('../../../plugins/distillery2/scripts/lib/yaml');

const SKILL = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-foundation');
const script = path.join(SKILL, 'scripts/genConfig.js');
const adrDir = path.join(__dirname, 'fixtures/adr');
const contractsFixture = path.join(__dirname, 'fixtures/contracts.json');
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'd2-config-')); }
function run(cwd, args) {
  const r = spawnSync(process.execPath, [script, '--cwd', cwd, ...args], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

test('genConfig: tiers/contracts/commands/capabilities correct and re-parseable', () => {
  const c = tmp();
  run(c, ['--adr', adrDir, '--contracts', contractsFixture, '--out', '.distillery/config.yaml']);
  const raw = fs.readFileSync(path.join(c, '.distillery/config.yaml'), 'utf8');
  const cfg = parseYaml(raw);
  // config-schema.md のキーが揃う
  for (const k of ['schema_version', 'docs_root', 'tiers', 'datastore_owner', 'contracts', 'commands', 'capabilities', 'models']) {
    assert.ok(k in cfg, `missing key ${k}`);
  }
  assert.equal(cfg.schema_version, '2.0');
  assert.equal(cfg.tiers.length, 3);
  const backend = cfg.tiers.find(t => t.id === 'backend-api');
  assert.equal(backend.dir, 'apps/backend-api');
  assert.equal(backend.kind, 'backend');
  assert.deepEqual(backend.provides, ['api']);
  assert.ok(backend.commands.unit.includes('-w apps/backend-api'));
  assert.ok(backend.commands.unit.includes('{report}'));
  const frontend = cfg.tiers.find(t => t.id === 'frontend');
  assert.deepEqual(frontend.consumes, ['api']);
  assert.equal(cfg.datastore_owner, 'backend-api');
  assert.equal(cfg.contracts.length, 3);
  assert.equal(cfg.capabilities.browser, false);
  assert.equal(cfg.capabilities.has_asyncapi, true);
  assert.equal(cfg.capabilities.has_design_system, true); // frontend tier あり
  assert.equal(cfg.models.verifier, 'claude-opus-5');
  assert.equal(cfg.models.implementer, null);
  // uc_bdd コマンドに {slug} プレースホルダがある
  assert.ok(cfg.commands.uc_bdd.includes('{slug}'));
});

test('genConfig: missing contracts file → contracts [] and warn', () => {
  const c = tmp();
  const r = run(c, ['--adr', adrDir, '--contracts', 'contracts/nope.json', '--out', '.distillery/config.yaml']);
  assert.ok(r.out.includes('WARN') && r.out.includes('not found'), r.out);
  const cfg = parseYaml(fs.readFileSync(path.join(c, '.distillery/config.yaml'), 'utf8'));
  assert.deepEqual(cfg.contracts, []);
  assert.equal(cfg.capabilities.has_asyncapi, false);
});
