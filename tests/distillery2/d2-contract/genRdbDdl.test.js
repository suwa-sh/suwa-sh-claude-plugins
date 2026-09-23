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
  assert.match(sql, /CREATE TYPE loans_status AS ENUM \('borrowed', 'returned'\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS books/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS loans/);
  assert.match(sql, /FOREIGN KEY \(book_id\) REFERENCES books \(id\) ON DELETE RESTRICT/);
  // 参照先 books が loans より前に作られる
  assert.ok(sql.indexOf('CREATE TABLE IF NOT EXISTS books') < sql.indexOf('CREATE TABLE IF NOT EXISTS loans'));
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
