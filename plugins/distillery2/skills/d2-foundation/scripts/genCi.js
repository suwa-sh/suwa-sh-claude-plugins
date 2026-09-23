#!/usr/bin/env node
'use strict';
/**
 * genCi.js (F5) — .github/workflows/ci.yml を生成する
 *
 *   node genCi.js --config .distillery/config.yaml [--out .github/workflows/ci.yml] [--cwd <repo>]
 *
 * 5 ゲートを順に job にし、needs で依存を表す:
 *   static → unit → contract → uc-bdd (全 UC シナリオ) → acceptance (api)
 * コマンドは runGates.js と等価にする (config の commands をそのまま使う)。
 */
const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('../../../scripts/lib/yaml');

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

function render(config) {
  const tiers = config.tiers || [];
  const cmds = config.commands || {};
  const caps = config.capabilities || {};
  const setup = ['      - uses: actions/checkout@v4', '      - uses: actions/setup-node@v4', '        with:', '          node-version: 20', '      - run: npm ci'];
  const step = cmd => `      - run: ${cmd}`;
  const job = (id, needs, steps) => {
    const lines = [`  ${id}:`, '    runs-on: ubuntu-latest'];
    if (needs) lines.push(`    needs: ${needs}`);
    lines.push('    steps:', ...setup, ...steps);
    return lines.join('\n');
  };
  const staticSteps = [];
  for (const t of tiers) for (const k of ['format_check', 'lint', 'typecheck']) if (t.commands && t.commands[k]) staticSteps.push(step(stripReport(t.commands[k])));
  if (cmds.arch_test) staticSteps.push(step(stripReport(cmds.arch_test)));
  // unit / contract は config の各ティアコマンドから組む (runGates と同じソース)。
  const unitSteps = tiers.filter(t => t.commands && t.commands.unit).map(t => step(stripReport(t.commands.unit)));
  const contractSteps = tiers.filter(t => t.commands && t.commands.contract).map(t => step(stripReport(t.commands.contract)));
  const ucBddSteps = [step(cmds.uc_bdd ? ciCucumber(cmds.uc_bdd, 'not @browser') : 'npx cucumber-js --tags "not @browser"')];
  const acceptanceSteps = [step(cmds.acceptance_api ? ciCucumber(cmds.acceptance_api, '@acceptance and not @browser') : 'npx cucumber-js --tags "@acceptance and not @browser"')];
  // capabilities.browser: true のときだけブラウザ受入を CI にも足す (runGates と対応)。
  if (caps.browser) acceptanceSteps.push(step(cmds.acceptance_browser ? ciCucumber(cmds.acceptance_browser, '@acceptance and @browser') : 'npx cucumber-js --tags "@acceptance and @browser"'));
  return [
    'name: ci',
    'on:',
    '  push:',
    '    branches: [main]',
    '  pull_request:',
    '',
    'jobs:',
    job('static', null, staticSteps.length ? staticSteps : ['      - run: echo "no static commands"']),
    job('unit', 'static', unitSteps.length ? unitSteps : ['      - run: echo "no unit commands"']),
    job('contract', 'unit', contractSteps.length ? contractSteps : ['      - run: echo "no contract commands"']),
    job('uc-bdd', 'contract', ucBddSteps),
    job('acceptance', 'uc-bdd', acceptanceSteps),
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
module.exports = { parseArgs, render, run };
