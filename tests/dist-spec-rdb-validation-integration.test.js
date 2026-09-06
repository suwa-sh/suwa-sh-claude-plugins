'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const YAML = require('yaml');
const { compileRdbSchema } = require('../plugins/distillery/skills/dist-spec/scripts/compileRdbSchema');
test('event validation detects stale split RDB projections without treating index as legacy tables', t => {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dist-rdb-validation-'));
  t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const event=path.join(tmp,'event'); const dir=path.join(event,'_cross-cutting/datastore');
  fs.cpSync(path.resolve('tests/fixtures/distillery/spec-progressive/rdb'),dir,{recursive:true});
  const arch=path.join(tmp,'arch/latest');fs.mkdirSync(arch,{recursive:true});
  fs.copyFileSync(path.resolve('tests/fixtures/distillery/legacy-pipeline/arch/latest/arch-design.yaml'),path.join(arch,'arch-design.yaml'));
  const entry=path.join(dir,'rdb-schema.yaml'); const source=YAML.parse(fs.readFileSync(entry,'utf8'));
  source.architecture_ref='../../../arch/latest/arch-design.yaml'; fs.writeFileSync(entry,YAML.stringify(source));
  compileRdbSchema(entry);
  const inspect=()=>spawnSync(process.execPath,[path.resolve('plugins/distillery/skills/dist-spec/scripts/validateSpecEvent.js'),event,'--json'],{encoding:'utf8'});
  const valid=inspect(); assert.equal(valid.status,1); // Other event metadata intentionally omitted.
  assert.doesNotMatch(valid.stdout+valid.stderr,/Split RDB validation failed|rdb-schema.yaml.*tables/);
  const bundle=path.join(dir,'generated/rdb-schema.bundle.yaml');fs.writeFileSync(bundle,fs.readFileSync(bundle,'utf8')+'# edited generated copy\n');
  assert.match(inspect().stdout,/Split RDB validation failed: stale RDB projections/);
});
