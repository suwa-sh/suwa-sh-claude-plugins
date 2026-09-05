'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, compile } = require('../plugins/distillery/skills/dist-spec/scripts/compileContracts');
const { build } = require('../plugins/distillery/skills/dist-spec/scripts/buildSpecViews');
const root = path.resolve(__dirname, '../samples/distillery/spec-ready');
const uc = '蔵書利用業務/書籍を貸し出すフロー/貸出を登録する';

test('real loan sample is a valid event with deterministic contracts and selected RDRA views', () => {
  assert.equal(run(root, true).status, 'current');
  for (const [file, body] of build(root, path.join(root, '_inputs/rdra'))) {
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), body, file);
  }
  const result = spawnSync(process.execPath, [path.resolve('plugins/distillery/skills/dist-spec/scripts/validateSpecEvent.js'), root, '--json'], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).stats.uc_count, 4);
});

test('actual loan contract slice retains all three read dependencies and rejects non-v4 keys', () => {
  const c = JSON.parse(fs.readFileSync(path.join(root, '_cross-cutting/api/contracts.json')));
  const doc = JSON.parse(compile(c).get(`${uc}/_contract-slice.json`)).openapi;
  const ids = Object.values(doc.paths).flatMap(p => Object.values(p).map(o => o.operationId).filter(Boolean));
  assert.deepEqual(ids.sort(), ['checkLoanEligibility','createLoan','getBookAvailability','getLoanTarget']);
  const rule = new RegExp(doc.components.parameters.IdempotencyKeyHeader.schema.pattern);
  assert.ok(rule.test('00000000-0000-4000-8000-000000000001'));
  for (const bad of ['idem-0001', '00000000-0000-1000-8000-000000000001', '00000000-0000-4000-1000-000000000001']) assert.ok(!rule.test(bad));
  assert.equal(doc.components.schemas.CreateLoanRequest.additionalProperties, false);
  assert.ok(doc.paths['/api/v1/loans'].post.responses['503']);
});

test('sample Markdown file references resolve, including scoped shared contracts', () => {
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.md')) {
        const text = fs.readFileSync(file,'utf8');
        for (const [,href] of text.matchAll(/(?<!!)\[[^\]]*\]\(([^\s)]+)\)/g)) {
          if (/^(https?:|mailto:|#)/.test(href)) continue;
          const target = decodeURIComponent(href.split('#')[0]);
          assert.ok(fs.existsSync(path.resolve(path.dirname(file), target)), `${file}: ${href}`);
        }
      }
    }
  }
  visit(root);
});

test('persisted transaction probe survives injected disconnects and replays without extra loans', () => {
  const result = spawnSync('python3', [path.join(root, '_review/recovery_probe.py')], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /Ran 7 tests/);
});
