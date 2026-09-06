#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ucPath, encode } = require('./compileContracts');
const fail = (ok, message) => { if (!ok) throw new Error(message); };
const cell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
const link = file => file.split('/').map(encodeURIComponent).join('/');

// TSV with quoted cells, doubled quotes, and embedded newlines.
function tsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || field === '') quoted = !quoted;
      else field += ch;
    } else if (!quoted && (ch === '\t' || ch === '\n')) {
      row.push(field.replace(/\r$/, '')); field = '';
      if (ch === '\n') { rows.push(row); row = []; }
    } else field += ch;
  }
  fail(!quoted, 'Unclosed TSV quote');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift(); fail(headers?.length, 'Empty TSV');
  return rows.filter(r => r.some(Boolean)).map(r => {
    fail(r.length === headers.length, 'TSV column count mismatch');
    return Object.fromEntries(headers.map((h, i) => [h.replace(/^\uFEFF/, ''), r[i]]));
  });
}
function elements(rdraRoot) {
  const out = new Map();
  const add = (category, values) => {
    const key = JSON.stringify([category, ...values]); out.set(key, { key, category, element: values.join(' / ') });
  };
  const split = value => value.split(/[、,]/).map(x => x.trim()).filter(Boolean);
  for (const [file, headers, collect] of [
    ['情報.tsv', ['情報', '属性'], r => split(r.属性).forEach(v => add('information', [r.コンテキスト || '', r.情報, v]))],
    ['条件.tsv', ['条件'], r => add('condition', [r.コンテキスト || '', r.条件])],
    ['バリエーション.tsv', ['バリエーション', '値'], r => split(r.値).forEach(v => add('variation', [r.コンテキスト || '', r.バリエーション, v]))],
    ['状態.tsv', ['状態モデル', '状態', '遷移UC', '遷移先状態'], r => { if (r.遷移UC) add('state', [r.コンテキスト || '', r.状態モデル, r.状態, r.遷移先状態]); }],
    ['外部システム.tsv', ['外部システム'], r => add('external', [r.コンテキスト || '', r.外部システム])],
  ]) {
    const filePath = path.join(rdraRoot, file);
    if (!fs.existsSync(filePath) && ['バリエーション.tsv', '外部システム.tsv'].includes(file)) continue;
    const records = tsv(fs.readFileSync(filePath, 'utf8'));
    for (const r of records) { for (const h of headers) fail(h in r, `${file}: missing ${h}`); collect(r); }
  }
  return [...out.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}
function fileInside(root, relative) {
  fail(typeof relative === 'string' && relative && !relative.includes('\\') && !path.isAbsolute(relative), 'Relative evidence path required');
  const full = path.resolve(root, relative), realRoot = fs.realpathSync(root);
  fail(full.startsWith(path.resolve(root) + path.sep) && fs.existsSync(full), `Missing evidence: ${relative}`);
  const real = fs.realpathSync(full);
  fail(real.startsWith(realRoot + path.sep) && fs.statSync(real).isFile(), `Evidence outside event: ${relative}`);
  return real;
}
function build(eventRoot, rdraRoot) {
  const catalog = require('./compileContracts').loadCatalog(eventRoot);
  // Use the contract compiler's ownership validation before deriving dependency views.
  require('./compileContracts').compile(catalog);
  const expected = new Set(tsv(fs.readFileSync(path.join(rdraRoot, 'BUC.tsv'), 'utf8'))
    .filter(r => r.UC).map(r => ucPath({ business: r.業務, buc: r.BUC, uc: r.UC })));
  const actual = new Set(catalog.use_cases.map(ucPath));
  fail(expected.size === actual.size && [...expected].every(x => actual.has(x)), 'Catalog UC set differs from RDRA BUC.tsv');
  const inventory = elements(rdraRoot), known = new Set(inventory.map(e => e.key)), evidence = new Map();
  const owners = new Map();
  for (const uc of catalog.use_cases) for (const op of uc.provides) owners.set(`${op.kind}:${op.operation_id}`, ucPath(uc));
  const files = new Map(), groups = new Map();
  for (const uc of catalog.use_cases) {
    const at = ucPath(uc); fileInside(eventRoot, `${at}/spec.md`);
    const group = `${uc.business}/${uc.buc}`;
    if (!groups.has(group)) groups.set(group, []); groups.get(group).push(uc);
    const source = path.join(eventRoot, at, '_trace-links.json');
    if (!fs.existsSync(source)) continue;
    const trace = JSON.parse(fs.readFileSync(source, 'utf8'));
    fail(trace.schema_version === 'distillery.trace-links/v1' && Array.isArray(trace.links), `${at}: invalid trace links`);
    for (const entry of trace.links) {
      fail(known.has(entry.element), `${at}: unknown RDRA element ${entry.element}`);
      fail(typeof entry.tier === 'string' && /^tier-[\w-]+$/.test(entry.tier), `${at}: tier required`);
      fileInside(eventRoot, `${at}/${entry.tier}.md`);
      const body = fs.readFileSync(fileInside(eventRoot, entry.file), 'utf8');
      fail(typeof entry.anchor === 'string' && entry.anchor, `${at}: evidence anchor required`);
      fail(body.includes(entry.anchor), `${at}: missing evidence anchor ${entry.anchor}`);
      fail(Array.isArray(entry.scenarios) && entry.scenarios.length, `${at}: scenarios required`);
      for (const scenario of entry.scenarios) {
        const scenarioText = fs.readFileSync(fileInside(eventRoot, scenario.file), 'utf8');
        fail(typeof scenario.name === 'string' && scenario.name, `${at}: scenario name required`);
        const names = [...scenarioText.matchAll(/^\s*Scenario(?: Outline)?:\s*(.+)$/gm)].map(m => m[1].trim());
        fail(names.includes(scenario.name), `${at}: missing Scenario ${scenario.name}`);
      }
      // A link is evidence of a mapping, not proof that the implementation satisfies the requirement.
      if (!evidence.has(entry.element)) evidence.set(entry.element, []);
      evidence.get(entry.element).push({ uc: at, tier: entry.tier, file: entry.file, anchor: entry.anchor, scenarios: entry.scenarios });
    }
  }
  for (const [group, ucs] of groups) {
    ucs.sort((a, b) => a.uc < b.uc ? -1 : a.uc > b.uc ? 1 : 0);
    const lines = [`# ${cell(ucs[0].buc)}`, '', '## 概要', '', '所属UCと契約の呼出依存を示す生成ビュー。依存は実行順序を意味しない。', '',
      '## 所属 UC 一覧', '', '| UC | 提供する操作 |', '|----|--------------|'];
    for (const uc of ucs) lines.push(`| [${cell(uc.uc)}](${link(uc.uc)}/spec.md) | ${cell(uc.provides.map(e => e.operation_id).join(', '))} |`);
    const dependencies = ucs.flatMap(uc => uc.consumes.map(op => ({ uc, op, owner: owners.get(`${op.kind}:${op.operation_id}`) })));
    if (dependencies.length) {
      lines.push('', '## 契約の呼出依存', '', '| 利用UC | operation | 所有UC |', '|--------|-----------|--------|');
      for (const { uc, op, owner } of dependencies) lines.push(`| ${cell(uc.uc)} | ${cell(op.operation_id)} | [${cell(owner)}](${link(path.posix.relative(group, `${owner}/spec.md`))}) |`);
    }
    files.set(`${group}/buc-spec.md`, lines.join('\n') + '\n');
  }
  const rows = inventory.map(e => ({ ...e, status: evidence.has(e.key) ? 'linked' : 'unlinked', evidence: evidence.get(e.key) || [] }));
  const counts = Object.fromEntries([...new Set(rows.map(r => r.category))].map(category => {
    const subset = rows.filter(r => r.category === category);
    return [category, { total: subset.length, linked: subset.filter(r => r.status === 'linked').length }];
  }));
  files.set('_cross-cutting/traceability-index.json', encode({ schema_version: 'distillery.traceability/v1', counts, elements: rows }));
  const lines = ['# 要件トレーサビリティマトリクス', '',
    '機械検査は対応先・tier・Scenarioの実在を確認する。linkedは意味上の充足や実装完了を保証しない。意味上の網羅率は独立レビューで判断する。', '',
    '## 対応付けサマリー', '', '| カテゴリ | 全要素 | linked | unlinked |', '|----------|-------:|-------:|---------:|'];
  for (const [category, count] of Object.entries(counts)) lines.push(`| ${category} | ${count.total} | ${count.linked} | ${count.total - count.linked} |`);
  const typeLabels = { information: '情報の属性', variation: 'バリエーションの値', condition: '条件', state: '状態遷移', external: '外部システム' };
  const columns = catalog.use_cases.map(uc => ({ path: ucPath(uc), name: uc.uc }));
  const nameCounts = new Map();
  for (const uc of columns) nameCounts.set(uc.name, (nameCounts.get(uc.name) || 0) + 1);
  lines.push('', '## 要素と対応先', '',
    '行はRDRA要素、列は全UC。セルには対応箇所（従来の括弧書き）を表示し、根拠ファイルへリンクする。空欄はそのUCへの対応記録がないことを示す。', '',
    `| 種類 | 要素 | 対応状況 | ${columns.map(uc => `[${cell(nameCounts.get(uc.name) > 1 ? uc.path : uc.name)}](${link('../' + uc.path + '/spec.md')})`).join(' | ')} |`,
    `|------|------|------|${columns.map(() => '------|').join('')}`);
  for (const row of rows) {
    const cells = columns.map(uc => [...new Set(row.evidence.filter(e => e.uc === uc.path)
      .map(e => `[${cell(e.anchor)}](${link('../' + e.file)})`))].join('<br>'));
    lines.push(`| ${typeLabels[row.category]} | ${cell(row.element)} | ${row.status} | ${cells.join(' | ')} |`);
  }
  files.set('_cross-cutting/traceability-matrix.md', lines.join('\n') + '\n');
  return files;
}
if (require.main === module) {
  try {
    const [eventRoot, rdraRoot] = process.argv.slice(2);
    fail(eventRoot && rdraRoot, 'Usage: node buildSpecViews.js <event-root> <rdra-root> [--check]');
    const files = build(eventRoot, rdraRoot);
    const targets = [...files].map(([rel, text]) => [path.resolve(eventRoot, rel), text]);
    for (const [target] of targets) {
      let check = target;
      while (!fs.existsSync(check)) check = path.dirname(check);
      fail(fs.realpathSync(check).startsWith(fs.realpathSync(eventRoot) + path.sep), `Output outside event: ${target}`);
    }
    for (const [target, text] of targets) {
      if (process.argv.includes('--check')) fail(fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text, `Stale view: ${target}`);
      else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); }
    }
    console.log(JSON.stringify({ status: 'ok', files: files.size }));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { build, elements, tsv };
