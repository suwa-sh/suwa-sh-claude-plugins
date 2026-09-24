#!/usr/bin/env node
/**
 * genAdrIndex.js (distillery2)
 *
 * docs/adr/ の ADR 群から index.md を決定論的に生成する (id 昇順)。
 *
 * Usage:
 *   node genAdrIndex.js <adr-dir> [output-md] [requirements=<dir>]
 *
 * requirements=<dir> を渡すと basis: requirements@<sha> を front matter に付ける。
 * 省略時は basis を付けない (テストのスナップショット比較用に決定論を保つ)。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadAdrDir } = require('./validateAdr');
const basisLib = require('../../../scripts/lib/basis');

/** コードポイント比較。localeCompare は実行環境のロケールで順序が変わり非決定的なため使わない。 */
function cmpStr(a, b) { a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }

/**
 * @param {{file:string, fm:object}[]} adrs
 * @param {string|null} basisLine  例 "basis: requirements@abc123" (無ければ null)
 * @param {{architecture?: string}} opts  architecture を渡すと C4 図へのリンクを一覧の直後に載せる
 */
function renderIndex(adrs, basisLine = null, opts = {}) {
  const sorted = [...adrs].sort((a, b) => cmpStr(a.fm.id, b.fm.id));
  const lines = [];
  if (basisLine) lines.push('---', basisLine, '---', '');
  lines.push('# アーキテクチャ決定記録 (ADR) 一覧', '');
  if (opts.architecture) lines.push(`決定から描いた C4 図: [${opts.architecture}](${opts.architecture})`, '');
  lines.push('| 番号 | タイトル | ステータス | supersedes | superseded_by |');
  lines.push('|------|---------|-----------|-----------|---------------|');
  for (const { file, fm } of sorted) {
    const title = String(fm.title ?? '').replace(/\|/g, '\\|');
    const supersedes = (fm.supersedes || []).length ? fm.supersedes.join(', ') : '-';
    const supersededBy = fm.superseded_by ? fm.superseded_by : '-';
    lines.push(`| [${fm.id}](${file}) | ${title} | ${fm.status ?? '-'} | ${supersedes} | ${supersededBy} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function main(argv) {
  const dirs = {};
  const rest = [];
  for (const a of argv) { const m = a.match(/^([A-Za-z0-9_-]+)=(.+)$/); if (m) dirs[m[1]] = m[2]; else rest.push(a); }
  if (!rest.length) { console.error('Usage: node genAdrIndex.js <adr-dir> [output-md] [requirements=<dir>]'); return 2; }
  const dir = path.resolve(rest[0]);
  if (!fs.existsSync(dir)) { console.error(`Directory not found: ${dir}`); return 2; }
  const output = rest[1] ? path.resolve(rest[1]) : path.join(dir, 'index.md');
  const { adrs } = loadAdrDir(dir);
  let basisLine = null;
  if (Object.keys(dirs).length) basisLine = basisLib.headerLine(basisLib.stamp(dirs));
  // architecture.md が同ディレクトリにあるときだけリンクを載せる (dangling を避ける)。
  const opts = fs.existsSync(path.join(dir, 'architecture.md')) ? { architecture: 'architecture.md' } : {};
  fs.writeFileSync(output, renderIndex(adrs, basisLine, opts), 'utf8');
  console.log(`Generated: ${output} (${adrs.length} ADRs)`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { renderIndex };
