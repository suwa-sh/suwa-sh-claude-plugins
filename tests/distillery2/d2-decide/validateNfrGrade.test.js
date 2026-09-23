'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadDataFile } = require('../../../plugins/distillery2/scripts/lib/schemaValidate');
const { validateNfrGrade, catalogMetricIds } = require('../../../plugins/distillery2/skills/d2-decide/scripts/validateNfrGrade');

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

test('カタログはメトリクス ID の正本を返す (サンプルと同数の 97 件)', () => {
  const ids = catalogMetricIds();
  assert.ok(ids.length >= 90, `catalog ids: ${ids.length}`);
  assert.ok(ids.includes('A.1.1.1') && ids.includes('F.5.1.2'));
});

test('メトリクス ID が重複すると FAIL (指摘5)', () => {
  const data = loadDataFile(V1_SAMPLE);
  const m0 = data.categories[0].subcategories[0].items[0].metrics[0];
  // 同じ ID・別グレードのメトリクスを 1 件追加する
  data.categories[0].subcategories[0].items[0].metrics.push({ id: m0.id, name: 'dup', important: false, grade: (m0.grade + 1) % 6 });
  const { errors } = validateNfrGrade(data);
  assert.ok(errors.some(e => /Duplicate metric ids/.test(e.message)), JSON.stringify(errors));
  assert.ok(errors.some(e => /Metric count mismatch/.test(e.message)), JSON.stringify(errors));
});

test('カタログに無いメトリクス ID があると FAIL (指摘5)', () => {
  const data = loadDataFile(V1_SAMPLE);
  data.categories[0].subcategories[0].items[0].metrics.push({ id: 'Z.9.9.9', name: 'bogus', important: false, grade: 1 });
  const { errors } = validateNfrGrade(data);
  assert.ok(errors.some(e => /Unknown metrics not in catalog/.test(e.message) && /Z\.9\.9\.9/.test(e.message)), JSON.stringify(errors));
  assert.ok(errors.some(e => /Metric count mismatch/.test(e.message)), JSON.stringify(errors));
});

test('カテゴリだけ揃えても各 1 メトリクスの不完全な表は FAIL (欠落 ID を列挙)', () => {
  const seed = ['A.1.1.1', 'B.1.1.1', 'C.1.1.1', 'D.1.1.1', 'E.1.1.1', 'F.1.1.1'];
  const data = {
    model_system: { type: 'model2' },
    categories: seed.map(id => ({
      id: id[0],
      name: id[0],
      subcategories: [{
        id: id.slice(0, 3), name: 'sub',
        items: [{
          id: id.slice(0, 5), name: 'item', important: true,
          metrics: [{ id, name: 'm', important: true, grade: 2 }],
        }],
      }],
    })),
  };
  const { errors, metricCount } = validateNfrGrade(data);
  assert.equal(metricCount, 6);
  assert.ok(errors.some(e => /Missing metrics/.test(e.message)), JSON.stringify(errors));
});
