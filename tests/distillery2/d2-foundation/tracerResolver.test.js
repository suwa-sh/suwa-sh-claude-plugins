'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SCRIPTS, freshContracts } = require('../d2-contract/support');

const compileContracts = require(path.join(SCRIPTS, 'compileContracts.js'));
const TRACER = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-foundation/templates/test-support/src/tracer.ts');
const README = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-foundation/templates/test-support/README.md');

test('contract-slice.json の paths は openapi.paths にある (トップレベル paths ではない)', () => {
  const { contractsDir } = freshContracts();
  compileContracts.run(contractsDir);
  const slice = JSON.parse(fs.readFileSync(path.join(contractsDir, 'generated/slices/loan-register/contract-slice.json'), 'utf8'));
  assert.ok(slice.openapi && slice.openapi.paths, 'slice.openapi.paths should exist');
  assert.equal(slice.paths, undefined, 'top-level slice.paths should not exist');
  assert.ok(slice.openapi.paths['/loans'], 'expected /loans in openapi.paths');
});

test('tracer の createOperationIdResolver は slice.openapi.paths を読む', () => {
  const src = fs.readFileSync(TRACER, 'utf8');
  // 修正前は slice.paths のみ参照して operationId を 1 件も解決できなかった
  assert.match(src, /slice\.openapi\?\.paths/);
});

test('README は slice を openapi.paths として読むと説明する', () => {
  const md = fs.readFileSync(README, 'utf8');
  assert.match(md, /openapi\.paths/);
});
