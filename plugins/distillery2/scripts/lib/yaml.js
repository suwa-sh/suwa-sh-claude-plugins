/**
 * yaml.js — 外部依存なしの YAML サブセット パーサ / シリアライザ
 *
 * distillery v1 の 2 つの yaml-parser.js (dist-spec 版と distillery-impl 版) の上位集合。
 * - ブロックスカラー (`|`, `|-`, `>`, `|2-` 等) と本文が "- " で始まるケース
 * - JSON (YAML 1.2 の部分集合) はそのまま JSON.parse
 * - インライン配列 `[a, b]` とフラットな flow mapping `{a: 1, b: x}`
 * - 配列要素の先頭キーが入れ子オブジェクトになる `- key:\n    nested: v` (v1 では壊れていた形)
 *
 * distillery2 のスクリプトは全部これを使う。他プラグインから require しない (install cache は plugin 単位)。
 */
'use strict';

const BLOCK_SCALAR_RE = /^[|>](?:[0-9]+[-+]?|[-+][0-9]*)?(?:\s*#.*)?$/;

function parseYaml(text) {
  if (/^[\s]*[\[{]/.test(text)) return JSON.parse(text);
  const lines = text.split('\n');
  return parseNode(lines, 0, -1).value;
}

function parseNode(lines, startIdx, parentIndent) {
  let i = startIdx;
  const result = {};
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');
    if (trimmed === '' || trimmed.trimStart().startsWith('#')) { i++; continue; }
    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;
    const content = trimmed.trimStart();
    if (content.startsWith('- ')) break;
    if (content.includes(':')) {
      const colonIdx = content.indexOf(':');
      const key = unquoteKey(content.slice(0, colonIdx).trim());
      const rawValue = content.slice(colonIdx + 1).trim();
      if (rawValue === '' || BLOCK_SCALAR_RE.test(rawValue)) {
        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length) {
          const nextIndent = lines[nextLineIdx].search(/\S/);
          if (nextIndent > indent) {
            const nextContent = lines[nextLineIdx].trimStart();
            if (BLOCK_SCALAR_RE.test(rawValue)) {
              const scalar = parseBlockScalar(lines, i + 1, indent, rawValue);
              result[key] = scalar.value; i = scalar.nextIdx; continue;
            } else if (nextContent.startsWith('- ')) {
              const arr = parseArray(lines, nextLineIdx, indent);
              result[key] = arr.value; i = arr.nextIdx; continue;
            } else {
              const child = parseNode(lines, i + 1, indent);
              result[key] = child.value; i = child.nextIdx; continue;
            }
          }
        }
        result[key] = BLOCK_SCALAR_RE.test(rawValue) ? '' : null;
        i++; continue;
      }
      result[key] = parseValue(rawValue);
      i++; continue;
    }
    i++;
  }
  return { value: result, nextIdx: i };
}

function parseArray(lines, startIdx, parentIndent) {
  let i = startIdx;
  const arr = [];
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');
    if (trimmed === '' || trimmed.trimStart().startsWith('#')) { i++; continue; }
    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;
    const content = trimmed.trimStart();
    if (!content.startsWith('- ')) break;
    const itemContent = content.slice(2).trim();
    const itemIndent = indent;
    const keyCol = itemIndent + 2;

    if (looksLikeMappingEntry(itemContent)) {
      const obj = {};
      const colonIdx = itemContent.indexOf(':');
      const k = unquoteKey(itemContent.slice(0, colonIdx).trim());
      const v = itemContent.slice(colonIdx + 1).trim();
      if (v === '' || BLOCK_SCALAR_RE.test(v)) {
        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length && lines[nextLineIdx].search(/\S/) > itemIndent) {
          const nextIndent = lines[nextLineIdx].search(/\S/);
          const nextContent = lines[nextLineIdx].trimStart();
          if (BLOCK_SCALAR_RE.test(v)) {
            const scalar = parseBlockScalar(lines, i + 1, keyCol, v);
            obj[k] = scalar.value;
            const rest = parseNode(lines, scalar.nextIdx, itemIndent);
            Object.assign(obj, rest.value);
            arr.push(obj); i = rest.nextIdx; continue;
          }
          if (nextContent.startsWith('- ') && nextIndent >= keyCol) {
            const sub = parseArray(lines, nextLineIdx, itemIndent);
            obj[k] = sub.value;
            const rest = parseNode(lines, sub.nextIdx, itemIndent);
            Object.assign(obj, rest.value);
            arr.push(obj); i = rest.nextIdx; continue;
          }
          if (nextIndent > keyCol) {
            // `- key:` の入れ子オブジェクト。キー列より深い行が本体、キー列の行は兄弟キー
            const nested = parseNode(lines, i + 1, keyCol);
            obj[k] = nested.value;
            const rest = parseNode(lines, nested.nextIdx, itemIndent);
            Object.assign(obj, rest.value);
            arr.push(obj); i = rest.nextIdx; continue;
          }
          obj[k] = null;
          const rest = parseNode(lines, i + 1, itemIndent);
          Object.assign(obj, rest.value);
          arr.push(obj); i = rest.nextIdx; continue;
        }
        obj[k] = BLOCK_SCALAR_RE.test(v) ? '' : null;
      } else {
        obj[k] = parseValue(v);
      }
      const rest = parseNode(lines, i + 1, itemIndent);
      Object.assign(obj, rest.value);
      arr.push(obj); i = rest.nextIdx; continue;
    }
    if (itemContent === '' ) {
      // `-` 単独: 次行以降が要素本体
      const nextLineIdx = findNextNonEmpty(lines, i + 1);
      if (nextLineIdx < lines.length && lines[nextLineIdx].search(/\S/) > itemIndent) {
        const nextContent = lines[nextLineIdx].trimStart();
        if (nextContent.startsWith('- ')) { const sub = parseArray(lines, nextLineIdx, itemIndent); arr.push(sub.value); i = sub.nextIdx; continue; }
        const child = parseNode(lines, i + 1, itemIndent); arr.push(child.value); i = child.nextIdx; continue;
      }
      arr.push(null); i++; continue;
    }
    arr.push(parseValue(itemContent));
    i++;
  }
  return { value: arr, nextIdx: i };
}

function looksLikeMappingEntry(s) {
  if (isQuotedString(s)) return false;
  if (s.startsWith('[') || s.startsWith('{')) return false;
  const idx = s.indexOf(':');
  if (idx <= 0) return false;
  const after = s.slice(idx + 1);
  return after === '' || after.startsWith(' ');
}

function parseBlockScalar(lines, startIdx, parentIndent, indicator) {
  let i = startIdx;
  const raw = [];
  let baseIndent = null;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');
    if (trimmed === '') { raw.push(''); i++; continue; }
    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;
    if (baseIndent === null) baseIndent = indent;
    raw.push(line.slice(Math.min(baseIndent, indent)).replace(/\s+$/, ''));
    i++;
  }
  while (raw.length && raw[raw.length - 1] === '') raw.pop();
  // チョンピング指示子 (-/+) は受理するが、末尾の改行は常に落とす (v1 と同じ挙動。ハッシュの安定のため)。
  // 行内の相対インデントは保つ (v1 は各行を trim していたので、コード片の字下げが消えていた)
  const folded = (indicator || '').startsWith('>');
  const value = folded ? raw.map(l => l.trim()).join(' ').replace(/\s+/g, ' ').trim() : raw.join('\n');
  return { value, nextIdx: i };
}

function parseValue(str) {
  if (str === '' || str === 'null' || str === '~') return null;
  if (str === '[]') return [];
  if (str === '{}') return {};
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (/^-?[0-9]+$/.test(str)) return parseInt(str, 10);
  if (/^-?[0-9]*\.[0-9]+$/.test(str)) return parseFloat(str);
  if (isQuotedString(str)) return unquote(str);
  if (str.startsWith('[') && str.endsWith(']')) {
    const inner = str.slice(1, -1).trim();
    if (inner === '') return [];
    return splitFlow(inner).map(s => parseValue(s.trim()));
  }
  if (str.startsWith('{') && str.endsWith('}')) {
    const inner = str.slice(1, -1).trim();
    const obj = {};
    if (inner === '') return obj;
    for (const part of splitFlow(inner)) {
      const idx = part.indexOf(':');
      if (idx < 0) return str;
      obj[unquoteKey(part.slice(0, idx).trim())] = parseValue(part.slice(idx + 1).trim());
    }
    return obj;
  }
  const hash = str.indexOf(' #');
  if (hash > 0) return parseValue(str.slice(0, hash).trim());
  return str;
}

function splitFlow(inner) {
  const parts = [];
  let cur = '', q = null, depth = 0;
  for (const ch of inner) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts;
}

function isQuotedString(s) {
  return s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")));
}
function unquote(s) {
  if (s.startsWith('"')) { try { return JSON.parse(s); } catch { return s.slice(1, -1); } }
  return s.slice(1, -1).replace(/''/g, "'");
}
function unquoteKey(k) { return isQuotedString(k) ? unquote(k) : k; }

function findNextNonEmpty(lines, startIdx) {
  let i = startIdx;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t !== '' && !t.startsWith('#')) return i;
    i++;
  }
  return i;
}

// ---------------------------------------------------------------------------
// シリアライザ (parseYaml で読み戻せる範囲に限定)
// ---------------------------------------------------------------------------

function isScalar(v) { return v === null || ['string', 'number', 'boolean'].includes(typeof v); }

function scalarText(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  const needsQuote = s === '' || /^(true|false|null|~|\[\]|\{\})$/.test(s) || /^-?[0-9]+(\.[0-9]+)?$/.test(s)
    || /[:#\[\]{}]|^[-|>'"&*!%@`?]|^\s|\s$/.test(s) || s.includes('\n') || s.startsWith('- ');
  return needsQuote ? JSON.stringify(s) : s;
}

function stringifyYaml(value, indent = 0) {
  if (isScalar(value)) return scalarText(value);
  if (Array.isArray(value)) return value.length ? arrayLines(value, indent).join('\n') : '[]';
  const lines = objectLines(value, indent);
  return lines.length ? lines.join('\n') : '{}';
}

function objectLines(obj, indent) {
  const pad = ' '.repeat(indent);
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const key = scalarText(k) === k ? k : JSON.stringify(k);
    if (isScalar(v)) out.push(`${pad}${key}: ${scalarText(v)}`);
    else if (Array.isArray(v)) { if (!v.length) out.push(`${pad}${key}: []`); else { out.push(`${pad}${key}:`); out.push(...arrayLines(v, indent + 2)); } }
    else if (!Object.keys(v).length) out.push(`${pad}${key}: {}`);
    else { out.push(`${pad}${key}:`); out.push(...objectLines(v, indent + 2)); }
  }
  return out;
}

function arrayLines(arr, indent) {
  const pad = ' '.repeat(indent);
  const out = [];
  for (const v of arr) {
    if (isScalar(v)) { out.push(`${pad}- ${scalarText(v)}`); continue; }
    if (Array.isArray(v)) { out.push(`${pad}-`); out.push(...arrayLines(v, indent + 2)); continue; }
    const lines = objectLines(v, indent + 2);
    if (!lines.length) { out.push(`${pad}- {}`); continue; }
    out.push(`${pad}- ${lines[0].trimStart()}`);
    out.push(...lines.slice(1));
  }
  return out;
}

module.exports = { parseYaml, stringifyYaml, parseValue, parseNode, parseArray, findNextNonEmpty, isQuotedString, BLOCK_SCALAR_RE };
