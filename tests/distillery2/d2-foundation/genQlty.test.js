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
const qltyProbe = spawnSync('qlty', ['--version'], { encoding: 'utf8' });
const qltyOnPath = !qltyProbe.error && qltyProbe.status === 0;

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
  // biome ブロック内で version が name の直後に無くても置き換える (キー重複で qlty が読めなくなる。Codex 0.1.12 指摘 2)
  const reordered = INIT_FIXTURE.replace('[[plugin]]\nname = "biome"', '[[plugin]]\nname = "biome"\nmode = "comment"\nversion = "1.9.4"');
  const pinned = overlay(reordered, { biomeVersion: '2.2.5', source: 'suggest', hasBiomeDep: true });
  assert.match(pinned, /\[\[plugin\]\]\nname = "biome"\nmode = "comment"\nversion = "2.2.5"\n/);
  assert.equal((pinned.match(/^version = /gm) || []).length, 1, 'version は 1 行だけ');
  assert.ok(!pinned.includes('1.9.4'));
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

test('genQlty: qlty init --dry-run が exit≠0 なら部分出力を採用せずフォールバック (Codex 0.1.12 指摘 1)', () => {
  // 偽の qlty: 設定らしきものを出して失敗する
  const bin = tmp();
  fs.writeFileSync(path.join(bin, 'qlty'), '#!/bin/sh\nif [ "$1" = "--version" ]; then echo qlty 0.0.0; exit 0; fi\necho \'config_version = "0"\'\necho \'[[plugin]]\'\necho \'name = "biome"\'\nexit 7\n');
  fs.chmodSync(path.join(bin, 'qlty'), 0o755);
  const c = tmp();
  spawnSync('git', ['init', '-q'], { cwd: c });
  fs.writeFileSync(path.join(c, 'package.json'), '{}');
  const r = run(c, [], { PATH: `${bin}:${NO_QLTY_PATH}` });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('土台: fallback'), r.stdout);
  assert.ok(r.stdout.includes('失敗'), r.stdout);
  assert.ok(pluginBlocks(fs.readFileSync(path.join(c, '.qlty/qlty.toml'), 'utf8')).some((p) => p.name === 'radarlint-js'), '固定リストが土台');
});

/** 偽の qlty: --version は成功、init --dry-run は fixture をそのまま出す (CI に qlty が無くても成功経路を検証する) */
function fakeQltyBin() {
  const bin = tmp();
  fs.writeFileSync(path.join(bin, 'qlty'), `#!/bin/sh\nif [ "$1" = "--version" ]; then echo qlty 0.0.0; exit 0; fi\ncat "${path.join(__dirname, 'fixtures/qlty-init.toml')}"\n`);
  fs.chmodSync(path.join(bin, 'qlty'), 0o755);
  return bin;
}

test('genQlty (suggest, 偽 qlty): 利用者の index を壊さない (staged 削除と同名の未追跡、* 入りの名前、空白・日本語) (Codex 0.1.12 ラウンド 2 指摘 1)', () => {
  const c = tmp();
  const git = (...a) => spawnSync('git', a, { cwd: c, encoding: 'utf8' });
  git('init', '-q');
  for (const f of ['deleted.js', 'starA.js', 'keep.js']) fs.writeFileSync(path.join(c, f), `// ${f}\n`);
  fs.writeFileSync(path.join(c, 'package.json'), JSON.stringify({ devDependencies: { '@biomejs/biome': '2.2.5' } }));
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  // staged 削除の後に同名の未追跡ファイルを再作成 / staged 変更 + `*` 入りの未追跡名 / 空白・日本語の未追跡名
  git('rm', '-q', '--cached', 'deleted.js');
  fs.writeFileSync(path.join(c, 'deleted.js'), '// recreated\n');
  fs.writeFileSync(path.join(c, 'starA.js'), '// staged change\n');
  git('add', 'starA.js');
  fs.writeFileSync(path.join(c, 'starA.js'), '// unstaged change on top\n');
  fs.writeFileSync(path.join(c, 'star*.js'), '// glob-like name\n');
  fs.writeFileSync(path.join(c, 'with space 日本語.ts'), 'export {};\n');
  const before = { status: git('status', '--porcelain', '-z').stdout, cached: git('diff', '--cached', '--name-status', '-z').stdout };
  const r = run(c, [], { PATH: `${fakeQltyBin()}:${NO_QLTY_PATH}` });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('土台: suggest'), r.stdout);
  const after = { status: git('status', '--porcelain', '-z').stdout, cached: git('diff', '--cached', '--name-status', '-z').stdout };
  assert.equal(after.cached, before.cached, 'staged の内容が変わらない');
  assert.equal(after.status.replace('?? .qlty/\0', ''), before.status, '.qlty/ 以外の status が変わらない');
  assert.equal(fs.readFileSync(path.join(c, 'starA.js'), 'utf8'), '// unstaged change on top\n', '作業ツリーも変わらない');
  const toml = fs.readFileSync(path.join(c, '.qlty/qlty.toml'), 'utf8');
  assert.ok(pluginBlocks(toml).some((p) => p.name === 'zizmor'), '偽 qlty の提案 (fixture) が土台');
});

test('genQlty (suggest, 偽 qlty): コミットの無い新規リポでも index を残さない', () => {
  const c = tmp();
  const git = (...a) => spawnSync('git', a, { cwd: c, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(c, 'package.json'), '{}');
  const r = run(c, [], { PATH: `${fakeQltyBin()}:${NO_QLTY_PATH}` });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('土台: suggest'), r.stdout);
  assert.equal(git('status', '--porcelain').stdout, '?? .qlty/\n?? package.json\n');
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
