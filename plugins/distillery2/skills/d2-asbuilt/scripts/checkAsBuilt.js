#!/usr/bin/env node
/**
 * checkAsBuilt.js — as-built index.md の要約ブロックが「表で短く」書かれているかを機械で検査する
 *
 * 人の目視に頼らず、d2-asbuilt (LLM) の書式違反をその場で差し戻すためのゲート。検査するのは要約ブロック
 * (`<!-- 要約:begin <名前> -->` … `<!-- 要約:end -->`) の中だけ (抽出節は生成側で長さを縛っている)。
 *
 * 規則 (references/asbuilt-format.md「要約の書式」が正本):
 *   R1 各ブロックは空でない
 *   R2 各ブロックに、見出し行 + 区切り行 + データ行 1 行以上 の表がある
 *   R3 表のセル 1 行 (`<br>` で分けた単位) は 40 字以内。最後の列 (根拠) は数えない。
 *      数えないのはコード位置 `path:line` と URL と強調記号だけ。`code` の中身や句読点は表示されるので数える
 *   R4 表の外に文を書かない (空行とコメント以外の行はすべて表の一部であること)
 *   R5 見出し (#) を使わない (節の階層を壊す)
 *
 * Usage: node checkAsBuilt.js <index.md> [--max-cell 40]
 * 出力: 違反の一覧。違反があれば exit 1。npm 依存なし。
 */
'use strict';

const fs = require('node:fs');

const DEFAULTS = { maxCell: 40 };

/** 表示される字数。コード位置 (path:line)・URL・強調記号は数えない。`code` の中身と句読点は数える。 */
function visibleLength(text) {
  const stripped = String(text)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(?:^|(?<=[\s(（,、/]))[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.[A-Za-z]{1,5}(?::\d+)?/g, '') // path/to/file.ext:line
    .replace(/(?<![A-Za-z0-9])[A-Za-z0-9_-]+\.[A-Za-z]{1,5}:\d+/g, '') // file.ext:line
    .replace(/(?<=[\s,、/])(?::\d+)(?=[\s,、/)）]|$)/g, '') // 同じファイルの :行 の列挙
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\\\|/g, '|')
    .replace(/[(（]\s*[)）]/g, '') // 参照を除いて空になった括弧
    .replace(/(?:^|\s)[,、/]+(?=\s|$)/g, '') // 参照の列挙に使っていた区切りだけが残ったもの
    .replace(/\s+/g, '');
  return Array.from(stripped).length;
}

function extractBlocks(md) {
  const out = [];
  const re = /<!-- 要約:begin(?: ([^\s>]+))? -->\n?([\s\S]*?)<!-- 要約:end -->/g;
  let m;
  let i = 0;
  while ((m = re.exec(md)) !== null) { out.push({ name: m[1] || `#${i}`, body: m[2], offset: m.index }); i += 1; }
  return out;
}

function lineNumberAt(md, offset) { return md.slice(0, offset).split('\n').length; }

const isTableRow = (l) => /^\|.*\|$/.test(l);
const isSeparator = (l) => /^\|(?:\s*:?-+:?\s*\|)+$/.test(l);
function splitCells(l) { return l.replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim()); }

/**
 * @returns {{violations: Array<{block:string, rule:string, line:number, text:string}>, blocks: number}}
 */
function check(md, opts = {}) {
  const maxCell = opts.maxCell || DEFAULTS.maxCell;
  const violations = [];
  const blocks = extractBlocks(md);
  for (const b of blocks) {
    const baseLine = lineNumberAt(md, b.offset);
    const lines = b.body.split('\n');
    const push = (rule, idx, text) => violations.push({ block: b.name, rule, line: baseLine + idx + 1, text: String(text).slice(0, 80) });
    if (!lines.some((l) => l.trim())) { push('R1 空のブロック', 0, ''); continue; }
    let tables = 0;
    // 表の状態機械: header → separator → data...
    let state = 'none';
    lines.forEach((raw, idx) => {
      const l = raw.trim();
      if (!l || /^<!--.*-->$/.test(l)) return;
      if (/^#/.test(l)) { push('R5 見出しを使わない', idx, l); state = 'none'; return; }
      if (!isTableRow(l)) { push('R4 表の外に文を書かない', idx, l); state = 'none'; return; }
      if (isSeparator(l)) { state = state === 'header' ? 'separator' : 'none'; return; }
      if (state === 'none') { state = 'header'; return; } // 見出し行 (字数は見ない)
      if (state === 'separator' || state === 'data') {
        if (state === 'separator') tables += 1;
        state = 'data';
        const cells = splitCells(l);
        cells.slice(0, -1).forEach((cell, ci) => {
          for (const part of cell.split(/<br\s*\/?>/i)) {
            const n = visibleLength(part);
            if (n > maxCell) push(`R3 セルが ${maxCell} 字超 (${n} 字、${ci + 1} 列目)`, idx, part);
          }
        });
        return;
      }
      // header の直後に区切り行が無い → 表になっていない
      push('R4 表の外に文を書かない', idx, l);
      state = 'none';
    });
    if (!tables) push('R2 表が無い (見出し行 + 区切り行 + データ行)', 0, lines.find((l) => l.trim()) || '');
  }
  return { violations, blocks: blocks.length };
}

function main(argv) {
  const file = argv[0];
  if (!file || file.startsWith('--')) { console.error('Usage: checkAsBuilt.js <index.md> [--max-cell N]'); return 2; }
  const opts = {};
  for (let i = 1; i < argv.length; i++) if (argv[i] === '--max-cell') opts.maxCell = Number(argv[++i]);
  const md = fs.readFileSync(file, 'utf8');
  const r = check(md, opts);
  if (!r.blocks) { console.error('要約ブロックが見つからない (extractAsBuilt.js を先に実行する)'); return 2; }
  if (!r.violations.length) { console.log(`ok: 要約ブロック ${r.blocks} 個、違反なし`); return 0; }
  for (const v of r.violations) console.log(`${file}:${v.line} [${v.block}] ${v.rule}: ${v.text}`);
  console.log(`違反 ${r.violations.length} 件。表だけで書き、1 セルを短くする (references/asbuilt-format.md)`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { check, visibleLength, extractBlocks, DEFAULTS };
