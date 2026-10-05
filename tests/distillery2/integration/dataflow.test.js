'use strict';
// 入出力の正本 (skills/d2-common/references/dataflow.yaml) と手順書の整合性を検査する。
// 手順書は LLM が読む文章なので、照合は「バッククォートで書かれたパス」を単位にした近似。
// 制約・例外の文言は正本の notes に同じ文字列で持たせ、派遣表の write-set では「パスでも notes でもない文言」が残れば落とす。
// 読む / 書くの節 (文章が多い) はパスらしい token だけを照合し、文章は見ない (限界)。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2');
const D = require(path.join(PLUGIN, 'skills/d2-common/scripts/dataflow.js'));
const df = D.load();
const stores = new Map(df.stores.map(s => [s.id, s]));
const procs = new Map(df.processes.map(p => [p.id, p]));
const read = rel => fs.readFileSync(path.join(PLUGIN, rel), 'utf8');
const cells = line => line.split('|').slice(1, -1).map(c => c.trim());

/**
 * token 群と store 群の双方向の照合。問題を文字列で返す。
 * strict: 包含の向きを区別する (手順書の具体例が正本の表記に合うときだけ一致)。write-set の照合に使う
 * (ディレクトリ全体の表記を逆向きに許すと、`apps/<tier>/**` が `apps/<tier>/src/**` と一致して許可範囲の広がりを見逃す)
 */
function compare(label, tokens, storeIds, { scripts = [], strict = false } = {}) {
  const problems = [];
  const list = storeIds.map(id => stores.get(id));
  const hits = (t, s) => strict ? D.spellings(s).some(sp => sp === t || D.toRegex(sp).test(D.sample(t))) : D.storesFor(t, [s]).length > 0;
  for (const t of tokens) {
    if (scripts.includes(t)) continue;
    if (!list.some(s => hits(t, s))) problems.push(`${label}: 手順書にあるが正本に無い \`${t}\``);
  }
  for (const s of list) {
    if (s.outside_repo) continue;
    if (!tokens.some(t => hits(t, s))) problems.push(`${label}: 正本にあるが手順書に無い ${s.id} (${s.path})`);
  }
  return problems;
}

function section(rel, startRe) {
  const lines = read(rel).split('\n');
  const i = lines.findIndex(l => startRe.test(l));
  assert.ok(i >= 0, `section not found: ${rel} ${startRe}`);
  const j = lines.findIndex((l, k) => k > i && /^## /.test(l));
  return lines.slice(i + 1, j < 0 ? undefined : j).join('\n');
}

test('パス照合の規則: ディレクトリ全体の表記だけ両向きの包含、ファイル名パターンは手順書の具体例が正本に合うこと', () => {
  assert.equal(D.pathsMatch('docs/adr/*.md', 'docs/adr/'), true, 'ディレクトリ表記は正本のファイル群を含む');
  assert.equal(D.pathsMatch('docs/rules/**', 'docs/rules/{index,common}.md'), true, '手順書の具体例が正本のパターンに合う');
  assert.equal(D.pathsMatch('<run>/issues/<ts>_<tier>_<slug>.md', '.distillery/runs/<slug>/issues/<ts>_<tier>_<slug>.md'), true, '<run> を展開して一致');
  assert.equal(D.pathsMatch('<run>/issues/<ts>_<tier>_<slug>.md', '.distillery/runs/<slug>/issues/<ts>_<slug>.md'), false, 'ティアの無いファイル名はティアごとのファイルに合わない');
  assert.equal(D.pathsMatch('apps/<tier>/src/**', 'apps/<tier>/**'), true, '粗いディレクトリ表記は細かい正本を含む');
  assert.equal(D.pathsMatch('packages/ui/**', 'docs/design/**'), false);
  assert.equal(D.pathsMatch('<run>/attempt-<n>/findings.<tier>.yaml', '<run>/attempt-<n>/findings.<slug>.yaml'), false, '置換変数は名前で区別する (ティアが消えたら不一致)');
  assert.equal(D.pathsMatch('apps/*/', 'apps/<tier>/'), true, '`*` は置換変数にも合う');
  assert.equal(D.looksLikePath('.npmrc'), true, 'ドットファイルはパス');
  assert.equal(D.looksLikePath('rules[]'), false, 'front matter のキーはパスでない');
});

test('(a) reads / writes / allowed_writes は定義済みの store を指し、stage は定義済み', () => {
  const stageIds = new Set(df.stages.map(s => s.id).concat(['uc']));
  const problems = [];
  const ids = new Set();
  for (const s of df.stores) { if (ids.has(s.id)) problems.push(`store id 重複: ${s.id}`); ids.add(s.id); }
  for (const p of df.processes) {
    if (!stageIds.has(p.stage)) problems.push(`${p.id}: 未定義の stage ${p.stage}`);
    for (const key of ['reads', 'writes', 'allowed_writes']) for (const id of p[key] || []) if (!stores.has(id)) problems.push(`${p.id}.${key}: 未定義の store ${id}`);
    if (p.parent && !procs.has(p.parent)) problems.push(`${p.id}: 未定義の parent ${p.parent}`);
    if (p.delegated_to && !procs.has(p.delegated_to)) problems.push(`${p.id}: 未定義の delegated_to ${p.delegated_to}`);
  }
  assert.deepEqual(problems, []);
});

test('(b) 生成される store には書き手が、最終成果物以外には読み手がいる', () => {
  const written = new Set(df.processes.flatMap(p => p.writes || []));
  const readBy = new Set(df.processes.flatMap(p => p.reads || []));
  const problems = [];
  for (const s of df.stores) {
    if (s.scope_only) continue;
    if (s.origin === 'produced' && !written.has(s.id)) problems.push(`書き手がいない: ${s.id}`);
    if (!s.terminal && !readBy.has(s.id)) problems.push(`読み手がいない: ${s.id}`);
  }
  assert.deepEqual(problems, []);
});

test('(c) 同じ段階の並列処理が同じ store に書かない (パスに <tier> を含むもの、単一ティアだけが書く <datastore_owner> は例外)', () => {
  const problems = [];
  for (const p of df.processes.filter(x => x.parallel)) {
    for (const id of p.writes || []) {
      const s = stores.get(id);
      const norm = D.normalize(s.path);
      if (!norm.includes('<tier>') && !norm.includes('<datastore_owner>')) problems.push(`${p.id} (並列) が ティアで分かれない ${id} (${s.path}) に書く`);
    }
  }
  assert.deepEqual(problems, []);
});

test('サブエージェントの親の writes / reads は子 (phase ごとのスクリプト) の和を含む (派遣表の write-set と照合するため)', () => {
  const problems = [];
  for (const p of df.processes.filter(x => x.parent && procs.get(x.parent).kind === 'subagent')) {
    const parent = procs.get(p.parent);
    for (const key of ['reads', 'writes']) for (const id of p[key] || []) if (!(parent[key] || []).includes(id)) problems.push(`${p.parent}.${key} に子 ${p.id} の ${id} が無い`);
  }
  assert.deepEqual(problems, []);
});

test('(d) 派遣ごとの write-set は正本の write_set から生成 (--check)。write_set は allowed_writes と両向きに整合し、notes を含み、パスでも notes でもない文言が無い。golden と一致する (0.1.31)', () => {
  const G = require(path.join(PLUGIN, 'skills/d2-common/scripts/genDataflow.js'));
  const tmplText = read('skills/d2-run/references/subagent-template.md');
  const tmpl = tmplText.split('\n');
  const problems = [];
  const subagents = df.processes.filter(p => p.kind === 'subagent');
  // 派遣表の表 (手書き) に write-set の列が無く、全行が正本に載っている
  const header = tmpl.find(l => l.startsWith('| 段階 | role |'));
  assert.ok(header && !header.includes('write-set'), '派遣表の表に write-set の列は置かない (正本から生成する)');
  const rows = tmpl.filter(l => /^\| [①②③④還]/.test(l) && !tmplText.slice(tmplText.indexOf(G.WS_BEGIN), tmplText.indexOf(G.WS_END)).includes(l)).map(l => cells(l)[0]);
  for (const r of rows) if (!subagents.some(p => r === p.template_row || r.startsWith(p.template_row + ' '))) problems.push(`派遣表の行 ${r} が正本に無い`);
  // 生成ブロックが最新 (dataflow.md と一緒に --check)
  const chk = spawnSync('node', [path.join(PLUGIN, 'skills/d2-common/scripts/genDataflow.js'), '--check'], { encoding: 'utf8' });
  assert.equal(chk.status, 0, `genDataflow.js --check: ${chk.stderr}`);
  const golden = JSON.parse(read('../../tests/distillery2/integration/fixtures/allowed-writes.golden.json'));
  const snapshot = {};
  for (const p of subagents) {
    assert.ok(p.template_row, `${p.id}: subagent には template_row が要る`);
    assert.ok(Array.isArray(p.write_set) && p.write_set.length, `${p.id}: subagent には write_set (派遣文の文面の断片) が要る`);
    // 正本の中の整合: 文面のパス表記 ⇔ allowed_writes (両向き・strict)、notes は文面に含まれる、残りの文言が無い
    let text = G.writeSetText(p);
    for (const n of p.notes || []) {
      if (!text.includes(n)) problems.push(`${p.id}: notes の文言が write_set に無い: ${n}`);
      text = text.split(n).join(' ');
    }
    problems.push(...compare(`${p.id} write_set`, D.backticks(text), p.allowed_writes || [], { strict: true }));
    const residual = text.replace(/`[^`]+`/g, '').replace(/[\s、,()（）・/+=.:：。*]/g, '');
    if (residual) problems.push(`${p.id}: パスでも notes でもない文言: ${residual}`);
    const allowed = (p.allowed_writes || []).map(id => stores.get(id));
    for (const w of p.writes || []) {
      const s = stores.get(w);
      if (!allowed.some(a => D.toRegex(a.path).test(D.sample(s.path)))) problems.push(`${p.id}: writes の ${w} が allowed_writes の外`);
    }
    // golden: 文面の断片・notes・allowed_writes の ID と実パス (正本の 1 か所だけ変えても止まる。変えるときは golden も意図して更新する)
    snapshot[p.id] = { template_row: p.template_row, write_set: p.write_set, notes: p.notes || [], allowed_writes: (p.allowed_writes || []).map(id => ({ id, path: stores.get(id).path })) };
  }
  assert.deepEqual(problems, []);
  assert.deepEqual(snapshot, golden, 'write_set / notes / allowed_writes / store の path が golden (tests/distillery2/integration/fixtures/allowed-writes.golden.json) と違う。意図した変更なら golden を更新する');
});

test('(d2) 正本の各 alias は手順書 (派遣表の生成ブロックを除く) のどこかで使われている (使われない略記を増やさない。0.1.31)', () => {
  const G = require(path.join(PLUGIN, 'skills/d2-common/scripts/genDataflow.js'));
  const docs = [];
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.md') && e.name !== 'dataflow.md') docs.push(p); } };
  walk(path.join(PLUGIN, 'skills'));
  const tokens = new Set();
  for (const f of docs) {
    // コードフェンス (```) の中は手順書の本文でないので外す。派遣表の生成ブロックは正本の写しなので数えない
    let text = fs.readFileSync(f, 'utf8').replace(/```[\s\S]*?```/g, ' ');
    const i = text.indexOf(G.WS_BEGIN); const j = text.indexOf(G.WS_END);
    if (i >= 0 && j > i) text = text.slice(0, i) + text.slice(j);
    for (const t of D.backticks(text)) tokens.add(t);
  }
  const unused = [];
  for (const s of df.stores) for (const a of s.aliases || []) if (!tokens.has(a)) unused.push(`${s.id}: ${a}`);
  assert.deepEqual(unused, []);
});

test('(e) 各スキルの読む / 書くの節・基盤の phase 表・d2-run の表と一致する', () => {
  const problems = [];
  const sections = [
    ['implement.scenario', 'reads', 'skills/d2-implement/references/scenario.md', /^## 読むもの/],
    ['implement.scenario', 'writes', 'skills/d2-implement/references/scenario.md', /^## 書くもの/],
    ['implement.scaffold', 'reads', 'skills/d2-implement/references/scaffold.md', /^## 読むもの/],
    ['implement.scaffold', 'writes', 'skills/d2-implement/references/scaffold.md', /^## 書くもの/],
    ['implement.tier', 'reads', 'skills/d2-implement/references/tier-impl.md', /^## 読むもの/],
    ['implement.tier', 'writes', 'skills/d2-implement/references/tier-impl.md', /^## 書くもの/],
    ['implement.integrate', 'reads', 'skills/d2-implement/references/integrate.md', /^## 読むもの/],
    ['implement.integrate', 'writes', 'skills/d2-implement/references/integrate.md', /^## 書くもの/],
    ['verify', 'reads', 'skills/d2-verify/SKILL.md', /^## 読んでよいもの/],
    // 読んでよいもの = 要約役 (LLM) の read-set。スクリプトの読みは内訳の asbuilt.extract などが持つ
    ['asbuilt.summarize', 'reads', 'skills/d2-asbuilt/SKILL.md', /^## 読んでよいもの/],
    ['asbuilt', 'writes', 'skills/d2-asbuilt/SKILL.md', /^## 書いてよいもの/],
    // 還流 (0.1.24。0.1.27 から UC の外の独立した段階)
    ['decide.feedback', 'reads', 'skills/d2-decide/SKILL.md', /^## mode=feedback: 読むもの/],
    ['decide.feedback', 'writes', 'skills/d2-decide/SKILL.md', /^## mode=feedback: 書くもの/],
    ['contract.feedback', 'reads', 'skills/d2-contract/SKILL.md', /^## mode=feedback: 読むもの/],
    ['contract.feedback', 'writes', 'skills/d2-contract/SKILL.md', /^## mode=feedback: 書くもの/],
  ];
  for (const [id, key, rel, re] of sections) {
    const p = procs.get(id);
    problems.push(...compare(`${id} ${key} (${path.basename(rel)})`, D.backticks(section(rel, re)).filter(D.looksLikePath), p[key], { scripts: p.scripts }));
  }
  const fnd = read('skills/d2-foundation/SKILL.md').split('\n');
  for (const p of df.processes.filter(x => x.phase)) {
    const line = fnd.find(l => l.startsWith(`| ${p.phase} |`));
    if (!line) { problems.push(`${p.id}: phase 表に行が無い`); continue; }
    const c = cells(line);
    problems.push(...compare(`${p.id} 読む`, D.backticks(c[2]).filter(D.looksLikePath), p.reads));
    problems.push(...compare(`${p.id} 書く`, D.backticks(c[3]).filter(D.looksLikePath), p.writes));
  }
  // d2-run の表: 処理ごとに 1 行。行の「処理」列 = run_table_row
  const run = section('skills/d2-run/SKILL.md', /^## d2-run が直接読み書きするもの/).split('\n');
  const runProcs = df.processes.filter(p => p.run_table_row);
  for (const p of runProcs) {
    const line = run.find(l => l.startsWith(`| ${p.run_table_row} |`));
    if (!line) { problems.push(`${p.id}: d2-run の表に行が無い (${p.run_table_row})`); continue; }
    const c = cells(line);
    problems.push(...compare(`${p.id} 読む`, D.backticks(c[1]).filter(D.looksLikePath), p.reads || []));
    problems.push(...compare(`${p.id} 書く`, D.backticks(c[2]).filter(D.looksLikePath), p.writes || []));
  }
  const tableRows = run.filter(l => /^\| [①②③④]/.test(l)).map(l => cells(l)[0]);
  for (const r of tableRows) if (!runProcs.some(p => p.run_table_row === r)) problems.push(`d2-run の表の行 ${r} が正本に無い`);
  // d2-run が actor の処理は全部 d2-run の表に載る
  for (const p of df.processes.filter(x => x.actor === 'd2-run' && !x.run_table_row)) problems.push(`${p.id}: d2-run の処理だが表の行 (run_table_row) が無い`);
  assert.deepEqual(problems, []);
});

test('(e2) d2-run の還流節で上流を書き換えるスキルが、正本の還流の処理 (stage feedback のサブエージェント) と一致する', () => {
  const fb = section('skills/d2-run/SKILL.md', /^## 還流 \(独立した段階\)/).split('\n');
  const rows = fb.filter(l => /^\| (rule|contract) \|/.test(l));
  assert.equal(rows.length, 2, '還流節の表に rule と contract の行がある');
  const inDoc = new Set(rows.flatMap(l => [...cells(l)[1].matchAll(/d2-[a-z]+/g)].map(m => m[0])));
  const inDf = new Set(df.processes.filter(p => p.stage === 'feedback' && p.kind === 'subagent').map(p => p.skill));
  assert.deepEqual([...inDoc].sort(), [...inDf].sort());
  // 派遣表の還流の行と、手順が名指しする派遣表の行が揃っている
  const text = fb.join('\n');
  for (const p of df.processes.filter(x => x.stage === 'feedback' && x.kind === 'subagent')) {
    assert.ok(text.includes(`派遣表「${p.template_row}」`), `還流節が派遣表の行「${p.template_row}」を名指ししていない`);
  }
});

test('(f) dataflow.md が最新 (genDataflow.js --check)', () => {
  execFileSync('node', [path.join(PLUGIN, 'skills/d2-common/scripts/genDataflow.js'), '--check'], { stdio: 'pipe' });
});

test('(f2) DFD の各図が読める大きさ (箱 9 以下・矢印 12 以下) で、全ファイル群に所属がある', () => {
  const G = require(path.join(PLUGIN, 'skills/d2-common/scripts/genDataflow.js'));
  const md = G.render(df);
  const sizes = G.diagramSizes(md);
  assert.ok(sizes.length >= 3, '図が生成されている');
  assert.equal(sizes.length, (md.match(/^```mermaid$/gm) || []).length, 'すべての Mermaid ブロックを数えている');
  // 数え方の確認: 矢印だけで暗黙に作られる箱も数える
  const implicit = G.diagramSizes('## x\n```mermaid\nflowchart LR\n' + Array.from({ length: 13 }, (_, i) => `  A${i} --> A${i + 1}`).join('\n') + '\n```\n');
  assert.deepEqual(implicit, [{ head: '## x', nodes: 14, edges: 13 }]);
  const big = sizes.filter(d => d.nodes > 9 || d.edges > 12).map(d => `${d.head} (箱 ${d.nodes}・矢印 ${d.edges})`);
  assert.deepEqual(big, []);
  const groupIds = new Set((df.store_groups || []).map(g => g.id));
  assert.deepEqual(df.stores.filter(s => !groupIds.has(s.group)).map(s => s.id), [], 'store の group が store_groups に無い');
});

test('(g) 全スキルが Agent Skills 仕様に沿う (name の形式・ディレクトリ名一致・frontmatter は許可項目だけ)', () => {
  const ALLOWED = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
  const problems = [];
  const dirs = fs.readdirSync(path.join(PLUGIN, 'skills'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  for (const dir of dirs) {
    const text = read(`skills/${dir}/SKILL.md`);
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) { problems.push(`${dir}: frontmatter が無い`); continue; }
    const keys = [...fm[1].matchAll(/^([A-Za-z][\w-]*):/gm)].map(m => m[1]);
    for (const k of keys) if (!ALLOWED.has(k)) problems.push(`${dir}: 仕様外の frontmatter ${k}`);
    const name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1];
    if (!name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) problems.push(`${dir}: name の形式違反 ${name}`);
    if (name !== dir) problems.push(`${dir}: name (${name}) がディレクトリ名と違う`);
    const desc = (fm[1].match(/^description:\s*([\s\S]*?)(?=^\S|$(?![\s\S]))/m) || [])[1] || '';
    if (!desc.trim()) problems.push(`${dir}: description が空`);
  }
  assert.deepEqual(problems, []);
});

test('(g2) d2-common 以外の全スキルが入出力の正本を相対パスで参照する', () => {
  const dirs = fs.readdirSync(path.join(PLUGIN, 'skills'), { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'd2-common').map(d => d.name);
  const missing = dirs.filter(dir => !read(`skills/${dir}/SKILL.md`).includes('](../d2-common/references/dataflow.yaml)'));
  assert.deepEqual(missing, []);
});

test('(h) d2-run が回す主なスクリプトは、正本の出力先をソースに持つ (出力先の変更に気づくための網。完全な照合ではない)', () => {
  const table = [
    ['skills/d2-common/scripts/runGates.js', 'reports', 'gates.json'],
    ['skills/d2-common/scripts/genDocsReadme.js', 'docs-readme', 'README.md'],
    ['skills/d2-common/scripts/lib/runState.js', 'run-events', 'events.jsonl'],
    ['skills/d2-common/scripts/prTrailers.js', 'reports', 'gates.json'],
    ['skills/d2-asbuilt/scripts/extractAsBuilt.js', 'asbuilt-system', 'traceability-index.json'],
    ['skills/d2-asbuilt/scripts/extractAsBuilt.js', 'asbuilt-report', 'asbuilt.json'],
    ['skills/d2-contract/scripts/classifyContractChanges.js', 'contract-tests', 'test\\/contract'],
    ['skills/d2-common/scripts/feedbackBatch.js', 'worktrees', 'worktrees'],
    ['skills/d2-common/scripts/feedbackBatch.js', 'feedback-batch', 'logs'],
    ['skills/d2-common/scripts/feedbackBatch.js', 'feedback-docs', 'docs.*feedback'],
  ];
  const problems = [];
  for (const [rel, storeId, literal] of table) {
    const s = stores.get(storeId);
    if (!s) { problems.push(`${rel}: 正本に store ${storeId} が無い`); continue; }
    const re = new RegExp(literal);
    if (!re.test(read(rel))) problems.push(`${rel}: 出力先 ${literal} がソースに無い (正本 ${storeId} = ${s.path})`);
    if (!D.spellings(s).some(sp => re.test(sp) || re.test(sp.replace(/\//g, '\\/')))) problems.push(`${rel}: 正本 ${storeId} の表記に ${literal} が無い`);
  }
  assert.deepEqual(problems, []);
});
