'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SCRIPTS, freshContracts } = require('./support');
const { parseYaml } = require('../../../plugins/distillery2/scripts/lib/yaml');

const compileRdbSchema = require(path.join(SCRIPTS, 'compileRdbSchema.js'));

test('bundle・table-index・rdb-slice を生成する', () => {
  const { contractsDir } = freshContracts();
  const r = compileRdbSchema.run(contractsDir);
  assert.equal(r.status, 'generated');
  const gen = path.join(contractsDir, 'generated');
  const bundle = parseYaml(fs.readFileSync(path.join(gen, 'rdb-schema.bundle.yaml'), 'utf8'));
  assert.deepEqual(bundle.tables.map(t => t.name), ['books', 'loans']);
  const index = parseYaml(fs.readFileSync(path.join(gen, 'table-index.yaml'), 'utf8'));
  assert.equal(index.tables.find(t => t.table === 'loans').subdomain_id, 'loans');
  const slice = parseYaml(fs.readFileSync(path.join(gen, 'slices/loan-register/rdb-slice.yaml'), 'utf8'));
  assert.deepEqual(slice.tables.map(t => t.name), ['books', 'loans']);
});

test('UC が一部テーブルだけ使う場合、FK 参照先は external_tables にキー列だけで載る', () => {
  const { contractsDir } = freshContracts();
  // uc-index を loans だけ使う形へ書き換える
  const uc = path.join(contractsDir, 'uc-index.yaml');
  fs.writeFileSync(uc, fs.readFileSync(uc, 'utf8').replace(/    tables:\n      - loans\n      - books/, '    tables:\n      - loans'));
  compileRdbSchema.run(contractsDir);
  const slice = parseYaml(fs.readFileSync(path.join(contractsDir, 'generated/slices/loan-register/rdb-slice.yaml'), 'utf8'));
  assert.deepEqual(slice.tables.map(t => t.name), ['loans']);
  const books = slice.external_tables.find(t => t.name === 'books');
  assert.ok(books, 'books が external_tables に載る');
  assert.equal(books.read_only, true);
  // FK 参照キー (id) だけを含み、非キー列 (title) は含まない
  assert.deepEqual(books.columns.map(c => c.name), ['id']);
});

test('--check は生成直後は成功し、domain を編集すると失敗する', () => {
  const { contractsDir } = freshContracts();
  compileRdbSchema.run(contractsDir);
  assert.equal(compileRdbSchema.run(contractsDir, true).status, 'current');
  const dom = path.join(contractsDir, 'db/domains/loans.yaml');
  fs.writeFileSync(dom, fs.readFileSync(dom, 'utf8').replace('貸出状態', '貸出のステータス'));
  assert.throws(() => compileRdbSchema.run(contractsDir, true), /Stale generated RDB/);
});
