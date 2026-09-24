#!/usr/bin/env node
/**
 * checkAsBuilt.js — as-built index.md の要約ブロックが「表・箇条書きで短く」書かれているかを機械で検査する
 *
 * 人の目視に頼らず、d2-asbuilt (LLM) の書式違反をその場で差し戻すためのゲート。検査するのは要約ブロック
 * (`<!-- 要約:begin <名前> -->` … `<!-- 要約:end -->`) の中だけ (抽出節は生成側で長さを縛っている)。
 *
 * 規則 (references/asbuilt-format.md「要約の書式」が正本):
 *   R1 各ブロックは空でない
 *   R2 各ブロックに表が 1 つ以上ある (自由文で書かない)
 *   R3 表のセル 1 行 (`<br>` で分けた単位) は 40 字以内。根拠列 (最後の列) とコード位置 `path:line` は数えない
 *   R4 表の外の文は 1 文 50 字以内 (句点で区切る。コード位置は数えない)
 *   R5 見出し (#) を使わない (節の階層を壊す)
 *
 * Usage: node checkAsBuilt.js <index.md> [--max-cell 40] [--max-sentence 50]
 * 出力: 違反の一覧。違反があれば exit 1。npm 依存なし。
 */
'use strict';

const fs = require('node:fs');

const DEFAULTS = { maxCell: 40, maxSentence: 50 };

/** コード位置 (path:line、`code`、URL) を落として字数を数える。 */
function visibleLength(text) {
  const stripped = String(text)
    .replace(/`[^`]*`/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[A-Za-z0-9_./-]+\.[A-Za-z]{1,5}(?::\d+)?/g, '') // path:line / ファイル名
    .replace(/:\d+/g, '')
    .replace(/\*\*/g, '')
    .replace(/[\s、,/()（）]+/g, '');
  return Array.from(stripped).length;
}

function extractBlocks(md) {
  const out = [];
  const re = /<!-- 要約:begin(?: ([^\s>]+))? -->\n?([\s\S]*?)<!-- 要約:end -->/g;
  let m;
  let i = 0;
  while ((m = re.exec(md)) !== null) out.push({ name: m[1] || `#${i}`, body: m[2], offset: m.index });
  return out;
}

function lineNumberAt(md, offset) { return md.slice(0, offset).split('\n').length; }

/**
 * @returns {{violations: Array<{block:string, rule:string, line:number, text:string}>, blocks: number}}
 */
function check(md, opts = {}) {
  const maxCell = opts.maxCell || DEFAULTS.maxCell;
  const maxSentence = opts.maxSentence || DEFAULTS.maxSentence;
  const violations = [];
  const blocks = extractBlocks(md);
  for (const b of blocks) {
    const baseLine = lineNumberAt(md, b.offset);
    const lines = b.body.split('\n');
    const push = (rule, idx, text) => violations.push({ block: b.name, rule, line: baseLine + idx + 1, text: String(text).slice(0, 80) });
    if (!lines.some((l) => l.trim())) { push('R1 空のブロック', 0, ''); continue; }
    let tables = 0;
    lines.forEach((raw, idx) => {
      const l = raw.trim();
      if (!l) return;
      if (/^#/.test(l)) { push('R5 見出しを使わない', idx, l); return; }
      if (/^\|/.test(l)) {
        if (/^\|[-:| ]+\|$/.test(l)) { tables += 1; return; }
        const cells = l.replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
        cells.slice(0, -1).forEach((cell, ci) => {
          for (const part of cell.split(/<br\s*\/?>/i)) {
            const n = visibleLength(part);
            if (n > maxCell) push(`R3 セルが ${maxCell} 字超 (${n} 字、${ci + 1} 列目)`, idx, part);
          }
        });
        return;
      }
      const text = l.replace(/^[-*]\s+/, '');
      for (const sentence of text.split(/。/).map((x) => x.trim()).filter(Boolean)) {
        const n = visibleLength(sentence);
        if (n > maxSentence) push(`R4 文が ${maxSentence} 字超 (${n} 字)`, idx, sentence);
      }
    });
    if (!tables) push('R2 表が無い (自由文で書かない)', 0, lines.find((l) => l.trim()) || '');
  }
  return { violations, blocks: blocks.length };
}

function main(argv) {
  const file = argv[0];
  if (!file || file.startsWith('--')) { console.error('Usage: checkAsBuilt.js <index.md> [--max-cell N] [--max-sentence N]'); return 2; }
  const opts = {};
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--max-cell') opts.maxCell = Number(argv[++i]);
    else if (argv[i] === '--max-sentence') opts.maxSentence = Number(argv[++i]);
  }
  const md = fs.readFileSync(file, 'utf8');
  const r = check(md, opts);
  if (!r.blocks) { console.error('要約ブロックが見つからない (extractAsBuilt.js を先に実行する)'); return 2; }
  if (!r.violations.length) { console.log(`ok: 要約ブロック ${r.blocks} 個、違反なし`); return 0; }
  for (const v of r.violations) console.log(`${file}:${v.line} [${v.block}] ${v.rule}: ${v.text}`);
  console.log(`違反 ${r.violations.length} 件。表・箇条書きに分け、1 文 / 1 セルを短くする (references/asbuilt-format.md)`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { check, visibleLength, extractBlocks, DEFAULTS };
