#!/usr/bin/env node
'use strict';
// YAML ファイルから指定セクションを **原文のまま** 切り出す（再シリアライズしない = フィールド名・値・コメント・順序を保つ）。
// LLM に転写させていた「入力ダイジェスト」を決定的・トークン 0 で生成するためのスクリプト。
//
// Usage:
//   node extractSections.js <yaml> <path>... [--out <file>] [--md] [--append] [--header "key: value"]... [--label <text>] [--source-label <text>]
//
// path の書き方（インデント 2 スペースの block YAML を前提。flow style（`key: {…}` / `key: […]`）の内部は非対応で、
// 辿ろうとすると `unsupported` になり CLI は exit 3 で停止する。not_applicable にはしない。タブインデントは非対応）:
//   system_architecture.tiers          … ネストしたマップのキー
//   categories[id=A]                   … リスト要素を「id: A」で選択（引用符・末尾コメントの有無は問わない）
//   categories[id=A].subcategories     … 選択した要素の中のキー
//
// 出力:
//   既定(yaml): 各セクションを `# --- <path> ---` 区切りで連結。見つからないセクションは `# --- <path> (not_applicable) ---`
//   --md      : ダイジェスト Markdown（--header 行 → 転写元と sha256 → チェックリスト表 → セクションごとの ```yaml ブロック）
//   --md --append --out <file>: 既存のダイジェスト Markdown の末尾に「追加転写元」節（転写元・sha256・チェックリスト・fenced YAML）を追記
//
// チェックリストの状態は 2 値: `転写済み` / `not_applicable`（元ファイルにセクションが無い）。
// block scalar（`key: |` / `key: >`）の内部はキー探索の対象外（スカラー本文をマップと誤認しない）。

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

// 引用符の外にある `#` 以降（末尾コメント）を除いた本文
function stripTrailingComment(s) {
  let inS = false; let inD = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inD && c === '\\') { i++; continue; }              // double quote 内の \" 等はエスケープ
    if (inS && c === "'" && s[i + 1] === "'") { i++; continue; } // single quote 内の '' はエスケープ
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === '#' && !inS && !inD && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
  }
  return s.trimEnd();
}

// リスト要素の 1 行目 `  - key: value` / bare `  -` は、キーの論理インデントを `- ` の分だけ深く扱う
function isItemStart(line) {
  const t = line.trimStart();
  return t.startsWith('- ') || t === '-';
}

function effectiveIndent(line) {
  const ind = indentOf(line);
  return isItemStart(line) ? ind + 2 : ind;
}

function keyTextOf(line) {
  const t = line.trimStart();
  if (t === '-') return '';
  return t.startsWith('- ') ? t.slice(2) : t;
}

// `key: |` / `key: >`（block scalar。指示子は `|2-` / `|-2` / `>+` 等どちらの順序も可）の行か
const BLOCK_SCALAR_RE = /:\s*[|>](?:[+-]?\d?|\d?[+-]?)\s*$/;
function isBlockScalarStart(line) {
  return BLOCK_SCALAR_RE.test(stripTrailingComment(line));
}

// 行末で閉じていない quoted scalar（`key: "...` が次行以降に続く）の開始か。閉じていなければ引用符の種類を返す
function openQuoteOf(line) {
  const t = keyTextOf(line);
  const m = /^[^:#]+:\s*(["'])/.exec(t);
  if (!m) return null;
  const q = m[1];
  const rest = t.slice(t.indexOf(q) + 1);
  let closed = false;
  for (let i = 0; i < rest.length; i++) {
    if (q === '"' && rest[i] === '\\') { i++; continue; }
    if (rest[i] === q) {
      if (q === "'" && rest[i + 1] === "'") { i++; continue; } // '' はエスケープ
      closed = true; break;
    }
  }
  return closed ? null : q;
}

// i 行が block scalar / 複数行 quoted scalar の開始なら、その本文の終端（exclusive）を返す。そうでなければ i+1
function skipBlockScalar(lines, i, end) {
  if (isBlockScalarStart(lines[i])) {
    const base = effectiveIndent(lines[i]);
    let j = i + 1;
    for (; j < end; j++) {
      const line = lines[j];
      if (line.trim() === '') continue;
      if (indentOf(line) <= base) break;
    }
    return j;
  }
  const q = openQuoteOf(lines[i]);
  if (q) {
    for (let j = i + 1; j < end; j++) {
      const line = lines[j];
      for (let k = 0; k < line.length; k++) {
        if (q === '"' && line[k] === '\\') { k++; continue; }
        if (line[k] === q) {
          if (q === "'" && line[k + 1] === "'") { k++; continue; }
          return j + 1;
        }
      }
    }
    return end;
  }
  return i + 1;
}

// `key: { ... }` / `key: [ ... ]`（flow style）の行か。内部の path 解決は非対応 = unsupported として明示する
function isFlowStyleValue(line) {
  const t = stripTrailingComment(keyTextOf(line));
  return /:\s*[\[{]/.test(t);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// [start, end) の範囲で、論理インデント == scopeIndent の `key:` 行を探す（block scalar の内部は飛ばす）
function findKeyLine(lines, start, end, scopeIndent, key) {
  const re = new RegExp(`^${escapeRegExp(key)}\\s*:(\\s|$)`);
  for (let i = start; i < end;) {
    const line = lines[i];
    if (isBlankOrComment(line)) { i++; continue; }
    const eff = effectiveIndent(line);
    if (eff < scopeIndent) break; // scope を抜けた
    if (eff === scopeIndent && re.test(stripTrailingComment(keyTextOf(line)))) return i;
    i = skipBlockScalar(lines, i, end);
  }
  return -1;
}

// key 行 i から始まるブロックの終端（exclusive）。次に論理インデント <= keyIndent の非空・非コメント行まで
function blockEnd(lines, i, end, keyIndent) {
  let j = skipBlockScalar(lines, i, end);
  for (; j < end;) {
    const line = lines[j];
    if (isBlankOrComment(line)) { j++; continue; }
    if (effectiveIndent(line) <= keyIndent) break;
    j = skipBlockScalar(lines, j, end);
  }
  while (j > i + 1 && isBlankOrComment(lines[j - 1])) j--;
  return j;
}

// 行 i の直前に連続するコメント行（同じインデント以上）をブロック先頭に含める
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

// リスト要素を列挙する。各要素は { start, end, keyIndent }
function listItems(lines, start, end) {
  let itemIndent = -1;
  const starts = [];
  for (let i = start; i < end;) {
    const line = lines[i];
    if (isBlankOrComment(line)) { i++; continue; }
    const ind = indentOf(line);
    if (itemIndent < 0) itemIndent = ind;
    if (ind === itemIndent && isItemStart(line)) starts.push(i);
    i = skipBlockScalar(lines, i, end);
  }
  return starts.map((s, n) => {
    let e = n + 1 < starts.length ? starts[n + 1] : end;
    while (e > s + 1 && isBlankOrComment(lines[e - 1])) e--;
    return { start: s, end: e, keyIndent: itemIndent + 2 };
  });
}

// 要素 [s, e) の中で、論理インデント keyIndent の `selKey: value` を探して値を返す
function itemKeyValue(lines, item, selKey) {
  const re = new RegExp(`^${escapeRegExp(selKey)}\\s*:\\s*(.*)$`);
  for (let i = item.start; i < item.end;) {
    const line = lines[i];
    if (isBlankOrComment(line)) { i++; continue; }
    if (effectiveIndent(line) === item.keyIndent) {
      const m = re.exec(stripTrailingComment(keyTextOf(line)));
      if (m) return unquote(m[1]);
    }
    i = skipBlockScalar(lines, i, item.end);
  }
  return null;
}

function selectListItem(lines, start, end, selKey, selVal) {
  for (const item of listItems(lines, start, end)) {
    if (itemKeyValue(lines, item, selKey) === selVal) return item;
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
    // block scalar / 複数行 quoted scalar は子キーを持たない。その内部へ path を辿ろうとしたら not found
    if (s < segs.length - 1 && !seg.selKey && (isBlockScalarStart(lines[i]) || openQuoteOf(lines[i]))) return { path: pathStr, found: false, text: '' };
    // flow style の内部は非対応。「元ファイルに無い」ではなく unsupported として返す（CLI は非ゼロ終了）
    if ((s < segs.length - 1 || seg.selKey) && isFlowStyleValue(lines[i])) {
      return { path: pathStr, found: false, unsupported: true, reason: `flow style (${keyTextOf(lines[i]).trim().slice(0, 40)}) is not supported`, text: '' };
    }
    const keyIndent = effectiveIndent(lines[i]);
    const end = blockEnd(lines, i, scopeEnd, keyIndent);
    if (seg.selKey) {
      const item = selectListItem(lines, i + 1, end, seg.selKey, seg.selVal);
      if (!item) return { path: pathStr, found: false, text: '' };
      result = { start: leadingComments(lines, item.start, i + 1), end: item.end };
      scopeStart = item.start; scopeEnd = item.end; scopeIndent = item.keyIndent;
    } else {
      result = { start: leadingComments(lines, i, scopeStart), end };
      scopeStart = i + 1; scopeEnd = end; scopeIndent = keyIndent + 2;
    }
  }
  return { path: pathStr, found: true, text: lines.slice(result.start, result.end).join('\n'), startLine: result.start + 1, endLine: result.end };
}

// リストの各要素について selKey の値を列挙する（buildDigest の nfr カテゴリ列挙用）
function listItemValues(text, listPath, selKey, extraKeys = []) {
  const sec = sliceSection(text, listPath);
  if (sec.unsupported) {
    const err = new Error(`${listPath}: ${sec.reason}`);
    err.code = 'UNSUPPORTED_YAML';
    throw err;
  }
  if (!sec.found) return [];
  // リスト自体が flow style（`key: [ ... ]`）なら要素を列挙できない → unsupported
  const firstLine = sec.text.split('\n').find(l => !l.trim().startsWith('#')) || '';
  if (isFlowStyleValue(firstLine)) {
    const err = new Error(`${listPath}: flow style list is not supported`);
    err.code = 'UNSUPPORTED_YAML';
    throw err;
  }
  const lines = sec.text.split('\n');
  // sec.text の 1 行目は key 行（または先頭コメント）。key 行の次から要素を数える
  let keyLine = 0;
  while (keyLine < lines.length && lines[keyLine].trim().startsWith('#')) keyLine++;
  return listItems(lines, keyLine + 1, lines.length).map(item => {
    const out = { [selKey]: itemKeyValue(lines, item, selKey) };
    for (const k of extraKeys) out[k] = itemKeyValue(lines, item, k);
    return out;
  }).filter(o => o[selKey] !== null);
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

function renderSourceBlock(results, sourceLabel, headingLevel) {
  const h = '#'.repeat(headingLevel);
  const out = [];
  out.push(`- 転写元: \`${sourceLabel}\``);
  out.push(`- source_sha256: \`${sha256(results.sourceText)}\``);
  out.push('- 生成: `extractSections.js`（原文転写。要約・言い換えなし）', '');
  out.push(`${h} 転写済みセクションのチェックリスト`, '');
  out.push('| セクション | 状態 |', '|---|---|');
  for (const r of results.sections) out.push(`| \`${r.path}\` | ${r.found ? '転写済み' : 'not_applicable'} |`);
  out.push('');
  out.push('`not_applicable` = 元ファイルにセクション自体が存在しない（フォールバック対象外。元ファイルを読みに行かない）。', '');
  for (const r of results.sections) {
    if (!r.found) continue;
    out.push(`${h} ${r.path}`, '', '```yaml', r.text, '```', '');
  }
  return out;
}

function renderMarkdown(results, sourceLabel, headers, label) {
  const out = [];
  for (const h of headers) out.push(h);
  if (headers.length) out.push('');
  out.push(`# ${label || '入力ダイジェスト'}`, '');
  out.push(...renderSourceBlock(results, sourceLabel, 2));
  return out.join('\n');
}

// --md --append 用: 既存ダイジェストの末尾に追記する節（見出しは 1 段深くする）
function renderMarkdownAppend(results, sourceLabel) {
  const out = ['', `## 追加転写元: \`${sourceLabel}\``, ''];
  out.push(...renderSourceBlock(results, sourceLabel, 3));
  return out.join('\n');
}

function run(file, paths, opts = {}) {
  const sourceText = fs.readFileSync(file, 'utf-8');
  const results = { sourceText, sections: extract(sourceText, paths) };
  const label = opts.sourceLabel || file;
  if (opts.md && opts.append) return renderMarkdownAppend(results, label);
  return opts.md ? renderMarkdown(results, label, opts.headers || [], opts.label) : renderYaml(results, label);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node extractSections.js <yaml> <path>... [--out <file>] [--md] [--append] [--header "k: v"]... [--label <text>] [--source-label <text>]');
    process.exit(1);
  }
  const file = args[0];
  const paths = []; const headers = []; let out = null; let md = false; let append = false; let label = null; let sourceLabel = null;
  const needValue = (name, i) => {
    if (i + 1 >= args.length || args[i + 1].startsWith('--')) { console.error(`error: ${name} requires a value`); process.exit(1); }
    return args[i + 1];
  };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') out = needValue(a, i++);
    else if (a === '--md') md = true;
    else if (a === '--append') append = true;
    else if (a === '--header') headers.push(needValue(a, i++));
    else if (a === '--label') label = needValue(a, i++);
    else if (a === '--source-label') sourceLabel = needValue(a, i++);
    else if (a.startsWith('--')) { console.error(`error: unknown option ${a}`); process.exit(1); }
    else paths.push(a);
  }
  if (paths.length === 0) { console.error('error: at least one <path> is required'); process.exit(1); }
  if (append && !(md && out)) {
    console.error('error: --append requires --md and --out <existing digest file>');
    process.exit(1);
  }
  if (!fs.existsSync(file)) { console.error(`error: file not found: ${file}`); process.exit(1); }
  const sections = extract(fs.readFileSync(file, 'utf-8'), paths);
  const unsupported = sections.filter(r => r.unsupported);
  if (unsupported.length) {
    for (const u of unsupported) console.error(`error: ${u.path}: ${u.reason}`);
    process.exit(3);
  }
  const text = run(file, paths, { md, append, headers, label, sourceLabel });
  const body = text.endsWith('\n') ? text : text + '\n';
  const missing = sections.filter(r => !r.found).map(r => r.path);
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (append) fs.appendFileSync(out, body, 'utf-8'); else fs.writeFileSync(out, body, 'utf-8');
    console.log(`${append ? 'appended' : 'written'}: ${out}${missing.length ? ` (not_applicable: ${missing.join(', ')})` : ''}`);
  } else {
    process.stdout.write(body);
  }
}

module.exports = { sliceSection, listItemValues, extract, renderYaml, renderMarkdown, renderMarkdownAppend, run, sha256, stripTrailingComment };

if (require.main === module) main(process.argv);
