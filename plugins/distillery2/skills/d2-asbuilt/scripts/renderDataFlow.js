#!/usr/bin/env node
/**
 * renderDataFlow.js — トレースから「誰がどのデータをどこへ動かすか」のデータフロー図 (Mermaid flowchart) を作る
 *
 * シーケンス図が 1 シナリオの時間順なのに対し、データフロー図は UC の**全シナリオを合算**した静的な図。
 *   - 外部実体: UC のアクター ((名前))
 *   - 処理    : ティアごとの subgraph に、API operation と部品 (call の component)
 *   - データ  : テーブル [(name)]、発行メッセージ >name]、外部ホスト [[host]]
 *   - 辺      : 呼び出し -->、読み -. 読 .->、書き == 書 ==>、読み書き両方は == 読/書 ==>
 * すべて重複排除・ソート済み (決定論)。
 *
 * システム横断 (_system/data-flow.md) は traceability-index の UC × テーブルから CRUD 表と UC → テーブルの図を描く。
 * npm 依存なし。
 */
'use strict';

const { buildTree, callerOf, sqlVerb, cmpStr, DEFAULT_ACTOR } = require('./traceTree');

const READ = new Set(['SELECT', 'WITH', 'SHOW', 'EXPLAIN']);
const WRITE = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'UPSERT', 'REPLACE', 'TRUNCATE']);

function nodeKey(participant, node) {
  if (participant.kind === 'actor') return `actor:${participant.label}`;
  if (participant.kind === 'tier') {
    const op = node && node.meta && (node.meta.operationId || `${node.meta.method || ''} ${node.meta.path || ''}`.trim());
    return `op:${participant.tier}:${op || participant.label}`;
  }
  if (participant.kind === 'component') return `comp:${participant.tier || ''}:${participant.label}`;
  if (participant.kind === 'external') return `ext:${participant.label}`;
  return `${participant.kind}:${participant.label}`;
}

/**
 * 複数シナリオのトレース → {nodes: Map<key,{key,kind,label,tier}>, edges: Map<"from\0to", Set<mode>>}
 * @param {Array<{scenario:string, lines:Array<object>}>} traces
 * @param {{actor?:string}} opts
 */
function buildFlows(traces, opts = {}) {
  const actorLabel = opts.actor || DEFAULT_ACTOR;
  const nodes = new Map();
  const edges = new Map();
  const addNode = (key, kind, label, tier) => { if (!nodes.has(key)) nodes.set(key, { key, kind, label, tier: tier || null }); return key; };
  const addEdge = (from, to, mode) => { const k = `${from}\u0000${to}`; if (!edges.has(k)) edges.set(k, new Set()); edges.get(k).add(mode); };
  // 祖先の「処理ノード」のキー (http.out は透過、http.in は op、call は comp)。祖先が無ければアクター
  const sourceKey = (node) => {
    let p = node.parent;
    while (p && p.kind === 'http.out') p = p.parent;
    if (!p) return addNode(`actor:${actorLabel}`, 'actor', actorLabel, null);
    return nodeKeyFor(p);
  };
  const nodeKeyFor = (n) => {
    const p = n.participant;
    if (n.kind === 'http.in') {
      const op = n.meta.operationId || `${n.meta.method || ''} ${n.meta.path || ''}`.trim();
      const label = n.meta.operationId ? `${n.meta.operationId} (${n.meta.method || ''} ${n.meta.path || ''})`.replace(/\(\s*\)/, '').trim() : op;
      return addNode(nodeKey(p, n), 'op', label, p.tier);
    }
    if (n.kind === 'call') return addNode(nodeKey(p), 'comp', p.label, p.tier);
    if (n.kind === 'http.out') return addNode(nodeKey(p), 'ext', p.label, null);
    return addNode(nodeKey(p), p.kind, p.label, p.tier);
  };
  for (const tr of Array.isArray(traces) ? traces : []) {
    const tree = buildTree(tr.lines || []);
    for (const n of tree.nodes) {
      switch (n.kind) {
        case 'http.in': {
          addEdge(sourceKey(n), nodeKeyFor(n), 'call');
          break;
        }
        case 'call': {
          addEdge(sourceKey(n), nodeKeyFor(n), 'call');
          break;
        }
        case 'db.query': {
          const v = sqlVerb(n.meta.sql);
          const mode = READ.has(v) ? 'read' : WRITE.has(v) ? 'write' : null;
          if (!mode) break;
          const src = sourceKey(n);
          for (const t of Array.isArray(n.meta.tables) ? n.meta.tables : []) addEdge(src, addNode(`tbl:${t}`, 'store', String(t), null), mode);
          break;
        }
        case 'publish': {
          const m = String(n.meta.message || n.ev.name || '');
          if (m) addEdge(sourceKey(n), addNode(`msg:${m}`, 'message', m, null), 'publish');
          break;
        }
        case 'http.out': {
          if (n.children.some((c) => c.kind === 'http.in')) break; // 画面 → API は http.in 側で辺を引く
          addEdge(sourceKey(n), nodeKeyFor(n), 'call');
          break;
        }
        default: break;
      }
    }
  }
  return { nodes, edges };
}

/** ノード id: キーの昇順に n0, n1, … を振る (決定論。ラベルで読むので id は短くてよい)。 */
function idMap(keys) { const m = new Map(); for (const k of [...new Set(keys)].sort(cmpStr)) m.set(k, 'n' + m.size); return m; }

function shape(node) {
  const label = esc(node.label);
  switch (node.kind) {
    case 'actor': return `((${label}))`;
    case 'store': return `[(${label})]`;
    case 'message': return `>${label}]`;
    case 'ext': return `[[${label}]]`;
    default: return `[${label}]`;
  }
}
function esc(s) { return String(s == null ? '' : s).replace(/"/g, "'").replace(/[\[\]()]/g, (c) => ({ '[': '［', ']': '］', '(': '（', ')': '）' }[c])); }

function edgeText(modes) {
  const m = new Set(modes);
  const rw = m.has('read') && m.has('write') ? 'rw' : m.has('write') ? 'w' : m.has('read') ? 'r' : null;
  if (rw === 'rw') return '== 読/書 ==>';
  if (rw === 'w') return '== 書 ==>';
  if (rw === 'r') return '-. 読 .->';
  if (m.has('publish')) return '-- 発行 -->';
  return '-->';
}

/** flows → mermaid flowchart LR。 */
function renderFlowchart(flows) {
  const L = ['flowchart LR'];
  const nodes = [...flows.nodes.values()].sort((a, b) => cmpStr(a.key, b.key));
  const ids = idMap([...nodes.map((n) => n.key), ...nodes.filter((n) => n.tier && (n.kind === 'op' || n.kind === 'comp')).map((n) => 'tier:' + n.tier)]);
  const mid = (k) => ids.get(k);
  const byTier = new Map();
  for (const n of nodes) {
    if ((n.kind === 'op' || n.kind === 'comp') && n.tier) { if (!byTier.has(n.tier)) byTier.set(n.tier, []); byTier.get(n.tier).push(n); }
    else L.push(`    ${mid(n.key)}${shape(n)}`);
  }
  for (const tier of [...byTier.keys()].sort(cmpStr)) {
    L.push(`    subgraph ${mid('tier:' + tier)}["${esc(tier)}"]`);
    for (const n of byTier.get(tier)) L.push(`        ${mid(n.key)}${shape(n)}`);
    L.push('    end');
  }
  const edges = [...flows.edges.entries()].sort((a, b) => cmpStr(a[0], b[0]));
  for (const [k, modes] of edges) {
    const [from, to] = k.split('\u0000');
    L.push(`    ${mid(from)} ${edgeText(modes)} ${mid(to)}`);
  }
  return L.join('\n');
}

/**
 * システム横断: traceability-index の ucs[].tables_rw ({table: [modes]}) → CRUD 風の表と UC → テーブルの図。
 * @param {{ucs: Record<string, {uc:string, business:string, tables_rw?:Record<string,string[]>, tables?:string[]}>}} index
 */
function renderSystemDataFlow(index) {
  const slugs = Object.keys((index && index.ucs) || {}).sort(cmpStr);
  const tables = new Set();
  const cell = {};
  for (const slug of slugs) {
    const e = index.ucs[slug];
    const rw = e.tables_rw || Object.fromEntries((e.tables || []).map((t) => [t, ['?']]));
    for (const [t, modes] of Object.entries(rw)) {
      tables.add(t);
      const m = new Set(modes);
      cell[`${slug}\u0000${t}`] = m.has('read') && m.has('write') ? 'RW' : m.has('write') ? 'W' : m.has('read') ? 'R' : m.has('?') ? '●' : '-';
    }
  }
  const ids = idMap([...slugs.map((s) => 'uc:' + s), ...[...tables].map((t) => 'tbl:' + t)]);
  const mid = (k) => ids.get(k);
  const L = [];
  L.push('# データフロー (抽出)');
  L.push('');
  L.push('UC がどのテーブルを読み書きするか。R = 読む、W = 書く、RW = 両方。UC ごとの詳しい流れは各 as-built の「どう動くか」。');
  L.push('');
  if (!slugs.length || !tables.size) { L.push('トレースなし。'); L.push(''); return L.join('\n'); }
  L.push(`| テーブル | ${slugs.map((s) => index.ucs[s].uc || s).join(' | ')} |`);
  L.push(`|---|${slugs.map(() => '---').join('|')}|`);
  for (const t of [...tables].sort(cmpStr)) L.push(`| ${t} | ${slugs.map((s) => cell[`${s}\u0000${t}`] || '-').join(' | ')} |`);
  L.push('');
  L.push('```mermaid');
  L.push('flowchart LR');
  for (const s of slugs) L.push(`    ${mid('uc:' + s)}[${esc(index.ucs[s].uc || s)}]`);
  for (const t of [...tables].sort(cmpStr)) L.push(`    ${mid('tbl:' + t)}[(${esc(t)})]`);
  for (const s of slugs) for (const t of [...tables].sort(cmpStr)) {
    const c = cell[`${s}\u0000${t}`];
    if (!c || c === '-') continue;
    const modes = c === 'RW' ? ['read', 'write'] : c === 'W' ? ['write'] : c === 'R' ? ['read'] : [];
    L.push(`    ${mid('uc:' + s)} ${modes.length ? edgeText(modes) : '-->'} ${mid('tbl:' + t)}`);
  }
  L.push('```');
  L.push('');
  return L.join('\n');
}

module.exports = { buildFlows, renderFlowchart, renderSystemDataFlow, edgeText };
