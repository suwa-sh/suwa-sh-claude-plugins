#!/usr/bin/env node
/**
 * genDocsReadme.js — docs/README.md (上流から下流まで辿るための入口) を既存の正本から決定論生成する
 *
 * 読者の問い 3 つに答える:
 *   1. どこに何があるか        → 段階 (要求 → 決定 → 基盤 → UC) の表
 *   2. この UC は上流のどれから来て、どこまでできたか → UC 一覧 (背骨): 要求 → シナリオ → 契約 → 画面 → as-built
 *   3. 決めたことは何か        → ADR 一覧、非機能、ルール、契約、C4 図
 *
 * 振る舞い (distillery2 由来でない文書との共存):
 *   - 書くのは `<!-- distillery2:begin -->` 〜 `<!-- distillery2:end -->` の管理ブロックだけ。外は 1 文字も触らない。
 *     印の無い既存 README には末尾にブロックを足す。README が無ければ作る
 *   - docs/ 直下の知らないディレクトリ・ファイルは「distillery2 以外の文書」として名前と入口だけ列挙する (内容は要約しない)
 *   - 知っているディレクトリの中で参照しなかった md は、その節の「その他」に列挙する
 *   - 実在するものだけを載せる。ブロック内の相対リンク先が無ければ exit 1 (壊れたリンクを commit しない)
 *   - 段階が未着手なら「未着手」と 1 行書く (空の節を出さない)。時刻は書かない (同じ入力なら同じ出力)
 *
 * Usage: node genDocsReadme.js [--cwd <repo>] [--config .distillery/config.yaml] [--docs-root docs] [--check]
 *   --check: 生成結果が現在の README と一致するか (ドリフト検知。違えば exit 1、書き換えない)
 * npm 依存なし。共有ライブラリ (lib/yaml) のみ。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('./lib/yaml');

const BEGIN = '<!-- distillery2:begin -->';
const END = '<!-- distillery2:end -->';
const NOTE = '<!-- この間は distillery2 (genDocsReadme.js) が生成する。手で書くものはこのブロックの外に置く -->';
/** distillery2 が作るディレクトリ (docs/ 直下)。これ以外は「distillery2 以外の文書」 */
const KNOWN_DIRS = ['input', 'requirements', 'nfr', 'adr', 'rules', 'design', 'as-built'];

function cmpStr(a, b) { a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }
function readText(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function readYaml(p) { const t = readText(p); return t == null ? null : parseYaml(t); }
function readJson(p) { const t = readText(p); if (t == null) return null; try { return JSON.parse(t); } catch { return null; } }
function mdEscape(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' '); }
function listDir(p) { return fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).sort((a, b) => cmpStr(a.name, b.name)) : []; }

/** YAML front matter → {data, body}。 */
function frontMatter(text) {
  const lines = String(text || '').split('\n');
  if (lines[0] !== '---') return { data: {}, body: text || '' };
  const end = lines.indexOf('---', 1);
  if (end < 0) return { data: {}, body: text };
  return { data: parseYaml(lines.slice(1, end).join('\n')) || {}, body: lines.slice(end + 1).join('\n') };
}

/** 相対リンク (README から見た) を作る。実在確認のため absolute も返す。 */
function makeLinker(readmeDir, cwd) {
  const links = [];
  return {
    to(absPath, label) {
      const rel = path.relative(readmeDir, absPath).split(path.sep).join('/');
      links.push({ rel, abs: absPath, label });
      return `[${mdEscape(label)}](${encodeURI(rel)})`;
    },
    links,
  };
}

// ---------------------------------------------------------------------------
// 収集
// ---------------------------------------------------------------------------

function collect(opts) {
  const cwd = opts.cwd;
  const config = readYaml(path.resolve(cwd, opts.config)) || {};
  const docsRoot = opts.docsRoot || config.docs_root || 'docs';
  const docsDir = path.resolve(cwd, docsRoot);
  const D = (...p) => path.join(docsDir, ...p);

  const overview = readJson(D('requirements', 'rdra', 'システム概要.json')) || {};
  const reqDoc = readYaml(D('requirements', 'requirements.yaml')) || {};
  const systemName = overview.system_name || reqDoc.system_name || path.basename(cwd);
  const specs = [];
  for (const r of reqDoc.requirements || []) for (const s of r.specifications || []) specs.push({ id: s.id, req: r.id, text: s.specification, criteria: (s.acceptance_criteria || []).length });

  const ucDoc = readYaml(D('requirements', 'use-cases.yaml')) || {};
  const ucs = (ucDoc.use_cases || ucDoc.ucs || []).slice();

  // features: @uc:<slug> タグ → ファイルとシナリオ数
  const features = {};
  const featuresDir = path.resolve(cwd, 'features');
  const walk = (dir) => {
    for (const e of listDir(dir)) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.feature')) {
        const text = fs.readFileSync(p, 'utf8');
        const m = text.match(/@uc:([A-Za-z0-9_-]+)/);
        if (!m) continue;
        const scenarios = (text.match(/^\s*(?:シナリオ(?:アウトライン| アウトライン|テンプレート)?|Scenario(?: Outline| Template)?|Example):/gm) || []).length;
        (features[m[1]] = features[m[1]] || []).push({ path: p, scenarios });
      }
    }
  };
  walk(featuresDir);

  const contractsDoc = readJson(path.resolve(cwd, 'contracts', 'contracts.json')) || {};
  const ucIndex = readYaml(path.resolve(cwd, 'contracts', 'uc-index.yaml')) || {};
  const ucIndexBySlug = {};
  for (const u of ucIndex.ucs || []) if (u && u.slug) ucIndexBySlug[u.slug] = u;

  const screensDoc = readYaml(D('design', 'screens.yaml')) || {};
  const screensBySlug = {};
  for (const s of screensDoc.screens || []) for (const slug of (s.uc_slugs || (s.uc ? [s.uc] : []))) (screensBySlug[slug] = screensBySlug[slug] || []).push(s.name);

  const trace = readJson(D('as-built', '_system', 'traceability-index.json')) || { ucs: {} };

  const adrs = [];
  for (const e of listDir(D('adr'))) {
    if (!/^\d{4}-.*\.md$/.test(e.name)) continue;
    const { data } = frontMatter(fs.readFileSync(D('adr', e.name), 'utf8'));
    adrs.push({ file: e.name, id: data.id || e.name.slice(0, 4), title: data.title || e.name, status: data.status || '-' });
  }
  const nfr = readYaml(D('nfr', 'nfr-grade.yaml'));
  // nfr-grade.yaml: categories[] → subcategories[] → items[] → metrics[] (important: true が重要項目)
  let nfrCount = 0; let nfrImportant = 0;
  for (const c of (nfr && nfr.categories) || []) for (const sc of c.subcategories || []) for (const it of sc.items || []) for (const m of it.metrics || []) { nfrCount += 1; if (m.important) nfrImportant += 1; }
  const nfrModel = nfr && nfr.model_system ? (typeof nfr.model_system === 'object' ? nfr.model_system.type : nfr.model_system) : null;

  return { cwd, config, docsRoot, docsDir, D, systemName, overview, reqDoc, specs, ucs, features, contractsDoc, ucIndexBySlug, screensBySlug, screensDoc, trace, adrs, nfr, nfrCount, nfrImportant, nfrModel };
}

// ---------------------------------------------------------------------------
// 描画
// ---------------------------------------------------------------------------

function build(ctx) {
  const readmePath = ctx.D('README.md');
  const readmeDir = path.dirname(readmePath);
  const L = makeLinker(readmeDir, ctx.cwd);
  const link = (abs, label) => (fs.existsSync(abs) ? L.to(abs, label) : null);
  const referenced = new Set(); // 参照した docs 配下の絶対パス
  const ref = (abs, label) => { const s = link(abs, label); if (s) referenced.add(abs); return s; };
  const out = [];
  const { D } = ctx;

  out.push(BEGIN);
  out.push(NOTE);
  out.push('');
  out.push(`# ${ctx.systemName}`);
  out.push('');
  if (ctx.overview.system_overview) { out.push(`> ${mdEscape(ctx.overview.system_overview)}`); out.push(''); }

  // 1. 段階の表
  out.push('## どこに何があるか');
  out.push('');
  out.push('| 段階 | 決めること | 人が読む | 機械が読む (正本) |');
  out.push('|---|---|---|---|');
  const stage = (name, what, human, machine) => out.push(`| ${name} | ${what} | ${human.filter(Boolean).join('<br>') || '未着手'} | ${machine.filter(Boolean).join('<br>') || '-'} |`);
  const inputs = listDir(D('input')).filter((e) => e.isFile()).map((e) => ref(D('input', e.name), e.name));
  stage('入力', '初期要望', inputs, []);
  stage('① 要求', '要求・仕様・受入基準、業務と UC', [ref(D('requirements', 'requirements.md'), '要求仕様書 (USDM)'), ref(D('requirements', 'rdra', 'views', 'README.md'), 'RDRA の図解'), ref(D('requirements', '_review-summary.md'), '確認材料')], [ref(D('requirements', 'requirements.yaml'), 'requirements.yaml'), ref(D('requirements', 'use-cases.yaml'), 'use-cases.yaml'), ref(D('requirements', 'rdra'), 'rdra/')]);
  stage('② 決定', '非機能グレード、ADR、C4 図', [ref(D('nfr', 'nfr-grade.md'), '非機能グレード表'), ref(D('adr', 'index.md'), 'ADR 一覧'), ref(D('adr', 'architecture.md'), 'C4 図'), ref(D('adr', '_review-summary.md'), '確認材料')], [ref(D('nfr', 'nfr-grade.yaml'), 'nfr-grade.yaml'), ref(D('adr'), 'adr/*.md の front matter')]);
  stage('③ 基盤', '開発ルール、契約、テスト基盤、画面部品', [ref(D('rules', 'index.md'), '開発ルール'), ref(D('design', '_review-summary.md'), '画面の確認材料')], [ref(path.resolve(ctx.cwd, 'contracts', 'contracts.json'), 'contracts/'), ref(path.resolve(ctx.cwd, '.distillery', 'config.yaml'), '.distillery/config.yaml'), ref(D('design', 'screens.yaml'), 'screens.yaml')]);
  stage('④ UC', 'シナリオ、契約差分、実装、as-built', [ref(D('as-built', '_system', 'index.md'), 'as-built 一覧')], [ref(path.resolve(ctx.cwd, 'features'), 'features/'), ref(D('as-built', '_system', 'traceability-index.json'), '追跡表')]);
  out.push('');

  // 2. UC 一覧 (背骨)
  out.push('## 業務と UC (上流から下流へ)');
  out.push('');
  if (!ctx.ucs.length) out.push('未着手 (要求の段階で `use-cases.yaml` が作られる)。');
  else {
    const specText = Object.fromEntries(ctx.specs.map((s) => [s.id, s]));
    const reqMd = D('requirements', 'requirements.md');
    const rows = ctx.ucs.slice().sort((a, b) => cmpStr(`${a.business}\u0000${a.buc}\u0000${a.uc}`, `${b.business}\u0000${b.buc}\u0000${b.uc}`));
    const done = rows.filter((u) => ctx.trace.ucs && ctx.trace.ucs[u.slug]).length;
    const blocked = rows.filter((u) => u.status === 'blocked').length;
    out.push(`UC ${rows.length} 件 (実装済み ${done}、要求待ち ${blocked})。1 行で要求 → シナリオ → 契約 → 画面 → 実装の記録まで辿れる。`);
    if (fs.existsSync(reqMd)) out.push(`要求の列の SPEC は ${ref(reqMd, '要求仕様書')} の行。`);
    out.push('');
    out.push('| 業務 | UC | 状態 | 要求 | シナリオ | 契約 | 画面 | 実装の記録 |');
    out.push('|---|---|---|---|---|---|---|---|');
    let lastBiz = null;
    for (const u of rows) {
      const t = ctx.trace.ucs && ctx.trace.ucs[u.slug];
      let status;
      if (t) status = t.gates_complete && t.gates === 'pass' ? '実装済み' : `実装中 (ゲート ${t.gates || '-'})`;
      else status = { planned: '未着手', in_progress: '実装中', done: '実装済み', blocked: '要求待ち' }[u.status] || (u.status || '-');
      const specs = (u.spec_ids || []).map((id) => (specText[id] ? `${id}` : id));
      const specCell = specs.length ? specs.join(', ') : 'なし';
      const feats = (ctx.features[u.slug] || []).map((f) => `${L.to(f.path, path.basename(f.path))} (${f.scenarios} 本)`);
      const ci = ctx.ucIndexBySlug[u.slug];
      const contractParts = [];
      if (ci) {
        const slice = path.resolve(ctx.cwd, 'contracts', 'generated', 'slices', u.slug, 'contract-slice.json');
        const ops = (ci.operations || []).join(', ');
        const label = [ops, (ci.messages || []).length ? `イベント ${ci.messages.length}` : '', (ci.tables || []).length ? `テーブル ${ci.tables.length}` : ''].filter(Boolean).join(' / ');
        contractParts.push(fs.existsSync(slice) ? L.to(slice, label || 'slice') : label);
      }
      const screens = ctx.screensBySlug[u.slug] || [];
      const asBuilt = t && t.as_built ? link(path.resolve(ctx.cwd, t.as_built, 'index.md'), 'index.md') : null;
      const biz = u.business === lastBiz ? '' : mdEscape(u.business);
      lastBiz = u.business;
      out.push(`| ${biz} | ${mdEscape(u.uc)} | ${status} | ${specCell} | ${feats.join('<br>') || '-'} | ${contractParts.join('<br>') || '-'} | ${screens.map(mdEscape).join('<br>') || '-'} | ${asBuilt || '-'} |`);
    }
    out.push('');
    const waiting = rows.filter((u) => u.status === 'blocked' && u.no_spec_reason);
    if (waiting.length) {
      out.push('<details>');
      out.push(`<summary>要求待ちの理由 (${waiting.length})</summary>`);
      out.push('');
      for (const u of waiting) out.push(`- ${mdEscape(u.uc)}: ${mdEscape(u.no_spec_reason)}`);
      out.push('');
      out.push('</details>');
      out.push('');
    }
  }

  // 3. 決めたこと
  out.push('## 決めたこと');
  out.push('');
  if (ctx.adrs.length) {
    out.push('| ADR | 決定 | 状態 |');
    out.push('|---|---|---|');
    for (const a of ctx.adrs) out.push(`| ${ref(D('adr', a.file), String(a.id))} | ${mdEscape(a.title)} | ${a.status} |`);
    out.push('');
  } else out.push('ADR は未着手 (決定の段階で作られる)。\n');
  const decided = [];
  if (ctx.nfr) decided.push(`- 非機能: ${ref(D('nfr', 'nfr-grade.md'), '非機能グレード表')} (モデルシステム ${mdEscape(ctx.nfrModel || '-')}、重要項目 ${ctx.nfrImportant} / ${ctx.nfrCount})。性能テストの閾値の出典`);
  if (fs.existsSync(D('adr', 'architecture.md'))) decided.push(`- 構成: ${ref(D('adr', 'architecture.md'), 'C4 図')} (決めたもの)。実態は ${ref(D('as-built', '_system', 'dependency-graph.md'), '依存グラフ') || 'as-built の依存グラフ'}`);
  if (fs.existsSync(D('rules', 'index.md'))) decided.push(`- 開発ルール: ${ref(D('rules', 'index.md'), '目次')}。実装時は common + 自ティア + testing だけ読む (生成物。直したい変更は ADR へ)`);
  for (const l of decided) out.push(l);
  if (decided.length) out.push('');

  // 4. 契約
  out.push('## 契約');
  out.push('');
  const contracts = ctx.contractsDoc.contracts || [];
  if (contracts.length) {
    out.push('| 契約 | 種類 | 提供 | 利用 | 正本 |');
    out.push('|---|---|---|---|---|');
    for (const c of contracts) {
      const src = path.resolve(ctx.cwd, 'contracts', c.source || '');
      out.push(`| ${mdEscape(c.id)} | ${mdEscape(c.type)} | ${mdEscape(c.provider || '-')} | ${(c.consumers || []).map(mdEscape).join(', ') || '-'} | ${link(src, c.source || '-') || mdEscape(c.source || '-')} |`);
    }
    out.push('');
    const gen = path.resolve(ctx.cwd, 'contracts', 'generated');
    if (fs.existsSync(gen)) out.push(`生成物 (bundle、UC ごとの slice、契約テスト) は ${L.to(gen, 'contracts/generated/')}。API の一覧は ${ref(D('as-built', '_system', 'api-inventory.md'), 'api-inventory.md') || 'as-built に出る'}。`);
    out.push('');
  } else out.push('未着手 (基盤の段階で契約の骨格が作られる)。\n');

  // 5. 横断
  const sys = [['index.md', 'as-built 一覧'], ['api-inventory.md', 'API インベントリ'], ['data-flow.md', 'データフロー (UC × テーブル)'], ['dependency-graph.md', '依存グラフ (実態)'], ['traceability-index.json', '追跡表 (機械向け)']]
    .map(([f, label]) => ref(D('as-built', '_system', f), label)).filter(Boolean);
  if (sys.length) {
    out.push('## 横断して見る');
    out.push('');
    for (const s of sys) out.push(`- ${s}`);
    out.push('');
  }

  // 6. 知っているディレクトリの中の、参照しなかった md (そのディレクトリの index.md / README.md が参照するものは参照済み扱い)
  const others = [];
  for (const dir of KNOWN_DIRS) {
    for (const idx of ['index.md', 'README.md']) {
      const text = readText(D(dir, idx));
      if (!text) continue;
      // リンク [..](x.md) と、表で `x.md` と書いた言及の両方を参照とみなす (rules/index.md は後者)
      for (const m of text.matchAll(/\]\(([^)#]+)\)|`([^`\s]+\.md)`/g)) {
        const target = m[1] || m[2];
        if (/<[^>]+>/.test(target)) {
          // `tier-<kind>.md` のような雛形の言及は、当てはまるファイル全部を参照済みにする
          const re = new RegExp('^' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/<[^>]+>/g, '[^/]+') + '$');
          for (const e of listDir(D(dir))) if (e.isFile() && re.test(e.name)) referenced.add(D(dir, e.name));
          continue;
        }
        try { referenced.add(path.resolve(D(dir), decodeURI(target))); } catch { /* 壊れたリンクは無視 */ }
      }
    }
    for (const e of listDir(D(dir))) {
      const abs = D(dir, e.name);
      if (!e.isFile() || !e.name.endsWith('.md') || referenced.has(abs)) continue;
      others.push(L.to(abs, `${dir}/${e.name}`));
    }
  }
  // 7. docs 直下の知らないもの
  const unknown = [];
  for (const e of listDir(ctx.docsDir)) {
    if (e.name === 'README.md' || KNOWN_DIRS.includes(e.name) || e.name.startsWith('.')) continue;
    const abs = D(e.name);
    if (e.isDirectory()) {
      const entry = ['README.md', 'index.md'].map((n) => path.join(abs, n)).find((p) => fs.existsSync(p))
        || listDir(abs).filter((x) => x.isFile() && x.name.endsWith('.md')).map((x) => path.join(abs, x.name))[0];
      const count = listDir(abs).filter((x) => x.isFile()).length;
      unknown.push(`| ${mdEscape(e.name)}/ | ${entry ? L.to(entry, path.basename(entry)) : '-'} | ${count} |`);
    } else unknown.push(`| ${L.to(abs, e.name)} | - | 1 |`);
  }
  if (others.length || unknown.length) {
    out.push('## distillery2 以外の文書');
    out.push('');
    out.push('distillery2 が生成しない文書。ここには名前だけを載せる (内容は要約しない。消さない)。');
    out.push('');
    if (unknown.length) {
      out.push('| 場所 | 入口 | ファイル数 |');
      out.push('|---|---|---|');
      for (const u of unknown) out.push(u);
      out.push('');
    }
    if (others.length) {
      out.push('distillery2 のディレクトリにある、上で参照していない文書:');
      out.push('');
      for (const o of others) out.push(`- ${o}`);
      out.push('');
    }
  }
  out.push(END);
  return { block: out.join('\n'), links: L.links, readmePath };
}

/** 既存 README に管理ブロックを差し込む (外は触らない)。 */
function merge(existing, block) {
  if (existing == null) return block + '\n';
  const b = existing.indexOf(BEGIN);
  const e = existing.indexOf(END);
  if (b >= 0 && e > b) return existing.slice(0, b) + block + existing.slice(e + END.length);
  const sep = existing.endsWith('\n') ? (existing.endsWith('\n\n') ? '' : '\n') : '\n\n';
  return existing + sep + block + '\n';
}

function run(opts) {
  const ctx = collect(opts);
  const { block, links, readmePath } = build(ctx);
  const broken = links.filter((l) => !fs.existsSync(l.abs)).map((l) => l.rel);
  if (broken.length) return { code: 1, readmePath, broken, changed: false };
  const existing = readText(readmePath);
  const next = merge(existing, block);
  const changed = existing !== next;
  if (opts.check) return { code: changed ? 1 : 0, readmePath, broken: [], changed };
  if (changed) { fs.mkdirSync(path.dirname(readmePath), { recursive: true }); fs.writeFileSync(readmePath, next); }
  return { code: 0, readmePath, broken: [], changed };
}

function parseArgs(argv) {
  const o = { cwd: process.cwd(), config: '.distillery/config.yaml', check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cwd') o.cwd = path.resolve(argv[++i]);
    else if (a === '--config') o.config = argv[++i];
    else if (a === '--docs-root') o.docsRoot = argv[++i];
    else if (a === '--check') o.check = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  return o;
}

function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const r = run(o);
  const rel = path.relative(o.cwd, r.readmePath);
  if (r.broken.length) { console.error(`${rel}: リンク先が無い (${r.broken.length}): ${r.broken.join(', ')}`); return 1; }
  if (o.check) { console.log(r.changed ? `${rel}: 生成結果と一致しない (再生成が必要)` : `${rel}: 最新`); return r.code; }
  console.log(`${rel}: ${r.changed ? '更新' : '変更なし'}`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { run, build, collect, merge, BEGIN, END, KNOWN_DIRS, main };
