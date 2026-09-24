#!/usr/bin/env node
'use strict';
/**
 * genRules.js (F1) — ADR の rules[] とテンプレートから docs/rules/*.md を生成する
 *
 *   node genRules.js --adr docs/adr --out docs/rules [--templates <dir>] [--cwd <repo>]
 *
 * - テンプレート (references/rule-templates/) を土台に、採用済み ADR の rules[] を
 *   scope ごとに差し込む: 依存の向き (arch_test) は「## 依存の向き」の表、それ以外は「## 決定ごとのルール」の
 *   ADR 番号 + 題名の見出しの下に ADR id 昇順で並べる (平坦な箇条書きにしない)。
 * - scope: common → common.md / tier:<kind> → tier-<kind>.md / testing → testing.md
 * - tier ファイルは ADR tiers[] に現れた kind だけ生成する (宣言が無ければ全 kind)。
 * - 出力は決定論 (2 回実行して同一)。先頭に basis ヘッダを付ける。
 * - 未知の scope は exit 1 で停止する (推測で振り分けない)。
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadAdrs, isAccepted, TIER_KINDS } = require('./adr');
const { stamp, headerLine } = require('../../../scripts/lib/basis');

const DEFAULT_TEMPLATES = path.join(__dirname, '..', 'references', 'rule-templates');

function parseArgs(argv) {
  const o = { adr: 'docs/adr', out: 'docs/rules', templates: DEFAULT_TEMPLATES, cwd: process.cwd(), force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--adr') o.adr = next();
    else if (a === '--out') o.out = next();
    else if (a === '--templates') o.templates = next();
    else if (a === '--cwd') o.cwd = path.resolve(next());
    else if (a === '--force') o.force = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  return o;
}

const HEADER_SCAN_LINES = 10;
/** 生成物か? 先頭数行に basis ヘッダ (`basis:`) があれば生成物とみなす。手書きは持たない。 */
function isGenerated(text) { return /basis:/.test(text.split('\n').slice(0, HEADER_SCAN_LINES).join('\n')); }

/** rule の scope を出力ファイル名に対応づける。未知なら null。 */
function scopeToFile(scope) {
  if (scope === 'common') return 'common.md';
  if (scope === 'testing') return 'testing.md';
  const m = /^tier:(.+)$/.exec(scope);
  if (m && TIER_KINDS.includes(m[1])) return `tier-${m[1]}.md`;
  return null;
}

/** 採用済み ADR から scope → [{id, text}] を集める。未知 scope はエラー配列に載せる。 */
function collectRules(adrs) {
  const byScope = {};
  const errors = [];
  for (const adr of adrs) {
    if (!isAccepted(adr) || !Array.isArray(adr.rules)) continue;
    for (const r of adr.rules) {
      if (!r || !r.scope) continue;
      const file = scopeToFile(r.scope);
      if (!file) { errors.push({ id: adr.id, scope: r.scope, file: adr.file }); continue; }
      (byScope[file] ||= []).push({ id: adr.id, title: adr.title || '', text: r.text, arch_test: r.arch_test || null });
    }
  }
  for (const list of Object.values(byScope)) list.sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
  return { byScope, errors };
}

function escapeCell(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '); }

/**
 * 決定由来のルールを、読みやすい構造で描く。
 * - 依存の向き (arch_test 付き) は表にまとめる。アーキテストが機械で強制するので読者が覚える必要はない
 * - それ以外は ADR ごとの見出し (番号 + 題名) の下に置く。なぜそのルールがあるかを ADR で辿れる
 */
function renderDecisionRules(rules) {
  const archRules = rules.filter(r => r.arch_test && r.arch_test.from && r.arch_test.to);
  const plainRules = rules.filter(r => !(r.arch_test && r.arch_test.from && r.arch_test.to));
  const out = [];
  if (archRules.length) {
    out.push('## 依存の向き (アーキテストが強制する)', '');
    out.push('違反は静的ゲート (dependency-cruiser) で落ちる。読者が覚える必要はなく、落ちたときに理由を引く表。', '');
    out.push('| 出所 | 効果 | 先 | 範囲 | 内容 | 出典 |', '|---|---|---|---|---|---|');
    for (const r of archRules) {
      const t = r.arch_test;
      out.push(`| \`${escapeCell(t.from)}\` | ${t.effect === 'allow' ? '許可' : '禁止'} | \`${escapeCell(t.to)}\` | ${escapeCell(t.level || '')} | ${escapeCell(r.text)} | ADR ${r.id} |`);
    }
    out.push('');
  }
  if (plainRules.length) {
    out.push('## 決定ごとのルール', '');
    out.push('各見出しは ADR 1 本に対応する。背景と却下した案は `docs/adr/` の該当ファイルを読む。', '');
    let current = null;
    for (const r of plainRules) {
      if (r.id !== current) {
        if (current !== null) out.push('');
        current = r.id;
        out.push(`### ADR ${r.id}${r.title ? ' ' + r.title : ''}`, '');
      }
      out.push(`- ${r.text}`);
    }
    out.push('');
  }
  return out.join('\n').replace(/\s+$/, '');
}

/** ADR tiers[] に現れた kind の集合。宣言が無ければ全 kind。 */
function presentKinds(adrs) {
  const kinds = new Set();
  for (const adr of adrs) {
    if (isAccepted(adr) && Array.isArray(adr.tiers)) for (const t of adr.tiers) if (t.kind) kinds.add(t.kind);
  }
  return kinds.size ? [...kinds].filter(k => TIER_KINDS.includes(k)) : [...TIER_KINDS];
}

/** index.md の「ファイル | 対象」表の行。実在する (生成する) ファイルだけをリンクで並べる。 */
function renderFileTable(targets) {
  const label = (name) => {
    if (name === 'common.md') return '全ティア共通';
    if (name === 'testing.md') return 'テスト 4 段・転写規約・実体 I/O';
    const m = name.match(/^tier-(.+)\.md$/);
    return m ? `${m[1]} ティア` : name;
  };
  // 並びは読む順: common → 自ティア → testing
  const order = (n) => (n === 'common.md' ? 0 : n === 'testing.md' ? 2 : 1);
  return targets.filter((n) => n !== 'index.md').sort((a, b) => order(a) - order(b) || (a < b ? -1 : a > b ? 1 : 0)).map((n) => `| [${n}](${n}) | ${label(n)} |`).join('\n');
}

function renderFile(templateBody, rules, basisLine, targets = []) {
  let body = templateBody.replace(/\s+$/, '').replace('<!-- rules:files -->', renderFileTable(targets));
  if (rules && rules.length) {
    body += '\n\n' + renderDecisionRules(rules);
  }
  return `<!-- ${basisLine} -->\n<!-- generated by d2-foundation genRules.js — 手で直さず ADR を変える -->\n\n${body}\n`;
}

function run(o) {
  const adrDir = path.resolve(o.cwd, o.adr);
  const outDir = path.resolve(o.cwd, o.out);
  const adrs = loadAdrs(adrDir);
  const { byScope, errors } = collectRules(adrs);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR unknown rule scope "${e.scope}" in ${e.file} (ADR ${e.id})`);
    return { code: 1, written: [] };
  }
  const basisLine = headerLine(stamp({ adr: o.adr }, o.cwd));
  const kinds = presentKinds(adrs);
  const targets = ['index.md', 'common.md', 'testing.md', ...kinds.map(k => `tier-${k}.md`)];
  fs.mkdirSync(outDir, { recursive: true });
  const written = [], skipped = [];
  for (const name of targets) {
    const tplPath = path.join(o.templates, name);
    if (!fs.existsSync(tplPath)) { console.error(`ERROR template not found: ${tplPath}`); return { code: 1, written, skipped }; }
    const outFile = path.join(outDir, name);
    // 手書きルールを握り潰さない: 既存が生成ヘッダを持たなければ --force が無い限り上書きしない。
    if (fs.existsSync(outFile) && !o.force && !isGenerated(fs.readFileSync(outFile, 'utf8'))) {
      console.error(`WARN existing ${path.join(o.out, name)} lacks basis header (hand-written?) — 上書きしない。上書きするなら --force`);
      skipped.push(name);
      continue;
    }
    const tpl = fs.readFileSync(tplPath, 'utf8');
    const content = renderFile(tpl, byScope[name], basisLine, targets);
    fs.writeFileSync(outFile, content);
    written.push(name);
  }
  return { code: skipped.length ? 1 : 0, written, skipped, adrs: adrs.length, kinds };
}

function main(argv) {
  let o; try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const r = run(o);
  console.log(`genRules: ${r.written.length} files (kinds: ${(r.kinds || []).join(', ')}) from ${r.adrs || 0} ADRs${r.skipped && r.skipped.length ? `, skipped ${r.skipped.length} (hand-written; use --force)` : ''}`);
  return r.code;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { parseArgs, scopeToFile, collectRules, presentKinds, renderFile, renderFileTable, renderDecisionRules, run };
