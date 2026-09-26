'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

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
  // .qlty/qlty.toml は genQlty.js が作る (genQlty.test.js)
  assert.ok(!fs.existsSync(path.join(c, '.qlty/qlty.toml')), 'genSkeleton は qlty.toml を書かない');
  assert.match(pkg.devDependencies.vitest, /\^4\.1\.11/);
  // biome の版は npm (exact) / biome.json の $schema / qlty のプラグインで同じ
  const biomeVer = pkg.devDependencies['@biomejs/biome'];
  assert.match(biomeVer, /^\d+\.\d+\.\d+$/, 'biome は exact pin');
  assert.ok(fs.readFileSync(path.join(c, 'biome.json'), 'utf8').includes(`/schemas/${biomeVer}/schema.json`));
  // 0.1.10 実走の課題 (③-1 / ③-2 / ④-5): tsconfig の配列は biome と同じ 1 行、空の src/index.ts、単体と契約テストの vitest 設定を分ける
  const tsRaw = fs.readFileSync(path.join(c, 'apps/backend-api/tsconfig.json'), 'utf8');
  assert.ok(tsRaw.includes('"include": ["src", "test"]'), `tsconfig の配列は 1 行 (biome format と一致):\n${tsRaw}`);
  assert.ok(tsRaw.includes('"types": ["node"]'));
  assert.equal(fs.readFileSync(path.join(c, 'apps/backend-api/src/index.ts'), 'utf8').includes('export {};'), true, '空の src/index.ts');
  // 提供側の仮 test-app (契約テストと api ドライバの import 先)。frontend には置かない
  assert.match(fs.readFileSync(path.join(c, 'apps/backend-api/src/test-app.ts'), 'utf8'), /export function createTestApp\(\)/);
  assert.ok(fs.existsSync(path.join(c, 'apps/worker/src/test-app.ts')));
  assert.ok(!fs.existsSync(path.join(c, 'apps/frontend/src/test-app.ts')));
  assert.ok(pkg.devDependencies['@types/node'], 'types: node のための @types/node');
  const unitCfg = fs.readFileSync(path.join(c, 'apps/backend-api/vitest.config.ts'), 'utf8');
  const contractCfg = fs.readFileSync(path.join(c, 'apps/backend-api/vitest.contract.config.ts'), 'utf8');
  assert.ok(unitCfg.includes("['src/**/*.{test,spec}.{ts,tsx}']") && !unitCfg.includes("'test/"), '単体は src/ だけ');
  assert.ok(contractCfg.includes("['test/contract/**/*.{test,spec}.{ts,tsx}']"), '契約テストは test/contract/ だけ');
  assert.equal(appPkg.scripts['test:contract'], 'vitest run -c vitest.contract.config.ts');
  const biomeCfg = JSON.parse(fs.readFileSync(path.join(c, 'biome.json'), 'utf8'));
  assert.deepEqual(biomeCfg.files.includes, ['**', '!!packages/contracts', '!!contracts/generated', '!!docs/design/storybook-app'], '生成物はルートの整形から外す');
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

test('genSkeleton: 契約テストがあっても app tsconfig で tsc が通り、frontend は jsdom を依存に持つ (Finding 8)', () => {
  const c = tmp();
  run('genSkeleton.js', c, ['--adr', adrDir]);
  // 契約テストを置く。app tsconfig に rootDir が付いていれば TS6059 で失敗する。
  // 契約テストは実装前でも src/test-app を import する (③ の static チェックポイントで typecheck が通る必要がある。Codex 0.1.13 指摘 1)
  // 生成される契約テストと同じ使い方 (supertest の request(app) 相当の厳しい引数型に渡す) で型検査する (Codex 0.1.13 ラウンド 2 指摘 1)
  fs.writeFileSync(path.join(c, 'apps/backend-api/test/contract/x.test.ts'), [
    "import { createTestApp } from '../../src/test-app';",
    "import type { Server } from 'node:http';",
    'function request(_app: Server | ((req: unknown, res: unknown) => void)): { get(p: string): void } { return { get() {} }; }',
    'export async function probe() { const app = await createTestApp(); request(app).get("/x"); }',
  ].join('\n') + '\n');
  const tsc = path.resolve(__dirname, '../../../node_modules/.bin/tsc');
  assert.ok(fs.existsSync(tsc), 'node_modules/.bin/tsc が無い (npm install 済みか)');
  // app tsconfig は types: ['node'] を持つ (対象リポでは devDependencies の @types/node)。ここではリポの node_modules を見せる
  fs.symlinkSync(path.resolve(__dirname, '../../../node_modules'), path.join(c, 'node_modules'));
  const res = spawnSync(tsc, ['--noEmit', '-p', path.join(c, 'apps/backend-api/tsconfig.json')], { encoding: 'utf8' });
  assert.equal(res.status, 0, `tsc failed:\n${res.stdout || ''}${res.stderr || ''}`);
  // frontend ティアがあるので jsdom が root devDependencies に入る
  const pkg = JSON.parse(fs.readFileSync(path.join(c, 'package.json'), 'utf8'));
  assert.ok(pkg.devDependencies.jsdom, 'frontend があるとき jsdom を依存に入れる');
});

test('genSkeleton: 既存リポでは biome.json の $schema を lockfile / package.json の版に合わせる (Codex 0.1.11 指摘 1)', () => {
  // package.json が範囲指定、lockfile が解決済み → lockfile の版
  const c1 = tmp();
  fs.writeFileSync(path.join(c1, 'package.json'), JSON.stringify({ devDependencies: { '@biomejs/biome': '^2.2.0' } }));
  fs.writeFileSync(path.join(c1, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/@biomejs/biome': { version: '2.5.14' } } }));
  run('genSkeleton.js', c1, ['--adr', adrDir, '--migrate']);
  assert.ok(fs.readFileSync(path.join(c1, 'biome.json'), 'utf8').includes('/schemas/2.5.14/'), '新規 biome.json の $schema も既存の版');
  // lockfile 無し → package.json の範囲から版を取る
  const c2 = tmp();
  fs.writeFileSync(path.join(c2, 'package.json'), JSON.stringify({ devDependencies: { '@biomejs/biome': '~2.3.1' } }));
  run('genSkeleton.js', c2, ['--adr', adrDir]);
  assert.ok(fs.readFileSync(path.join(c2, 'biome.json'), 'utf8').includes('/schemas/2.3.1/'));
  // lockfile も devDependency も無く biome.json だけある → その $schema の版
  const c4 = tmp();
  fs.writeFileSync(path.join(c4, 'package.json'), JSON.stringify({ devDependencies: {} }));
  fs.writeFileSync(path.join(c4, 'biome.json'), JSON.stringify({ $schema: 'https://biomejs.dev/schemas/2.4.0/schema.json' }));
  run('genSkeleton.js', c4, ['--adr', adrDir]);
  assert.equal(require(path.join(SKILL, 'scripts/genSkeleton.js')).existingBiomeVersion(c4), '2.4.0');
  // 既存 biome.json の $schema が lockfile の版と違う → --migrate で $schema だけ揃える。migrate なしは警告のみ
  const c5 = tmp();
  fs.writeFileSync(path.join(c5, 'package.json'), JSON.stringify({ devDependencies: { '@biomejs/biome': '^2.2.0' } }));
  fs.writeFileSync(path.join(c5, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/@biomejs/biome': { version: '2.5.14' } } }));
  fs.writeFileSync(path.join(c5, 'biome.json'), JSON.stringify({ $schema: 'https://biomejs.dev/schemas/2.2.0/schema.json', linter: { enabled: true } }));
  const r5 = spawnSync(process.execPath, [path.join(SKILL, 'scripts/genSkeleton.js'), '--cwd', c5, '--adr', adrDir], { encoding: 'utf8' });
  assert.ok(r5.stderr.includes('warn: biome.json の $schema (2.2.0)'), r5.stderr);
  assert.ok(fs.readFileSync(path.join(c5, 'biome.json'), 'utf8').includes('2.2.0'), 'migrate なしでは既存 biome.json を触らない');
  const r5m = run('genSkeleton.js', c5, ['--adr', adrDir, '--migrate']);
  assert.ok(r5m.out.includes('biome.json: $schema を 2.2.0 → 2.5.14'), r5m.out);
  const b5 = JSON.parse(fs.readFileSync(path.join(c5, 'biome.json'), 'utf8'));
  assert.equal(b5.$schema, 'https://biomejs.dev/schemas/2.5.14/schema.json');
  assert.deepEqual(b5.linter, { enabled: true }, '$schema 以外は保持');
  // biome を使っていない既存リポ → 既定の版
  const c3 = tmp();
  fs.writeFileSync(path.join(c3, 'package.json'), JSON.stringify({ devDependencies: {} }));
  run('genSkeleton.js', c3, ['--adr', adrDir]);
  assert.match(fs.readFileSync(path.join(c3, 'biome.json'), 'utf8'), /\/schemas\/\d+\.\d+\.\d+\//);
});

test('genSkeleton --migrate: 0.1.0 生成物を移行する (Finding 5)', () => {
  const c = tmp();
  // 0.1.0 相当の既存プロジェクトを用意する (echo プレースホルダ / attempt-*/ を含む .gitignore)
  fs.mkdirSync(path.join(c, 'apps/backend-api'), { recursive: true });
  fs.writeFileSync(path.join(c, 'apps/backend-api/package.json'), JSON.stringify({
    name: '@app/backend-api', version: '0.0.0', private: true, type: 'module',
    scripts: {
      'format:check': 'echo "format:check placeholder — d2 で本物に差し替える"',
      lint: 'echo "lint placeholder"',
      typecheck: 'echo "typecheck placeholder"',
      test: 'echo "no unit tests yet"',
      'test:contract': 'echo "no contract tests yet"',
    },
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(c, '.gitignore'), ['node_modules/', 'dist/', '*.log', '', '# distillery2 実行状態', '.distillery/runs/*/reports/', '.distillery/runs/*/traces/', '.distillery/runs/*/attempt-*/', ''].join('\n'));

  const r = run('genSkeleton.js', c, ['--adr', adrDir, '--migrate']);
  assert.equal(r.code, 0, r.out);

  // .gitignore: attempt-*/ を除去し reports/traces は残す
  const gi = fs.readFileSync(path.join(c, '.gitignore'), 'utf8');
  assert.ok(!gi.includes('attempt-'), 'attempt-*/ を除去する');
  assert.ok(gi.includes('.distillery/runs/*/reports/') && gi.includes('traces/'), 'reports/traces は残す');

  // 既存の app package.json: echo プレースホルダが実コマンドへ差し替わる
  const appPkg = JSON.parse(fs.readFileSync(path.join(c, 'apps/backend-api/package.json'), 'utf8'));
  assert.equal(appPkg.scripts.test, 'vitest run');
  assert.equal(appPkg.scripts.typecheck, 'tsc --noEmit -p .');
  assert.equal(appPkg.scripts.lint, 'biome lint .');
  assert.equal(appPkg.scripts['format:check'], 'biome format .');
  for (const s of Object.values(appPkg.scripts)) assert.ok(!/^echo /.test(s), `echo が残る: ${s}`);

  // 0.1.0 に無かった config は新規作成される (これで静的ゲートが実際に動く)
  assert.ok(fs.existsSync(path.join(c, 'apps/backend-api/tsconfig.json')), 'app tsconfig を作成');
  assert.ok(fs.existsSync(path.join(c, 'apps/backend-api/vitest.config.ts')), 'app vitest.config を作成');
  assert.ok(fs.existsSync(path.join(c, 'biome.json')), 'root biome.json を作成');

  // 変更内容を報告する
  assert.ok(r.out.includes('migrate:'), r.out);
  assert.ok(r.out.includes('.gitignore') && r.out.includes('backend-api'), r.out);
});

test('genSkeleton --migrate: 0.1.12 以前の test:contract (単体と重なる) を契約専用設定へ差し替える', () => {
  const c = tmp();
  run('genSkeleton.js', c, ['--adr', adrDir]);
  const p = path.join(c, 'apps/backend-api/package.json');
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
  pkg.scripts['test:contract'] = 'vitest run test/contract';
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
  // 旧 vitest.config.ts (単体 + 契約) も置く。生成物と一致すれば単体専用に差し替える
  const legacy = "import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  test: {\n    environment: 'node',\n    include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}'],\n  },\n});\n";
  fs.writeFileSync(path.join(c, 'apps/backend-api/vitest.config.ts'), legacy);
  // 手編集された設定 (frontend) は触らず報告だけ
  fs.writeFileSync(path.join(c, 'apps/frontend/vitest.config.ts'), legacy.replace("'node'", "'jsdom'") + '// edited\n');
  const r = run('genSkeleton.js', c, ['--adr', adrDir, '--migrate']);
  assert.ok(r.out.includes('test:contract'), r.out);
  assert.equal(JSON.parse(fs.readFileSync(p, 'utf8')).scripts['test:contract'], 'vitest run -c vitest.contract.config.ts');
  assert.ok(r.out.includes('apps/backend-api/vitest.config.ts: 単体専用'), r.out);
  assert.ok(!fs.readFileSync(path.join(c, 'apps/backend-api/vitest.config.ts'), 'utf8').includes("'test/**"), '旧設定は単体専用に差し替わる');
  assert.ok(r.out.includes('apps/frontend/vitest.config.ts: 手編集済みのため据え置き'), r.out);
  assert.ok(fs.readFileSync(path.join(c, 'apps/frontend/vitest.config.ts'), 'utf8').endsWith('// edited\n'), '手編集は保持');
});

test('genSkeleton --migrate: 手編集済み script は触らない (echo でなければ据え置き)', () => {
  const c = tmp();
  fs.mkdirSync(path.join(c, 'apps/backend-api'), { recursive: true });
  fs.writeFileSync(path.join(c, 'apps/backend-api/package.json'), JSON.stringify({
    name: '@app/backend-api', scripts: { test: 'vitest run --coverage', lint: 'echo "lint placeholder"' },
  }, null, 2) + '\n');
  run('genSkeleton.js', c, ['--adr', adrDir, '--migrate']);
  const appPkg = JSON.parse(fs.readFileSync(path.join(c, 'apps/backend-api/package.json'), 'utf8'));
  assert.equal(appPkg.scripts.test, 'vitest run --coverage', '手編集 script は保持');
  assert.equal(appPkg.scripts.lint, 'biome lint .', 'echo プレースホルダだけ差し替える');
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
  // zizmor: permissions は最小、checkout は credential を残さない。qlty は install action (SHA ピン) の後にゲート
  assert.match(ci, /^permissions:\n  contents: read$/m);
  assert.match(ci, /actions\/checkout@v4\n\s+with:\n\s+persist-credentials: false/);
  assert.match(ci, /uses: qltysh\/qlty-action\/install@[0-9a-f]{40} # v2\.3\.0\n\s+- run: qlty check --all --no-fix --no-progress --no-upgrade-check --no-formatters --fail-level medium/);
  // Cucumber のタグ式にワイルドカードは無い。uc-bdd は全 feature (not @browser)、acceptance は素の @acceptance で選ぶ。
  assert.ok(!ci.includes('@uc:*') && !ci.includes('@acceptance:*'), 'ワイルドカードタグは使わない');
  assert.ok(ci.includes('--tags "not @browser"') && ci.includes('@acceptance and not @browser'));
  // contract job は提供側 (backend-api) だけ。消費側 (frontend / worker) の test:contract は入れない (Codex 0.1.13 指摘 5)
  assert.ok(ci.includes('npm run test:contract -w apps/backend-api'));
  assert.ok(!ci.includes('test:contract -w apps/frontend') && !ci.includes('test:contract -w apps/worker'));
});

test('genCi: config のコマンドから job を組み、browser 有効時はブラウザ step を足す (Finding 6)', () => {
  const genCi = require(path.join(SKILL, 'scripts/genCi.js'));
  const config = {
    tiers: [{ id: 'api', dir: 'apps/api', provides: ['api'], commands: {
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
