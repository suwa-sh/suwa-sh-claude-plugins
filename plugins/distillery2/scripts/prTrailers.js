#!/usr/bin/env node
/**
 * prTrailers.js — UC の squash commit / PR 本文に付ける trailer を run state から作る
 *
 * Usage:
 *   node prTrailers.js --run .distillery/runs/<slug> [--cwd <repo>] [--body <path>]  # trailer 行を stdout に出す
 *   node prTrailers.js --run ... --commit-message "feat: 貸出を登録する"                 # 件名 + 空行 + trailer を出す
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

function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const runDir = path.resolve(o.cwd, o.run);
  if (!fs.existsSync(runDir)) { console.error(`run dir not found: ${runDir}`); return 2; }
  const trailers = buildTrailers({ cwd: o.cwd, runDir, docsRoot: o.docsRoot });
  console.log(o.message ? `${o.message}\n\n${render(trailers)}` : render(trailers));
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { buildTrailers, render };
