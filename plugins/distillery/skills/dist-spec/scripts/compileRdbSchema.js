#!/usr/bin/env node
'use strict';
// Split authoring is a document boundary, never a physical database boundary.
const fs = require('node:fs');
const path = require('node:path');
const YAML = require(process.env.YAML_MODULE || 'yaml');
const VERSION = 'distillery.rdb-split/v1';
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const list = (value, label) => { assert(Array.isArray(value), `${label}: expected array`); return value; };
const unique = (values, label) => assert(new Set(values).size === values.length, `${label}: duplicate`);
const safeName = value => typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
const read = filename => {
  const document = YAML.parseDocument(fs.readFileSync(filename, 'utf8'), { uniqueKeys: true });
  assert(!document.errors.length, `${filename}: ${document.errors.map(e => e.message).join('; ')}`);
  return document.toJS({ maxAliasCount: 100 });
};
const encode = value => YAML.stringify(value, { lineWidth: 0, aliasDuplicateObjects: false });
function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}
function securePath(root, relative) {
  assert(typeof relative === 'string' && relative && !path.isAbsolute(relative), `relative path required: ${relative}`);
  const target = path.resolve(root, relative);
  assert(inside(root, target), `path escapes schema directory: ${relative}`);
  let current = root;
  for (const segment of path.relative(root, target).split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) || (() => { try { fs.lstatSync(current); return true; } catch { return false; } })()) {
      assert(!fs.lstatSync(current).isSymbolicLink(), `symlink is forbidden: ${current}`);
    }
  }
  return target;
}
function columnsExist(columns, table, label) {
  list(columns, label); assert(columns.length > 0, `${label}: empty key`); unique(columns, label);
  for (const column of columns) assert(table.columns.some(c => c.name === column), `${label}: missing column ${column}`);
}
function compileRdbSchema(entryPath, options = {}) {
  const entry = path.resolve(entryPath);
  const root = fs.realpathSync(path.dirname(entry));
  assert(!fs.lstatSync(entry).isSymbolicLink(), 'entry cannot be a symlink');
  const source = read(entry);
  assert(source.schema_version === VERSION && source.datastore === 'rdb' && source.version === '1.0', 'unsupported split RDB schema');
  assert(!('tables' in source), 'entry contains tables: editable definitions belong only in domains/');
  const archRef = source.architecture_ref;
  assert(typeof archRef === 'string' && !path.isAbsolute(archRef) && /(?:^|\/)latest\/arch-design\.yaml$/.test(archRef), 'architecture_ref must address latest/arch-design.yaml');
  const architecturePath = path.resolve(root, archRef);
  const architecture = read(architecturePath).domain_architecture;
  assert(architecture, 'architecture has no domain_architecture: request architecture feedback');
  const declaredDomains = new Set(list(architecture.subdomains, 'architecture subdomains').map(d => d.id));
  const entityOwners = new Map();
  for (const bc of list(architecture.bounded_contexts, 'architecture bounded_contexts')) {
    for (const entity of bc.owned_entity_ids || []) {
      if (!entityOwners.has(entity)) entityOwners.set(entity, new Set());
      entityOwners.get(entity).add(bc.related_subdomain_id);
    }
  }
  const domains = list(source.domains, 'domains');
  assert(domains.length > 0, 'domains cannot be empty');
  unique(domains.map(d => d.id), 'domain id'); unique(domains.map(d => d.file), 'domain file');
  const tables = new Map();
  const owners = new Map();
  const inputs = [entry, architecturePath];
  for (const domain of domains) {
    assert(safeName(domain.id) && declaredDomains.has(domain.id), `undeclared subdomain ${domain.id}: request architecture feedback`);
    assert(domain.file === `domains/${domain.id}.yaml`, `domain file must be domains/${domain.id}.yaml`);
    const domainPath = securePath(root, domain.file);
    inputs.push(domainPath);
    const document = read(domainPath);
    assert(document.subdomain_id === domain.id, `subdomain identity mismatch: ${domain.file}`);
    for (const table of list(document.tables, `${domain.id} tables`)) {
      assert(safeName(table.name), 'invalid table name');
      assert(!tables.has(table.name), `duplicate table ownership: ${table.name}`);
      const mapped = entityOwners.get(table.entity_id);
      assert(mapped?.size === 1 && mapped.has(domain.id), `ambiguous or missing architecture ownership: ${table.name}/${table.entity_id}; request architecture feedback`);
      tables.set(table.name, table); owners.set(table.name, domain.id);
    }
  }
  assert(tables.size > 0, 'no tables');
  const allowedTypes = new Set(['string', 'integer', 'bigint', 'decimal', 'boolean', 'date', 'datetime', 'text', 'uuid']);
  for (const [name, table] of tables) {
    list(table.columns, `${name} columns`); assert(table.columns.length > 0, `${name}: no columns`);
    unique(table.columns.map(c => c.name), `${name} column`);
    for (const column of table.columns) {
      assert(safeName(column.name) && allowedTypes.has(column.type) && typeof column.nullable === 'boolean', `${name}.${column.name}: invalid column/type/nullable`);
    }
    columnsExist(table.primary_key, table, `${name} primary key`);
    for (const key of table.primary_key) assert(!table.columns.find(c => c.name === key).nullable, `${name}.${key}: nullable primary key`);
    unique((table.indexes || []).map(i => i.name), `${name} index`);
    for (const index of table.indexes || []) {
      assert(safeName(index.name) && typeof index.unique === 'boolean', `${name}: invalid index`);
      columnsExist(index.columns, table, `${name} index ${index.name}`);
    }
  }
  for (const [name, table] of tables) {
    for (const fk of table.foreign_keys || []) {
      columnsExist(fk.columns, table, `${name} foreign key`);
      const target = tables.get(fk.references?.table);
      assert(target, `${name}: missing FK target ${fk.references?.table}`);
      columnsExist(fk.references.columns, target, `${name} FK target ${target.name}`);
      assert(fk.columns.length === fk.references.columns.length, `${name}: FK arity mismatch`);
      const isUnique = JSON.stringify(target.primary_key) === JSON.stringify(fk.references.columns) || (target.indexes || []).some(i => i.unique && !i.where && !i.predicate && !i.partial_condition && JSON.stringify(i.columns) === JSON.stringify(fk.references.columns));
      assert(isUnique, `${name}: FK target is not an unconditional unique key`);
      fk.columns.forEach((column, i) => assert(table.columns.find(c => c.name === column).type === target.columns.find(c => c.name === fk.references.columns[i]).type, `${name}.${column}: FK type mismatch`));
      if (fk.on_delete) assert(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'].includes(fk.on_delete), `${name}: invalid on_delete`);
      if (fk.on_delete === 'SET NULL') assert(fk.columns.every(c => table.columns.find(x => x.name === c).nullable), `${name}: SET NULL on non-null column`);
    }
  }
  const ordered = [...tables.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const legacyTable = table => { const { entity_id, ...legacy } = table; return legacy; };
  const outputs = new Map();
  outputs.set('generated/rdb-schema.bundle.yaml', encode({ version: source.version, datastore: 'rdb', tables: ordered.map(legacyTable) }));
  for (const domain of [...domains].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    const local = ordered.filter(t => owners.get(t.name) === domain.id);
    const required = new Map();
    const queue = [...local];
    const visited = new Set();
    // Each reachable FK is retained, including transitive FK edges and cycles.
    while (queue.length) {
      const table = queue.shift();
      if (visited.has(table.name)) continue;
      visited.add(table.name);
      for (const fk of table.foreign_keys || []) {
        const target = tables.get(fk.references.table);
        if (owners.get(target.name) !== domain.id) {
          if (!required.has(target.name)) required.set(target.name, new Set(target.primary_key));
          fk.references.columns.forEach(c => required.get(target.name).add(c));
        }
        queue.push(target);
      }
    }
    const external = ordered.filter(t => required.has(t.name)).map(table => {
      const keys = required.get(table.name);
      // Outbound FK columns are needed to expose transitive relations correctly.
      for (const fk of table.foreign_keys || []) fk.columns.forEach(c => keys.add(c));
      return { name: table.name, owner_subdomain_id: owners.get(table.name), read_only: true,
        source: `../../domains/${owners.get(table.name)}.yaml`,
        columns: table.columns.filter(c => keys.has(c.name)), primary_key: table.primary_key,
        foreign_keys: table.foreign_keys || [],
        indexes: (table.indexes || []).filter(i => i.unique && !i.where && !i.predicate && !i.partial_condition && i.columns.every(c => keys.has(c))) };
    });
    outputs.set(`generated/domain-slices/${domain.id}.yaml`, encode({ schema_version: 'distillery.rdb-domain-slice/v1', generated: true,
      subdomain_id: domain.id, tables: local.map(legacyTable), external_tables: external }));
  }
  const stale = [];
  // Check all paths before writing any output; never follow generated symlinks.
  const destinations = [...outputs].map(([relative, content]) => [securePath(root, relative), relative, content]);
  const slices = securePath(root, 'generated/domain-slices');
  if (fs.existsSync(slices)) for (const name of fs.readdirSync(slices)) {
    if (!outputs.has(`generated/domain-slices/${name}`)) stale.push(`generated/domain-slices/${name} (unexpected)`);
  }
  assert(stale.length === 0, `unexpected generated files; remove explicitly: ${stale.join(', ')}`);
  for (const [target, relative, content] of destinations) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) stale.push(relative);
  }
  if (options.check) assert(stale.length === 0, `stale RDB projections: ${stale.join(', ')}`);
  else for (const [target, , content] of destinations) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
  return { schema_version: VERSION, domains: domains.length, tables: tables.size, inputs, outputs: [...outputs.keys()], stale: options.check ? [] : stale };
}
module.exports = { compileRdbSchema, VERSION };
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    assert(args.length >= 1 && args.length <= 2 && (!args[1] || args[1] === '--check'), 'usage: compileRdbSchema.js <rdb-schema.yaml> [--check]');
    process.stdout.write(`${JSON.stringify(compileRdbSchema(args[0], { check: args.includes('--check') }), null, 2)}\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
