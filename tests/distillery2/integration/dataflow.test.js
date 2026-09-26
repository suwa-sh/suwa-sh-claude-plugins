'use strict';
// 入出力の正本 (skills/d2-common/references/dataflow.yaml) と手順書の整合性を検査する。
// 手順書は LLM が読む文章なので、照合は「バッククォートで書かれたパス」を単位にした近似。
// 制約・例外の文言は正本の notes に同じ文字列で持たせ、派遣表の write-set では「パスでも notes でもない文言」が残れば落とす。
// 読む / 書くの節 (文章が多い) はパスらしい token だけを照合し、文章は見ない (限界)。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

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

test('(d) 派遣表の write-set = allowed_writes、writes ⊆ allowed_writes、パスでも notes でもない文言が無い', () => {
  const tmpl = read('skills/d2-run/references/subagent-template.md').split('\n');
  const problems = [];
  const subagents = df.processes.filter(p => p.kind === 'subagent');
  for (const p of subagents) {
    assert.ok(p.template_row, `${p.id}: subagent には template_row が要る`);
    const line = tmpl.find(l => l.startsWith(`| ${p.template_row} `));
    if (!line) { problems.push(`${p.id}: 派遣表に行が無い (${p.template_row})`); continue; }
    let cell = cells(line)[4];
    for (const n of p.notes || []) {
      if (!cell.includes(n)) problems.push(`${p.id}: notes の文言が派遣表に無い: ${n}`);
      cell = cell.split(n).join(' ');
    }
    problems.push(...compare(`${p.id} write-set`, D.backticks(cell), p.allowed_writes || [], { strict: true }));
    const residual = cell.replace(/`[^`]+`/g, '').replace(/[\s、,()（）・/+=.:：。*]/g, '');
    if (residual) problems.push(`${p.id}: パスでも notes でもない文言: ${residual}`);
    const allowed = (p.allowed_writes || []).map(id => stores.get(id));
    for (const w of p.writes || []) {
      const s = stores.get(w);
      if (!allowed.some(a => D.toRegex(a.path).test(D.sample(s.path)))) problems.push(`${p.id}: writes の ${w} が allowed_writes の外`);
    }
  }
  // 派遣表の全行が正本に載っている
  const rows = tmpl.filter(l => /^\| [①②③④]/.test(l)).map(l => cells(l)[0]);
  for (const r of rows) if (!subagents.some(p => r === p.template_row || r.startsWith(p.template_row + ' '))) problems.push(`派遣表の行 ${r} が正本に無い`);
  assert.deepEqual(problems, []);
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
    ['asbuilt', 'reads', 'skills/d2-asbuilt/SKILL.md', /^## 読んでよいもの/],
    ['asbuilt', 'writes', 'skills/d2-asbuilt/SKILL.md', /^## 書いてよいもの/],
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

test('(f) dataflow.md が最新 (genDataflow.js --check)', () => {
  execFileSync('node', [path.join(PLUGIN, 'skills/d2-common/scripts/genDataflow.js'), '--check'], { stdio: 'pipe' });
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
    ['scripts/runGates.js', 'reports', 'gates.json'],
    ['scripts/genDocsReadme.js', 'docs-readme', 'README.md'],
    ['scripts/lib/runState.js', 'run-events', 'events.jsonl'],
    ['scripts/prTrailers.js', 'reports', 'gates.json'],
    ['skills/d2-asbuilt/scripts/extractAsBuilt.js', 'asbuilt-system', 'traceability-index.json'],
    ['skills/d2-contract/scripts/classifyContractChanges.js', 'contract-tests', 'test\\/contract'],
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
