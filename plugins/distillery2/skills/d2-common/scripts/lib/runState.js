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
 *   node runState.js event <runDir> <type> [json | --data-file <jsonファイル>]   (長い JSON はファイルで渡す。0.1.32 O18)
 *   node runState.js done <runDir> <stage> [json | --data-file <jsonファイル>]
 *     type が assumption_resolved なら data は {targets: [{tier, attempt, id}], decision, by}。各 target は attempt-<n>/assumptions.<tier>.yaml にある id に限る (無い組は拒む。0.1.32 J2)
 *   node runState.js status <runDir> [--json]     (unfiled_issues = 課題ファイルにしていない課題、pending_feedback = 0.1.25 までの保留、legacy_order = 0.1.25 までの順の run)
 *   node runState.js scenario-approve <runDir> --feature <feature> [--acceptance-dir <dir>]
 *     scenario の承認を scenario_approved {feature, feature_sha256, acceptance: {<path>: <sha256>}} で記録する。feature_sha256 は feature の bytes の sha256。
 *     acceptance は <dir> の *.feature のうち Feature か Scenario に @uc:<slug> を持つシナリオがあるファイル (人が承認した対象。checkScenario.js の collectTags と同じ範囲。0.1.33 P16)
 *   node runState.js mark-legacy-delivered <runDir>   (0.1.25 までに PR で配送済みの run に deliver の done を作る。人が確認ページで配送済みと答えたときだけ)
 *   node runState.js invalidate <runDir> <stage> <reason>
 *   node runState.js invalidate <runDir> <stage> <reason> --from   (その段階と後ろの段階をまとめて退避)
 *   node runState.js return-to-integrate <runDir> '{"instrumentation_gaps":[...],"instrumentation_happy_gaps":[...]}'   (as-built から integrate へ戻す)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseYaml, stringifyYaml } = require('./yaml');
const { parseFeature } = require('./gherkin');

// 0.1.27: UC は配送で終わる。還流は UC の外の独立した段階 (scripts/feedbackBatch.js) で、溜まった課題ファイルをまとめて直す。
// 0.1.25 までの run (還流 → 配送の順) と 0.1.26 の run が持つ feedback の done は、旧形式の判定 (isLegacyOrder) でだけ読む
const STAGES = ['scenario', 'contract', 'scaffold', 'tier', 'contract-gate', 'integrate', 'verify', 'review', 'asbuilt', 'deliver'];

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

/**
 * 前提の記録を閉じるイベント (要求の差分で進行役が閉じる。0.1.32 J2) の data を検査する。
 * targets の各 {tier, attempt, id} が <run>/attempt-<attempt>/assumptions.<tier>.yaml の assumptions[].id にあること (最新でない attempt も可)。
 * AssumptionRecord の yaml は書き換えない (review の hash と Verifier の照合の対象)。閉じた印はイベントだけが持つ
 */
function validateAssumptionResolved(runDir, data) {
  const targets = Array.isArray(data.targets) ? data.targets : null;
  if (!targets || !targets.length) throw new Error('assumption_resolved には targets ([{tier, attempt, id}]) が 1 件以上要る');
  if (typeof data.decision !== 'string' || !data.decision.trim()) throw new Error('assumption_resolved には decision (要求の差分の決定の要点) が要る');
  const missing = [];
  for (const t of targets) {
    const n = Number(t && t.attempt);
    if (!t || typeof t.tier !== 'string' || !t.tier || typeof t.id !== 'string' || !t.id || !Number.isInteger(n) || n < 1) throw new Error(`assumption_resolved の target は {tier, attempt, id} (attempt は 1 以上の整数): ${JSON.stringify(t)}`);
    const file = path.join(runDir, `attempt-${n}`, `assumptions.${t.tier}.yaml`);
    const doc = fs.existsSync(file) ? parseYaml(fs.readFileSync(file, 'utf8')) : null;
    const ids = new Set(((doc && doc.assumptions) || []).map(a => a && a.id).filter(Boolean));
    if (!ids.has(t.id)) missing.push(`${t.tier}/attempt-${n}/${t.id}`);
  }
  if (missing.length) throw new Error(`assumption_resolved の target が記録に無い: ${missing.join(', ')}`);
}

function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

/**
 * scenario の承認を記録する (0.1.33 P16)。計算と範囲をコードで固定し、進行役に計算させない。
 * - feature_sha256: feature ファイルの bytes の sha256 (改行の正規化はしない。git の内容と 1 対 1)
 * - acceptance: acceptanceDir の *.feature のうち、Feature か Scenario に @uc:<slug> を持つシナリオが 1 つ以上あるファイル (slug は feature の @uc: タグ)。
 *   checkScenario.js の collectTags と同じ範囲 = 人が承認した対象。他 UC だけのファイルは入れない。path 昇順。dir が無ければ {}
 * パスは渡された形 (リポ相対) のまま記録する
 */
function scenarioApprove(runDir, featurePath, acceptanceDir) {
  if (!featurePath) throw new Error('scenario-approve には --feature <feature のパス> が要る');
  if (!fs.existsSync(featurePath)) throw new Error(`feature が無い: ${featurePath}`);
  const main = parseFeature(fs.readFileSync(featurePath, 'utf8'));
  const ucTag = main.tags.find(t => t.startsWith('@uc:'));
  if (!ucTag) throw new Error(`feature に @uc:<slug> タグが無い: ${featurePath}`);
  const acceptance = {};
  if (acceptanceDir && fs.existsSync(acceptanceDir)) {
    for (const name of fs.readdirSync(acceptanceDir).filter(n => n.endsWith('.feature')).sort()) {
      const p = path.join(acceptanceDir, name);
      const f = parseFeature(fs.readFileSync(p, 'utf8'));
      const hit = f.scenarios.some(s => [...f.tags, ...s.tags].includes(ucTag));
      if (hit) acceptance[p] = sha256File(p);
    }
  }
  return appendEvent(runDir, 'scenario_approved', { feature: featurePath, feature_sha256: sha256File(featurePath), acceptance });
}

function appendEvent(runDir, type, data = {}) {
  if (type === 'assumption_resolved') validateAssumptionResolved(runDir, data);
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
function isLegacyOrder(runDir) {
  if (!isDone(runDir, 'feedback')) return false;
  if (!isDone(runDir, 'deliver')) return true;
  // mark-legacy-delivered が配送の done を作った後、還流の done の退避の前に止まった中間状態も旧形式として扱う (もう一度 mark すれば完了する)
  const d = readDone(runDir, 'deliver');
  return Boolean(d && d.legacy) && unfiledIssues(runDir).length > 0;
}

/** issues/*.md のうち起票済み (filedIssues) でないもの。run ディレクトリ相対 (`issues/<file>.md`) */
function unfiledIssues(runDir) {
  const dir = path.join(runDir, 'issues');
  if (!fs.existsSync(dir)) return [];
  const filed = new Set(filedIssues(runDir));
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => `issues/${f}`).filter(k => !filed.has(k)).sort();
}

/**
 * 人が確認ページで「配送済み」と答えた旧形式の run に、deliver の done (legacy: true) を作る。
 * 起票済みでない課題が残っていれば (0.1.25 までの headless 実行は還流を保留にしていた)、旧形式の feedback の done を退避して、
 * 新しい還流段階で処理し直せるようにする (起票済みの旧記録 url はそのまま数える)
 */
function markLegacyDelivered(runDir) {
  if (!isLegacyOrder(runDir)) throw new Error('旧形式の順の run ではない (feedback の done があり deliver の done が無い run と、その印付けの途中で止まった run だけ)');
  const deliver = isDone(runDir, 'deliver') ? readDone(runDir, 'deliver') : markDone(runDir, 'deliver', { legacy: true });
  const unfiled = unfiledIssues(runDir);
  const reopened = unfiled.length ? invalidate(runDir, 'feedback', `旧形式の run で起票されていない課題が ${unfiled.length} 件ある: ${unfiled.join(', ')}`) : null;
  return { ...deliver, feedback_reopened: Boolean(reopened), unfiled_issues: unfiled };
}

function status(runDir) {
  const events = readEvents(runDir);
  const stages = {};
  for (const s of STAGES) stages[s] = isDone(runDir, s) ? 'done' : 'pending';
  const legacy = isLegacyOrder(runDir);
  const next = legacy ? null : (STAGES.find(s => stages[s] === 'pending') || null);
  const last = events[events.length - 1] || null;
  return { run_dir: runDir, slug: (events[0] && events[0].slug) || path.basename(runDir), attempt: currentAttempt(runDir), stages, next_stage: next, legacy_order: legacy, events: events.length, last_event: last, pending_feedback: pendingFeedback(runDir), filed_issues: filedIssues(runDir), unfiled_issues: unfiledIssues(runDir) };
}

/** event / done の data。argv の JSON か `--data-file <f>` (排他。長い日本語の JSON を argv で渡すとハーネスの検査で止まる。0.1.32 O18) */
function dataArg(args, dataFile) {
  if (dataFile != null && args[2] != null) throw new Error('data は argv の JSON か --data-file のどちらか一方');
  if (dataFile != null) return JSON.parse(fs.readFileSync(path.resolve(dataFile), 'utf8'));
  return args[2] ? JSON.parse(args[2]) : {};
}

function main(argv) {
  const [cmd, ...a0] = argv;
  const json = a0.includes('--json');
  let dataFile = null;
  let feature = null;
  let acceptanceDir = null;
  const a = [];
  for (let i = 0; i < a0.length; i++) {
    if (a0[i] === '--json') continue;
    if (a0[i] === '--data-file') { dataFile = a0[++i]; if (dataFile == null) throw new Error('--data-file <jsonファイル>'); continue; }
    if (a0[i] === '--feature') { feature = a0[++i]; if (feature == null) throw new Error('--feature <feature のパス>'); continue; }
    if (a0[i] === '--acceptance-dir') { acceptanceDir = a0[++i]; if (acceptanceDir == null) throw new Error('--acceptance-dir <dir>'); continue; }
    a.push(a0[i]);
  }
  const args = a;
  switch (cmd) {
    case 'scenario-approve': console.log(JSON.stringify(scenarioApprove(path.resolve(args[0]), feature, acceptanceDir))); return 0;
    case 'open': console.log(openRun(path.resolve(args[0]), args[1])); return 0;
    case 'event': console.log(JSON.stringify(appendEvent(path.resolve(args[0]), args[1], dataArg(args, dataFile)))); return 0;
    case 'done': console.log(JSON.stringify(markDone(path.resolve(args[0]), args[1], dataArg(args, dataFile)))); return 0;
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
        if (s.unfiled_issues.length) {
          console.log(`unfiled issues (課題ファイルにしていない課題): ${s.unfiled_issues.length}`);
          for (const k of s.unfiled_issues) console.log(`  - ${k}`);
        }
        if (s.pending_feedback.length) {
          console.log(`pending feedback (起票されていない還流): ${s.pending_feedback.length}`);
          for (const p of s.pending_feedback) console.log(`  - ${p.kind || '?'} ${p.issue_path || '(issue パスなし)'}${p.reason ? ` — ${p.reason}` : ''}`);
        }
      }
      return 0;
    }
    default: console.error('Usage: runState.js open|event|done|invalidate|return-to-integrate|mark-legacy-delivered|scenario-approve|status ...'); return 2;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { STAGES, runDirOf, openRun, readEvents, appendEvent, isDone, readDone, markDone, invalidate, invalidateFrom, returnToIntegrate, attemptDir, currentAttempt, pendingFeedback, filedIssues, unfiledIssues, isLegacyOrder, markLegacyDelivered, status, validateAssumptionResolved, scenarioApprove };
