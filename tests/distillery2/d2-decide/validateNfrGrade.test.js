'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadDataFile } = require('../../../plugins/distillery2/scripts/lib/schemaValidate');
const { validateNfrGrade } = require('../../../plugins/distillery2/skills/d2-decide/scripts/validateNfrGrade');

const V1_SAMPLE = path.resolve(__dirname, '../../../samples/distillery/pipeline/nfr/latest/nfr-grade.yaml');

test('v1 サンプル nfr-grade.yaml (basis なし) を通す', () => {
  const data = loadDataFile(V1_SAMPLE);
  const { errors, metricCount } = validateNfrGrade(data);
  assert.deepEqual(errors, [], JSON.stringify(errors));
  assert.ok(metricCount > 0);
});

test('basis を持つ v2 形式も通す', () => {
  const data = loadDataFile(V1_SAMPLE);
  data.basis = 'requirements@abc1234';
  const { errors } = validateNfrGrade(data);
  assert.deepEqual(errors, [], JSON.stringify(errors));
});

test('6 カテゴリが揃わないとエラー', () => {
  const data = loadDataFile(V1_SAMPLE);
  data.categories = data.categories.filter(c => c.id !== 'F');
  const { errors } = validateNfrGrade(data);
  assert.ok(errors.some(e => /Missing category: F/.test(e.message) || /Array too short/.test(e.message)), JSON.stringify(errors));
});

test('grade が範囲外だとエラー', () => {
  const data = loadDataFile(V1_SAMPLE);
  data.categories[0].subcategories[0].items[0].metrics[0].grade = 9;
  const { errors } = validateNfrGrade(data);
  assert.ok(errors.some(e => /grade 9|maximum/.test(e.message)), JSON.stringify(errors));
});
