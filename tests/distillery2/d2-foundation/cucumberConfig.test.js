'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const SKILL = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-foundation');
const adrDir = path.join(__dirname, 'fixtures/adr');
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'd2-cucumber-')); }
function gen(script, cwd, args) {
  execFileSync(process.execPath, [path.join(SKILL, 'scripts', script), '--cwd', cwd, ...args], { encoding: 'utf8' });
}

test('生成した cucumber.js は ESM で node が読める (module is not defined にならない)', async () => {
  const c = tmp();
  gen('genSkeleton.js', c, ['--adr', adrDir]); // package.json ("type":"module") を書く
  gen('genTestSupport.js', c, []);             // cucumber.js と tsx-register.js を展開

  const cucumber = fs.readFileSync(path.join(c, 'cucumber.js'), 'utf8');
  assert.match(cucumber, /export default/);
  assert.doesNotMatch(cucumber, /module\.exports\s*=/);
  assert.ok(fs.existsSync(path.join(c, 'tsx-register.js')), 'tsx-register.js should exist');

  // 設定を ESM として評価できること (import[] は文字列なので tsx 未インストールでも exit 0)
  const r = spawnSync(process.execPath, ['cucumber.js'], { cwd: c, encoding: 'utf8' });
  assert.equal(r.status, 0, `node cucumber.js failed: ${r.stderr}`);
  assert.doesNotMatch(r.stderr || '', /module is not defined/);

  // default export は既定プロファイルそのもの ({ default: {...} } で包まない) で dryrun を追加 export する。
  // ESM モジュールを動的 import して形を検査する。
  const mod = await import('file://' + path.join(c, 'cucumber.js'));
  assert.ok(Array.isArray(mod.default.paths), 'default export に paths[] がある (既定プロファイル)');
  assert.equal(mod.default.default, undefined, 'default export を { default: {...} } で包まない');
  assert.ok(mod.dryrun, 'dryrun プロファイルを export する');
  assert.ok(Array.isArray(mod.dryrun.import), 'dryrun.import[] がある');
  // dryrun はアプリを読み込む world.ts / drivers を import しない
  assert.ok(!mod.dryrun.import.some((i) => /world|drivers/.test(i)), 'dryrun は world/drivers を読まない');
  assert.ok(mod.dryrun.import.some((i) => /step_definitions/.test(i)), 'dryrun は step_definitions を読む');
});

test('genSkeleton は tsx を devDependencies に入れる', () => {
  const c = tmp();
  gen('genSkeleton.js', c, ['--adr', adrDir]);
  const pkg = JSON.parse(fs.readFileSync(path.join(c, 'package.json'), 'utf8'));
  assert.ok(pkg.devDependencies.tsx, 'tsx devDependency missing');
  assert.equal(pkg.type, 'module');
});

test('tsx-register.js は tsx/esm/api の register を呼ぶ', () => {
  const c = tmp();
  gen('genTestSupport.js', c, []);
  const reg = fs.readFileSync(path.join(c, 'tsx-register.js'), 'utf8');
  assert.match(reg, /from 'tsx\/esm\/api'/);
  assert.match(reg, /register\(\)/);
});
