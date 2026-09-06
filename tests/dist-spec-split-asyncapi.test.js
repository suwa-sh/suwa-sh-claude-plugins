'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('yaml');
const { run, validateSummary, sha } = require('../plugins/distillery/skills/dist-spec/scripts/compileContracts');
const sample = path.resolve('tests/fixtures/distillery/spec-progressive/async');
const uc = '貸出業務/貸出フロー/貸出登録';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'split-asyncapi-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const api = path.join(root, '_cross-cutting/api');
  fs.cpSync(path.join(sample, '_cross-cutting/api'), api, { recursive: true });
  fs.rmSync(path.join(api, 'generated'), { recursive: true, force: true });
  fs.rmSync(path.join(api, '.contracts-build.json'), { force: true });
  return { root, api };
}
const read = filename => yaml.parse(fs.readFileSync(filename, 'utf8'));
function write(filename, data) { fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, yaml.stringify(data)); }
const projection = (root, at = uc) => JSON.parse(fs.readFileSync(path.join(root, at, '_contract-slice.json'), 'utf8')).asyncapi;

test('split AsyncAPI preserves editable source and native message/channel references; sample reproduces', t => {
  const { root, api } = fixture(t);
  const sourcePaths = ['asyncapi.yaml', 'channels/loan-created.yaml', 'operations/sendLoan.yaml', 'components/messages/LoanCreated.yaml', 'components/schemas/LoanCreatedPayload.yaml'];
  const before = sourcePaths.map(p => fs.readFileSync(path.join(api, p), 'utf8'));
  run(root);
  assert.deepEqual(sourcePaths.map(p => fs.readFileSync(path.join(api, p), 'utf8')), before);
  const bundle = read(path.join(api, 'generated/asyncapi.bundle.yaml'));
  const legacy = JSON.parse(fs.readFileSync('tests/fixtures/distillery/spec-contracts/_cross-cutting/api/contracts.json', 'utf8')).asyncapi;
  assert.deepEqual(bundle, legacy);
  assert.equal(bundle.operations.sendLoan.channel.$ref, '#/channels/loan~1created');
  assert.equal(bundle.operations.sendLoan.messages[0].$ref, '#/channels/loan~1created/messages/LoanCreated');
  assert.equal(run(root, true).status, 'current');
  assert.equal(run(sample, true).status, 'current');
  assert.equal(validateSummary(read(path.join(root, uc, '_api-summary.yaml')), path.join(root, uc)), true);
});

test('payload edits make bundle and UC slice stale and propagate after compilation', t => {
  const { root, api } = fixture(t);
  run(root);
  const before = projection(root);
  const f = path.join(api, 'components/schemas/LoanCreatedPayload.yaml');
  const value = read(f); value.properties.loanId.minLength = 3; write(f, value);
  assert.throws(() => run(root, true), /Stale generated contracts/);
  run(root);
  assert.notDeepEqual(projection(root), before);
  assert.equal(projection(root).components.schemas.LoanCreatedPayload.properties.loanId.minLength, 3);
  assert.equal(run(root, true).status, 'current');
});

test('broken split reference fails before producing any contract files', t => {
  const { root, api } = fixture(t);
  fs.unlinkSync(path.join(api, 'components/schemas/LoanCreatedPayload.yaml'));
  assert.throws(() => run(root), /AsyncAPI bundle failed/);
  assert.equal(fs.existsSync(path.join(api, 'generated')), false);
  assert.equal(fs.existsSync(path.join(root, uc)), false);
});

test('cross-operation consumer slice includes channel, message, server and transitive schema closure', t => {
  const { root, api } = fixture(t);
  const entryPath = path.join(api, 'asyncapi.yaml');
  const entry = read(entryPath);
  entry.operations.receiveLoan = { $ref: './operations/receiveLoan.yaml' };
  write(entryPath, entry);
  const op = read(path.join(api, 'operations/sendLoan.yaml')); op.action = 'receive';
  write(path.join(api, 'operations/receiveLoan.yaml'), op);
  const catalogFile = path.join(api, 'contracts.json');
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const consumer = { business: '通知業務', buc: '通知フロー', uc: '貸出通知',
    provides: [{ kind: 'asyncapi', operation_id: 'receiveLoan', tier: 'tier-worker' }],
    consumes: [{ kind: 'asyncapi', operation_id: 'sendLoan', tier: 'tier-worker' }] };
  catalog.use_cases.push(consumer); fs.writeFileSync(catalogFile, JSON.stringify(catalog));
  run(root);
  assert.deepEqual(Object.keys(projection(root).operations), ['sendLoan']);
  const selected = projection(root, '通知業務/通知フロー/貸出通知');
  assert.deepEqual(Object.keys(selected.operations), ['receiveLoan', 'sendLoan']);
  assert.ok(selected.channels['loan/created'].messages.LoanCreated);
  assert.ok(selected.components.schemas.LoanCreatedPayload.properties.loanId);
  assert.ok(selected.components.messages.LoanCreated.headers.properties.idempotency_key);
  assert.ok(selected.servers.broker);
});

test('cyclic payload references remain finite native references in the UC closure', t => {
  const { root, api } = fixture(t);
  const file = path.join(api, 'components/schemas/LoanCreatedPayload.yaml');
  const payload = read(file);
  payload.properties.previous = { $ref: '../../asyncapi.yaml#/components/schemas/LoanCreatedPayload' };
  write(file, payload);
  run(root);
  assert.equal(projection(root).components.schemas.LoanCreatedPayload.properties.previous.$ref,
    '#/components/schemas/LoanCreatedPayload');
  assert.equal(run(root, true).status, 'current');
});

test('same message name with a different payload cannot be rebound into a channel', t => {
  const { root, api } = fixture(t);
  const f = path.join(api, 'operations/sendLoan.yaml');
  const op = read(f); op.messages = [{ $ref: '../components/messages/OtherLoanCreated.yaml' }]; write(f, op);
  write(path.join(api, 'components/messages/OtherLoanCreated.yaml'), { name: 'LoanCreated', payload: { type: 'integer' } });
  const entry = read(path.join(api, 'asyncapi.yaml'));
  entry.components.messages.OtherLoanCreated = { $ref: './components/messages/OtherLoanCreated.yaml' };
  write(path.join(api, 'asyncapi.yaml'), entry);
  assert.throws(() => run(root), /Operation message: reference must resolve uniquely/);
  assert.equal(fs.existsSync(path.join(api, 'generated')), false);
});

test('migration cannot delete AsyncAPI authoring source tracked by an old generated-file manifest', t => {
  const { root, api } = fixture(t);
  const original = fs.readFileSync(path.join(api, 'asyncapi.yaml'), 'utf8');
  fs.writeFileSync(path.join(api, '.contracts-build.json'), JSON.stringify({ files: { '_cross-cutting/api/asyncapi.yaml': sha(original) } }));
  assert.throws(() => run(root), /Before migrating.*asyncapi.yaml/);
  assert.equal(fs.readFileSync(path.join(api, 'asyncapi.yaml'), 'utf8'), original);
});

test('official AsyncAPI parser accepts generated bundle', async t => {
  const { root, api } = fixture(t);
  run(root);
  const { Parser } = require('@asyncapi/parser');
  const { document, diagnostics } = await new Parser().parse(fs.readFileSync(path.join(api, 'generated/asyncapi.bundle.yaml'), 'utf8'));
  assert.ok(document, JSON.stringify(diagnostics));
  assert.deepEqual(diagnostics.filter(d => d.severity === 0), []);
});
