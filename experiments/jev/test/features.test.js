'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { extractFeatures, parseTsv } = require('../lib/features');

const SAMPLE_DOCS = path.resolve(__dirname, '..', '..', '..', 'samples', 'distillery', 'pipeline');

test('extractFeatures: 見本から件数が取れる', () => {
  const features = extractFeatures(SAMPLE_DOCS);
  assert.equal(features.counts.externalSystems, 1);
  assert.equal(features.counts.actors, 3);
  assert.equal(features.counts.externalActors, 1);
  assert.equal(features.counts.information, 9);
  assert.equal(features.counts.maxStateTransitions, 7);
  assert.equal(features.counts.buc, 10);
  assert.ok(features.counts.uc > 0);
});

test('extractFeatures: slices が取れる', () => {
  const features = extractFeatures(SAMPLE_DOCS);
  assert.ok(features.slices.activities.length > 0);
  assert.ok(features.slices.externalSystems.some((s) => s.name === 'メール配信サービス'));
  assert.ok(features.slices.actors.some((a) => a.name === '利用者' && a.internalExternal === '社外'));
  assert.ok(features.slices.information.some((i) => i.name === '書籍'));
  assert.ok(features.slices.conditions.some((c) => c.name === '貸出可否判定'));
  assert.equal(features.slices.stateModels.length, 3);
  assert.equal(features.slices.overview.system_name, '図書館蔵書管理システム');
});

test('extractFeatures: nfr の id -> grade が取れる', () => {
  const features = extractFeatures(SAMPLE_DOCS);
  assert.equal(features.nfr['A.2.1.1'], 3);
  assert.equal(features.nfr['B.1.1.1'], 1);
  assert.equal(features.nfr['B.1.1.2'], 1);
  assert.equal(features.nfr['A.3.1.1'], 1);
});

test('parseTsv: `""` だけのセルを空として扱う', () => {
  const { headers, rows } = parseTsv('a\tb\tc\nfoo\t""\tbar\n');
  assert.deepEqual(headers, ['a', 'b', 'c']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].a, 'foo');
  assert.equal(rows[0].b, '');
  assert.equal(rows[0].c, 'bar');
});

test('parseTsv: 空行を無視する', () => {
  const { rows } = parseTsv('a\tb\nfoo\tbar\n\n');
  assert.equal(rows.length, 1);
});
