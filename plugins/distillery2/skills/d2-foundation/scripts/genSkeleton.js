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

function rootPackageJson(tierDirs, hasFrontend) {
  const scripts = {
    lint: 'echo "run per-workspace lint via -w"',
    typecheck: 'echo "run per-workspace typecheck via -w"',
    format: 'biome format --write .',
    'format:check': 'biome format .',
    bdd: 'cucumber-js',
  };
  for (const dir of tierDirs) {
    scripts[`test:${dir}`] = `npm run test -w apps/${dir}`;
    scripts[`lint:${dir}`] = `npm run lint -w apps/${dir}`;
    scripts[`typecheck:${dir}`] = `npm run typecheck -w apps/${dir}`;
    scripts[`test:contract:${dir}`] = `npm run test:contract -w apps/${dir}`;
  }
  const devDependencies = {
    '@biomejs/biome': '^2.2.0',
    '@cucumber/cucumber': '^13.2.1',
    '@electric-sql/pglite': '^0.5.8',
    '@redocly/cli': '^2.4.0',
    '@apidevtools/json-schema-ref-parser': '^15.1.0',
    'dependency-cruiser': '^18.4.0',
    vitest: '^3.2.0',
    supertest: '^7.3.0',
    '@types/supertest': '^7.2.1',
    '@playwright/test': '^1.63.0',
    ajv: '^8.20.0',
    'ajv-formats': '^3.0.1',
    tsx: '^4.20.0',
    typescript: '^5.9.0',
  };
  if (hasFrontend) {
    devDependencies.react = '^19.2.0';
    devDependencies['react-dom'] = '^19.2.0';
    devDependencies['@types/react'] = '^19.2.0';
    devDependencies['@types/react-dom'] = '^19.2.0';
  }
  return JSON.stringify({
    name: 'workspace-root', private: true, version: '0.0.0', type: 'module',
    workspaces: ['apps/*', 'packages/*'],
    scripts,
    devDependencies,
  }, null, 2) + '\n';
}

const TSCONFIG_BASE = JSON.stringify({
  compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
    strict: true, esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true,
    declaration: true, resolveJsonModule: true, types: [],
  },
}, null, 2) + '\n';

// 除外は reports/ と traces/ のみ。attempt-*/ は成果物として commit するので除外しない
// (run-state.md と整合。旧版は attempt-*/ を除外していた)。
const GITIGNORE = ['node_modules/', 'dist/', '*.log', '', '# distillery2 実行状態 (reports / traces は生成物なので追跡しない)', '.distillery/runs/*/reports/', '.distillery/runs/*/traces/', ''].join('\n');

// biome.json (リポルート): formatter / linter を有効化する。format:check = `biome format .`, lint = `biome lint .`。
const BIOME_JSON = JSON.stringify({
  $schema: 'https://biomejs.dev/schemas/2.2.0/schema.json',
  vcs: { enabled: true, clientKind: 'git', useIgnoreFile: true },
  files: { ignoreUnknown: true },
  formatter: { enabled: true, indentStyle: 'space', indentWidth: 2, lineWidth: 100 },
  linter: { enabled: true, rules: { recommended: true } },
  javascript: { formatter: { quoteStyle: 'single' } },
}, null, 2) + '\n';

/** 各 app の最小 package.json。scripts は実コマンド (vitest / tsc / biome)。実装で必要なら上書きされない。 */
function appPackageJson(dir) {
  return JSON.stringify({
    name: `@app/${dir}`, version: '0.0.0', private: true, type: 'module',
    scripts: {
      'format:check': 'biome format .',
      lint: 'biome lint .',
      typecheck: 'tsc --noEmit -p .',
      test: 'vitest run',
      'test:contract': 'vitest run test/contract',
    },
  }, null, 2) + '\n';
}

/** 各 app の tsconfig.json。ルートの tsconfig.base.json を継承する。frontend は jsx を有効化する。 */
function appTsconfig(kind) {
  const compilerOptions = { rootDir: 'src', outDir: 'dist' };
  if (kind === 'frontend') compilerOptions.jsx = 'react-jsx';
  return JSON.stringify({
    extends: '../../tsconfig.base.json',
    compilerOptions,
    include: ['src', 'test'],
  }, null, 2) + '\n';
}

/** 各 app の最小 vitest.config.ts。frontend は jsdom + 自動 JSX 変換。 */
function appVitestConfig(kind) {
  const isFrontend = kind === 'frontend';
  const env = isFrontend ? 'jsdom' : 'node';
  const esbuild = isFrontend ? "\n  esbuild: { jsx: 'automatic' }," : '';
  return `import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  test: {\n    environment: '${env}',\n    include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}'],\n  },${esbuild}\n});\n`;
}

function run(o) {
  const cwd = o.cwd;
  const adrs = loadAdrs(path.resolve(cwd, o.adr));
  const { tiers } = collectTiers(adrs);
  const tierDirs = tiers.map(t => (t.dir ? String(t.dir).replace(/^apps\//, '') : t.id));
  const hasFrontend = tiers.some(t => t.kind === 'frontend');
  const created = [], skipped = [];
  for (const t of tiers) {
    const dir = t.dir ? String(t.dir).replace(/^apps\//, '') : t.id;
    ensureDir(cwd, `apps/${dir}/src`, created);
    ensureDir(cwd, `apps/${dir}/test/contract`, created);
    writeIfAbsent(cwd, `apps/${dir}/package.json`, appPackageJson(dir), created, skipped);
    writeIfAbsent(cwd, `apps/${dir}/tsconfig.json`, appTsconfig(t.kind), created, skipped);
    writeIfAbsent(cwd, `apps/${dir}/vitest.config.ts`, appVitestConfig(t.kind), created, skipped);
  }
  for (const pkg of ['contracts', 'ui', 'test-support']) ensureDir(cwd, `packages/${pkg}`, created);
  ensureDir(cwd, 'features', created);
  writeIfAbsent(cwd, 'package.json', rootPackageJson(tierDirs, hasFrontend), created, skipped);
  writeIfAbsent(cwd, 'tsconfig.base.json', TSCONFIG_BASE, created, skipped);
  writeIfAbsent(cwd, 'biome.json', BIOME_JSON, created, skipped);
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
