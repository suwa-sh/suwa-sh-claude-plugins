'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const VALIDATOR = path.resolve('plugins/distillery/skills/dist-spec/scripts/validateRdbSchema.js');

function schema(statusColumn) {
  return [
    'version: "1.0"',
    'datastore: "rdb"',
    'tables:',
    '  - name: "runs"',
    '    description: "実行"',
    '    columns:',
    '      - name: "id"',
    '        type: "uuid"',
    '        description: "実行ID"',
    ...statusColumn.map(line => `      ${line}`),
    '    primary_key: ["id"]',
    '',
  ].join('\n');
}

function run(t, statusColumn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-rdb-enum-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const file = path.join(tmp, 'rdb-schema.yaml');
  fs.writeFileSync(file, schema(statusColumn));
  const result = spawnSync(process.execPath, [VALIDATOR, file, '--json'], { encoding: 'utf8' });
  return JSON.parse(result.stdout);
}

test('enum 付きの列挙列は PASS し警告も出ない', t => {
  const result = run(t, [
    '- name: "status"',
    '  type: "string"',
    '  description: "実行状態(pending / running / completed)"',
    '  enum: ["pending", "running", "completed"]',
  ]);
  assert.equal(result.status, 'pass', JSON.stringify(result.errors));
  assert.deepEqual(result.warnings, []);
});

test('description に列挙値があるのに enum が無ければ警告する', t => {
  const result = run(t, [
    '- name: "status"',
    '  type: "string"',
    '  description: "実行状態(pending / running / completed)"',
  ]);
  assert.equal(result.status, 'pass');
  assert.ok(result.warnings.some(w => /description に列挙値があるのに enum がありません/.test(w)), result.warnings.join('\n'));
});

test('「値:」形式で列挙値を書いた列も enum が無ければ警告する', t => {
  const result = run(t, [
    '- name: "status"',
    '  type: "string"',
    '  description: "実行の状態。値: STARTED(作成直後), RUNNING(起動後), COMPLETED(終端)"',
  ]);
  assert.equal(result.status, 'pass');
  assert.ok(result.warnings.some(w => /description に列挙値があるのに enum がありません/.test(w)), result.warnings.join('\n'));
});

test('type が enum(...) なのに enum が無ければ警告する（既存 schema を FAIL させない）', t => {
  const result = run(t, [
    '- name: "status"',
    '  type: "enum(pending|running)"',
    '  description: "実行状態"',
  ]);
  assert.equal(result.status, 'pass');
  assert.ok(result.warnings.some(w => /type が enum\(\.\.\.\) なのに enum がありません/.test(w)), result.warnings.join('\n'));
});

test('「初期値: 0」のような単一値の説明は警告しない', t => {
  const result = run(t, [
    '- name: "retry_count"',
    '  type: "integer"',
    '  description: "再試行回数。初期値: 0"',
  ]);
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.warnings, []);
});

test('「初期値: localhost、任意のホスト名に変更可能」も警告しない', t => {
  const result = run(t, [
    '- name: "host"',
    '  type: "string"',
    '  description: "接続先ホスト。初期値: localhost、任意のホスト名に変更可能"',
  ]);
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.warnings, []);
});

test('「初期値: localhost、DNS名も指定可能」も警告しない', t => {
  const result = run(t, [
    '- name: "host"',
    '  type: "string"',
    '  description: "接続先ホスト。初期値: localhost、DNS名も指定可能"',
  ]);
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.warnings, []);
});

test('数字コードの列挙も警告する', t => {
  for (const description of ['状態コード。値: 0(無効), 1(有効)', '状態コード(0 / 1)']) {
    const result = run(t, [
      '- name: "status"',
      '  type: "string"',
      `  description: "${description}"`,
    ]);
    assert.equal(result.status, 'pass');
    assert.ok(
      result.warnings.some(w => /description に列挙値があるのに enum がありません/.test(w)),
      `${description}: ${result.warnings.join('\n')}`
    );
  }
});

test('enum の値が重複していればエラーになる', t => {
  const result = run(t, [
    '- name: "status"',
    '  type: "string"',
    '  description: "実行状態"',
    '  enum: ["pending", "pending"]',
  ]);
  assert.equal(result.status, 'fail');
  assert.ok(result.errors.some(e => /enum の値が重複しています/.test(e)), result.errors.join('\n'));
});

test('enum の無い通常列は警告を出さない', t => {
  const result = run(t, [
    '- name: "note"',
    '  type: "text"',
    '  description: "備考。自由記述"',
  ]);
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.warnings, []);
});
