'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { validateAdrDir, parseFrontMatter, tierStructureErrors, testingCapabilityErrors, ruleCoverageErrors } = require('../../../plugins/distillery2/skills/d2-decide/scripts/validateAdr');

// tierStructureErrors / testingCapabilityErrors / ruleCoverageErrors はメモリ上の adrs
// ([{file, fm}]) を受ける。fixture を増やさず個別ルールを直接検証する。
const tiersFm = (over = {}) => ({
  id: '0001', status: 'accepted', scope: ['system', 'app'], datastore_owner: 'backend-api',
  tiers: [{ id: 'backend-api', dir: 'apps/backend-api', kind: 'backend', lang: 'ts' }],
  rules: [
    { scope: 'common', text: 't', arch_test: { from: 'a/**', to: 'b/**', effect: 'forbid', level: 'tier' } },
    { scope: 'tier:backend', text: 'l', arch_test: { from: 'a/**', to: 'c/**', effect: 'forbid', level: 'layer' } },
  ],
  ...over,
});
const adr = (file, fm) => ({ file, fm });

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

test('ティア構成 ADR に arch_test.level: tier を持つ rule が無いと検出する', () => {
  const { errors } = validateAdrDir(path.join(FIX, 'adr-tiers-no-archtest'));
  assert.ok(errors.some(e => /ティア構成 ADR は arch_test/.test(e.message)), JSON.stringify(errors));
});

// ---- 指摘1: ティア構成 ADR は system scope 必須 / 他 ADR は tiers キー禁止 ----

test('ティア構成 ADR が system scope を持たないとエラー (指摘1)', () => {
  const errors = tierStructureErrors([adr('0001.md', tiersFm({ scope: ['app'] }))]);
  assert.ok(errors.some(e => /scope に system を含む/.test(e.message)), JSON.stringify(errors));
});

test('ティア構成 ADR 以外が空の tiers[] を持つとエラー (指摘1)', () => {
  const errors = tierStructureErrors([
    adr('0001.md', tiersFm()),
    adr('0002.md', { id: '0002', status: 'accepted', scope: ['system'], tiers: [] }),
  ]);
  assert.ok(errors.some(e => /tiers\[\] はティア構成 ADR/.test(e.message)), JSON.stringify(errors));
});

test('非 accepted の ADR が tiers キーを持つとエラー (指摘1)', () => {
  const errors = tierStructureErrors([
    adr('0001.md', tiersFm()),
    adr('0002.md', { id: '0002', status: 'proposed', scope: ['system'], tiers: [{ id: 'x', dir: 'd', kind: 'backend', lang: 'ts' }] }),
  ]);
  assert.ok(errors.some(e => /tiers\[\] はティア構成 ADR/.test(e.message)), JSON.stringify(errors));
});

test('adr-two-accepted-system の正当な 2 本目 (tiers キー無し) はティア構成エラー 0 (指摘1)', () => {
  const errors = tierStructureErrors([
    adr('0001.md', tiersFm()),
    adr('0002.md', { id: '0002', status: 'accepted', scope: ['system', 'app'], rules: [{ scope: 'common', text: 'x' }] }),
  ]);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

// ---- 指摘3: arch_test.level tier / layer のカバレッジ ----

test('ティア構成 ADR の arch_test が layer だけだと tier 不足を検出する (指摘3)', () => {
  const fm = tiersFm({ rules: [
    { scope: 'tier:backend', text: 'l', arch_test: { from: 'a/**', to: 'c/**', effect: 'forbid', level: 'layer' } },
  ] });
  const errors = ruleCoverageErrors([adr('0001.md', fm)]);
  assert.ok(errors.some(e => /arch_test\.level: tier/.test(e.message)), JSON.stringify(errors));
});

test('app scope の accepted ADR があるのに layer 規則がどこにも無いと検出する (指摘3)', () => {
  const fm = tiersFm({ rules: [
    { scope: 'common', text: 't', arch_test: { from: 'a/**', to: 'b/**', effect: 'forbid', level: 'tier' } },
  ] });
  const errors = ruleCoverageErrors([adr('0001.md', fm)]);
  assert.ok(errors.some(e => /arch_test\.level: layer/.test(e.message)), JSON.stringify(errors));
});

test('tier + layer 両方あればカバレッジエラー 0 (指摘3)', () => {
  const errors = ruleCoverageErrors([adr('0001.md', tiersFm())]);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

// ---- 指摘4: testing scope の capabilities ----

test('正常な testing + capabilities の ADR 群は PASS (指摘4)', () => {
  const { errors } = validateAdrDir(path.join(FIX, 'adr-testing-caps-pass'));
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test('capabilities を宣言しない testing ADR を検出する (指摘4)', () => {
  const { errors } = validateAdrDir(path.join(FIX, 'adr-testing-no-caps'));
  assert.ok(errors.some(e => /capabilities: \{ browser/.test(e.message)), JSON.stringify(errors));
});

test('capabilities を宣言する accepted ADR が 2 本あるとエラー (指摘4)', () => {
  const errors = testingCapabilityErrors([
    adr('0001.md', { id: '0001', status: 'accepted', scope: ['testing'], capabilities: { browser: true } }),
    adr('0002.md', { id: '0002', status: 'accepted', scope: ['testing'], capabilities: { browser: false } }),
  ]);
  assert.ok(errors.some(e => /capabilities を宣言する accepted ADR は 1 つだけ/.test(e.message)), JSON.stringify(errors));
});

test('testing 以外の scope が capabilities を宣言するとエラー (指摘4)', () => {
  const errors = testingCapabilityErrors([
    adr('0001.md', { id: '0001', status: 'accepted', scope: ['app'], capabilities: { browser: true } }),
  ]);
  assert.ok(errors.some(e => /capabilities は scope に testing を含む ADR だけ/.test(e.message)), JSON.stringify(errors));
});
