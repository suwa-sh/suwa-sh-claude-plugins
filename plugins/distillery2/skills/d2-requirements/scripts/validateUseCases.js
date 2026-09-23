#!/usr/bin/env node
/**
 * validateUseCases.js (distillery2)
 *
 * use-cases.yaml を検証する。
 *   - 構造: schema-use-cases.json
 *   - 意味: uc_id 一意 / slug 一意 / slug パターン / spec_ids が requirements.yaml に実在
 *
 * Usage:
 *   node validateUseCases.js <use-cases.yaml> [requirements.yaml] [--json]
 *   既定 requirements: use-cases.yaml と同じディレクトリの requirements.yaml
 *
 * 終了コード: 0 = PASS / 1 = エラー / 2 = 読み込み失敗
 * npm 依存なし。共有ライブラリ (../../../scripts/lib) のみ使用。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateWithSchema, loadDataFile } = require('../../../scripts/lib/schemaValidate');

function collectSpecIds(reqData) {
  const ids = new Set();
  for (const req of (reqData && reqData.requirements) || []) {
    for (const spec of req.specifications || []) if (spec.id) ids.add(spec.id);
  }
  return ids;
}

function validateSemantics(data, specIdSet) {
  const errors = [];
  const ucIds = new Map();
  const slugs = new Map();
  const ucs = Array.isArray(data && data.use_cases) ? data.use_cases : [];
  for (let i = 0; i < ucs.length; i++) {
    const uc = ucs[i];
    const p = `$.use_cases[${i}]`;
    if (uc && typeof uc.uc_id === 'string') {
      if (ucIds.has(uc.uc_id)) errors.push({ path: `${p}.uc_id`, message: `uc_id ${uc.uc_id} duplicates ${ucIds.get(uc.uc_id)}` });
      else ucIds.set(uc.uc_id, `${p}.uc_id`);
    }
    if (uc && typeof uc.slug === 'string') {
      if (slugs.has(uc.slug)) errors.push({ path: `${p}.slug`, message: `slug "${uc.slug}" duplicates ${slugs.get(uc.slug)}` });
      else slugs.set(uc.slug, `${p}.slug`);
    }
    if (specIdSet) {
      for (const sid of (uc && uc.spec_ids) || []) {
        if (!specIdSet.has(sid)) errors.push({ path: `${p}.spec_ids`, message: `spec_id ${sid} は requirements.yaml に存在しない` });
      }
    }
  }
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  if (!positional.length) { console.error('Usage: node validateUseCases.js <use-cases.yaml> [requirements.yaml] [--json]'); process.exit(2); }

  const ucPath = path.resolve(positional[0]);
  if (!fs.existsSync(ucPath)) { console.error(`File not found: ${ucPath}`); process.exit(2); }
  const reqPath = path.resolve(positional[1] || path.join(path.dirname(ucPath), 'requirements.yaml'));

  let data;
  try { data = loadDataFile(ucPath); } catch (e) { console.error(`Parse error: ${e.message}`); process.exit(2); }
  let specIdSet = null;
  if (fs.existsSync(reqPath)) { try { specIdSet = collectSpecIds(loadDataFile(reqPath)); } catch { specIdSet = null; } }

  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema-use-cases.json'), 'utf8'));
  const errors = [...validateWithSchema(data, schema), ...validateSemantics(data, specIdSet)];

  if (!errors.length) {
    console.log(`PASS: ${ucPath}`);
    console.log(`  UCs: ${(data.use_cases || []).length}`);
    if (!specIdSet) console.log('  (requirements.yaml が無いため spec_ids 実在チェックは省略)');
    if (flags.has('--json')) console.log(JSON.stringify({ status: 'pass', file: ucPath }, null, 2));
    process.exit(0);
  }
  console.log(`FAIL: ${ucPath}`);
  console.log(`  ${errors.length} error(s):`);
  for (const e of errors) console.log(`  - ${e.path}: ${e.message}`);
  if (flags.has('--json')) console.log(JSON.stringify({ status: 'fail', errors, file: ucPath }, null, 2));
  process.exit(1);
}

if (require.main === module) main();

module.exports = { collectSpecIds, validateSemantics };
