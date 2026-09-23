#!/usr/bin/env node
'use strict';

/**
 * compileRdbSchema.js <contracts-dir> [--check]
 *
 * contracts/db/rdb-schema.yaml (入口: domains 一覧) と domains/<id>.yaml (サブドメイン別テーブル定義) を
 * bundle し、table-index と UC ごとの rdb-slice を生成する。
 * v1 (dist-spec/compileRdbSchema.js) の移植だが v2 では:
 *  - arch-design.yaml への entity_id/architecture_ref 依存を廃止 (ADR が決めるため契約段では検証しない)。
 *  - domain-slice (サブドメイン単位) をやめ、uc-index.yaml の tables から UC 単位 rdb-slice を作る。
 *
 * 出力: generated/rdb-schema.bundle.yaml, generated/table-index.yaml,
 *       generated/slices/<slug>/rdb-slice.yaml
 */

const fs = require('node:fs');
const path = require('node:path');
const C = require('./lib/contractsDir');
const { parseYaml } = require('../../../scripts/lib/yaml');

const ENTRY_VERSION = 'distillery2.rdb-split/v1';
const ALLOWED_TYPES = new Set(['string', 'integer', 'bigint', 'decimal', 'boolean', 'date', 'datetime', 'text', 'uuid']);
// 生成 SQL の識別子として安全な名前だけ許す。ハイフン等を含む名前は引用が要り、DDL に素で埋めると壊れる。
// 生成側 (genRdbDdl) は識別子を二重引用符で囲うが、入口でも SQL 識別子規則に制限しておく (Finding 2)。
const safeName = v => typeof v === 'string' && /^[a-z][a-z0-9_]*$/.test(v);
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const arr = (v, label) => { assert(Array.isArray(v), `${label}: expected array`); return v; };
const unique = (v, label) => assert(new Set(v).size === v.length, `${label}: duplicate`);

function read(file) {
  assert(fs.existsSync(file) && !fs.lstatSync(file).isSymbolicLink(), `missing or symlink: ${file}`);
  return parseYaml(fs.readFileSync(file, 'utf8'));
}
function columnsExist(cols, table, label) {
  arr(cols, label); assert(cols.length > 0, `${label}: empty`); unique(cols, label);
  for (const c of cols) assert(table.columns.some(x => x.name === c), `${label}: missing column ${c}`);
}

/** 入口 + domains を読み、全テーブルを検証して Map<name, table> と所有サブドメインを返す。 */
function loadTables(dbDir) {
  const entry = path.join(dbDir, 'rdb-schema.yaml');
  const source = read(entry);
  assert(source.schema_version === ENTRY_VERSION && source.datastore === 'rdb', `unsupported rdb entry (need ${ENTRY_VERSION})`);
  assert(!('tables' in source), 'entry must not contain tables: define them in domains/');
  const domains = arr(source.domains, 'domains');
  assert(domains.length > 0, 'domains cannot be empty');
  unique(domains.map(d => d.id), 'domain id'); unique(domains.map(d => d.file), 'domain file');
  const tables = new Map(), owners = new Map();
  for (const domain of domains) {
    assert(safeName(domain.id), `invalid domain id: ${domain.id}`);
    assert(domain.file === `domains/${domain.id}.yaml`, `domain file must be domains/${domain.id}.yaml`);
    const doc = read(path.join(dbDir, domain.file));
    assert(doc.subdomain_id === domain.id, `subdomain identity mismatch: ${domain.file}`);
    for (const table of arr(doc.tables, `${domain.id} tables`)) {
      assert(safeName(table.name), `invalid table name: ${table.name}`);
      assert(!tables.has(table.name), `duplicate table: ${table.name}`);
      tables.set(table.name, table); owners.set(table.name, domain.id);
    }
  }
  assert(tables.size > 0, 'no tables');
  validateTables(tables);
  return { source, domains, tables, owners };
}

function validateTables(tables) {
  for (const [name, table] of tables) {
    assert(typeof table.description === 'string' && table.description.trim(), `${name}: table description required`);
    arr(table.columns, `${name} columns`); assert(table.columns.length > 0, `${name}: no columns`);
    unique(table.columns.map(c => c.name), `${name} column`);
    for (const col of table.columns) {
      assert(safeName(col.name) && ALLOWED_TYPES.has(col.type) && typeof col.nullable === 'boolean',
        `${name}.${col.name}: invalid column/type/nullable`);
      assert(typeof col.description === 'string' && col.description.trim(), `${name}.${col.name}: column description required`);
      if (col.enum !== undefined) {
        arr(col.enum, `${name}.${col.name} enum`); assert(col.enum.length > 0, `${name}.${col.name}: empty enum`);
        unique(col.enum, `${name}.${col.name} enum`);
        for (const v of col.enum) assert(typeof v === 'string' && v.trim(), `${name}.${col.name}: enum values must be non-empty strings`);
      }
    }
    columnsExist(table.primary_key, table, `${name} primary key`);
    for (const k of table.primary_key) assert(!table.columns.find(c => c.name === k).nullable, `${name}.${k}: nullable primary key`);
    unique((table.indexes || []).map(i => i.name), `${name} index`);
    for (const idx of table.indexes || []) {
      assert(safeName(idx.name) && typeof idx.unique === 'boolean', `${name}: invalid index ${idx.name}`);
      columnsExist(idx.columns, table, `${name} index ${idx.name}`);
    }
  }
  for (const [name, table] of tables) {
    for (const fk of table.foreign_keys || []) {
      columnsExist(fk.columns, table, `${name} foreign key`);
      const target = tables.get(fk.references?.table);
      assert(target, `${name}: missing FK target ${fk.references?.table}`);
      columnsExist(fk.references.columns, target, `${name} FK target ${target.name}`);
      assert(fk.columns.length === fk.references.columns.length, `${name}: FK arity mismatch`);
      const isUnique = JSON.stringify(target.primary_key) === JSON.stringify(fk.references.columns)
        || (target.indexes || []).some(i => i.unique && JSON.stringify(i.columns) === JSON.stringify(fk.references.columns));
      assert(isUnique, `${name}: FK target is not an unconditional unique key`);
      fk.columns.forEach((c, i) => assert(
        table.columns.find(x => x.name === c).type === target.columns.find(x => x.name === fk.references.columns[i]).type,
        `${name}.${c}: FK type mismatch`));
      if (fk.on_delete) assert(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'].includes(fk.on_delete), `${name}: invalid on_delete`);
      if (fk.on_delete === 'SET NULL') assert(fk.columns.every(c => table.columns.find(x => x.name === c).nullable), `${name}: SET NULL on non-null column`);
    }
  }
}

/** uc.tables を起点に、推移的 FK 参照先を read_only 外部テーブル (キー列のみ) として含む slice を作る。 */
function ucSlice(tables, owners, ucTables) {
  const local = ucTables.map(n => { assert(tables.has(n), `uc-index references unknown table: ${n}`); return tables.get(n); });
  const localSet = new Set(ucTables);
  const required = new Map();
  const queue = [...local], visited = new Set();
  while (queue.length) {
    const table = queue.shift();
    if (visited.has(table.name)) continue;
    visited.add(table.name);
    for (const fk of table.foreign_keys || []) {
      const target = tables.get(fk.references.table);
      if (!localSet.has(target.name)) {
        if (!required.has(target.name)) required.set(target.name, new Set(target.primary_key));
        fk.references.columns.forEach(c => required.get(target.name).add(c));
      }
      queue.push(target);
    }
  }
  const external = [...required.keys()].sort((a, b) => a.localeCompare(b, 'en')).map(tname => {
    const table = tables.get(tname);
    const keys = required.get(tname);
    for (const fk of table.foreign_keys || []) fk.columns.forEach(c => keys.add(c));
    return {
      name: table.name, owner_subdomain_id: owners.get(table.name), read_only: true,
      columns: table.columns.filter(c => keys.has(c.name)), primary_key: table.primary_key,
      foreign_keys: table.foreign_keys || [],
      indexes: (table.indexes || []).filter(i => i.unique && i.columns.every(c => keys.has(c))),
    };
  });
  const localOrdered = [...local].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return { schema_version: 'distillery2.rdb-slice/v1', tables: localOrdered, external_tables: external };
}

function compile(contractsDir) {
  const dbDir = path.join(contractsDir, 'db');
  const { source, tables, owners } = loadTables(dbDir);
  const ucIndex = C.readUcIndex(contractsDir);
  const ordered = [...tables.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const files = new Map();
  files.set('rdb-schema.bundle.yaml', C.encodeYaml({ version: source.version, datastore: 'rdb', tables: ordered }));
  files.set('table-index.yaml', C.encodeYaml({
    schema_version: 'distillery2.rdb-table-index/v1', generated: true,
    tables: ordered.map(t => ({ table: t.name, subdomain_id: owners.get(t.name), source: `../db/domains/${owners.get(t.name)}.yaml` })),
  }));
  for (const uc of ucIndex.ucs) {
    if (!uc.tables.length) continue;
    files.set(`slices/${uc.slug}/rdb-slice.yaml`, C.encodeYaml(ucSlice(tables, owners, [...uc.tables].sort())));
  }
  return { files, ucIndex };
}

function run(contractsDir, check = false) {
  const dir = fs.realpathSync(contractsDir);
  const { files } = compile(dir);
  const genDir = C.generatedDir(dir);
  const stale = [], written = [], removed = [];
  for (const [rel, text] of files) {
    const target = path.join(genDir, rel);
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text) continue;
    if (check) { stale.push(`generated/${rel}`); continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
    written.push(`generated/${rel}`);
  }
  // 旧 rdb-slice の掃除 (Finding 5): 期待集合 = tables を持つ UC の rdb-slice。
  // tables を空にした / 消えた UC の rdb-slice は、生成で削除し --check で stale とする。
  // slices/<uc>/ 配下の contract-slice.json は compileContracts の所有物なので触らない。
  const expected = new Set([...files.keys()].filter(rel => rel.endsWith('/rdb-slice.yaml')));
  const slicesDir = path.join(genDir, 'slices');
  if (fs.existsSync(slicesDir)) for (const name of fs.readdirSync(slicesDir)) {
    const rel = `slices/${name}/rdb-slice.yaml`;
    if (!expected.has(rel) && fs.existsSync(path.join(genDir, rel))) {
      if (check) stale.push(`generated/${rel} (obsolete)`);
      else { fs.rmSync(path.join(genDir, rel), { force: true }); removed.push(`generated/${rel}`); }
    }
  }
  assert(!check || stale.length === 0, `Stale generated RDB files: ${stale.join(', ')}`);
  return { status: check ? 'current' : 'generated', files: files.size, written, removed, tables: [...new Set([...files.keys()])].length };
}

module.exports = { compile, run, loadTables, ucSlice, validateTables };

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const contractsDir = args.find(a => !a.startsWith('--'));
    assert(contractsDir, 'Usage: compileRdbSchema.js <contracts-dir> [--check]');
    console.log(JSON.stringify(run(contractsDir, args.includes('--check'))));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
