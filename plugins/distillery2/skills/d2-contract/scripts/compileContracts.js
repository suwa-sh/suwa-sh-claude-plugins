#!/usr/bin/env node
'use strict';

/**
 * compileContracts.js <contracts-dir> [--check]
 *
 * 分割 OpenAPI / AsyncAPI を bundle し、UC ごとの contract-slice.json を生成する。
 * v1 (dist-spec/compileContracts.js) の bundle + slice を v2 レイアウトへ移植した:
 *  - 正本は contracts/{openapi,asyncapi}/ の分割 YAML (contracts.json はカタログのみ)。
 *  - slice の元は uc-index.yaml (v1 の use_cases[].provides/consumes と summary は廃止)。
 *  - legacy (非分割) モードと _api-summary / _model-summary は持ち込まない。
 *
 * 出力: generated/openapi.bundle.yaml, generated/asyncapi.bundle.yaml,
 *       generated/slices/<slug>/contract-slice.json
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const G = require('./lib/contractGraph');
const C = require('./lib/contractsDir');
const { resolveDep } = require('../../../scripts/lib/resolveDep');

const REDOCLY_TIMEOUT = 120000;

function bundleOpenapi(entry) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-openapi-'));
  try {
    const output = path.join(temp, 'openapi.json');
    const config = path.join(temp, 'redocly.yaml');
    fs.writeFileSync(config, '{}'); // 空 config で ambient なプリプロセッサ/デコレータの混入を防ぐ
    const cli = resolveDep('@redocly/cli/bin/cli.js', { env: 'REDOCLY_CLI', cwd: path.dirname(entry) });
    const args = ['bundle', entry, '--config', config, '--output', output, '--ext', 'json',
      '--component-renaming-conflicts-severity', 'error'];
    try {
      execFileSync(cli ? process.execPath : 'redocly', cli ? [cli, ...args] : args,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: REDOCLY_TIMEOUT, maxBuffer: 8 * 1024 * 1024,
          env: { ...process.env, REDOCLY_TELEMETRY: 'off', CI: 'true' } });
    } catch (e) {
      throw new Error(`OpenAPI bundle failed. Install @redocly/cli@2.51.1 or set REDOCLY_CLI to its bin/cli.js. ${e.stderr || e.message}`);
    }
    return JSON.parse(fs.readFileSync(output, 'utf8'));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

function bundleAsyncapi(entry) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-asyncapi-'));
  try {
    const output = path.join(temp, 'asyncapi.json');
    try {
      execFileSync(process.execPath, [path.join(__dirname, 'bundleAsyncapi.js'), entry, output],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: REDOCLY_TIMEOUT, maxBuffer: 8 * 1024 * 1024 });
    } catch (e) {
      throw new Error(`AsyncAPI bundle failed. Install @apidevtools/json-schema-ref-parser@14.2.1 or set ASYNCAPI_REF_PARSER. ${e.stderr || e.message}`);
    }
    return JSON.parse(fs.readFileSync(output, 'utf8'));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

function compile(contractsDir) {
  const catalog = C.readCatalog(contractsDir);
  const ucIndex = C.readUcIndex(contractsDir);
  const openapiContracts = C.contractsOfType(catalog, 'openapi');
  const asyncapiContracts = C.contractsOfType(catalog, 'asyncapi');
  C.requireThat(openapiContracts.length <= 1, 'iteration 1 supports at most one openapi contract');
  C.requireThat(asyncapiContracts.length <= 1, 'iteration 1 supports at most one asyncapi contract');

  const files = new Map();
  let openapiBundle = null, asyncapiBundle = null;
  if (openapiContracts.length) {
    const entry = path.join(contractsDir, openapiContracts[0].source);
    C.requireThat(fs.existsSync(entry), `Missing openapi source: ${openapiContracts[0].source}`);
    openapiBundle = bundleOpenapi(entry);
    G.assertResolvable(openapiBundle, 'openapi');
    files.set('openapi.bundle.yaml', C.encodeYaml(openapiBundle));
  }
  if (asyncapiContracts.length) {
    const entry = path.join(contractsDir, asyncapiContracts[0].source);
    C.requireThat(fs.existsSync(entry), `Missing asyncapi source: ${asyncapiContracts[0].source}`);
    asyncapiBundle = bundleAsyncapi(entry);
    G.assertResolvable(asyncapiBundle, 'asyncapi');
    files.set('asyncapi.bundle.yaml', C.encodeYaml(asyncapiBundle));
  }

  const openapiIndex = G.operations(openapiBundle, 'openapi');
  const asyncapiIndex = G.operations(asyncapiBundle, 'asyncapi');
  for (const uc of ucIndex.ucs) {
    const openapiSlice = openapiBundle ? G.slice(openapiBundle, openapiIndex, [...uc.operations].sort(), 'openapi') : null;
    let asyncapiSlice = null;
    if (asyncapiBundle && uc.messages.length) {
      const { ids } = G.operationsForMessages(asyncapiBundle, asyncapiIndex, uc.messages);
      asyncapiSlice = G.slice(asyncapiBundle, asyncapiIndex, ids.sort(), 'asyncapi');
    }
    const slice = { schema_version: C.SLICE_VERSION, uc: uc.slug, openapi: openapiSlice, asyncapi: asyncapiSlice };
    files.set(`slices/${uc.slug}/contract-slice.json`, C.encodeJson(slice));
  }
  return { files, ucIndex };
}

/** generated/ に書き出す。--check なら差分があれば stale を返す。stale な slice ディレクトリは掃除。 */
function run(contractsDir, check = false) {
  const dir = fs.realpathSync(contractsDir);
  const { files, ucIndex } = compile(dir);
  const genDir = C.generatedDir(dir);
  const stale = [];
  const written = [];
  for (const [rel, text] of files) {
    const target = path.join(genDir, rel);
    C.requireThat(path.resolve(target).startsWith(genDir + path.sep), `Output escapes generated/: ${rel}`);
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text) continue;
    if (check) { stale.push(`generated/${rel}`); continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
    written.push(`generated/${rel}`);
  }
  // uc-index に無い slice ディレクトリを掃除する
  const slicesDir = path.join(genDir, 'slices');
  const expected = new Set(ucIndex.ucs.map(u => u.slug));
  if (fs.existsSync(slicesDir)) for (const name of fs.readdirSync(slicesDir)) {
    if (!expected.has(name)) {
      if (check) stale.push(`generated/slices/${name} (obsolete)`);
      else fs.rmSync(path.join(slicesDir, name), { recursive: true, force: true });
    }
  }
  C.requireThat(!check || stale.length === 0, `Stale generated contracts: ${stale.join(', ')}`);
  return { status: check ? 'current' : 'generated', files: files.size, written, ucs: ucIndex.ucs.length };
}

module.exports = { compile, run };

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const contractsDir = args.find(a => !a.startsWith('--'));
    C.requireThat(contractsDir, 'Usage: compileContracts.js <contracts-dir> [--check]');
    console.log(JSON.stringify(run(contractsDir, args.includes('--check'))));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
