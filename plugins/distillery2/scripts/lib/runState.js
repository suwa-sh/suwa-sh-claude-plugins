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
 *   node runState.js status <runDir> [--json]
 *   node runState.js invalidate <runDir> <stage> <reason>
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml, stringifyYaml } = require('./yaml');

const STAGES = ['scenario', 'contract', 'scaffold', 'tier', 'contract-gate', 'integrate', 'verify', 'review', 'asbuilt', 'feedback', 'deliver'];

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

function status(runDir) {
  const events = readEvents(runDir);
  const stages = {};
  for (const s of STAGES) stages[s] = isDone(runDir, s) ? 'done' : 'pending';
  const next = STAGES.find(s => stages[s] === 'pending') || null;
  const last = events[events.length - 1] || null;
  return { run_dir: runDir, slug: (events[0] && events[0].slug) || path.basename(runDir), attempt: currentAttempt(runDir), stages, next_stage: next, events: events.length, last_event: last };
}

function main(argv) {
  const [cmd, ...a] = argv;
  const json = a.includes('--json');
  const args = a.filter(x => x !== '--json');
  switch (cmd) {
    case 'open': console.log(openRun(path.resolve(args[0]), args[1])); return 0;
    case 'event': console.log(JSON.stringify(appendEvent(path.resolve(args[0]), args[1], args[2] ? JSON.parse(args[2]) : {}))); return 0;
    case 'done': console.log(JSON.stringify(markDone(path.resolve(args[0]), args[1], args[2] ? JSON.parse(args[2]) : {}))); return 0;
    case 'invalidate': console.log(invalidate(path.resolve(args[0]), args[1], args.slice(2).join(' ')) || 'not done'); return 0;
    case 'status': {
      const s = status(path.resolve(args[0]));
      if (json) console.log(JSON.stringify(s, null, 2));
      else { console.log(`run: ${s.slug} attempt=${s.attempt} next=${s.next_stage || '(all done)'}`); for (const [k, v] of Object.entries(s.stages)) console.log(`  ${v === 'done' ? '[x]' : '[ ]'} ${k}`); }
      return 0;
    }
    default: console.error('Usage: runState.js open|event|done|invalidate|status ...'); return 2;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { STAGES, runDirOf, openRun, readEvents, appendEvent, isDone, readDone, markDone, invalidate, attemptDir, currentAttempt, status };
