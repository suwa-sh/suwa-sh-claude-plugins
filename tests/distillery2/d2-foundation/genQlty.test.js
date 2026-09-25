'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SKILL = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-foundation');
const SCRIPT = path.join(SKILL, 'scripts/genQlty.js');
const { overlay, FALLBACK_TOML, D2_EXCLUDES, PRUNE_EXCLUDES } = require(SCRIPT);
const INIT_FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures/qlty-init.toml'), 'utf8');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'd2-qlty-')); }
/** qlty CLI が見えない PATH で実行する (フォールバック経路の検証。CI には qlty が無い前提) */
const NO_QLTY_PATH = '/usr/bin:/bin';
function run(cwd, args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, '--cwd', cwd, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
}
function pluginBlocks(toml) {
  return [...toml.matchAll(/\[\[plugin\]\]\nname = "([^"]+)"(?:\nversion = "([^"]+)")?/g)].map((m) => ({ name: m[1], version: m[2] }));
}
function arr(toml, key) {
  const m = toml.match(new RegExp(`^${key} = \\[\\n([\\s\\S]*?)\\n\\]`, 'm'));
  return m ? [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]) : null;
}
const qltyOnPath = !spawnSync('qlty', ['--version'], { encoding: 'utf8' }).error;

test('overlay: qlty init の提案を土台に distillery2 の上乗せをする', () => {
  const out = overlay(INIT_FIXTURE, { biomeVersion: '2.2.5', source: 'suggest', hasBiomeDep: true });
  // 提案されたプラグインはそのまま残る (suggest 優先)
  const names = pluginBlocks(out).map((p) => p.name);
  for (const n of ['actionlint', 'biome', 'osv-scanner', 'ripgrep', 'trufflehog', 'zizmor']) assert.ok(names.includes(n), `提案プラグイン ${n} を残す`);
  assert.ok(!names.includes('radarlint-js'), '提案に無いプラグインは足さない');
  // biome の版固定
  assert.equal(pluginBlocks(out).find((p) => p.name === 'biome').version, '2.2.5');
  // 除外: 生成物を足し、既定の穴 (db / config) は外す。他の既定は残す
  const ex = arr(out, 'exclude_patterns');
  for (const p of D2_EXCLUDES) assert.ok(ex.includes(p), `exclude ${p}`);
  for (const p of PRUNE_EXCLUDES) assert.ok(!ex.includes(p), `既定除外 ${p} を外す`);
  assert.ok(ex.includes('**/vendor/**'), '他の既定除外は残す');
  assert.ok(!out.includes('package-lock.json'), 'lockfile は除外しない');
  // features は test 扱い。スメルはコメント
  assert.ok(arr(out, 'test_patterns').includes('features/**'));
  assert.match(out, /\[smells\]\nmode = "comment"/);
  // radarlint が提案に無いなら triage も出さない
  assert.ok(!/^\[\[triage\]\]/m.test(out));
  assert.ok(!/^\[\[exclude\]\]/m.test(out), '[[exclude]] に rules を書く誤用を招かないよう exclude セクションは出さない');
  assert.ok(out.startsWith('# distillery2 genQlty.js'), '土台の由来をヘッダに書く');
  assert.ok(out.includes('`qlty init` の提案'));
});

test('overlay: radarlint-* が提案に含まれれば low に降格。2 回当てても同じ (冪等)', () => {
  const base = INIT_FIXTURE.replace('[[plugin]]\nname = "biome"', '[[plugin]]\nname = "biome"\n\n[[plugin]]\nname = "radarlint-js"\n\n[[plugin]]\nname = "radarlint-python"\nmode = "comment"');
  const once = overlay(base, { biomeVersion: '2.2.5', source: 'suggest', hasBiomeDep: true });
  assert.match(once, /\[\[triage\]\]\nmatch\.plugins = \["radarlint-js", "radarlint-python"\]\nset\.level = "low"/);
  const twice = overlay(once, { biomeVersion: '2.2.5', source: 'suggest', hasBiomeDep: true });
  assert.equal(twice, once);
  // 版の更新は既存の version 行を置き換える (重複しない)
  const bumped = overlay(once, { biomeVersion: '2.5.14', source: 'suggest', hasBiomeDep: true });
  assert.equal(pluginBlocks(bumped).filter((p) => p.name === 'biome').length, 1);
  assert.equal(pluginBlocks(bumped).find((p) => p.name === 'biome').version, '2.5.14');
});

test('overlay: 提案に biome が無くても package.json に biome があれば足す。無ければ足さない', () => {
  const base = INIT_FIXTURE.replace('[[plugin]]\nname = "biome"\n\n', '');
  const withDep = overlay(base, { biomeVersion: '2.2.5', source: 'suggest', hasBiomeDep: true });
  assert.deepEqual(pluginBlocks(withDep).find((p) => p.name === 'biome'), { name: 'biome', version: '2.2.5' });
  const noDep = overlay(base, { biomeVersion: '2.2.5', source: 'suggest', hasBiomeDep: false });
  assert.ok(!pluginBlocks(noDep).some((p) => p.name === 'biome'));
});

test('genQlty (fallback): qlty CLI が無いときは固定リストを土台にする。biome 版は package.json に合わせる', () => {
  const c = tmp();
  fs.writeFileSync(path.join(c, 'package.json'), JSON.stringify({ devDependencies: { '@biomejs/biome': '2.3.1' } }));
  const r = run(c, [], { PATH: NO_QLTY_PATH });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('土台: fallback'), r.stdout);
  const toml = fs.readFileSync(path.join(c, '.qlty/qlty.toml'), 'utf8');
  const names = pluginBlocks(toml).map((p) => p.name);
  for (const n of ['biome', 'radarlint-js', 'actionlint', 'zizmor', 'trufflehog', 'osv-scanner']) assert.ok(names.includes(n), `fallback plugin ${n}`);
  assert.equal(pluginBlocks(toml).find((p) => p.name === 'biome').version, '2.3.1');
  assert.match(toml, /\[\[triage\]\]\nmatch\.plugins = \["radarlint-js"\]\nset\.level = "low"/);
  for (const p of D2_EXCLUDES) assert.ok(arr(toml, 'exclude_patterns').includes(p), `exclude ${p}`);
  assert.ok(toml.includes('固定リスト'));
  // 既存があればスキップ。--force で作り直す
  fs.writeFileSync(path.join(c, '.qlty/qlty.toml'), '# handwritten\nconfig_version = "0"\n');
  const r2 = run(c, [], { PATH: NO_QLTY_PATH });
  assert.ok(r2.stdout.includes('skip'), r2.stdout);
  assert.equal(fs.readFileSync(path.join(c, '.qlty/qlty.toml'), 'utf8'), '# handwritten\nconfig_version = "0"\n');
  const r3 = run(c, ['--force'], { PATH: NO_QLTY_PATH });
  assert.equal(r3.status, 0);
  assert.ok(fs.readFileSync(path.join(c, '.qlty/qlty.toml'), 'utf8').startsWith('# distillery2 genQlty.js'));
});

test('genQlty: --fallback は qlty があっても固定リスト', () => {
  const c = tmp();
  fs.writeFileSync(path.join(c, 'package.json'), '{}');
  const r = run(c, ['--fallback']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('土台: fallback, --fallback'), r.stdout);
  const toml = fs.readFileSync(path.join(c, '.qlty/qlty.toml'), 'utf8');
  assert.ok(pluginBlocks(toml).some((p) => p.name === 'radarlint-js'));
  assert.equal(overlay(FALLBACK_TOML, { biomeVersion: '1.0.0', source: 'fallback', hasBiomeDep: false }).includes('version = "1.0.0"'), true, 'fallback は biome を含むので版を固定する');
});

test('genQlty (suggest): qlty があれば未追跡ファイルも見せて提案を取り、index は元に戻す', { skip: !qltyOnPath && 'qlty CLI が無い' }, () => {
  const c = tmp();
  const git = (...a) => spawnSync('git', a, { cwd: c, encoding: 'utf8' });
  git('init', '-q');
  fs.mkdirSync(path.join(c, 'docs'));
  fs.writeFileSync(path.join(c, 'docs/README.md'), '# x\n');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'docs');
  // 未追跡: workflow (actionlint / zizmor の検出材料) と package.json (biome)
  fs.mkdirSync(path.join(c, '.github/workflows'), { recursive: true });
  fs.writeFileSync(path.join(c, '.github/workflows/ci.yml'), 'on: push\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n');
  fs.writeFileSync(path.join(c, 'package.json'), JSON.stringify({ devDependencies: { '@biomejs/biome': '2.2.5' } }));
  fs.writeFileSync(path.join(c, 'biome.json'), '{}');
  const before = git('status', '--porcelain').stdout;
  const r = run(c);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('土台: suggest'), r.stdout);
  const toml = fs.readFileSync(path.join(c, '.qlty/qlty.toml'), 'utf8');
  const names = pluginBlocks(toml).map((p) => p.name);
  for (const n of ['actionlint', 'zizmor', 'biome']) assert.ok(names.includes(n), `suggest が ${n} を検出 (未追跡でも見える): ${names}`);
  assert.equal(pluginBlocks(toml).find((p) => p.name === 'biome').version, '2.2.5');
  // index は触った跡を残さない (未追跡は未追跡のまま。.qlty が増えるだけ)
  const after = git('status', '--porcelain').stdout;
  assert.equal(after.replace('?? .qlty/\n', ''), before);
});
