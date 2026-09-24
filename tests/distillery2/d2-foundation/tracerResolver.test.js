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

test('sanitizeScenarioId は sha256 8桁を接尾して一意にする (日本語衝突を防ぐ)', () => {
  const src = fs.readFileSync(TRACER, 'utf8');
  // 関数本体を切り出して、sha256 の 8 桁接尾があることを確認する
  const m = src.match(/export function sanitizeScenarioId[\s\S]*?\n}/);
  assert.ok(m, 'sanitizeScenarioId 関数が見つかる');
  const body = m[0];
  assert.match(body, /createHash\('sha256'\)/, 'sha256 を使う');
  assert.match(body, /digest\('hex'\)\.slice\(0,\s*8\)/, '先頭 8 桁を接尾する');
  // 旧実装 (単純に slice(0, 200) を返すだけ) ではない
  assert.doesNotMatch(body, /return scenarioId\.replace\([^)]*\)\.slice\(0, 200\);/);
});

test('sanitizeScenarioId: 異なる日本語シナリオは別ファイル名になる (関数を再現して確認)', () => {
  const crypto = require('node:crypto');
  // tracer.ts と同じロジックを再現し、衝突しないことを実測する
  const sanitize = (s) => {
    const ascii = s.replace(/[^A-Za-z0-9._#-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100);
    const hash = crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 8);
    return `${ascii || 'scenario'}-${hash}`;
  };
  const a = sanitize('貸出を登録する#会員が本を借りる');
  const b = sanitize('貸出を登録する#会員が別の本を借りる');
  assert.notEqual(a, b, '別シナリオは別ファイル名');
  assert.match(a, /-[0-9a-f]{8}$/);
});
