#!/usr/bin/env node
/**
 * traceTree.js — トレース JSONL の行を「呼び出しの木」に組み立てる純関数群 (renderSequence / renderDataFlow / extractAsBuilt が使う)
 *
 * 行の形 (tracer.ts v2): {ts, ts_end?, seq, seq_end?, parent?, scenario, kind, name, meta}
 *   - seq    : 開始順の通し番号。行はファイルに完了順で並ぶので seq で並べ直す
 *   - seq_end: 完了した時点で次に振られる seq。兄弟の span の seq がこれより小さければ、2 つは並行に動いている
 *   - parent : 呼び出し元 span の seq。HTTP 越しは x-scenario-span ヘッダで運ばれる
 *   - meta.result  : 例外・reject なら error。db.query の error は、文が取り消されて何も読み書きしていない
 *   - meta.returned: call が値で返した結果の種類 (業務の拒否など)。戻りの線の名前に使う
 * seq の無い旧形式 (0.1.4 以前) はファイル順のまま、全行を根として扱う。
 *
 * 木の各ノード = {ev, kind, meta, seq, parent: Node|null, children: Node[], participant: {kind, label, tier, layer}}
 *   participant.kind: actor | tier | component | db | broker | external
 * 送信元 (caller) は最も近い祖先の participant。http.out の直下に http.in があれば、その http.in の送信元は
 * http.out の送信元 (画面の部品) になり、http.out 自身は描かない (1 本の矢印にまとめる)。
 *
 * npm 依存なし。
 */
'use strict';

const DEFAULT_ACTOR = 'シナリオ実行者';

/** コードポイント比較 (localeCompare は環境依存)。 */
function cmpStr(a, b) { a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }

function sqlVerb(sql) {
  const m = String(sql || '').trimStart().match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : 'QUERY';
}

const CTE_NAME_RE = /(?:\bwith\s+(?:recursive\s+)?|,\s*)["`]?([A-Za-z_][A-Za-z0-9_]*)["`]?\s*(?:\([^)]*\)\s*)?as\s+(?:(?:not\s+)?materialized\s+)?\(/gi;
const DML_TARGET_RE = /\b(?:insert\s+into|update|delete\s+from|merge\s+into)\s+(?:only\s+)?["`]?([A-Za-z_][A-Za-z0-9_."]*)/gi;

/**
 * WITH で始まる文の、表ごとの読み書き。WITH 以外は null (呼び出し側が先頭の動詞で分類する)。
 * WITH 句の中の INSERT / UPDATE / DELETE / MERGE の宛先は write、ほかは read。WITH 句の名前 (CTE) は表ではないので外す。
 * 先頭の動詞だけで読み取りと数えると、`WITH x AS (INSERT ...) INSERT ...` の書き込みが図と索引で Read になる (0.3.0 の実地確認)。
 * @returns {Array<{table:string, mode:'read'|'write'}>|null}
 */
function withTableModes(sql, tables) {
  if (sqlVerb(sql) !== 'WITH') return null;
  // 文字列とコメントの中の語 (例 'update rooms') を宛先や WITH 句の名前と読まないよう、先に除く
  const s = String(sql || '').replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, "''").replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const lower = (x) => String(x).replace(/"/g, '').toLowerCase();
  const ctes = new Set([...s.matchAll(CTE_NAME_RE)].map((m) => lower(m[1])));
  const written = new Set([...s.matchAll(DML_TARGET_RE)].map((m) => lower(m[1])));
  // 書き込みの宛先は WITH 句の名前と同じでも表として残す (宛先は必ず実表。同名の CTE があっても書き込みを落とさない)
  return (Array.isArray(tables) ? tables : []).filter((t) => !ctes.has(lower(t)) || written.has(lower(t)))
    .map((t) => ({ table: t, mode: written.has(lower(t)) ? 'write' : 'read' }));
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

function hostOf(url) {
  try { return new URL(String(url)).host || String(url); } catch { return String(url || 'external'); }
}

/** ノードの participant (図の参加者) を決める。 */
function participantOf(ev) {
  const meta = (ev && ev.meta) || {};
  switch (ev && ev.kind) {
    case 'http.in': return { kind: 'tier', label: String(meta.tier || ev.name || 'tier'), tier: meta.tier || ev.name || null, layer: meta.layer || null };
    case 'call': return { kind: 'component', label: String(meta.component || ev.name || 'component'), tier: meta.tier || null, layer: meta.layer || null };
    case 'db.query': return { kind: 'db', label: 'DB', tier: null, layer: null };
    case 'publish': return { kind: 'broker', label: 'Broker', tier: null, layer: null };
    case 'http.out': return { kind: 'external', label: hostOf(meta.url), tier: null, layer: null };
    default: return { kind: 'component', label: String((ev && ev.name) || 'unknown'), tier: meta.tier || null, layer: meta.layer || null };
  }
}

/**
 * 行の配列 → 木。
 * @param {Array<object>} lines
 * @returns {{roots: Node[], nodes: Node[], legacy: boolean}}
 */
function buildTree(lines) {
  const list = (Array.isArray(lines) ? lines : []).filter((l) => l && l.kind);
  const legacy = !list.some((l) => typeof l.seq === 'number');
  const nodes = list.map((ev, i) => ({
    ev, kind: ev.kind, meta: ev.meta || {}, seq: legacy ? i + 1 : ev.seq, parentSeq: legacy ? null : (ev.parent == null ? null : ev.parent),
    parent: null, children: [], participant: participantOf(ev),
  }));
  nodes.sort((a, b) => a.seq - b.seq);
  const bySeq = new Map(nodes.map((n) => [n.seq, n]));
  const roots = [];
  if (legacy) {
    // 旧形式は http.in を応答完了時に書いていたので、直前に並ぶ行 (DB クエリ等) はその要求の中で起きたもの。
    // 直前の http.in 以降にたまった行を、次の http.in の子にする
    let buffer = [];
    for (const n of nodes) {
      if (n.kind === 'http.in') { for (const c of buffer) { c.parent = n; n.children.push(c); } buffer = []; roots.push(n); }
      else buffer.push(n);
    }
    for (const c of buffer) roots.push(c);
    return { roots, nodes, legacy };
  }
  for (const n of nodes) {
    const p = n.parentSeq != null ? bySeq.get(n.parentSeq) : null;
    if (p && p !== n) { n.parent = p; p.children.push(n); } else roots.push(n);
  }
  for (const n of nodes) n.children.sort((a, b) => a.seq - b.seq);
  return { roots, nodes, legacy };
}

/** http.out の直下 (最初の子) が http.in なら、その http.in を返す (1 本の矢印にまとめる対象)。 */
function pairedHttpIn(node) {
  if (!node || node.kind !== 'http.out') return null;
  const first = node.children.find((c) => c.kind === 'http.in');
  return first || null;
}

/** ノードの送信元 participant。最も近い祖先の participant (http.out は透過)。無ければ actor。 */
function callerOf(node, actorLabel) {
  let p = node.parent;
  while (p) {
    if (p.kind === 'http.out') { p = p.parent; continue; }
    // http.in の直下の db.query / publish は、meta.component (発行元の部品) があればそれを送信元にする
    // (usecase / repository を traced() で包んでいない結線でも、部品名だけは図に出す)
    if (p.kind === 'http.in' && (node.kind === 'db.query' || node.kind === 'publish') && node.meta.component) {
      return { kind: 'component', label: String(node.meta.component), tier: node.meta.tier || p.participant.tier || null, layer: node.meta.layer || null };
    }
    return p.participant;
  }
  if ((node.kind === 'db.query' || node.kind === 'publish') && node.meta.component) {
    return { kind: 'component', label: String(node.meta.component), tier: node.meta.tier || null, layer: node.meta.layer || null };
  }
  return { kind: 'actor', label: actorLabel || DEFAULT_ACTOR, tier: null, layer: null };
}

/** 文が失敗したか。tracer は例外・reject を meta.result = 'error' で残す。失敗した文は取り消され、何も読み書きしていない。 */
function queryFailed(meta) {
  return Boolean(meta && meta.result === 'error');
}

/**
 * 兄弟の span (seq の昇順) を、並行に動いた組にまとめる。
 * 後の span の seq が、組のどれかの seq_end より小さければ、その span は前の span が終わる前に始まっている (同じ組)。
 * seq_end の無い行 (瞬間イベントや旧形式) は組を広げない。
 * @returns {Node[][]} 組の配列。要素が 1 つの組は並行でない
 */
function overlapGroups(siblings) {
  const groups = [];
  let cur = null;
  let end = null;
  for (const n of siblings) {
    if (cur && end != null && n.seq < end) cur.push(n);
    else { cur = [n]; groups.push(cur); end = null; }
    const e = n.ev && typeof n.ev.seq_end === 'number' ? n.ev.seq_end : null;
    if (e != null && (end == null || e > end)) end = e;
  }
  return groups;
}

/** 並行の組の 1 本の名前 (par / and の後ろに書く)。 */
function branchLabel(node) {
  const m = node.meta || {};
  switch (node.kind) {
    case 'call': return String(m.fn || node.ev.name || 'call');
    case 'http.in': return `${m.method || ''} ${m.path || ''}`.trim() || 'http';
    case 'http.out': { const p = pairedHttpIn(node); return p ? branchLabel(p) : (`${m.method || ''} ${m.url || ''}`.trim() || 'http'); }
    case 'db.query': return sqlVerb(m.sql);
    case 'publish': return String(m.message || node.ev.name || 'publish');
    default: return String(node.ev.name || node.kind);
  }
}

/**
 * 木を深さ優先で「描画イベント」の列に平らにする (renderSequence が矢印に変換する)。
 *   {type: 'request'|'response'|'leaf', node, from, to, label}
 *   {type: 'par'|'and', node, label} / {type: 'end'}   並行に動いた兄弟の組 (mermaid の par ブロック)
 */
function flatten(tree, actorLabel) {
  const out = [];
  const visitAll = (siblings) => {
    for (const group of overlapGroups(siblings)) {
      if (group.length === 1) { visit(group[0]); continue; }
      group.forEach((n, i) => { out.push({ type: i === 0 ? 'par' : 'and', node: n, label: branchLabel(n) }); visit(n); });
      out.push({ type: 'end' });
    }
  };
  const visit = (node) => {
    const paired = pairedHttpIn(node);
    if (paired) {
      // http.out → http.in は 1 本にまとめる。http.in 側の送信元は http.out の送信元
      const from = callerOf(node, actorLabel);
      const to = paired.participant;
      out.push({ type: 'request', node: paired, from, to, label: `${paired.meta.method || ''} ${paired.meta.path || ''}`.trim() });
      visitAll(paired.children);
      out.push({ type: 'response', node: paired, from: to, to: from, label: statusLabel(paired) });
      // http.out の他の子 (通常は無い) も描く
      visitAll(node.children.filter((c) => c !== paired));
      return;
    }
    const from = callerOf(node, actorLabel);
    const to = node.participant;
    switch (node.kind) {
      case 'http.in': {
        out.push({ type: 'request', node, from, to, label: `${node.meta.method || ''} ${node.meta.path || ''}`.trim() });
        visitAll(node.children);
        out.push({ type: 'response', node, from: to, to: from, label: statusLabel(node) });
        return;
      }
      case 'call': {
        const label = String(node.meta.fn || node.ev.name || '');
        // 値で返した結果の種類 (業務の拒否など) があれば、子が無くても戻りの線を描く
        const returned = node.meta.result !== 'error' && node.meta.returned ? String(node.meta.returned) : null;
        if (node.children.length || returned) {
          out.push({ type: 'request', node, from, to, label, activate: true });
          visitAll(node.children);
          out.push({ type: 'response', node, from: to, to: from, label: node.meta.result === 'error' ? 'error' : (returned || 'ok'), activate: true });
        } else out.push({ type: 'leaf', node, from, to, label });
        return;
      }
      case 'db.query': {
        const perTable = withTableModes(node.meta.sql, node.meta.tables);
        const tables = perTable ? perTable.map((x) => x.table) : Array.isArray(node.meta.tables) ? node.meta.tables : [];
        const failed = queryFailed(node.meta);
        out.push({ type: 'leaf', node, from, to, label: `${sqlVerb(node.meta.sql)}${tables.length ? ' ' + tables.join(', ') : ''}${failed ? ' (失敗)' : ''}`, db: true, verb: sqlVerb(node.meta.sql), tables, failed });
        visitAll(node.children);
        return;
      }
      case 'publish': {
        const chan = node.meta.channel ? ` [${node.meta.channel}]` : '';
        out.push({ type: 'leaf', node, from, to, label: `${node.meta.message || node.ev.name || ''}${chan}`, async: true });
        visitAll(node.children);
        return;
      }
      case 'http.out': {
        out.push({ type: 'request', node, from, to, label: `${node.meta.method || ''} ${node.meta.url || ''}`.trim() });
        visitAll(node.children);
        out.push({ type: 'response', node, from: to, to: from, label: statusLabel(node) });
        return;
      }
      default: {
        out.push({ type: 'leaf', node, from, to, label: String(node.ev.name || node.kind) });
        visitAll(node.children);
      }
    }
  };
  visitAll(tree.roots);
  return out;
}

function statusLabel(node) {
  const s = node.meta.status;
  if (s != null && s !== '') return String(s);
  return node.meta.result === 'error' ? 'error' : 'ok';
}

/** 木に現れたティアとレイヤ (計装の範囲)。{tiers: {<tier>: Set(layers)}} を配列化して返す。 */
function observedPlacements(tree) {
  const tiers = new Map();
  for (const n of tree.nodes) {
    const t = n.participant.tier || n.meta.tier;
    if (!t) continue;
    if (!tiers.has(t)) tiers.set(t, new Set());
    const layer = n.participant.layer || n.meta.layer;
    if (layer) tiers.get(t).add(layer);
  }
  return [...tiers.keys()].sort(cmpStr).map((t) => ({ tier: t, layers: [...tiers.get(t)].sort(cmpStr) }));
}

module.exports = { buildTree, flatten, callerOf, participantOf, pairedHttpIn, observedPlacements, parseTraceLines, sqlVerb, withTableModes, queryFailed, overlapGroups, cmpStr, DEFAULT_ACTOR };
