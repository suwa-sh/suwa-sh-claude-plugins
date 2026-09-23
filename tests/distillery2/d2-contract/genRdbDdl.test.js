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
