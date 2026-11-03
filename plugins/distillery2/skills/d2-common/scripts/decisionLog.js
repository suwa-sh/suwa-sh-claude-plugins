#!/usr/bin/env node
/**
 * decisionLog.js — 決めたことの記録。推奨で決めた答えも人が答えたものも、問いと選択肢ごと残す
 *
 * 書き先: 機能の中は <run>/decisions.jsonl (feature 上で追跡し、squash で機能の 1 commit に入る)、
 *         上流の段 (要求・決定・基盤・要求の差分ほか) は .distillery/decisions.jsonl (その段の commit に入れる)
 *
 * Usage:
 *   node decisionLog.js add (--run <runDir> | --root <repo>) --handoff <file> --ask <id> --answer <label> --by recommended|human|rule [--provisional]
 *   node decisionLog.js add (--run <runDir> | --root <repo>) --page <page:step:question> --question <text> --answer <label> --by recommended|human|rule [--recommended <label>] [--provisional]
 *   node decisionLog.js list --root <repo> [--since <ISO 時刻>] [--format json|md]
 *
 * 確認ページの問いの ID は page:<step>:<question> (例 page:requirements:approve、page:review:assumption:<tier>:<A-id>)。
 * 終了コード: 0 = 成功 / 2 = 引数・読み込みの失敗
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('./lib/yaml');

const BY = new Set(['recommended', 'human', 'rule']);

class Fail extends Error { constructor(msg, code = 2) { super(msg); this.code = code; } }

function logPath({ run, root }) {
  if (run) return path.join(path.resolve(run), 'decisions.jsonl');
  if (root) return path.join(path.resolve(root), '.distillery', 'decisions.jsonl');
  throw new Fail('--run か --root が要る');
}

function parseArgs(argv) {
  const o = {};
  const names = { '--run': 'run', '--root': 'root', '--handoff': 'handoff', '--ask': 'ask', '--answer': 'answer', '--by': 'by', '--page': 'page', '--question': 'question', '--recommended': 'recommended', '--since': 'since', '--format': 'format' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--provisional') o.provisional = true;
    else if (names[a]) o[names[a]] = argv[++i];
    else throw new Fail(`不明な引数: ${a}`);
  }
  return o;
}

/** 1 件を作る。引き継ぎファイルの問いなら、問い・選択肢・推奨をそこから写す (記録だけで後から読めるように) */
function entryOf(o) {
  if (!o.answer) throw new Fail('--answer が要る');
  if (!BY.has(o.by)) throw new Fail(`--by は recommended|human|rule: ${o.by}`);
  const at = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  if (o.handoff) {
    if (!o.ask) throw new Fail('--handoff には --ask が要る');
    const data = parseYaml(fs.readFileSync(o.handoff, 'utf8')) || {};
    const ask = (data.asks || []).find((a) => a && a.id === o.ask);
    if (!ask) throw new Fail(`引き継ぎファイルに問いが無い: ${o.ask}`);
    const labels = (ask.options || []).map((x) => x.label);
    if (!labels.includes(o.answer)) throw new Fail(`答えが選択肢に無い: ${o.answer}`);
    if (o.by === 'recommended' && ask.recommended !== o.answer) throw new Fail(`推奨で決めたと書くが推奨と違う: 推奨 ${ask.recommended}`);
    return {
      at, id: `handoff:${data.step || '?'}:${ask.id}`, source: o.handoff, step: data.step || null, kind: ask.kind, question: ask.question,
      options: labels, recommended: ask.recommended, answer: o.answer, by: o.by,
      provisional: Boolean(o.provisional || (o.by === 'recommended' && ask.kind === 'unknown_fact')),
    };
  }
  if (!o.page || !/^page:[a-z0-9-]+:.+$/.test(o.page)) throw new Fail('--page は page:<step>:<question> の形');
  if (!o.question) throw new Fail('--page には --question が要る');
  if (o.by === 'recommended' && o.recommended && o.recommended !== o.answer) throw new Fail(`推奨で決めたと書くが推奨と違う: 推奨 ${o.recommended}`);
  return {
    at, id: o.page, source: 'page', step: o.page.split(':')[1], kind: 'page', question: o.question,
    options: null, recommended: o.recommended || (o.by === 'recommended' ? o.answer : null), answer: o.answer, by: o.by, provisional: Boolean(o.provisional),
  };
}

function add(o) {
  const entry = entryOf(o);
  const file = logPath(o);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`);
  return { added: entry.id, file };
}

function readLog(file, where) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => ({ ...JSON.parse(l), where }));
}

/** 上流の記録と、すべての run (進行中・main マージ済み・開き直しで退避したもの) の記録を時刻順に並べる */
function list({ root, since }) {
  if (!root) throw new Fail('--root が要る');
  const r = path.resolve(root);
  const out = readLog(path.join(r, '.distillery', 'decisions.jsonl'), 'upstream');
  for (const base of [path.join(r, '.distillery', 'runs'), path.join(r, '.distillery', 'archive', 'runs')]) {
    if (!fs.existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const d = stack.pop();
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.name === 'decisions.jsonl') out.push(...readLog(p, path.relative(r, path.dirname(p)).split(path.sep).join('/')));
      }
    }
  }
  return out.filter((e) => !since || e.at >= since).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

function toMarkdown(entries) {
  const head = '| 時刻 | どこで | 問い | 答え | 決め方 |\n|---|---|---|---|---|';
  const how = (e) => (e.by === 'human' ? '人' : e.by === 'rule' ? '規則' : e.provisional ? '推奨 (仮置き)' : '推奨');
  const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [head, ...entries.map((e) => `| ${e.at} | ${cell(e.where)} | ${cell(e.question)} | ${cell(e.answer)} | ${how(e)} |`)].join('\n');
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const o = parseArgs(rest);
  if (cmd === 'add') return JSON.stringify(add(o));
  if (cmd === 'list') {
    const entries = list(o);
    return o.format === 'md' ? toMarkdown(entries) : JSON.stringify({ count: entries.length, entries });
  }
  throw new Fail('decisionLog.js add|list ...');
}

if (require.main === module) {
  try { console.log(main(process.argv.slice(2))); }
  catch (e) { console.log(JSON.stringify({ ok: false, error: e.message })); process.exit(e.code || 2); }
}

module.exports = { add, list, entryOf, toMarkdown, main };
