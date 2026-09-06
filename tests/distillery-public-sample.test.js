'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const { spawnSync } = require('node:child_process');
const { run } = require('../plugins/distillery/skills/dist-spec/scripts/compileContracts');
const { compileRdbSchema } = require('../plugins/distillery/skills/dist-spec/scripts/compileRdbSchema');
const { build, elements, tsv } = require('../plugins/distillery/skills/dist-spec/scripts/buildSpecViews');
const sample = path.resolve(__dirname, '../samples/distillery/pipeline');
const specs = path.join(sample, 'specs/latest');
const read = relative => fs.readFileSync(path.join(sample, relative), 'utf8');

test('public regenerated sample has current portable contracts and split RDB projections', () => {
  const catalog = JSON.parse(read('specs/latest/_cross-cutting/api/contracts.json'));
  assert.equal(catalog.openapi, 'openapi/openapi.yaml');
  assert.equal(catalog.asyncapi, 'asyncapi/asyncapi.yaml');
  assert.equal(fs.existsSync(path.join(specs, '_cross-cutting/api/components')), false);
  assert.equal(run(specs, true).status, 'current');
  const rdb = compileRdbSchema(path.join(specs, '_cross-cutting/datastore/rdb-schema.yaml'), { check: true });
  assert.equal(rdb.domains, 5);
  assert.equal(rdb.tables, 17);
  const result = spawnSync(process.execPath, [path.resolve('plugins/distillery/skills/dist-spec/scripts/validateSpecEvent.js'), specs, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.stats.uc_count, 27);
  assert.deepEqual(report.warnings, []);
});

test('public UC inventory and trace evidence match current RDRA after relocation', () => {
  const rdra = path.join(sample, 'rdra/latest');
  for (const [file, content] of build(specs, rdra)) assert.equal(fs.readFileSync(path.join(specs, file), 'utf8'), content, file);
  const index = JSON.parse(read('specs/latest/_cross-cutting/traceability-index.json'));
  assert.deepEqual(index.elements.map(x => x.key).sort(), elements(rdra).map(x => x.key).sort());
  assert.ok(index.elements.every(x => x.status === 'linked'));
  const expected = new Set(tsv(read('rdra/latest/BUC.tsv')).filter(x => x.UC).map(x => [x.業務, x.BUC, x.UC].join('/')));
  const catalog = JSON.parse(read('specs/latest/_cross-cutting/api/contracts.json'));
  assert.deepEqual(catalog.use_cases.map(x => [x.business, x.buc, x.uc].join('/')).sort(), [...expected].sort());
});

test('public product Markdown references existing files and current upstream owners', () => {
  const visit = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? visit(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const files = visit(specs).filter(file => /(?:spec|tier-[^/]+|technical-rules|ui-design|common-components)\.md$/.test(file));
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /(?:rdra|design|arch)\/events\//, file);
    for (const [, href] of text.matchAll(/(?<!!)\[[^\]]*\]\(([^\s)]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(file), decodeURIComponent(href.split('#')[0]))), `${file}: ${href}`);
    }
  }
});

test('public design screen variants correspond exactly to the generated page Story exports', () => {
  const design = YAML.parse(read('design/latest/design-event.yaml'));
  const ids = new Set();
  let totalExports = 0;
  assert.equal(design.screens.length, 24);
  for (const screen of design.screens) {
    const file = path.join(sample, 'design/latest/storybook-app/src/stories', screen.story + '.stories.tsx');
    const source = fs.readFileSync(file, 'utf8');
    const exports = [...source.matchAll(/^export const (\w+)\s*:/gm)].map(m => m[1]);
    assert.deepEqual(exports.sort(), [...screen.variants].sort(), screen.name);
    const id = source.match(/const meta[\s\S]*?\bid\s*:\s*['"]([^'"]+)['"]/)?.[1];
    assert.ok(id && /^[a-z0-9-]+$/.test(id), screen.name);
    assert.ok(!ids.has(id), `duplicate Story id ${id}`);
    ids.add(id);
    totalExports += exports.length;
  }
  assert.ok(totalExports >= 24);
});
