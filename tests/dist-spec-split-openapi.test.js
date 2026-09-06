'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('../plugins/distillery/skills/dist-spec/scripts/compileContracts');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'split-openapi-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const api = path.join(root, '_cross-cutting/api');
  fs.mkdirSync(path.join(api, 'paths'), { recursive: true });
  fs.mkdirSync(path.join(api, 'components/schemas'), { recursive: true });
  const catalog = { schema_version: 'distillery.contracts/v1', openapi: 'openapi.yaml', asyncapi: null,
    use_cases: [{ business: 'business', buc: 'flow', uc: 'read',
      provides: [{ kind: 'openapi', operation_id: 'getLoan', tier: 'tier-backend-api' }], consumes: [] }] };
  fs.writeFileSync(path.join(api, 'contracts.json'), JSON.stringify(catalog));
  fs.writeFileSync(path.join(api, 'openapi.yaml'), `openapi: 3.1.0
info:
  title: Loan
  version: 1.0.0
paths:
  /loans:
    $ref: ./paths/loans.yaml
components:
  schemas:
    Loan:
      $ref: ./components/schemas/Loan.yaml
`);
  fs.writeFileSync(path.join(api, 'paths/loans.yaml'), `get:
  operationId: getLoan
  responses:
    '200':
      description: Loan
      content:
        application/json:
          schema:
            $ref: ../components/schemas/Loan.yaml
`);
  fs.writeFileSync(path.join(api, 'components/schemas/Loan.yaml'), `type: object
required: [id]
properties:
  id:
    type: string
    minLength: 1
`);
  return { root, api, catalog };
}

test('split YAML resolves path/schema references, preserves authoring source and propagates changes', t => {
  const { root, api } = fixture(t);
  const source = fs.readFileSync(path.join(api, 'openapi.yaml'), 'utf8');
  run(root);
  assert.equal(fs.readFileSync(path.join(api, 'openapi.yaml'), 'utf8'), source);
  const bundle = JSON.parse(fs.readFileSync(path.join(api, 'generated/openapi.bundle.yaml'), 'utf8'));
  assert.equal(bundle.paths['/loans'].get.operationId, 'getLoan');
  assert.equal(bundle.components.schemas.Loan.properties.id.minLength, 1);
  assert.equal(run(root, true).status, 'current');
  const slicePath = path.join(root, 'business/flow/read/_contract-slice.json');
  const before = fs.readFileSync(slicePath, 'utf8');
  const schemaPath = path.join(api, 'components/schemas/Loan.yaml');
  fs.writeFileSync(schemaPath, fs.readFileSync(schemaPath, 'utf8').replace('minLength: 1', 'minLength: 3'));
  assert.throws(() => run(root, true), /Stale generated contracts/);
  run(root);
  assert.notEqual(fs.readFileSync(slicePath, 'utf8'), before);
  assert.equal(run(root, true).status, 'current');
});

test('broken external references fail before any output is written', t => {
  const { root, api } = fixture(t);
  fs.unlinkSync(path.join(api, 'components/schemas/Loan.yaml'));
  assert.throws(() => run(root), /OpenAPI bundle failed/);
  assert.equal(fs.existsSync(path.join(api, 'generated')), false);
});

test('split native operations still require a unique implementation owner', t => {
  const { root, api, catalog } = fixture(t);
  catalog.use_cases[0].provides = [];
  fs.writeFileSync(path.join(api, 'contracts.json'), JSON.stringify(catalog));
  assert.throws(() => run(root), /Missing owner/);
  assert.equal(fs.existsSync(path.join(api, 'generated')), false);
});

test('event validation and dependency views consume split contracts through bundle resolution', t => {
  const { root } = fixture(t);
  run(root);
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(process.execPath, [path.resolve('plugins/distillery/skills/dist-spec/scripts/validateSpecEvent.js'), root, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 1); // Contract fixture intentionally omits event metadata and UI files.
  assert.doesNotMatch(result.stdout + result.stderr, /Contract catalog:|api\/.*(?:ありません|Unexpected)/);
  const rdra = path.join(root, 'rdra');
  fs.mkdirSync(rdra);
  for (const name of ['情報', '条件', '状態']) fs.writeFileSync(path.join(rdra, `${name}.tsv`), 'header\n');
  fs.writeFileSync(path.join(rdra, 'BUC.tsv'), '業務\tBUC\tUC\nbusiness\tflow\tread\n');
  fs.writeFileSync(path.join(root, 'business/flow/read/spec.md'), '# Read\n');
  const { build } = require('../plugins/distillery/skills/dist-spec/scripts/buildSpecViews');
  const views = build(root, rdra);
  assert.ok(views.has('business/flow/buc-spec.md'));
});

test('latest-linked sample bundle and UC contract projections reproduce from human-editable split sources', () => {
  const sample = path.resolve('samples/distillery/spec-latest-linked/docs/specs/events/20260906_120000_spec_generation');
  assert.equal(run(sample, true).status, 'current');
  const mapping = JSON.parse(fs.readFileSync(path.join(sample, '_cross-cutting/api/contracts.json'), 'utf8'));
  assert.equal(mapping.openapi, 'openapi.yaml');
  assert.equal(mapping.use_cases.length, 4);
  const bundle = JSON.parse(fs.readFileSync(path.join(sample, '_cross-cutting/api/generated/openapi.bundle.yaml'), 'utf8'));
  assert.equal(Object.keys(bundle.paths).length, 4);
});
