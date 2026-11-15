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

test('x-test-requests の値に知らない項目や型の誤りがあると FAIL (差分レビュー)', () => {
  const opExtra = yamlLines(['x-test-requests:', '  unauthorized:', '    header:', '      Authorization: Bearer invalid', '  not_found:', '    path: missing']);
  const { errors } = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra })));
  assert.ok(errors.some(e => /unauthorized\.header: 知らない項目/.test(e)), errors.join('\n'));
  assert.ok(errors.some(e => /not_found\.path: 引数名/.test(e)), errors.join('\n'));
});

test('x-test-requests 全体が mapping でない・path の引数名が経路に無いと FAIL (3 ラウンド目)', () => {
  const notMap = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra: yamlLines(['x-test-requests: oops']) }))).errors;
  assert.ok(notMap.some(e => /x-test-requests の 全体/.test(e)), notMap.join('\n'));
  const opExtra = yamlLines(['x-test-requests:', '  unauthorized:', '    headers:', '      Authorization: Bearer invalid', '  not_found:', '    path:', '      ID: missing']);
  const { errors } = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra })));
  assert.ok(errors.some(e => /not_found\.path\.ID: 経路 \/books\/\{id\} に無い引数/.test(e)), errors.join('\n'));
});

test('同じ status で中身の違う例は expect か違う code が要り、expect の項目を生成テストで確かめる (3 ラウンド目)', () => {
  const two = (code) => withTwo409(contractsWithGetBookErrors({ opExtra: yamlLines(['x-test-fixtures:', '  s: 状態違い', '  v: 版違い', 'x-test-requests:', '  unauthorized:', '    headers:', '      Authorization: Bearer invalid', '  not_found:', '    path:', '      id: missing', '  invalid_state:', '    fixture: s', '  version_conflict:', '    fixture: v']) }), code);
  // code が違えば expect は要らない
  assert.deepEqual(validateUcIndex.validate(compiledFrom(two('VERSION_CONFLICT'))).errors.filter(e => /確かめる項目が無い/.test(e)), []);
});

test('unverifiedVariants: 同じ status で中身の違う例のうち expect の無い例を返す (3 ラウンド目)', () => {
  const G = require(path.join(SCRIPTS, 'lib', 'contractGraph.js'));
  const examples = { a: { value: { s: 'A' } }, b: { value: { s: 'B' } } };
  const entry = { path: '/x/{id}', method: 'GET', operation: { operationId: 'o', responses: { '200': { description: 'ok', content: { 'application/json': { examples } } } },
    'x-test-requests': { a: { path: { id: '1' } }, b: { path: { id: '2' }, expect: ['s'] } } } };
  assert.deepEqual(G.unverifiedVariants(entry, {}), [{ status: '200', name: 'a' }]);
  entry.operation['x-test-requests'].a.expect = ['s'];
  assert.deepEqual(G.unverifiedVariants(entry, {}), []);
});

// --- x-test-requests の query と、同じ status の例が 3 つ以上のときの expect ---
// operation の parameters に、文字列の query の引数を宣言する YAML の行
const queryParams = (...names) => ['parameters:', ...names.flatMap(n => [`  - name: ${n}`, '    in: query', '    schema:', '      type: string'])];

test('query の値で区別すれば PASS。同じ query を送る例は区別できないので FAIL', () => {
  const lines = (q401, q404) => yamlLines([...queryParams('from'), 'x-test-requests:', '  one:', '    query:', '      from: a', '  unauthorized:', '    query:', `      from: ${q401}`, '  not_found:', '    query:', `      from: ${q404}`]);
  assert.deepEqual(validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra: lines('b', 'c') }))).errors, []);
  const same = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra: lines('a', 'c') }))).errors;
  assert.ok(same.some(e => /"one" \(200\)/.test(e) && /"unauthorized" \(401\)/.test(e) && /区別できない/.test(e)), same.join('\n'));
  assert.ok(!same.some(e => /not_found/.test(e)), same.join('\n'));
});

test('query を書く順が違うだけの 2 つの例は、同じ要求として区別できない', () => {
  const opExtra = yamlLines([...queryParams('a', 'b'), 'x-test-requests:', '  one:', '    query:', '      a: 1', '      b: 2', '  unauthorized:', '    query:', '      b: 2', '      a: 1', '  not_found:', '    path:', '      id: missing']);
  const { errors } = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra })));
  assert.ok(errors.some(e => /"one" \(200\)/.test(e) && /"unauthorized" \(401\)/.test(e) && /区別できない/.test(e)), errors.join('\n'));
});

test('x-test-requests の query が mapping でない・値が null や入れ子だと FAIL', () => {
  const notMap = yamlLines(['x-test-requests:', '  unauthorized:', '    query: from=a', '  not_found:', '    path:', '      id: missing']);
  const e1 = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra: notMap }))).errors;
  assert.ok(e1.some(e => /unauthorized\.query: 引数名 → 値の mapping/.test(e)), e1.join('\n'));
  const badValue = yamlLines([...queryParams('from', 'range', 'tags', 'ok'), 'x-test-requests:', '  unauthorized:', '    query:', '      from: null', '      range:', '        start: a', '      tags: []', '      ok: [a, 1, true]', '  not_found:', '    path:', '      id: missing']);
  const e2 = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra: badValue }))).errors;
  for (const name of ['from', 'range', 'tags']) assert.ok(e2.some(e => new RegExp(`unauthorized\\.query\\.${name}: 値は`).test(e)), e2.join('\n'));
  assert.ok(!e2.some(e => /unauthorized\.query\.ok/.test(e)), e2.join('\n'));
});

test('unverifiedVariants: 同じ status の例が 3 つで 2 つが同じ code なら、expect が要るのは同じ code の 2 つだけ', () => {
  const G = require(path.join(SCRIPTS, 'lib', 'contractGraph.js'));
  const examples = {
    passed: { value: { code: 'CANCEL_DEADLINE_PASSED', title: '過ぎた' } },
    reached: { value: { code: 'CANCEL_DEADLINE_PASSED', title: '迎えた' } },
    cancelled: { value: { code: 'ALREADY_CANCELLED', title: '取消済み' } },
  };
  const entry = { path: '/x/{id}', method: 'POST', operation: { operationId: 'o', responses: { '409': { description: 'ng', content: { 'application/problem+json': { examples } } } },
    'x-test-requests': { passed: { path: { id: '1' } }, reached: { path: { id: '2' } }, cancelled: { path: { id: '3' } } } } };
  assert.deepEqual(G.unverifiedVariants(entry, {}), [{ status: '409', name: 'passed' }, { status: '409', name: 'reached' }]);
  entry.operation['x-test-requests'].passed.expect = ['title'];
  entry.operation['x-test-requests'].reached.expect = ['title'];
  assert.deepEqual(G.unverifiedVariants(entry, {}), []);
});

test('unverifiedVariants: code の無い例・2xx の例は、中身の違う相手がいれば expect が要る。中身まで同じ例どうしは要らない', () => {
  const G = require(path.join(SCRIPTS, 'lib', 'contractGraph.js'));
  const op = (status, examples) => ({ path: '/x', method: 'GET', operation: { operationId: 'o', responses: { [status]: { description: 'r', content: { 'application/json': { examples } } } } } });
  // code の無い例は、code のある例と code で見分けられない
  assert.deepEqual(G.unverifiedVariants(op('409', { a: { value: { code: 'A' } }, b: { value: { title: 'code 無し' } } }), {}),
    [{ status: '409', name: 'a' }, { status: '409', name: 'b' }]);
  // 2xx は code が違っても expect が要る (生成するテストが code を確かめるのはエラー応答だけ)
  assert.deepEqual(G.unverifiedVariants(op('200', { a: { value: { code: 'A' } }, b: { value: { code: 'B' } } }), {}),
    [{ status: '200', name: 'a' }, { status: '200', name: 'b' }]);
  // 中身まで同じ 2 つと、code の違う 1 つ: どれも要らない
  assert.deepEqual(G.unverifiedVariants(op('409', { a: { value: { code: 'A' } }, a2: { value: { code: 'A' } }, b: { value: { code: 'B' } } }), {}), []);
});

// --- 外部レビューの指摘: query の引数名を契約の引数と照合する ---
test('契約に無い query の引数名は FAIL (誤記した名前だけが違う 2 つの例を、区別できると判定しない)', () => {
  // 契約の引数は from。例は typo=a / typo=b を送る
  const opExtra = yamlLines([...queryParams('from'), 'x-test-requests:', '  one:', '    query:', '      typo: a', '  unauthorized:', '    headers:', '      Authorization: Bearer invalid', '  not_found:', '    query:', '      typo: b']);
  const { errors } = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra })));
  assert.ok(errors.some(e => /one\.query\.typo: 契約の query の引数 \(parameters の in: query\) に無い名前/.test(e)), errors.join('\n'));
  assert.ok(errors.some(e => /not_found\.query\.typo: 契約の query の引数/.test(e)), errors.join('\n'));
  // query の引数を 1 つも宣言していない operation でも止める
  const none = yamlLines(['x-test-requests:', '  one:', '    query:', '      from: a', '  unauthorized:', '    headers:', '      Authorization: Bearer invalid', '  not_found:', '    path:', '      id: missing']);
  const e2 = validateUcIndex.validate(compiledFrom(contractsWithGetBookErrors({ opExtra: none }))).errors;
  assert.ok(e2.some(e => /one\.query\.from: 契約の query の引数/.test(e)), e2.join('\n'));
});

test('invalidTestRequests: query の引数は path item と operation の parameters から読む ($ref も解決する)。path の引数と同じ名前は query の引数ではない', () => {
  const G = require(path.join(SCRIPTS, 'lib', 'contractGraph.js'));
  const doc = {
    paths: { '/x/{id}': { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { $ref: '#/components/parameters/Shared' }] } },
    components: { parameters: { Shared: { name: 'shared', in: 'query', schema: { type: 'string' } }, Own: { name: 'own', in: 'query', schema: { $ref: '#/components/schemas/S' } } }, schemas: { S: { type: 'string' } } },
  };
  const entry = (query) => ({ path: '/x/{id}', method: 'GET', operation: { operationId: 'o', parameters: [{ $ref: '#/components/parameters/Own' }], responses: {}, 'x-test-requests': { a: { query } } } });
  assert.deepEqual(G.invalidTestRequests(entry({ shared: '1', own: '2' }), doc), []);
  assert.deepEqual(G.invalidTestRequests(entry({ id: '1' }), doc), ['a.query.id: 契約の query の引数 (parameters の in: query) に無い名前']);
  assert.deepEqual([...G.queryParameters(entry({}), doc).keys()], ['shared', 'own']);
});

test('invalidTestRequests: schema が object か style が deepObject の引数だけ、`<名前>[...]` の形を通す', () => {
  const G = require(path.join(SCRIPTS, 'lib', 'contractGraph.js'));
  const doc = { paths: { '/x': {} }, components: { schemas: { Filter: { type: 'object', properties: { name: { type: 'string' } } } } } };
  const parameters = [
    { name: 'filter', in: 'query', schema: { $ref: '#/components/schemas/Filter' } },
    { name: 'page', in: 'query', style: 'deepObject', schema: {} },
    { name: 'opt', in: 'query', schema: { type: ['object', 'null'] } },
    { name: 'from', in: 'query', schema: { type: 'string' } },
  ];
  const entry = (query) => ({ path: '/x', method: 'GET', operation: { operationId: 'o', parameters, responses: {}, 'x-test-requests': { a: { query } } } });
  assert.deepEqual(G.invalidTestRequests(entry({ 'filter[name]': 'a', 'page[size]': 10, 'opt[x][y]': true, from: 'b' }), doc), []);
  // object でない引数の `<名前>[...]` と、宣言の無い名前の `<名前>[...]` は通さない
  assert.deepEqual(G.invalidTestRequests(entry({ 'from[x]': 'a', 'filtre[name]': 'a', 'filter[name': 'a' }), doc).map(m => m.split(':')[0]),
    ['a.query.from[x]', 'a.query.filtre[name]', 'a.query.filter[name']);
});

test('invalidTestRequests: object 型の query の引数は、schema が項目を列挙していれば `<名前>[<項目>]` の項目名も照合する (外部レビュー 2 ラウンド目)', () => {
  const G = require(path.join(__dirname, '../../../plugins/distillery2/skills/d2-contract/scripts/lib/contractGraph'));
  const op = (schema) => ({ path: '/rooms', method: 'get', operation: { parameters: [{ name: 'filter', in: 'query', style: 'deepObject', schema }] } });
  const closed = G.queryParameters(op({ type: 'object', properties: { status: { type: 'string' } } }), { paths: {} });
  assert.deepEqual(closed.get('filter'), { nested: true, keys: ['status'] });
  // additionalProperties を許す schema と、項目を書いていない schema は、項目名を照合しない
  assert.equal(G.queryParameters(op({ type: 'object', properties: { status: {} }, additionalProperties: true }), { paths: {} }).get('filter').keys, null);
  assert.equal(G.queryParameters(op({ type: 'object' }), { paths: {} }).get('filter').keys, null);
  const entry = op({ type: 'object', properties: { status: { type: 'string' } }, additionalProperties: false });
  entry.operation['x-test-requests'] = { ok: { query: { 'filter[status]': 'a' } }, typo: { query: { 'filter[typo]': 'a' } } };
  const errs = G.invalidTestRequests(entry, { paths: {} });
  assert.equal(errs.length, 1, JSON.stringify(errs));
  assert.match(errs[0], /typo\.query\.filter\[typo\]: 契約の query の引数/);
});
