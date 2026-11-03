'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SCRIPTS, freshContracts, contractsWithGetBookErrors } = require('./support');

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

// --- 0.2.0: 区別できない例と、宣言されていない fixture ---
function compiledFrom({ contractsDir }) {
  compileContracts.run(contractsDir);
  compileRdbSchema.run(contractsDir);
  return contractsDir;
}
const yamlLines = lines => lines.map(l => `      ${l}`).join('\n') + '\n';

test('status の違う例が同じ要求を送ると FAIL (両方の例を名指しする)', () => {
  const { errors } = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors()));
  const indist = errors.filter(e => /区別できない/.test(e));
  assert.ok(indist.some(e => /getBook/.test(e) && /"one" \(200\)/.test(e) && /"unauthorized" \(401\)/.test(e)), errors.join('\n'));
  assert.ok(indist.some(e => /"one" \(200\)/.test(e) && /"not_found" \(404\)/.test(e)), errors.join('\n'));
  // fixture の無い 5xx は todo なので比べない
  assert.ok(!indist.some(e => /broken/.test(e)), errors.join('\n'));
});

test('URL の値・ヘッダ・fixture のどれかで区別すれば PASS', () => {
  const opExtra = yamlLines([
    'x-test-fixtures:',
    '  no-books: 書籍が 1 冊も無い',
    'x-test-requests:',
    '  unauthorized:',
    '    headers:',
    '      Authorization: Bearer invalid',
    '  not_found:',
    '    fixture: no-books',
  ]);
  assert.deepEqual(validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra }))).errors, []);
  // path の値で区別してもよい
  const byPath = yamlLines(['x-test-requests:', '  unauthorized:', '    path:', '      id: book-9', '    headers:', '      X-Role: none', '  not_found:', '    path:', '      id: missing']);
  assert.deepEqual(validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra: byPath }))).errors, []);
});

test('x-test-requests が宣言されていない fixture を参照すると FAIL', () => {
  const opExtra = yamlLines(['x-test-requests:', '  unauthorized:', '    fixture: ghost', '  not_found:', '    path:', '      id: missing']);
  const { errors } = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra })));
  assert.ok(errors.some(e => /fixture "ghost"/.test(e) && /x-test-fixtures/.test(e)), errors.join('\n'));
  // 文書直下で宣言すれば通る
  const ok = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra, docExtra: 'x-test-fixtures:\n  ghost: 幽霊\n' })));
  assert.deepEqual(ok.errors, []);
});

// --- 0.2.0 差分レビュー: 同じ status の例と、x-test-requests の書き間違い ---
const distinguished = yamlLines(['x-test-requests:', '  unauthorized:', '    headers:', '      Authorization: Bearer invalid', '  not_found:', '    path:', '      id: missing']);
function withTwo409(contracts, second) {
  const oa = path.join(contracts.contractsDir, 'openapi', 'openapi.yaml');
  const ex = (name, code) => [`                ${name}:`, '                  value:', `                    code: ${code}`].join('\n');
  const conflict = ['        \'409\':', '          description: e409', '          content:', '            application/problem+json:',
    '              schema:', "                $ref: '#/components/schemas/Problem'", '              examples:', ex('invalid_state', 'INVALID_STATE'), ex('version_conflict', second), ''].join('\n');
  const y = fs.readFileSync(oa, 'utf8').replace("        '500':", `${conflict}\n        '500':`);
  fs.writeFileSync(oa, y);
  return contracts;
}

test('同じ status でも応答の例が違うのに同じ要求を送ると FAIL。中身まで同じなら重複として通す', () => {
  const bad = validateUcIndex.validate(compiledFrom(withTwo409(contractsWithGetBookErrors({ opExtra: distinguished }), 'VERSION_CONFLICT'))).errors;
  assert.ok(bad.some(e => /"invalid_state" \(409\)/.test(e) && /"version_conflict" \(409\)/.test(e) && /区別できない/.test(e)), bad.join('\n'));
  const dup = validateUcIndex.validate(compiledFrom(withTwo409(contractsWithGetBookErrors({ opExtra: distinguished }), 'INVALID_STATE'))).errors;
  assert.ok(!dup.some(e => /"invalid_state" \(409\)/.test(e) && /"version_conflict" \(409\)/.test(e)), dup.join('\n'));
});

test('x-test-requests のキーがどの応答の例にも当たらないと FAIL (書き間違いで条件が黙って使われなくなるのを止める)', () => {
  const opExtra = yamlLines(['x-test-requests:', '  unauthorized:', '    headers:', '      Authorization: Bearer invalid', '  not_fuond:', '    path:', '      id: missing']);
  const { errors } = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra })));
  assert.ok(errors.some(e => /キー "not_fuond"/.test(e)), errors.join('\n'));
});
