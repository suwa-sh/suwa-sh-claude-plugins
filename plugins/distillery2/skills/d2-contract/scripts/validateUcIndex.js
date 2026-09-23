#!/usr/bin/env node
'use strict';

/**
 * validateUcIndex.js <contracts-dir> [--json]
 *
 * uc-index.yaml を検査する:
 *  1. スキーマ (schema-uc-index.json)
 *  2. 参照実在性: operations は openapi.bundle、messages は asyncapi.bundle の components.messages、
 *     tables は rdb-schema.bundle に存在すること
 *  3. examples 必須ルール: UC が使う各 operation に request example (requestBody があるとき) と、
 *     ドキュメント化された各 2xx/4xx status の response example があること
 *
 * bundle が未生成なら compileContracts/compileRdbSchema を先に実行するよう促す。
 * 終了コード: 0 = PASS / 1 = 違反あり / 2 = 読み込み失敗。
 */

const fs = require('node:fs');
const path = require('node:path');
const C = require('./lib/contractsDir');
const G = require('./lib/contractGraph');
const { validateWithSchema } = require('../../../scripts/lib/schemaValidate');
const { parseYaml } = require('../../../scripts/lib/yaml');

function validate(contractsDir) {
  const errors = [];
  const ucIndex = C.readUcIndex(contractsDir);
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema-uc-index.json'), 'utf8'));
  for (const e of validateWithSchema(ucIndex, schema)) errors.push(`schema ${e.path}: ${e.message}`);

  const openapi = C.readBundle(contractsDir, 'openapi.bundle.yaml');
  const asyncapi = C.readBundle(contractsDir, 'asyncapi.bundle.yaml');
  const rdbBundlePath = path.join(C.generatedDir(contractsDir), 'rdb-schema.bundle.yaml');
  const rdb = fs.existsSync(rdbBundlePath) ? parseYaml(fs.readFileSync(rdbBundlePath, 'utf8')) : null;

  const openapiIndex = openapi ? G.operations(openapi, 'openapi') : new Map();
  const messageNames = new Set(Object.keys(asyncapi?.components?.messages || {}));
  const tableNames = new Set((rdb?.tables || []).map(t => t.name));

  for (const uc of ucIndex.ucs) {
    if (uc.operations.length && !openapi) errors.push(`${uc.slug}: openapi.bundle.yaml が無い。compileContracts を先に実行`);
    if (uc.messages.length && !asyncapi) errors.push(`${uc.slug}: asyncapi.bundle.yaml が無い。compileContracts を先に実行`);
    if (uc.tables.length && !rdb) errors.push(`${uc.slug}: rdb-schema.bundle.yaml が無い。compileRdbSchema を先に実行`);

    for (const op of uc.operations) {
      if (!openapiIndex.has(op)) { errors.push(`${uc.slug}: operation ${op} は openapi.bundle に存在しない`); continue; }
      const gaps = G.exampleGaps(openapiIndex.get(op), openapi);
      for (const gap of gaps) errors.push(`${uc.slug}: operation ${op} に example がない (${gap}) — examples 必須`);
    }
    for (const m of uc.messages) if (!messageNames.has(m)) errors.push(`${uc.slug}: message ${m} は asyncapi.bundle の components.messages に存在しない`);
    for (const t of uc.tables) if (!tableNames.has(t)) errors.push(`${uc.slug}: table ${t} は rdb-schema.bundle に存在しない`);
  }
  return { errors, ucs: ucIndex.ucs.length };
}

module.exports = { validate };

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const contractsDir = args.find(a => !a.startsWith('--'));
    if (!contractsDir) { console.error('Usage: validateUcIndex.js <contracts-dir> [--json]'); process.exit(2); }
    const { errors, ucs } = validate(contractsDir);
    if (args.includes('--json')) console.log(JSON.stringify({ status: errors.length ? 'fail' : 'pass', errors }, null, 2));
    else if (!errors.length) console.log(`PASS: uc-index (${ucs} UC)`);
    else { console.log(`FAIL: uc-index (${errors.length} error)`); for (const e of errors) console.log(`  - ${e}`); }
    process.exit(errors.length ? 1 : 0);
  } catch (e) { console.error(`Error: ${e.message}`); process.exit(2); }
}
