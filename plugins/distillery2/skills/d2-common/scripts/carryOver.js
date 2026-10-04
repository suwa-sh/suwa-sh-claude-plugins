#!/usr/bin/env node
/**
 * carryOver.js — 要求の差分で残った作業 (use-cases.yaml の UC 行の carry_over) を書き換える (0.1.30)
 *
 *   node carryOver.js next  [--skip a,b] [--from <slug>] [--cwd <repo>]        宛先の UC を返す {target}
 *   node carryOver.js add   --items <JSON 配列 | 1 行 1 項目のファイル> [--skip a,b] [--cwd <repo>]
 *                                                                              宛先の UC 行の carry_over に追記 (重複は足さない)
 *   node carryOver.js move  --from <slug> --items <...> [--skip a,b] [--cwd <repo>]
 *                                                                              --from の行の carry_over を消し、--items を宛先の行に追記
 *   node carryOver.js clear --from <slug> [--cwd <repo>]                       行の carry_over を消す
 *
 * 宛先の規則 (全サブコマンド共通): use-cases.yaml の先頭から、status が done でなく、--from でも --skip でもない最初の UC
 * (d2-run の自動選択 3 の 6 と同じ「先頭から」の規則。配送の順が名指しで入れ替わっても宛先は同じ)。
 * --skip には feature/<slug> が残る UC (要求で止まった UC) を渡す。宛先が無ければ target: null (move は moved: false, reason: no_target)。
 * どのサブコマンドも JSON 1 行を返す。終了コードは 0 = 成功 / 2 = 引数・ファイルの誤り。
 * LLM が YAML を手で直さないために置く (宛先の選び方と重複の扱いをテストで固定する)。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml, stringifyYaml } = require('./lib/yaml');

const USE_CASES_REL = 'docs/requirements/use-cases.yaml';

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
    else opts._.push(a);
  }
  return opts;
}

function csv(v) { return v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []; }

/** --items: JSON 配列の文字列か、1 行 1 項目のファイル */
function readItems(v, root) {
  if (v === undefined || v === null || v === '') return [];
  const s = String(v);
  if (s.trim().startsWith('[')) {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) throw new Error('--items の JSON は配列');
    return arr.map((x) => String(x).trim()).filter(Boolean);
  }
  const p = path.resolve(root, s);
  if (!fs.existsSync(p)) throw new Error(`--items のファイルが無い: ${p}`);
  return fs.readFileSync(p, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
}

function loadUseCases(root) {
  const p = path.join(root, USE_CASES_REL);
  if (!fs.existsSync(p)) throw new Error(`use-cases.yaml が無い: ${p}`);
  const doc = parseYaml(fs.readFileSync(p, 'utf8'));
  if (!doc || !Array.isArray(doc.use_cases)) throw new Error('use-cases.yaml に use_cases の配列が無い');
  return { path: p, doc };
}

function saveUseCases(file, doc) { fs.writeFileSync(file, `${stringifyYaml(doc)}\n`, 'utf8'); }

/** 宛先: 先頭から status が done でなく、from でも skip でもない最初の UC */
function pickTarget(useCases, { from = null, skip = [] } = {}) {
  const uc = useCases.find((u) => u.status !== 'done' && u.slug !== from && !skip.includes(u.slug));
  return uc ? uc.slug : null;
}

function rowOf(useCases, slug) {
  const uc = useCases.find((u) => u.slug === slug);
  if (!uc) throw new Error(`use-cases.yaml に無い slug: ${slug}`);
  return uc;
}

function appendItems(uc, items) {
  const cur = Array.isArray(uc.carry_over) ? uc.carry_over.map(String) : [];
  const added = [];
  for (const it of items) if (!cur.includes(it)) { cur.push(it); added.push(it); }
  if (cur.length) uc.carry_over = cur; else delete uc.carry_over;
  return added;
}

function cmdNext(root, opts) {
  const { doc } = loadUseCases(root);
  return { target: pickTarget(doc.use_cases, { from: opts.from || null, skip: csv(opts.skip) }) };
}

function cmdAdd(root, opts) {
  const items = readItems(opts.items, root);
  if (!items.length) throw new Error('add --items <JSON 配列 | ファイル> (1 件以上)');
  const { path: file, doc } = loadUseCases(root);
  const target = pickTarget(doc.use_cases, { skip: csv(opts.skip) });
  if (!target) return { added: false, reason: 'no_target', target: null, items };
  const added = appendItems(rowOf(doc.use_cases, target), items);
  saveUseCases(file, doc);
  return { added: true, target, items: added, skipped_duplicates: items.filter((x) => !added.includes(x)) };
}

function cmdMove(root, opts) {
  if (!opts.from) throw new Error('move --from <slug> --items <...>');
  const items = readItems(opts.items, root);
  const { path: file, doc } = loadUseCases(root);
  const from = rowOf(doc.use_cases, opts.from);
  const cleared = Array.isArray(from.carry_over) ? from.carry_over.slice() : [];
  delete from.carry_over;
  if (!items.length) { saveUseCases(file, doc); return { moved: false, reason: 'no_items', target: null, cleared }; }
  const target = pickTarget(doc.use_cases, { from: opts.from, skip: csv(opts.skip) });
  if (!target) { saveUseCases(file, doc); return { moved: false, reason: 'no_target', target: null, items, cleared }; }
  const added = appendItems(rowOf(doc.use_cases, target), items);
  saveUseCases(file, doc);
  return { moved: true, target, items: added, cleared, skipped_duplicates: items.filter((x) => !added.includes(x)) };
}

function cmdClear(root, opts) {
  if (!opts.from) throw new Error('clear --from <slug>');
  const { path: file, doc } = loadUseCases(root);
  const from = rowOf(doc.use_cases, opts.from);
  const cleared = Array.isArray(from.carry_over) ? from.carry_over.slice() : [];
  delete from.carry_over;
  saveUseCases(file, doc);
  return { cleared };
}

function main(argv) {
  const all = parseArgs(argv);
  const cmd = all._[0];
  const root = path.resolve(all.cwd || process.cwd());
  const table = { next: cmdNext, add: cmdAdd, move: cmdMove, clear: cmdClear };
  if (!table[cmd]) { console.error(`Usage: carryOver.js ${Object.keys(table).join('|')} [--cwd <repo>] ...`); return 2; }
  try {
    console.log(JSON.stringify(table[cmd](root, all)));
    return 0;
  } catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    return 2;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { pickTarget, appendItems, readItems, main, USE_CASES_REL };
