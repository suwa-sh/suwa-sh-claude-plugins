#!/usr/bin/env node
'use strict';
/**
 * genCi.js (F5) — .github/workflows/ci.yml を生成する
 *
 *   node genCi.js --config .distillery/config.yaml [--out .github/workflows/ci.yml] [--cwd <repo>]
 *
 * 機械チェックの一括実行 (scripts/check.mjs --mode ci) を回す 1 本の job (0.3.0。以前は 5 ゲートを job に並べていた)。
 * 一括チェックのコマンドは config の commands から genCheck.js が作る (runGates.js と同じ正)。
 */
const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('../../d2-common/scripts/lib/yaml');

function parseArgs(argv) {
  const o = { config: '.distillery/config.yaml', out: '.github/workflows/ci.yml', cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--config') o.config = next();
    else if (a === '--out') o.out = next();
    else if (a === '--cwd') o.cwd = path.resolve(next());
    else throw new Error(`Unknown arg: ${a}`);
  }
  return o;
}

/**
 * config のコマンドを CI 用に整える。
 *  - {report} を書き出すフラグは CI では要らない (判定は exit code)。素で埋めると壊れるので落とす。
 *  - 残った {report} は保険で CI パスへ置換する。
 */
function stripReport(cmd) {
  return String(cmd)
    .replace(/\s*--reporter=json\s+--outputFile=\{report\}/g, '')
    .replace(/\s*--format\s+json:\{report\}/g, '')
    .replace(/\s*--outputFile=\{report\}/g, '')
    .replace(/\{report\}/g, 'reports/ci.json')
    .trim();
}

/**
 * cucumber コマンドを CI 変種にする。ローカルは {slug} で 1 UC に絞るが CI は全 UC を回すので、
 * --tags 式から `@uc:{slug}` を外し、空になったら fallbackTags (not @browser 等) を入れる。
 */
function ciCucumber(cmd, fallbackTags) {
  return stripReport(cmd).replace(/--tags\s+"([^"]*)"/, (_, expr) => {
    let e = expr
      .replace(/@uc:\{slug\}\s+and\s+/g, '')
      .replace(/\s+and\s+@uc:\{slug\}/g, '')
      .replace(/@uc:\{slug\}/g, '')
      .trim();
    if (!e) e = fallbackTags;
    return `--tags "${e}"`;
  });
}

/**
 * CI の単体テストと契約テストはテストが 0 件のティアでも落とさない (vitest の --passWithNoTests)。
 * 手元のゲート (runGates) は 0 件で落ちることを red baseline に使うので、CI の手順だけに付ける。
 * main と feature への push で CI を回すと、テストの無いティア (worker など) で main が必ず赤になるため (0.1.26)。
 */
function passWithNoTests(cmd) {
  if (/--passWithNoTests\b/.test(cmd)) return cmd;
  if (/\bvitest\b/.test(cmd)) return `${cmd} --passWithNoTests`;
  if (/\bnpm run test(:[\w-]+)?\b/.test(cmd)) return / -- /.test(` ${cmd} `) ? `${cmd} --passWithNoTests` : `${cmd} -- --passWithNoTests`;
  return cmd;
}

/**
 * CI は機械チェックの一括実行 (scripts/check.mjs --mode ci。genCheck.js が config から生成) を回す 1 本の job (0.3.0)。
 * コマンドの正を一括チェックに 1 つにする (ティアのコマンドの組み立ては genCheck.js が stripReport / ciCucumber / passWithNoTests で行う)
 */
function render(config) {
  const usesQlty = Object.values(config.commands || {}).some((c) => /\bqlty\b/.test(String(c)))
    || (config.tiers || []).some((t) => Object.values(t.commands || {}).some((c) => /\bqlty\b/.test(String(c))));
  const steps = [
    // zizmor の指摘に従い、checkout の credential 保持を切り、permissions は最小 (contents: read) にする
    '      - uses: actions/checkout@v4', '        with:', '          persist-credentials: false',
    '      - uses: actions/setup-node@v4', '        with:', '          node-version: 20',
    '      - run: npm ci',
  ];
  // qlty CLI (リポ全体の lint・秘密情報、ティアの SAST) は install action を SHA でピン留めして入れる
  if (usesQlty) steps.push('      - uses: qltysh/qlty-action/install@08a0a862c159eae9b9003081da6663d96efef637 # v2.3.0');
  steps.push('      - run: node scripts/check.mjs --mode ci');
  return [
    'name: ci',
    // PR を作らない (0.1.26)。main と feature への push で回す
    'on:',
    '  push:',
    "    branches: [main, 'feature/**']",
    '',
    'permissions:',
    '  contents: read',
    '',
    'jobs:',
    '  check:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    ...steps,
    '',
  ].join('\n');
}

function run(o) {
  const configPath = path.resolve(o.cwd, o.config);
  if (!fs.existsSync(configPath)) { console.error(`config not found: ${configPath}`); return { code: 2 }; }
  const config = parseYaml(fs.readFileSync(configPath, 'utf8'));
  const outPath = path.resolve(o.cwd, o.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, render(config));
  return { code: 0, out: outPath };
}

function main(argv) {
  let o; try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const r = run(o);
  if (r.code === 0) console.log(`genCi: → ${o.out}`);
  return r.code;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { passWithNoTests, stripReport, ciCucumber, parseArgs, render, run };
