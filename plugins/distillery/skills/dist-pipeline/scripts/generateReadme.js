#!/usr/bin/env node
/**
 * generateReadme.js — docs/README.md 自動生成スクリプト
 * Usage: node generateReadme.js [docs_root]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const docsRoot = process.argv[2] || './docs';
const outputPath = path.join(docsRoot, 'README.md');

// -- Helpers ----------------------------------------------------------------
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function readFile(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function readTsv(p) {
  try {
    const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
    if (lines.length < 2) return [];
    const h = lines[0].split('\t');
    return lines.slice(1).map(l => { const v = l.split('\t'); const o = {}; h.forEach((k, i) => { o[k] = (v[i] || '').replace(/^"|"$/g, ''); }); return o; });
  } catch { return []; }
}
function listEventDirs(dp) { const d = path.join(dp, 'events'); try { return fs.readdirSync(d).filter(e => fs.statSync(path.join(d, e)).isDirectory()).sort(); } catch { return []; } }
function dirExists(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function fileExists(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function countFiles(dir, ext) { try { let c = 0; const w = d => { for (const e of fs.readdirSync(d)) { const f = path.join(d, e); if (fs.statSync(f).isDirectory()) w(f); else if (e.endsWith(ext)) c++; } }; w(dir); return c; } catch { return 0; } }
function formatEventId(id) { const m = id.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_(.+)$/); return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]} ${m[7].replace(/_/g, ' ')}` : id; }
function rel(to) { return path.relative(path.dirname(outputPath), to); }
function lnk(label, fp) { return `[${label}](${rel(fp)})`; }
function yVal(t, k) { const m = t.match(new RegExp(`(?:^|\\n)\\s*${k}:\\s*["']?([^"'\\n]+?)["']?\\s*(?:\\n|$)`)); return m ? m[1].trim() : null; }
function yNested(t, p, c) { const m = t.match(new RegExp(`${p}:\\s*\\n\\s+${c}:\\s*["']?([^"'\\n]+?)["']?\\s*(?:\\n|$)`)); return m ? m[1].trim() : null; }
function yCnt(t, re) { return (t.match(re) || []).length; }

/** Extract mermaid blocks from md that follow a heading matching headingPattern */
function extractMermaidAfterHeading(md, headingPattern) {
  const results = [];
  const lines = md.split('\n');
  let inTarget = false, inMermaid = false, buf = [];
  for (const line of lines) {
    if (/^#{1,4}\s/.test(line)) {
      if (inMermaid) { results.push(buf.join('\n')); buf = []; inMermaid = false; }
      inTarget = headingPattern.test(line);
    }
    if (inTarget && line.trim() === '```mermaid') { inMermaid = true; buf = []; continue; }
    if (inMermaid && line.trim() === '```') { results.push(buf.join('\n')); buf = []; inMermaid = false; continue; }
    if (inMermaid) buf.push(line);
  }
  return results;
}

// -- Data -------------------------------------------------------------------
const overview = readJson(path.join(docsRoot, 'rdra/latest/システム概要.json'));
const actors = readTsv(path.join(docsRoot, 'rdra/latest/アクター.tsv'));
const extSys = readTsv(path.join(docsRoot, 'rdra/latest/外部システム.tsv'));
const bucRows = readTsv(path.join(docsRoot, 'rdra/latest/BUC.tsv'));
const info = readTsv(path.join(docsRoot, 'rdra/latest/情報.tsv'));
const states = readTsv(path.join(docsRoot, 'rdra/latest/状態.tsv'));
const conds = readTsv(path.join(docsRoot, 'rdra/latest/条件.tsv'));
const vars = readTsv(path.join(docsRoot, 'rdra/latest/バリエーション.tsv'));

const usdmYaml = readFile(path.join(docsRoot, 'usdm/latest/requirements.yaml'));
const nfrYaml = readFile(path.join(docsRoot, 'nfr/latest/nfr-grade.yaml'));
const archYaml = readFile(path.join(docsRoot, 'arch/latest/arch-design.yaml'));
const designYaml = readFile(path.join(docsRoot, 'design/latest/design-event.yaml'));
const specYaml = readFile(path.join(docsRoot, 'specs/latest/spec-event.yaml'));

const domains = [
  { id: 'usdm', label: 'USDM（要求分解）', dir: 'usdm' },
  { id: 'rdra', label: 'RDRA（要件定義）', dir: 'rdra' },
  { id: 'nfr', label: 'NFR（非機能要求）', dir: 'nfr' },
  { id: 'arch', label: 'Arch（アーキテクチャ）', dir: 'arch' },
  { id: 'infra', label: 'Infra（インフラ設計）', dir: 'infra' },
  { id: 'design', label: 'Design（デザイン）', dir: 'design' },
  { id: 'specs', label: 'Specs（詳細仕様）', dir: 'specs' },
];

// UC tree
const ucTree = new Map(), ucSet = new Set();
for (const r of bucRows) {
  const g = r['業務'] || '', b = r['BUC'] || '', u = r['UC'] || '';
  if (!g || !b || !u) continue;
  if (ucSet.has(`${g}::${b}::${u}`)) continue;
  ucSet.add(`${g}::${b}::${u}`);
  if (!ucTree.has(g)) ucTree.set(g, new Map());
  if (!ucTree.get(g).has(b)) ucTree.get(g).set(b, []);
  ucTree.get(g).get(b).push(u);
}

// Cross-cutting
const ccDir = path.join(docsRoot, 'specs/latest/_cross-cutting');
const ccFiles = [
  { sub: 'ux-ui/ux-design.md', label: 'UX デザイン仕様' },
  { sub: 'ux-ui/ui-design.md', label: 'UI デザイン仕様' },
  { sub: 'ux-ui/data-visualization.md', label: 'データ可視化仕様' },
  { sub: 'ux-ui/common-components.md', label: '共通コンポーネント設計' },
  { sub: 'api/openapi.yaml', label: 'OpenAPI 3.1' },
  { sub: 'api/asyncapi.yaml', label: 'AsyncAPI 3.0' },
  { sub: 'datastore/rdb-schema.yaml', label: 'RDB スキーマ' },
  { sub: 'datastore/kvs-schema.yaml', label: 'KVS スキーマ' },
  { sub: 'traceability-matrix.md', label: 'トレーサビリティマトリクス' },
].map(e => ({ ...e, full: path.join(ccDir, e.sub) })).filter(e => fileExists(e.full));

// Events
const allEvents = [];
for (const d of domains) for (const e of listEventDirs(path.join(docsRoot, d.dir))) allEvents.push({ domain: d.id, label: d.label, eventId: e, dir: d.dir });
allEvents.sort((a, b) => a.eventId.localeCompare(b.eventId));

// Arch: tiers, entities extraction
function extractTiers(yaml) {
  const tiers = [];
  const re = /- id: "?(tier-[^"\s]+)"?\s*\n\s+name: "?([^"\n]+)"?/g;
  let m; while ((m = re.exec(yaml))) tiers.push({ id: m[1], name: m[2] });
  return tiers;
}

function extractEntities(yaml) {
  const entities = [];
  const re = /- id: "?(E-\d+)"?\s*\n\s+name: "?([^"\n]+)"?/g;
  let m; while ((m = re.exec(yaml))) entities.push({ id: m[1], name: m[2] });
  return entities;
}

// ADR: decisions extraction across domains
// Scans known decision directories within each domain's latest event
function extractAllDecisions(docsRoot) {
  const allDecs = [];
  // Domain -> candidate decision directories (relative to event root)
  const domainDecPaths = {
    arch:   ['decisions'],
    infra:  ['docs/cloud-context/decisions/product'],
    design: ['decisions'],
    specs:  ['decisions'],
  };
  for (const [domain, subPaths] of Object.entries(domainDecPaths)) {
    const events = listEventDirs(path.join(docsRoot, domain));
    if (!events.length) continue;
    const seen = new Set();
    for (const ev of events) {
      const eventRoot = path.join(docsRoot, domain, 'events', ev);
      for (const sub of subPaths) {
        const decDir = path.join(eventRoot, sub);
        if (!dirExists(decDir)) continue;
        try {
          for (const f of fs.readdirSync(decDir).filter(f => f.endsWith('.yaml')).sort()) {
            const content = readFile(path.join(decDir, f));
            const title = yVal(content, 'title');
            const status = yVal(content, 'status');
            const artId = yVal(content, 'artifact_id') || f;
            if (title && !seen.has(artId)) {
              seen.add(artId);
              allDecs.push({ domain, file: f, title, status: status || 'unknown', fullPath: path.join(decDir, f) });
            }
          }
        } catch { /* */ }
      }
    }
  }
  return allDecs;
}

// Design: brand, portals extraction
function extractBrand(yaml) {
  const name = yNested(yaml, 'brand', 'name');
  const primary = (yaml.match(/primary:\s*\n\s+hex:\s*"?([^"\n]+)"?/) || [])[1];
  const secondary = (yaml.match(/secondary:\s*\n\s+hex:\s*"?([^"\n]+)"?/) || [])[1];
  const tone = yNested(yaml, 'voice', 'tone');
  return { name, primary, secondary, tone };
}
function extractPortals(yaml) {
  const portals = [];
  const blocks = yaml.split(/\n\s+- id: "?(user|owner|admin)"?/);
  for (let i = 1; i < blocks.length; i += 2) {
    const id = blocks[i];
    const block = blocks[i + 1] || '';
    const name = (block.match(/name:\s*"?([^"\n]+)"?/) || [])[1] || id;
    const actor = (block.match(/actor:\s*"?([^"\n]+)"?/) || [])[1] || '';
    const color = (block.match(/primary_color:\s*"?([^"\n]+)"?/) || [])[1] || '';
    portals.push({ id, name, actor, color });
  }
  return portals;
}

// -- Generate ---------------------------------------------------------------
const lines = [];
const L = (s = '') => lines.push(s);

// Header
L(`# ${overview ? overview.system_name : 'プロジェクト'}`);
L();
if (overview) { L(`> ${overview.description}`); L(); }
const actorNames = [...new Set(actors.map(a => a['アクター']).filter(Boolean))];
const last = allEvents.length ? allEvents[allEvents.length - 1] : null;
if (last) { L(`**最終更新**: ${formatEventId(last.eventId)} (${last.domain})`); L(); }

// == 成果物一覧 =============================================================
L('## 成果物一覧');
L();
L('| ドメイン | 最新 | イベント数 |');
L('|---------|------|-----------:|');
for (const d of domains) {
  const latest = path.join(docsRoot, d.dir, 'latest');
  const ev = listEventDirs(path.join(docsRoot, d.dir));
  let ll;
  if (dirExists(latest)) {
    ll = `[${d.dir}/latest/](${rel(latest)}/)`;
  } else if (ev.length > 0) {
    // Fallback: link to latest event dir (e.g. infra)
    const latestEvDir = path.join(docsRoot, d.dir, 'events', ev[ev.length - 1]);
    ll = `[${d.dir}/events/${ev[ev.length - 1]}/](${rel(latestEvDir)}/)`;
  } else {
    ll = '-';
  }
  L(`| [${d.label}](#${d.label.replace(/[（）]/g, '').replace(/\s+/g, '-').toLowerCase()}) | ${ll} | ${ev.length} |`);
}
L();

// == USDM =================================================================
L('## USDM（要求分解）');
L();
L('### 主要な成果物');
L();
for (const f of ['requirements.md', 'requirements.yaml']) { const p = path.join(docsRoot, 'usdm/latest', f); if (fileExists(p)) L(`- ${lnk(f, p)}`); }
L();
const reqCount = yCnt(usdmYaml, /^\s{2}- id: "?REQ-/gm);
const specCount = yCnt(usdmYaml, /^\s+- id: "?SPEC-/gm);
if (reqCount > 0) {
  L('| 項目 | 値 |');
  L('|------|-----|');
  L(`| 要求数 | ${reqCount} |`);
  L(`| 仕様数 | ${specCount} |`);
  L();
}

// == RDRA =================================================================
L('## RDRA（要件定義）');
L();

// Files
L('### 主要な成果物');
L();
const extNames = [...new Set(extSys.map(e => e['外部システム名'] || e['外部システム']).filter(Boolean))];
const rdraFiles = ['アクター.tsv','外部システム.tsv','情報.tsv','状態.tsv','条件.tsv','バリエーション.tsv','BUC.tsv','関連データ.txt','ZeroOne.txt','システム概要.json'];
for (const f of rdraFiles) { const p = path.join(docsRoot, 'rdra/latest', f); if (fileExists(p)) L(`- ${lnk(f, p)}`); }
L();

// Summary
const infoNames = [...new Set(info.map(r => r['情報名'] || r['情報']).filter(Boolean))];
const stateModels = [...new Set(states.map(r => r['状態モデル'] || r['モデル名']).filter(Boolean))];
const bucTotal = [...ucTree.values()].reduce((s, m) => s + m.size, 0);
L('| 項目 | 値 |');
L('|------|-----|');
L(`| アクター | ${actorNames.length} |`);
if (extNames.length) L(`| 外部システム | ${extNames.length} |`);
if (infoNames.length) L(`| 情報 | ${infoNames.length} |`);
if (stateModels.length) L(`| 状態モデル | ${stateModels.length} |`);
if (conds.length) L(`| 条件 | ${conds.length} |`);
if (vars.length) L(`| バリエーション | ${vars.length} |`);
L(`| 業務 | ${ucTree.size} |`);
L(`| BUC | ${bucTotal} |`);
L(`| UC | ${ucSet.size} |`);
L();

// RDRA Graph / Sheet
L('### 外部ツール連携');
L();
L('| ツール | データファイル | 手順 |');
L('|--------|-------------|------|');
const gf = path.join(docsRoot, 'rdra/latest/関連データ.txt');
const zf = path.join(docsRoot, 'rdra/latest/ZeroOne.txt');
if (fileExists(gf)) L(`| [RDRA Graph](https://vsa.co.jp/rdratool/graph/v0.94/) | ${lnk('関連データ.txt', gf)} | ファイル内容をコピーし、RDRA Graph に貼り付け |`);
if (fileExists(zf)) L(`| [RDRA Sheet](https://docs.google.com/spreadsheets/d/1h7J70l6DyXcuG0FKYqIpXXfdvsaqjdVFwc6jQXSh9fM/) | ${lnk('ZeroOne.txt', zf)} | ファイル内容をコピーし、テンプレートに貼り付け |`);
L();

// C4 System Context diagram
const sysName = overview ? overview.system_name : 'システム';
L('### システムコンテキスト図');
L();
L('```mermaid');
L('graph TB');
L(`  SYS["${sysName}"]`);
for (const a of actorNames) L(`  ${a.replace(/\s/g, '_')}(["${a}"]):::actor --> SYS`);
for (const e of extNames) L(`  SYS --> ${e.replace(/\s/g, '_')}(["${e}"]):::external`);
L('  classDef actor fill:#2563EB,color:#fff,stroke:none');
L('  classDef external fill:#6B7280,color:#fff,stroke:none');
L('```');
L();

// == NFR ==================================================================
L('## NFR（非機能要求）');
L();
L('### 主要な成果物');
L();
for (const f of ['nfr-grade.md', 'nfr-grade.yaml']) { const p = path.join(docsRoot, 'nfr/latest', f); if (fileExists(p)) L(`- ${lnk(f, p)}`); }
L();
const modelType = yNested(nfrYaml, 'model_system', 'type');
const nfrCat = yCnt(nfrYaml, /^\s{2}- id: "[A-F]"/gm);
const nfrImportant = yCnt(nfrYaml, /important: true/gm);
L('| 項目 | 値 |');
L('|------|-----|');
if (modelType) L(`| モデルシステム | ${modelType} |`);
if (nfrCat) L(`| カテゴリ | ${nfrCat} |`);
if (nfrImportant) L(`| 重要項目 | ${nfrImportant} |`);
L();

// == Arch =================================================================
L('## Arch（アーキテクチャ）');
L();
L('### 主要な成果物');
L();
for (const f of ['arch-design.md', 'arch-design.yaml', 'coverage-report.md']) { const p = path.join(docsRoot, 'arch/latest', f); if (fileExists(p)) L(`- ${lnk(f, p)}`); }
L();

const tiers = extractTiers(archYaml);
const entities = extractEntities(archYaml);
const langs = (archYaml.match(/languages:\s*\n((?:\s+- "?.+?"?\n)*)/)||['',''])[1].match(/"([^"]+)"/g);

L('| 項目 | 値 |');
L('|------|-----|');
if (langs) L(`| 言語 | ${langs.map(s=>s.replace(/"/g,'')).join(', ')} |`);
L(`| ティア | ${tiers.length} |`);
L(`| ポリシー | ${yCnt(archYaml, /id: "?SP-/gm)} |`);
L(`| ルール | ${yCnt(archYaml, /id: "?SR-/gm)} |`);
L(`| エンティティ | ${entities.length} |`);
L();

// Extract diagrams from arch-design.md
const archMdPath = path.join(docsRoot, 'arch/latest/arch-design.md');
const archMd = readFile(archMdPath);

// Container diagram (システム構成図)
const containerDiags = extractMermaidAfterHeading(archMd, /システム構成図/);
if (containerDiags.length) {
  L('### コンテナ図（システム構成）');
  L();
  L('```mermaid');
  L(containerDiags[0]);
  L('```');
  L();
}

// Component diagrams (レイヤー依存図)
const layerDiags = extractMermaidAfterHeading(archMd, /レイヤー依存図/);
if (layerDiags.length) {
  L('### コンポーネント図（レイヤー依存）');
  L();
  // Find tier names from "### xxx のレイヤー構成" headings preceding each "#### レイヤー依存図"
  const archLines = archMd.split('\n');
  let tierHeading = '', diagIdx = 0;
  for (const line of archLines) {
    if (/^###\s.*のレイヤー構成/.test(line)) tierHeading = line.replace(/^#+\s*/, '').replace(/\s*のレイヤー構成$/, '');
    if (/レイヤー依存図/.test(line) && diagIdx < layerDiags.length) {
      L(`**${tierHeading}**`);
      L();
      L('```mermaid');
      L(layerDiags[diagIdx]);
      L('```');
      L();
      diagIdx++;
    }
  }
}

// == Infra ================================================================
L('## Infra（インフラ設計）');
L();
L('### 主要な成果物');
L();
const infraEvents = listEventDirs(path.join(docsRoot, 'infra'));
const infraLatest = path.join(docsRoot, 'infra/latest');
let infraHas = false;
if (dirExists(infraLatest)) {
  try {
    const files = fs.readdirSync(infraLatest).filter(f => f.endsWith('.yaml') || f.endsWith('.md'));
    for (const f of files) { const p = path.join(infraLatest, f); if (fileExists(p)) L(`- ${lnk(f, p)}`); }
    if (files.length) { infraHas = true; L(); }
  } catch { /* */ }
}
if (!infraHas && infraEvents.length) {
  const latestEvDir = path.join(docsRoot, 'infra/events', infraEvents[infraEvents.length - 1]);
  L(`- ${lnk('最新イベント: ' + infraEvents[infraEvents.length - 1], latestEvDir)}`);
  const mclOut = path.join(latestEvDir, 'specs/product/output');
  if (dirExists(mclOut)) { try { for (const f of fs.readdirSync(mclOut).filter(f => f.endsWith('.yaml')).sort()) L(`  - ${lnk(f, path.join(mclOut, f))}`); } catch {} }
  const tf = path.join(latestEvDir, 'infra/product/aws/main.tf');
  if (fileExists(tf)) L(`  - ${lnk('main.tf', tf)}`);
  L();
}

// Infra architecture mermaid — extract workload overview
// Try latest/ first, then fall back to latest event dir.
// File may be named architecture.md or architecture-overview.md depending on MCL version.
{
  const candidates = [];
  if (dirExists(infraLatest)) {
    candidates.push(path.join(infraLatest, 'docs/cloud-context/generated-md/product/architecture-overview.md'));
    candidates.push(path.join(infraLatest, 'docs/cloud-context/generated-md/product/architecture.md'));
  }
  if (infraEvents.length) {
    const latestEvDir = path.join(docsRoot, 'infra/events', infraEvents[infraEvents.length - 1]);
    candidates.push(path.join(latestEvDir, 'docs/cloud-context/generated-md/product/architecture-overview.md'));
    candidates.push(path.join(latestEvDir, 'docs/cloud-context/generated-md/product/architecture.md'));
  }
  const infraArchMd = candidates.find(p => fileExists(p));
  if (infraArchMd) {
    const infraArchContent = readFile(infraArchMd);
    const workloadDiags = extractMermaidAfterHeading(infraArchContent, /ワークロード全体構成図/);
    if (workloadDiags.length) {
      L('### ワークロード全体構成図');
      L();
      L(`> 出典: ${lnk(path.basename(infraArchMd), infraArchMd)}`);
      L();
      L('```mermaid');
      L(workloadDiags[0]);
      L('```');
      L();
    }
  }
}


// == Design ===============================================================
L('## Design（デザイン）');
L();
L('### 主要な成果物');
L();
for (const f of ['design-event.md', 'design-event.yaml']) { const p = path.join(docsRoot, 'design/latest', f); if (fileExists(p)) L(`- ${lnk(f, p)}`); }
const assetsDir = path.join(docsRoot, 'design/latest/assets');
if (dirExists(assetsDir)) { const c = countFiles(assetsDir, '.svg'); if (c) L(`- ${lnk('assets/', assetsDir)} (SVG ${c} ファイル)`); }
L();

// Brand
const brand = extractBrand(designYaml);
if (brand.name) {
  L('### ブランド');
  L();
  L('| 項目 | 値 |');
  L('|------|-----|');
  L(`| 名称 | ${brand.name} |`);
  if (brand.primary) L(`| プライマリカラー | \`${brand.primary}\` |`);
  if (brand.secondary) L(`| セカンダリカラー | \`${brand.secondary}\` |`);
  if (brand.tone) L(`| トーン | ${brand.tone} |`);
  L();
}

// Portals
const portals = extractPortals(designYaml);
if (portals.length) {
  L('### ポータル一覧');
  L();
  L('| ポータル | アクター | カラー |');
  L('|---------|---------|--------|');
  for (const p of portals) L(`| ${p.name} | ${p.actor} | \`${p.color}\` |`);
  L();
}

// Storybook
const sbDir = path.join(docsRoot, 'design/latest/storybook-app');
if (dirExists(sbDir)) {
  L('### Storybook');
  L();
  L('```bash');
  L('cd docs/design/latest/storybook-app && npm run storybook');
  L('```');
  L();
  const storiesDir = path.join(sbDir, 'src/stories');
  if (dirExists(storiesDir)) { const c = countFiles(storiesDir, '.stories.tsx'); if (c) L(`Stories: ${c} ファイル`); L(); }
}

// == Specs ================================================================
L('## Specs（詳細仕様）');
L();
L('### 主要な成果物');
L();
for (const f of ['spec-event.md', 'spec-event.yaml']) { const p = path.join(docsRoot, 'specs/latest', f); if (fileExists(p)) L(`- ${lnk(f, p)}`); }
L();
const specTotalUcs = yVal(specYaml, 'total_ucs');
const specTotalApis = yVal(specYaml, 'total_apis');
const specTotalAsync = yVal(specYaml, 'total_async_events');
if (specTotalUcs) {
  L('| 項目 | 値 |');
  L('|------|-----|');
  L(`| UC | ${specTotalUcs} |`);
  if (specTotalApis && specTotalApis !== '0') L(`| API | ${specTotalApis} |`);
  if (specTotalAsync && specTotalAsync !== '0') L(`| 非同期イベント | ${specTotalAsync} |`);
  L();
}

// Cross-cutting FIRST
if (ccFiles.length) {
  L('### 横断設計');
  L();
  L('| 仕様 | ファイル |');
  L('|------|---------|');
  for (const c of ccFiles) L(`| ${c.label} | ${lnk(c.sub, c.full)} |`);
  L();
}

// UC tree
const specsLatest = path.join(docsRoot, 'specs/latest');
let total = 0;
for (const [gyomu, bucMap] of ucTree) {
  L(`### ${gyomu}`);
  L();
  for (const [buc, ucs] of bucMap) {
    L(`**${buc}**`);
    L();
    for (const uc of ucs) {
      total++;
      const sp = path.join(specsLatest, gyomu, buc, uc, 'spec.md');
      L(fileExists(sp) ? `- ${lnk(uc, sp)}` : `- ${uc}`);
    }
    L();
  }
}
if (total) { L(`> ${ucTree.size} 業務 / ${bucTotal} BUC / ${total} UC`); L(); }

// == ADR（設計判断記録） =====================================================
const domainLabels = { arch: 'Arch', infra: 'Infra', design: 'Design', specs: 'Specs' };
const allDecisions = extractAllDecisions(docsRoot);
if (allDecisions.length) {
  L('## ADRs（設計判断記録）');
  L();
  L('| # | ドメイン | 判断 | ステータス |');
  L('|---|---------|------|----------|');
  for (let i = 0; i < allDecisions.length; i++) {
    const d = allDecisions[i];
    L(`| ${i + 1} | ${domainLabels[d.domain] || d.domain} | ${lnk(d.title, d.fullPath)} | ${d.status} |`);
  }
  L();
}

// == イベント履歴 ==========================================================
L('## イベント履歴');
L();
L('| 日時 | ドメイン | イベントID |');
L('|------|---------|-----------|');
for (const ev of allEvents) {
  const evDir = path.join(docsRoot, ev.dir, 'events', ev.eventId);
  const evLnk = dirExists(evDir) ? lnk(ev.eventId, evDir) : ev.eventId;
  L(`| ${formatEventId(ev.eventId).split(' ').slice(0, 2).join(' ')} | ${ev.label} | ${evLnk} |`);
}
L();

// Footer
L('---');
L();
L('*このファイルは `generateReadme.js` により自動生成されています。手動編集しないでください。*');
L();

fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Generated: ${outputPath} (${lines.length} lines)`);
