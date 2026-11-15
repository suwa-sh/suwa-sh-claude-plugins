#!/usr/bin/env node
/**
 * renderSequence.js — 1 シナリオのトレース (JSONL) を Mermaid の sequenceDiagram に変換する
 *
 * 入力の形と木の組み立ては traceTree.js。ここは木を矢印に写す。
 *
 * 描き方:
 *   - 参加者は読める名前 (actor は UC のアクター名、ティアはティア id、部品は component 名、DB / Broker / 外部ホスト)。
 *     id は p0, p1, … (ラベルで読む)。ティアが 2 つ以上あるときはティアごとに box で囲む
 *   - http.in  : 送信元->>ティア: METHOD path … ティア-->>送信元: status
 *   - call     : 送信元->>部品: fn (子があれば activate して戻る。無ければ 1 本)。戻りの線の名前は、例外なら error、
 *                値で返した結果の種類 (meta.returned。業務の拒否など) があればその名前、どちらでもなければ ok
 *   - db.query : 部品->>DB: VERB tables。連続する同一行は (xN)、連続する SELECT は 1 本にまとめてテーブルを列挙。
 *                失敗した文 (meta.result が error) は名前の後ろに (失敗) を付ける
 *   - 並行     : 同じ親の下で並行に動いた呼び出し (seq_end で判定) は par / and / end で囲む
 *   - publish  : 部品-)Broker: message [channel]
 *   - http.out : 直下が http.in なら 1 本の矢印にまとめる (画面 → API)。外部なら 送信元->>host
 *   1 図 60 行を超えたら切って注記する。
 *
 * 純関数 renderScenario(traceLines, opts) を公開。CLI は 1 トレースファイルを描画する。npm 依存なし。
 */
'use strict';

const fs = require('node:fs');
const { buildTree, flatten, parseTraceLines, sqlVerb, withTableModes, queryFailed, cmpStr, DEFAULT_ACTOR } = require('./traceTree');

const ACTOR = DEFAULT_ACTOR;
const DEFAULT_MAX_LINES = 60;

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
  const tree = buildTree(lines);
  const events = flatten(tree, actorLabel);

  // 参加者: 初出順。ラベルが同じなら同じ参加者
  const decls = [];
  const seen = new Map(); // label -> decl
  const idFor = (p) => {
    const key = String(p.label);
    if (seen.has(key)) return seen.get(key).id;
    const d = { id: 'p' + seen.size, label: key, actor: p.kind === 'actor', tier: p.tier || null };
    seen.set(key, d);
    decls.push(d);
    return d.id;
  };
  idFor({ kind: 'actor', label: actorLabel });

  // 矢印と、並行の組の区切り (par / and / end)
  const body = [];
  for (const e of events) {
    if (e.type === 'par' || e.type === 'and') { body.push({ text: `${e.type} ${esc(e.label)}`, block: e.type }); continue; }
    if (e.type === 'end') { body.push({ text: 'end', block: 'end' }); continue; }
    const from = idFor(e.from);
    const to = idFor(e.to);
    if (e.type === 'request') body.push({ text: `${from}->>${e.activate ? '+' : ''}${to}: ${esc(e.label)}` });
    else if (e.type === 'response') body.push({ text: `${from}-->>${e.activate ? '-' : ''}${to}: ${esc(e.label)}` });
    else if (e.async) body.push({ text: `${from}-)${to}: ${esc(e.label)}` });
    else if (e.db) body.push({ text: `${from}->>${to}: ${esc(e.label)}`, db: true, from, to, verb: e.verb, tables: e.tables.slice(), failed: Boolean(e.failed) });
    else body.push({ text: `${from}->>${to}: ${esc(e.label)}` });
  }

  // 連続する同一 db.query 行は (xN)、連続する SELECT (同じ送信元) は 1 本にまとめる (失敗した文は成功した文とまとめない)
  const collapsed = [];
  for (const entry of body) {
    const prev = collapsed[collapsed.length - 1];
    if (entry.db && prev && prev.db && prev.from === entry.from && prev.to === entry.to) {
      if (prev.base === entry.text) { prev.count += 1; prev.text = `${prev.base} (x${prev.count})`; continue; }
      if (prev.verb === 'SELECT' && entry.verb === 'SELECT' && prev.count === 1 && !prev.failed && !entry.failed) {
        prev.tables = [...new Set([...prev.tables, ...entry.tables])];
        prev.base = `${prev.from}->>${prev.to}: SELECT ${prev.tables.join(', ')}`;
        prev.text = prev.base;
        continue;
      }
    }
    collapsed.push({ ...entry, base: entry.text, count: 1 });
  }

  const total = collapsed.length;
  let shown = collapsed;
  let truncated = 0;
  if (total > maxLines) {
    shown = collapsed.slice(0, maxLines);
    // 中身の無い par / and で終わらせない (切った位置が区切りの直後なら、その区切りも落とす)
    while (shown.length && (shown[shown.length - 1].block === 'par' || shown[shown.length - 1].block === 'and')) shown.pop();
    truncated = total - shown.length;
  }

  const out = ['sequenceDiagram'];
  // ティアが 2 つ以上あれば box で囲む (ティア無しの参加者は素のまま)
  const tiers = [...new Set(decls.map((d) => d.tier).filter(Boolean))];
  const declLine = (d) => `    ${d.actor ? 'actor' : 'participant'} ${d.id} as ${esc(d.label)}`;
  if (tiers.length >= 2) {
    const emitted = new Set();
    for (const d of decls) {
      if (emitted.has(d.id)) continue;
      if (!d.tier) { out.push(declLine(d)); emitted.add(d.id); continue; }
      out.push(`    box transparent ${esc(d.tier)}`);
      for (const x of decls) if (x.tier === d.tier && !emitted.has(x.id)) { out.push(`    ${declLine(x)}`); emitted.add(x.id); }
      out.push('    end');
    }
  } else for (const d of decls) out.push(declLine(d));
  // par の中は 1 段下げる。par / and / end は外側の段に置く
  let depth = 0;
  for (const s of shown) {
    if (s.block === 'end') depth -= 1;
    const level = s.block === 'and' ? depth - 1 : depth;
    out.push(`${'    '.repeat(level + 1)}${s.text}`);
    if (s.block === 'par') depth += 1;
  }
  // 途中で切ったときは、開いたままの par を閉じる (閉じないと図が描けない)
  for (; depth > 0; depth -= 1) out.push(`${'    '.repeat(depth)}end`);
  if (truncated > 0) out.push(`    Note over p0: 残り ${truncated} 行を省略 (全 ${total} 行)`);
  return out.join('\n');
}

/**
 * 正常系 (本文に載せる 1 本) を選ぶ。HTTP の応答が 2xx のシナリオのうち行数が最も多いもの。
 * 無ければ行数最多。同数なら名前順。決定論。
 * @param {Array<{scenario:string, lines:Array<object>}>} traces
 */
function pickHappyPath(traces) {
  const list = (Array.isArray(traces) ? traces : []).filter((t) => t && Array.isArray(t.lines) && t.lines.length);
  if (!list.length) return null;
  const score = (t) => {
    const ok = t.lines.some((l) => l.kind === 'http.in' && Number(l.meta && l.meta.status) >= 200 && Number(l.meta && l.meta.status) < 300);
    return { ok: ok ? 1 : 0, n: t.lines.length };
  };
  return list.slice().sort((a, b) => {
    const sa = score(a), sb = score(b);
    return (sb.ok - sa.ok) || (sb.n - sa.n) || cmpStr(a.scenario, b.scenario);
  })[0];
}

/** シナリオの結果の要約 (分岐の表用): {status, reads, writes, messages}。失敗した文 (取り消された文) の表は読み書きに数えない。 */
function summarizeScenario(lines) {
  const tree = buildTree(lines);
  const statuses = [];
  const reads = new Set(); const writes = new Set(); const messages = new Set();
  for (const n of tree.nodes) {
    if (n.kind === 'http.in' && n.meta.status != null) statuses.push(String(n.meta.status));
    if (n.kind === 'db.query' && !queryFailed(n.meta)) {
      const v = sqlVerb(n.meta.sql);
      const perTable = withTableModes(n.meta.sql, n.meta.tables);
      if (perTable) { for (const x of perTable) (x.mode === 'write' ? writes : reads).add(x.table); continue; }
      const tables = Array.isArray(n.meta.tables) ? n.meta.tables : [];
      for (const t of tables) { if (v === 'SELECT') reads.add(t); else if (['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'UPSERT'].includes(v)) writes.add(t); }
    }
    if (n.kind === 'publish' && n.meta.message) messages.add(String(n.meta.message));
  }
  return { status: statuses.join(' → ') || '-', reads: [...reads].sort(cmpStr), writes: [...writes].sort(cmpStr), messages: [...messages].sort(cmpStr) };
}

function main(argv) {
  const file = argv[0];
  if (!file) { console.error('Usage: renderSequence.js <trace.jsonl> [--actor <name>]'); return 2; }
  const actor = argv[1] === '--actor' ? argv[2] : undefined;
  const lines = parseTraceLines(fs.readFileSync(file, 'utf8'));
  console.log(renderScenario(lines, { actor }));
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { renderScenario, pickHappyPath, summarizeScenario, parseTraceLines, sqlVerb, ACTOR };
