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
  const o = { adr: 'docs/adr', cwd: process.cwd(), migrate: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--adr') o.adr = next();
    else if (a === '--cwd') o.cwd = path.resolve(next());
    else if (a === '--migrate') o.migrate = true;
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
    '@biomejs/biome': BIOME_VERSION, // exact (biome.json の $schema と qlty の版と揃える)
    '@cucumber/cucumber': '^13.2.1',
    '@electric-sql/pglite': '^0.5.8',
    '@redocly/cli': '^2.4.0',
    '@apidevtools/json-schema-ref-parser': '^15.1.0',
    'dependency-cruiser': '^18.4.0',
    vitest: '^4.1.11', // それ未満は CVE-2026-84373 (@vitest/mocker) が未修正 (OSV: fixed 4.1.11)
    supertest: '^7.3.0',
    '@types/supertest': '^7.2.1',
    '@playwright/test': '^1.63.0',
    ajv: '^8.20.0',
    'ajv-formats': '^3.0.1',
    tsx: '^4.20.0',
    typescript: '^5.9.0',
    '@types/node': '^26.0.0', // app tsconfig の types: ['node']
  };
  if (hasFrontend) {
    devDependencies.react = '^19.2.0';
    devDependencies['react-dom'] = '^19.2.0';
    devDependencies['@types/react'] = '^19.2.0';
    devDependencies['@types/react-dom'] = '^19.2.0';
    // frontend の vitest.config.ts は environment: 'jsdom' を使うので jsdom を依存に加える (指摘 2)。
    devDependencies.jsdom = '^25.0.0';
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

// .gitignore の distillery2 管理ブロック。除外は reports/ と traces/ のみ。attempt-*/ は成果物として
// commit するので除外しない (run-state.md と整合。旧版 0.1.0 は attempt-*/ を除外していた)。
// GITIGNORE_ANCHOR を含む行を管理ブロックの先頭とみなし、直後に続く `.distillery/runs/` 行までを
// migrate で置き換える (指摘 5)。
const GITIGNORE_ANCHOR = 'distillery2 実行状態';
const GITIGNORE_MANAGED = ['# distillery2 実行状態 (reports / traces / logs は生成物なので追跡しない)', '.distillery/runs/*/reports/', '.distillery/runs/*/traces/', '.distillery/logs/'];
const GITIGNORE = ['node_modules/', 'dist/', '*.log', '', ...GITIGNORE_MANAGED, ''].join('\n');

// biome の版は 1 か所で決める。npm の devDependency (exact)、biome.json の $schema、qlty の biome プラグイン (genQlty.js) を同じ版にする
// (版が違うと biome が「schema と CLI の版が一致しない」を medium で出し、qlty のゲートが落ちる)
const BIOME_VERSION = '2.2.5';

// 既存リポ (package.json が既にある) では、そのリポが使っている biome の版を qlty 側に使う (Codex 0.1.11 指摘 1)。
// lockfile の解決済み版 → package.json の devDependency (範囲指定の ^ ~ を落とす) → 既定 の順。
function readJsonSafe(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function existingBiomeVersion(cwd) {
  const lock = readJsonSafe(path.resolve(cwd, 'package-lock.json'));
  const locked = lock?.packages?.['node_modules/@biomejs/biome']?.version;
  if (locked && /^\d+\.\d+\.\d+$/.test(locked)) return locked;
  const pkg = readJsonSafe(path.resolve(cwd, 'package.json'));
  const dep = pkg?.devDependencies?.['@biomejs/biome'] ?? pkg?.dependencies?.['@biomejs/biome'];
  const m = dep && String(dep).match(/(\d+\.\d+\.\d+)/);
  if (m) return m[1];
  const schema = readJsonSafe(path.resolve(cwd, 'biome.json'))?.$schema;
  const s = schema && String(schema).match(/\/schemas\/(\d+\.\d+\.\d+)\//);
  return s ? s[1] : null;
}

// biome.json (リポルート): formatter / linter を有効化する。format:check = `biome format .`, lint = `biome lint .`。
const biomeJson = (biomeVersion) => JSON.stringify({
  $schema: `https://biomejs.dev/schemas/${biomeVersion}/schema.json`,
  vcs: { enabled: true, clientKind: 'git', useIgnoreFile: true },
  // 生成物 (契約の codegen / bundle / Storybook 出力) はルートの整形・lint から外す (ティアの biome format . には元から入らない)
  files: { ignoreUnknown: true, includes: ['**', '!!packages/contracts', '!!contracts/generated', '!!docs/design/storybook-app'] },
  formatter: { enabled: true, indentStyle: 'space', indentWidth: 2, lineWidth: 100 },
  linter: { enabled: true, rules: { recommended: true } },
  javascript: { formatter: { quoteStyle: 'single' } },
}, null, 2) + '\n';

// .qlty/qlty.toml は genQlty.js が生成する (qlty init の提案を土台に distillery2 の上乗せ。0.1.12〜)

/** 各 app の scripts (実コマンド)。migrate は 0.1.0 の echo プレースホルダをこの値へ置き換える。 */
function appScripts() {
  return {
    'format:check': 'biome format .',
    lint: 'biome lint .',
    typecheck: 'tsc --noEmit -p .',
    test: 'vitest run',
    'test:contract': 'vitest run -c vitest.contract.config.ts',
  };
}

// 0.1.0 が生成した app package.json の echo プレースホルダ。値が完全一致するときだけ migrate で
// 実コマンドへ差し替える (指摘 5)。手編集済みの script は触らない。
const LEGACY_APP_SCRIPTS = {
  'format:check': ['echo "format:check placeholder — d2 で本物に差し替える"'],
  lint: ['echo "lint placeholder"'],
  typecheck: ['echo "typecheck placeholder"'],
  test: ['echo "no unit tests yet"'],
  // 0.1.12 以前の 'vitest run test/contract' は単体の include と重なる (0.1.10 実走 ④-5)
  'test:contract': ['echo "no contract tests yet"', 'vitest run test/contract'],
};

/** 各 app の最小 package.json。scripts は実コマンド (vitest / tsc / biome)。実装で必要なら上書きされない。 */
function appPackageJson(dir) {
  return JSON.stringify({
    name: `@app/${dir}`, version: '0.0.0', private: true, type: 'module',
    scripts: appScripts(),
  }, null, 2) + '\n';
}

/**
 * 各 app の tsconfig.json。ルートの tsconfig.base.json を継承する。frontend は jsx を有効化する。
 * rootDir は付けない (指摘 1)。付けると include の `test` が rootDir 外になり、契約テスト生成後に
 * `tsc --noEmit -p .` が TS6059 で失敗する。rootDir 未指定なら tsc が入力から推定するので typecheck が通る。
 */
/**
 * biome の JSON 整形に合わせる: 文字列だけの短い配列は 1 行にする (JSON.stringify は常に複数行にするので
 * tsconfig の include が format_check で落ちた。0.1.10 実走 ③-1)。
 */
function stringifyLikeBiome(obj) {
  return JSON.stringify(obj, null, 2).replace(/\[\n\s+("[^"\n]*"(?:,\n\s+"[^"\n]*")*)\n\s*\]/g, (m, inner) => {
    const one = `[${inner.replace(/,\n\s+/g, ', ')}]`;
    return one.length <= 80 ? one : m;
  }) + '\n';
}

function appTsconfig(kind) {
  // types: node は process / Buffer 等を使う実装と test-app のため (0.1.10 実走で実装者が手で足した)
  const compilerOptions = { outDir: 'dist', types: ['node'] };
  if (kind === 'frontend') compilerOptions.jsx = 'react-jsx';
  return stringifyLikeBiome({
    extends: '../../tsconfig.base.json',
    compilerOptions,
    include: ['src', 'test'],
  });
}

/** 空の src/ では tsc が対象ファイルを見つけられず typecheck が落ちる (0.1.10 実走 ③-2)。実装が置き換える。 */
const EMPTY_INDEX_TS = '// distillery2 genSkeleton.js が置いた空のエントリ。実装で置き換える (typecheck が対象ファイル 0 で落ちないため)\nexport {};\n';

/**
 * 各 app の vitest 設定。単体 (vitest.config.ts) は src/ だけ、契約テスト (vitest.contract.config.ts) は test/contract/ だけを対象にする
 * (同じ include だと契約テストの失敗が unit ゲートにも出る。0.1.10 実走 ④-5)。frontend は jsdom + 自動 JSX 変換。
 */
function appVitestConfig(kind, scope = 'unit') {
  const isFrontend = kind === 'frontend';
  const env = isFrontend ? 'jsdom' : 'node';
  const esbuild = isFrontend ? "\n  esbuild: { jsx: 'automatic' }," : '';
  const include = scope === 'contract' ? "['test/contract/**/*.{test,spec}.{ts,tsx}']" : "['src/**/*.{test,spec}.{ts,tsx}']";
  const note = scope === 'contract' ? '// 契約テスト専用 (test:contract)。単体は vitest.config.ts\n' : '// 単体テスト専用 (test)。契約テストは vitest.contract.config.ts\n';
  return `${note}import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  test: {\n    environment: '${env}',\n    include: ${include},\n  },${esbuild}\n});\n`;
}

// ---- 0.1.0 生成物の移行 (--migrate) ---------------------------------------

/** .gitignore の管理ブロックを最新へ書き換える (0.1.0 の attempt 除外行を除去)。変更したら記録する。 */
function migrateGitignore(cwd, changes) {
  const p = path.resolve(cwd, '.gitignore');
  if (!fs.existsSync(p)) return;
  const orig = fs.readFileSync(p, 'utf8');
  const lines = orig.split('\n');
  const start = lines.findIndex((l) => l.includes(GITIGNORE_ANCHOR));
  if (start < 0) return;
  let end = start + 1;
  while (end < lines.length && lines[end].startsWith('.distillery/')) end++;  // runs/ と logs/ の行 (logs/ を取りこぼすと毎回書き換わる)
  const next = [...lines.slice(0, start), ...GITIGNORE_MANAGED, ...lines.slice(end)].join('\n');
  if (next === orig) return;
  fs.writeFileSync(p, next);
  changes.push('.gitignore: 管理ブロックを更新 (attempt-*/ を追跡対象へ)');
}

/** app package.json の 0.1.0 echo プレースホルダを実コマンドへ差し替える。変更したら記録する。 */
function migrateAppScripts(cwd, rel, changes) {
  const p = path.resolve(cwd, rel);
  if (!fs.existsSync(p)) return;
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return; }
  if (!pkg || !pkg.scripts) return;
  const real = appScripts();
  const replaced = [];
  for (const [name, legacy] of Object.entries(LEGACY_APP_SCRIPTS)) {
    if (legacy.includes(pkg.scripts[name])) { pkg.scripts[name] = real[name]; replaced.push(name); }
  }
  if (!replaced.length) return;
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
  changes.push(`${rel}: echo プレースホルダを実コマンド化 (${replaced.join(', ')})`);
}

/** 既存 biome.json の $schema の版が決定した版と違うとき、$schema だけ書き換える (Codex 0.1.11 ラウンド 3)。 */
function migrateBiomeSchema(cwd, biomeVersion, changes) {
  const p = path.resolve(cwd, 'biome.json');
  const cfg = readJsonSafe(p);
  const cur = cfg?.$schema && String(cfg.$schema).match(/\/schemas\/(\d+\.\d+\.\d+)\//);
  if (!cur || cur[1] === biomeVersion) return;
  cfg.$schema = `https://biomejs.dev/schemas/${biomeVersion}/schema.json`;
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  changes.push(`biome.json: $schema を ${cur[1]} → ${biomeVersion} (lockfile / package.json の biome と揃える)`);
}

/** 既存 biome.json の $schema が決定した版と違えば警告 (migrate でないときは書き換えない)。 */
function warnBiomeSchema(cwd, biomeVersion) {
  const cur = readJsonSafe(path.resolve(cwd, 'biome.json'))?.$schema;
  const m = cur && String(cur).match(/\/schemas\/(\d+\.\d+\.\d+)\//);
  if (m && m[1] !== biomeVersion) console.error(`warn: biome.json の $schema (${m[1]}) と biome の版 (${biomeVersion}) が違う。--migrate で揃えるか手で直す`);
}

/**
 * 0.1.0 で生成したプロジェクトを 0.1.1 相当へ移行する。呼び出し元 (run) が先に writeIfAbsent で
 * 不足ファイル (app tsconfig / vitest.config / biome.json 等) を作り、その後でこの関数が
 * 既存ファイル (writeIfAbsent が skip するもの) を書き換える。
 */
function migrate(cwd, biomeVersion) {
  const changes = [];
  migrateGitignore(cwd, changes);
  migrateBiomeSchema(cwd, biomeVersion, changes);
  const appsDir = path.resolve(cwd, 'apps');
  const entries = fs.existsSync(appsDir) ? fs.readdirSync(appsDir, { withFileTypes: true }) : [];
  for (const entry of entries) {
    if (entry.isDirectory()) migrateAppScripts(cwd, `apps/${entry.name}/package.json`, changes);
  }
  return changes;
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
    writeIfAbsent(cwd, `apps/${dir}/vitest.contract.config.ts`, appVitestConfig(t.kind, 'contract'), created, skipped);
    writeIfAbsent(cwd, `apps/${dir}/src/index.ts`, EMPTY_INDEX_TS, created, skipped);
  }
  for (const pkg of ['contracts', 'ui', 'test-support']) ensureDir(cwd, `packages/${pkg}`, created);
  ensureDir(cwd, 'features', created);
  writeIfAbsent(cwd, 'package.json', rootPackageJson(tierDirs, hasFrontend), created, skipped);
  writeIfAbsent(cwd, 'tsconfig.base.json', TSCONFIG_BASE, created, skipped);
  // package.json を今回作ったなら BIOME_VERSION、既存なら既存の版 (lockfile → package.json → biome.json)。
  // biome.json の $schema と qlty のプラグイン (genQlty.js が同じ関数で版を引く) を同じ版にする
  const biomeVersion = (created.includes('package.json') ? null : existingBiomeVersion(cwd)) ?? BIOME_VERSION;
  writeIfAbsent(cwd, 'biome.json', biomeJson(biomeVersion), created, skipped);
  writeIfAbsent(cwd, '.gitignore', GITIGNORE, created, skipped);
  const migrated = o.migrate ? migrate(cwd, biomeVersion) : [];
  if (!o.migrate) warnBiomeSchema(cwd, biomeVersion);
  return { code: 0, created, skipped, tierDirs, migrated };
}

function main(argv) {
  let o; try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const r = run(o);
  console.log(`genSkeleton: created ${r.created.length}, skipped ${r.skipped.length}`);
  for (const s of r.skipped) console.log(`  skip (exists): ${s}`);
  if (o.migrate) {
    console.log(`migrate: ${r.migrated.length} change(s)`);
    for (const c of r.migrated) console.log(`  ${c}`);
  }
  return r.code;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { parseArgs, rootPackageJson, run, BIOME_VERSION, existingBiomeVersion };
