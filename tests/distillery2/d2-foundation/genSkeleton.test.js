'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SKILL = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-foundation');
const adrDir = path.join(__dirname, 'fixtures/adr');
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'd2-skel-')); }
function run(script, cwd, args) {
  try { return { code: 0, out: execFileSync(process.execPath, [path.join(SKILL, 'scripts', script), '--cwd', cwd, ...args], { encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}

test('genSkeleton: creates app/package dirs and root files', () => {
  const c = tmp();
  run('genSkeleton.js', c, ['--adr', adrDir]);
  for (const d of ['apps/backend-api/src', 'apps/backend-api/test/contract', 'apps/frontend/src', 'apps/worker/src', 'packages/contracts', 'packages/ui', 'packages/test-support']) {
    assert.ok(fs.existsSync(path.join(c, d)), `missing dir ${d}`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(c, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.workspaces, ['apps/*', 'packages/*']);
  // 各 app に最小 package.json があり、静的ゲートの -w が解決できる
  const appPkg = JSON.parse(fs.readFileSync(path.join(c, 'apps/backend-api/package.json'), 'utf8'));
  for (const s of ['format:check', 'lint', 'typecheck', 'test', 'test:contract']) assert.ok(appPkg.scripts[s], `app script ${s} missing`);
  // scripts は実コマンド (echo プレースホルダではない)
  assert.equal(appPkg.scripts.test, 'vitest run');
  assert.equal(appPkg.scripts.typecheck, 'tsc --noEmit -p .');
  assert.equal(appPkg.scripts.lint, 'biome lint .');
  assert.equal(appPkg.scripts['format:check'], 'biome format .');
  for (const s of Object.values(appPkg.scripts)) assert.ok(!/^echo /.test(s), `placeholder script remains: ${s}`);
  // 各 app に tsconfig.json / vitest.config.ts、ルートに biome.json
  assert.ok(fs.existsSync(path.join(c, 'apps/backend-api/tsconfig.json')), 'app tsconfig.json');
  assert.ok(fs.existsSync(path.join(c, 'apps/backend-api/vitest.config.ts')), 'app vitest.config.ts');
  assert.ok(fs.existsSync(path.join(c, 'biome.json')), 'root biome.json');
  // frontend tier の tsconfig は jsx を有効化する
  const feTs = JSON.parse(fs.readFileSync(path.join(c, 'apps/frontend/tsconfig.json'), 'utf8'));
  assert.equal(feTs.compilerOptions.jsx, 'react-jsx');
  // root devDependencies に実ゲート用の依存が入る (frontend があるので react も)
  for (const d of ['@biomejs/biome', '@redocly/cli', '@apidevtools/json-schema-ref-parser', 'react', 'react-dom', '@types/react']) {
    assert.ok(pkg.devDependencies[d], `root devDependency ${d} missing`);
  }
  assert.ok(pkg.scripts['test:backend-api'].includes('-w apps/backend-api'));
  assert.ok(fs.existsSync(path.join(c, 'tsconfig.base.json')));
  const gitignore = fs.readFileSync(path.join(c, '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('.distillery/runs/*/reports/') && gitignore.includes('traces/'));
  // attempt-*/ は commit 対象なので除外しない (run-state.md と整合)
  assert.ok(!gitignore.includes('attempt-'), 'attempt-*/ は gitignore しない');
});

test('genSkeleton: does not overwrite an existing package.json', () => {
  const c = tmp();
  fs.writeFileSync(path.join(c, 'package.json'), '{"name":"mine"}\n');
  const r = run('genSkeleton.js', c, ['--adr', adrDir]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(c, 'package.json'), 'utf8')).name, 'mine');
  assert.ok(r.out.includes('skip') && r.out.includes('package.json'), r.out);
});

test('genTestSupport: copies templates without overwriting', () => {
  const c = tmp();
  run('genTestSupport.js', c, []);
  assert.ok(fs.existsSync(path.join(c, 'packages/test-support/src/tracer.ts')));
  assert.ok(fs.existsSync(path.join(c, 'packages/test-support/src/pglite-harness.ts')));
  assert.ok(fs.existsSync(path.join(c, 'features/support/world.ts')));
  assert.ok(fs.existsSync(path.join(c, 'features/support/drivers/api.ts')));
  assert.ok(fs.existsSync(path.join(c, 'cucumber.js')));
  // 上書きしない
  fs.writeFileSync(path.join(c, 'cucumber.js'), 'CUSTOM');
  const r = run('genTestSupport.js', c, []);
  assert.equal(fs.readFileSync(path.join(c, 'cucumber.js'), 'utf8'), 'CUSTOM');
  assert.ok(r.out.includes('skipped'), r.out);
});

test('genCi: renders 5-gate workflow with needs chain', () => {
  const c = tmp();
  // config を先に作る
  run('genConfig.js', c, ['--adr', adrDir, '--contracts', path.join(__dirname, 'fixtures/contracts.json'), '--out', '.distillery/config.yaml']);
  run('genCi.js', c, ['--config', '.distillery/config.yaml']);
  const ci = fs.readFileSync(path.join(c, '.github/workflows/ci.yml'), 'utf8');
  for (const j of ['static:', 'unit:', 'contract:', 'uc-bdd:', 'acceptance:']) assert.ok(ci.includes(j), `missing job ${j}`);
  assert.ok(ci.includes('needs: static') && ci.includes('needs: uc-bdd'));
  // Cucumber のタグ式にワイルドカードは無い。uc-bdd は全 feature (not @browser)、acceptance は素の @acceptance で選ぶ。
  assert.ok(!ci.includes('@uc:*') && !ci.includes('@acceptance:*'), 'ワイルドカードタグは使わない');
  assert.ok(ci.includes('--tags "not @browser"') && ci.includes('@acceptance and not @browser'));
});

test('genCi: config のコマンドから job を組み、browser 有効時はブラウザ step を足す (Finding 6)', () => {
  const genCi = require(path.join(SKILL, 'scripts/genCi.js'));
  const config = {
    tiers: [{ id: 'api', dir: 'apps/api', commands: {
      format_check: 'npm run format:check -w apps/api',
      lint: 'npm run lint -w apps/api',
      typecheck: 'npm run typecheck -w apps/api',
      unit: 'npm run test -w apps/api -- --run --reporter=json --outputFile={report}',
      contract: 'npm run test:contract -w apps/api -- --run --reporter=json --outputFile={report}',
    } }],
    commands: {
      arch_test: 'npx depcruise apps packages',
      uc_bdd: 'npx cucumber-js --tags "@uc:{slug}" --format json:{report}',
      acceptance_api: 'npx cucumber-js --tags "@uc:{slug} and @acceptance and not @browser" --format json:{report}',
      acceptance_browser: 'npx cucumber-js --tags "@uc:{slug} and @acceptance and @browser" --format json:{report}',
    },
    capabilities: { browser: true },
  };
  const yml = genCi.render(config);
  // unit / contract は config の各ティアコマンドから (固定コマンドではない)
  assert.ok(yml.includes('npm run test -w apps/api -- --run'), 'custom unit command');
  assert.ok(yml.includes('npm run test:contract -w apps/api -- --run'), 'custom contract command');
  // CI では {report} / {slug} プレースホルダは残さない
  assert.ok(!yml.includes('{report}'), '{report} を残さない');
  assert.ok(!yml.includes('@uc:{slug}'), '{slug} を残さない');
  // browser 有効なのでブラウザ受入 step が入る
  assert.ok(yml.includes('--tags "@acceptance and @browser"'), 'browser acceptance step');
  assert.ok(yml.includes('--tags "not @browser"') && yml.includes('--tags "@acceptance and not @browser"'));
});

test('genCi: browser 無効ならブラウザ step を入れない (Finding 6)', () => {
  const genCi = require(path.join(SKILL, 'scripts/genCi.js'));
  const config = {
    tiers: [{ id: 'api', dir: 'apps/api', commands: { unit: 'npm run test -w apps/api', contract: 'npm run test:contract -w apps/api' } }],
    commands: {
      uc_bdd: 'npx cucumber-js --tags "@uc:{slug}" --format json:{report}',
      acceptance_api: 'npx cucumber-js --tags "@uc:{slug} and @acceptance and not @browser" --format json:{report}',
      acceptance_browser: 'npx cucumber-js --tags "@uc:{slug} and @acceptance and @browser" --format json:{report}',
    },
    capabilities: { browser: false },
  };
  const yml = genCi.render(config);
  assert.ok(!yml.includes('@acceptance and @browser'), 'browser off ならブラウザ step 無し');
});
