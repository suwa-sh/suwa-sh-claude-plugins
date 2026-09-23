'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SCRIPTS, freshContracts } = require('./support');

const compileContracts = require(path.join(SCRIPTS, 'compileContracts.js'));

test('bundle と UC slice を生成する', () => {
  const { contractsDir } = freshContracts();
  const r = compileContracts.run(contractsDir);
  assert.equal(r.status, 'generated');
  const gen = path.join(contractsDir, 'generated');
  assert.ok(fs.existsSync(path.join(gen, 'openapi.bundle.yaml')));
  assert.ok(fs.existsSync(path.join(gen, 'asyncapi.bundle.yaml')));
  const slice = JSON.parse(fs.readFileSync(path.join(gen, 'slices/loan-register/contract-slice.json'), 'utf8'));
  assert.deepEqual(Object.keys(slice.openapi.paths).sort(), ['/books/{id}', '/loans']);
  assert.deepEqual(Object.keys(slice.openapi.components.schemas).sort(), ['Book', 'CreateLoan', 'Loan', 'Problem']);
  // slice は UC が使わない returnLoan を含まない
  assert.ok(!Object.keys(slice.openapi.paths).includes('/loans/{id}'));
  // asyncapi slice に対象 message と operation が含まれる
  assert.deepEqual(Object.keys(slice.asyncapi.components.messages), ['LoanCreated']);
  assert.deepEqual(Object.keys(slice.asyncapi.operations), ['sendLoanCreated']);
});

test('--check は生成直後は成功し、source を編集すると失敗する', () => {
  const { contractsDir } = freshContracts();
  compileContracts.run(contractsDir);
  assert.equal(compileContracts.run(contractsDir, true).status, 'current');

  const src = path.join(contractsDir, 'openapi/openapi.yaml');
  fs.writeFileSync(src, fs.readFileSync(src, 'utf8').replace('貸出を登録する', '貸出を新規登録する'));
  assert.throws(() => compileContracts.run(contractsDir, true), /Stale generated contracts/);
});

test('生成は決定論的 (2 回の出力が一致する)', () => {
  const a = freshContracts(); compileContracts.run(a.contractsDir);
  const b = freshContracts(); compileContracts.run(b.contractsDir);
  const read = (dir, rel) => fs.readFileSync(path.join(dir, 'generated', rel), 'utf8');
  for (const rel of ['openapi.bundle.yaml', 'asyncapi.bundle.yaml', 'slices/loan-register/contract-slice.json']) {
    assert.equal(read(a.contractsDir, rel), read(b.contractsDir, rel), rel);
  }
});
