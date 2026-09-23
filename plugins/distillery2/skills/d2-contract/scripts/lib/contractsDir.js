'use strict';

/**
 * contractsDir.js — v2 の contracts/ ディレクトリを読む共通ヘルパ。
 *
 * 正本: contracts.json (カタログ) + 分割 YAML (openapi/ asyncapi/ db/) + uc-index.yaml。
 * 生成物: generated/openapi.bundle.yaml, generated/asyncapi.bundle.yaml,
 *         generated/rdb-schema.bundle.yaml, generated/table-index.yaml,
 *         generated/slices/<slug>/{contract-slice.json, rdb-slice.yaml}。
 */

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml, stringifyYaml } = require('../../../../scripts/lib/yaml');

const CATALOG_VERSION = 'distillery2.contracts/v1';
const UC_INDEX_VERSION = 'distillery2.uc-index/v1';
const SLICE_VERSION = 'distillery2.contract-slice/v1';

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };

/** キーを再帰的にソートした安定コピー。bundle/slice の決定論的出力に使う。 */
function sortKeys(x) {
  if (Array.isArray(x)) return x.map(sortKeys);
  if (object(x)) return Object.fromEntries(Object.keys(x).sort().map(k => [k, sortKeys(x[k])]));
  return x;
}
function encodeYaml(value) { return stringifyYaml(sortKeys(value)) + '\n'; }
function encodeJson(value) { return JSON.stringify(sortKeys(value), null, 2) + '\n'; }

function readCatalog(contractsDir) {
  const file = path.join(contractsDir, 'contracts.json');
  requireThat(fs.existsSync(file), `Missing contracts.json: ${file}`);
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
  requireThat(object(catalog) && catalog.schema_version === CATALOG_VERSION, `schema_version must be ${CATALOG_VERSION}`);
  requireThat(Array.isArray(catalog.contracts) && catalog.contracts.length, 'contracts[] required');
  const ids = new Set();
  for (const c of catalog.contracts) {
    requireThat(object(c) && typeof c.id === 'string' && c.id, 'contract id required');
    requireThat(!ids.has(c.id), `Duplicate contract id: ${c.id}`); ids.add(c.id);
    requireThat(['openapi', 'asyncapi', 'rdb-schema'].includes(c.type), `Unknown contract type: ${c.type} (${c.id})`);
    requireThat(typeof c.source === 'string' && c.source && !path.isAbsolute(c.source) && !c.source.includes('..'),
      `contract source must be a relative path inside contracts/: ${c.id}`);
    requireThat(typeof c.provider === 'string' && c.provider, `contract provider required: ${c.id}`);
    requireThat(Array.isArray(c.consumers), `contract consumers must be an array: ${c.id}`);
  }
  return catalog;
}

function contractsOfType(catalog, type) { return catalog.contracts.filter(c => c.type === type); }

function readUcIndex(contractsDir) {
  const file = path.join(contractsDir, 'uc-index.yaml');
  requireThat(fs.existsSync(file), `Missing uc-index.yaml: ${file}`);
  const data = parseYaml(fs.readFileSync(file, 'utf8'));
  requireThat(object(data) && data.schema_version === UC_INDEX_VERSION, `uc-index schema_version must be ${UC_INDEX_VERSION}`);
  requireThat(Array.isArray(data.ucs), 'uc-index ucs[] required');
  const slugs = new Set();
  for (const uc of data.ucs) {
    requireThat(object(uc) && typeof uc.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(uc.slug), `Invalid UC slug: ${uc?.slug}`);
    requireThat(!slugs.has(uc.slug), `Duplicate UC slug: ${uc.slug}`); slugs.add(uc.slug);
    for (const key of ['operations', 'messages', 'tables']) {
      if (uc[key] === undefined) uc[key] = [];
      requireThat(Array.isArray(uc[key]) && uc[key].every(v => typeof v === 'string'), `${uc.slug}: ${key} must be a string array`);
    }
  }
  return data;
}

function generatedDir(contractsDir) { return path.join(contractsDir, 'generated'); }

/** 生成済み bundle を読む (存在すれば)。downstream (genContractTests 等) が使う。 */
function readBundle(contractsDir, name) {
  const file = path.join(generatedDir(contractsDir), name);
  if (!fs.existsSync(file)) return null;
  return parseYaml(fs.readFileSync(file, 'utf8'));
}

function readSlice(contractsDir, slug) {
  const file = path.join(generatedDir(contractsDir), 'slices', slug, 'contract-slice.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = {
  CATALOG_VERSION, UC_INDEX_VERSION, SLICE_VERSION,
  object, requireThat, sortKeys, encodeYaml, encodeJson,
  readCatalog, contractsOfType, readUcIndex, generatedDir, readBundle, readSlice,
};
