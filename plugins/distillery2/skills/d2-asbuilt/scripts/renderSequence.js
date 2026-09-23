#!/usr/bin/env node
/**
 * renderSequence.js — 1 シナリオのトレース (JSONL) を Mermaid の sequenceDiagram に変換する
 *
 * トレース 1 行 = {ts, scenario, kind, name, meta}
 *   kind: http.in | http.out | db.query | publish | call
 *   http.in  meta: {method, path, status, operationId?, tier?}   受信ティア = meta.tier || name
 *   http.out meta: {method, url, status, tier?}
 *   db.query meta: {sql, tables:[...], rows?, component?}
 *   publish  meta: {message, channel, component?}
 *   call     meta: {component, fn, tier?, args_summary?, duration_ms?}
 *
 * 変換規則 (プランの as-built 章):
 *   http.in  → 実行者->>ティア: METHOD path、ティア-->>実行者: status
 *   call     → ティア->>コンポーネント: fn
 *   db.query → コンポーネント->>DB: verb tables
 *   publish  → コンポーネント-)Broker: message
 *   http.out → ティア->>External: METHOD url、External-->>ティア: status
 * 連続する同一 db.query 行は (xN) にまとめる。1 図 60 行を超えたら切って注記する。
 *
 * 純関数 renderScenario(traceLines, opts) を公開。CLI は 1 トレースファイルを描画する。
 * npm 依存なし。
 */
'use strict';

const fs = require('node:fs');

const ACTOR = 'シナリオ実行者';
const DEFAULT_MAX_LINES = 60;

function sqlVerb(sql) {
  const m = String(sql || '').trimStart().match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : 'QUERY';
}

/** JSONL テキスト → トレース行の配列 (空行・不正行は無視)。 */
function parseTraceLines(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip malformed line */ }
  }
  return out;
}

function esc(v) {
  return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/;/g, ',').trim();
}

/**
 * @param {Array<object>} lines  パース済みトレース行
 * @param {{maxLines?:number, actor?:string}} opts
 * @returns {string} mermaid の sequenceDiagram (末尾改行なし)
 */
function renderScenario(lines, opts = {}) {
  const maxLines = opts.maxLines || DEFAULT_MAX_LINES;
  const actorLabel = opts.actor || ACTOR;
  const decls = [];
  const seen = new Map(); // label -> id
  const idFor = (label, isActor = false) => {
    const key = String(label);
    if (seen.has(key)) return seen.get(key);
    const id = 'p' + seen.size + '_' + key.replace(/[^A-Za-z0-9]/g, '_');
    seen.set(key, id);
    decls.push({ id, label: key, actor: isActor });
    return id;
  };
  const actorId = idFor(actorLabel, true);

  const body = []; // {text, db}
  let lastTier = null;
  let lastComponent = null;
  for (const ev of Array.isArray(lines) ? lines : []) {
    const meta = (ev && ev.meta) || {};
    switch (ev && ev.kind) {
      case 'http.in': {
        const tier = meta.tier || ev.name || 'tier';
        lastTier = tier;
        const t = idFor(tier);
        body.push({ text: `${actorId}->>${t}: ${esc(meta.method)} ${esc(meta.path)}`.trimEnd() });
        if (meta.status != null && meta.status !== '') body.push({ text: `${t}-->>${actorId}: ${esc(meta.status)}` });
        break;
      }
      case 'call': {
        const comp = meta.component || ev.name || 'component';
        const src = idFor(meta.tier || lastTier || actorLabel);
        const c = idFor(comp);
        lastComponent = comp;
        body.push({ text: `${src}->>${c}: ${esc(meta.fn || ev.name)}` });
        break;
      }
      case 'db.query': {
        const compLabel = meta.component || lastComponent || lastTier || ev.name || 'component';
        const src = idFor(compLabel);
        const db = idFor('DB');
        const tables = (Array.isArray(meta.tables) ? meta.tables : []).join(', ');
        body.push({ text: `${src}->>${db}: ${sqlVerb(meta.sql)}${tables ? ' ' + esc(tables) : ''}`, db: true });
        break;
      }
      case 'publish': {
        const compLabel = meta.component || lastComponent || lastTier || ev.name || 'component';
        const src = idFor(compLabel);
        const broker = idFor('Broker');
        const chan = meta.channel ? ` [${esc(meta.channel)}]` : '';
        body.push({ text: `${src}-)${broker}: ${esc(meta.message || ev.name)}${chan}` });
        break;
      }
      case 'http.out': {
        const src = idFor(meta.tier || lastTier || ev.name || 'tier');
        const ext = idFor('External');
        body.push({ text: `${src}->>${ext}: ${esc(meta.method)} ${esc(meta.url)}`.trimEnd() });
        if (meta.status != null && meta.status !== '') body.push({ text: `${ext}-->>${src}: ${esc(meta.status)}` });
        break;
      }
      default:
        break;
    }
  }

  // 連続する同一 db.query 行を (xN) にまとめる
  const collapsed = [];
  for (const entry of body) {
    const prev = collapsed[collapsed.length - 1];
    if (entry.db && prev && prev.db && prev.base === entry.text) {
      prev.count += 1;
      prev.text = `${prev.base} (x${prev.count})`;
      continue;
    }
    collapsed.push({ text: entry.text, base: entry.text, db: entry.db, count: 1 });
  }

  const total = collapsed.length;
  let shown = collapsed;
  let truncated = 0;
  if (total > maxLines) {
    shown = collapsed.slice(0, maxLines);
    truncated = total - maxLines;
  }

  const out = ['sequenceDiagram'];
  for (const d of decls) out.push(`    ${d.actor ? 'actor' : 'participant'} ${d.id} as ${d.label}`);
  for (const s of shown) out.push(`    ${s.text}`);
  if (truncated > 0) out.push(`    Note over ${actorId}: 残り ${truncated} 行を省略 (全 ${total} 行)`);
  return out.join('\n');
}

function main(argv) {
  const file = argv[0];
  if (!file) { console.error('Usage: renderSequence.js <trace.jsonl>'); return 2; }
  const lines = parseTraceLines(fs.readFileSync(file, 'utf8'));
  console.log(renderScenario(lines));
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { renderScenario, parseTraceLines, sqlVerb, ACTOR };
