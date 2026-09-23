'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { validate } = require('../../../plugins/distillery2/skills/d2-design/scripts/validateScreens');

const FIX = path.resolve(__dirname, 'fixtures');
const APP = path.join(FIX, 'app');
const USE_CASES = path.join(FIX, 'use-cases.yaml');

function run(name) {
  return validate({ screensPath: path.join(FIX, name), appDir: APP, useCasesPath: USE_CASES });
}

test('正常な screens.yaml は PASS (エラー 0)', () => {
  const { errors, screens } = run('screens-pass.yaml');
  assert.deepEqual(errors, [], errors.join('\n'));
  assert.equal(screens, 1);
});

test('未定義の uc_slug を検出する', () => {
  const { errors } = run('screens-unknown-slug.yaml');
  assert.ok(errors.some(e => e.includes('ghost-uc') && e.includes('use-cases')), errors.join('\n'));
});

test('存在しない story を検出する', () => {
  const { errors } = run('screens-missing-story.yaml');
  assert.ok(errors.some(e => e.includes('DoesNotExist') && e.includes('存在しない')), errors.join('\n'));
});

test('Story に export されていない variant を検出する', () => {
  const { errors } = run('screens-variant-not-exported.yaml');
  assert.ok(errors.some(e => e.includes('Loading') && e.includes('named export')), errors.join('\n'));
});

test('route の重複を検出する', () => {
  const { errors } = run('screens-dup-route.yaml');
  assert.ok(errors.some(e => e.includes('/books') && e.includes('重複')), errors.join('\n'));
});

test('app dir に実装が無い component を検出する', () => {
  const { errors } = run('screens-missing-component.yaml');
  assert.ok(errors.some(e => e.includes('GhostWidget') && e.includes('app dir')), errors.join('\n'));
});

test('正常な screens.yaml の tokens.file は app dir に実在する', () => {
  const { errors } = run('screens-pass.yaml');
  assert.ok(!errors.some(e => e.includes('tokens.file')), errors.join('\n'));
});

test('存在しない tokens.file を検出する', () => {
  const { errors } = run('screens-missing-tokens.yaml');
  assert.ok(errors.some(e => e.includes('tokens.file') && e.includes('does-not-exist.json')), errors.join('\n'));
});

test('--app 無しでもスキーマ + 一意性は検査する', () => {
  const { errors } = validate({ screensPath: path.join(FIX, 'screens-dup-route.yaml') });
  assert.ok(errors.some(e => e.includes('重複')), errors.join('\n'));
});
