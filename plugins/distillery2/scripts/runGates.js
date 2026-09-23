#!/usr/bin/env node
/**
 * runGates.js — ゲートを安い順に実行し、落ちたら止める
 *
 *   static → unit → contract → uc-bdd → acceptance
 *
 * Usage:
 *   node runGates.js --uc <slug> [--upto <gate>] [--from <gate>] [--only <gate>] [--expect-red <gate>]
 *                    [--config .distillery/config.yaml] [--cwd <repo>] [--json]
 *
 * - コマンドは .distillery/config.yaml から取る (skills/d2-run/references/config-schema.md)
 * - {slug} と {report} を置換する。レポートは .distillery/runs/<slug>/reports/<gate>[.<tier>].json
 * - 判定は終了コードだけ。定義の無いコマンドは skipped
 * - --expect-red <gate>: そのゲートは「落ちること」が成功 (scaffold の red baseline 確認用)
 * - 結果を reports/gates.json に書く。終了コードは 0 = 全ゲート期待どおり / 1 = 落ちた / 2 = 設定エラー
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { parseYaml } = require('./lib/yaml');

const GATES = ['static', 'unit', 'contract', 'uc-bdd', 'acceptance'];

function parseArgs(argv) {
  const o = { cwd: process.cwd(), config: '.distillery/config.yaml', expectRed: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--uc') o.uc = next();
    else if (a === '--upto') o.upto = next();
    else if (a === '--from') o.from = next();
    else if (a === '--only') o.only = next();
    else if (a === '--expect-red') o.expectRed = next();
    else if (a === '--config') o.config = next();
    else if (a === '--cwd') o.cwd = path.resolve(next());
    else if (a === '--json') o.json = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  for (const k of ['upto', 'from', 'only', 'expectRed']) if (o[k] && !GATES.includes(o[k])) throw new Error(`Unknown gate: ${o[k]}`);
  return o;
}

function selectGates(o) {
  if (o.only) return [o.only];
  const from = o.from ? GATES.indexOf(o.from) : 0;
  const upto = o.upto ? GATES.indexOf(o.upto) : GATES.length - 1;
  return GATES.slice(from, upto + 1);
}

function runCommand(cmd, cwd) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(cmd, { cwd, shell: true, env: { ...process.env, CI: 'true' } });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', code => resolve({ exit: code, duration_ms: Date.now() - started, output_tail: out.slice(-4000) }));
    child.on('error', err => resolve({ exit: -1, duration_ms: Date.now() - started, output_tail: String(err.message) }));
  });
}

function planGate(gate, config, ctx) {
  const jobs = [];
  const tiers = config.tiers || [];
  const cmds = config.commands || {};
  const rep = (name, tier) => path.join(ctx.reportsDir, tier ? `${name}.${tier}.json` : `${name}.json`);
  const sub = (cmd, tier, name) => cmd.replace(/\{slug\}/g, ctx.slug).replace(/\{report\}/g, rep(name, tier));
  const tierJob = (tier, key, name) => {
    const c = tier.commands && tier.commands[key];
    return c ? { name: name || key, tier: tier.id, cmd: sub(c, tier.id, name || key), report: c.includes('{report}') ? rep(name || key, tier.id) : null } : { name: name || key, tier: tier.id, skipped: true };
  };
  switch (gate) {
    case 'static':
      for (const t of tiers) for (const k of ['format_check', 'lint', 'typecheck']) jobs.push(tierJob(t, k));
      jobs.push(cmds.arch_test ? { name: 'arch_test', cmd: sub(cmds.arch_test, null, 'arch_test') } : { name: 'arch_test', skipped: true });
      return { parallel: true, jobs };
    case 'unit': for (const t of tiers) jobs.push(tierJob(t, 'unit')); return { parallel: true, jobs };
    case 'contract': for (const t of tiers) jobs.push(tierJob(t, 'contract')); return { parallel: true, jobs };
    case 'uc-bdd':
      jobs.push(cmds.uc_bdd ? { name: 'uc_bdd', cmd: sub(cmds.uc_bdd, null, 'uc-bdd'), report: rep('uc-bdd') } : { name: 'uc_bdd', skipped: true });
      return { parallel: false, jobs };
    case 'acceptance':
      jobs.push(cmds.acceptance_api ? { name: 'acceptance_api', cmd: sub(cmds.acceptance_api, null, 'acceptance-api'), report: rep('acceptance-api') } : { name: 'acceptance_api', skipped: true });
      if (config.capabilities && config.capabilities.browser) jobs.push(cmds.acceptance_browser ? { name: 'acceptance_browser', cmd: sub(cmds.acceptance_browser, null, 'acceptance-browser'), report: rep('acceptance-browser') } : { name: 'acceptance_browser', skipped: true });
      return { parallel: false, jobs };
    default: throw new Error(`Unknown gate ${gate}`);
  }
}

async function runGate(gate, config, ctx) {
  const plan = planGate(gate, config, ctx);
  const started = Date.now();
  const results = [];
  const exec = async job => {
    if (job.skipped) return { ...job, status: 'skipped' };
    const r = await runCommand(job.cmd, ctx.cwd);
    return { ...job, ...r, status: r.exit === 0 ? 'pass' : 'fail' };
  };
  if (plan.parallel) results.push(...await Promise.all(plan.jobs.map(exec)));
  else for (const job of plan.jobs) { const r = await exec(job); results.push(r); if (r.status === 'fail') break; }
  const failed = results.some(r => r.status === 'fail');
  const ran = results.some(r => r.status !== 'skipped');
  return { name: gate, status: failed ? 'fail' : ran ? 'pass' : 'skipped', duration_ms: Date.now() - started, jobs: results };
}

async function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  if (!o.uc) { console.error('--uc <slug> is required'); return 2; }
  // slug はシェルコマンドに埋め込まれるので形式を固定する (use-cases.yaml の slug と同じ規則)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.uc)) { console.error(`invalid slug: ${o.uc} (expected kebab-case)`); return 2; }
  const configPath = path.resolve(o.cwd, o.config);
  if (!fs.existsSync(configPath)) { console.error(`config not found: ${configPath}`); return 2; }
  const config = parseYaml(fs.readFileSync(configPath, 'utf8'));
  const runDir = path.join(o.cwd, '.distillery', 'runs', o.uc);
  const reportsDir = path.join(runDir, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const ctx = { cwd: o.cwd, slug: o.uc, reportsDir };
  const summary = { uc: o.uc, started_at: new Date().toISOString(), expect_red: o.expectRed, gates: [] };
  let ok = true;
  for (const gate of selectGates(o)) {
    const r = await runGate(gate, config, ctx);
    if (o.expectRed === gate) {
      r.expected = 'red';
      r.status = r.status === 'fail' ? 'pass' : (r.status === 'skipped' ? 'skipped' : 'fail');
      if (r.status === 'fail') r.note = 'expected the gate to fail (red baseline) but it passed';
    }
    summary.gates.push(r);
    if (!o.json) console.log(`${r.status === 'pass' ? 'PASS' : r.status === 'skipped' ? 'SKIP' : 'FAIL'} ${gate} (${r.duration_ms} ms)`);
    if (r.status === 'fail') {
      ok = false;
      if (!o.json) for (const j of r.jobs.filter(j => j.status === 'fail')) console.log(`  - ${j.tier ? j.tier + ':' : ''}${j.name} exit=${j.exit}\n${indent(j.output_tail)}`);
      break;
    }
  }
  summary.finished_at = new Date().toISOString();
  summary.result = ok ? 'pass' : 'fail';
  fs.writeFileSync(path.join(reportsDir, 'gates.json'), JSON.stringify(summary, null, 2) + '\n');
  if (o.json) console.log(JSON.stringify(summary, null, 2));
  return ok ? 0 : 1;
}

function indent(s) { return String(s || '').split('\n').slice(-30).map(l => '      ' + l).join('\n'); }

if (require.main === module) main(process.argv.slice(2)).then(code => process.exit(code));

module.exports = { GATES, parseArgs, selectGates, planGate, runGate, main };
