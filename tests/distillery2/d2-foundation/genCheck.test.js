'use strict';
// 0.3.0: 機械チェックの一括実行 (genCheck.js が生成する scripts/check.mjs と .githooks/commit-msg)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const SKILLS = path.resolve(__dirname, '../../../plugins/distillery2/skills');
const GC = require(path.join(SKILLS, 'd2-foundation/scripts/genCheck'));
const checks = require(path.join(SKILLS, 'd2-foundation/scripts/checks'));
const { stringifyYaml } = require(path.join(SKILLS, 'd2-common/scripts/lib/yaml'));

function g(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function w(root, rel, text) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }

/**
 * 使い捨てのリポ。ティアのコマンドは「マーカーのファイルがあれば落ちる」代役 (ログに名前を追記する)。
 * fail: { '<名前>': true } で、その名前のコマンドを落とす
 */
function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-check-'));
  g(root, 'init', '-q', '-b', 'main');
  g(root, 'config', 'user.email', 't@example.com');
  g(root, 'config', 'user.name', 't');
  const cmd = (name) => `node -e "require('fs').appendFileSync('check.log','${name}\\n'); process.exit(require('fs').existsSync('fail-${name}') ? 1 : 0)"`;
  const tier = (id) => ({ id, dir: `apps/${id}`, commands: { format_check: cmd(`format-${id}`), lint: cmd(`lint-${id}`), build: cmd(`build-${id}`), unit: cmd(`unit-${id}`), contract: cmd(`contract-${id}`), security: cmd(`security-${id}`) } });
  const config = {
    tiers: [{ ...tier('backend-api'), provides: ['api'] }, tier('frontend')],
    contracts: [{ id: 'api', provider: 'backend-api', consumers: ['frontend'] }],
    commands: { format: cmd('format-repo'), quality: cmd('lint-repo'), secrets: cmd('secrets'), arch_test: cmd('arch'), uc_bdd: cmd('uc-bdd'), acceptance_api: cmd('acceptance') },
    capabilities: { browser: false },
  };
  w(root, '.distillery/config.yaml', stringifyYaml(config));
  w(root, '.gitignore', 'check.log\nfail-*\n.distillery/logs/\n');
  w(root, 'apps/backend-api/src/a.ts', 'export const a = 1;\n');
  w(root, 'apps/frontend/src/b.ts', 'export const b = 1;\n');
  w(root, 'docs/notes.md', '# notes\n');
  const r = GC.run({ cwd: root, config: '.distillery/config.yaml' });
  assert.equal(r.code, 0);
  g(root, 'add', '-A');
  g(root, 'commit', '-q', '--no-verify', '-m', 'base');
  return root;
}
const log = (root) => (fs.existsSync(path.join(root, 'check.log')) ? fs.readFileSync(path.join(root, 'check.log'), 'utf8').trim().split('\n') : []);
const check = (root, args, env = {}) => spawnSync(process.execPath, ['scripts/check.mjs', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, D2_SKILLS: '/nonexistent', HOME: root, ...env } });

test('生成物: check.mjs は構文が正しく、依存なしで動く。hook が入り (core.hooksPath)、--check は最新なら 0、config が変われば 1', () => {
  const root = repo();
  assert.equal(spawnSync(process.execPath, ['--check', path.join(root, 'scripts/check.mjs')]).status, 0);
  assert.equal(g(root, 'config', 'core.hooksPath'), '.githooks');
  assert.ok(fs.statSync(path.join(root, '.githooks/commit-msg')).mode & 0o100, '実行できる');
  assert.equal(GC.run({ cwd: root, config: '.distillery/config.yaml', check: true }).code, 0);
  fs.appendFileSync(path.join(root, '.distillery/config.yaml'), '\n# x\n');
  assert.equal(GC.run({ cwd: root, config: '.distillery/config.yaml', check: true }).code, 0, 'コメントだけなら同じ');
  w(root, '.distillery/config.yaml', fs.readFileSync(path.join(root, '.distillery/config.yaml'), 'utf8').replace('format-repo', 'format-repo2'));
  assert.deepEqual(GC.run({ cwd: root, config: '.distillery/config.yaml', check: true }).stale, ['scripts/check.mjs']);
});

test('ci モード: 6 観点の順 (generate → format → lint → build → test → security) で全ティア・全テスト・ティアごとの security を回す。落ちたものを最後にまとめて exit 1', () => {
  const root = repo();
  w(root, 'fail-build-frontend', '');
  const r = check(root, ['--mode', 'ci']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(log(root), ['format-repo', 'format-backend-api', 'format-frontend', 'lint-repo', 'arch', 'lint-backend-api', 'lint-frontend', 'build-backend-api', 'build-frontend',
    'unit-backend-api', 'unit-frontend', 'contract-backend-api', 'uc-bdd', 'acceptance', 'secrets', 'security-backend-api', 'security-frontend']);
  assert.match(r.stdout, /FAIL \[build\] frontend/);
  assert.match(r.stdout, /\[generate\] contracts: FAIL|\[generate\] [a-z-]+: FAIL/, 'ci で distillery2 のスクリプトが無ければ generate は落ちる');
});

test('generate: distillery2 のスクリプトで生成物の鮮度を確かめる (古い README は落ち、作り直せば通る。一括チェック自身も確かめる)', () => {
  const root = repo();
  const r1 = check(root, ['--mode', 'ci', '--only', 'generate'], { D2_SKILLS: SKILLS });
  assert.equal(r1.status, 1, r1.stdout);
  assert.match(r1.stdout, /FAIL \[generate\] docs-readme/);
  assert.doesNotMatch(r1.stdout, /FAIL \[generate\] check-script/, '一括チェック自身は最新');
  assert.match(r1.stdout, /\[generate\] check-script: /);
  assert.doesNotMatch(r1.stdout, /\[generate\] contracts/, '契約が無ければ回さない');
  spawnSync(process.execPath, [path.join(SKILLS, 'd2-common/scripts/genDocsReadme.js'), '--cwd', root], { encoding: 'utf8' });
  const r2 = check(root, ['--mode', 'ci', '--only', 'generate'], { D2_SKILLS: SKILLS });
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
});

test('ci モード --only: 1 つの観点だけ回す', () => {
  const root = repo();
  const r = check(root, ['--mode', 'ci', '--only', 'build']);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(log(root), ['build-backend-api', 'build-frontend']);
});

test('hook モード: 変えたティアだけ format・lint・build・単体テスト。文書類はコミットするファイルだけ。契約・シナリオ・ティアの security は回さない', () => {
  const root = repo();
  w(root, 'apps/frontend/src/b.ts', 'export const b = 2;\n');
  g(root, 'add', 'apps/frontend/src/b.ts');
  const r = check(root, ['--mode', 'hook']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(log(root), ['format-frontend', 'arch', 'lint-frontend', 'build-frontend', 'unit-frontend', 'secrets']);
  assert.match(r.stdout, /\[format\] repo: skip/);
  assert.match(r.stdout, /\[secrets\]|secrets/);
});

test('hook モード: 共有パッケージやルートの設定を変えたら全ティア。distillery2 のスクリプトが無ければ generate は「確かめられない」で通す', () => {
  const root = repo();
  w(root, 'package.json', '{}\n');
  g(root, 'add', 'package.json');
  const r = check(root, ['--mode', 'hook']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(log(root).includes('unit-backend-api') && log(root).includes('unit-frontend'));
});

test('commit-msg の hook: 人の red の commit は止め、d2-run の commit (scaffold の red を含む・main マージの squash) は通す', () => {
  const root = repo();
  w(root, 'fail-unit-backend-api', '');
  w(root, 'apps/backend-api/src/a.test.ts', 'red\n');
  g(root, 'add', 'apps/backend-api/src/a.test.ts');
  const human = spawnSync('git', ['commit', '-q', '-m', 'wip: テストを足した'], { cwd: root, encoding: 'utf8', env: { ...process.env, D2_SKILLS: '/nonexistent', HOME: root } });
  assert.notEqual(human.status, 0, '人の red の commit は止まる');
  assert.match(human.stdout + human.stderr, /FAIL \[test\] backend-api unit/);
  const d2 = spawnSync('git', ['commit', '-q', '-m', 'impl(book-room): scaffold'], { cwd: root, encoding: 'utf8' });
  assert.equal(d2.status, 0, d2.stderr);
  w(root, 'apps/backend-api/src/a.ts', 'export const a = 3;\n');
  g(root, 'add', '-A');
  const human2 = spawnSync('git', ['commit', '-q', '-m', 'docs: update', '-m', 'UC-Slug: book-room'], { cwd: root, encoding: 'utf8', env: { ...process.env, D2_SKILLS: '/nonexistent', HOME: root } });
  assert.notEqual(human2.status, 0, 'trailer の UC-Slug: だけでは通さない (人の commit)');
  const squash = spawnSync('git', ['commit', '-q', '-m', 'feat: 会議室を予約する', '-m', 'UC-Slug: book-room\nGates: static=pass'], { cwd: root, encoding: 'utf8' });
  assert.equal(squash.status, 0, squash.stderr);
  for (const s of GC.D2_SUBJECTS) assert.match(GC.renderHook(), new RegExp(`"${s.replace(/[()]/g, '\\$&')}"\\*`));
});

test('checks.js: 機械チェックの ADR の checks から、ティアの build・security とリポの format・lint・秘密情報のコマンドを作る。知らない道具は誤り', () => {
  const c = checks.tierCheckCommands(null, 'backend-api', 'backend-api');
  assert.equal(c.build, 'npm run build -w apps/backend-api');
  assert.match(c.security, /^npm audit -w apps\/backend-api --audit-level=high --omit=dev && qlty check [^&]* apps\/backend-api$/);
  const custom = { tiers: { '*': { security: ['dependency-audit'] }, frontend: { build: { cmd: 'npm run build:web -w apps/{dir}' } } } };
  assert.equal(checks.tierCheckCommands(custom, 'frontend', 'web').build, 'npm run build:web -w apps/web');
  assert.equal(checks.tierCheckCommands(custom, 'backend-api', 'api').security, 'npm audit -w apps/api --audit-level=high --omit=dev');
  assert.match(checks.repoCheckCommands(null).secrets, /--filter trufflehog$/);
  assert.deepEqual(checks.validateChecks({ tiers: { '*': { build: 'make' } } }).length, 1);
  assert.deepEqual(checks.validateChecks({ tiers: { ghost: {} } }, ['backend-api']).length, 1);
  assert.deepEqual(checks.validateChecks(checks.DEFAULTS), []);
  assert.equal(checks.validateChecks({ repo: { securty: [] }, tiers: { '*': { buid: 'tsc' } } }).length, 2, '観点名の書き間違いは誤り');
});

test('hook モード: ステージした内容と作業ツリーが違うファイル (部分ステージ) があれば止める。文書類の format はコミットするファイルだけ', () => {
  const root = repo();
  w(root, 'docs/notes.md', '# staged\n');
  g(root, 'add', 'docs/notes.md');
  w(root, 'docs/notes.md', '# worktree\n');
  const r = check(root, ['--mode', 'hook']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /ステージした内容と作業ツリーの内容が違うファイルがある[^\n]*docs\/notes\.md/);
  g(root, 'add', 'docs/notes.md');
  const cfg = fs.readFileSync(path.join(root, '.distillery/config.yaml'), 'utf8');
  w(root, '.distillery/config.yaml', cfg.replace(/format: [^\n]*format-repo[^\n]*/, 'format: echo FORMAT .'));
  GC.run({ cwd: root, config: '.distillery/config.yaml' });
  g(root, 'add', 'docs/notes.md');
  const r2 = check(root, ['--mode', 'hook', '--only', 'format']);
  assert.match(r2.stdout, /\[format\] repo: echo FORMAT --no-errors-on-unmatched --files-ignore-unknown=true [^\n]*'docs\/notes\.md'/);
});

test('hook モード: 独自の format のコマンドは {files} にコミットするファイルが入る。{files} が無ければ飛ばす。ci は {files} に . が入る', () => {
  const root = repo();
  const cfg = fs.readFileSync(path.join(root, '.distillery/config.yaml'), 'utf8');
  w(root, '.distillery/config.yaml', cfg.replace(/format: [^\n]*format-repo[^\n]*/, 'format: echo CUSTOM {files}'));
  GC.run({ cwd: root, config: '.distillery/config.yaml' });
  w(root, 'docs/notes.md', '# x\n');
  g(root, 'add', 'docs/notes.md');
  assert.match(check(root, ['--mode', 'hook', '--only', 'format']).stdout, /\[format\] repo: echo CUSTOM 'docs\/notes\.md'/);
  assert.match(check(root, ['--mode', 'ci', '--only', 'format']).stdout, /\[format\] repo: echo CUSTOM \./);
  w(root, '.distillery/config.yaml', cfg.replace(/format: [^\n]*format-repo[^\n]*/, 'format: echo CUSTOM'));
  GC.run({ cwd: root, config: '.distillery/config.yaml' });
  g(root, 'add', 'docs/notes.md');
  assert.match(check(root, ['--mode', 'hook', '--only', 'format']).stdout, /\[format\] repo: skip \(format のコマンドにファイルを渡せない/);
});

