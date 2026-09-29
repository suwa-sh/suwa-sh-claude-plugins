#!/usr/bin/env node
/**
 * runState.js — UC 縦切りの実行状態 (.distillery/runs/<uc_slug>/)
 *
 * v1 の state-schema (events/ ディレクトリ + latest + status + lease) を次に簡素化する:
 *   events.jsonl               追記のみ。1 行 1 イベント {seq, ts, type, ...}
 *   stages/<stage>.done.yaml   完了判定の正。存在 = 完了
 *   attempt-<n>/               ティア実装と検証の試行ごとの成果 (assumptions / findings)
 *   invalidated/<ts>_<stage>.done.yaml   無効化した done の退避
 *   reports/ traces/ issues/ learnings/  各スクリプトの出力先
 *
 * 再開は「done が無い stage から」。status は events と done から都度計算し、ファイルに持たない。
 *
 * CLI:
 *   node runState.js open <root> <slug>
 *   node runState.js event <runDir> <type> [json]
 *   node runState.js done <runDir> <stage> [json]
 *   node runState.js status <runDir> [--json]     (pending_feedback = 起票されていない還流、legacy_order = 0.1.25 までの順の run)
 *   node runState.js mark-legacy-delivered <runDir>   (0.1.25 までに PR で配送済みの run に deliver の done を作る。人が確認ページで配送済みと答えたときだけ)
 *   node runState.js invalidate <runDir> <stage> <reason>
 *   node runState.js invalidate <runDir> <stage> <reason> --from   (その段階と後ろの段階をまとめて退避)
 *   node runState.js return-to-integrate <runDir> '{"instrumentation_gaps":[...],"instrumentation_happy_gaps":[...]}'   (as-built から integrate へ戻す)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml, stringifyYaml } = require('./yaml');

// 0.1.26: 配送 (main への取り込み) を還流の前にした。還流は main から切るので、この UC の契約・課題・run がそろっている
const STAGES = ['scenario', 'contract', 'scaffold', 'tier', 'contract-gate', 'integrate', 'verify', 'review', 'asbuilt', 'deliver', 'feedback'];

function nowIso() { return new Date().toISOString(); }
function ts() { return nowIso().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_'); }

function runDirOf(root, slug) { return path.join(root, '.distillery', 'runs', slug); }

function openRun(root, slug, meta = {}) {
  const dir = runDirOf(root, slug);
  for (const sub of ['stages', 'reports', 'traces', 'issues', 'learnings']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  if (!fs.existsSync(path.join(dir, 'events.jsonl'))) appendEvent(dir, 'run_opened', { slug, ...meta });
  return dir;
}

function readEvents(runDir) {
  const file = path.join(runDir, 'events.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

function appendEvent(runDir, type, data = {}) {
  const events = readEvents(runDir);
  const ev = { seq: events.length + 1, ts: nowIso(), type, ...data };
  fs.mkdirSync(runDir, { recursive: true });
  fs.appendFileSync(path.join(runDir, 'events.jsonl'), JSON.stringify(ev) + '\n');
  return ev;
}

function doneFile(runDir, stage) { return path.join(runDir, 'stages', `${stage}.done.yaml`); }

function isDone(runDir, stage) { return fs.existsSync(doneFile(runDir, stage)); }

function readDone(runDir, stage) {
  return isDone(runDir, stage) ? parseYaml(fs.readFileSync(doneFile(runDir, stage), 'utf8')) : null;
}

function markDone(runDir, stage, data = {}) {
  const record = { stage, completed_at: nowIso(), ...data };
  fs.mkdirSync(path.join(runDir, 'stages'), { recursive: true });
  fs.writeFileSync(doneFile(runDir, stage), stringifyYaml(record) + '\n');
  appendEvent(runDir, 'stage_completed', { stage, ...(data.attempt !== undefined ? { attempt: data.attempt } : {}) });
  return record;
}

function invalidate(runDir, stage, reason) {
  if (!isDone(runDir, stage)) return null;
  const dest = path.join(runDir, 'invalidated', `${ts()}_${stage}.done.yaml`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(doneFile(runDir, stage), dest);
  appendEvent(runDir, 'stage_invalidated', { stage, reason, moved_to: path.relative(runDir, dest) });
  return dest;
}

/** stage とそれより後ろの段階の done をすべて退避する (差し戻しで段階をまとめて戻すとき。1 つずつ呼んで漏らさないため)。退避したパスの配列を返す */
function invalidateFrom(runDir, stage, reason) {
  const i = STAGES.indexOf(stage);
  if (i < 0) throw new Error(`unknown stage: ${stage}`);
  return STAGES.slice(i).map(s => invalidate(runDir, s, reason)).filter(Boolean);
}

/** 退避先が既にあれば `_2`, `_3` … を付ける (同じ秒に 2 回退避しても上書きしない) */
function uniqueDest(dest) {
  if (!fs.existsSync(dest)) return dest;
  const ext = path.extname(dest);
  const base = dest.slice(0, -ext.length);
  for (let i = 2; ; i++) { const d = `${base}_${i}${ext}`; if (!fs.existsSync(d)) return d; }
}

/**
 * as-built の受理で計装が足りないとき、integrate へ戻す (1 操作。途中で止まっても再開できる順に行う)。
 *  1. 今の attempt の Verifier の結果 (findings.<tier>.yaml) を invalidated/<ts>_attempt-<n>_findings.<tier>.yaml へ移す
 *     (先に移すので、どこで止まっても再検証の前の結果が残らない。attempt は上げない)
 *  2. integrate 以降の done をまとめて退避する (invalidateFrom)
 *  3. returned_to_integrate {from, instrumentation_gaps, instrumentation_happy_gaps, moved_findings} を記録する
 */
function returnToIntegrate(runDir, detail = {}) {
  const n = currentAttempt(runDir);
  const dir = path.join(runDir, `attempt-${n}`);
  const moved = [];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter(x => /^findings\..+\.yaml$/.test(x)).sort()) {
      const dest = uniqueDest(path.join(runDir, 'invalidated', `${ts()}_attempt-${n}_${f}`));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(path.join(dir, f), dest);
      moved.push(path.relative(runDir, dest));
    }
  }
  const reason = `as-built に計装の足りないティア: ${[...(detail.instrumentation_gaps || []), ...(detail.instrumentation_happy_gaps || [])].join(', ') || '(なし)'}`;
  const invalidated = invalidateFrom(runDir, 'integrate', reason).map(p => path.relative(runDir, p));
  appendEvent(runDir, 'returned_to_integrate', {
    from: detail.from || 'asbuilt',
    instrumentation_gaps: detail.instrumentation_gaps || [],
    instrumentation_happy_gaps: detail.instrumentation_happy_gaps || [],
    moved_findings: moved,
  });
  return { moved_findings: moved, invalidated };
}

function attemptDir(runDir, n) {
  const dir = path.join(runDir, `attempt-${n}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function currentAttempt(runDir) {
  if (!fs.existsSync(runDir)) return 1;
  const nums = fs.readdirSync(runDir).map(n => n.match(/^attempt-(\d+)$/)).filter(Boolean).map(m => Number(m[1]));
  return nums.length ? Math.max(...nums) : 1;
}

/** issue のパスを run ディレクトリ相対 (`issues/<file>.md`) にそろえる。記録ごとの書き方の差 (絶対パス・.distillery/runs/... 始まり) を吸収する */
function issueKey(p) {
  if (p == null || String(p).trim() === '') return null;
  const s = String(p).trim().replace(/\\/g, '/');
  const i = s.lastIndexOf('issues/');
  return i >= 0 ? s.slice(i) : s;
}

/** feedback_filed の行き先。0.1.26 からは `ref` (main に入った commit の sha か `docs/feedback/<file>.md`)、0.1.25 までは `url` (PR / issue) */
function filedTarget(e) {
  for (const k of ['ref', 'url']) if (e[k] != null && String(e[k]).trim() !== '') return String(e[k]).trim();
  return null;
}

/**
 * 起票されていない還流 (保留) の一覧 (0.1.25 までの記録を読むため。0.1.26 からは保留を新しく書かない)。
 * - 保留: `feedback_deferred {kind, issue_path, reason}`。0.1.18 以前の記録の `feedback_filed` で url が空のもの (`issue` をパスとみなす) も保留として数える
 * - 解消: 同じ issue パスの、行き先 (ref か url) 付き `feedback_filed`
 * issue パスが無い保留は照合できないので、解消されないまま残す (人が見て判断する)。
 */
function pendingFeedback(runDir) {
  const pending = new Map();
  for (const e of readEvents(runDir)) {
    const filed = filedTarget(e) != null;
    const key = issueKey(e.issue_path != null ? e.issue_path : e.issue);
    if (e.type === 'feedback_deferred' || (e.type === 'feedback_filed' && !filed)) {
      pending.set(key || `(no issue path)#${e.seq}`, { seq: e.seq, kind: e.kind || null, issue_path: key, reason: e.reason || null });
    } else if (e.type === 'feedback_filed' && filed && key) {
      pending.delete(key);
    }
  }
  return [...pending.values()];
}

/** 起票済みの issue パス (行き先付きの feedback_filed)。還流の段階で、課題ごとに済みかを見る */
function filedIssues(runDir) {
  const filed = new Set();
  for (const e of readEvents(runDir)) {
    const key = issueKey(e.issue_path != null ? e.issue_path : e.issue);
    if (e.type === 'feedback_filed' && key && filedTarget(e) != null) filed.add(key);
  }
  return [...filed].sort();
}

/**
 * 0.1.25 までの順 (還流 → 配送) の run か。還流の done があり配送の done が無い。
 * PR で配送した UC は git だけでは配送済みか判定できない (GitHub の squash merge は feature の commit を main の祖先にしない) ので、
 * status は次の段階を出さず、d2-run が人に聞く。
 */
function isLegacyOrder(runDir) { return isDone(runDir, 'feedback') && !isDone(runDir, 'deliver'); }

/** 人が確認ページで「配送済み」と答えた旧形式の run に、deliver の done (legacy: true) を作る */
function markLegacyDelivered(runDir) {
  if (!isLegacyOrder(runDir)) throw new Error('旧形式の順の run ではない (feedback の done があり deliver の done が無い run だけ)');
  return markDone(runDir, 'deliver', { legacy: true });
}

function status(runDir) {
  const events = readEvents(runDir);
  const stages = {};
  for (const s of STAGES) stages[s] = isDone(runDir, s) ? 'done' : 'pending';
  const legacy = isLegacyOrder(runDir);
  const next = legacy ? null : (STAGES.find(s => stages[s] === 'pending') || null);
  const last = events[events.length - 1] || null;
  return { run_dir: runDir, slug: (events[0] && events[0].slug) || path.basename(runDir), attempt: currentAttempt(runDir), stages, next_stage: next, legacy_order: legacy, events: events.length, last_event: last, pending_feedback: pendingFeedback(runDir), filed_issues: filedIssues(runDir) };
}

function main(argv) {
  const [cmd, ...a] = argv;
  const json = a.includes('--json');
  const args = a.filter(x => x !== '--json');
  switch (cmd) {
    case 'open': console.log(openRun(path.resolve(args[0]), args[1])); return 0;
    case 'event': console.log(JSON.stringify(appendEvent(path.resolve(args[0]), args[1], args[2] ? JSON.parse(args[2]) : {}))); return 0;
    case 'done': console.log(JSON.stringify(markDone(path.resolve(args[0]), args[1], args[2] ? JSON.parse(args[2]) : {}))); return 0;
    case 'invalidate': {
      // --from: その段階と後ろの段階の done をまとめて退避する
      if (a.includes('--from')) {
        const rest = args.filter(x => x !== '--from');
        const moved = invalidateFrom(path.resolve(rest[0]), rest[1], rest.slice(2).join(' '));
        console.log(moved.length ? moved.join('\n') : 'not done');
        return 0;
      }
      console.log(invalidate(path.resolve(args[0]), args[1], args.slice(2).join(' ')) || 'not done'); return 0;
    }
    case 'mark-legacy-delivered': console.log(JSON.stringify(markLegacyDelivered(path.resolve(args[0])))); return 0;
    case 'return-to-integrate': console.log(JSON.stringify(returnToIntegrate(path.resolve(args[0]), args[1] ? JSON.parse(args[1]) : {}))); return 0;
    case 'status': {
      const s = status(path.resolve(args[0]));
      if (json) console.log(JSON.stringify(s, null, 2));
      else {
        console.log(`run: ${s.slug} attempt=${s.attempt} next=${s.legacy_order ? '(旧形式の順: 配送済みか人に確かめる)' : (s.next_stage || '(all done)')}`);
        for (const [k, v] of Object.entries(s.stages)) console.log(`  ${v === 'done' ? '[x]' : '[ ]'} ${k}`);
        if (s.pending_feedback.length) {
          console.log(`pending feedback (起票されていない還流): ${s.pending_feedback.length}`);
          for (const p of s.pending_feedback) console.log(`  - ${p.kind || '?'} ${p.issue_path || '(issue パスなし)'}${p.reason ? ` — ${p.reason}` : ''}`);
        }
      }
      return 0;
    }
    default: console.error('Usage: runState.js open|event|done|invalidate|return-to-integrate|mark-legacy-delivered|status ...'); return 2;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { STAGES, runDirOf, openRun, readEvents, appendEvent, isDone, readDone, markDone, invalidate, invalidateFrom, returnToIntegrate, attemptDir, currentAttempt, pendingFeedback, filedIssues, isLegacyOrder, markLegacyDelivered, status };
