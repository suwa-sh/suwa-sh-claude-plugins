/**
 * schemaValidate.js — JSON Schema サブセットのバリデータ (外部依存なし)
 *
 * v1 の各 validate*.js が個別に持っていた validate() を 1 か所にまとめたもの。
 * 対応: type / enum / pattern / minLength / maxLength / minimum / maximum / required / properties /
 *       additionalProperties(false) / items / minItems / maxItems / $ref(#/$defs/...) / oneOf / anyOf / const
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('./yaml');

function typeOf(data) {
  if (Array.isArray(data)) return 'array';
  if (data === null) return 'null';
  return typeof data;
}

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref: ${ref}`);
  let node = root;
  for (const seg of ref.slice(2).split('/')) {
    node = node && node[seg];
    if (node === undefined) throw new Error(`Unknown $ref: ${ref}`);
  }
  return node;
}

function validate(data, schema, root, jsonPath = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;
  if (schema.$ref) {
    try { schema = resolveRef(schema.$ref, root); }
    catch (e) { return [{ path: jsonPath, message: e.message }]; }
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(data);
    const ok = types.some(t => t === 'integer' ? (typeof data === 'number' && Number.isInteger(data)) : t === actual);
    if (!ok) {
      errors.push({ path: jsonPath, message: `Expected ${types.join('|')}, got ${actual} (value: ${JSON.stringify(data)?.slice(0, 60)})` });
      return errors;
    }
  }
  if (schema.const !== undefined && data !== schema.const) errors.push({ path: jsonPath, message: `Value ${JSON.stringify(data)} is not const ${JSON.stringify(schema.const)}` });
  if (schema.enum && !schema.enum.includes(data)) errors.push({ path: jsonPath, message: `Value "${data}" not in enum [${schema.enum.join(', ')}]` });
  if (typeof data === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) errors.push({ path: jsonPath, message: `Value "${data}" does not match pattern ${schema.pattern}` });
    if (schema.minLength !== undefined && data.length < schema.minLength) errors.push({ path: jsonPath, message: `String too short (${data.length} < ${schema.minLength})` });
    if (schema.maxLength !== undefined && data.length > schema.maxLength) errors.push({ path: jsonPath, message: `String too long (${data.length} > ${schema.maxLength})` });
  }
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) errors.push({ path: jsonPath, message: `Value ${data} < minimum ${schema.minimum}` });
    if (schema.maximum !== undefined && data > schema.maximum) errors.push({ path: jsonPath, message: `Value ${data} > maximum ${schema.maximum}` });
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const req of schema.required || []) if (!(req in data)) errors.push({ path: jsonPath, message: `Missing required property: ${req}` });
    const props = schema.properties || {};
    for (const [key, propSchema] of Object.entries(props)) if (key in data) errors.push(...validate(data[key], propSchema, root, `${jsonPath}.${key}`));
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) if (!(key in props)) errors.push({ path: `${jsonPath}.${key}`, message: `Unexpected property: ${key}` });
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const key of Object.keys(data)) if (!(key in props)) errors.push(...validate(data[key], schema.additionalProperties, root, `${jsonPath}.${key}`));
    }
  }
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) errors.push({ path: jsonPath, message: `Array too short (${data.length} < ${schema.minItems})` });
    if (schema.maxItems !== undefined && data.length > schema.maxItems) errors.push({ path: jsonPath, message: `Array too long (${data.length} > ${schema.maxItems})` });
    if (schema.items) for (let i = 0; i < data.length; i++) errors.push(...validate(data[i], schema.items, root, `${jsonPath}[${i}]`));
  }
  for (const kw of ['oneOf', 'anyOf']) {
    if (!Array.isArray(schema[kw])) continue;
    const passes = schema[kw].filter(s => validate(data, s, root, jsonPath).length === 0).length;
    if (kw === 'anyOf' && passes === 0) errors.push({ path: jsonPath, message: 'Value matches none of anyOf' });
    if (kw === 'oneOf' && passes !== 1) errors.push({ path: jsonPath, message: `Value matches ${passes} of oneOf (expected exactly 1)` });
  }
  return errors;
}

function validateWithSchema(data, schema) { return validate(data, schema, schema, '$'); }

function loadDataFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return filePath.endsWith('.json') ? JSON.parse(text) : parseYaml(text);
}

/**
 * v1 互換の CLI 骨格。終了コード 0 = PASS / 1 = エラーあり / 2 = 読み込み失敗。
 * @param {{argv: string[], schemaPath: string, usage: string, extra?: (data)=>{errors:[], summary?:string[]}}} opts
 */
function runValidatorCli(opts) {
  const args = opts.argv.filter(a => !a.startsWith('--'));
  const flags = new Set(opts.argv.filter(a => a.startsWith('--')));
  if (!args.length) { console.error(opts.usage); process.exit(2); }
  const target = path.resolve(args[0]);
  if (!fs.existsSync(target)) { console.error(`File not found: ${target}`); process.exit(2); }
  let data;
  try { data = loadDataFile(target); } catch (e) { console.error(`Parse error: ${e.message}`); process.exit(2); }
  const schema = JSON.parse(fs.readFileSync(opts.schemaPath, 'utf8'));
  const errors = validateWithSchema(data, schema);
  let summary = [];
  if (opts.extra) { const r = opts.extra(data) || {}; errors.push(...(r.errors || [])); summary = r.summary || []; }
  if (!errors.length) {
    console.log(`PASS: ${target}`);
    for (const s of summary) console.log(`  ${s}`);
    if (flags.has('--json')) console.log(JSON.stringify({ status: 'pass', file: target }, null, 2));
    process.exit(0);
  }
  console.log(`FAIL: ${target}`);
  console.log(`  ${errors.length} error(s):`);
  for (const e of errors) console.log(`  - ${e.path}: ${e.message}`);
  if (flags.has('--json')) console.log(JSON.stringify({ status: 'fail', errors, file: target }, null, 2));
  process.exit(1);
}

module.exports = { validate, validateWithSchema, loadDataFile, runValidatorCli };
