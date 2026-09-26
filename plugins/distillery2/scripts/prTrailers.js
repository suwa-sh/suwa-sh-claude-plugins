#!/usr/bin/env node
/**
 * prTrailers.js — UC の squash commit / PR 本文に付ける trailer を run state から作る
 *
 * Usage:
 *   node prTrailers.js --run .distillery/runs/<slug> [--cwd <repo>] [--strict]        # trailer 行を stdout に出す
 *   node prTrailers.js --run ... --commit-message "feat: 貸出を登録する" --strict     # 件名 + 空行 + trailer を出す
 *   --base <ref>            Basis-* の起点 (既定: origin/HEAD → main → master との merge-base。squash で消える branch 上の commit を指さない)
 *   --co-author "<Name <email>>"  Co-Authored-By trailer (複数可。ハーネスの attribution 行をそのまま渡す)
 *
 * --strict (配送時に使う): UC / Basis-Requirements / Gates (全段 pass) / Assumptions / As-Built が揃わなければ exit 1
 *
 * 入力: use-cases.yaml (docs/requirements)、reports/gates.json、events.jsonl (review_approved / feedback_filed)、
 *       basis.js stamp (requirements / adr / contracts)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
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
    else if (a === '--base') o.base = argv[++i];
    else if (a === '--co-author') (o.coAuthors ||= []).push(argv[++i]);
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

function gitOut(cwd, args) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

/**
 * Basis の起点。squash すると UC branch 上の commit は履歴から消えるので、base branch との merge-base から遡る
 * (0.1.10 実走 ④-6: Basis-Requirements が squash 前の `impl(<slug>): contract` を指した)。
 * base は --base で指定、無ければ origin/HEAD → main → master の順に探す。見つからなければ null (HEAD から遡る)。
 */
function resolveBaseRef(cwd, base) {
  if (base) {
    // 明示した base が解決できなければ黙って HEAD に戻さない (squash で消える commit を Basis-* に記録しうる)
    if (gitOut(cwd, ['rev-parse', '--verify', '-q', `${base}^{commit}`]) == null) throw new Error(`--base ${base} を解決できない (branch / commit が無い)`);
    return gitOut(cwd, ['merge-base', 'HEAD', base]);
  }
  const candidates = [gitOut(cwd, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD']), 'main', 'master'].filter(Boolean);
  for (const c of candidates) {
    if (gitOut(cwd, ['rev-parse', '--verify', '-q', `${c}^{commit}`]) == null) continue;
    const mb = gitOut(cwd, ['merge-base', 'HEAD', c]);
    if (mb) return mb;
  }
  return null;
}

function buildTrailers({ cwd, runDir, docsRoot = 'docs', base = null, coAuthors = [] }) {
  const events = readEvents(runDir);
  const slug = (events[0] && events[0].slug) || path.basename(runDir);
  const uc = findUseCase(cwd, docsRoot, slug);
  const trailers = [];
  if (uc) trailers.push(['UC', [uc.business, uc.buc, uc.uc].filter(Boolean).join('/')]);
  trailers.push(['UC-Slug', slug]);
  const dirs = { requirements: `${docsRoot}/requirements`, adr: `${docsRoot}/adr`, contracts: 'contracts' };
  const baseRef = resolveBaseRef(cwd, base);
  const stamped = basis.stamp(dirs, cwd, baseRef);
  for (const [name, key] of [['requirements', 'Basis-Requirements'], ['adr', 'Basis-Adr'], ['contracts', 'Basis-Contracts']]) if (stamped[name]) trailers.push([key, stamped[name]]);
  // base 以降に UC branch で変えた上流 (この squash commit 自身に差分が入る)。Basis-* は base 側の sha なので、変更の有無をここで示す
  if (baseRef) {
    trailers.push(['Basis-Base', baseRef]);
    // squash 手順は `git reset --soft <base>` の後に trailer を作る (HEAD = base、変更は staged)。index と base の差で見る
    const changed = Object.entries(dirs).filter(([, dir]) => (gitOut(cwd, ['diff', '--name-only', '--cached', baseRef, '--', dir]) || '') !== '').map(([n]) => n);
    if (changed.length) trailers.push(['Basis-Changed', changed.join(' ')]);
  }
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
  // 未起票 (url が null / 空) の還流は trailer に出さない (`Feedback: rule:null` を防ぐ)。
  for (const e of events.filter(e => e.type === 'feedback_filed')) {
    if (e.url == null || String(e.url).trim() === '') continue;
    trailers.push(['Feedback', `${e.kind}:${e.url}`]);
  }
  // 共著 (ハーネスの attribution 行をそのまま渡す。0.1.10 実走 ④-7: オーケストレータが手で足していた)
  for (const c of coAuthors) trailers.push(['Co-Authored-By', c]);
  return trailers;
}

function render(trailers) { return trailers.map(([k, v]) => `${k}: ${v}`).join('\n'); }

/** 配送に必要な trailer が揃っているか。欠落と、Gates に pass 以外の段があるものを返す */
const GATE_NAMES = ['static', 'unit', 'contract', 'uc-bdd', 'acceptance'];

function strictProblems(trailers, cwd = process.cwd()) {
  const map = new Map(trailers);
  const problems = [];
  for (const k of ['UC', 'UC-Slug', 'Basis-Requirements', 'Gates', 'Assumptions', 'As-Built']) if (!map.has(k)) problems.push(`missing ${k}`);
  // 配送では Basis-* が base 側の sha であること (base が解決できたこと) を要求する
  if (!map.has('Basis-Base')) problems.push('missing Basis-Base (base branch を解決できない。--base <ref> を渡す)');
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
  const trailers = buildTrailers({ cwd: o.cwd, runDir, docsRoot: o.docsRoot, base: o.base, coAuthors: o.coAuthors || [] });
  if (o.strict) {
    const problems = strictProblems(trailers, o.cwd);
    if (problems.length) { console.error(`prTrailers --strict: ${problems.join('; ')}`); return 1; }
  }
  console.log(o.message ? `${o.message}\n\n${render(trailers)}` : render(trailers));
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { buildTrailers, render, strictProblems, resolveBaseRef };
