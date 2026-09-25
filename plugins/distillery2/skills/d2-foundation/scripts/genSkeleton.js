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

// biome の版は 1 か所で決める。npm の devDependency (exact)、biome.json の $schema、qlty の biome プラグインを同じ版にする
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
  files: { ignoreUnknown: true },
  formatter: { enabled: true, indentStyle: 'space', indentWidth: 2, lineWidth: 100 },
  linter: { enabled: true, rules: { recommended: true } },
  javascript: { formatter: { quoteStyle: 'single' } },
}, null, 2) + '\n';

// .qlty/qlty.toml (リポルート): formatter / linter / SAST を 1 つのゲートにまとめる。
// - 検査は `qlty check --all --no-fix --no-progress --no-upgrade-check --no-formatters --fail-level medium` (config の commands.quality)
// - `qlty check --fix` は使わない (formatter がリポ全体に適用され、修正候補の位置ずれで識別子が壊れる実績)。整形は `qlty fmt --all`
// - 生成物・vendored (packages/ui、packages/contracts、contracts/generated、Storybook、契約テスト) は exclude_patterns で検査対象外
// - コードスメル (radarlint-js) は [[triage]] で low に降格 (助言扱い)。ルール単位の無視は [[ignore]] / [[triage]] で書く ([[exclude]] に rules は書けない)
const qltyToml = (biomeVersion) => `# distillery2 genSkeleton.js が生成した qlty の設定。ゲートは commands.quality (.distillery/config.yaml)。
# 整形は \`qlty fmt --all\`。\`qlty check --fix\` は使わない (リポ全体を整形して壊す)。
# 仕様の正本: https://docs.qlty.sh/cli/qlty-toml
config_version = "0"

exclude_patterns = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/*.d.ts",
  "**/*.min.*",
  ".distillery/**",
  "packages/ui/**",
  "packages/contracts/**",
  "contracts/generated/**",
  "docs/design/storybook-app/**",
  "docs/design/screenshots/**",
  "**/test/contract/**",
]

test_patterns = [
  "**/test/**",
  "**/*.test.*",
  "**/*.spec.*",
  "features/**",
]

[smells]
mode = "comment"

[[source]]
name = "default"
default = true

# コードスメルは助言 (ゲートを止めない)
[[triage]]
match.plugins = ["radarlint-js"]
set.level = "low"

[[plugin]]
name = "biome"
version = "${biomeVersion}"

[[plugin]]
name = "radarlint-js"

[[plugin]]
name = "actionlint"

[[plugin]]
name = "zizmor"

[[plugin]]
name = "trufflehog"

[[plugin]]
name = "osv-scanner"
`;

/** 各 app の scripts (実コマンド)。migrate は 0.1.0 の echo プレースホルダをこの値へ置き換える。 */
function appScripts() {
  return {
    'format:check': 'biome format .',
    lint: 'biome lint .',
    typecheck: 'tsc --noEmit -p .',
    test: 'vitest run',
    'test:contract': 'vitest run test/contract',
  };
}

// 0.1.0 が生成した app package.json の echo プレースホルダ。値が完全一致するときだけ migrate で
// 実コマンドへ差し替える (指摘 5)。手編集済みの script は触らない。
const LEGACY_APP_SCRIPTS = {
  'format:check': 'echo "format:check placeholder — d2 で本物に差し替える"',
  lint: 'echo "lint placeholder"',
  typecheck: 'echo "typecheck placeholder"',
  test: 'echo "no unit tests yet"',
  'test:contract': 'echo "no contract tests yet"',
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
function appTsconfig(kind) {
  const compilerOptions = { outDir: 'dist' };
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
  while (end < lines.length && lines[end].startsWith('.distillery/runs/')) end++;
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
    if (pkg.scripts[name] === legacy) { pkg.scripts[name] = real[name]; replaced.push(name); }
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
  }
  for (const pkg of ['contracts', 'ui', 'test-support']) ensureDir(cwd, `packages/${pkg}`, created);
  ensureDir(cwd, 'features', created);
  writeIfAbsent(cwd, 'package.json', rootPackageJson(tierDirs, hasFrontend), created, skipped);
  writeIfAbsent(cwd, 'tsconfig.base.json', TSCONFIG_BASE, created, skipped);
  // package.json を今回作ったなら BIOME_VERSION、既存なら既存の版 (lockfile → package.json → biome.json)。
  // biome.json の $schema と qlty のプラグインを同じ版にする (Codex 0.1.11 指摘 1、ラウンド 2)
  const biomeVersion = (created.includes('package.json') ? null : existingBiomeVersion(cwd)) ?? BIOME_VERSION;
  writeIfAbsent(cwd, 'biome.json', biomeJson(biomeVersion), created, skipped);
  writeIfAbsent(cwd, '.qlty/qlty.toml', qltyToml(biomeVersion), created, skipped);
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
module.exports = { parseArgs, rootPackageJson, run };
