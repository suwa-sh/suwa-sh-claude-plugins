'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { validateAdrDir, parseFrontMatter } = require('../../../plugins/distillery2/skills/d2-decide/scripts/validateAdr');

const FIX = path.resolve(__dirname, '../../fixtures/distillery2');

test('parseFrontMatter は先頭の --- ブロックだけを取り出す', () => {
  const fm = parseFrontMatter('---\nid: "0007"\nstatus: accepted\n---\n\n# 背景\n---\nこれは本文\n');
  assert.equal(fm.id, '0007');
  assert.equal(fm.status, 'accepted');
});

test('正常な ADR 3 件 (superseded pair 含む) はエラー 0', () => {
  const { adrs, errors } = validateAdrDir(path.join(FIX, 'adr-pass'));
  assert.equal(adrs.length, 3);
  assert.deepEqual(errors, [], `unexpected errors: ${JSON.stringify(errors)}`);
});

test('id 重複を検出する', () => {
  const { errors } = validateAdrDir(path.join(FIX, 'adr-dup-id'));
  assert.ok(errors.some(e => /重複/.test(e.message)), JSON.stringify(errors));
});

test('dangling な superseded_by を検出する', () => {
  const { errors } = validateAdrDir(path.join(FIX, 'adr-dangling'));
  assert.ok(errors.some(e => /dangling/.test(e.message)), JSON.stringify(errors));
});

test('rules[].scope の書式違反を検出する', () => {
  const { errors } = validateAdrDir(path.join(FIX, 'adr-bad-scope'));
  assert.ok(errors.some(e => /rules\[0\]\.scope/.test(e.message) && /pattern/.test(e.message)), JSON.stringify(errors));
});

test('tiers[] を宣言する accepted ADR が無いとエラー', () => {
  const { errors } = validateAdrDir(path.join(FIX, 'adr-missing-tiers'));
  assert.ok(errors.some(e => /ティア構成の ADR が無い/.test(e.message)), JSON.stringify(errors));
});

test('tiers[].kind が enum 外だとスキーマエラー', () => {
  const { errors } = validateAdrDir(path.join(FIX, 'adr-bad-tier-kind'));
  assert.ok(errors.some(e => /tiers\[0\]\.kind/.test(e.message) && /enum/.test(e.message)), JSON.stringify(errors));
});

test('ティア構成 ADR + tiers 無しの system/app scope accepted ADR は PASS (指摘1)', () => {
  const { adrs, errors } = validateAdrDir(path.join(FIX, 'adr-two-accepted-system'));
  assert.equal(adrs.length, 2);
  assert.deepEqual(errors, [], `unexpected errors: ${JSON.stringify(errors)}`);
});

test('rules[] が無い accepted ADR を検出する (指摘4)', () => {
  const { errors } = validateAdrDir(path.join(FIX, 'adr-no-rules'));
  assert.ok(errors.some(e => /rules\[\] を最低 1 つ持つ必要がある/.test(e.message)), JSON.stringify(errors));
});

test('ティア構成 ADR に arch_test を持つ rule が無いと検出する (指摘4)', () => {
  const { errors } = validateAdrDir(path.join(FIX, 'adr-tiers-no-archtest'));
  assert.ok(errors.some(e => /ティア構成 ADR は arch_test を持つ rule/.test(e.message)), JSON.stringify(errors));
});
