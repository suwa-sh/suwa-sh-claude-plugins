'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { compile, run, resolve, encode } = require('../plugins/distillery/skills/dist-spec/scripts/compileContracts');
const { parseYaml } = require('../plugins/distillery/skills/dist-spec/scripts/lib/yaml-parser');

function fixture() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/distillery/spec-contracts/_cross-cutting/api/contracts.json'), 'utf8'));
}
const uc = '貸出業務/貸出フロー/貸出登録';
test('integrated contracts are lossless and UC slices preserve constraints, security, errors, dependencies and cycles', () => {
  const c = fixture(), files = compile(c);
  assert.deepEqual(parseYaml(files.get('_cross-cutting/api/openapi.yaml')), c.openapi);
  assert.deepEqual(parseYaml(files.get('_cross-cutting/api/asyncapi.yaml')), c.asyncapi);
  const sliced = JSON.parse(files.get(`${uc}/_contract-slice.json`));
  assert.deepEqual(sliced.openapi.paths['/loans'], c.openapi.paths['/loans']);
  assert.deepEqual(sliced.openapi.paths['/books/{id}'].parameters, c.openapi.paths['/books/{id}'].parameters);
  assert.ok(sliced.openapi.paths['/books/{id}'].get);
  assert.equal(sliced.openapi.paths['/books/{id}'].delete, undefined);
  assert.equal(sliced.openapi.components.schemas.Unused, undefined);
  for (const ref of ['#/components/parameters/Idempotency', '#/components/schemas/CreateLoan', '#/components/schemas/Loan', '#/components/responses/Conflict', '#/components/schemas/Problem', '#/components/securitySchemes/bearer']) {
    assert.deepEqual(resolve(sliced.openapi, ref), resolve(c.openapi, ref), ref);
  }
  assert.deepEqual(resolve(sliced.asyncapi, '#/components/messages/LoanCreated'), c.asyncapi.components.messages.LoanCreated);
  assert.deepEqual(resolve(sliced.asyncapi, '#/components/schemas/LoanCreatedPayload'), c.asyncapi.components.schemas.LoanCreatedPayload);
  const summary = parseYaml(files.get(`${uc}/_api-summary.yaml`));
  assert.equal(summary.schema_version, 'distillery.api-summary/v2');
  assert.equal(summary.consumes[0].owner_uc, '蔵書業務/照会フロー/書籍照会');
  assert.equal(summary.schemas, undefined, 'summary must not re-author types');
});

test('unrelated schema changes do not invalidate a UC projection, related changes do', () => {
  const c = fixture(), before = compile(c);
  c.openapi.components.schemas.Unused.description = 'unrelated';
  assert.equal(compile(c).get(`${uc}/_api-summary.yaml`), before.get(`${uc}/_api-summary.yaml`));
  c.openapi.components.schemas.Problem.properties.code.enum.push('NEW_ERROR');
  assert.notEqual(compile(c).get(`${uc}/_api-summary.yaml`), before.get(`${uc}/_api-summary.yaml`));
});

test('ownership, dangling references, external references and unsafe UC paths fail closed', () => {
  for (const [change, message] of [
    [c => c.use_cases[0].provides.push(c.use_cases[1].provides[0]), /Multiple owners/],
    [c => c.use_cases[1].provides = [], /Missing owner/],
    [c => c.use_cases[0].consumes[0].operation_id = 'missing', /undeclared operation/],
    [c => c.openapi.paths['/books/{id}'].get.operationId = 'createLoan', /Duplicate operationId/],
    [c => c.openapi.components.schemas.Loan.properties.next.$ref = '#/components/schemas/missing', /Unresolved reference/],
    [c => c.openapi.components.schemas.Loan.properties.next.$ref = 'https://example.com/schema', /Only local/],
    [c => c.use_cases[0].business = '../escape', /Invalid UC/],
    [c => c.openapi.components.schemas.Loan.$id = 'https://example.com/loan', /bundling/],
  ]) { const c = fixture(); change(c); assert.throws(() => compile(c), message); }
});

test('compiler is deterministic, check detects tampering, invalid sources never update outputs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-contract-test-'));
  try {
    fs.mkdirSync(path.join(dir, '_cross-cutting/api'), { recursive: true });
    const source = path.join(dir, '_cross-cutting/api/contracts.json');
    const c = fixture(); fs.writeFileSync(source, encode(c));
    run(dir); assert.equal(run(dir, true).status, 'current');
    const output = path.join(dir, uc, '_api-summary.yaml');
    const before = fs.readFileSync(output, 'utf8');
    c.use_cases[0].provides[0].operation_id = 'missing'; fs.writeFileSync(source, encode(c));
    assert.throws(() => run(dir), /undeclared operation/);
    assert.equal(fs.readFileSync(output, 'utf8'), before);
    fs.writeFileSync(source, encode(fixture())); fs.appendFileSync(output, ' ');
    assert.throws(() => run(dir, true), /Stale generated/);
    run(dir); assert.equal(fs.readFileSync(output, 'utf8'), before);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
module.exports = { fixture };

test('removed contracts are pruned only if unchanged, and symlink destinations are rejected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-contract-prune-'));
  try {
    fs.mkdirSync(path.join(dir, '_cross-cutting/api'), { recursive: true });
    const source = path.join(dir, '_cross-cutting/api/contracts.json');
    const c = fixture(); fs.writeFileSync(source, encode(c)); run(dir);
    const obsolete = path.join(dir, '_cross-cutting/api/asyncapi.yaml');
    const original = fs.readFileSync(obsolete, 'utf8');
    c.asyncapi = null; c.use_cases[0].provides = c.use_cases[0].provides.filter(e => e.kind !== 'asyncapi');
    fs.writeFileSync(source, encode(c)); fs.appendFileSync(obsolete, ' ');
    assert.throws(() => run(dir), /Refusing to delete edited/);
    fs.writeFileSync(obsolete, original);
    assert.throws(() => run(dir, true), /Stale generated/);
    run(dir); assert.equal(fs.existsSync(obsolete), false);
    const summary = path.join(dir, uc, '_api-summary.yaml');
    fs.unlinkSync(summary); fs.symlinkSync(source, summary);
    assert.throws(() => run(dir), /Symlink output denied/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('native summary validation catches a tampered slice and mismatched operation references', () => {
  const { validateSummary } = require('../plugins/distillery/skills/dist-spec/scripts/compileContracts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-contract-summary-'));
  try {
    const files = compile(fixture());
    fs.writeFileSync(path.join(dir, '_contract-slice.json'), files.get(`${uc}/_contract-slice.json`));
    const summary = JSON.parse(files.get(`${uc}/_api-summary.yaml`));
    assert.equal(validateSummary(summary, dir), true);
    summary.endpoints[0].path = '/wrong';
    assert.throws(() => validateSummary(summary, dir), /method\/path mismatch/);
    fs.appendFileSync(path.join(dir, '_contract-slice.json'), ' ');
    assert.throws(() => validateSummary(summary, dir), /hash mismatch/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('mechanical views use RDRA denominators, preserve uncovered elements and reject false evidence', () => {
  const { build, elements, tsv } = require('../plugins/distillery/skills/dist-spec/scripts/buildSpecViews');
  assert.deepEqual(tsv('名前\t説明\n"名前"\t"一行目\n二行目"\n'), [{ 名前: '名前', 説明: '一行目\n二行目' }]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-contract-views-'));
  try {
    const rdra = path.join(dir, 'rdra'), event = path.join(dir, 'event');
    fs.mkdirSync(rdra); fs.mkdirSync(path.join(event, '_cross-cutting/api'), { recursive: true });
    const c = fixture(); fs.writeFileSync(path.join(event, '_cross-cutting/api/contracts.json'), encode(c));
    fs.writeFileSync(path.join(rdra, 'BUC.tsv'), '業務\tBUC\tUC\n' + c.use_cases.map(u => `${u.business}\t${u.buc}\t${u.uc}`).join('\n') + '\n');
    fs.writeFileSync(path.join(rdra, '情報.tsv'), 'コンテキスト\t情報\t属性\n貸出\t貸出\t貸出ID、期限\n');
    fs.writeFileSync(path.join(rdra, '条件.tsv'), 'コンテキスト\t条件\n貸出\t貸出可能\n');
    fs.writeFileSync(path.join(rdra, '状態.tsv'), 'コンテキスト\t状態モデル\t状態\t遷移UC\t遷移先状態\n貸出\t貸出状態\t\t貸出登録\t貸出中\n');
    for (const u of c.use_cases) {
      const at = path.join(event, `${u.business}/${u.buc}/${u.uc}`); fs.mkdirSync(at, { recursive: true });
      fs.writeFileSync(path.join(at, 'spec.md'), '# UC\n## RULE-001\n```gherkin\nScenario: 貸出成立\n Given 書籍がある\n When 貸し出す\n Then 貸出中になる\n```\n');
      fs.writeFileSync(path.join(at, 'tier-api.md'), '# API\n');
    }
    const inventory = elements(rdra); assert.equal(inventory.length, 4);
    const traceFile = path.join(event, uc, '_trace-links.json');
    const trace = { schema_version: 'distillery.trace-links/v1', links: [{
      element: inventory.find(e => e.category === 'condition').key, tier: 'tier-api', file: `${uc}/spec.md`, anchor: 'RULE-001',
      scenarios: [{ file: `${uc}/spec.md`, name: '貸出成立' }],
    }] };
    fs.writeFileSync(traceFile, encode(trace));
    const views = build(event, rdra), report = JSON.parse(views.get('_cross-cutting/traceability-index.json'));
    assert.deepEqual(report.counts.condition, { total: 1, linked: 1 });
    assert.deepEqual(report.counts.information, { total: 2, linked: 0 });
    assert.equal(report.elements.filter(e => e.status === 'unlinked').length, 3);
    assert.ok(views.get('貸出業務/貸出フロー/buc-spec.md').includes('getBook'));
    trace.links[0].scenarios[0].name = '存在しない'; fs.writeFileSync(traceFile, encode(trace));
    assert.throws(() => build(event, rdra), /missing Scenario/);
    trace.links[0].element = 'fabricated'; fs.writeFileSync(traceFile, encode(trace));
    assert.throws(() => build(event, rdra), /unknown RDRA element/);
    fs.unlinkSync(traceFile); fs.appendFileSync(path.join(rdra, 'BUC.tsv'), '別業務\t別フロー\t未実装UC\n');
    assert.throws(() => build(event, rdra), /UC set differs/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('discriminators, Link operations, nested references and AsyncAPI security survive projection', () => {
  const c = fixture(); c.use_cases[0].consumes = [];
  c.openapi.paths['/loans'].post.responses['201'].links = { book: { operationId: 'getBook' } };
  c.openapi.components.schemas.CreateLoan.discriminator = { propertyName: 'kind', mapping: { book: 'Book' } };
  c.openapi.components.schemas.Loan.properties.title = { $ref: '#/components/schemas/Book/properties/title' };
  c.asyncapi.components.securitySchemes = { basic: { type: 'userPassword' } };
  c.asyncapi.servers.broker.security = [{ $ref: '#/components/securitySchemes/basic' }];
  const original = encode(c), projection = JSON.parse(compile(c).get(`${uc}/_contract-slice.json`));
  assert.equal(encode(c), original, 'projection must not mutate its source');
  assert.deepEqual(projection.openapi.paths['/books/{id}'].parameters, c.openapi.paths['/books/{id}'].parameters);
  assert.deepEqual(projection.openapi.components.schemas.Book, c.openapi.components.schemas.Book);
  assert.deepEqual(projection.asyncapi.components.securitySchemes, c.asyncapi.components.securitySchemes);
  c.openapi.paths['/loans'].post.responses['201'].links.book.operationId = 'unknown';
  assert.throws(() => compile(c), /Unknown linked operation/);
});

test('event validator accepts generated JSON contracts and catalog events without HTTP APIs', () => {
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-contract-event-'));
  try {
    fs.mkdirSync(path.join(dir, '_cross-cutting/api'), { recursive: true });
    const source = path.join(dir, '_cross-cutting/api/contracts.json');
    const c = fixture();
    for (const http of [true, false]) {
      if (!http) { c.openapi = null; for (const u of c.use_cases) {
        u.provides = u.provides.filter(e => e.kind !== 'openapi'); u.consumes = [];
      } }
      fs.writeFileSync(source, encode(c)); run(dir);
      const result = spawnSync(process.execPath, [path.resolve('plugins/distillery/skills/dist-spec/scripts/validateSpecEvent.js'), dir, '--json'], { encoding: 'utf8' });
      // A contract-only fixture intentionally lacks the rest of a Spec event.
      assert.equal(result.status, 1);
      assert.doesNotMatch(result.stdout + result.stderr, /(?:Contract catalog:|api\/(?:openapi|asyncapi)\.yaml.*(?:ありません|Unexpected))/);
      assert.match(result.stdout, /spec-event/);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('checked-in compiler example is reproducible from its catalog', () => {
  assert.equal(run(path.join(__dirname, '../samples/distillery/spec-contracts'), true).status, 'current');
});
