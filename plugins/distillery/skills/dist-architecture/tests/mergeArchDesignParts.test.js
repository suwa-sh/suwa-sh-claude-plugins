'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { mergeParts, topLevelKeys } = require('../scripts/mergeArchDesignParts');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'mergeArchDesignParts.js');

function makePartsDir(parts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-parts-'));
  for (const [name, content] of Object.entries(parts)) {
    fs.writeFileSync(path.join(dir, name), content, 'utf8');
  }
  return dir;
}

test('topLevelKeys detects only column-0 bare keys', () => {
  const text = 'version: "1.0"\napp_architecture:\n  layers:\n    - name: usecase\n';
  assert.deepEqual(topLevelKeys(text), { keys: ['version', 'app_architecture'], quoted: [] });
});

test('topLevelKeys collects quoted keys separately', () => {
  const text = '"version": "1.0"\n\'source\': x\ndata_architecture:\n';
  const result = topLevelKeys(text);
  assert.deepEqual(result.keys, ['data_architecture']);
  assert.equal(result.quoted.length, 2);
});

test('mergeParts rejects quoted top-level keys (escape-bypass prevention)', () => {
  const dir = makePartsDir({
    '01-a.yaml': 'version: "1.0"\n',
    '02-b.yaml': '"ver\\u0073ion": "2.0"\n',
  });
  const result = mergeParts(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /quoted トップレベルキー/);
});

test('mergeParts rejects quoted keys with space before colon', () => {
  const dir = makePartsDir({
    '01-a.yaml': 'version: "1.0"\n',
    '02-b.yaml': '"version" : "2.0"\n',
  });
  const result = mergeParts(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /quoted トップレベルキー/);
});

test('mergeParts detects bare-key duplicates with space before colon', () => {
  const dir = makePartsDir({
    '01-a.yaml': 'version: "1.0"\n',
    '02-b.yaml': 'version : "2.0"\n',
  });
  const result = mergeParts(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /"version"/);
});

test('mergeParts concatenates parts in filename order', () => {
  const dir = makePartsDir({
    '02-system.yaml': 'system_architecture:\n  tiers: []\n',
    '01-meta.yaml': 'version: "1.0"\nevent_id: "x"\n',
    '10-data.yaml': 'data_architecture:\n  entities: []\n',
  });
  const result = mergeParts(dir);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.files, ['01-meta.yaml', '02-system.yaml', '10-data.yaml']);
  assert.equal(
    result.text,
    'version: "1.0"\nevent_id: "x"\nsystem_architecture:\n  tiers: []\ndata_architecture:\n  entities: []\n'
  );
});

test('mergeParts rejects duplicate top-level keys across parts', () => {
  const dir = makePartsDir({
    '01-a.yaml': 'version: "1.0"\n',
    '02-b.yaml': 'version: "2.0"\n',
  });
  const result = mergeParts(dir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /"version"/);
});

test('mergeParts rejects parts without top-level keys', () => {
  const dir = makePartsDir({ '01-a.yaml': '  indented: true\n' });
  const result = mergeParts(dir);
  assert.match(result.errors[0], /トップレベルキーがありません/);
});

test('mergeParts rejects document separators', () => {
  const dir = makePartsDir({ '01-a.yaml': '---\nversion: "1.0"\n' });
  const result = mergeParts(dir);
  assert.match(result.errors[0], /document 区切り/);
});

test('CLI writes output and keeps parts dir by default', () => {
  const dir = makePartsDir({ '01-meta.yaml': 'version: "1.0"\n' });
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'arch-out-')), 'arch-design.yaml');
  const result = spawnSync(process.execPath, [SCRIPT, dir, out], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(out, 'utf8'), 'version: "1.0"\n');
  assert.equal(fs.existsSync(dir), true);
});

test('CLI removes parts dir with --rm-parts', () => {
  const dir = makePartsDir({ '01-meta.yaml': 'version: "1.0"\n' });
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'arch-out-')), 'arch-design.yaml');
  const result = spawnSync(process.execPath, [SCRIPT, dir, out, '--rm-parts'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(dir), false);
});

test('CLI fails with exit 1 on duplicate keys', () => {
  const dir = makePartsDir({
    '01-a.yaml': 'version: "1.0"\n',
    '02-b.yaml': 'version: "2.0"\n',
  });
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'arch-out-')), 'arch-design.yaml');
  const result = spawnSync(process.execPath, [SCRIPT, dir, out], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(out), false);
});
