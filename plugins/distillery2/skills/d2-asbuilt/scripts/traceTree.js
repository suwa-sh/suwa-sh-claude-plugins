#!/usr/bin/env node
/**
 * traceTree.js — トレース JSONL の行を「呼び出しの木」に組み立てる純関数群 (renderSequence / renderDataFlow / extractAsBuilt が使う)
 *
 * 行の形 (tracer.ts v2): {ts, ts_end?, seq, parent?, scenario, kind, name, meta}
 *   - seq   : 開始順の通し番号。行はファイルに完了順で並ぶので seq で並べ直す
 *   - parent: 呼び出し元 span の seq。HTTP 越しは x-scenario-span ヘッダで運ばれる
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

/**
 * 木を深さ優先で「描画イベント」の列に平らにする (renderSequence が矢印に変換する)。
 *   {type: 'request'|'response'|'leaf', node, from, to, label}
 */
function flatten(tree, actorLabel) {
  const out = [];
  const visit = (node) => {
    const paired = pairedHttpIn(node);
    if (paired) {
      // http.out → http.in は 1 本にまとめる。http.in 側の送信元は http.out の送信元
      const from = callerOf(node, actorLabel);
      const to = paired.participant;
      out.push({ type: 'request', node: paired, from, to, label: `${paired.meta.method || ''} ${paired.meta.path || ''}`.trim() });
      for (const c of paired.children) visit(c);
      out.push({ type: 'response', node: paired, from: to, to: from, label: statusLabel(paired) });
      // http.out の他の子 (通常は無い) も描く
      for (const c of node.children) if (c !== paired) visit(c);
      return;
    }
    const from = callerOf(node, actorLabel);
    const to = node.participant;
    switch (node.kind) {
      case 'http.in': {
        out.push({ type: 'request', node, from, to, label: `${node.meta.method || ''} ${node.meta.path || ''}`.trim() });
        for (const c of node.children) visit(c);
        out.push({ type: 'response', node, from: to, to: from, label: statusLabel(node) });
        return;
      }
      case 'call': {
        const label = String(node.meta.fn || node.ev.name || '');
        if (node.children.length) {
          out.push({ type: 'request', node, from, to, label, activate: true });
          for (const c of node.children) visit(c);
          out.push({ type: 'response', node, from: to, to: from, label: node.meta.result === 'error' ? 'error' : 'ok', activate: true });
        } else out.push({ type: 'leaf', node, from, to, label });
        return;
      }
      case 'db.query': {
        const tables = Array.isArray(node.meta.tables) ? node.meta.tables : [];
        out.push({ type: 'leaf', node, from, to, label: `${sqlVerb(node.meta.sql)}${tables.length ? ' ' + tables.join(', ') : ''}`, db: true, verb: sqlVerb(node.meta.sql), tables });
        for (const c of node.children) visit(c);
        return;
      }
      case 'publish': {
        const chan = node.meta.channel ? ` [${node.meta.channel}]` : '';
        out.push({ type: 'leaf', node, from, to, label: `${node.meta.message || node.ev.name || ''}${chan}`, async: true });
        for (const c of node.children) visit(c);
        return;
      }
      case 'http.out': {
        out.push({ type: 'request', node, from, to, label: `${node.meta.method || ''} ${node.meta.url || ''}`.trim() });
        for (const c of node.children) visit(c);
        out.push({ type: 'response', node, from: to, to: from, label: statusLabel(node) });
        return;
      }
      default: {
        out.push({ type: 'leaf', node, from, to, label: String(node.ev.name || node.kind) });
        for (const c of node.children) visit(c);
      }
    }
  };
  for (const r of tree.roots) visit(r);
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

module.exports = { buildTree, flatten, callerOf, participantOf, pairedHttpIn, observedPlacements, parseTraceLines, sqlVerb, cmpStr, DEFAULT_ACTOR };
