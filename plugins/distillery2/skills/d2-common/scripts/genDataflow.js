#!/usr/bin/env node
'use strict';

/**
 * genDataflow.js [--check]
 *
 * 入出力の正本 (../references/dataflow.yaml) から DFD を Mermaid で描き、../references/dataflow.md に書く。
 *  - 全体図: 段階と、段階をまたいで受け渡すファイル (ある段階が書いた store を別の段階が読む)
 *  - 段階ごとの詳細図: 処理 (箱) と store (円筒)。読みは store → 処理、書きは 処理 → store
 *  - store の一覧: パス、git 管理、書き手、読み手
 * 決定論 (正本の並び順のまま)。`--check` は書かずに、古ければ exit 1。
 */

const fs = require('node:fs');
const path = require('node:path');
const D = require('./dataflow');

const OUT = path.join(__dirname, '..', 'references', 'dataflow.md');

const esc = s => String(s).replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;');
const nid = s => s.replace(/[^A-Za-z0-9]/g, '_');
const cell = s => String(s).replace(/\|/g, '\\|');

function stageOf(df, p) {
  return p.stage === 'uc' ? { id: 'uc', name: '④ 段階をまたぐ d2-run の作業' } : df.stages.find(s => s.id === p.stage);
}

function render(df) {
  const stores = new Map(df.stores.map(s => [s.id, s]));
  // 図に載せる処理: 親を持つ内訳 (phase ごとのスクリプト) は親に畳む。委譲だけの行は載せない
  const top = df.processes.filter(p => !p.parent && !p.delegated_to);
  // 図では子 (内訳のスクリプト) の読み書きを親に畳む
  const io = (p, key) => [...new Set([p, ...df.processes.filter(c => c.parent === p.id)].flatMap(x => x[key] || []))];
  const writers = id => df.processes.filter(p => (p.writes || []).includes(id)).map(p => p.id);
  const readers = id => df.processes.filter(p => (p.reads || []).includes(id)).map(p => p.id);
  const L = [];
  L.push('# distillery2 の処理と入出力 (DFD)');
  L.push('');
  L.push('> 生成物。手で直さない。正本は [dataflow.yaml](dataflow.yaml)、生成は `scripts/genDataflow.js`。');
  L.push('> 整合性は `tests/distillery2/integration/dataflow.test.js` が手順書と照合する。');
  L.push('');
  L.push('凡例: 箱 = 処理 (スキル・d2-run・スクリプト)、円筒 = ファイル (store)、矢印 = 読み (store → 処理) / 書き (処理 → store)。');
  L.push('`<run>` = `.distillery/runs/<slug>`。');
  L.push('');

  // ---- 全体図 ----
  // 段階 (箱) と、段階をまたいで受け渡すファイル (円筒)。同じ段階の中だけで使うファイルは詳細図に回す
  const stageList = [...df.stages, { id: 'uc', name: '④ 段階をまたぐ d2-run の作業' }];
  const sname = id => stageList.find(s => s.id === id).name;
  const cross = [];
  for (const s of df.stores) {
    const ws = [...new Set(top.filter(p => io(p, 'writes').includes(s.id)).map(p => stageOf(df, p).id))];
    const rs = [...new Set(top.filter(p => io(p, 'reads').includes(s.id)).map(p => stageOf(df, p).id))];
    const outs = rs.filter(r => !ws.includes(r));
    if (ws.length && outs.length) cross.push({ s, ws, rs: outs });
  }
  L.push('## 全体図 (段階と、段階をまたいで受け渡すファイル)');
  L.push('');
  L.push('```mermaid');
  L.push('flowchart LR');
  for (const st of stageList) L.push(`  ${nid('st_' + st.id)}["${esc(st.name)}"]`);
  for (const { s } of cross) L.push(`  ${nid('s_' + s.id)}[("${esc(s.name)}")]`);
  for (const { s, ws, rs } of cross) {
    for (const w of ws) L.push(`  ${nid('st_' + w)} --> ${nid('s_' + s.id)}`);
    for (const r of rs) L.push(`  ${nid('s_' + s.id)} --> ${nid('st_' + r)}`);
  }
  L.push('```');
  L.push('');
  L.push('| ファイル | 書く段階 | 読む段階 (書く段階以外) |');
  L.push('|---|---|---|');
  for (const { s, ws, rs } of cross) L.push(`| ${cell(s.name)} | ${ws.map(sname).join('、')} | ${rs.map(sname).join('、')} |`);
  L.push('');

  // ---- 段階ごとの詳細図 ----
  L.push('## 段階ごとの詳細');
  L.push('');
  for (const st of stageList) {
    const ps = top.filter(p => stageOf(df, p).id === st.id);
    if (!ps.length) continue;
    L.push(`### ${st.name}`);
    L.push('');
    L.push('```mermaid');
    L.push('flowchart LR');
    const used = new Set();
    for (const p of ps) for (const id of [...io(p, 'reads'), ...io(p, 'writes')]) used.add(id);
    for (const id of df.stores.map(s => s.id).filter(id => used.has(id))) {
      const s = stores.get(id);
      L.push(`  ${nid('s_' + id)}[("${esc(s.name)}<br/>${esc(s.path)}")]`);
    }
    for (const p of ps) {
      const who = p.skill ? `${p.skill}${p.mode ? ' mode=' + p.mode : ''}` : (p.actor || p.kind);
      L.push(`  ${nid('p_' + p.id)}["${esc(p.name)}<br/>${esc(who)}${p.parallel ? '<br/>(ティアごとに並列)' : ''}"]`);
    }
    for (const p of ps) {
      for (const id of io(p, 'reads')) L.push(`  ${nid('s_' + id)} --> ${nid('p_' + p.id)}`);
      for (const id of io(p, 'writes')) L.push(`  ${nid('p_' + p.id)} --> ${nid('s_' + id)}`);
    }
    L.push('```');
    L.push('');
    const subs = df.processes.filter(c => ps.some(p => c.parent === p.id));
    if (subs.length) {
      L.push('| 内訳 | 読む | 書く |');
      L.push('|---|---|---|');
      for (const c of subs) {
        const r = c.delegated_to ? `(${procName(df, c.delegated_to)} に委譲)` : (c.reads || []).map(id => stores.get(id).name).join('、') || '—';
        const w = c.delegated_to ? '—' : (c.writes || []).map(id => stores.get(id).name).join('、') || '—';
        L.push(`| ${c.name} | ${r} | ${w} |`);
      }
      L.push('');
    }
  }

  // ---- store の一覧 ----
  L.push('## ファイル (store) の一覧');
  L.push('');
  L.push('| ファイル | パス | 由来 | 書く処理 | 読む処理 |');
  L.push('|---|---|---|---|---|');
  const ORIGIN = { external: '外部入力', packaged: 'プラグイン同梱', produced: '生成' };
  for (const s of df.stores.filter(x => !x.scope_only)) {
    const origin = ORIGIN[s.origin] + (s.terminal ? ' (最終成果物)' : '');
    const w = writers(s.id).map(id => procName(df, id)).join('、') || '—';
    const r = readers(s.id).map(id => procName(df, id)).join('、') || '—';
    L.push(`| ${cell(s.name)} | \`${cell(s.path)}\` | ${origin} | ${cell(w)} | ${cell(r)} |`);
  }
  L.push('');
  return L.join('\n');
}

function procName(df, id) { const p = df.processes.find(x => x.id === id); return p ? p.name : id; }

function main(argv) {
  const text = render(D.load());
  if (argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== text) { console.error(`stale: ${path.relative(process.cwd(), OUT)} (node genDataflow.js で再生成する)`); return 1; }
    console.log('dataflow.md: up to date');
    return 0;
  }
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { render };
