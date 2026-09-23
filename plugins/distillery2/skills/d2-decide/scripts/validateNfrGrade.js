#!/usr/bin/env node
/**
 * validateNfrGrade.js (distillery2)
 *
 * docs/nfr/nfr-grade.yaml を検証する。共有ライブラリ (scripts/lib) を使う。
 *
 * Usage:
 *   node validateNfrGrade.js <path-to-nfr-grade.yaml> [--json]
 *
 * 終了コード: 0 = PASS / 1 = エラー / 2 = 読み込み失敗
 *
 * v1 との違い:
 *   - パーサ / スキーマ検証を共有ライブラリに委譲
 *   - basis (requirements@<sha>) を持つ v2 出力も、basis を持たない v1 サンプルも通す
 *     (schema で basis を任意にしているため)
 */
'use strict';

const path = require('node:path');
const { validateWithSchema, loadDataFile } = require('../../../scripts/lib/schemaValidate');
const fs = require('node:fs');

const EXPECTED_CATEGORY_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** スキーマでは表現しづらい NFR 固有の制約 */
function nfrSpecificErrors(data) {
  const errors = [];
  const categories = data.categories || [];
  const actualIds = categories.map(c => c.id);
  for (const id of EXPECTED_CATEGORY_IDS) {
    if (!actualIds.includes(id)) errors.push({ path: '$.categories', message: `Missing category: ${id}` });
  }
  let metricCount = 0;
  let importantCount = 0;
  for (const cat of categories) {
    for (const sub of cat.subcategories || []) {
      for (const item of sub.items || []) {
        for (const metric of item.metrics || []) {
          metricCount++;
          if (metric.important) importantCount++;
          if (typeof metric.grade === 'number' && (metric.grade < 0 || metric.grade > 5)) {
            errors.push({ path: `$.categories[${cat.id}].${metric.id}`, message: `grade ${metric.grade} out of range [0-5]` });
          }
        }
      }
    }
  }
  return { errors, metricCount, importantCount };
}

function validateNfrGrade(data) {
  const schemaPath = path.join(__dirname, 'schema-nfr-grade.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const schemaErrors = validateWithSchema(data, schema);
  const { errors: nfrErrors, metricCount, importantCount } = nfrSpecificErrors(data);
  return { errors: [...schemaErrors, ...nfrErrors], metricCount, importantCount };
}

function main(argv) {
  const args = argv.filter(a => !a.startsWith('--'));
  const flags = new Set(argv.filter(a => a.startsWith('--')));
  if (!args.length) { console.error('Usage: node validateNfrGrade.js <path-to-nfr-grade.yaml> [--json]'); return 2; }
  const target = path.resolve(args[0]);
  if (!fs.existsSync(target)) { console.error(`File not found: ${target}`); return 2; }
  let data;
  try { data = loadDataFile(target); } catch (e) { console.error(`Parse error: ${e.message}`); return 2; }
  const { errors, metricCount, importantCount } = validateNfrGrade(data);
  if (!errors.length) {
    console.log(`PASS: ${target}`);
    console.log(`  Model System: ${data.model_system?.type || 'unknown'}`);
    console.log(`  Categories: ${(data.categories || []).length}`);
    console.log(`  Metrics: ${metricCount} (important: ${importantCount})`);
    if (flags.has('--json')) console.log(JSON.stringify({ status: 'pass', file: target }, null, 2));
    return 0;
  }
  console.log(`FAIL: ${target}`);
  console.log(`  ${errors.length} error(s):`);
  for (const e of errors) console.log(`  - ${e.path}: ${e.message}`);
  if (flags.has('--json')) console.log(JSON.stringify({ status: 'fail', errors, file: target }, null, 2));
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { validateNfrGrade, nfrSpecificErrors };
