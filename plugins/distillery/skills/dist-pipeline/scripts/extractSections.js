#!/usr/bin/env node
'use strict';
// YAML ファイルから指定セクションを **原文のまま** 切り出す（再シリアライズしない = フィールド名・値・コメント・順序を保つ）。
// LLM に転写させていた「入力ダイジェスト」を決定的・トークン 0 で生成するためのスクリプト。
//
// Usage:
//   node extractSections.js <yaml> <path>... [--out <file>] [--md] [--header "key: value"]... [--label <text>]
//
// path の書き方（インデント 2 スペースの block YAML を前提）:
//   system_architecture.tiers          … ネストしたマップのキー
//   categories[id=A]                   … リスト要素を「id: A」で選択（引用符の有無は問わない）
//   categories[id=A].subcategories     … 選択した要素の中のキー
//
// 出力:
//   既定(yaml): 各セクションを `# --- <path> ---` 区切りで連結。見つからないセクションは `# --- <path> (not_applicable) ---`
//   --md      : ダイジェスト Markdown（--header 行 → 転写元と sha256 → チェックリスト表 → セクションごとの ```yaml ブロック）
//
// チェックリストの状態は 2 値: `転写済み` / `not_applicable`（元ファイルにセクションが無い）。
// 「元ファイル参照」（転写しなかった）は本スクリプトでは発生しない（要求されたセクションは必ず転写する）。

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function isBlankOrComment(line) {
  const t = line.trim();
  return t === '' || t.startsWith('#');
}

// リスト要素の 1 行目 `  - key: value` は、キーの論理インデントを `- ` の分だけ深く扱う（= 兄弟キー `    key:` と同じ深さ）
function effectiveIndent(line) {
  const ind = indentOf(line);
  return line.trimStart().startsWith('- ') ? ind + 2 : ind;
}

function keyTextOf(line) {
  const t = line.trimStart();
  return t.startsWith('- ') ? t.slice(2) : t;
}

// [start, end) の範囲で、論理インデント == scopeIndent の `key:` 行を探す
function findKeyLine(lines, start, end, scopeIndent, key) {
  const re = new RegExp(`^${escapeRegExp(key)}\\s*:(\\s|$)`);
  for (let i = start; i < end; i++) {
    const line = lines[i];
    if (isBlankOrComment(line)) continue;
    const eff = effectiveIndent(line);
    if (eff < scopeIndent) break; // scope を抜けた
    if (eff !== scopeIndent) continue;
    if (re.test(keyTextOf(line))) return i;
  }
  return -1;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// key 行 i から始まるブロックの終端（exclusive）。次に論理インデント <= keyIndent の非空・非コメント行まで
function blockEnd(lines, i, end, keyIndent) {
  let j = i + 1;
  for (; j < end; j++) {
    const line = lines[j];
    if (isBlankOrComment(line)) continue;
    if (effectiveIndent(line) <= keyIndent) break;
  }
  // 末尾の空行・コメント行はブロックに含めない
  while (j > i + 1 && isBlankOrComment(lines[j - 1])) j--;
  return j;
}

// key 行の直前に連続するコメント行をブロック先頭に含める
function leadingComments(lines, i, start) {
  let k = i;
  while (k - 1 >= start && lines[k - 1].trim().startsWith('#')) k--;
  return k;
}

function parsePath(pathStr) {
  const segs = [];
  const re = /([^.\[\]]+)(?:\[([^=\]]+)=([^\]]+)\])?/g;
  let m;
  while ((m = re.exec(pathStr)) !== null) {
    segs.push({ key: m[1].trim(), selKey: m[2] ? m[2].trim() : null, selVal: m[3] ? m[3].trim() : null });
  }
  return segs;
}

function unquote(v) {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

// リスト要素の選択。listStart は key 行の次から。要素は `- ` で始まる行（indent = itemIndent）
function selectListItem(lines, start, end, selKey, selVal) {
  let itemIndent = -1;
  const items = [];
  for (let i = start; i < end; i++) {
    const line = lines[i];
    if (isBlankOrComment(line)) continue;
    const ind = indentOf(line);
    if (itemIndent < 0) itemIndent = ind;
    if (ind === itemIndent && line.trimStart().startsWith('- ')) items.push(i);
  }
  for (let n = 0; n < items.length; n++) {
    const s = items[n];
    const e = n + 1 < items.length ? items[n + 1] : end;
    const keyIndent = itemIndent + 2;
    const re = new RegExp(`^(?:${' '.repeat(itemIndent)}- |${' '.repeat(keyIndent)})${escapeRegExp(selKey)}\\s*:\\s*(.+)$`);
    for (let i = s; i < e; i++) {
      const m = re.exec(lines[i]);
      if (m && unquote(m[1]) === selVal) {
        let ee = e;
        while (ee > s + 1 && isBlankOrComment(lines[ee - 1])) ee--;
        return { start: s, end: ee, keyIndent };
      }
    }
  }
  return null;
}

function sliceSection(text, pathStr) {
  const lines = text.split('\n');
  const segs = parsePath(pathStr);
  let scopeStart = 0; let scopeEnd = lines.length; let scopeIndent = 0;
  let result = null;
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s];
    const i = findKeyLine(lines, scopeStart, scopeEnd, scopeIndent, seg.key);
    if (i < 0) return { path: pathStr, found: false, text: '' };
    const keyIndent = effectiveIndent(lines[i]);
    const end = blockEnd(lines, i, scopeEnd, keyIndent);
    if (seg.selKey) {
      const item = selectListItem(lines, i + 1, end, seg.selKey, seg.selVal);
      if (!item) return { path: pathStr, found: false, text: '' };
      result = { start: item.start, end: item.end };
      // 要素の 1 行目 `- key: value` も論理インデント = keyIndent として探索対象に含める
      scopeStart = item.start; scopeEnd = item.end; scopeIndent = item.keyIndent;
    } else {
      const from = s === 0 ? leadingComments(lines, i, scopeStart) : i;
      result = { start: from, end };
      scopeStart = i + 1; scopeEnd = end; scopeIndent = keyIndent + 2;
    }
  }
  return { path: pathStr, found: true, text: lines.slice(result.start, result.end).join('\n'), startLine: result.start + 1, endLine: result.end };
}

function extract(text, paths) {
  return paths.map(p => sliceSection(text, p));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function renderYaml(results, sourceLabel) {
  const out = [`# extracted from ${sourceLabel}`, `# source_sha256: ${sha256(results.sourceText)}`, ''];
  for (const r of results.sections) {
    if (r.found) {
      out.push(`# --- ${r.path} (L${r.startLine}-${r.endLine}) ---`, r.text, '');
    } else {
      out.push(`# --- ${r.path} (not_applicable) ---`, '');
    }
  }
  return out.join('\n');
}

function renderMarkdown(results, sourceLabel, headers, label) {
  const out = [];
  for (const h of headers) out.push(h);
  if (headers.length) out.push('');
  out.push(`# ${label || '入力ダイジェスト'}`, '');
  out.push(`- 転写元: \`${sourceLabel}\``);
  out.push(`- source_sha256: \`${sha256(results.sourceText)}\``);
  out.push('- 生成: `extractSections.js`（原文転写。要約・言い換えなし）', '');
  out.push('## 転写済みセクションのチェックリスト', '');
  out.push('| セクション | 状態 |', '|---|---|');
  for (const r of results.sections) out.push(`| \`${r.path}\` | ${r.found ? '転写済み' : 'not_applicable'} |`);
  out.push('');
  out.push('`not_applicable` = 元ファイルにセクション自体が存在しない（フォールバック対象外。元ファイルを読みに行かない）。', '');
  for (const r of results.sections) {
    if (!r.found) continue;
    out.push(`## ${r.path}`, '', '```yaml', r.text, '```', '');
  }
  return out.join('\n');
}

function run(file, paths, opts = {}) {
  const sourceText = fs.readFileSync(file, 'utf-8');
  const results = { sourceText, sections: extract(sourceText, paths) };
  const label = opts.sourceLabel || file;
  return opts.md ? renderMarkdown(results, label, opts.headers || [], opts.label) : renderYaml(results, label);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node extractSections.js <yaml> <path>... [--out <file>] [--md] [--header "k: v"]... [--label <text>] [--source-label <text>]');
    process.exit(1);
  }
  const file = args[0];
  const paths = []; const headers = []; let out = null; let md = false; let label = null; let sourceLabel = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--out') out = args[++i];
    else if (args[i] === '--md') md = true;
    else if (args[i] === '--header') headers.push(args[++i]);
    else if (args[i] === '--label') label = args[++i];
    else if (args[i] === '--source-label') sourceLabel = args[++i];
    else paths.push(args[i]);
  }
  const text = run(file, paths, { md, headers, label, sourceLabel });
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text.endsWith('\n') ? text : text + '\n', 'utf-8');
    const missing = extract(fs.readFileSync(file, 'utf-8'), paths).filter(r => !r.found).map(r => r.path);
    console.log(`written: ${out}${missing.length ? ` (not_applicable: ${missing.join(', ')})` : ''}`);
  } else {
    process.stdout.write(text.endsWith('\n') ? text : text + '\n');
  }
}

module.exports = { sliceSection, extract, renderYaml, renderMarkdown, run, sha256 };

if (require.main === module) main(process.argv);
