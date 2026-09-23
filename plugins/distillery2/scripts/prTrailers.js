#!/usr/bin/env node
/**
 * prTrailers.js — UC の squash commit / PR 本文に付ける trailer を run state から作る
 *
 * Usage:
 *   node prTrailers.js --run .distillery/runs/<slug> [--cwd <repo>] [--strict]        # trailer 行を stdout に出す
 *   node prTrailers.js --run ... --commit-message "feat: 貸出を登録する" --strict     # 件名 + 空行 + trailer を出す
 *
 * --strict (配送時に使う): UC / Basis-Requirements / Gates (全段 pass) / Assumptions / As-Built が揃わなければ exit 1
 *
 * 入力: use-cases.yaml (docs/requirements)、reports/gates.json、events.jsonl (review_approved / feedback_filed)、
 *       basis.js stamp (requirements / adr / contracts)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('./lib/yaml');
const basis = require('./lib/basis');
const { readEvents } = require('./lib/runState');

function parseArgs(argv) {
  const o = { cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') o.run = argv[++i];
    else if (a === '--cwd') o.cwd = path.resolve(argv[++i]);
    else if (a === '--commit-message') o.message = argv[++i];
    else if (a === '--docs-root') o.docsRoot = argv[++i];
    else if (a === '--strict') o.strict = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!o.run) throw new Error('--run <runDir> is required');
  return o;
}

function findUseCase(cwd, docsRoot, slug) {
  const file = path.join(cwd, docsRoot, 'requirements', 'use-cases.yaml');
  if (!fs.existsSync(file)) return null;
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  return (doc.use_cases || doc.ucs || []).find(u => u.slug === slug) || null;
}

function buildTrailers({ cwd, runDir, docsRoot = 'docs' }) {
  const events = readEvents(runDir);
  const slug = (events[0] && events[0].slug) || path.basename(runDir);
  const uc = findUseCase(cwd, docsRoot, slug);
  const trailers = [];
  if (uc) trailers.push(['UC', [uc.business, uc.buc, uc.uc].filter(Boolean).join('/')]);
  trailers.push(['UC-Slug', slug]);
  const stamped = basis.stamp({ requirements: `${docsRoot}/requirements`, adr: `${docsRoot}/adr`, contracts: 'contracts' }, cwd);
  for (const [name, key] of [['requirements', 'Basis-Requirements'], ['adr', 'Basis-Adr'], ['contracts', 'Basis-Contracts']]) if (stamped[name]) trailers.push([key, stamped[name]]);
  const gatesFile = path.join(runDir, 'reports', 'gates.json');
  if (fs.existsSync(gatesFile)) {
    const g = JSON.parse(fs.readFileSync(gatesFile, 'utf8'));
    trailers.push(['Gates', g.gates.map(x => `${x.name}=${x.status}`).join(' ')]);
  }
  const approval = [...events].reverse().find(e => e.type === 'review_approved');
  if (approval && approval.assumption_decisions) {
    const d = approval.assumption_decisions;
    const count = s => d.filter(x => x.decision === s).length;
    trailers.push(['Assumptions', `confirmed=${count('confirmed')} auto=${count('auto_confirmed')} rejected=${count('rejected')}`]);
  }
  if (uc) trailers.push(['As-Built', `${docsRoot}/as-built/${uc.business}/${uc.uc}/index.md`]);
  for (const e of events.filter(e => e.type === 'feedback_filed')) trailers.push(['Feedback', `${e.kind}:${e.url}`]);
  return trailers;
}

function render(trailers) { return trailers.map(([k, v]) => `${k}: ${v}`).join('\n'); }

/** 配送に必要な trailer が揃っているか。欠落と、Gates に pass 以外の段があるものを返す */
const GATE_NAMES = ['static', 'unit', 'contract', 'uc-bdd', 'acceptance'];

function strictProblems(trailers, cwd = process.cwd()) {
  const map = new Map(trailers);
  const problems = [];
  for (const k of ['UC', 'UC-Slug', 'Basis-Requirements', 'Gates', 'Assumptions', 'As-Built']) if (!map.has(k)) problems.push(`missing ${k}`);
  const gates = map.get('Gates');
  if (gates) {
    const entries = gates.split(' ').map(p => p.split('='));
    const notPass = entries.filter(([, s]) => s !== 'pass').map(([n, s]) => `${n}=${s}`);
    if (notPass.length) problems.push(`Gates not all pass: ${notPass.join(' ')}`);
    for (const name of GATE_NAMES) {
      const n = entries.filter(([g]) => g === name).length;
      if (n !== 1) problems.push(`Gates must list ${name} exactly once (found ${n})`);
    }
    const extra = entries.map(([g]) => g).filter(g => !GATE_NAMES.includes(g));
    if (extra.length) problems.push(`Gates has unknown gate(s): ${extra.join(' ')}`);
  }
  const asBuilt = map.get('As-Built');
  if (asBuilt && !fs.existsSync(path.resolve(cwd, asBuilt))) problems.push(`As-Built file not found: ${asBuilt}`);
  return problems;
}

function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const runDir = path.resolve(o.cwd, o.run);
  if (!fs.existsSync(runDir)) { console.error(`run dir not found: ${runDir}`); return 2; }
  const trailers = buildTrailers({ cwd: o.cwd, runDir, docsRoot: o.docsRoot });
  if (o.strict) {
    const problems = strictProblems(trailers, o.cwd);
    if (problems.length) { console.error(`prTrailers --strict: ${problems.join('; ')}`); return 1; }
  }
  console.log(o.message ? `${o.message}\n\n${render(trailers)}` : render(trailers));
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { buildTrailers, render, strictProblems };
