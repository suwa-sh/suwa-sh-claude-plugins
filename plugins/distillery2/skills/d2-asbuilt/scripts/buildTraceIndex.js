#!/usr/bin/env node
/**
 * buildTraceIndex.js — トレースと変更ファイル一覧から、UC の実現要素を導出する純関数群
 *
 * 導出するもの:
 *   - operations : http.in の operationId (重複排除・昇順)
 *   - tables     : db.query の tables を SQL 動詞で read/write 分類 (name 昇順)
 *   - messages   : publish の message (重複排除・昇順)
 *   - files      : 変更ファイルを apps/<tier>/src 単位にティア分類
 *   - perScenario: シナリオごとの読み書き・発行・operation
 *
 * すべて入力が同じなら出力が同じ (ソート済み)。npm 依存なし。
 *
 * CLI:
 *   node buildTraceIndex.js --traces <dir> [--changed <file>] [--json]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseTraceLines, sqlVerb } = require('./renderSequence');

const READ_VERBS = new Set(['SELECT', 'WITH', 'SHOW', 'EXPLAIN']);
const WRITE_VERBS = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'UPSERT', 'REPLACE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE']);

function classifySql(sql) {
  const v = sqlVerb(sql);
  if (READ_VERBS.has(v)) return 'read';
  if (WRITE_VERBS.has(v)) return 'write';
  return 'other';
}

function sortUnique(arr) {
  return [...new Set(arr.filter((x) => x != null && x !== ''))].sort((a, b) => String(a).localeCompare(String(b)));
}

/**
 * @param {Array<{scenario:string, lines:Array<object>}>} scenarios
 * @returns {{operations:string[], tables:Array<{name:string,modes:string[]}>, messages:string[], perScenario:Array<object>}}
 */
function deriveFromTraces(scenarios) {
  const operations = [];
  const messages = [];
  const tableModes = new Map(); // name -> Set(modes)
  const perScenario = [];
  for (const sc of Array.isArray(scenarios) ? scenarios : []) {
    const scOps = [];
    const scMsgs = [];
    const scRead = [];
    const scWrite = [];
    for (const ev of sc.lines || []) {
      const meta = (ev && ev.meta) || {};
      if (ev.kind === 'http.in') {
        if (meta.operationId) { operations.push(meta.operationId); scOps.push(meta.operationId); }
      } else if (ev.kind === 'db.query') {
        const mode = classifySql(meta.sql);
        for (const tbl of Array.isArray(meta.tables) ? meta.tables : []) {
          if (!tableModes.has(tbl)) tableModes.set(tbl, new Set());
          tableModes.get(tbl).add(mode);
          if (mode === 'read') scRead.push(tbl);
          else if (mode === 'write') scWrite.push(tbl);
        }
      } else if (ev.kind === 'publish') {
        if (meta.message) { messages.push(meta.message); scMsgs.push(meta.message); }
      }
    }
    perScenario.push({
      scenario: sc.scenario,
      operations: sortUnique(scOps),
      messages: sortUnique(scMsgs),
      tables_read: sortUnique(scRead),
      tables_written: sortUnique(scWrite),
    });
  }
  const tables = [...tableModes.keys()].sort((a, b) => a.localeCompare(b)).map((name) => ({
    name,
    modes: [...tableModes.get(name)].sort(),
  }));
  perScenario.sort((a, b) => String(a.scenario).localeCompare(String(b.scenario)));
  return { operations: sortUnique(operations), tables, messages: sortUnique(messages), perScenario };
}

/**
 * 変更ファイルを apps/<tier>/src 単位でティア分類する。
 * @param {string[]} files
 * @param {Array<{id:string, dir:string}>} tiers
 */
function groupChangedFiles(files, tiers) {
  const byTier = {};
  const other = [];
  const tierList = (Array.isArray(tiers) ? tiers : []).map((t) => ({ id: t.id, dir: (t.dir || '').replace(/\/+$/, '') }));
  for (const f of Array.isArray(files) ? files : []) {
    const norm = String(f).replace(/^\.\//, '');
    let matched = null;
    for (const t of tierList) {
      if (!t.dir) continue;
      if (norm === t.dir || norm.startsWith(t.dir + '/')) { matched = t.id; break; }
    }
    if (matched) {
      (byTier[matched] = byTier[matched] || []).push(norm);
    } else {
      other.push(norm);
    }
  }
  for (const k of Object.keys(byTier)) byTier[k] = sortUnique(byTier[k]);
  return { byTier, other: sortUnique(other), all: sortUnique(files || []) };
}

/** git diff --name-only <base>..HEAD。base が無ければ null。 */
function changedFilesFromGit(cwd, baseHead) {
  if (!baseHead) return null;
  const { execFileSync } = require('node:child_process');
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${baseHead}..HEAD`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

/** traces ディレクトリを読み、{scenario, lines}[] にする (ファイル名昇順)。 */
function loadTraces(tracesDir) {
  if (!fs.existsSync(tracesDir)) return [];
  const files = fs.readdirSync(tracesDir).filter((f) => f.endsWith('.jsonl')).sort();
  const out = [];
  for (const f of files) {
    const lines = parseTraceLines(fs.readFileSync(path.join(tracesDir, f), 'utf8'));
    const scenario = (lines.find((l) => l && l.scenario) || {}).scenario || f.replace(/\.jsonl$/, '');
    out.push({ file: f, scenario, lines });
  }
  out.sort((a, b) => String(a.scenario).localeCompare(String(b.scenario)));
  return out;
}

function main(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--traces') o.traces = argv[++i];
    else if (argv[i] === '--changed') o.changed = argv[++i];
    else if (argv[i] === '--json') o.json = true;
  }
  if (!o.traces) { console.error('Usage: buildTraceIndex.js --traces <dir> [--changed <file>] [--json]'); return 2; }
  const scenarios = loadTraces(o.traces);
  const derived = deriveFromTraces(scenarios);
  console.log(JSON.stringify(derived, null, 2));
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { classifySql, deriveFromTraces, groupChangedFiles, changedFilesFromGit, loadTraces, sortUnique };
