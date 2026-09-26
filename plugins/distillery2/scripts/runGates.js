#!/usr/bin/env node
/**
 * runGates.js — ゲートを安い順に実行し、落ちたら止める
 *
 *   static → unit → contract → uc-bdd → acceptance
 *
 * Usage:
 *   node runGates.js --uc <slug> [--upto <gate>] [--from <gate>] [--only <gate>] [--expect-red <gate>] [--tiers a,b]
 *                    [--config .distillery/config.yaml] [--cwd <repo>] [--json]
 *
 * - --tiers: ティア単位のジョブ (static / unit / contract) を UC に関与するティアだけに絞る
 * - --expect-red は、実行した全ティアが「テストの assertion で落ちた」ときだけ成功 (通ったティアがあれば失敗)
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
    else if (a === '--tiers') o.tiers = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--config') o.config = next();
    else if (a === '--cwd') o.cwd = path.resolve(next());
    else if (a === '--json') o.json = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  for (const k of ['upto', 'from', 'only', 'expectRed']) if (o[k] && !GATES.includes(o[k])) throw new Error(`Unknown gate: ${o[k]}`);
  const selected = selectGates(o);
  if (!selected.length) throw new Error(`empty gate range: --from ${o.from} --upto ${o.upto}`);
  if (o.expectRed && !selected.includes(o.expectRed)) throw new Error(`--expect-red ${o.expectRed} is outside the selected gates (${selected.join(', ')})`);
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
  // --tiers で UC に関与するティアだけに絞る (指定が無ければ全ティア)
  const tiers = (config.tiers || []).filter(t => !ctx.tiers || ctx.tiers.includes(t.id));
  const cmds = config.commands || {};
  const rep = (name, tier) => path.join(ctx.reportsDir, tier ? `${name}.${tier}.json` : `${name}.json`);
  const sub = (cmd, tier, name) => cmd.replace(/\{slug\}/g, ctx.slug).replace(/\{report\}/g, rep(name, tier));
  // required: そのティアで必ず実行されるべきジョブ。コマンド未定義で skipped になったらゲートは fail (黙って通さない)
  const providers = new Set((config.contracts || []).map(c => c.provider).filter(Boolean));
  const tierJob = (tier, key, name, required = false) => {
    const c = tier.commands && tier.commands[key];
    return c ? { name: name || key, tier: tier.id, required, cmd: sub(c, tier.id, name || key), report: c.includes('{report}') ? rep(name || key, tier.id) : null } : { name: name || key, tier: tier.id, required, skipped: true };
  };
  switch (gate) {
    case 'static':
      for (const t of tiers) for (const k of ['format_check', 'lint', 'typecheck']) jobs.push(tierJob(t, k));
      jobs.push(cmds.arch_test ? { name: 'arch_test', cmd: sub(cmds.arch_test, null, 'arch_test') } : { name: 'arch_test', skipped: true });
      // quality (qlty: lint + SAST) はリポ全体で 1 回。config に無ければ skipped
      jobs.push(cmds.quality ? { name: 'quality', cmd: sub(cmds.quality, null, 'quality') } : { name: 'quality', skipped: true });
      return { parallel: true, jobs };
    case 'unit': for (const t of tiers) jobs.push(tierJob(t, 'unit', null, true)); return { parallel: true, jobs };
    case 'contract':
      // 契約テストは提供側にしか生成されない。消費側で回すとテスト 0 件で vitest が exit 1 になる (0.1.10 実走 ④-1) ので提供側だけ
      for (const t of tiers) {
        const provider = providers.has(t.id) || (t.provides || []).length > 0;
        jobs.push(provider ? tierJob(t, 'contract', null, true) : { name: 'contract', tier: t.id, required: false, skipped: true, reason: 'not a provider' });
      }
      // 提供側が 1 つも無い (契約を持たない構成) なら検査対象が無いので pass (skipped だと配送の --strict が止まる)
      return { parallel: true, jobs, passIfNothingRan: jobs.every(j => j.skipped), note: jobs.every(j => j.skipped) ? 'no provider tiers (nothing to check)' : undefined };
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
    // 前回のレポートが残っていると、今回書かれなかったときに古い結果を読んでしまう。実行前に消す
    if (job.report && fs.existsSync(job.report)) fs.unlinkSync(job.report);
    const r = await runCommand(job.cmd, ctx.cwd);
    return { ...job, ...r, status: r.exit === 0 ? 'pass' : 'fail' };
  };
  if (plan.parallel) results.push(...await Promise.all(plan.jobs.map(exec)));
  else for (const job of plan.jobs) { const r = await exec(job); results.push(r); if (r.status === 'fail') break; }
  const failed = results.some(r => r.status === 'fail');
  const ran = results.some(r => r.status !== 'skipped');
  const requiredSkipped = results.filter(r => r.required && r.status === 'skipped');
  const out = { name: gate, status: failed ? 'fail' : ran ? 'pass' : plan.passIfNothingRan ? 'pass' : 'skipped', duration_ms: Date.now() - started, jobs: results };
  if (!ran && plan.passIfNothingRan && plan.note) out.note = plan.note;
  if (!failed && requiredSkipped.length) { out.status = 'fail'; out.note = `required job(s) skipped (no command in config): ${requiredSkipped.map(j => `${j.tier}:${j.name}`).join(', ')}`; }
  return out;
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
  if (o.tiers) {
    const known = new Set((config.tiers || []).map(t => t.id));
    const unknown = o.tiers.filter(t => !known.has(t));
    if (unknown.length) { console.error(`unknown tier(s) in --tiers: ${unknown.join(', ')}`); return 2; }
  }
  // 契約の provider が tiers に無い (改名・設定ミス) と contract ゲートが「提供側なし」で緑になる。設定エラーとして止める
  const tierIds = new Set((config.tiers || []).map(t => t.id));
  const orphan = (config.contracts || []).filter(c => c.provider && !tierIds.has(c.provider));
  if (orphan.length) { console.error(`contract provider not in tiers: ${orphan.map(c => `${c.id}→${c.provider}`).join(', ')} (config.yaml の contracts[].provider / tiers[].id を確認)`); return 2; }
  const ctx = { cwd: o.cwd, slug: o.uc, reportsDir, tiers: o.tiers || null };
  const selected = selectGates(o);
  // 部分実行 (--from / --upto / --only) では既存の gates.json を読み、今回実行した段だけ置き換える (他段の証跡を消さない)
  const gatesFile = path.join(reportsDir, 'gates.json');
  const previous = fs.existsSync(gatesFile) ? safeJson(fs.readFileSync(gatesFile, 'utf8')) : null;
  const kept = previous && Array.isArray(previous.gates) ? previous.gates.filter(g => !selected.includes(g.name)) : [];
  const summary = { uc: o.uc, started_at: new Date().toISOString(), expect_red: o.expectRed, run_gates: selected, gates: [] };
  let ok = true;
  for (const gate of selected) {
    const r = await runGate(gate, config, ctx);
    r.run_at = new Date().toISOString();
    if (o.expectRed === gate) applyExpectRed(r);
    summary.gates.push(r);
    if (!o.json) console.log(`${r.status === 'pass' ? 'PASS' : r.status === 'skipped' ? 'SKIP' : 'FAIL'} ${gate} (${r.duration_ms} ms)${r.note ? ' — ' + r.note : ''}`);
    if (r.status === 'fail') {
      ok = false;
      if (!o.json) for (const j of r.jobs.filter(j => j.status === 'fail')) console.log(`  - ${j.tier ? j.tier + ':' : ''}${j.name} exit=${j.exit}\n${indent(j.output_tail)}`);
      break;
    }
  }
  summary.finished_at = new Date().toISOString();
  summary.result = ok ? 'pass' : 'fail';
  // 全段の一覧 (今回分 + 以前分) を GATES の順に並べる。未実行の段は missing として残す
  const byName = new Map([...kept, ...summary.gates].map(g => [g.name, g]));
  summary.gates = GATES.map(name => byName.get(name) || { name, status: 'missing' });
  summary.all_recorded = summary.gates.every(g => g.status !== 'missing');
  fs.writeFileSync(gatesFile, JSON.stringify(summary, null, 2) + '\n');
  if (o.json) console.log(JSON.stringify(summary, null, 2));
  return ok ? 0 : 1;
}

function safeJson(text) { try { return JSON.parse(text); } catch { return null; } }

/**
 * --expect-red: 「テストが実行され、assertion で落ちた」ときだけ red と認める。
 * skipped、レポート無し (設定ミス・起動失敗の可能性)、レポートに失敗テスト 0 は red と認めない。
 */
function applyExpectRed(r) {
  r.expected = 'red';
  if (r.status === 'skipped') { r.status = 'fail'; r.note = 'red baseline needs the gate to run, but every job was skipped (no command)'; return; }
  const requiredSkipped = r.jobs.filter(j => j.required && j.status === 'skipped');
  if (requiredSkipped.length) { r.status = 'fail'; r.note = `red baseline needs every tier to run: skipped ${requiredSkipped.map(j => j.tier).join(', ')}`; return; }
  // 実行した全ジョブ (対象ティアすべて) が red でなければならない。通ったティアがあれば、そのティアに red テストが無い
  const ran = r.jobs.filter(j => j.status !== 'skipped');
  const green = ran.filter(j => j.status === 'pass');
  if (green.length) { r.status = 'fail'; r.note = `red baseline needs every tier to fail, but passed: ${green.map(j => j.tier || j.name).join(', ')} (use --tiers to limit to the UC's tiers)`; return; }
  const failedJobs = ran.filter(j => j.status === 'fail');
  if (!failedJobs.length) { r.status = 'fail'; r.note = 'expected the gate to fail (red baseline) but it passed'; return; }
  const verdicts = failedJobs.map(j => redVerdict(j));
  const bad = verdicts.find(v => !v.ok);
  if (bad) { r.status = 'fail'; r.note = bad.reason; return; }
  r.status = 'pass';
  r.note = `red baseline confirmed (${verdicts.map(v => v.detail).join('; ')})`;
}

function redVerdict(job) {
  if (!job.report) return { ok: false, reason: `${job.tier ? job.tier + ':' : ''}${job.name}: command has no {report}; cannot tell test failures from setup errors` };
  if (!fs.existsSync(job.report)) return { ok: false, reason: `${job.tier ? job.tier + ':' : ''}${job.name}: no report written (exit=${job.exit}); treat as setup/parse error, not red` };
  const rep = safeJson(fs.readFileSync(job.report, 'utf8'));
  if (!rep) return { ok: false, reason: `${job.name}: report is not JSON` };
  const failed = countFailures(rep);
  if (failed === null) return { ok: false, reason: `${job.name}: report has no recognizable failure counts` };
  if (failed === 0) return { ok: false, reason: `${job.name}: report shows 0 failed tests although exit=${job.exit}` };
  return { ok: true, detail: `${job.tier || job.name}: ${failed} failing test(s)` };
}

/** vitest JSON (numFailedTests) と cucumber JSON (steps[].result.status=failed) の両方を数える */
function countFailures(rep) {
  if (rep && typeof rep.numFailedTests === 'number') return rep.numFailedTests;
  if (Array.isArray(rep)) {
    let n = 0;
    for (const f of rep) for (const el of f.elements || []) if ((el.steps || []).some(s => s.result && s.result.status === 'failed')) n++;
    return n;
  }
  return null;
}

function indent(s) { return String(s || '').split('\n').slice(-30).map(l => '      ' + l).join('\n'); }

if (require.main === module) main(process.argv.slice(2)).then(code => process.exit(code));

module.exports = { GATES, parseArgs, selectGates, planGate, runGate, applyExpectRed, countFailures, main };
