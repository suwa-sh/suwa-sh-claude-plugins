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

function render(config) {
  const tiers = config.tiers || [];
  const cmds = config.commands || {};
  const setup = ['      - uses: actions/checkout@v4', '      - uses: actions/setup-node@v4', '        with:', '          node-version: 20', '      - run: npm ci'];
  const job = (id, needs, steps) => {
    const lines = [`  ${id}:`, '    runs-on: ubuntu-latest'];
    if (needs) lines.push(`    needs: ${needs}`);
    lines.push('    steps:', ...setup, ...steps);
    return lines.join('\n');
  };
  const staticSteps = [];
  for (const t of tiers) for (const k of ['format_check', 'lint', 'typecheck']) if (t.commands && t.commands[k]) staticSteps.push(`      - run: ${t.commands[k]}`);
  if (cmds.arch_test) staticSteps.push(`      - run: ${cmds.arch_test}`);
  const unitSteps = tiers.filter(t => t.commands && t.commands.unit).map(t => `      - run: npm run test -w ${t.dir}`);
  const contractSteps = tiers.filter(t => t.commands && t.commands.contract).map(t => `      - run: npm run test:contract -w ${t.dir}`);
  const ucBddSteps = ['      - run: npx cucumber-js --tags "not @browser"'];
  const acceptanceSteps = ['      - run: npx cucumber-js --tags "@acceptance and not @browser"'];
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
