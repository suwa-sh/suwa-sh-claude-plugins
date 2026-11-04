#!/usr/bin/env node
/**
 * nextAction.js — d2-run の起動時の自動選択 (次に何をするか) を決める (0.3.0)。読むだけで、git も作業ツリーも変えない
 *
 * Usage:
 *   node nextAction.js <root> [--uc <slug>] [--stage requirements|decide|foundation]
 *   出力: JSON 1 行 {action, ...}。進行役は action ごとの手順 (d2-run SKILL.md の「自動選択」の表) を行い、終わったらもう一度呼ぶ
 *
 * 順 (上から最初に当たるもの):
 *   1  最初の段          use-cases.yaml が無ければ requirements、docs/adr/ が無ければ decide、.distillery/config.yaml が無いか main に無ければ foundation (基盤の途中)
 *   2  片付け            main の run に main マージの done がある feature/* (legacy なら退避して -D)、先端が main に入った upstream/*  → cleanup
 *   3  進行中の機能      run の最後の止まりが上流の止め (blocked_on_upstream) でない feature/* (写し直しの記録が残るものは 4)  → continue-feature
 *   4  途中の写し直し・上流の直し   .distillery/logs/resume-<slug>.json → finish-resume / main に入っていない upstream/* → continue-upstream
 *   ここまでは branch と ref だけを読む。5 からは main の作業ツリー (docs/feedback/・runs) を読むので、今の branch が main でなければ switch-main を返す
 *   5  push のやり直し   origin があり origin/main..main が 0 でない  → push
 *   6  写し直し待ち      上流で止めた課題がすべて main から消えた feature/*  → resume (resumeAfterUpstream.js run)
 *   7  旧形式・移行      scan の legacy_runs → legacy、unfiled_runs → migrate、batch.point が none 以外 → batch
 *   8  連鎖の上限超え    scan の limit_reached  → limit-chain (人に返す)
 *   9  上流の課題        要求の課題か既存の持ち越し → requirements-diff、決定 → decide-diff、基盤 → foundation-diff
 *   10 開き直し          scan の reopen_targets の先頭  → reopen
 *   11 次の機能          scan の reopened の先頭、無ければ use-cases.yaml で status が done でなく、上流で止めた feature の無い最初の UC  → uc。無ければ none
 * 名指し (--uc / --stage) は 1・2 の後に、3・4・6 に当たるもの (進行中・途中・写し直し待ち) が名指しと別にあれば refuse を返す
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseYaml } = require('./lib/yaml');
const runState = require('./lib/runState');
const { cmdScan } = require('./feedbackBatch');

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return { ok: r.status === 0, out: String(r.stdout || '').replace(/\n$/, '') };
}
const refs = (root, prefix) => git(root, ['for-each-ref', '--format=%(refname:short)', prefix]).out.split('\n').filter(Boolean).sort();
const existsAt = (root, rev, p) => git(root, ['cat-file', '-e', `${rev}:${p}`]).ok;
const showAt = (root, rev, p) => { const r = git(root, ['show', `${rev}:${p}`]); return r.ok ? r.out : null; };
const isAncestor = (root, a, b) => git(root, ['merge-base', '--is-ancestor', a, b]).ok;

function eventsAt(root, rev, slug) {
  const t = showAt(root, rev, `.distillery/runs/${slug}/events.jsonl`);
  return t ? t.split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

/** feature/* の状態: delivered (main の run に main マージの done) / journal (写し直しの記録あり) / paused (上流で止めた) / active */
function features(root) {
  return refs(root, 'refs/heads/feature/').map((branch) => {
    const slug = branch.replace(/^feature\//, '');
    const deliver = showAt(root, 'main', `.distillery/runs/${slug}/stages/deliver.done.yaml`);
    if (deliver != null) return { slug, branch, state: 'delivered', legacy: /^legacy:\s*true\s*$/m.test(deliver) };
    if (fs.existsSync(path.join(root, '.distillery', 'logs', `resume-${slug}.json`))) return { slug, branch, state: 'journal' };
    const paused = runState.pausedEvent(eventsAt(root, branch, slug));
    if (!paused) return { slug, branch, state: 'active' };
    const issues = runState.blockedIssues(paused);
    const left = issues.filter((i) => existsAt(root, 'main', `docs/feedback/${i.id}.md`)).map((i) => i.id);
    return { slug, branch, state: 'paused', ready: left.length === 0, issues: issues.map((i) => i.id), waiting_on: left };
  });
}

function useCases(root) {
  const f = path.join(root, 'docs', 'requirements', 'use-cases.yaml');
  try { return (parseYaml(fs.readFileSync(f, 'utf8')) || {}).use_cases || []; } catch { return []; }
}

function decide(rootArg, { uc = null, stage = null } = {}) {
  const root = path.resolve(rootArg);
  // 1 最初の段
  if (!fs.existsSync(path.join(root, 'docs', 'requirements', 'use-cases.yaml'))) return { action: 'requirements' };
  if (!fs.existsSync(path.join(root, 'docs', 'adr'))) return { action: 'decide' };
  // 基盤は最後に config を main へ commit する。作業ツリーにあっても main に無ければ基盤の途中で止まっている (0.3.0 の実地確認 3 起動目)
  if (!fs.existsSync(path.join(root, '.distillery', 'config.yaml')) || !existsAt(root, 'main', '.distillery/config.yaml')) return { action: 'foundation' };
  // 2 片付け
  const fs_ = features(root);
  const upstreams = refs(root, 'refs/heads/upstream/');
  const cleanFeatures = fs_.filter((f) => f.state === 'delivered').map((f) => ({ slug: f.slug, legacy: f.legacy }));
  const cleanUpstream = upstreams.filter((b) => isAncestor(root, b, 'main'));
  if (cleanFeatures.length || cleanUpstream.length) return { action: 'cleanup', features: cleanFeatures, upstream: cleanUpstream };
  const active = fs_.filter((f) => f.state === 'active');
  const journals = fs_.filter((f) => f.state === 'journal');
  const ready = fs_.filter((f) => f.state === 'paused' && f.ready);
  const openUpstream = upstreams.filter((b) => !isAncestor(root, b, 'main'));
  // 名指し: 進行中・途中・写し直し待ちが名指しと別にあれば拒む
  if (uc || stage) {
    const pending = [...active.map((f) => `進行中の機能 ${f.slug}`), ...journals.map((f) => `途中の写し直し ${f.slug}`), ...openUpstream.map((b) => `途中の上流の直し ${b}`), ...ready.map((f) => `写し直し待ちの機能 ${f.slug}`)]
      .filter((p) => !(uc && (p.endsWith(` ${uc}`))));
    if (pending.length) return { action: 'refuse', reason: '先に続けるものがある', pending };
    if (uc) {
      const f = fs_.find((x) => x.slug === uc);
      if (f && f.state === 'paused' && !f.ready) return { action: 'refuse', reason: '上流の課題の反映待ち', slug: uc, waiting_on: f.waiting_on };
      if (f && f.state === 'paused') return { action: 'resume', slug: uc };
      if (f && f.state === 'journal') return { action: 'finish-resume', slug: uc };
      const known = useCases(root).find((u) => u && u.slug === uc);
      if (!known) return { action: 'refuse', reason: 'UC 一覧に無い', slug: uc };
      if (String(known.status) === 'done' && !(f && f.state === 'active')) return { action: 'delivered', slug: uc };
      return { action: f ? 'continue-feature' : 'uc', slug: uc };
    }
  }
  // 3 進行中の機能
  if (active.length) return { action: 'continue-feature', slug: active[0].slug, ...(active.length > 1 ? { others: active.slice(1).map((f) => f.slug) } : {}) };
  // 4 途中の写し直し・上流の直し
  if (journals.length) return { action: 'finish-resume', slug: journals[0].slug };
  if (openUpstream.length) return { action: 'continue-upstream', branch: openUpstream[0], issue: openUpstream[0].replace(/^upstream\//, '') };
  // ここから main の作業ツリーを読む
  const head = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).out;
  if (head !== 'main') return { action: 'switch-main', from: head };
  // 5 push のやり直し
  if (git(root, ['remote', 'get-url', 'origin']).ok) {
    const n = git(root, ['rev-list', '--count', 'origin/main..main']);
    if (n.ok && Number(n.out) > 0) return { action: 'push', ahead: Number(n.out) };
  }
  // 6 写し直し待ち
  if (ready.length) return { action: 'resume', slug: ready[0].slug };
  const scan = cmdScan(root);
  const notes = { uncovered_done: scan.uncovered_done, plugin: scan.plugin, paused: fs_.filter((f) => f.state === 'paused').map((f) => ({ slug: f.slug, waiting_on: f.waiting_on })) };
  // 7 旧形式・移行
  if (scan.legacy_runs.length) return { action: 'legacy', runs: scan.legacy_runs, notes };
  if (scan.unfiled_runs.length) return { action: 'migrate', runs: scan.unfiled_runs, notes };
  if (scan.batch && scan.batch.point !== 'none') return { action: 'batch', point: scan.batch.point, notes };
  // 8 連鎖の上限超え
  if (scan.limit_reached.length) return { action: 'limit-chain', chains: scan.limit_reached, limit: scan.chain_limit, notes };
  // 9 上流の課題 (stage= の直接指定は、その段の課題が無くても入る: 要求の差分は持ち越しの片付けを含む)
  const carry = scan.carry_over_rows.length || scan.carry_over_pending.length;
  if (stage === 'requirements' || scan.upstream.requirements.length || carry) return { action: 'requirements-diff', issues: scan.upstream.requirements, carry_over: Boolean(carry), notes };
  if (scan.upstream.decide.length) return { action: 'decide-diff', issues: scan.upstream.decide, notes };
  if (scan.upstream.foundation.length) return { action: 'foundation-diff', issues: scan.upstream.foundation, notes };
  // stage=decide / foundation の直接指定で課題が無ければ、その段をやり直す (② / ③)
  if (stage === 'decide' || stage === 'foundation') return { action: stage, notes };
  // 10 開き直し
  if (scan.reopen_targets.length) return { action: 'reopen', target: scan.reopen_targets[0], notes };
  // 11 次の機能
  if (scan.reopened.length) return { action: 'uc', slug: scan.reopened[0], reopened: true, notes };
  const paused = new Set(fs_.filter((f) => f.state === 'paused').map((f) => f.slug));
  const next = useCases(root).find((u) => u && u.slug && String(u.status) !== 'done' && !paused.has(u.slug));
  if (next) return { action: 'uc', slug: next.slug, notes };
  return { action: 'none', notes };
}

function main(argv) {
  const pos = [];
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--uc') o.uc = argv[++i];
    else if (argv[i] === '--stage') o.stage = argv[++i];
    else if (argv[i].startsWith('--')) throw new Error(`不明な引数: ${argv[i]}`);
    else pos.push(argv[i]);
  }
  if (pos.length !== 1) throw new Error('nextAction.js <root> [--uc <slug>] [--stage requirements|decide|foundation]');
  if (o.stage && !['requirements', 'decide', 'foundation'].includes(o.stage)) throw new Error(`--stage は requirements|decide|foundation: ${o.stage}`);
  return decide(pos[0], o);
}

if (require.main === module) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)))); }
  catch (e) { console.log(JSON.stringify({ action: 'error', error: e.message })); process.exit(2); }
}

module.exports = { decide, features };
