'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { SCRIPTS } = require('./support');

const SCRIPT = path.join(SCRIPTS, 'classifyContractChanges.js');
const { classify, pathsOfPorcelain } = require(SCRIPT);

const ucIndex = {
  schema_version: 'distillery2.uc-index/v1',
  ucs: [
    { slug: 'register-loan', operations: ['registerLoan', 'getBook'], messages: [], tables: [] },
    { slug: 'register-return', operations: ['registerReturn', 'getBook'], messages: [], tables: [] },
  ],
};

test('契約の生成物を own / other_uc / shared に分ける', () => {
  const r = classify({
    slug: 'register-return',
    ucIndex,
    files: [
      'apps/backend-api/test/contract/registerReturn.test.ts', // 自 UC だけの operation
      'apps/backend-api/test/contract/getBook.test.ts', // 他 UC と共有する operation
      'apps/backend-api/test/contract/registerLoan.test.ts', // 他 UC だけの operation
      'apps/backend-api/test/contract/renamedOp.test.ts', // uc-index に無い operation
      'apps/worker/test/contract/messages.test.ts', // AsyncAPI の共有テスト
      'apps/backend-api/test/contract/db-schema.test.ts', // DB の共有テスト
      'apps/backend-api/migrations/0001_schema.sql', // DDL
      'packages/contracts/library-api/types.ts', // 共有の型
      'contracts/generated/openapi.bundle.yaml', // bundle
      'contracts/generated/slices/register-return/contract-slice.json', // 自 UC の slice
      'contracts/generated/slices/register-loan/contract-slice.json', // 他 UC の slice
      'contracts/openapi/paths/returns.yaml', // 分割ファイル (生成物でない)
      'apps/backend-api/src/usecase/registerReturn.ts', // 実装 (生成物でない)
      '',
    ],
  });
  assert.deepEqual(r.own, [
    { file: 'apps/backend-api/test/contract/registerReturn.test.ts', operation: 'registerReturn', also_used_by: [] },
    { file: 'apps/backend-api/test/contract/getBook.test.ts', operation: 'getBook', also_used_by: ['register-loan'] },
    { file: 'contracts/generated/slices/register-return/contract-slice.json', slice: 'register-return', also_used_by: [] },
  ]);
  assert.deepEqual(r.other_uc, [
    { file: 'apps/backend-api/test/contract/registerLoan.test.ts', operation: 'registerLoan', used_by: ['register-loan'] },
    { file: 'apps/backend-api/test/contract/renamedOp.test.ts', operation: 'renamedOp', used_by: [] },
    { file: 'contracts/generated/slices/register-loan/contract-slice.json', slice: 'register-loan', used_by: ['register-loan'] },
  ]);
  assert.deepEqual(r.shared, [
    'apps/worker/test/contract/messages.test.ts',
    'apps/backend-api/test/contract/db-schema.test.ts',
    'apps/backend-api/migrations/0001_schema.sql',
    'packages/contracts/library-api/types.ts',
    'contracts/generated/openapi.bundle.yaml',
  ]);
  assert.equal(r.ignored, 2);
});

test('porcelain の行からパスを取る (rename は旧・新の両方、引用符を外す)', () => {
  assert.deepEqual(pathsOfPorcelain(' M apps/a/test/contract/x.test.ts'), ['apps/a/test/contract/x.test.ts']);
  assert.deepEqual(pathsOfPorcelain('?? packages/contracts/api/types.ts'), ['packages/contracts/api/types.ts']);
  assert.deepEqual(pathsOfPorcelain('R  apps/a/test/contract/registerLoan.test.ts -> apps/a/test/contract/createLoan.test.ts'),
    ['apps/a/test/contract/registerLoan.test.ts', 'apps/a/test/contract/createLoan.test.ts']);
  assert.deepEqual(pathsOfPorcelain('R  "old dir/x.test.ts" -> "contracts/generated/slices/貸出/x.json"'),
    ['old dir/x.test.ts', 'contracts/generated/slices/貸出/x.json']);
  assert.deepEqual(pathsOfPorcelain(''), []);
});

test('CLI: staged の rename は旧テストも分類に残る', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-classify-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
  git('init', '-q'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'contracts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'contracts', 'uc-index.yaml'), 'schema_version: distillery2.uc-index/v1\nucs:\n  - slug: register-loan\n    operations: [registerLoan]\n    messages: []\n    tables: []\n  - slug: register-return\n    operations: [registerReturn]\n    messages: []\n    tables: []\n');
  const dir = path.join(root, 'apps/backend-api/test/contract');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'registerLoan.test.ts'), 'same content\n');
  git('add', '.'); git('commit', '-q', '-m', 'init');
  git('mv', 'apps/backend-api/test/contract/registerLoan.test.ts', 'apps/backend-api/test/contract/renamedLoan.test.ts');
  const json = JSON.parse(execFileSync('node', [SCRIPT, '--uc', 'register-return', '--cwd', root, '--json'], { encoding: 'utf8' }));
  assert.deepEqual(json.other_uc.map(o => [o.operation, o.used_by]), [['registerLoan', ['register-loan']], ['renamedLoan', []]]);
});

test('CLI: git status から分類し、他 UC に効く変更を表示する', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-classify-'));
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  fs.mkdirSync(path.join(root, 'contracts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'contracts', 'uc-index.yaml'), [
    'schema_version: distillery2.uc-index/v1',
    'ucs:',
    '  - slug: register-loan',
    '    operations: [registerLoan, getBook]',
    '    messages: []',
    '    tables: []',
    '  - slug: register-return',
    '    operations: [registerReturn, getBook]',
    '    messages: []',
    '    tables: []',
    '',
  ].join('\n'));
  const put = (rel) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), 'x\n'); };
  put('apps/backend-api/test/contract/registerReturn.test.ts');
  put('apps/backend-api/test/contract/getBook.test.ts');
  put('apps/backend-api/test/contract/registerLoan.test.ts');
  put('packages/contracts/library-api/types.ts');
  const json = JSON.parse(execFileSync('node', [SCRIPT, '--uc', 'register-return', '--cwd', root, '--json'], { encoding: 'utf8' }));
  assert.deepEqual(json.own.map(o => o.operation), ['getBook', 'registerReturn']);
  assert.deepEqual(json.other_uc.map(o => o.operation), ['registerLoan']);
  assert.deepEqual(json.shared, ['packages/contracts/library-api/types.ts']);
  assert.equal(json.ignored, 1, 'contracts/uc-index.yaml は生成物でない');

  const text = execFileSync('node', [SCRIPT, '--uc', 'register-return', '--cwd', root], { encoding: 'utf8' });
  assert.match(text, /own=2 \(他 UC と共有 1\) other_uc=1 shared=1/);
  assert.match(text, /getBook\.test\.ts {2}\(also used by: register-loan\)/);
});

test('CLI: slug の形式違いと uc-index 不在は exit 2', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-classify-'));
  const run = (args) => { try { execFileSync('node', [SCRIPT, ...args], { stdio: 'pipe' }); return 0; } catch (e) { return e.status; } };
  assert.equal(run(['--uc', 'Bad_Slug', '--cwd', root]), 2);
  assert.equal(run(['--uc', 'register-return', '--cwd', root]), 2);
});
