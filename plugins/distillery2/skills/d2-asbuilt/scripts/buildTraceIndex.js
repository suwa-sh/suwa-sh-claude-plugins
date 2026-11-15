#!/usr/bin/env node
/**
 * buildTraceIndex.js — トレースと変更ファイル一覧から、UC の実現要素を導出する純関数群
 *
 * 導出するもの:
 *   - operations : http.in の operationId (重複排除・昇順)
 *   - tables     : db.query の tables を SQL 動詞で read/write 分類 (name 昇順)。失敗した文 (meta.result が error) は数えない
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
const { parseTraceLines, buildTree, operationScope, sqlVerb, withTableModes, queryFailed, cmpStr } = require('./traceTree');

const READ_VERBS = new Set(['SELECT', 'WITH', 'SHOW', 'EXPLAIN']);
const WRITE_VERBS = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'UPSERT', 'REPLACE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE']);

function classifySql(sql) {
  const v = sqlVerb(sql);
  if (READ_VERBS.has(v)) return 'read';
  if (WRITE_VERBS.has(v)) return 'write';
  return 'other';
}

function sortUnique(arr) {
  return [...new Set(arr.filter((x) => x != null && x !== ''))].sort((a, b) => cmpStr(a, b));
}

/**
 * 操作・読み書き・発行は、UC 自身の操作の中で起きた分 (operations / tables / messages) と、シナリオが前準備で呼んだ他の UC の操作の中で起きた分 (setup) に分ける。
 * 分け方は traceTree.js の operationScope (いちばん外側の http.in の operationId が ownOps にあるか)。
 * ownOps を渡さなければ分けない (すべて UC 自身の分)。
 * @param {Array<{scenario:string, lines:Array<object>}>} scenarios
 * @param {{ownOps?: string[]|null}} [opts]  UC 自身の操作 (contracts/uc-index.yaml のその UC の operations)
 * @returns {{operations:string[], tables:Array<{name:string,modes:string[]}>, messages:string[], perScenario:Array<object>,
 *   setup:{operations:string[], tables:Array<{name:string,modes:string[]}>, messages:string[]}}}
 */
function deriveFromTraces(scenarios, opts = {}) {
  const ownOps = Array.isArray(opts.ownOps) ? new Set(opts.ownOps.map(String)) : null;
  const operations = [];
  const messages = [];
  const setupOperations = [];
  const setupMessages = [];
  const tableModes = new Map(); // name -> Set(modes)
  const setupTableModes = new Map();
  const perScenario = [];
  const addMode = (map, tbl, mode) => { if (!map.has(tbl)) map.set(tbl, new Set()); map.get(tbl).add(mode); };
  for (const sc of Array.isArray(scenarios) ? scenarios : []) {
    const scOps = [];
    const scMsgs = [];
    const scRead = [];
    const scWrite = [];
    for (const node of buildTree(sc.lines || []).nodes) {
      const meta = node.meta || {};
      const own = operationScope(node, ownOps) === 'own';
      if (node.kind === 'http.in') {
        // UC に紐付ける操作は UC 自身の分だけ。前準備で呼んだ他の UC の操作は setup.operations だけに持つ
        if (meta.operationId) { if (own) { operations.push(meta.operationId); scOps.push(meta.operationId); } else setupOperations.push(meta.operationId); }
      } else if (node.kind === 'db.query') {
        if (queryFailed(meta)) continue; // 失敗した文は取り消されている。表の読み書きに数えない
        const stmtMode = classifySql(meta.sql);
        const perTable = withTableModes(meta.sql, meta.tables)
          || (Array.isArray(meta.tables) ? meta.tables : []).map((t) => ({ table: t, mode: stmtMode }));
        for (const { table: tbl, mode } of perTable) {
          if (!own) { addMode(setupTableModes, tbl, mode); continue; } // 前準備の操作の読み書きは、UC の読み書きに数えない
          addMode(tableModes, tbl, mode);
          if (mode === 'read') scRead.push(tbl);
          else if (mode === 'write') scWrite.push(tbl);
        }
      } else if (node.kind === 'publish') {
        if (!meta.message) continue;
        if (!own) { setupMessages.push(meta.message); continue; }
        messages.push(meta.message); scMsgs.push(meta.message);
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
  const toTables = (map) => [...map.keys()].sort(cmpStr).map((name) => ({ name, modes: [...map.get(name)].sort() }));
  perScenario.sort((a, b) => cmpStr(a.scenario, b.scenario));
  return {
    operations: sortUnique(operations), tables: toTables(tableModes), messages: sortUnique(messages), perScenario,
    setup: { operations: sortUnique(setupOperations), tables: toTables(setupTableModes), messages: sortUnique(setupMessages) },
  };
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
    // -z で NUL 区切りにする (既定の core.quotePath だと日本語のパスが引用符と八進数の文字列になり、実在しないパスが載る)
    const out = execFileSync('git', ['diff', '--name-only', '-z', `${baseHead}..HEAD`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\0').filter(Boolean);
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
  out.sort((a, b) => cmpStr(a.scenario, b.scenario));
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
