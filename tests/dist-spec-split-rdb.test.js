'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');
const { compileRdbSchema } = require('../plugins/distillery/skills/dist-spec/scripts/compileRdbSchema.js');
const col = name => ({ name, type: 'string', nullable: false });
const table = (name, entity_id, columns, primary_key, foreign_keys = [], indexes = []) => ({ name, entity_id, columns: columns.map(col), primary_key, foreign_keys, indexes });
const fk = (column, name, target) => ({ columns: [column], references: { table: name, columns: [target] } });
function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-rdb-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, object) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, YAML.stringify(object)); };
  const domains = [
    { subdomain_id: 'SD-001', tables: [table('loans', 'E-001', ['id', 'book_code'], ['id'], [fk('book_code', 'books', 'code')])] },
    { subdomain_id: 'SD-002', tables: [table('books', 'E-002', ['id', 'code', 'publisher_id', 'title'], ['id'], [fk('publisher_id', 'publishers', 'id')], [{ name: 'uq_books_code', columns: ['code'], unique: true }])] },
    { subdomain_id: 'SD-003', tables: [table('publishers', 'E-003', ['id', 'name'], ['id'])] }
  ];
  const entry = { schema_version: 'distillery.rdb-split/v1', version: '1.0', datastore: 'rdb', architecture_ref: '../arch/latest/arch-design.yaml', domains: domains.map(d => ({ id: d.subdomain_id, file: `domains/${d.subdomain_id}.yaml` })) };
  const arch = { domain_architecture: { subdomains: domains.map(d => ({ id: d.subdomain_id })), bounded_contexts: domains.map(d => ({ related_subdomain_id: d.subdomain_id, owned_entity_ids: d.tables.map(x => x.entity_id) })) } };
  write('arch/latest/arch-design.yaml', arch); write('schema/rdb-schema.yaml', entry);
  domains.forEach(d => write(`schema/domains/${d.subdomain_id}.yaml`, d));
  return { root, write, entry, arch, domains, run: options => compileRdbSchema(path.join(root, 'schema/rdb-schema.yaml'), options), read: file => YAML.parse(fs.readFileSync(path.join(root, `schema/generated/${file}`), 'utf8')) };
}
test('RDB slices retain unique target keys and transitive FK closure without unrelated columns', t => {
  const f = setup(t); assert.equal(f.run().tables, 3);
  const slice = f.read('domain-slices/SD-001.yaml');
  assert.equal(slice.tables[0].name, 'loans');
  assert.deepEqual(slice.external_tables.map(x => x.name), ['books', 'publishers']);
  const books = slice.external_tables[0];
  assert.deepEqual(books.columns.map(x => x.name), ['id', 'code', 'publisher_id']);
  assert.equal(books.indexes[0].name, 'uq_books_code');
  assert.equal(books.read_only, true); assert.equal(books.owner_subdomain_id, 'SD-002');
  assert.deepEqual(slice.external_tables[1].columns.map(x => x.name), ['id']);
  const bundle = f.read('rdb-schema.bundle.yaml');
  assert.equal(bundle.version, '1.0'); assert.ok(!('entity_id' in bundle.tables[0]));
  f.run({ check: true });
});
test('RDB key cycles terminate and expose relation closure', t => {
  const f = setup(t); f.domains[2].tables[0].foreign_keys = [fk('id', 'loans', 'id')];
  f.write('schema/domains/SD-003.yaml', f.domains[2]); f.run();
  assert.equal(f.read('domain-slices/SD-001.yaml').external_tables.length, 2);
});
test('RDB source mutation makes --check fail; regeneration propagates changed types', t => {
  const f = setup(t); f.run();
  f.domains[1].tables[0].columns.find(c => c.name === 'title').description = 'Updated';
  f.write('schema/domains/SD-002.yaml', f.domains[1]);
  assert.throws(() => f.run({ check: true }), /stale RDB/); f.run(); f.run({ check: true });
  assert.equal(f.read('domain-slices/SD-002.yaml').tables[0].columns.find(c => c.name === 'title').description, 'Updated');
});
test('RDB rejects duplicate owners and unresolved architecture boundaries', t => {
  const f = setup(t);
  f.domains[1].tables.push(f.domains[0].tables[0]); f.write('schema/domains/SD-002.yaml', f.domains[1]);
  assert.throws(() => f.run(), /duplicate table ownership/);
  f.domains[1].tables.pop(); f.write('schema/domains/SD-002.yaml', f.domains[1]);
  f.arch.domain_architecture.bounded_contexts[1].owned_entity_ids.push('E-001'); f.write('arch/latest/arch-design.yaml', f.arch);
  assert.throws(() => f.run(), /ambiguous or missing architecture ownership/);
});
test('RDB rejects absent FK tables, columns, nonunique targets, partial unique keys and mismatched types', t => {
  const f = setup(t); const book = f.domains[1].tables[0]; const relation = f.domains[0].tables[0].foreign_keys[0];
  relation.references.table = 'missing'; f.write('schema/domains/SD-001.yaml', f.domains[0]); assert.throws(() => f.run(), /missing FK target/);
  relation.references.table = 'books'; relation.references.columns = ['missing']; f.write('schema/domains/SD-001.yaml', f.domains[0]); assert.throws(() => f.run(), /missing column/);
  relation.references.columns = ['title']; f.write('schema/domains/SD-001.yaml', f.domains[0]); assert.throws(() => f.run(), /not an unconditional unique key/);
  relation.references.columns = ['code']; f.write('schema/domains/SD-001.yaml', f.domains[0]); book.indexes[0].partial_condition = "code != ''"; f.write('schema/domains/SD-002.yaml', f.domains[1]); assert.throws(() => f.run(), /not an unconditional unique key/);
  delete book.indexes[0].partial_condition; book.columns[1].type = 'integer'; f.write('schema/domains/SD-002.yaml', f.domains[1]); assert.throws(() => f.run(), /FK type mismatch/);
});
test('RDB rejects malformed columns, nullable primary keys and invalid indexes', t => {
  const f = setup(t); const book = f.domains[1].tables[0];
  book.columns[0].nullable = true; f.write('schema/domains/SD-002.yaml', f.domains[1]); assert.throws(() => f.run(), /nullable primary key/);
  book.columns[0].nullable = false; book.columns[0].type = 'unknown'; f.write('schema/domains/SD-002.yaml', f.domains[1]); assert.throws(() => f.run(), /invalid column/);
  book.columns[0].type = 'string'; book.indexes[0].columns = ['missing']; f.write('schema/domains/SD-002.yaml', f.domains[1]); assert.throws(() => f.run(), /missing column/);
});
test('RDB rejects traversal, source and output symlinks, pinned refs and stale extra slices', t => {
  const f = setup(t);
  f.entry.domains[0].file = '../outside.yaml'; f.write('schema/rdb-schema.yaml', f.entry); assert.throws(() => f.run(), /domain file must/);
  f.entry.domains[0].file = 'domains/SD-001.yaml'; f.entry.architecture_ref = '../arch/events/old/arch-design.yaml'; f.write('schema/rdb-schema.yaml', f.entry); assert.throws(() => f.run(), /must address latest/);
  f.entry.architecture_ref = '../arch/latest/arch-design.yaml'; f.write('schema/rdb-schema.yaml', f.entry);
  fs.mkdirSync(path.join(f.root, 'outside')); fs.symlinkSync(path.join(f.root, 'outside'), path.join(f.root, 'schema/generated')); assert.throws(() => f.run(), /symlink/); fs.unlinkSync(path.join(f.root, 'schema/generated'));
  const source = path.join(f.root, 'schema/domains/SD-001.yaml'); fs.renameSync(source, `${source}.real`); fs.symlinkSync(`${source}.real`, source); assert.throws(() => f.run(), /symlink/); fs.unlinkSync(source); fs.renameSync(`${source}.real`, source);
  f.run(); f.write('schema/generated/domain-slices/old.yaml', {}); assert.throws(() => f.run({ check: true }), /unexpected generated files/);
});
test('real RDB sample preserves latest source definitions and declared ownership', () => {
  const sample = path.resolve(__dirname, '../samples/distillery/spec-progressive/rdb');
  compileRdbSchema(path.join(sample, 'rdb-schema.yaml'), { check: true });
  const original = YAML.parse(fs.readFileSync(path.resolve(__dirname, '../samples/distillery/pipeline-opus-medium/specs/latest/_cross-cutting/datastore/rdb-schema.yaml'), 'utf8'));
  const generated = YAML.parse(fs.readFileSync(path.join(sample, 'generated/rdb-schema.bundle.yaml'), 'utf8'));
  for (const table of generated.tables) assert.deepEqual(table, original.tables.find(t => t.name === table.name));
  const slice = YAML.parse(fs.readFileSync(path.join(sample, 'generated/domain-slices/SD-001.yaml'), 'utf8'));
  assert.deepEqual(slice.external_tables.map(t => [t.name, t.columns.map(c => c.name)]), [['books', ['book_id']], ['users', ['user_no']]]);
});
test('RDB table index resolves owners without loading domain table definitions', t => {
  const f = setup(t); f.run();
  const index = f.read('table-index.yaml');
  assert.equal(index.generated, true);
  assert.deepEqual(index.tables.map(x => x.table), ['books', 'loans', 'publishers']);
  const loans = index.tables.find(x => x.table === 'loans');
  assert.deepEqual(loans, { table: 'loans', subdomain_id: 'SD-001', source: '../domains/SD-001.yaml' });
  const ownerFile = path.resolve(f.root, 'schema/generated', loans.source);
  assert.equal(YAML.parse(fs.readFileSync(ownerFile, 'utf8')).subdomain_id, loans.subdomain_id);
  assert.ok(index.tables.every(x => Object.keys(x).sort().join(',') === 'source,subdomain_id,table'));
  fs.writeFileSync(path.join(f.root, 'schema/generated/table-index.yaml'), 'stale');
  assert.throws(() => f.run({ check: true }), /table-index.yaml/);
});
