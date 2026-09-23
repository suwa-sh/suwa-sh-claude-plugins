'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SCRIPTS, freshContracts } = require('./support');

const compileContracts = require(path.join(SCRIPTS, 'compileContracts.js'));
const compileRdbSchema = require(path.join(SCRIPTS, 'compileRdbSchema.js'));
const validateUcIndex = require(path.join(SCRIPTS, 'validateUcIndex.js'));

function compiled() {
  const { contractsDir } = freshContracts();
  compileContracts.run(contractsDir);
  compileRdbSchema.run(contractsDir);
  return contractsDir;
}

test('examples 付き operation だけを使う UC は PASS', () => {
  const { errors } = validateUcIndex.validate(compiled());
  assert.deepEqual(errors, []);
});

test('example の無い operation を UC が参照すると FAIL', () => {
  const contractsDir = compiled();
  const uc = path.join(contractsDir, 'uc-index.yaml');
  fs.writeFileSync(uc, fs.readFileSync(uc, 'utf8').replace('      - getBook', '      - getBook\n      - returnLoan'));
  const { errors } = validateUcIndex.validate(contractsDir);
  assert.ok(errors.some(e => /returnLoan/.test(e) && /example/.test(e)), errors.join('\n'));
});

test('存在しない table を参照すると FAIL', () => {
  const contractsDir = compiled();
  const uc = path.join(contractsDir, 'uc-index.yaml');
  fs.writeFileSync(uc, fs.readFileSync(uc, 'utf8').replace('      - books', '      - books\n      - ghosts'));
  const { errors } = validateUcIndex.validate(contractsDir);
  assert.ok(errors.some(e => /ghosts/.test(e)), errors.join('\n'));
});
