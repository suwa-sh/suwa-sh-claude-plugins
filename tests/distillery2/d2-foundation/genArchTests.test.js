'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { globToRe } = require('../../../plugins/distillery2/skills/d2-foundation/scripts/genArchTests');

const script = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-foundation/scripts/genArchTests.js');
const adrDir = path.join(__dirname, 'fixtures/adr');
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'd2-arch-')); }
function run(cwd, args) {
  try { return { code: 0, out: execFileSync(process.execPath, [script, '--cwd', cwd, ...args], { encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}

test('genArchTests: forbidden rule generated from arch_test', () => {
  const c = tmp();
  run(c, ['--adr', adrDir, '--out', '.dependency-cruiser.cjs']);
  const src = fs.readFileSync(path.join(c, '.dependency-cruiser.cjs'), 'utf8');
  assert.ok(src.includes("name: \"adr-0002-1\""), 'missing adr-0002-1');
  assert.ok(src.includes("name: \"adr-0002-2\""), 'missing adr-0002-2');
  assert.ok(src.includes('no-circular') && src.includes('no-orphans'), 'defaults missing');
  // proposed ADR の arch_test は出ない
  assert.ok(!src.includes('adr-0004'), 'proposed arch_test leaked');
});

test('genArchTests: generated file is valid JS and loadable', () => {
  const c = tmp();
  run(c, ['--adr', adrDir, '--out', '.dependency-cruiser.cjs']);
  const file = path.join(c, '.dependency-cruiser.cjs');
  // require が例外なく通ること
  execFileSync(process.execPath, ['-e', `const cfg = require(${JSON.stringify(file)}); if(!Array.isArray(cfg.forbidden)) process.exit(5);`]);
  const cfg = require(file);
  assert.ok(cfg.forbidden.some(r => r.name === 'adr-0002-1' && r.from.path && r.to.path));
});

test('genArchTests: deterministic', () => {
  const a = tmp(), b = tmp();
  run(a, ['--adr', adrDir, '--out', 'x.cjs']);
  run(b, ['--adr', adrDir, '--out', 'x.cjs']);
  assert.equal(fs.readFileSync(path.join(a, 'x.cjs'), 'utf8'), fs.readFileSync(path.join(b, 'x.cjs'), 'utf8'));
});

test('globToRe converts ** and escapes dots', () => {
  assert.equal(globToRe('apps/backend-api/src/domain/**'), '^apps/backend-api/src/domain/.*');
  assert.equal(globToRe('a.b/**'), '^a\\.b/.*');
  assert.equal(globToRe('a/*/b'), '^a/[^/]*/b');
});

// --check は還流の受理 (d2-run) が使う。書かずに古さだけ見る (0.1.24)
test('genArchTests --check: 生成直後は exit 0、arch_test を変えると exit 1、書き込みは起きない', () => {
  const c = tmp();
  const adr = path.join(c, 'adr');
  fs.cpSync(adrDir, adr, { recursive: true });
  run(c, ['--adr', adr, '--out', '.dependency-cruiser.cjs']);
  const out = path.join(c, '.dependency-cruiser.cjs');
  const ok = run(c, ['--adr', adr, '--out', '.dependency-cruiser.cjs', '--check']);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /up to date/);
  const before = fs.readFileSync(out, 'utf8');
  const f = path.join(adr, '0002-layers.md');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('domain は infrastructure に依存しない。', 'domain は infrastructure に依存しない (変更)。'));
  const ng = run(c, ['--adr', adr, '--out', '.dependency-cruiser.cjs', '--check']);
  assert.equal(ng.code, 1, ng.out);
  assert.match(ng.out, /STALE/);
  assert.equal(fs.readFileSync(out, 'utf8'), before);
});

test('genArchTests --check: 生成物が無ければ exit 1 で、作らない', () => {
  const c = tmp();
  const r = run(c, ['--adr', adrDir, '--out', '.dependency-cruiser.cjs', '--check']);
  assert.equal(r.code, 1, r.out);
  assert.ok(!fs.existsSync(path.join(c, '.dependency-cruiser.cjs')));
});
