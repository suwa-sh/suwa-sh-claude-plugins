#!/usr/bin/env node
'use strict';

/**
 * genDataflow.js [--check]
 *
 * 入出力の正本 (../references/dataflow.yaml) から DFD を Mermaid で描き、../references/dataflow.md に書く。
 * 1 枚の図が大きくならないように分ける:
 *  - 全体図 1: ① 〜 ④ と還流の段階と、段階をまたいで受け渡すファイル群 (store_groups)。④ は 1 つの箱に畳む。還流は UC の外の段階 (0.1.27)
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
/** 図 1 枚の上限 (dataflow.test.js の (f2) と同じ値)。サブエージェントの図がこれを超えたら内訳ごとに描く */
const MAX_DIAGRAM_NODES = 9;
const MAX_DIAGRAM_EDGES = 12;

const esc = s => String(s).replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;');
const nid = s => s.replace(/[^A-Za-z0-9]/g, '_');
const cell = s => String(s).replace(/\|/g, '\\|');

const UC_STAGE = { id: 'uc', name: '④ 段階をまたぐ d2-run の作業' };
const UPSTREAM = ['requirements', 'decide', 'foundation'];
// UC の外の段階 (0.1.27: 還流は溜まった課題をまとめて直す独立した段階)。全体図 1 では ④ と並ぶ箱、④ の中の図には入れない
const OUTSIDE_UC = ['feedback'];

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
  L.push('1. 全体図: ① 〜 ④ と還流');
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
  // 全体図: 段階を箱、受け渡しを矢印にする。矢印のラベルは受け渡すファイル群の名前。
  // 段階 w が書いたファイルを別の段階 r が読むとき w → r を 1 本引く (ファイル群を箱にすると矢印が倍になるため)
  // readerOk: 図 (前向き) に描く読む側の段階を絞る (図を分けるとき)。backwardOk: 後ろ向きの表に載せる読む側の段階。省略時はどちらもすべて
  function overview(title, note, stageKey, nodes, include, readerOk = () => true, backwardOk = () => true) {
    const ps = top.filter(include);
    const edges = new Map(); // 'w>r' -> Set(store id)
    for (const s of df.stores.filter(x => !x.scope_only)) {
      const ws = [...new Set(ps.filter(p => io(p, 'writes').includes(s.id)).map(stageKey))];
      const rs = [...new Set(ps.filter(p => ovReads(p).includes(s.id)).map(stageKey))];
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
    const forward = list.filter(e => order(e.w) < order(e.r) && readerOk(e.r));
    const backward = list.filter(e => order(e.w) > order(e.r) && backwardOk(e.r));
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
  overview('全体図: ① 〜 ④ と還流', '④ の中の段階は 1 つの箱にまとめた (中は次の図)。還流は UC の外の段階で、次の UC の前に溜まった課題ファイルをまとめて直す。',
    p => (UPSTREAM.includes(p.stage) || OUTSIDE_UC.includes(p.stage) ? p.stage : 'uc-all'),
    [...df.stages.filter(s => UPSTREAM.includes(s.id)), UC_ALL, ...df.stages.filter(s => OUTSIDE_UC.includes(s.id))], () => true);
  const UC_STAGES = df.stages.filter(s => !UPSTREAM.includes(s.id) && !OUTSIDE_UC.includes(s.id));
  const inUc = p => !UPSTREAM.includes(p.stage) && !OUTSIDE_UC.includes(p.stage) && p.stage !== 'uc';
  const CHECK = ['verify', 'asbuilt'];
  const ucNote = '① 〜 ③ から来るものは前の図。段階をまたぐ d2-run の作業 (ゲートの実行・as-built の抽出・配送など) はほぼ全部のファイル群に触れるので、この図から外して処理ごとの図に回した。';
  // ④ の後ろ向きの受け渡し (integrate → scaffold、verify の指摘 → tier の差し戻しなど) は、④ の段階すべてを集計して検証の図の表にまとめる
  overview('全体図: ④ 実装まで (scenario 〜 integrate)', `④ の実装の段階どうしで受け渡すファイル群。後ろ向きの受け渡しは次の図の表にまとめた。${ucNote}`,
    p => p.stage, UC_STAGES, p => inUc(p) && !CHECK.includes(p.stage), () => true, () => false);
  overview('全体図: ④ 検証と as-built', `実装までの段階が書き、検証 (verify) と as-built の要約 (asbuilt) が読むファイル群。表の後ろ向きの受け渡しは ④ の段階すべてが対象。${ucNote}`,
    p => p.stage, UC_STAGES, inUc, r => CHECK.includes(r), () => true);

  // ---- 処理ごとの図 ----
  L.push('## 処理ごとの図', '');
  L.push(`ファイルが ${MAX_STORE_NODES} を超える処理は、図ではファイル群にまとめた。正確なパスは図の下の表にある。`, '');
  // 図 1 枚の箱と矢印の数 (processDiagram と同じ数え方)。派遣単位の図を子ごとに分けるかの判断に使う
  function processSize(p) {
    const reads = p.reads || [];
    const writes = p.writes || [];
    const used = [...new Set([...reads, ...writes])];
    const grouped = used.length > MAX_STORE_NODES;
    const node = id => (grouped ? 'g_' + stores.get(id).group : 's_' + id);
    const edges = new Set([...reads.map(id => `${node(id)}>`), ...writes.map(id => `>${node(id)}`)]);
    return { nodes: 1 + new Set(used.map(node)).size, edges: edges.size };
  }
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
      const whole = { ...p, reads: io(p, 'reads'), writes: io(p, 'writes') };
      const size = processSize(whole);
      if (p.kind === 'subagent' && subs.length && (size.nodes > MAX_DIAGRAM_NODES || size.edges > MAX_DIAGRAM_EDGES)) {
        // 派遣の単位で 1 枚に描くと読めない大きさになるサブエージェントは、内訳 (子) ごとに 1 枚ずつ描く (入出力は削らない)
        L.push(`#### ${p.name}`, '');
        L.push(`${p.skill}${p.mode ? ' mode=' + p.mode : ''} の派遣 1 回分。1 枚では大きすぎるので、内訳ごとに描く。派遣の単位の読み書きは内訳の和。`, '');
        // 親の読み書きは内訳の和を含む (正本の規則)。内訳に無い分だけを親の図に描く
        const own = key => (p[key] || []).filter(id => !subs.some(c => (c[key] || []).includes(id)));
        if (own('reads').length || own('writes').length) processDiagram({ ...p, name: `${p.name} (内訳以外の直接の読み書き)`, reads: own('reads'), writes: own('writes') }, '#####');
        for (const c of subs) processDiagram(c, '#####');
      } else if (p.kind === 'subagent' || !subs.length) {
        // サブエージェントは派遣の単位 (write-set) で 1 枚。内訳は表で示す
        processDiagram(whole, '####');
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

/**
 * 生成した Markdown の各 Mermaid 図の箱と矢印の数 (図の大きさのテスト用)。
 * Mermaid ブロックごとに数える。箱は明示の定義 (`id[...]`) と矢印の両端の ID の和 (矢印だけで暗黙に作られる箱も数える)
 */
function diagramSizes(md) {
  const out = [];
  let head = null;
  let cur = null;
  for (const line of md.split('\n')) {
    if (!cur && /^#{2,4} /.test(line)) { head = line; continue; }
    if (!cur && line === '```mermaid') { cur = { head, ids: new Set(), edges: 0 }; continue; }
    if (cur && line === '```') { out.push({ head: cur.head, nodes: cur.ids.size, edges: cur.edges }); cur = null; continue; }
    if (!cur) continue;
    const edge = line.match(/^\s*([A-Za-z0-9_]+)\s*-->(?:\|[^|]*\|)?\s*([A-Za-z0-9_]+)/);
    if (edge) { cur.edges++; cur.ids.add(edge[1]); cur.ids.add(edge[2]); continue; }
    const def = line.match(/^\s*([A-Za-z0-9_]+)\s*[[(]/);
    if (def) cur.ids.add(def[1]);
  }
  return out;
}

/** 派遣表の「派遣ごとの write-set」(d2-run の subagent-template.md の管理ブロック。0.1.31) */
const TEMPLATE = path.join(__dirname, '..', '..', 'd2-run', 'references', 'subagent-template.md');
const WS_BEGIN = '<!-- distillery2:dispatch-write-sets:begin -->';
const WS_END = '<!-- distillery2:dispatch-write-sets:end -->';

/** 派遣 1 つ分の write-set の文面: write_set の断片を `、` で結ぶ (注記はパスと同じ断片に書いてあるので、そのまま並べる) */
function writeSetText(p) { return (p.write_set || []).join('、'); }

function renderDispatchWriteSets(df) {
  const rows = df.processes.filter(p => p.kind === 'subagent' && p.template_row);
  const L = ['| 段階 | write-set |', '|---|---|'];
  for (const p of rows) L.push(`| ${p.template_row} | ${cell(writeSetText(p))} |`);
  return L.join('\n');
}

/** 管理ブロックの中だけを差し替える。外は 1 文字も触らない (genDocsReadme と同じ約束) */
function spliceBlock(text, body) {
  const i = text.indexOf(WS_BEGIN);
  const j = text.indexOf(WS_END);
  if (i < 0 || j < 0 || j < i) throw new Error(`管理ブロックの印が無い: ${TEMPLATE} (${WS_BEGIN} 〜 ${WS_END})`);
  return `${text.slice(0, i + WS_BEGIN.length)}\n${body}\n${text.slice(j)}`;
}

function main(argv) {
  const df = D.load();
  const text = render(df);
  const tplCur = fs.existsSync(TEMPLATE) ? fs.readFileSync(TEMPLATE, 'utf8') : null;
  const tplNew = tplCur === null ? null : spliceBlock(tplCur, renderDispatchWriteSets(df));
  if (argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== text) { console.error(`stale: ${path.relative(process.cwd(), OUT)} (node genDataflow.js で再生成する)`); return 1; }
    if (tplCur !== null && tplCur !== tplNew) { console.error(`stale: ${path.relative(process.cwd(), TEMPLATE)} の派遣ごとの write-set (node genDataflow.js で再生成する)`); return 1; }
    console.log('dataflow.md and dispatch write-sets: up to date');
    return 0;
  }
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
  if (tplCur !== null && tplCur !== tplNew) { fs.writeFileSync(TEMPLATE, tplNew); console.log(`wrote ${path.relative(process.cwd(), TEMPLATE)} (dispatch write-sets)`); }
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { render, diagramSizes, MAX_STORE_NODES, renderDispatchWriteSets, writeSetText, spliceBlock, main, TEMPLATE, WS_BEGIN, WS_END };
