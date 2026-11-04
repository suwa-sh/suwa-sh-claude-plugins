#!/usr/bin/env node
'use strict';

/**
 * validateUcIndex.js <contracts-dir> [--json] [--keep-from <git-ref>]
 *
 * uc-index.yaml を検査する:
 *  1. スキーマ (schema-uc-index.json)
 *  2. 参照実在性: operations は openapi.bundle、messages は asyncapi.bundle の components.messages、
 *     tables は rdb-schema.bundle に存在すること
 *  3. examples 必須ルール: UC が使う各 operation に request example (requestBody があるとき) と、
 *     ドキュメント化された各 2xx/4xx status の response example があること
 *  4. x-test-requests が参照する fixture が x-test-fixtures (文書直下か operation) に宣言されていること
 *  5. 区別できない例が無いこと: 1 つの operation で status の違う 2 つの例が、同じ要求
 *     (URL・ヘッダ・fixture・本文。contractGraph.contractTestCases で生成側と同じ計算) を送らないこと
 *
 *  6. --keep-from <ref> (0.3.0): <ref> の uc-index にあった UC がすべて残り、エントリが同じで、UC が使う OpenAPI の operation の定義も同じこと
 *     (骨格の回し直し (基盤の差分・基盤のレビューの反証) で既存の UC の契約を黙って消さない・変えない)
 * bundle が未生成なら compileContracts/compileRdbSchema を先に実行するよう促す。
 * 終了コード: 0 = PASS / 1 = 違反あり / 2 = 読み込み失敗。
 */

const fs = require('node:fs');
const path = require('node:path');
const C = require('./lib/contractsDir');
const G = require('./lib/contractGraph');
const { validateWithSchema } = require('../../d2-common/scripts/lib/schemaValidate');
const { parseYaml } = require('../../d2-common/scripts/lib/yaml');

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
      for (const f of G.undeclaredFixtures(openapiIndex.get(op), openapi)) {
        errors.push(`${uc.slug}: operation ${op} の x-test-requests が参照する fixture "${f}" が x-test-fixtures (文書直下か operation) に宣言されていない`);
      }
      for (const m of G.invalidTestRequests(openapiIndex.get(op))) errors.push(`${uc.slug}: operation ${op} の x-test-requests の ${m}`);
      for (const v of G.unverifiedVariants(openapiIndex.get(op), openapi)) {
        errors.push(`${uc.slug}: operation ${op} の例 "${v.name}" (${v.status}) は同じ status の別の例と中身が違うのに、違いを確かめる項目が無い — x-test-requests.${v.name}.expect に確かめる応答の項目名を書く`);
      }
      for (const k of G.unknownTestRequestKeys(openapiIndex.get(op), openapi)) {
        errors.push(`${uc.slug}: operation ${op} の x-test-requests のキー "${k}" がどの応答の例にも当たらない (応答の例の名前か、ボディ無しの応答の status にする)`);
      }
      for (const { a, b } of G.indistinguishableExamples(openapiIndex.get(op), openapi)) {
        const label = x => (x.name === null ? `${x.status} (ボディ無し)` : `"${x.name}" (${x.status})`);
        errors.push(`${uc.slug}: operation ${op} の例 ${label(a)} と ${label(b)} は同じ要求を送るのに期待する結果が違うので区別できない — x-test-requests で URL の値・ヘッダ・テスト用データ (fixture) を変える`);
      }
    }
    for (const m of uc.messages) if (!messageNames.has(m)) errors.push(`${uc.slug}: message ${m} は asyncapi.bundle の components.messages に存在しない`);
    for (const t of uc.tables) if (!tableNames.has(t)) errors.push(`${uc.slug}: table ${t} は rdb-schema.bundle に存在しない`);
  }
  return { errors, ucs: ucIndex.ucs.length };
}

/** <ref> の契約から、既存の UC のエントリと operation の定義が変わっていないかを見る (git のリポの中で回す) */
function keepFrom(contractsDir, ref) {
  const { spawnSync } = require('node:child_process');
  // キーの順に左右されない比較 (bundle の並びは生成で変わりうる)
  const canonicalJson = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
  const abs = fs.realpathSync(path.resolve(contractsDir)); // git の toplevel は実パス (macOS の /var と /private/var)
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: abs, encoding: 'utf8' });
  if (top.status !== 0) throw new Error(`git のリポでない: ${abs}`);
  const rel = path.relative(fs.realpathSync(top.stdout.trim()), abs).split(path.sep).join('/');
  const show = (p) => { const r = spawnSync('git', ['show', `${ref}:${rel}/${p}`], { cwd: abs, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? parseYaml(r.stdout) : null; };
  const errors = [];
  const old = show('uc-index.yaml');
  if (!old || !Array.isArray(old.ucs) || !old.ucs.length) return errors;
  const cur = C.readUcIndex(contractsDir);
  const curBy = new Map((cur.ucs || []).map((u) => [u.slug, u]));
  const oldApi = show('generated/openapi.bundle.yaml');
  const newApi = C.readBundle(contractsDir, 'openapi.bundle.yaml');
  const oldOps = oldApi ? G.operations(oldApi, 'openapi') : new Map();
  const newOps = newApi ? G.operations(newApi, 'openapi') : new Map();
  for (const u of old.ucs) {
    const now = curBy.get(u.slug);
    if (!now) { errors.push(`${u.slug}: ${ref} の uc-index にあった UC が消えた`); continue; }
    if (canonicalJson(now) !== canonicalJson(u)) errors.push(`${u.slug}: uc-index のエントリが ${ref} から変わった`);
    for (const op of u.operations || []) {
      if (!oldOps.has(op)) continue;
      if (!newOps.has(op)) errors.push(`${u.slug}: operation ${op} が消えた`);
      else if (canonicalJson(newOps.get(op).operation) !== canonicalJson(oldOps.get(op).operation)) errors.push(`${u.slug}: operation ${op} の定義が ${ref} から変わった`);
    }
  }
  return errors;
}

module.exports = { validate, keepFrom };

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const contractsDir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--keep-from');
    if (!contractsDir) { console.error('Usage: validateUcIndex.js <contracts-dir> [--json] [--keep-from <git-ref>]'); process.exit(2); }
    const { errors, ucs } = validate(contractsDir);
    const k = args.indexOf('--keep-from');
    if (k >= 0) errors.push(...keepFrom(contractsDir, args[k + 1]));
    if (args.includes('--json')) console.log(JSON.stringify({ status: errors.length ? 'fail' : 'pass', errors }, null, 2));
    else if (!errors.length) console.log(`PASS: uc-index (${ucs} UC)`);
    else { console.log(`FAIL: uc-index (${errors.length} error)`); for (const e of errors) console.log(`  - ${e}`); }
    process.exit(errors.length ? 1 : 0);
  } catch (e) { console.error(`Error: ${e.message}`); process.exit(2); }
}
