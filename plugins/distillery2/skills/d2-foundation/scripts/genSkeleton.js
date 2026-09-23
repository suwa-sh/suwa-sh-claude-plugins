#!/usr/bin/env node
'use strict';
/**
 * genSkeleton.js (F5) — モノレポ骨格を作る (既存ファイルは上書きしない)
 *
 *   node genSkeleton.js --adr docs/adr [--cwd <repo>]
 *
 * 作るもの:
 *   apps/<dir>/{src,test/contract}
 *   packages/{contracts,ui,test-support}
 *   package.json (workspaces, scripts: 各 app の lint/typecheck/test を -w で、test:contract, bdd)
 *   tsconfig.base.json
 *   .gitignore (.distillery 実行状態の reports・traces を無視)
 *
 * 既存ファイルは決して上書きしない (skip として報告)。ディレクトリは作る。
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadAdrs, collectTiers } = require('./adr');

function parseArgs(argv) {
  const o = { adr: 'docs/adr', cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--adr') o.adr = next();
    else if (a === '--cwd') o.cwd = path.resolve(next());
    else throw new Error(`Unknown arg: ${a}`);
  }
  return o;
}

function ensureDir(cwd, rel, created) { const p = path.resolve(cwd, rel); if (!fs.existsSync(p)) { fs.mkdirSync(p, { recursive: true }); created.push(rel + '/'); } }

function writeIfAbsent(cwd, rel, content, created, skipped) {
  const p = path.resolve(cwd, rel);
  if (fs.existsSync(p)) { skipped.push(rel); return; }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  created.push(rel);
}

function rootPackageJson(tierDirs) {
  const scripts = {
    lint: 'echo "run per-workspace lint via -w"',
    typecheck: 'echo "run per-workspace typecheck via -w"',
    bdd: 'cucumber-js',
  };
  for (const dir of tierDirs) {
    scripts[`test:${dir}`] = `npm run test -w apps/${dir}`;
    scripts[`lint:${dir}`] = `npm run lint -w apps/${dir}`;
    scripts[`typecheck:${dir}`] = `npm run typecheck -w apps/${dir}`;
    scripts[`test:contract:${dir}`] = `npm run test:contract -w apps/${dir}`;
  }
  return JSON.stringify({
    name: 'workspace-root', private: true, version: '0.0.0', type: 'module',
    workspaces: ['apps/*', 'packages/*'],
    scripts,
    devDependencies: {
      '@cucumber/cucumber': '^13.2.1',
      '@electric-sql/pglite': '^0.5.8',
      'dependency-cruiser': '^18.4.0',
      vitest: '^3.2.0',
      supertest: '^7.3.0',
      '@types/supertest': '^7.2.1',
      '@playwright/test': '^1.63.0',
      ajv: '^8.20.0',
      'ajv-formats': '^3.0.1',
      tsx: '^4.20.0',
      typescript: '^5.9.0',
    },
  }, null, 2) + '\n';
}

const TSCONFIG_BASE = JSON.stringify({
  compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
    strict: true, esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true,
    declaration: true, resolveJsonModule: true, types: [],
  },
}, null, 2) + '\n';

const GITIGNORE = ['node_modules/', 'dist/', '*.log', '', '# distillery2 実行状態', '.distillery/runs/*/reports/', '.distillery/runs/*/traces/', '.distillery/runs/*/attempt-*/', ''].join('\n');

/** 各 app の最小 package.json。scripts はプレースホルダ (no-op)。実装で本物に差し替える (上書きしない)。 */
function appPackageJson(dir) {
  return JSON.stringify({
    name: `@app/${dir}`, version: '0.0.0', private: true, type: 'module',
    scripts: {
      'format:check': 'echo "format:check placeholder — d2 で本物に差し替える"',
      lint: 'echo "lint placeholder"',
      typecheck: 'echo "typecheck placeholder"',
      test: 'echo "no unit tests yet"',
      'test:contract': 'echo "no contract tests yet"',
    },
  }, null, 2) + '\n';
}

function run(o) {
  const cwd = o.cwd;
  const adrs = loadAdrs(path.resolve(cwd, o.adr));
  const { tiers } = collectTiers(adrs);
  const tierDirs = tiers.map(t => (t.dir ? String(t.dir).replace(/^apps\//, '') : t.id));
  const created = [], skipped = [];
  for (const dir of tierDirs) {
    ensureDir(cwd, `apps/${dir}/src`, created);
    ensureDir(cwd, `apps/${dir}/test/contract`, created);
    writeIfAbsent(cwd, `apps/${dir}/package.json`, appPackageJson(dir), created, skipped);
  }
  for (const pkg of ['contracts', 'ui', 'test-support']) ensureDir(cwd, `packages/${pkg}`, created);
  ensureDir(cwd, 'features', created);
  writeIfAbsent(cwd, 'package.json', rootPackageJson(tierDirs), created, skipped);
  writeIfAbsent(cwd, 'tsconfig.base.json', TSCONFIG_BASE, created, skipped);
  writeIfAbsent(cwd, '.gitignore', GITIGNORE, created, skipped);
  return { code: 0, created, skipped, tierDirs };
}

function main(argv) {
  let o; try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const r = run(o);
  console.log(`genSkeleton: created ${r.created.length}, skipped ${r.skipped.length}`);
  for (const s of r.skipped) console.log(`  skip (exists): ${s}`);
  return r.code;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { parseArgs, rootPackageJson, run };
