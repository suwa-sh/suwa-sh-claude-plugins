#!/usr/bin/env node
'use strict';

/**
 * genDataflow.js [--check]
 *
 * 入出力の正本 (../references/dataflow.yaml) から DFD を Mermaid で描き、../references/dataflow.md に書く。
 * 1 枚の図が大きくならないように分ける:
 *  - 全体図 1: ① 〜 ④ の段階と、段階をまたいで受け渡すファイル群 (store_groups)。④ は 1 つの箱に畳む
 *  - 全体図 2・3: ④ の中の段階と、④ の中で受け渡すファイル群 (実装まで / 検証と as-built に分ける)
 *  - 処理ごとの図: 処理 (スキル・d2-run・スクリプト) 1 つにつき 1 枚。ファイルが多い処理はファイル群にまとめ、正確なパスは図の下の表に出す
 *  - ファイルの一覧: パス、由来、書く処理、読む処理
 * 決定論 (正本の並び順のまま)。`--check` は書かずに、古ければ exit 1。
 */

const fs = require('node:fs');
const path = require('node:path');
const D = require('./dataflow');

const OUT = path.join(__dirname, '..', 'references', 'dataflow.md');
/** 処理ごとの図で、ファイルを 1 つずつ描く上限。超えたらファイル群にまとめる */
const MAX_STORE_NODES = 8;

const esc = s => String(s).replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;');
const nid = s => s.replace(/[^A-Za-z0-9]/g, '_');
const cell = s => String(s).replace(/\|/g, '\\|');

const UC_STAGE = { id: 'uc', name: '④ 段階をまたぐ d2-run の作業' };
const UPSTREAM = ['requirements', 'decide', 'foundation'];

function render(df) {
  const stores = new Map(df.stores.map(s => [s.id, s]));
  const groups = new Map(df.store_groups.map(g => [g.id, g]));
  const procName = id => (df.processes.find(x => x.id === id) || { name: id }).name;
  const stageList = [...df.stages, UC_STAGE];
  const stageOf = p => stageList.find(s => s.id === p.stage);
  const children = p => df.processes.filter(c => c.parent === p.id);
  // 図の単位: 親を持たない処理 (委譲だけの行は除く)。親の読み書きは子の和を含めて扱う
  const top = df.processes.filter(p => !p.parent && !p.delegated_to);
  const io = (p, key) => [...new Set([p, ...children(p)].flatMap(x => x[key] || []))];
  const L = [];
  const mermaid = lines => { L.push('```mermaid', 'flowchart LR', ...lines, '```', ''); };

  L.push('# distillery2 の処理と入出力 (DFD)', '');
  L.push('> 生成物。手で直さない。正本は [dataflow.yaml](dataflow.yaml)、生成は `scripts/genDataflow.js`。');
  L.push('> 整合性は `tests/distillery2/integration/dataflow.test.js` が手順書と照合する。', '');
  L.push('凡例: 全体図は 箱 = 段階、矢印 = 受け渡し (ラベルはファイル群)。処理ごとの図は 箱 = 処理、円筒 = ファイル (またはファイル群)、矢印 = 読み (ファイル → 処理) / 書き (処理 → ファイル)。');
  L.push('`<run>` = `.distillery/runs/<slug>`。', '');
  L.push('## 目次', '');
  L.push('1. 全体図: ① 〜 ④');
  L.push('2. 全体図: ④ 実装まで (scenario 〜 integrate)');
  L.push('3. 全体図: ④ 検証と as-built');
  L.push('4. 処理ごとの図 (段階ごと。処理 1 つにつき 1 枚)');
  L.push('5. ファイルの一覧', '');

  // ---- 全体図 (段階の集合 × ファイル群) ----
  // stageKey: 処理 → 図の上での段階。ファイル群ごとに、書く段階と (それ以外で) 読む段階を結ぶ
  // 全体図では、最終成果物だけを書く処理 (文書の入口の更新) と何も書かない処理 (検査) の読みを描かない。
  // これらは既存のファイルを広く読むので、描くと段階の流れと関係の無い矢印が増える (処理ごとの図には載る)
  const feeds = x => x.kind === 'subagent' || (x.writes || []).some(id => !stores.get(id).terminal);
  // 全体図での読み: 親と子のうち、後段に渡すファイルを書くものの読みだけ
  const ovReads = p => [...new Set([p, ...children(p)].filter(feeds).flatMap(x => x.reads || []))];
  // readerOk: 読む側の段階を絞る (図を分けるとき)。省略時はすべて
  // 全体図: 段階を箱、受け渡しを矢印にする。矢印のラベルは受け渡すファイル群の名前。
  // 段階 w が書いたファイルを別の段階 r が読むとき w → r を 1 本引く (ファイル群を箱にすると矢印が倍になるため)
  // readerOk: 読む側の段階を絞る (図を分けるとき)。省略時はすべて
  function overview(title, note, stageKey, nodes, include, readerOk = () => true) {
    const ps = top.filter(include);
    const edges = new Map(); // 'w>r' -> Set(store id)
    for (const s of df.stores.filter(x => !x.scope_only)) {
      const ws = [...new Set(ps.filter(p => io(p, 'writes').includes(s.id)).map(stageKey))];
      const rs = [...new Set(ps.filter(p => ovReads(p).includes(s.id)).map(stageKey))].filter(readerOk);
      for (const w of ws) for (const r of rs) {
        if (w === r) continue;
        const key = `${w}>${r}`;
        if (!edges.has(key)) edges.set(key, new Set());
        edges.get(key).add(s.id);
      }
    }
    const order = id => nodes.findIndex(n => n.id === id);
    const list = [...edges].map(([key, ids]) => {
      const [w, r] = key.split('>');
      const sids = df.stores.map(s => s.id).filter(id => ids.has(id));
      return { w, r, sids, gs: df.store_groups.filter(g => sids.some(id => stores.get(id).group === g.id)) };
    })
      .sort((a, b) => order(a.w) - order(b.w) || order(a.r) - order(b.r));
    // 図には前向き (前の段階 → 後の段階) だけを描く。後の段階が同じファイルを書き戻す後ろ向きの受け渡し
    // (UC 一覧の tiers の書き戻しなど。次の UC や再実行で前の段階が読む) は表に分ける
    const forward = list.filter(e => order(e.w) < order(e.r));
    const backward = list.filter(e => order(e.w) > order(e.r));
    L.push(`## ${title}`, '', note, '');
    const linked = new Set(forward.flatMap(e => [e.w, e.r]));
    const lines = nodes.filter(n => linked.has(n.id)).map(n => `  ${nid('st_' + n.id)}["${esc(n.name)}"]`);
    for (const e of forward) lines.push(`  ${nid('st_' + e.w)} -->|"${esc(e.gs.map(g => g.name).join('・'))}"| ${nid('st_' + e.r)}`);
    mermaid(lines);
    const nameOf = id => nodes.find(n => n.id === id).name;
    const table = rows => {
      L.push('| 書く段階 | 読む段階 | 受け渡すファイル群 | 受け渡すファイル |', '|---|---|---|---|');
      for (const e of rows) {
        const members = e.gs.map(g => e.sids.filter(id => stores.get(id).group === g.id).map(id => stores.get(id).name).join('、')).join(' / ');
        L.push(`| ${nameOf(e.w)} | ${nameOf(e.r)} | ${cell(e.gs.map(g => g.name).join('、'))} | ${cell(members)} |`);
      }
      L.push('');
    };
    table(forward);
    if (backward.length) {
      L.push('後ろ向きの受け渡し (後の段階が書き戻し、次の UC や再実行で前の段階が読む。図には描かない):', '');
      table(backward);
    }
  }
  const UC_ALL = { id: 'uc-all', name: '④ UC の縦切り' };
  overview('全体図: ① 〜 ④', '④ の中の段階は 1 つの箱にまとめた (中は次の図)。',
    p => (UPSTREAM.includes(p.stage) ? p.stage : 'uc-all'),
    [...df.stages.filter(s => UPSTREAM.includes(s.id)), UC_ALL], () => true);
  const UC_STAGES = df.stages.filter(s => !UPSTREAM.includes(s.id));
  const inUc = p => !UPSTREAM.includes(p.stage) && p.stage !== 'uc';
  const CHECK = ['verify', 'asbuilt'];
  const ucNote = '① 〜 ③ から来るものは前の図。段階をまたぐ d2-run の作業 (ゲートの実行・as-built の抽出・配送など) はほぼ全部のファイル群に触れるので、この図から外して処理ごとの図に回した。';
  overview('全体図: ④ 実装まで (scenario 〜 integrate)', `④ の実装の段階どうしで受け渡すファイル群。${ucNote}`,
    p => p.stage, UC_STAGES, p => inUc(p) && !CHECK.includes(p.stage));
  overview('全体図: ④ 検証と as-built', `実装までの段階が書き、検証 (verify) と as-built の要約 (asbuilt) が読むファイル群。${ucNote}`,
    p => p.stage, UC_STAGES, inUc, r => CHECK.includes(r));

  // ---- 処理ごとの図 ----
  L.push('## 処理ごとの図', '');
  L.push(`ファイルが ${MAX_STORE_NODES} を超える処理は、図ではファイル群にまとめた。正確なパスは図の下の表にある。`, '');
  function processDiagram(p, heading) {
    const reads = p.reads || [];
    const writes = p.writes || [];
    const used = [...new Set([...reads, ...writes])];
    const who = p.skill ? `${p.skill}${p.mode ? ' mode=' + p.mode : ''}` : (p.scripts ? p.scripts.join(' / ') : (p.actor || p.kind));
    L.push(`${heading} ${p.name}`, '');
    if (!used.length) { L.push(`${who}。読み書きするファイルは無い。`, ''); return; }
    const grouped = used.length > MAX_STORE_NODES;
    const node = id => (grouped ? 'g_' + stores.get(id).group : 's_' + id);
    const lines = [`  ${nid('p_' + p.id)}["${esc(p.name)}<br/>${esc(who)}${p.parallel ? '<br/>(ティアごとに並列)' : ''}"]`];
    const seen = new Set();
    for (const id of used) {
      const n = node(id);
      if (seen.has(n)) continue;
      seen.add(n);
      if (grouped) {
        const g = groups.get(stores.get(id).group);
        const members = used.filter(x => stores.get(x).group === g.id).map(x => stores.get(x).name).join('・');
        lines.push(`  ${nid(n)}[("${esc(g.name)}<br/>${esc(members)}")]`);
      } else {
        const s = stores.get(id);
        lines.push(`  ${nid(n)}[("${esc(s.name)}<br/>${esc(s.path)}")]`);
      }
    }
    const edges = new Set();
    for (const id of reads) edges.add(`  ${nid(node(id))} --> ${nid('p_' + p.id)}`);
    for (const id of writes) edges.add(`  ${nid('p_' + p.id)} --> ${nid(node(id))}`);
    mermaid([...lines, ...edges]);
    const fmt = ids => ids.map(id => stores.get(id).outside_repo ? stores.get(id).name : `\`${cell(stores.get(id).path)}\``).join('<br>') || '—';
    L.push('| 読む | 書く |', '|---|---|', `| ${fmt(reads)} | ${fmt(writes)} |`, '');
  }
  for (const st of stageList) {
    const ps = top.filter(p => stageOf(p).id === st.id);
    if (!ps.length) continue;
    L.push(`### ${st.name}`, '');
    for (const p of ps) {
      const subs = children(p);
      if (p.kind === 'subagent' || !subs.length) {
        // サブエージェントは派遣の単位 (write-set) で 1 枚。内訳は表で示す
        processDiagram({ ...p, reads: io(p, 'reads'), writes: io(p, 'writes') }, '####');
        if (subs.length) {
          L.push('| 内訳 | 読む | 書く |', '|---|---|---|');
          for (const c of subs) {
            const r = c.delegated_to ? `(${procName(c.delegated_to)} に委譲)` : (c.reads || []).map(id => stores.get(id).name).join('、') || '—';
            const w = c.delegated_to ? '—' : (c.writes || []).map(id => stores.get(id).name).join('、') || '—';
            L.push(`| ${c.name} | ${r} | ${w} |`);
          }
          L.push('');
        }
      } else {
        // d2-run: 自身の直接作業と、回すスクリプトを 1 枚ずつ
        processDiagram(p, '####');
        for (const c of subs) processDiagram(c, '####');
      }
    }
  }

  // ---- ファイルの一覧 ----
  L.push('## ファイルの一覧', '');
  L.push('| ファイル | ファイル群 | パス | 由来 | 書く処理 | 読む処理 |', '|---|---|---|---|---|---|');
  const ORIGIN = { external: '外部入力', packaged: 'プラグイン同梱', produced: '生成' };
  for (const s of df.stores.filter(x => !x.scope_only)) {
    const origin = ORIGIN[s.origin] + (s.terminal ? ' (最終成果物)' : '');
    const w = df.processes.filter(p => (p.writes || []).includes(s.id)).map(p => p.name).join('、') || '—';
    const r = df.processes.filter(p => (p.reads || []).includes(s.id)).map(p => p.name).join('、') || '—';
    L.push(`| ${cell(s.name)} | ${cell(groups.get(s.group).name)} | \`${cell(s.path)}\` | ${origin} | ${cell(w)} | ${cell(r)} |`);
  }
  L.push('');
  return L.join('\n');
}

/** 生成した Markdown の各 Mermaid 図の箱と矢印の数 (図の大きさのテスト用) */
function diagramSizes(md) {
  const out = [];
  let head = null;
  for (const line of md.split('\n')) if (/^#{2,4} /.test(line)) { head = line; out.push({ head, nodes: 0, edges: 0, inDiagram: false }); } else if (out.length) {
    const cur = out[out.length - 1];
    if (line === '```mermaid') cur.inDiagram = true;
    else if (line === '```') cur.inDiagram = false;
    else if (cur.inDiagram && /-->/.test(line)) cur.edges++;
    else if (cur.inDiagram && /^\s+\w+\[/.test(line)) cur.nodes++;
  }
  return out.filter(x => x.nodes).map(({ head: h, nodes, edges }) => ({ head: h, nodes, edges }));
}

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

module.exports = { render, diagramSizes, MAX_STORE_NODES };
