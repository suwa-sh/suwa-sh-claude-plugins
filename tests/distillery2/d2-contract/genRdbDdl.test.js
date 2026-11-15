'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SCRIPTS, CONFIG, freshContracts, outRoot } = require('./support');

const compileRdbSchema = require(path.join(SCRIPTS, 'compileRdbSchema.js'));
const genRdbDdl = require(path.join(SCRIPTS, 'genRdbDdl.js'));

function generated() {
  const { contractsDir } = freshContracts();
  compileRdbSchema.run(contractsDir);
  const out = outRoot();
  genRdbDdl.run(contractsDir, { configPath: CONFIG, outRoot: out });
  return out;
}
const read = (out, rel) => fs.readFileSync(path.join(out, rel), 'utf8');

test('migration SQL に enum 型・FK・冪等 CREATE が含まれる', () => {
  const out = generated();
  const sql = read(out, 'apps/backend-api/migrations/0001_schema.sql');
  // 識別子は二重引用符で囲う (Finding 2)。組み込み型 ENUM は素のまま。
  assert.match(sql, /CREATE TYPE "loans_status" AS ENUM \('borrowed', 'returned'\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "books"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "loans"/);
  assert.match(sql, /FOREIGN KEY \("book_id"\) REFERENCES "books" \("id"\) ON DELETE RESTRICT/);
  // 参照先 books が loans より前に作られる
  assert.ok(sql.indexOf('CREATE TABLE IF NOT EXISTS "books"') < sql.indexOf('CREATE TABLE IF NOT EXISTS "loans"'));
  // FK は CREATE TABLE 内ではなく ALTER TABLE で後付けする (全テーブル作成後)
  assert.match(sql, /ALTER TABLE "loans" ADD CONSTRAINT "loans_book_id_fkey" FOREIGN KEY \("book_id"\) REFERENCES "books" \("id"\)/);
  assert.ok(sql.indexOf('CREATE TABLE IF NOT EXISTS "loans"') < sql.indexOf('ALTER TABLE "loans" ADD CONSTRAINT'), 'FK ALTER should come after CREATE TABLE');
});

test('循環 FK でも参照先未作成にならない (ALTER で後付け)', () => {
  const tables = [
    { name: 'a', columns: [{ name: 'id', type: 'uuid', nullable: false }, { name: 'b_id', type: 'uuid', nullable: true }], primary_key: ['id'],
      foreign_keys: [{ columns: ['b_id'], references: { table: 'b', columns: ['id'] } }] },
    { name: 'b', columns: [{ name: 'id', type: 'uuid', nullable: false }, { name: 'a_id', type: 'uuid', nullable: true }], primary_key: ['id'],
      foreign_keys: [{ columns: ['a_id'], references: { table: 'a', columns: ['id'] } }] },
  ];
  const sql = genRdbDdl.buildSql(tables);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "a"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "b"/);
  // FK は 2 本とも ALTER TABLE で、CREATE TABLE 内に FOREIGN KEY は無い
  const alters = sql.match(/ADD CONSTRAINT "\w+" FOREIGN KEY/g) || [];
  assert.equal(alters.length, 2, sql);
  const fks = sql.match(/FOREIGN KEY/g) || [];
  assert.equal(fks.length, 2, 'all FKs must be ALTER-based (none inline)');
  // 冪等化の DO ブロックで囲う
  assert.match(sql, /DO \$\$ BEGIN[\s\S]*ADD CONSTRAINT "a_b_id_fkey" FOREIGN KEY[\s\S]*EXCEPTION WHEN duplicate_object/);
});

test('db-schema.test.ts が全テーブルを埋め込む', () => {
  const out = generated();
  const testTs = read(out, 'apps/backend-api/test/contract/db-schema.test.ts');
  assert.match(testTs, /@electric-sql\/pglite/);
  assert.match(testTs, /"name": "books"/);
  assert.match(testTs, /"name": "loans"/);
  assert.match(testTs, /information_schema\.columns/);
});

test('tables.ts に row 型と列名定数を生成する', () => {
  const out = generated();
  const ts = read(out, 'packages/contracts/db/tables.ts');
  assert.match(ts, /export type LoansRow = \{/);
  assert.match(ts, /status: 'borrowed' \| 'returned';/);
  assert.match(ts, /due_date: string \| null;/);
  assert.match(ts, /export const LOANS_TABLE = 'loans'/);
});

test('生成は決定論的', () => {
  const a = generated(), b = generated();
  const rel = 'apps/backend-api/migrations/0001_schema.sql';
  assert.equal(read(a, rel), read(b, rel));
});

test('--skip-if-unused: 表が 0 件・RDB の契約が無いときは何も書かない (作り直せる生成物の表から回す。0.3.0)', () => {
  const { contractsDir } = freshContracts();
  compileRdbSchema.run(contractsDir);
  const bundle = path.join(contractsDir, 'generated', 'rdb-schema.bundle.yaml');
  const text = fs.readFileSync(bundle, 'utf8');
  fs.writeFileSync(bundle, text.replace(/^tables:[\s\S]*$/m, 'tables: []\n'));
  const out = outRoot();
  const r = genRdbDdl.run(contractsDir, { configPath: CONFIG, outRoot: out, skipIfUnused: true });
  assert.equal(r.status, 'skipped');
  assert.equal(fs.existsSync(path.join(out, 'apps/backend-api/migrations/0001_schema.sql')), false);
  assert.equal(genRdbDdl.run(contractsDir, { configPath: CONFIG, outRoot: out, check: true, skipIfUnused: true }).status, 'skipped', '--check でも落ちない');
  assert.throws(() => genRdbDdl.run(path.join(contractsDir), { configPath: CONFIG, outRoot: out, check: true }), /Stale/, '付けなければ従来どおり');
});

test('--skip-if-unused: 表があっても、表を使う UC が uc-index に無ければ (基盤の直後の main) 書かず、--check も落ちない', () => {
  const { contractsDir } = freshContracts();
  compileRdbSchema.run(contractsDir);
  fs.writeFileSync(path.join(contractsDir, 'uc-index.yaml'), 'schema_version: distillery2.uc-index/v1\nucs: []\n');
  const out = outRoot();
  assert.equal(genRdbDdl.run(contractsDir, { configPath: CONFIG, outRoot: out, check: true, skipIfUnused: true }).reason, '表を使う UC が無い');
  assert.equal(fs.existsSync(path.join(out, 'apps/backend-api/migrations/0001_schema.sql')), false);
  fs.writeFileSync(path.join(contractsDir, 'uc-index.yaml'), 'schema_version: distillery2.uc-index/v1\nucs:\n  - slug: loan-register\n    operations: []\n    messages: []\n    tables: [loans]\n');
  assert.throws(() => genRdbDdl.run(contractsDir, { configPath: CONFIG, outRoot: out, check: true, skipIfUnused: true }), /Stale/, '表を使う UC ができたら鮮度を見る');
});

test('--skip-if-unused: 表を使う UC が無くなっても、生成物が残っていれば飛ばさず鮮度を見る', () => {
  const { contractsDir } = freshContracts();
  compileRdbSchema.run(contractsDir);
  const out = outRoot();
  genRdbDdl.run(contractsDir, { configPath: CONFIG, outRoot: out });
  fs.writeFileSync(path.join(contractsDir, 'uc-index.yaml'), 'schema_version: distillery2.uc-index/v1\nucs: []\n');
  assert.equal(genRdbDdl.run(contractsDir, { configPath: CONFIG, outRoot: out, check: true, skipIfUnused: true }).status, 'current');
  fs.appendFileSync(path.join(out, 'apps/backend-api/migrations/0001_schema.sql'), '-- 手で足した\n');
  assert.throws(() => genRdbDdl.run(contractsDir, { configPath: CONFIG, outRoot: out, check: true, skipIfUnused: true }), /Stale/);
});

// --- 一意制約 (主キーと UNIQUE) が 2 件目を弾くことを確かめるテスト ---
test('db-schema.test.ts が、一意制約ごとに 2 件目の行が 23505 で弾かれることを確かめる', () => {
  const out = generated();
  const testTs = read(out, 'apps/backend-api/test/contract/db-schema.test.ts');
  assert.match(testTs, /describe\('db unique constraints contract'/);
  assert.match(testTs, /expect\(rejected\?\.code\)\.toBe\('23505'\)/);
  // 外部キーの検査だけを止め、終わったら戻す
  assert.match(testTs, /SET session_replication_role = replica/);
  assert.match(testTs, /SET session_replication_role = DEFAULT/);
  // 入れた行は、次の制約の確認の前に消す
  assert.match(testTs, /finally \{\s*await db\.query\(`DELETE FROM/);
  // fixture の表 (books・loans) の主キーが載る
  const keys = JSON.parse(/const uniqueKeys: UniqueKey\[\] = (\[[\s\S]*?\n\]);/.exec(testTs)[1]);
  assert.deepEqual(keys.map(k => [k.table, k.columns, k.constraints]), [['books', ['id'], ['books_pkey']], ['loans', ['id'], ['loans_pkey']]]);
});

test('uniqueKeyCases: 主キーと UNIQUE の index ごとに、制約の列だけが同じ 2 件の行を作る (UNIQUE でない index は対象外)', () => {
  const tables = [{
    name: 'slots',
    columns: [
      { name: 'room_id', type: 'string', nullable: false }, { name: 'slot_start_at', type: 'datetime', nullable: false },
      { name: 'reservation_id', type: 'uuid', nullable: false }, { name: 'seq', type: 'integer', nullable: false },
      { name: 'active', type: 'boolean', nullable: false }, { name: 'day', type: 'date', nullable: true },
      { name: 'kind', type: 'string', nullable: false, enum: ['a', 'b'] },
    ],
    primary_key: ['room_id', 'slot_start_at'],
    indexes: [{ name: 'slots_reservation_id_key', columns: ['reservation_id'], unique: true }, { name: 'slots_day_idx', columns: ['day'], unique: false }],
  }];
  const cases = genRdbDdl.uniqueKeyCases(tables);
  assert.deepEqual(cases.map(c => [c.columns, c.constraints]), [[['room_id', 'slot_start_at'], ['slots_pkey']], [['reservation_id'], ['slots_reservation_id_key']]]);
  const first = { room_id: 'd2-1', slot_start_at: '2000-01-01T00:00:00Z', reservation_id: '00000000-0000-4000-8000-000000000001', seq: 1, active: true, day: '2000-01-01', kind: 'a' };
  assert.deepEqual(cases[0].first, first);
  // 主キーの列だけ同じで、ほかの列 (別の一意制約の列も) は違う値
  assert.deepEqual(cases[0].second, { room_id: 'd2-1', slot_start_at: '2000-01-01T00:00:00Z', reservation_id: '00000000-0000-4000-8000-000000000002', seq: 2, active: false, day: '2000-01-02', kind: 'b' });
  assert.equal(cases[1].second.reservation_id, first.reservation_id);
  assert.notEqual(cases[1].second.room_id, first.room_id);
});

test('uniqueKeyCases: 2 件目が別の一意制約にも当たるときは、その名前も照合の候補に入れる。63 バイトを超える名前は照合しない', () => {
  const col = (name, extra = {}) => ({ name, type: 'string', nullable: false, ...extra });
  // UNIQUE (a) は主キー (a, b) の列に含まれる。UNIQUE (only) は値を変えられない (値が 1 つの enum)
  const nested = genRdbDdl.uniqueKeyCases([{ name: 't', columns: [col('a'), col('b'), col('only', { enum: ['x'] })], primary_key: ['a', 'b'],
    indexes: [{ name: 't_a_key', columns: ['a'], unique: true }, { name: 't_only_key', columns: ['only'], unique: true }] }]);
  assert.deepEqual(nested.map(c => c.constraints), [['t_pkey', 't_a_key', 't_only_key'], ['t_a_key', 't_only_key'], ['t_only_key']]);
  const long = 'x'.repeat(60);
  assert.deepEqual(genRdbDdl.uniqueKeyCases([{ name: long, columns: [col('a')], primary_key: ['a'] }]).map(c => c.constraints), [null]);
});

// --- 外部レビューの指摘: 列が重なる一意制約では、弾きだけでは制約の欠けを見つけられない ---
test('db-schema.test.ts が、一意制約ごとに制約そのものの存在をカタログ (pg_constraint) の種類・列の並び・名前で確かめる', () => {
  const col = (name) => ({ name, type: 'string', nullable: false });
  const tables = [{ name: 't', columns: [col('id'), col('a'), col('b')], primary_key: ['id'],
    indexes: [{ name: 't_a_key', columns: ['a'], unique: true }, { name: 't_a_b_key', columns: ['a', 'b'], unique: true }] }];
  const testTs = genRdbDdl.dbSchemaTest(tables, 'apps/backend-api', '// head');
  assert.match(testTs, /FROM pg_constraint c/);
  assert.match(testTs, /c\.contype IN \('p', 'u'\)/);
  // 種類・列の並び・名前の 3 つで 1 件に決まることを見る
  assert.match(testTs, /r\.contype === key\.type && r\.cols === key\.columns\.join\(','\) && \(key\.name === null \|\| r\.conname === key\.name\)/);
  assert.match(testTs, /expect\(matched\.map\(r => r\.conname\), JSON\.stringify\(found\.rows\)\)\.toHaveLength\(1\)/);
  // 存在の確認は、弾きの確認より前に、制約ごとに 1 件ずつ出す
  assert.ok(testTs.indexOf('has the ${key.type') < testTs.indexOf('rejects a second row'));
  const keys = JSON.parse(/const uniqueKeys: UniqueKey\[\] = (\[[\s\S]*?\n\]);/.exec(testTs)[1]);
  assert.deepEqual(keys.map(k => [k.type, k.name, k.columns]), [['p', 't_pkey', ['id']], ['u', 't_a_key', ['a']], ['u', 't_a_b_key', ['a', 'b']]]);
  // UNIQUE(a, b) の 2 件目は UNIQUE(a) にも当たる (どちらが弾いても通る) ので、欠けは上の存在の確認が見つける。
  // UNIQUE(a) の 2 件目は b が違うので UNIQUE(a) だけに当たり、弾きの確認はその制約名だけを期待する
  assert.deepEqual(keys.map(k => k.constraints), [['t_pkey'], ['t_a_key'], ['t_a_key', 't_a_b_key']]);
});

test('uniqueKeyCases: 63 バイトを超える制約名は、存在の確認でも名前を照合しない (種類と列の並びで確かめる)', () => {
  const long = 'x'.repeat(60);
  const [pk] = genRdbDdl.uniqueKeyCases([{ name: long, columns: [{ name: 'a', type: 'string', nullable: false }], primary_key: ['a'] }]);
  assert.deepEqual([pk.type, pk.name, pk.columns], ['p', null, ['a']]);
});
