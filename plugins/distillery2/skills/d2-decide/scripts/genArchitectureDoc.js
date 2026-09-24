#!/usr/bin/env node
/**
 * genArchitectureDoc.js (distillery2)
 *
 * 「決めたもの」の C4 図を docs/adr/architecture.md に決定論的に生成する。
 * ADR (ティア構成 ADR の tiers[] / datastore_owner / contexts) と、任意で
 * contracts/contracts.json (provider/consumers) と RDRA の アクター.tsv / 外部システム.tsv を入力にする。
 *
 * 図 (C4 モデルのレベル 1 / 2 を Mermaid の graph で描く。C4Context / C4Container 記法はレンダラで崩れて読みづらい (0.1.9 で廃止)):
 *   (a) システムコンテキスト図 (graph LR): アクター → システム → 外部システム
 *   (b) コンテナ図 (graph LR + subgraph): ティアを箱、契約を consumer→provider のラベル付き辺、datastore_owner を円筒で明示
 *   (c) コンテキストマップ図 (flowchart。任意): ADR front matter の contexts[] があるときだけ
 *
 * Usage:
 *   node genArchitectureDoc.js <adr-dir> [output-md] \
 *     [--contracts contracts/contracts.json] [--rdra docs/requirements/rdra] [requirements=<dir>]
 *
 * requirements=<dir> を渡すと basis: requirements@<sha> を front matter に付ける (genAdrIndex と同じ約束)。
 * 決定論: 同じ入力なら同じ出力 (壁時計を使わない)。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadAdrDir } = require('./validateAdr');
const { parseYaml } = require('../../../scripts/lib/yaml');
const basisLib = require('../../../scripts/lib/basis');

// --- 小道具 -----------------------------------------------------------------

function readTextIfExists(p) { return p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function readJsonIfExists(p) { const t = readTextIfExists(p); if (t == null) return null; try { return JSON.parse(t); } catch { return null; } }

/**
 * コードポイント (UTF-16 コード単位) での文字列比較。
 * localeCompare は実行環境の ICU ロケールで順序が変わり生成物が非決定的になるため、
 * 決定論を要する並び替えはすべてこの比較関数を使う。
 */
function cmpStr(a, b) { a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }

/** Mermaid flowchart の予約語 (ノード ID に使うと構文が壊れる)。 */
const MERMAID_RESERVED = new Set(['end', 'subgraph', 'graph', 'flowchart', 'style', 'class', 'classDef', 'click', 'linkStyle', 'direction', 'default']);

/** Mermaid のノード ID に使える識別子へ変換する。先頭が数字なら a_、予約語 (end 等) なら n_ を付ける。 */
function c4Id(s) {
  const id = String(s == null ? '' : s).replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z_]/.test(id)) return `a_${id}`;
  return MERMAID_RESERVED.has(id.toLowerCase()) ? `n_${id}` : id;
}

/**
 * 1 つの図の中で衝突しない ID 表。同じ元名には同じ ID、違う元名が同じ ID に潰れたら `_2`, `_3` … を付ける
 * (例: `end` と `n_end`、`a-b` と `a_b`、固定要素の `datastore` と同名のティア)。図ごとに作り、ノードと辺で同じ表を使う。
 */
function idMapper(reserved = []) {
  const byRaw = new Map();
  const taken = new Set(reserved); // 図の固定要素 (sys / datastore / ext_N) の ID を先に押さえる
  return (raw) => {
    const key = String(raw == null ? '' : raw);
    if (byRaw.has(key)) return byRaw.get(key);
    const base = c4Id(key);
    let id = base;
    for (let n = 2; taken.has(id); n += 1) id = `${base}_${n}`;
    byRaw.set(key, id);
    taken.add(id);
    return id;
  };
}
/** C4 のラベル (二重引用符で囲む) 用に無害化する。 */
function c4Label(s) { return String(s == null ? '' : s).replace(/"/g, "'").replace(/[\r\n]+/g, ' ').trim(); }

/** TSV を {header:[], rows:[{col:val}]} に読む (タブ区切り。空行は捨てる)。 */
function parseTsv(text) {
  const lines = String(text || '').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split('\t').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row = {};
    header.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
    return row;
  });
  return { header, rows };
}

// --- 入力の収集 -------------------------------------------------------------

/** tiers[] を非空で宣言する accepted ADR (ティア構成 ADR) を返す。 */
function findTiersAdr(adrs) {
  return adrs.find((a) => String(a.fm.status).toLowerCase() === 'accepted' && Array.isArray(a.fm.tiers) && a.fm.tiers.length > 0) || null;
}

/** すべての accepted ADR から contexts[] を集める (最初に見つかった非空のものを使う)。 */
function findContexts(adrs) {
  for (const a of adrs) {
    if (String(a.fm.status).toLowerCase() !== 'accepted') continue;
    if (Array.isArray(a.fm.contexts) && a.fm.contexts.length) return a.fm.contexts;
  }
  return [];
}

/** RDRA アクター.tsv → [{name, external:boolean}] (name 昇順)。 */
function readActors(rdraDir) {
  const t = readTextIfExists(path.join(rdraDir, 'アクター.tsv'));
  if (t == null) return [];
  const { header, rows } = parseTsv(t);
  const nameCol = header.includes('アクター') ? 'アクター' : header[1];
  const kindCol = header.includes('社内外') ? '社内外' : null;
  const out = rows.map((r) => ({ name: r[nameCol], external: kindCol ? /社外/.test(r[kindCol]) : false })).filter((a) => a.name);
  out.sort((a, b) => cmpStr(a.name, b.name));
  return out;
}

/** RDRA 外部システム.tsv → [name] (昇順)。 */
function readExternals(rdraDir) {
  const t = readTextIfExists(path.join(rdraDir, '外部システム.tsv'));
  if (t == null) return [];
  const { header, rows } = parseTsv(t);
  const nameCol = header.includes('外部システム') ? '外部システム' : header[1];
  const out = rows.map((r) => r[nameCol]).filter(Boolean);
  return [...new Set(out)].sort(cmpStr);
}

/** システム概要.json / use-cases.yaml からシステム名を得る。 */
function readSystemName(rdraDir, docsRoot, cwd) {
  const ov = readJsonIfExists(path.join(rdraDir, 'システム概要.json'));
  if (ov && ov.system_name) return ov.system_name;
  const uc = docsRoot ? parseYamlIfExists(path.resolve(cwd, docsRoot, 'requirements/use-cases.yaml')) : null;
  if (uc && uc.system_name) return uc.system_name;
  return 'システム';
}
function parseYamlIfExists(p) { const t = readTextIfExists(p); return t == null ? null : parseYaml(t); }

/** contracts.json → contracts[] (id 昇順)。 */
function readContracts(p) {
  const j = readJsonIfExists(p);
  const list = (j && Array.isArray(j.contracts)) ? j.contracts : [];
  return [...list].sort((a, b) => cmpStr(a.id, b.id));
}

// --- 図の生成 ---------------------------------------------------------------

const CLASS_DEFS = [
  'classDef actor fill:#2563EB,color:#fff,stroke:none',
  'classDef system fill:#1E3A8A,color:#fff,stroke:none',
  'classDef tier fill:#3B82F6,color:#fff,stroke:none',
  'classDef store fill:#0EA5E9,color:#fff,stroke:none',
  'classDef external fill:#6B7280,color:#fff,stroke:none',
];

/**
 * システムコンテキスト図 (C4 のレベル 1 を Mermaid の graph で描く。C4Context 記法はレンダラで読みづらいため使わない)。
 * アクターは丸端の箱、外部システムは灰色。社外のアクターは "(社外)" を添える。
 */
function renderContextDiagram(sysName, actors, externals) {
  const L = [];
  const actorAlias = (i) => `actor_${i + 1}`;
  const extAlias = (i) => `ext_${i + 1}`;
  L.push('```mermaid');
  L.push('graph LR');
  actors.forEach((a, i) => L.push(`  ${actorAlias(i)}(["${c4Label(a.name)}${a.external ? '<br/>(社外)' : ''}"]):::actor`));
  L.push(`  sys["${c4Label(sysName)}"]:::system`);
  externals.forEach((e, i) => L.push(`  ${extAlias(i)}["${c4Label(e)}"]:::external`));
  actors.forEach((a, i) => L.push(`  ${actorAlias(i)} -->|利用する| sys`));
  externals.forEach((e, i) => L.push(`  sys -->|連携する| ${extAlias(i)}`));
  for (const d of CLASS_DEFS) L.push(`  ${d}`);
  L.push('```');
  return L.join('\n');
}

const TIER_KIND_JA = {
  frontend: 'フロントエンド', backend: 'バックエンド', worker: 'ワーカー',
  'data-pipeline': 'データパイプライン', cli: 'CLI', 'mcp-server': 'MCP サーバー',
};

/**
 * コンテナ図 (C4 のレベル 2 を Mermaid の graph で描く)。システムを subgraph、ティアを箱 (kind / lang と役割)、
 * データストアを円筒、契約を consumer → provider のラベル付き辺にする。外部システムは subgraph の外。
 */
function renderContainerDiagram(sysName, tiers, datastoreOwner, contracts, externals) {
  const L = [];
  const sorted = [...tiers].sort((a, b) => cmpStr(a.id, b.id));
  const nid = idMapper(['sys', 'datastore', ...externals.map((_, i) => `ext_${i + 1}`)]);
  for (const t of sorted) nid(t.id); // ティアの順で ID を確定する (辺で同じ表を引く)
  L.push('```mermaid');
  L.push('graph LR');
  L.push(`  subgraph sys["${c4Label(sysName)}"]`);
  for (const t of sorted) {
    const tech = `${t.kind || '-'} / ${t.lang || '-'}`;
    const note = t.id === datastoreOwner ? '<br/>データストア所有 (migration)' : '';
    L.push(`    ${nid(t.id)}["${c4Label(t.id)}<br/>${c4Label(tech)}${note}"]:::tier`);
  }
  if (datastoreOwner) L.push('    datastore[("データストア<br/>RDB 等")]:::store');
  L.push('  end');
  externals.forEach((e, i) => L.push(`  ext_${i + 1}["${c4Label(e)}"]:::external`));
  // 契約: consumer → provider のラベル付き辺 (id / type)。利用側→提供側の向き
  for (const c of contracts) {
    if (!c.provider) continue;
    for (const consumer of [...(c.consumers || [])].sort(cmpStr)) {
      L.push(`  ${nid(consumer)} -->|"${c4Label(c.id)} (${c4Label(c.type)})"| ${nid(c.provider)}`); // 括弧を含むので引用する
    }
  }
  if (datastoreOwner) L.push(`  ${nid(datastoreOwner)} -->|所有・migration| datastore`);
  for (const d of CLASS_DEFS) L.push(`  ${d}`);
  L.push('```');
  return L.join('\n');
}

/** コンテキストマップ (任意)。contexts[] が無ければ null。 */
function renderContextMap(contexts) {
  if (!contexts.length) return null;
  const L = [];
  L.push('```mermaid');
  L.push('flowchart LR');
  const nid = idMapper();
  for (const c of [...contexts].sort((a, b) => cmpStr(a.id, b.id))) {
    const owner = c.owner_tier ? `<br/>(${c4Label(c.owner_tier)})` : '';
    L.push(`  ${nid(c.id)}["${c4Label(c.name || c.id)}${owner}"]`);
  }
  const edges = [];
  for (const c of contexts) {
    for (const r of (c.relations || [])) {
      if (!r || !r.to) continue;
      edges.push({ from: c.id, to: r.to, kind: r.kind || '' });
    }
  }
  edges.sort((a, b) => cmpStr(`${a.from}\u0000${a.to}\u0000${a.kind}`, `${b.from}\u0000${b.to}\u0000${b.kind}`));
  for (const e of edges) {
    const label = e.kind ? ` |${c4Label(e.kind)}|` : '';
    L.push(`  ${nid(e.from)} -->${label} ${nid(e.to)}`);
  }
  L.push('```');
  return L.join('\n');
}

// --- ドキュメント全体 -------------------------------------------------------

function renderArchitectureDoc(input) {
  const { sysName, tiers, datastoreOwner, contracts, actors, externals, contexts, basisLine } = input;
  const L = [];
  if (basisLine) L.push('---', basisLine, '---', '');
  L.push('# アーキテクチャ (決めたもの)', '');
  L.push('accepted な ADR とティア構成・契約・RDRA から決定論的に描いた構成図 (C4 モデルのレベル 1 / 2)。実装の実態は `docs/as-built/_system/dependency-graph.md` を見る。', '');

  L.push('## システムコンテキスト図', '');
  if (actors.length || externals.length) {
    L.push(renderContextDiagram(sysName, actors, externals), '');
  } else {
    L.push('アクター / 外部システムの情報 (RDRA) が無いため省略。', '');
  }

  L.push('## コンテナ図', '');
  if (tiers.length) {
    L.push(renderContainerDiagram(sysName, tiers, datastoreOwner, contracts, externals), '');
    if (!contracts.length) L.push('契約 (contracts.json) が無いため、契約の辺は描いていない (ティアのみ)。', '');
  } else {
    L.push('ティア構成 ADR (tiers[]) が無いため省略。', '');
  }

  const cmap = renderContextMap(contexts);
  if (cmap) { L.push('## コンテキストマップ', '', cmap, ''); }

  return L.join('\n').replace(/\n+$/, '\n');
}

// --- CLI --------------------------------------------------------------------

function parseArgs(argv) {
  const o = { cwd: process.cwd(), contracts: 'contracts/contracts.json', rdra: null, docsRoot: 'docs', dirs: {} };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--contracts') o.contracts = argv[++i];
    else if (a === '--rdra') o.rdra = argv[++i];
    else if (a === '--docs-root') o.docsRoot = argv[++i];
    else if (a === '--cwd') o.cwd = path.resolve(argv[++i]);
    else { const m = a.match(/^([A-Za-z0-9_-]+)=(.+)$/); if (m) o.dirs[m[1]] = m[2]; else rest.push(a); }
  }
  o.adrDir = rest[0];
  o.output = rest[1];
  return o;
}

function build(o) {
  const cwd = o.cwd;
  const adrDir = path.resolve(cwd, o.adrDir);
  const { adrs } = loadAdrDir(adrDir);
  const tiersAdr = findTiersAdr(adrs);
  const tiers = tiersAdr ? tiersAdr.fm.tiers : [];
  const datastoreOwner = tiersAdr ? tiersAdr.fm.datastore_owner : null;
  const contexts = findContexts(adrs);
  const contracts = readContracts(path.resolve(cwd, o.contracts));
  const rdraDir = o.rdra ? path.resolve(cwd, o.rdra) : path.resolve(cwd, o.docsRoot, 'requirements/rdra');
  const actors = readActors(rdraDir);
  const externals = readExternals(rdraDir);
  const sysName = readSystemName(rdraDir, o.docsRoot, cwd);
  let basisLine = null;
  if (Object.keys(o.dirs).length) basisLine = basisLib.headerLine(basisLib.stamp(o.dirs, cwd));
  return renderArchitectureDoc({ sysName, tiers, datastoreOwner, contracts, actors, externals, contexts, basisLine });
}

function main(argv) {
  const o = parseArgs(argv);
  if (!o.adrDir) { console.error('Usage: node genArchitectureDoc.js <adr-dir> [output-md] [--contracts <path>] [--rdra <dir>] [requirements=<dir>]'); return 2; }
  const adrDir = path.resolve(o.cwd, o.adrDir);
  if (!fs.existsSync(adrDir)) { console.error(`Directory not found: ${adrDir}`); return 2; }
  const output = o.output ? path.resolve(o.cwd, o.output) : path.join(adrDir, 'architecture.md');
  const md = build(o);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, md, 'utf8');
  console.log(`Generated: ${output}`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = {
  build, renderArchitectureDoc, renderContextDiagram, renderContainerDiagram, renderContextMap,
  parseTsv, readActors, readExternals, readContracts, findTiersAdr, findContexts, c4Id, c4Label,
};
